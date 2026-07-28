// 武器子類型身分表：讓「匕首 vs 法杖」不再只是比較誰的 baseAtk 數字大，
// 而是有清楚的定位取捨。乘算修正套在物品模板的 baseAtk 上、加算修正直接疊加為額外屬性，
// 在 itemGenerator 產生武器時、套用稀有度倍率之前套用。
export const weaponSubtypes = {
  sword: { atkMult: 1.0 }, // 均衡基準
  axe: { atkMult: 1.15, speedFlat: -5 }, // 高爆發、慢
  mace: { atkMult: 1.05, defFlat: 0.03 }, // 厚重、帶防禦
  dagger: { atkMult: 0.85, critFlat: 0.08 }, // 爆擊流
  bow: { atkMult: 0.9, speedFlat: 10 }, // 先攻/速度流
  staff: { atkMult: 0.8, critDmgFlat: 0.3 }, // 法系、爆傷流
  shield: { atkMult: 0.5, defFlat: 0.05, blockFlat: 0.05 }, // 純防禦
};
