import { CONFIG } from "../data/index.js";

export const GlobalSystem = {
  KEY: "rpg_abyss_global_v3",
  defaultData: {
    unlockedRaces: ["human", "elf", "orc", "dwarf", "halfling"],
    unlockedClasses: ["warrior", "thief", "archer", "mage", "cleric"],
    discoveredItems: [],
    maxDepth: 0,
    totalDeaths: 0,
    legacyItem: null,
  },
  data: {},

  init() {
    this.data = JSON.parse(JSON.stringify(this.defaultData));
    this.load();
  },

  load() {
    try {
      const raw = localStorage.getItem(this.KEY);
      if (raw) {
        const loaded = JSON.parse(raw);
        this.data = { ...this.defaultData, ...loaded };
        if (!this.data.unlockedRaces) this.data.unlockedRaces = [...this.defaultData.unlockedRaces];
        if (!this.data.unlockedClasses) this.data.unlockedClasses = [...this.defaultData.unlockedClasses];
        if (!this.data.discoveredItems) this.data.discoveredItems = [];
      }
    } catch (e) {
      console.error("Global load failed, using defaults", e);
      this.data = JSON.parse(JSON.stringify(this.defaultData));
    }
  },

  save() {
    localStorage.setItem(this.KEY, JSON.stringify(this.data));
  },

  unlockItem(name) {
    if (!name) return;
    if (!this.data.discoveredItems.includes(name)) {
      this.data.discoveredItems.push(name);
      this.save();
    }
  },

  unlockClass(id, toast) {
    if (!this.data.unlockedClasses.includes(id)) {
      this.data.unlockedClasses.push(id);
      this.save();
      if (toast) toast(`解鎖新職業：${CONFIG.classes[id].name}`, "gain");
    }
  },

  // 死亡傳承：依本輪最大深度解鎖新的種族/職業組合，讓下一輪起跑點更強。
  // 這是「無盡爬塔」面對無限難度成長的核心解法 —— 而不是逼玩家在單局內用鐵匠金幣硬追永無止盡的怪物強度。
  unlockLegacyByDepth(depth) {
    const raceKeys = Object.keys(CONFIG.races).filter((k) => CONFIG.races[k].hidden);
    const classKeys = Object.keys(CONFIG.classes).filter((k) => CONFIG.classes[k].hidden);
    let unlocked = null;

    if (depth >= 20 && raceKeys.length) {
      const pool = raceKeys.filter((k) => !this.data.unlockedRaces.includes(k));
      if (pool.length) {
        const pick = pool[Math.floor(Math.random() * pool.length)];
        this.data.unlockedRaces.push(pick);
        unlocked = { type: "race", id: pick, name: CONFIG.races[pick].name };
      }
    } else if (depth >= 10 && classKeys.length) {
      const pool = classKeys.filter((k) => !this.data.unlockedClasses.includes(k) && !CONFIG.classes[k].unlockCheck);
      if (pool.length) {
        const pick = pool[Math.floor(Math.random() * pool.length)];
        this.data.unlockedClasses.push(pick);
        unlocked = { type: "class", id: pick, name: CONFIG.classes[pick].name };
      }
    }

    if (depth > this.data.maxDepth) this.data.maxDepth = depth;
    this.data.totalDeaths += 1;
    this.save();
    return unlocked;
  },

  storeLegacyItem(item) {
    this.data.legacyItem = item;
    this.save();
  },

  retrieveLegacyItem() {
    if (this.data.legacyItem) {
      const item = this.data.legacyItem;
      this.data.legacyItem = null;
      this.save();
      return item;
    }
    return null;
  },
};
