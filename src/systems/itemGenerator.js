import { CONFIG, rollRarity, depthPowerScale } from "../data/index.js";
import { Player } from "../state/player.js";
import { weaponSubtypes } from "../data/weaponSubtypes.js";
import { armorSubtypes, inferArmorSubtype } from "../data/armorSubtypes.js";
import { accessorySubtypes, inferAccessorySubtype } from "../data/accessorySubtypes.js";

const ELITE_POOL_KEY = "wolf_pack";

function randOf(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

// 素材依稀有度分桶，讓「隨機掉一個素材」時能先擲出符合當前深度/世界的稀有度，
// 再從該稀有度桶內選材料 —— 修正舊版完全無視深度、平原也可能直接掉出幻界/煉獄專屬素材的問題。
let materialBuckets = null;
function getMaterialBuckets() {
  if (materialBuckets) return materialBuckets;
  materialBuckets = {};
  for (const key in CONFIG.materials) {
    const rarity = CONFIG.materials[key].rarity || "common";
    (materialBuckets[rarity] ??= []).push(key);
  }
  return materialBuckets;
}

const FALLBACK_RARITY_ORDER = ["common", "uncommon", "rare", "epic", "legendary", "phantasm", "abyssal"];

export const ItemSystem = {
  generate(forcedType = null, depthOverride = null, opts = {}) {
    const { elite = false } = opts;
    const types = ["weapon", "armor_upper", "armor_lower", "accessory", "material"];
    const type = forcedType || randOf(types);
    const depth = depthOverride ?? Player.depth;

    if (type === "material") {
      const buckets = getMaterialBuckets();
      const targetRarity = rollRarity(depth, Player.currentWorld);
      // 若該稀有度剛好沒有對應素材，就往下找最接近的可用稀有度，而不是整池隨機。
      let orderStart = FALLBACK_RARITY_ORDER.indexOf(targetRarity);
      if (orderStart === -1) orderStart = 0;
      let pool = null;
      for (let i = orderStart; i >= 0 && !pool; i--) {
        if (buckets[FALLBACK_RARITY_ORDER[i]]?.length) pool = buckets[FALLBACK_RARITY_ORDER[i]];
      }
      if (!pool) pool = buckets.common || Object.keys(CONFIG.materials);

      const k = randOf(pool);
      return {
        id: Date.now() + Math.random(),
        type: "material",
        baseName: CONFIG.materials[k].name,
        ...CONFIG.materials[k],
        rarity: CONFIG.materials[k].rarity || "common",
      };
    }

    const biome = CONFIG.biomes[Player.currentBiomeId] || CONFIG.biomes["plains"];
    // 菁英怪掉落固定用「狼群之心」專屬池，跟一般怪的區域套裝池區分開來。
    // 一般裝備一律優先用當前區域的套裝池（強度隨區域遞增），只有區域沒有專屬套裝池、
    // 或篩選 forcedType 後池子是空的，才逐層退回 —— 避免舊版 50% 機率退回 common、
    // 稀釋掉區域強度成長感的問題。
    let pool = [];
    if (elite && CONFIG.itemPool.sets[ELITE_POOL_KEY]) {
      pool = CONFIG.itemPool.sets[ELITE_POOL_KEY];
      if (forcedType) pool = pool.filter((i) => i.type === forcedType);
    }
    if (pool.length === 0 && biome.set && CONFIG.itemPool.sets[biome.set]) {
      pool = CONFIG.itemPool.sets[biome.set];
      if (forcedType) pool = pool.filter((i) => i.type === forcedType);
    }
    if (pool.length === 0) {
      pool = forcedType ? CONFIG.itemPool.common.filter((i) => i.type === forcedType) : CONFIG.itemPool.common;
    }
    if (pool.length === 0) pool = CONFIG.itemPool.common;

    const base = randOf(pool);
    // base.rarity 是否存在，代表這件物品的稀有度是「寫死在模板上」還是「用曲線隨機擲出來」。
    // 這個區別很重要：sin/void 套裝(路西法之傲 baseAtk:2000 這種)已經把 abyssal/phantasm 級的
    // 最終數值直接寫在 base 裡，如果稀有度倍率再套一次，等於同一個級距被算了兩次
    // （跟先前修過的菁英/王倍率疊加、biome.scaling 疊加是同一種錯誤）。
    const hasPresetRarity = !!base.rarity;
    let rarity = base.rarity || rollRarity(depth, Player.currentWorld);

    let item = {
      id: Date.now() + Math.random().toString().slice(2),
      name: base.name,
      baseName: base.name,
      type: base.type,
      subtype: base.subtype,
      rarity,
      setId: base.setId,
      desc: base.desc,
      stats: {},
    };

    if (base.baseAtk) item.stats.atk = base.baseAtk;
    if (base.baseHp) item.stats.maxHp = base.baseHp;
    if (base.baseSpd) item.stats.speed = base.baseSpd;
    if (base.baseDef) item.stats.def = base.baseDef;
    if (base.baseCrit) item.stats.crit = base.baseCrit;

    // 武器子類型身分修正：讓匕首/法杖/戰斧等不再只靠 baseAtk 數字比高低，而是有清楚的定位取捨。
    if (item.type === "weapon" && weaponSubtypes[item.subtype]) {
      const profile = weaponSubtypes[item.subtype];
      if (profile.atkMult !== undefined && item.stats.atk) {
        item.stats.atk = Math.round(item.stats.atk * profile.atkMult);
      }
      if (profile.speedFlat) item.stats.speed = (item.stats.speed || 0) + profile.speedFlat;
      if (profile.defFlat) item.stats.def = (item.stats.def || 0) + profile.defFlat;
      if (profile.critFlat) item.stats.crit = (item.stats.crit || 0) + profile.critFlat;
      if (profile.critDmgFlat) item.stats.crit_dmg = (item.stats.crit_dmg || 0) + profile.critDmgFlat;
      if (profile.blockFlat) item.stats.block = (item.stats.block || 0) + profile.blockFlat;
    }

    // 防具子類型身分修正：跟武器子類型同一精神，讓「厚重 vs 輕盈 vs 守護」不再只靠
    // baseHp/baseSpd 數字大小比較，而是有清楚的定位取捨。
    if (item.type === "armor_upper" || item.type === "armor_lower") {
      item.subtype = inferArmorSubtype(base);
      const profile = armorSubtypes[item.subtype];
      if (profile.hpMult !== undefined && item.stats.maxHp) item.stats.maxHp = Math.round(item.stats.maxHp * profile.hpMult);
      if (profile.speedFlat) item.stats.speed = (item.stats.speed || 0) + profile.speedFlat;
      if (profile.defFlat) item.stats.def = (item.stats.def || 0) + profile.defFlat;
    }

    // 飾品子類型身分修正：utility 路線不追求原始數值放大，而是換取額外機制(爆擊/金幣加成)。
    if (item.type === "accessory") {
      item.subtype = inferAccessorySubtype(base);
      const profile = accessorySubtypes[item.subtype];
      if (profile.atkMult !== undefined && item.stats.atk) item.stats.atk = Math.round(item.stats.atk * profile.atkMult);
      if (profile.hpMult !== undefined && item.stats.maxHp) item.stats.maxHp = Math.round(item.stats.maxHp * profile.hpMult);
      if (profile.critFlat) item.stats.crit = (item.stats.crit || 0) + profile.critFlat;
      if (profile.goldDropFlat) item.stats.gold_drop = (item.stats.gold_drop || 1.0) + profile.goldDropFlat;
    }

    const rInfo = CONFIG.rarity[rarity];
    // depthPowerScale：稀有度機率曲線在 depth 120 封頂後不再成長，但怪物數值持續跨區域爬升
    // (見 rarity.js 的說明)，跟 hasPresetRarity 一樣的邏輯——已經手動調好最終數值的預設稀有度
    // 物品不套用，避免又是一次「同一個級距算兩次」。
    const mult = hasPresetRarity ? 1.0 : (rInfo ? rInfo.mult : 1.0) * depthPowerScale(depth);
    for (let k in item.stats) {
      if (!["def", "crit", "dodge", "block", "crit_dmg"].includes(k)) {
        item.stats[k] = Math.floor(item.stats[k] * mult);
      }
    }

    if (rarity !== "common" && rarity !== "abyssal" && rarity !== "phantasm") {
      const prefix = Math.random() < 0.6 ? randOf(CONFIG.affixes.prefixes) : null;
      const suffix = Math.random() < 0.6 ? randOf(CONFIG.affixes.suffixes) : null;

      let nameParts = [];
      if (prefix) {
        nameParts.push(prefix.name);
        if (prefix.type && prefix.val) {
          const key = prefix.type;
          const val = prefix.val;
          if (["atk", "maxHp", "speed"].includes(key) && val < 2) {
            item.stats[key] = Math.floor((item.stats[key] || 10) * (1 + val));
          } else {
            item.stats[key] = (item.stats[key] || 0) + val;
          }
        }
      }
      nameParts.push(base.name);
      if (suffix) {
        nameParts.push(suffix.name);
        if (suffix.type && suffix.val) {
          const key = suffix.type.replace("flat_", "");
          item.stats[key] = (item.stats[key] || 0) + suffix.val;
        }
      }
      item.name = nameParts.join("");
    }
    return item;
  },
};
