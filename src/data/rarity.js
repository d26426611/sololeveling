export const rarity = {
  common: { name: "普通", color: "text-common", border: "border-common", mult: 1.0 },
  uncommon: { name: "優良", color: "text-uncommon", border: "border-uncommon", mult: 1.2 },
  rare: { name: "稀有", color: "text-rare", border: "border-rare", mult: 1.5 },
  epic: { name: "史詩", color: "text-epic", border: "border-epic", mult: 2.0 },
  legendary: { name: "傳說", color: "text-legendary", border: "border-legendary", mult: 3.0 },
  // 後期專屬
  phantasm: { name: "幻影", color: "text-phantasm", border: "border-phantasm", mult: 5.0 }, // 幻界
  abyssal: { name: "深淵", color: "text-abyssal", border: "border-abyssal", mult: 10.0 }, // 煉獄
};

const RARITY_ORDER = ["common", "uncommon", "rare", "epic", "legendary"];

function pickWeighted(weights) {
  const total = Object.values(weights).reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  for (const key of RARITY_ORDER) {
    const w = weights[key] || 0;
    if (r < w) return key;
    r -= w;
  }
  return "common";
}

/**
 * 一般世界的稀有度權重曲線：depth=0 附近仍以普通為主，
 * 隨深度平滑爬升到 depth>=120 時的終值分佈
 * (legendary 5% / epic 10% / rare 20% / uncommon 25% / common 40%)。
 * 舊版用硬門檻(depth>20/50/100)判斷，導致深度 0~20 時就已經有 60% 機率掉優良，
 * 新手期完全沒有「主要掉普通」的成長感。
 * 用 sqrt 而非線性讓早期(depth 0~20)爬升更快 —— 玩家反應前期太難拿到有感的裝備提升，
 * sqrt 曲線在深度 10~20 就能摸到 uncommon/rare，深度 120 後收斂到跟線性版一樣的終值分佈。
 */
/**
 * 模擬驗證發現：稀有度機率曲線在 depth 120 封頂之後就固定在終值分佈(common 40%~legendary 5%)，
 * 期望倍率封頂在約 1.35x，永遠不再成長——但怪物 baseHp/baseAtk 是跨區域逐一設計成大約 1.8x
 * 級距爬升(見 ADR-0004)，而且沒有封頂。兩條曲線一個停在原地、一個持續爬升，跨過 depth 120
 * (森林/洞穴交界附近)之後裝備成長完全跟不上怪物成長，越晚期的區域越像撞牆——這不是單一怪物
 * 數值抄錯，是整個「稀有度機率曲線」跟「怪物數值曲線」的成長速率從設計上就不匹配。
 *
 * 這裡加一個獨立於稀有度機率之外的「深度動力倍率」：depth<=120 維持 1.0（早期平衡已經驗證過，
 * 不動它），超過 120 之後用跟怪物同樣的「每區域約 1.8x」速率持續成長(用連續的 (depth-120)/50
 * 而非整數樓層數，讓成長感是平滑爬升，不是每跨一個區域邊界就頓一下)。跟稀有度倍率是相乘關係、
 * 各自獨立，不影響稀有度機率本身怎麼骰。
 */
export function depthPowerScale(depth) {
  if (depth <= 120) return 1.0;
  const regionsPast = (depth - 120) / 50;
  return Math.pow(2.5, regionsPast);
}

export function rollRarity(depth, world) {
  if (world === "purgatory") {
    return Math.random() < 0.2 ? "abyssal" : "legendary";
  }
  if (world === "phantasm") {
    return Math.random() < 0.2 ? "phantasm" : "epic";
  }

  const t = Math.sqrt(Math.min(1, Math.max(0, depth) / 120));
  const ramp = (start) => Math.max(0, (t - start) / (1 - start));

  const weights = {
    common: 92 - 52 * t, // 92 -> 40
    uncommon: 8 + 17 * t, // 8 -> 25
    rare: 20 * ramp(0.1), // 深度 12 後開始出現，滿曲線 20%
    epic: 10 * ramp(0.35), // 深度 42 後開始出現
    legendary: 5 * ramp(0.7), // 深度 84 後開始出現
  };
  return pickWeighted(weights);
}
