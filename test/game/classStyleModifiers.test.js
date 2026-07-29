import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { registerModifier, emit, resetModifiers } from "../../src/systems/combatModifierPipeline.js";
import { registerClassStyleModifiers } from "../../src/game/classStyleModifiers.js";

beforeEach(() => {
  resetModifiers();
  registerClassStyleModifiers();
});

test("archer's preemptive: grants an extra turn when entering combat normally", () => {
  const ctx = { style: "preemptive", mode: "normal", grantExtraTurn: false };
  emit("onCombatStart", ctx);
  assert.equal(ctx.grantExtraTurn, true);
});

test("archer's preemptive: does not grant an extra turn on a sneak/ambush start", () => {
  const ctx = { style: "preemptive", mode: "sneak", grantExtraTurn: false };
  emit("onCombatStart", ctx);
  assert.equal(ctx.grantExtraTurn, false);
});

test("a non-preemptive style does not grant an extra turn", () => {
  const ctx = { style: "blood_rage", mode: "normal", grantExtraTurn: false };
  emit("onCombatStart", ctx);
  assert.equal(ctx.grantExtraTurn, false);
});

test("cleric's regen: heals 6% of maxHp at the start of their own turn", () => {
  const ctx = { style: "regen", maxHp: 500, healAmount: 0 };
  emit("onTurnStart", ctx);
  assert.equal(ctx.healAmount, Math.ceil(500 * 0.06));
});

test("a non-cleric style does not grant the regen heal", () => {
  const ctx = { style: "blood_rage", maxHp: 500, healAmount: 0 };
  emit("onTurnStart", ctx);
  assert.equal(ctx.healAmount, 0);
});

test("thief's multi_hit: attacks twice per turn at 0.65x damage each", () => {
  const ctx = { style: "multi_hit", maxHp: 500, healAmount: 0, hits: 1, hitScale: 1 };
  emit("onTurnStart", ctx);
  assert.equal(ctx.hits, 2);
  assert.equal(ctx.hitScale, 0.65);
});

test("archmage's double_cast: attacks twice per turn at 0.7x damage each", () => {
  const ctx = { style: "double_cast", maxHp: 500, healAmount: 0, hits: 1, hitScale: 1 };
  emit("onTurnStart", ctx);
  assert.equal(ctx.hits, 2);
  assert.equal(ctx.hitScale, 0.7);
});

test("a single-hit style leaves hits/hitScale untouched", () => {
  const ctx = { style: "blood_rage", maxHp: 500, healAmount: 0, hits: 1, hitScale: 1 };
  emit("onTurnStart", ctx);
  assert.equal(ctx.hits, 1);
  assert.equal(ctx.hitScale, 1);
});

test("mage's true_strike: damage roll is always in the near-guaranteed-high 1.0-1.1 range", () => {
  for (let i = 0; i < 200; i++) {
    const ctx = { style: "true_strike", rand: null };
    emit("rollDamage", ctx);
    assert.ok(ctx.rand >= 1.0 && ctx.rand < 1.1, `rand ${ctx.rand} out of range`);
  }
});

test("gambler's roulette: damage roll swings wildly across the 0.3-2.0 range", () => {
  for (let i = 0; i < 200; i++) {
    const ctx = { style: "roulette", rand: null };
    emit("rollDamage", ctx);
    assert.ok(ctx.rand >= 0.3 && ctx.rand < 2.0, `rand ${ctx.rand} out of range`);
  }
});

test("a style without a roll override leaves rand untouched (caller applies its own default)", () => {
  const ctx = { style: "blood_rage", rand: null };
  emit("rollDamage", ctx);
  assert.equal(ctx.rand, null);
});

test("berserker's blood_rage: below 50% hp, damage scales up as hp drops", () => {
  const ctx = { style: "blood_rage", dmg: 100, hpPct: 0.3 };
  emit("beforePlayerHit", ctx);
  assert.equal(ctx.dmg, Math.floor(100 * (1 + (0.5 - 0.3))));
});

test("berserker's blood_rage: at or above 50% hp, damage is unchanged", () => {
  const ctx = { style: "blood_rage", dmg: 100, hpPct: 0.8 };
  emit("beforePlayerHit", ctx);
  assert.equal(ctx.dmg, 100);
});

test("paladin's scaling_atk: damage grows with turn count", () => {
  const ctx = { style: "scaling_atk", dmg: 100, turnCount: 5 };
  emit("beforePlayerHit", ctx);
  assert.equal(ctx.dmg, Math.floor(100 * (1 + Math.min(0.3, 5 * 0.02))));
});

test("paladin's scaling_atk: caps at +30% no matter how many turns", () => {
  const ctx = { style: "scaling_atk", dmg: 100, turnCount: 100 };
  emit("beforePlayerHit", ctx);
  assert.equal(ctx.dmg, Math.floor(100 * 1.3));
});

