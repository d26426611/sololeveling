import { CONFIG } from "../data/index.js";
import { Player, resetPlayer } from "../state/player.js";
import { GlobalSystem } from "../state/globalSystem.js";
import { recalcPlayerStats, applySanityLoss } from "../state/playerStats.js";
import { StorageSystem } from "../systems/storage.js";
import { Inventory } from "../systems/inventory.js";
import { ItemSystem } from "../systems/itemGenerator.js";
import { BattleSystem, configureBattleSystem } from "../systems/combat.js";
import { EventDirector, configureEventDirector } from "./eventDirector.js";
import { registerClassStyleModifiers } from "./classStyleModifiers.js";
import { registerRaceTraitModifiers } from "./raceTraitModifiers.js";
import { registerSetBonusModifiers } from "./setBonusModifiers.js";
import { isRiftActive, tickRift, rollForRift } from "./riftSystem.js";
import { renderSetup, getSetupSelection } from "../ui/setupScreen.js";
import { renderEventStage, initEventControls } from "../ui/eventScreen.js";
import { showEventScreen } from "../ui/screens.js";
import { updatePlayerPanel, recalcAndRefresh } from "../ui/playerPanel.js";
import { initInventoryPanel, renderInventory } from "../ui/inventoryPanel.js";
import { initCraftingPanel } from "../ui/craftingPanel.js";
import { initBlacksmithPanel } from "../ui/blacksmithPanel.js";
import { initSystemPanel } from "../ui/systemPanel.js";
import { initTabs } from "../ui/tabs.js";
import { toast } from "../ui/toast.js";

const RARITY_RANK = { common: 0, uncommon: 1, rare: 2, epic: 3, legendary: 4, phantasm: 5, abyssal: 5 };

// 一般區域的順序改用明確的 order 欄位（見 data/biomes.js），不再依賴物件 key 插入順序或
// minDepth 絕對深度來自動切換 —— 區域切換現在只透過打贏區域王的 advanceBiome() 觸發。
function normalBiomeEntries() {
  return Object.entries(CONFIG.biomes)
    .filter(([, b]) => b.order !== undefined)
    .sort((a, b) => a[1].order - b[1].order);
}

function biomeIdByIndex(index) {
  const entries = normalBiomeEntries();
  const clamped = Math.max(0, Math.min(index, entries.length - 1));
  return entries[clamped][0];
}

