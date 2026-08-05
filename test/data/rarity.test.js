import { test } from "node:test";
import assert from "node:assert/strict";
import { depthPowerScale } from "../../src/data/rarity.js";

test("depthPowerScale is 1.0 (no-op) at or below depth 120", () => {
  assert.equal(depthPowerScale(0), 1.0);
  assert.equal(depthPowerScale(70), 1.0);
  assert.equal(depthPowerScale(120), 1.0);
});

test("depthPowerScale grows past depth 120", () => {
  const at120 = depthPowerScale(120);
  const at170 = depthPowerScale(170);
  const at320 = depthPowerScale(320);
  assert.ok(at170 > at120);
  assert.ok(at320 > at170);
});

test("depthPowerScale grows roughly 2.5x per 50-depth region past 120", () => {
  const scale = depthPowerScale(170) / depthPowerScale(120);
  assert.ok(Math.abs(scale - 2.5) < 0.01);
});
