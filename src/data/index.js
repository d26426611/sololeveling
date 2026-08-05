import { races } from "./races.js";
import { classes } from "./classes.js";
import { biomes } from "./biomes.js";
import { monsters } from "./monsters.js";
import { itemPool } from "./items.js";
import { setBonuses } from "./sets.js";
import { recipes } from "./recipes.js";
import { materials } from "./materials.js";
import { events } from "./events.js";
import { rarity } from "./rarity.js";
import { affixes } from "./affixes.js";
import { achievements } from "./achievements.js";

// 保留舊版扁平 CONFIG 形狀，讓其它系統可以直接用 CONFIG.races / CONFIG.sets 等既有寫法存取。
export const CONFIG = {
  races,
  classes,
  biomes,
  monsters,
  itemPool,
  sets: setBonuses,
  recipes,
  materials,
  events,
  rarity,
  affixes,
  achievements,
};

export { rollRarity, depthPowerScale } from "./rarity.js";
