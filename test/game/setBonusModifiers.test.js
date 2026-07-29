import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { emit, resetModifiers } from "../../src/systems/combatModifierPipeline.js";
import { registerSetBonusModifiers } from "../../src/game/setBonusModifiers.js";

beforeEach(() => {
  resetModifiers();
  registerSetBonusModifiers();
});

test("applies bonus2 when 2 pieces of a set are equipped", () => {
  const ctx = {
    stats: { atk: 100 },
    activeSets: { testset: 2 },
    setConfig: { testset: { bonus2: { atk: 10 } } },
  };
  emit("statCalculation", ctx);
  assert.equal(ctx.stats.atk, 110);
});

test("does not apply bonus4/bonus6 when only 2 pieces are equipped", () => {
  const ctx = {
    stats: { atk: 100 },
    activeSets: { testset: 2 },
    setConfig: { testset: { bonus2: { atk: 10 }, bonus4: { atk: 1000 }, bonus6: { atk: 1000 } } },
  };
  emit("statCalculation", ctx);
  assert.equal(ctx.stats.atk, 110);
});

test("bonus2 and bonus4 both apply cumulatively at 4 pieces equipped", () => {
  const ctx = {
    stats: { atk: 100 },
    activeSets: { testset: 4 },
    setConfig: { testset: { bonus2: { atk: 10 }, bonus4: { atk: 20 }, bonus6: { atk: 1000 } } },
  };
  emit("statCalculation", ctx);
  assert.equal(ctx.stats.atk, 130);
});

test("bonus2, bonus4, and bonus6 all apply cumulatively at 6 pieces equipped", () => {
  const ctx = {
    stats: { atk: 100 },
    activeSets: { testset: 6 },
    setConfig: { testset: { bonus2: { atk: 10 }, bonus4: { atk: 20 }, bonus6: { atk: 30 } } },
  };
  emit("statCalculation", ctx);
  assert.equal(ctx.stats.atk, 160);
});

test("all_pct multiplies atk and maxHp instead of adding, floored", () => {
  const ctx = {
    stats: { atk: 101, maxHp: 201 },
    activeSets: { testset: 2 },
    setConfig: { testset: { bonus2: { all_pct: 0.5 } } },
  };
  emit("statCalculation", ctx);
  assert.equal(ctx.stats.atk, Math.floor(101 * 1.5));
  assert.equal(ctx.stats.maxHp, Math.floor(201 * 1.5));
});

test("multiple simultaneously active sets both contribute", () => {
  const ctx = {
    stats: { atk: 100, maxHp: 500 },
    activeSets: { setA: 2, setB: 4 },
    setConfig: {
      setA: { bonus2: { atk: 5 } },
      setB: { bonus2: { maxHp: 50 }, bonus4: { maxHp: 100 } },
    },
  };
  emit("statCalculation", ctx);
  assert.equal(ctx.stats.atk, 105);
  assert.equal(ctx.stats.maxHp, 650);
});

test("an activeSets entry with no matching setConfig is skipped safely", () => {
  const ctx = {
    stats: { atk: 100 },
    activeSets: { ghost: 6 },
    setConfig: {},
  };
  emit("statCalculation", ctx);
  assert.equal(ctx.stats.atk, 100);
});

test("no active sets leaves stats untouched", () => {
  const ctx = {
    stats: { atk: 100, def: 0.15 },
    activeSets: {},
    setConfig: { testset: { bonus2: { atk: 999 } } },
  };
  emit("statCalculation", ctx);
  assert.equal(ctx.stats.atk, 100);
  assert.equal(ctx.stats.def, 0.15);
});
