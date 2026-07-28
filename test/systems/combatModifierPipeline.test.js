import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { registerModifier, emit, resetModifiers } from "../../src/systems/combatModifierPipeline.js";

beforeEach(() => resetModifiers());

test("resetModifiers() clears everything previously registered", () => {
  let called = false;
  registerModifier({ id: "test-should-not-survive-reset", source: "class", hook: "onTurnStart", apply: () => { called = true; } });

  resetModifiers();
  emit("onTurnStart", {});

  assert.equal(called, false);
});

test("emit() calls a registered modifier's apply() when the hook matches", () => {
  let called = false;
  registerModifier({ id: "test-dispatch", source: "class", hook: "onTurnStart", apply: () => { called = true; } });

  emit("onTurnStart", {});

  assert.equal(called, true);
});

test("two modifiers on the same hook targeting the same stat combine additively", () => {
  registerModifier({ id: "test-crit-a", source: "class", hook: "statCalculation", apply: (ctx) => { ctx.stats.crit += 0.1; } });
  registerModifier({ id: "test-crit-b", source: "set", hook: "statCalculation", apply: (ctx) => { ctx.stats.crit += 0.2; } });

  const ctx = { stats: { crit: 0.05 } };
  emit("statCalculation", ctx);

  assert.equal(ctx.stats.crit, 0.05 + 0.1 + 0.2);
});

test("a modifier whose condition returns false does not apply", () => {
  let called = false;
  registerModifier({
    id: "test-conditional",
    source: "class",
    hook: "onTurnStart",
    condition: (ctx) => ctx.player.hpPct < 0.5,
    apply: () => { called = true; },
  });

  emit("onTurnStart", { player: { hpPct: 0.9 } });

  assert.equal(called, false);
});

test("crit is capped at 1.0 no matter how many modifiers stack into it", () => {
  registerModifier({ id: "test-crit-1", source: "class", hook: "statCalculation", apply: (ctx) => { ctx.stats.crit += 0.5; } });
  registerModifier({ id: "test-crit-2", source: "set", hook: "statCalculation", apply: (ctx) => { ctx.stats.crit += 0.5; } });
  registerModifier({ id: "test-crit-3", source: "dimension", hook: "statCalculation", apply: (ctx) => { ctx.stats.crit += 0.5; } });

  const ctx = { stats: { crit: 0.05 } };
  emit("statCalculation", ctx);

  assert.equal(ctx.stats.crit, 1.0);
});

test("def (damage reduction) is capped at 0.9 no matter how many modifiers stack into it", () => {
  registerModifier({ id: "test-def-1", source: "set", hook: "statCalculation", apply: (ctx) => { ctx.stats.def += 0.5; } });
  registerModifier({ id: "test-def-2", source: "set", hook: "statCalculation", apply: (ctx) => { ctx.stats.def += 0.5; } });

  const ctx = { stats: { def: 0.1 } };
  emit("statCalculation", ctx);

  assert.equal(ctx.stats.def, 0.9);
});

test("dodge and block are also capped at 0.9, same as def", () => {
  registerModifier({ id: "test-dodge", source: "class", hook: "statCalculation", apply: (ctx) => { ctx.stats.dodge += 0.8; } });
  registerModifier({ id: "test-block", source: "class", hook: "statCalculation", apply: (ctx) => { ctx.stats.block += 0.8; } });

  const ctx = { stats: { dodge: 0.2, block: 0.2 } };
  emit("statCalculation", ctx);

  assert.equal(ctx.stats.dodge, 0.9);
  assert.equal(ctx.stats.block, 0.9);
});