export const Game = {
  init() {
    GlobalSystem.init();
    registerClassStyleModifiers();
    registerRaceTraitModifiers();
    registerSetBonusModifiers();
    renderSetup();
    initTabs();
    initEventControls();
    initInventoryPanel();
    initCraftingPanel();
    initBlacksmithPanel();
    initSystemPanel();

    configureBattleSystem({
      renderEventStage,
      nextDepth: () => this.nextDepth(),
      enterWorld: (w) => this.enterWorld(w),
      leaveWorld: (penalty) => this.leaveWorld(penalty),
      gameOver: () => this.gameOver(),
      advanceBiome: () => this.advanceBiome(),
    });
    configureEventDirector({
      nextDepth: () => this.nextDepth(),
      enterWorld: (w) => this.enterWorld(w),
      gameOver: () => this.gameOver(),
    });

    document.addEventListener("game:enter-world", (e) => this.enterWorld(e.detail));

    document.getElementById("btn-start-game").onclick = () => this.startGame();

    if (StorageSystem.hasSave()) {
      const loadBtn = document.getElementById("btn-load-game");
      loadBtn.style.display = "inline-block";
      loadBtn.onclick = () => {
        if (StorageSystem.loadGame()) {
          recalcPlayerStats();
          document.getElementById("setup-screen").style.display = "none";
          document.getElementById("app").style.display = "grid";
          showEventScreen();
          updatePlayerPanel();
          toast("讀取成功", "gain");
        }
      };
    }
  },

  startGame() {
    const { race, cls } = getSetupSelection();
    if (!race || !cls) return;
    resetPlayer();
    Player.race = race;
    Player.class = cls;
    Player.equipment.weapon = ItemSystem.generate("weapon");
    recalcPlayerStats();
    Player.currentHp = Player.stats.maxHp;

    const legacy = GlobalSystem.retrieveLegacyItem();
    if (legacy) {
      Inventory.add(legacy);
      toast(`時空膠囊：找回了 ${legacy.name}`, "gain");
    }

    document.getElementById("setup-screen").style.display = "none";
    document.getElementById("app").style.display = "grid";
    showEventScreen();
    updatePlayerPanel();
    renderInventory();
    this.nextDepth();
  },

  offerAwakening(classId) {
    const c = CONFIG.classes[classId];
    renderEventStage(
      "隱藏職業覺醒",
      "✨",
      `<p>你感受到體內湧現出異樣的力量...<br>是否要覺醒為 <b>${c.name}</b>？<br>${c.desc}</p>`,
      `<button class="btn-primary" data-action="accept">覺醒</button><button class="btn-secondary" data-action="reject">維持現狀</button>`,
      (action) => {
        if (action === "accept") {
          Player.class = classId;
          GlobalSystem.unlockClass(classId, toast);
          recalcAndRefresh();
          toast(`覺醒為 ${c.name}！`, "gain");
        } else {
          Player.flags[`rej_${classId}`] = true;
        }
        this.continueDepthRoll();
      }
    );
  },

  offerPromotion(classId) {
    const c = CONFIG.classes[classId];
    renderEventStage(
      "職業升職",
      "🎖️",
      `<p>你已經證明了自己的實力，可以晉升為更強大的職業了。<br>是否要升職為 <b>${c.name}</b>？<br>${c.desc}</p>`,
      `<button class="btn-primary" data-action="accept">升職</button><button class="btn-secondary" data-action="reject">維持現狀</button>`,
      (action) => {
        Player.flags.promotion_resolved = true;
        if (action === "accept") {
          Player.class = classId;
          GlobalSystem.unlockClass(classId, toast);
          recalcAndRefresh();
          toast(`升職為 ${c.name}！`, "gain");
        }
        this.continueDepthRoll();
      }
    );
  },

  nextDepth() {
    Player.depth++;
    Player.biomeDepth++;

    // Rift：只在無盡循環階段才可能發生，跟業力印記死亡/幻界之鑰這兩條「刻意進入次元」
    // 的路徑完全獨立——已經身處 Rift 就倒數層數，否則才骰新的 Rift 觸發機率。
    if (isRiftActive()) tickRift();
    else rollForRift();

    GlobalSystem.checkDepthMilestones(Player.depth, toast);

    if (Player.currentWorld === "phantasm") applySanityLoss(1);

    // 模擬測試發現：舊版每層固定回 5 點血，在 maxHp 已經是 150~500 的正常進度下根本無感，
    // 玩家不是被單一強怪一擊擊殺，而是每場「看似打得贏」的一般戰鬥持續小量掉血、
    // 固定回復量完全跟不上，最終被磨死在王之前。改成跟 maxHp 等比例回復（至少 10 點）。
    if (Player.currentHp < Player.stats.maxHp) {
      const regen = Math.max(10, Math.floor(Player.stats.maxHp * 0.08));
      Player.currentHp = Math.min(Player.stats.maxHp, Player.currentHp + regen);
    }

    updatePlayerPanel();
    StorageSystem.saveGame();

    const promotion = EventDirector.checkPromotion();
    if (promotion) return this.offerPromotion(promotion);

    const awakened = EventDirector.checkAwakening();
    if (awakened) return this.offerAwakening(awakened);

    this.continueDepthRoll();
  },

  // 區域王把關轉換的節奏：第一個區域(平原)撐 20 層才遇到區域王，之後每個區域要撐 50 層。
  // 煉獄/幻界這類特殊世界不屬於一般區域序列，固定用 20 層一個王的節奏。
  continueDepthRoll() {
    const bossThreshold = Player.currentWorld === "normal" ? (Player.biomeIndex === 0 ? 20 : 50) : 20;
    if (Player.biomeDepth === bossThreshold) {
      this.triggerBoss();
      return;
    }
    const r = Math.random();
    if (r < 0.7) this.triggerCombat();
    else if (r < 0.85) EventDirector.trigger();
    else this.triggerChest();
  },

  triggerCombat() {
    const biome = CONFIG.biomes[Player.currentBiomeId] || CONFIG.biomes.plains;
    // 菁英怪至少要撐過區域前 5 層才會出現，不是一進區域就有機率遇到。
    const isElite = Player.biomeDepth >= 5 && Math.random() < 0.15 && biome.elites?.length;
    const pool = isElite ? biome.elites : biome.monsters;
    const key = pool[Math.floor(Math.random() * pool.length)];
    BattleSystem.encounter(key, false, !!isElite);
  },

  triggerBoss() {
    const biome = CONFIG.biomes[Player.currentBiomeId];
    BattleSystem.encounter(biome.boss, true, false);
  },

  // 打贏一般區域的王才會真的換到下一個區域；已經是最後一個區域(沙漠)時原地重複挑戰，
  // 作為「無盡爬塔」清完所有既定區域後的終局迴圈，而不是卡住不動。
  advanceBiome() {
    const entries = normalBiomeEntries();
    if (Player.biomeIndex < entries.length - 1) {
      Player.biomeIndex++;
    } else {
      // 已經在最後一個區域(沙漠)又打贏一次王：初次清完 7 區的「一輪破關」已經結束，
      // 從這裡開始才是真正的無盡循環——Rift 只在這個階段之後才可能觸發。
      Player.endlessLoopActive = true;
    }
    Player.biomeDepth = 0;
    Player.currentBiomeId = biomeIdByIndex(Player.biomeIndex);
    updatePlayerPanel();
  },

  triggerChest() {
    const item = ItemSystem.generate();
    Inventory.add(item);
    const gold = Math.floor(Math.random() * 50) + 10;
    Player.gold += gold;
    updatePlayerPanel();
    renderEventStage(
      "寶箱",
      "📦",
      `<p>獲得 <span class="${CONFIG.rarity[item.rarity].color}">${item.name}</span> 與 ${gold}G</p>`,
      `<button class="btn-primary" data-action="continue">確認</button>`,
      () => this.nextDepth()
    );
  },

  enterWorld(world) {
    Player.currentWorld = world;
    Player.currentBiomeId = world;
    Player.biomeDepth = 0;
    if (world === "phantasm") Player.sanity = 100;
    Player.currentHp = Player.stats.maxHp;
    updatePlayerPanel();
    toast(world === "purgatory" ? "你墮入了無間煉獄..." : "你踏入了幻夢境...", "warn");
    this.nextDepth();
  },

  leaveWorld(deathPenalty) {
    Player.currentWorld = "normal";
    Player.currentBiomeId = biomeIdByIndex(Player.biomeIndex);
    Player.biomeDepth = 0;
    if (deathPenalty) {
      Player.currentHp = Math.max(1, Math.floor(Player.stats.maxHp * 0.3));
      toast("你狼狽地回到了現實，帶著滿身傷痕", "warn");
    } else {
      toast("回歸現實", "gain");
    }
    updatePlayerPanel();
    this.nextDepth();
  },

  // 死亡傳承：不是單純 Game Over，而是把最好的一件裝備存進時空膠囊、
  // 依本輪最大深度解鎖新的種族/職業，讓下一輪從更強的起點開始。
  gameOver() {
    let best = null;
    for (const slot in Player.equipment) {
      const item = Player.equipment[slot];
      if (item && (!best || (RARITY_RANK[item.rarity] || 0) > (RARITY_RANK[best.rarity] || 0))) best = item;
    }
    if (best) GlobalSystem.storeLegacyItem(best);
    GlobalSystem.unlockAchievement("death_legacy", toast);
    const finalDepth = Player.depth;
    const unlocked = GlobalSystem.unlockLegacyByDepth(finalDepth, toast);

    localStorage.removeItem(StorageSystem.SAVE_KEY);
    resetPlayer();

    document.getElementById("app").style.display = "none";
    document.getElementById("setup-screen").style.display = "flex";
    renderSetup();

    let msg = `旅程在第 ${finalDepth} 層畫下句點。`;
    if (best) msg += ` 裝備「${best.name}」已存入時空膠囊。`;
    if (unlocked) msg += ` 解鎖了新的${unlocked.type === "race" ? "種族" : "職業"}：${unlocked.name}！`;
    toast(msg, "warn");
  },
};
