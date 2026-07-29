// 職業技能的 Combat Modifier 註冊。刻意不 import Player/CONFIG/combat.js 任何一個——
// 呼叫端（combat.js）負責把當下的 style 與所需資料組成 context 傳進來，這裡只做純粹的
// 「輸入 context、輸出 context」，讓每個技能都能不靠完整戰鬥流程單獨測試。
// 見 docs/adr/0003-unified-combat-modifier-pipeline.md。
import { registerModifier } from "../systems/combatModifierPipeline.js";

export function registerClassStyleModifiers() {
  // 弓手/遊俠「先制」：正面迎戰(非偷襲/伏擊)時，額外搶先攻擊一次。
  registerModifier({
    id: "class-preemptive",
    source: "class",
    hook: "onCombatStart",
    condition: (ctx) => ctx.style === "preemptive" && ctx.mode === "normal",
    apply: (ctx) => { ctx.grantExtraTurn = true; },
  });

  // 牧師「回復」：每個自己的回合開始，回復 6% 上限生命值。
  registerModifier({
    id: "class-regen",
    source: "class",
    hook: "onTurnStart",
    condition: (ctx) => ctx.style === "regen",
    apply: (ctx) => { ctx.healAmount = Math.ceil(ctx.maxHp * 0.06); },
  });

  // 盜賊「連擊」/大魔導士「雙重詠唱」：一回合內攻擊兩次，每次傷害打折以免總傷害直接翻倍。
  registerModifier({
    id: "class-multi-hit",
    source: "class",
    hook: "onTurnStart",
    condition: (ctx) => ctx.style === "multi_hit",
    apply: (ctx) => { ctx.hits = 2; ctx.hitScale = 0.65; },
  });
  registerModifier({
    id: "class-double-cast",
    source: "class",
    hook: "onTurnStart",
    condition: (ctx) => ctx.style === "double_cast",
    apply: (ctx) => { ctx.hits = 2; ctx.hitScale = 0.7; },
  });

  // 法師「必中」：捨棄較差的傷害浮動下限。賭徒「輪盤」：傷害浮動極端放大。
  registerModifier({
    id: "class-true-strike",
    source: "class",
    hook: "rollDamage",
    condition: (ctx) => ctx.style === "true_strike",
    apply: (ctx) => { ctx.rand = 1.0 + Math.random() * 0.1; },
  });
  registerModifier({
    id: "class-roulette",
    source: "class",
    hook: "rollDamage",
    condition: (ctx) => ctx.style === "roulette",
    apply: (ctx) => { ctx.rand = 0.3 + Math.random() * 1.7; },
  });

  // 狂戰士「血怒」：血量低於 50% 時，越低越傷害越高。
  registerModifier({
    id: "class-blood-rage",
    source: "class",
    hook: "beforePlayerHit",
    condition: (ctx) => ctx.style === "blood_rage" && ctx.hpPct < 0.5,
    apply: (ctx) => { ctx.dmg = Math.floor(ctx.dmg * (1 + (0.5 - ctx.hpPct))); },
  });

  // 聖騎士「愈戰愈強」：傷害隨戰鬥回合數累加，封頂 +30%。
  registerModifier({
    id: "class-scaling-atk",
    source: "class",
    hook: "beforePlayerHit",
    condition: (ctx) => ctx.style === "scaling_atk",
    apply: (ctx) => { ctx.dmg = Math.floor(ctx.dmg * (1 + Math.min(0.3, ctx.turnCount * 0.02))); },
  });

  // 織夢者「操縱理智」：理智越低（越瘋狂），攻擊越強，僅幻界內生效。
  registerModifier({
    id: "class-sanity-control",
    source: "class",
    hook: "beforePlayerHit",
    condition: (ctx) => ctx.style === "sanity_control" && ctx.world === "phantasm",
    apply: (ctx) => { ctx.dmg = Math.floor(ctx.dmg * (1 + (1 - ctx.sanity / 100) * 0.5)); },
  });

  // 地獄騎士「業火打擊」：把累積的業力轉化為額外真傷。
  registerModifier({
    id: "class-karma-strike",
    source: "class",
    hook: "beforePlayerHit",
    condition: (ctx) => ctx.style === "karma_strike",
    apply: (ctx) => { ctx.dmg += Math.floor((ctx.karma || 0) * 0.1); },
  });

  // 暗影刺客「處決」：敵人殘血(<20%)時額外造成一擊真傷。
  registerModifier({
    id: "class-execute",
    source: "class",
    hook: "afterPlayerHit",
    condition: (ctx) => ctx.style === "execute" && ctx.enemyHp > 0 && ctx.enemyHp / ctx.enemyMaxHp < 0.2,
    apply: (ctx) => { ctx.executeDmg = Math.floor(ctx.enemyMaxHp * 0.15); },
  });

  // 叢林遊俠「暈眩射擊」：命中後有機率讓敵人下回合無法行動。roll 由呼叫端擲出，
  // 讓這個 modifier 保持純函式、可決定性測試。
  registerModifier({
    id: "class-stun-shot",
    source: "class",
    hook: "afterPlayerHit",
    condition: (ctx) => ctx.style === "stun_shot" && ctx.enemyHp > 0 && ctx.roll < 0.25,
    apply: (ctx) => { ctx.stunned = true; },
  });

  // 皇家騎士「反擊」：受到攻擊後有機率立即回敬一擊。
  registerModifier({
    id: "class-counter-attack",
    source: "class",
    hook: "afterEnemyHit",
    condition: (ctx) => ctx.style === "counter_attack" && ctx.playerHp > 0 && ctx.roll < 0.3,
    apply: (ctx) => { ctx.counterDmg = Math.floor(ctx.atk * 0.5); },
  });
}
