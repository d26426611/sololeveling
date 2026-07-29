import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { emit, resetModifiers } from "../../src/systems/combatModifierPipeline.js";
import { registerRaceTraitModifiers } from "../../src/game/raceTraitModifiers.js";

beforeEach(() => {
  resetModifiers();
  registerRaceTraitModifiers();
});

test("undead's potion-block: blocks hp-restoring items", () => {
  const ctx = { race: "undead", hasHpEffect: true, blocked: false };
  emit("beforePotionUse", ctx);
  assert.equal(ctx.blocked, true);
});

test("undead can still use consumables that don't restore hp", () => {
  const ctx = { race: "undead", hasHpEffect: false, blocked: false };
  emit("beforePotionUse", ctx);
  assert.equal(ctx.blocked, false);
});

test("a non-undead race is never blocked from using hp potions", () => {
  const ctx = { race: "human", hasHpEffect: true, blocked: false };
  emit("beforePotionUse", ctx);
  assert.equal(ctx.blocked, false);
});

test("void walker's trait: halves the sanity cost, rounded up", () => {
  const ctx = { race: "void_walker", amount: 5, cost: 5 };
  emit("sanityLoss", ctx);
  assert.equal(ctx.cost, Math.ceil(5 / 2));
});

test("void walker's trait: rounds up on odd amounts too", () => {
  const ctx = { race: "void_walker", amount: 7, cost: 7 };
  emit("sanityLoss", ctx);
  assert.equal(ctx.cost, 4);
});

test("a non-void-walker race pays the full sanity cost", () => {
  const ctx = { race: "human", amount: 5, cost: 5 };
  emit("sanityLoss", ctx);
  assert.equal(ctx.cost, 5);
});
