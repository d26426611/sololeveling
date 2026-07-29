// Combat Modifier Pipeline：職業技能、種族特性、套裝加成、次元調整共用的唯一掛勾機制。
// 見 docs/adr/0003-unified-combat-modifier-pipeline.md。
const modifiers = [];

export function registerModifier(modifier) {
  modifiers.push(modifier);
}

// 主要給測試用：清空已註冊的 modifier，避免測試之間互相污染。
export function resetModifiers() {
  modifiers.length = 0;
}

// 選擇性移除符合條件的 modifier，例如次元調整需要「一組一起註冊、一組一起解除」，
// 不能整批 resetModifiers() 連 class/race/set 都清掉。
export function unregisterModifiers(predicate) {
  for (let i = modifiers.length - 1; i >= 0; i--) {
    if (predicate(modifiers[i])) modifiers.splice(i, 1);
  }
}

// 硬上限只在這裡套用一次，不管疊了幾個 modifier 進來，避免任何單一 modifier 需要自己
// 顧慮「疊加後會不會爆表」。def/dodge/block 都是「機率型減傷」，上限跟 def 一致。
const STAT_CAPS = { crit: 1.0, def: 0.9, dodge: 0.9, block: 0.9 };

function applyCaps(stats) {
  for (const key in STAT_CAPS) {
    if (stats[key] !== undefined && stats[key] > STAT_CAPS[key]) stats[key] = STAT_CAPS[key];
  }
}

export function emit(hookName, context) {
  for (const modifier of modifiers) {
    if (modifier.hook !== hookName) continue;
    if (modifier.condition && !modifier.condition(context)) continue;
    modifier.apply(context);
  }
  if (context.stats) applyCaps(context.stats);
}
