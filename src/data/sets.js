export const setBonuses = {
    adventurer: {
      name: "新手冒險者",
      bonus2: { maxHp: 50 },
      bonus4: { all_pct: 0.1 },
      bonus6: { hp_regen: 5 },
    },
    wolf_pack: {
      name: "狼群之心",
      bonus2: { speed: 15 },
      bonus4: { crit: 0.1 },
      bonus6: { crit_dmg: 0.5 },
    },
    forest: {
      name: "森之靈",
      bonus2: { dodge: 0.05 },
      bonus4: { hp_regen: 10 },
      bonus6: { speed: 30 },
    },
    miner: {
      name: "堅定意志",
      bonus2: { block: 0.1 },
      bonus4: { maxHp: 300 },
      bonus6: { def: 0.15 },
    },
    flame: {
      name: "火焰行者",
      bonus2: { atk: 30 },
      bonus4: { true_dmg: 20 },
      bonus6: { atk_pct: 0.25 },
    },
    glacial: {
      name: "絕對零度",
      bonus2: { def: 0.1 },
      bonus4: { reflect: 0.2 },
      bonus6: { block: 0.3 },
    },
    necro: {
      name: "亡靈大軍",
      bonus2: { lifesteal: 0.05 },
      bonus4: { atk: 50 },
      bonus6: { maxHp: 500 },
    },
    sandstorm: {
      name: "沙漠風暴",
      bonus2: { speed: 30 },
      bonus4: { dodge: 0.1 },
      bonus6: { true_dmg: 50 },
    },

    // 後期套裝
    sin: {
      name: "七宗罪",
      bonus2: { atk_pct: 0.5 },
      bonus4: { lifesteal: 0.2 },
      bonus6: { true_dmg: 10000 },
    },
    void: {
      name: "虛空行者",
      bonus2: { speed: 100 },
      bonus4: { sanity_regen: 1 },
    }, // 特殊：每層回理智
};
