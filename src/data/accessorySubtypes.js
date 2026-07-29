// 飾品子類型身分表：跟 armorSubtypes.js 同一模式，inferAccessorySubtype() 依模板數值組成
// 推斷子類型，不需要重新編寫既有的 item pool 資料。
export const accessorySubtypes = {
  aggressive: { atkMult: 1.15 }, // 攻擊掛飾：進攻導向，原始攻擊力數值再放大
  guardian: { hpMult: 1.15 }, // 生命掛飾：續航導向，原始生命值數值再放大
  // utility：沒有明顯主屬性的飾品(例如純靠 desc 特殊機制的道具)，走「不追求原始數值、
  // 換取額外機制」路線——小額爆擊 + 金幣加成，而不是把某個數值直接放大。
  utility: { critFlat: 0.03, goldDropFlat: 0.1 },
};

export function inferAccessorySubtype(base) {
  if (base.baseAtk) return "aggressive";
  if (base.baseHp) return "guardian";
  return "utility";
}
