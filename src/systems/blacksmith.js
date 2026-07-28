import { Player } from "../state/player.js";
import { recalcPlayerStats } from "../state/playerStats.js";
import { toast } from "../ui/toast.js";

// 找回舊版被拿掉的鐵匠系統，並修正原本「純金幣、指數成本但只有線性 10% 收益、無上限」的失衡曲線：
// Lv1-5 只花金幣；Lv6 起額外需要「魔塵」(分解裝備取得)，讓分解系統有實際用途；
// 設一個軟上限 15 級，作為金幣/魔塵在後期的消耗地，避免無限堆疊。
export const MAX_LEVEL = 15;
const DUST_START_LEVEL = 5;

export function upgradeCost(level) {
  const gold = Math.floor(50 * Math.pow(1.4, level));
  const dust = level >= DUST_START_LEVEL ? (level - DUST_START_LEVEL + 1) * 20 : 0;
  return { gold, dust };
}

export const Blacksmith = {
  equippedList() {
    return Object.entries(Player.equipment)
      .filter(([, item]) => !!item)
      .map(([slot, item]) => ({ slot, item }));
  },

  canUpgrade(item) {
    const level = item.level || 0;
    if (level >= MAX_LEVEL) return false;
    const { gold, dust } = upgradeCost(level);
    return Player.gold >= gold && (Player.magicDust || 0) >= dust;
  },

  upgrade(slot) {
    const item = Player.equipment[slot];
    if (!item) return false;
    const level = item.level || 0;
    if (level >= MAX_LEVEL) {
      toast("已達強化上限", "warn");
      return false;
    }
    const { gold, dust } = upgradeCost(level);
    if (Player.gold < gold) {
      toast("金幣不足", "warn");
      return false;
    }
    if ((Player.magicDust || 0) < dust) {
      toast("魔塵不足（可在背包分解裝備取得）", "warn");
      return false;
    }

    Player.gold -= gold;
    Player.magicDust -= dust;
    item.level = level + 1;
    for (let k in item.stats) item.stats[k] = Math.ceil(item.stats[k] * 1.1);

    toast(`強化成功！${item.name} +${item.level}`, "gain");
    recalcPlayerStats();
    return true;
  },
};
