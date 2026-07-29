import { CONFIG } from "../data/index.js";

export const GlobalSystem = {
  KEY: "rpg_abyss_global_v3",
  defaultData: {
    unlockedRaces: ["human", "elf", "orc", "dwarf", "halfling"],
    unlockedClasses: ["warrior", "thief", "archer", "mage", "cleric"],
    discoveredItems: [],
    unlockedAchievements: [],
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
        if (!this.data.unlockedAchievements) this.data.unlockedAchievements = [];
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
      this.checkCollectionMilestones(toast);
    }
  },

  // 成就系統：資料驅動的一次性/門檻判定，呼叫端(combat.js/game.js/inventory.js)只需要在
  // 「自然發生的那一刻」呼叫一次對應的 check，不需要自己寫任何成就專屬邏輯。
  // toast 跟 unlockClass() 一樣用參數傳入，維持 state 層不直接 import ui 模組的既有慣例。
  unlockAchievement(id, toast) {
    if (!CONFIG.achievements[id]) return;
    if (this.data.unlockedAchievements.includes(id)) return;
    this.data.unlockedAchievements.push(id);
    this.save();
    if (toast) toast(`🏆 成就解鎖：${CONFIG.achievements[id].name}`, "gain");
  },

  checkDepthMilestones(depth, toast) {
    const thresholds = { depth_50: 50, depth_100: 100, depth_500: 500 };
    for (const id in thresholds) {
      if (depth >= thresholds[id]) this.unlockAchievement(id, toast);
    }
  },

  checkFullSet(activeSets, toast) {
    for (const setId in activeSets) {
      if (activeSets[setId] >= 6) {
        this.unlockAchievement("full_set", toast);
        break;
      }
    }
  },

  checkCollectionMilestones(toast) {
    const allRaceKeys = Object.keys(CONFIG.races);
    const allClassKeys = Object.keys(CONFIG.classes);
    if (allRaceKeys.every((k) => this.data.unlockedRaces.includes(k))) this.unlockAchievement("all_races", toast);
    if (allClassKeys.every((k) => this.data.unlockedClasses.includes(k))) this.unlockAchievement("all_classes", toast);
  },

  // 死亡傳承：依本輪最大深度解鎖新的種族/職業組合，讓下一輪起跑點更強。
  // 這是「無盡爬塔」面對無限難度成長的核心解法 —— 而不是逼玩家在單局內用鐵匠金幣硬追永無止盡的怪物強度。
  unlockLegacyByDepth(depth, toast) {
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
    if (unlocked) this.checkCollectionMilestones(toast);
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
