import { test } from "node:test";
import assert from "node:assert/strict";
import { armorSubtypes, inferArmorSubtype } from "../../src/data/armorSubtypes.js";
import { accessorySubtypes, inferAccessorySubtype } from "../../src/data/accessorySubtypes.js";

test("armor with baseDef is classified as guardian regardless of hp/speed", () => {
  assert.equal(inferArmorSubtype({ baseHp: 250, baseDef: 0.05 }), "guardian");
});

test("armor with positive speed and modest hp is classified as light", () => {
  assert.equal(inferArmorSubtype({ baseHp: 20, baseSpd: 10 }), "light");
  assert.equal(inferArmorSubtype({ baseSpd: 5 }), "light");
});

test("armor with high hp (even alongside some speed) is classified as heavy", () => {
  assert.equal(inferArmorSubtype({ baseHp: 200 }), "heavy");
  assert.equal(inferArmorSubtype({ baseHp: 150, baseSpd: 20 }), "heavy");
});

test("armorSubtypes profiles have the expected tradeoff shape", () => {
  assert.ok(armorSubtypes.heavy.hpMult > 1 && armorSubtypes.heavy.speedFlat < 0);
  assert.ok(armorSubtypes.light.hpMult < 1 && armorSubtypes.light.speedFlat > 0);
  assert.ok(armorSubtypes.guardian.hpMult < 1 && armorSubtypes.guardian.defFlat > 0);
});

test("accessory with baseAtk is classified as aggressive", () => {
  assert.equal(inferAccessorySubtype({ baseAtk: 20 }), "aggressive");
});

test("accessory with baseHp (no baseAtk) is classified as guardian", () => {
  assert.equal(inferAccessorySubtype({ baseHp: 50 }), "guardian");
});

test("accessory with no dominant raw stat is classified as utility", () => {
  assert.equal(inferAccessorySubtype({ rarity: "abyssal", desc: "special effect only" }), "utility");
});

test("utility accessory profile favors mechanics (crit/gold_drop) over raw stat scaling", () => {
  assert.ok(accessorySubtypes.utility.critFlat > 0);
  assert.ok(accessorySubtypes.utility.goldDropFlat > 0);
  assert.equal(accessorySubtypes.utility.atkMult, undefined);
  assert.equal(accessorySubtypes.utility.hpMult, undefined);
});
