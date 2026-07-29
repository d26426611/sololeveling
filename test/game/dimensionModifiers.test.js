import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { emit, resetModifiers, registerModifier } from "../../src/systems/combatModifierPipeline.js";
import { activateDimensionModifier, deactivateDimensionModifier, listDimensionModifiers } from "../../src/game/dimensionModifiers.js";

beforeEach(() => resetModifiers());

test("lists at least 3 distinct dimension modifiers", () => {
  assert.ok(listDimensionModifiers().length >= 3);
});

test("war_zone: doubles the player's outgoing damage", () => {
  activateDimensionModifier("war_zone");
  const ctx = { style: null, dmg: 100 };
  emit("beforePlayerHit", ctx);
  assert.equal(ctx.dmg, 200);
});

test("war_zone: also doubles the enemy's incoming damage to the player", () => {
  activateDimensionModifier("war_zone");
  const ctx = { dmg: 50 };
  emit("beforeEnemyHit", ctx);
  assert.equal(ctx.dmg, 100);
});

test("shattered_defense: triples gold_drop and zeroes out def", () => {
  activateDimensionModifier("shattered_defense");
  const ctx = { stats: { gold_drop: 1.0, def: 0.4 } };
  emit("statCalculation", ctx);
  assert.equal(ctx.stats.gold_drop, 3.0);
  assert.equal(ctx.stats.def, 0);
});

test("chaos_roll: widens the damage roll variance far beyond the normal range", () => {
  activateDimensionModifier("chaos_roll");
  for (let i = 0; i < 200; i++) {
    const ctx = { style: null, rand: null };
    emit("rollDamage", ctx);
    assert.ok(ctx.rand >= 0.1 && ctx.rand < 2.9, `rand ${ctx.rand} out of expected chaos range`);
  }
});

test("deactivateDimensionModifier() removes only that dimension's modifiers", () => {
  activateDimensionModifier("war_zone");
  activateDimensionModifier("chaos_roll");

  deactivateDimensionModifier("war_zone");

  const dmgCtx = { style: null, dmg: 100 };
  emit("beforePlayerHit", dmgCtx);
  assert.equal(dmgCtx.dmg, 100, "war_zone should no longer double damage");

  const rollCtx = { style: null, rand: null };
  emit("rollDamage", rollCtx);
  assert.ok(rollCtx.rand !== null, "chaos_roll should still be active");
});

test("an inactive dimension modifier has no effect", () => {
  const ctx = { style: null, dmg: 100 };
  emit("beforePlayerHit", ctx);
  assert.equal(ctx.dmg, 100);
});

test("existing crit/def/dodge/block caps are still enforced when a dimension stat modifier is active", () => {
  registerModifier({ id: "fake-class-crit", source: "class", hook: "statCalculation", apply: (ctx) => { ctx.stats.crit += 0.9; } });
  registerModifier({ id: "fake-set-crit", source: "set", hook: "statCalculation", apply: (ctx) => { ctx.stats.crit += 0.9; } });
  activateDimensionModifier("shattered_defense");

  const ctx = { stats: { crit: 0.05, gold_drop: 1.0, def: 0.4 } };
  emit("statCalculation", ctx);

  assert.equal(ctx.stats.crit, 1.0, "crit should still be capped at 1.0 despite the extra dimension modifier stacking in");
  assert.equal(ctx.stats.gold_drop, 3.0);
  assert.equal(ctx.stats.def, 0);
});

test("a dimension modifier stacks correctly alongside class/race/set modifiers on the same hook", () => {
  // Simulate an already-registered class modifier that adds a flat +20 before the dimension doubles it.
  registerModifier({ id: "fake-class-flat-bonus", source: "class", hook: "beforePlayerHit", apply: (ctx) => { ctx.dmg += 20; } });

  activateDimensionModifier("war_zone");

  const ctx = { style: null, dmg: 100 };
  emit("beforePlayerHit", ctx);
  // class modifier runs first (registered first) -> 120, then war_zone doubles -> 240
  assert.equal(ctx.dmg, 240);
});
