import { CONFIG } from "../data/index.js";
import { Player } from "./player.js";

// 依種族/職業/裝備/套裝重新計算最終屬性。獨立成一個只依賴 CONFIG 與 Player 的模組，
// 讓 Inventory / Blacksmith / Crafting 等系統都能直接呼叫，不需要透過 Game controller，避免循環 import。
export function recalcPlayerStats() {
  const r = CONFIG.races[Player.race];
  const c = CONFIG.classes[Player.class];
  let s = {
    ...Player.baseStats,
    crit: 0.05,
    dodge: 0,
    block: 0,
    lifesteal: 0,
    hp_regen: 0,
    // 模擬測試發現：平原新手套裝(adventurer)完全不含 def 屬性，玩家整個新手區域都是 0% 減傷，
    // 每場戰鬥(即使對手不強)都硬扛全額傷害，多場戰鬥累積下來磨死人。給一個不靠裝備的基礎韌性。
    def: 0.15,
    crit_dmg: 1.5,
    true_dmg: 0,
    reflect: 0,
    gold_drop: 1.0,
  };

  if (c) for (let k in c.bonus) s[k] = (s[k] || 0) + c.bonus[k];

  Player.activeSets = {};
  for (let slot in Player.equipment) {
    const item = Player.equipment[slot];
    if (!item) continue;
    if (item.stats) {
      // 偏好武器加成：職業慣用的武器子類型，該武器貢獻的攻擊力再加乘。
      // 不做跨職業硬鎖（任何職業都能裝備任何武器），但拿對偏好武器有明顯優勢區間。
      const isPreferredWeapon = slot === "weapon" && c?.preferred?.includes(item.subtype);
      for (let k in item.stats) {
        const val = isPreferredWeapon && k === "atk" ? Math.round(item.stats[k] * 1.15) : item.stats[k];
        s[k] = (s[k] || 0) + val;
      }
    }
    if (item.setId) Player.activeSets[item.setId] = (Player.activeSets[item.setId] || 0) + 1;
  }

  for (let sid in Player.activeSets) {
    const cnt = Player.activeSets[sid];
    const set = CONFIG.sets[sid];
    if (!set) continue;
    const apply = (bonus) => {
      for (let k in bonus) {
        if (k === "all_pct") {
          s.atk = Math.floor(s.atk * (1 + bonus[k]));
          s.maxHp = Math.floor(s.maxHp * (1 + bonus[k]));
        } else {
          s[k] = (s[k] || 0) + bonus[k];
        }
      }
    };
    if (cnt >= 2 && set.bonus2) apply(set.bonus2);
    if (cnt >= 4 && set.bonus4) apply(set.bonus4);
    if (cnt >= 6 && set.bonus6) apply(set.bonus6);
  }

  if (r) for (let k in r.mod) if (s[k]) s[k] = Math.floor(s[k] * r.mod[k]);

  if (Player.flags.mark_of_sin) {
    s.atk *= 2;
    s.def = 0;
  }

  Player.stats = s;
  if (Player.currentHp > s.maxHp) Player.currentHp = s.maxHp;
}

// 虛空行者種族特性：沒有實體，理智值消耗減半。
// sanity_regen（虛空行者套裝提供）：套裝資料定義了這個數值卻從沒被讀取過，
// 在這裡直接抵銷部分理智消耗，等同「每層小幅回復理智」。
export function applySanityLoss(amount) {
  const cost = Player.race === "void_walker" ? Math.ceil(amount / 2) : amount;
  const net = Math.max(0, cost - (Player.stats.sanity_regen || 0));
  Player.sanity = Math.min(100, Math.max(0, Player.sanity - net));
}
