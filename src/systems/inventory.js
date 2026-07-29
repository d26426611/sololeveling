import { CONFIG } from "../data/index.js";
import { Player } from "../state/player.js";
import { GlobalSystem } from "../state/globalSystem.js";
import { recalcPlayerStats } from "../state/playerStats.js";
import { toast } from "../ui/toast.js";
import { emit } from "./combatModifierPipeline.js";

const DISASSEMBLE_DUST = {
  common: 1,
  uncommon: 3,
  rare: 10,
  epic: 50,
  legendary: 200,
  phantasm: 1000,
  abyssal: 1000,
};

export const Inventory = {
  add(item) {
    Player.inventory.push(item);
    GlobalSystem.unlockItem(item.baseName || item.name);
    toast(`獲得：<span class="${(CONFIG.rarity[item.rarity] || { color: "text-common" }).color}">${item.name}</span>`, "gain");
  },

  remove(id) {
    Player.inventory = Player.inventory.filter((i) => i.id !== id);
  },

  find(id) {
    return Player.inventory.find((i) => i.id === id);
  },

  equip(id) {
    const item = this.find(id);
    if (!item) return;
    let slot = item.type;
    if (item.type === "accessory") {
      if (!Player.equipment.acc1) slot = "acc1";
      else if (!Player.equipment.acc2) slot = "acc2";
      else if (!Player.equipment.acc3) slot = "acc3";
      else slot = "acc1";
    }
    if (Player.equipment[slot]) this.add(Player.equipment[slot]);
    Player.equipment[slot] = item;
    this.remove(id);
    recalcPlayerStats();
  },

  unequip(slot) {
    const item = Player.equipment[slot];
    if (!item) return;
    this.add(item);
    Player.equipment[slot] = null;
    recalcPlayerStats();
  },

  use(id) {
    const item = this.find(id);
    if (!item || item.type !== "consumable") return null;

    // 亡靈種族特性：非生者無法使用藥水恢復生命。
    const potionCtx = { race: Player.race, hasHpEffect: !!item.effect?.hp, blocked: false };
    emit("beforePotionUse", potionCtx);
    if (potionCtx.blocked) {
      toast("亡靈無法使用藥水！", "warn");
      return null;
    }

    if (item.effect?.hp) {
      const heal = item.effect.hp;
      Player.currentHp = Math.min(Player.stats.maxHp, Player.currentHp + heal);
      toast(`恢復了 ${heal} HP`, "heal");
    }
    const openWorld = item.effect?.open_world || null;
    this.remove(id);
    return { openWorld };
  },

  disassemble(id) {
    const item = this.find(id);
    if (!item) return false;
    const dust = DISASSEMBLE_DUST[item.rarity] || 0;
    if (dust <= 0) {
      toast("此物品無法分解", "warn");
      return false;
    }
    Player.magicDust = (Player.magicDust || 0) + dust;
    this.remove(id);
    toast(`分解獲得 ${dust} ✨魔塵`, "gain");
    return true;
  },

  countMat(key) {
    if (key === "gold") return Player.gold;
    if (key === "magic_dust") return Player.magicDust || 0;
    if (!CONFIG.materials[key]) return 0;
    return Player.inventory.filter((i) => i.type === "material" && i.baseName === CONFIG.materials[key].name).length;
  },

  removeMat(key, n) {
    if (key === "gold") {
      Player.gold = Math.max(0, Player.gold - n);
      return;
    }
    if (key === "magic_dust") {
      Player.magicDust = Math.max(0, (Player.magicDust || 0) - n);
      return;
    }
    if (!CONFIG.materials[key]) return;
    for (let i = 0; i < n; i++) {
      const idx = Player.inventory.findIndex((x) => x.baseName === CONFIG.materials[key].name);
      if (idx > -1) Player.inventory.splice(idx, 1);
    }
  },
};
