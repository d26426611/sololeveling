// 防具子類型身分表：跟 weaponSubtypes.js 同一模式，但套用對象是 armor_upper/armor_lower。
// 子類型不是額外寫在每個防具模板上的資料（那需要重新編寫整個 item pool），而是
// inferArmorSubtype() 在生成當下依模板本身的數值組成推斷出來，讓身分系統套用在既有
// 資料之上，而不是取代/重寫它。
export const armorSubtypes = {
  heavy: { hpMult: 1.15, speedFlat: -5 }, // 厚重：生命更高、速度打折
  light: { hpMult: 0.85, speedFlat: 10 }, // 輕盈：速度更高、生命打折
  guardian: { hpMult: 0.9, defFlat: 0.05 }, // 守護：略犧牲生命換防禦
};

export function inferArmorSubtype(base) {
  if (base.baseDef) return "guardian";
  const hp = base.baseHp || 0;
  const spd = base.baseSpd || 0;
  // 生命與速度數值量級差異很大，不直接比較兩者絕對值——有明顯速度加成、
  // 且生命值相對偏低(同格位裡走速度路線的防具生命值本來就比較保守)才算輕盈。
  if (spd > 0 && hp <= 100) return "light";
  return "heavy";
}
