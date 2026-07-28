export const affixes = {
    prefixes: [
      { name: "鋒利之", type: "atk", val: 0.1 },
      { name: "堅固之", type: "maxHp", val: 0.1 },
      { name: "輕盈之", type: "speed", val: 0.1 },
      { name: "致命之", type: "crit", val: 0.05, minRarity: "rare" },
      { name: "嗜血之", type: "lifesteal", val: 0.05, minRarity: "epic" },
      { name: "守護之", type: "block", val: 0.05, minRarity: "rare" },
      { name: "狂暴之", type: "atk", val: 0.2, minRarity: "epic" },
    ],
    suffixes: [
      { name: "狼", type: "flat_atk", val: 5 },
      { name: "熊", type: "flat_hp", val: 20 },
      { name: "鷹", type: "flat_spd", val: 5 },
      { name: "巨象", type: "flat_hp", val: 50, minRarity: "rare" },
      { name: "猛虎", type: "flat_atk", val: 15, minRarity: "rare" },
    ],
};
