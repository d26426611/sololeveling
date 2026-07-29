// 套裝加成的 Combat Modifier 註冊。跟 classStyleModifiers.js/raceTraitModifiers.js 同一模式：
// 不 import CONFIG，呼叫端把當下已啟用的套裝件數(activeSets)與套裝資料表(setConfig)組成
// context 傳進來 —— 套裝加成本身是資料驅動的一張大表，硬把每個套裝寫成獨立 modifier
// 只會在兩個地方各存一份同樣的資料，這裡改成單一 modifier 讀 context 裡的資料表本身。
// 見 docs/adr/0003-unified-combat-modifier-pipeline.md。
import { registerModifier } from "../systems/combatModifierPipeline.js";

export function registerSetBonusModifiers() {
  registerModifier({
    id: "set-bonus-tiers",
    source: "set",
    hook: "statCalculation",
    apply: (ctx) => {
      for (const setId in ctx.activeSets) {
        const cnt = ctx.activeSets[setId];
        const set = ctx.setConfig[setId];
        if (!set) continue;
        const applyBonus = (bonus) => {
          for (const k in bonus) {
            if (k === "all_pct") {
              ctx.stats.atk = Math.floor(ctx.stats.atk * (1 + bonus[k]));
              ctx.stats.maxHp = Math.floor(ctx.stats.maxHp * (1 + bonus[k]));
            } else {
              ctx.stats[k] = (ctx.stats[k] || 0) + bonus[k];
            }
          }
        };
        if (cnt >= 2 && set.bonus2) applyBonus(set.bonus2);
        if (cnt >= 4 && set.bonus4) applyBonus(set.bonus4);
        if (cnt >= 6 && set.bonus6) applyBonus(set.bonus6);
      }
    },
  });
}
