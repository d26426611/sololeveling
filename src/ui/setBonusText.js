import { CONFIG } from "../data/index.js";

const STAT_LABELS = {
  maxHp: "血量",
  atk: "攻擊",
  speed: "速度",
  crit: "暴擊",
  def: "減傷",
  dodge: "閃避",
  block: "格擋",
  lifesteal: "吸血",
  hp_regen: "回血",
  true_dmg: "真實傷害",
  reflect: "反傷",
  sanity_regen: "回理智",
  all_pct: "全屬性",
  atk_pct: "攻擊",
  crit_dmg: "爆傷",
};

const PCT_KEYS = new Set(["crit", "def", "dodge", "block", "lifesteal", "reflect", "all_pct", "atk_pct", "crit_dmg"]);

function formatBonus(bonus) {
  return Object.entries(bonus)
    .map(([k, v]) => {
      const label = STAT_LABELS[k] || k;
      const val = PCT_KEYS.has(k) ? `${Math.round(v * 100)}%` : v > 0 ? `+${v}` : `${v}`;
      return `${label}${val}`;
    })
    .join(" ");
}

// 背包物品卡片用：套裝名 + 各件數門檻的加成內容，讓玩家不用裝備上去就能先看到套裝效果。
export function setBonusPreview(setId) {
  const set = CONFIG.sets[setId];
  if (!set) return "";
  const tiers = [2, 4, 6].filter((t) => set[`bonus${t}`]).map((t) => `${t}件:${formatBonus(set[`bonus${t}`])}`);
  return `【${set.name}】${tiers.join(" ")}`;
}

// 玩家面板 active-sets 用：目前已啟用哪些加成、還差幾件到下一階。
export function setProgressSummary(setId, count) {
  const set = CONFIG.sets[setId];
  if (!set) return "";
  const tiers = [2, 4, 6].filter((t) => set[`bonus${t}`]);
  const active = tiers.filter((t) => count >= t);
  const next = tiers.find((t) => count < t);

  let text = `${set.name}(${count}${next ? `/${next}` : ""})`;
  text += ` 已啟用:${active.length ? active.map((t) => formatBonus(set[`bonus${t}`])).join(" ") : "無"}`;
  if (next) text += ` 下一階(${next}件):${formatBonus(set[`bonus${next}`])}`;
  return text;
}
