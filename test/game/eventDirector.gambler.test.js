import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";

const elements = {};
function makeEl(id) {
  const el = {
    id, innerHTML: "", innerText: "", style: {}, dataset: {},
    classList: { add() {}, remove() {}, toggle() {} },
    appendChild() {}, remove() {}, addEventListener() {},
    querySelector() { return makeEl("_anon"); },
  };
  elements[id] = el;
  return el;
}
globalThis.document = {
  getElementById(id) { return elements[id] || makeEl(id); },
  querySelector() { return makeEl("_anon"); },
  querySelectorAll() { return []; },
  createElement() { return makeEl("_anon"); },
  addEventListener() {},
};
globalThis.window = globalThis;
globalThis.localStorage = {
  _d: {},
  getItem(k) { return this._d[k] ?? null; },
  setItem(k, v) { this._d[k] = String(v); },
  removeItem(k) { delete this._d[k]; },
};

const { CONFIG } = await import("../../src/data/index.js");
const { Player, resetPlayer } = await import("../../src/state/player.js");
const { GlobalSystem } = await import("../../src/state/globalSystem.js");
const { recalcPlayerStats } = await import("../../src/state/playerStats.js");
const { EventDirector, configureEventDirector } = await import("../../src/game/eventDirector.js");
const { initEventControls } = await import("../../src/ui/eventScreen.js");

let lastClickHandler = null;
const controlsEl = makeEl("event-controls");
controlsEl.addEventListener = (type, fn) => { lastClickHandler = fn; };
elements["event-controls"] = controlsEl;
initEventControls();
function fireAction(action) {
  lastClickHandler({ target: { closest: () => ({ dataset: { action } }) } });
}

let offeredAwakeningFor = null;
beforeEach(() => {
  GlobalSystem.init();
  resetPlayer();
  Player.race = "human";
  Player.class = "warrior";
  Player.gold = 1000;
  recalcPlayerStats();
  offeredAwakeningFor = null;
  configureEventDirector({
    nextDepth() {},
    enterWorld() {},
    gameOver() {},
    offerAwakening(classId) { offeredAwakeningFor = classId; },
  });
});

test("gambler's unlockCheck is permanently false — the ambient checkAwakening() path never unlocks it", () => {
  assert.equal(CONFIG.classes.gambler.unlockCheck(Player), false);
});

test("winning a bet has a chance to offer the gambler awakening when both rolls succeed", () => {
  const originalRandom = Math.random;
  Math.random = () => 0; // wins the bet (< 0.5) and wins the awakening roll (< 0.25)
  try {
    EventDirector.gambler();
    fireAction("bet");
  } finally {
    Math.random = originalRandom;
  }
  assert.equal(offeredAwakeningFor, "gambler");
});

test("losing a bet never offers the awakening, even with a guaranteed-favorable awakening roll", () => {
  const originalRandom = Math.random;
  let call = 0;
  Math.random = () => { call++; return call === 1 ? 0.9 : 0; }; // loses the bet (>= 0.5)
  try {
    EventDirector.gambler();
    fireAction("bet");
  } finally {
    Math.random = originalRandom;
  }
  assert.equal(offeredAwakeningFor, null);
});

test("does not re-offer once gambler is already unlocked in GlobalSystem", () => {
  GlobalSystem.data.unlockedClasses.push("gambler");
  const originalRandom = Math.random;
  Math.random = () => 0;
  try {
    EventDirector.gambler();
    fireAction("bet");
  } finally {
    Math.random = originalRandom;
  }
  assert.equal(offeredAwakeningFor, null);
});

test("does not re-offer after the player rejected it earlier this run", () => {
  Player.flags.rej_gambler = true;
  const originalRandom = Math.random;
  Math.random = () => 0;
  try {
    EventDirector.gambler();
    fireAction("bet");
  } finally {
    Math.random = originalRandom;
  }
  assert.equal(offeredAwakeningFor, null);
});
