// 次元的 Procedural Modifier 資料表。每個次元調整由一組 Combat Modifier 組成，用 group
// 標籤綁在一起，activateDimensionModifier()/deactivateDimensionModifier() 讓它們一次
// 註冊/註銷，證明既有的 pipeline（class/race/set 已經在用）不需要為「次元調整」另外寫一套
// 專用系統，就能撐起第四種來源。只在 Endless Loop / Rift 期間才會被呼叫啟用。
// 見 docs/adr/0002-procedural-dimension-modifiers-for-endless-freshness.md、
// docs/adr/0003-unified-combat-modifier-pipeline.md。
import { registerModifier, unregisterModifiers } from "../systems/combatModifierPipeline.js";

const DIMENSION_MODIFIERS = {
  // 「這次進地獄，傷害雙倍」：雙方傷害都乘二，戰鬥節奏加快、風險同步拉高。
  war_zone: [
    {
      id: "dimension-war-zone-player-dmg",
      source: "dimension",
      hook: "beforePlayerHit",
      apply: (ctx) => { ctx.dmg = Math.floor(ctx.dmg * 2); },
    },
    {
      id: "dimension-war-zone-enemy-dmg",
      source: "dimension",
      hook: "beforeEnemyHit",
      apply: (ctx) => { ctx.dmg = Math.floor(ctx.dmg * 2); },
    },
  ],

  // 「這次幻界，掉落 x3 但防禦歸零」：賭高風險換高報酬，防禦直接歸零而非疊加式減免。
  shattered_defense: [
    {
      id: "dimension-shattered-defense-gold",
      source: "dimension",
      hook: "statCalculation",
      apply: (ctx) => { ctx.stats.gold_drop = (ctx.stats.gold_drop || 1.0) * 3; },
    },
    {
      id: "dimension-shattered-defense-def",
      source: "dimension",
      hook: "statCalculation",
      apply: (ctx) => { ctx.stats.def = 0; },
    },
  ],

  // 「這次現實不穩定」：每一擊的傷害浮動範圍被拉到極端，不分職業一律適用。
  chaos_roll: [
    {
      id: "dimension-chaos-roll",
      source: "dimension",
      hook: "rollDamage",
      apply: (ctx) => { ctx.rand = 0.1 + Math.random() * 2.8; },
    },
  ],
};

export function listDimensionModifiers() {
  return Object.keys(DIMENSION_MODIFIERS);
}

export function activateDimensionModifier(id) {
  const defs = DIMENSION_MODIFIERS[id];
  if (!defs) return;
  for (const def of defs) registerModifier({ ...def, group: id });
}

export function deactivateDimensionModifier(id) {
  unregisterModifiers((m) => m.group === id);
}
