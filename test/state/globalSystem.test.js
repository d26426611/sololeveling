import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";

globalThis.localStorage = {
  _d: {},
  getItem(k) { return this._d[k] ?? null; },
  setItem(k, v) { this._d[k] = String(v); },
  removeItem(k) { delete this._d[k]; },
};

const { GlobalSystem } = await import("../../src/state/globalSystem.js");

beforeEach(() => {
  globalThis.localStorage._d = {};
  GlobalSystem.init();
});

test("unlockAchievement() unlocks an achievement once and fires a toast", () => {
  let toastMsg = null;
  GlobalSystem.unlockAchievement("first_kill", (msg) => { toastMsg = msg; });
  assert.ok(GlobalSystem.data.unlockedAchievements.includes("first_kill"));
  assert.ok(toastMsg.includes("初戰告捷"));
});

test("unlockAchievement() is idempotent: unlocking twice only fires the toast once", () => {
  let toastCount = 0;
  GlobalSystem.unlockAchievement("first_kill", () => toastCount++);
  GlobalSystem.unlockAchievement("first_kill", () => toastCount++);
  assert.equal(toastCount, 1);
  assert.equal(GlobalSystem.data.unlockedAchievements.filter((id) => id === "first_kill").length, 1);
});

test("unlockAchievement() ignores an unknown id", () => {
  GlobalSystem.unlockAchievement("not_a_real_achievement", () => {});
  assert.equal(GlobalSystem.data.unlockedAchievements.includes("not_a_real_achievement"), false);
});

test("checkDepthMilestones() unlocks only the thresholds reached", () => {
  GlobalSystem.checkDepthMilestones(60, () => {});
  assert.ok(GlobalSystem.data.unlockedAchievements.includes("depth_50"));
  assert.equal(GlobalSystem.data.unlockedAchievements.includes("depth_100"), false);
  assert.equal(GlobalSystem.data.unlockedAchievements.includes("depth_500"), false);
});

test("checkDepthMilestones() unlocks all thresholds at once when depth is high enough", () => {
  GlobalSystem.checkDepthMilestones(500, () => {});
  assert.ok(GlobalSystem.data.unlockedAchievements.includes("depth_50"));
  assert.ok(GlobalSystem.data.unlockedAchievements.includes("depth_100"));
  assert.ok(GlobalSystem.data.unlockedAchievements.includes("depth_500"));
});

test("checkFullSet() unlocks full_set when any set reaches 6 pieces", () => {
  GlobalSystem.checkFullSet({ adventurer: 6 }, () => {});
  assert.ok(GlobalSystem.data.unlockedAchievements.includes("full_set"));
});

test("checkFullSet() does not unlock full_set below 6 pieces", () => {
  GlobalSystem.checkFullSet({ adventurer: 4 }, () => {});
  assert.equal(GlobalSystem.data.unlockedAchievements.includes("full_set"), false);
});

test("checkCollectionMilestones() unlocks all_races/all_classes only once every base entry is unlocked", async () => {
  GlobalSystem.checkCollectionMilestones(() => {});
  assert.equal(GlobalSystem.data.unlockedAchievements.includes("all_races"), false);
  assert.equal(GlobalSystem.data.unlockedAchievements.includes("all_classes"), false);

  const { CONFIG } = await import("../../src/data/index.js");
  GlobalSystem.data.unlockedRaces = Object.keys(CONFIG.races);
  GlobalSystem.data.unlockedClasses = Object.keys(CONFIG.classes);
  GlobalSystem.checkCollectionMilestones(() => {});
  assert.ok(GlobalSystem.data.unlockedAchievements.includes("all_races"));
  assert.ok(GlobalSystem.data.unlockedAchievements.includes("all_classes"));
});

test("unlockEvent() records an event id once", () => {
  GlobalSystem.unlockEvent("spring");
  assert.ok(GlobalSystem.data.discoveredEvents.includes("spring"));
  GlobalSystem.unlockEvent("spring");
  assert.equal(GlobalSystem.data.discoveredEvents.filter((id) => id === "spring").length, 1);
});

test("unlockEvent() ignores a falsy id", () => {
  GlobalSystem.unlockEvent(undefined);
  assert.equal(GlobalSystem.data.discoveredEvents.length, 0);
});

test("achievements persist across a reload (save/load round trip)", () => {
  GlobalSystem.unlockAchievement("first_kill", () => {});
  GlobalSystem.init();
  assert.ok(GlobalSystem.data.unlockedAchievements.includes("first_kill"));
});
