import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { Player, resetPlayer } from "../../src/state/player.js";
import { resetModifiers, emit } from "../../src/systems/combatModifierPipeline.js";
import {
  RIFT_TRIGGER_CHANCE,
  RIFT_DURATION_FLOORS,
  canTriggerRift,
  isRiftActive,
  triggerRift,
  tickRift,
  rollForRift,
  rehydrateRift,
} from "../../src/game/riftSystem.js";

beforeEach(() => {
  resetModifiers();
  resetPlayer();
});

function setEndlessLoopState() {
  Player.currentWorld = "normal";
  Player.currentBiomeId = "desert";
  Player.biomeDepth = 7;
  Player.biomeIndex = 6;
  Player.endlessLoopActive = true;
}

test("canTriggerRift() is false during the initial climb (endlessLoopActive false)", () => {
  Player.currentWorld = "normal";
  Player.endlessLoopActive = false;
  assert.equal(canTriggerRift(), false);
});

test("canTriggerRift() is false while already in a dimension (currentWorld !== normal)", () => {
  Player.currentWorld = "purgatory";
  Player.endlessLoopActive = true;
  assert.equal(canTriggerRift(), false);
});

test("canTriggerRift() is false while a rift is already active", () => {
  setEndlessLoopState();
  triggerRift("purgatory", "war_zone");
  assert.equal(canTriggerRift(), false);
});

test("canTriggerRift() is true once the endless loop has begun, in a normal biome, with no active rift", () => {
  setEndlessLoopState();
  assert.equal(canTriggerRift(), true);
});

test("triggerRift() snapshots pre-rift state, switches into the dimension, and activates its modifier", () => {
  setEndlessLoopState();
  triggerRift("purgatory", "war_zone");

  assert.equal(Player.currentWorld, "purgatory");
  assert.equal(Player.currentBiomeId, "purgatory");
  assert.equal(Player.biomeDepth, 0);
  assert.equal(isRiftActive(), true);

  const ctx = { style: null, dmg: 100 };
  emit("beforePlayerHit", ctx);
  assert.equal(ctx.dmg, 200, "war_zone's modifier should be active during the rift");
});

test("tickRift() counts down and expires after RIFT_DURATION_FLOORS ticks, restoring state exactly", () => {
  setEndlessLoopState();
  const preRiftSnapshot = {
    currentWorld: Player.currentWorld,
    currentBiomeId: Player.currentBiomeId,
    biomeDepth: Player.biomeDepth,
    biomeIndex: Player.biomeIndex,
  };

  triggerRift("purgatory", "war_zone");

  for (let i = 0; i < RIFT_DURATION_FLOORS - 1; i++) {
    tickRift();
    assert.equal(isRiftActive(), true, `should still be active after tick ${i + 1}`);
  }
  tickRift(); // final tick: expires

  assert.equal(isRiftActive(), false);
  assert.deepEqual(
    {
      currentWorld: Player.currentWorld,
      currentBiomeId: Player.currentBiomeId,
      biomeDepth: Player.biomeDepth,
      biomeIndex: Player.biomeIndex,
    },
    preRiftSnapshot
  );

  const ctx = { style: null, dmg: 100 };
  emit("beforePlayerHit", ctx);
  assert.equal(ctx.dmg, 100, "war_zone's modifier should be deactivated after the rift expires");
});

test("tickRift() is a no-op when no rift is active", () => {
  setEndlessLoopState();
  assert.doesNotThrow(() => tickRift());
  assert.equal(isRiftActive(), false);
});

test("RIFT_TRIGGER_CHANCE approximates 1-in-40", () => {
  assert.ok(RIFT_TRIGGER_CHANCE > 0 && RIFT_TRIGGER_CHANCE <= 1 / 20);
  assert.ok(Math.abs(RIFT_TRIGGER_CHANCE - 1 / 40) < 1 / 40);
});

test("rollForRift() triggers when the roll lands under the chance threshold and conditions are met", () => {
  setEndlessLoopState();
  const originalRandom = Math.random;
  Math.random = () => 0; // definitely under any positive threshold
  try {
    const triggered = rollForRift("purgatory", "war_zone");
    assert.equal(triggered, true);
    assert.equal(isRiftActive(), true);
  } finally {
    Math.random = originalRandom;
  }
});

test("rollForRift() does not trigger when the roll lands at/above the chance threshold", () => {
  setEndlessLoopState();
  const originalRandom = Math.random;
  Math.random = () => 0.999; // definitely at/above a ~1/40 threshold
  try {
    const triggered = rollForRift("purgatory", "war_zone");
    assert.equal(triggered, false);
    assert.equal(isRiftActive(), false);
  } finally {
    Math.random = originalRandom;
  }
});

test("rollForRift() never triggers outside the endless loop, even with a guaranteed-favorable roll", () => {
  Player.currentWorld = "normal";
  Player.endlessLoopActive = false;
  const originalRandom = Math.random;
  Math.random = () => 0;
  try {
    const triggered = rollForRift("purgatory", "war_zone");
    assert.equal(triggered, false);
    assert.equal(isRiftActive(), false);
  } finally {
    Math.random = originalRandom;
  }
});

test("rehydrateRift() re-registers an in-progress rift's dimension modifier after a save/load cycle wiped the in-memory pipeline", () => {
  setEndlessLoopState();
  triggerRift("purgatory", "war_zone");

  // Simulate what a page reload does: Player.rift survives (it's plain serialized data),
  // but the pipeline's registered modifiers are gone since they only ever lived in memory.
  resetModifiers();
  const ctx = { style: null, dmg: 100 };
  emit("beforePlayerHit", ctx);
  assert.equal(ctx.dmg, 100, "sanity check: the modifier really is gone after resetModifiers()");

  rehydrateRift();

  const ctxAfter = { style: null, dmg: 100 };
  emit("beforePlayerHit", ctxAfter);
  assert.equal(ctxAfter.dmg, 200, "war_zone's modifier should be re-registered and active again");
});

test("rehydrateRift() is a no-op when no rift is active", () => {
  assert.doesNotThrow(() => rehydrateRift());
  const ctx = { style: null, dmg: 100 };
  emit("beforePlayerHit", ctx);
  assert.equal(ctx.dmg, 100);
});