test("dreamweaver's sanity_control: boosts damage as sanity drops, only in phantasm", () => {
  const ctx = { style: "sanity_control", dmg: 100, world: "phantasm", sanity: 40 };
  emit("beforePlayerHit", ctx);
  assert.equal(ctx.dmg, Math.floor(100 * (1 + (1 - 40 / 100) * 0.5)));
});

test("dreamweaver's sanity_control: does nothing outside phantasm", () => {
  const ctx = { style: "sanity_control", dmg: 100, world: "normal", sanity: 40 };
  emit("beforePlayerHit", ctx);
  assert.equal(ctx.dmg, 100);
});

test("hell knight's karma_strike: adds flat true damage from accumulated karma", () => {
  const ctx = { style: "karma_strike", dmg: 100, karma: 250 };
  emit("beforePlayerHit", ctx);
  assert.equal(ctx.dmg, 100 + Math.floor(250 * 0.1));
});

test("a style without a beforePlayerHit modifier leaves dmg untouched", () => {
  const ctx = { style: "execute", dmg: 100, hpPct: 0.9, turnCount: 1, world: "normal", sanity: 100, karma: 0 };
  emit("beforePlayerHit", ctx);
  assert.equal(ctx.dmg, 100);
});

test("shadow assassin's execute: adds bonus true damage when the enemy drops below 20% hp", () => {
  const ctx = { style: "execute", enemyHp: 150, enemyMaxHp: 1000, executeDmg: 0 };
  emit("afterPlayerHit", ctx);
  assert.equal(ctx.executeDmg, Math.floor(1000 * 0.15));
});

test("execute: does nothing while the enemy is still above 20% hp", () => {
  const ctx = { style: "execute", enemyHp: 500, enemyMaxHp: 1000, executeDmg: 0 };
  emit("afterPlayerHit", ctx);
  assert.equal(ctx.executeDmg, 0);
});

test("execute: does nothing once the enemy is already dead", () => {
  const ctx = { style: "execute", enemyHp: 0, enemyMaxHp: 1000, executeDmg: 0 };
  emit("afterPlayerHit", ctx);
  assert.equal(ctx.executeDmg, 0);
});

test("jungle ranger's stun_shot: stuns the enemy when the roll lands under the 25% threshold", () => {
  const ctx = { style: "stun_shot", enemyHp: 500, roll: 0.1, stunned: false };
  emit("afterPlayerHit", ctx);
  assert.equal(ctx.stunned, true);
});

test("stun_shot: does not stun when the roll is at or above the threshold", () => {
  const ctx = { style: "stun_shot", enemyHp: 500, roll: 0.4, stunned: false };
  emit("afterPlayerHit", ctx);
  assert.equal(ctx.stunned, false);
});

test("stun_shot: does not stun an already-dead enemy even on a lucky roll", () => {
  const ctx = { style: "stun_shot", enemyHp: 0, roll: 0.1, stunned: false };
  emit("afterPlayerHit", ctx);
  assert.equal(ctx.stunned, false);
});

test("a style without an afterPlayerHit modifier leaves executeDmg/stunned untouched", () => {
  const ctx = { style: "blood_rage", enemyHp: 150, enemyMaxHp: 1000, executeDmg: 0, roll: 0.1, stunned: false };
  emit("afterPlayerHit", ctx);
  assert.equal(ctx.executeDmg, 0);
  assert.equal(ctx.stunned, false);
});

test("royal knight's counter_attack: counters when the player survives and the roll lands under 30%", () => {
  const ctx = { style: "counter_attack", playerHp: 100, roll: 0.1, atk: 200, counterDmg: 0 };
  emit("afterEnemyHit", ctx);
  assert.equal(ctx.counterDmg, Math.floor(200 * 0.5));
});

test("counter_attack: does not counter when the roll is at or above the threshold", () => {
  const ctx = { style: "counter_attack", playerHp: 100, roll: 0.5, atk: 200, counterDmg: 0 };
  emit("afterEnemyHit", ctx);
  assert.equal(ctx.counterDmg, 0);
});

test("counter_attack: does not counter if the player died from the hit", () => {
  const ctx = { style: "counter_attack", playerHp: 0, roll: 0.1, atk: 200, counterDmg: 0 };
  emit("afterEnemyHit", ctx);
  assert.equal(ctx.counterDmg, 0);
});

test("a style without an afterEnemyHit modifier leaves counterDmg untouched", () => {
  const ctx = { style: "blood_rage", playerHp: 100, roll: 0.1, atk: 200, counterDmg: 0 };
  emit("afterEnemyHit", ctx);
  assert.equal(ctx.counterDmg, 0);
});
