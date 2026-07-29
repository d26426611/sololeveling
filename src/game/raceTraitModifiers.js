// 種族特性的 Combat Modifier 註冊。跟 classStyleModifiers.js 同一模式：不 import
// Player/CONFIG，呼叫端把當下的 race 與所需資料組成 context 傳進來。
// 見 docs/adr/0003-unified-combat-modifier-pipeline.md。
import { registerModifier } from "../systems/combatModifierPipeline.js";

export function registerRaceTraitModifiers() {
  // 亡靈種族特性：非生者無法使用藥水恢復生命。
  registerModifier({
    id: "race-undead-potion-block",
    source: "race",
    hook: "beforePotionUse",
    condition: (ctx) => ctx.race === "undead" && ctx.hasHpEffect,
    apply: (ctx) => { ctx.blocked = true; },
  });

  // 虛空行者種族特性：沒有實體，理智值消耗減半。
  registerModifier({
    id: "race-void-walker-sanity-halving",
    source: "race",
    hook: "sanityLoss",
    condition: (ctx) => ctx.race === "void_walker",
    apply: (ctx) => { ctx.cost = Math.ceil(ctx.amount / 2); },
  });
}
