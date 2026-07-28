export const races = {
    // --- 基礎種族 ---
    human: {
      name: "人類",
      desc: "適應力強，學習能力快，各項能力平均。",
      mod: { maxHp: 1.0, atk: 1.0, speed: 1.0, exp: 1.1 },
    },
    elf: {
      name: "精靈",
      desc: "森林的子民，身手矯健，擅長閃避。",
      mod: { maxHp: 0.85, atk: 1.05, speed: 1.25 },
    },
    orc: {
      name: "獸人",
      desc: "充滿野性的戰鬥種族，攻擊力驚人。",
      mod: { maxHp: 1.2, atk: 1.2, speed: 0.9 },
    },
    dwarf: {
      name: "矮人",
      desc: "如岩石般堅硬，生命力與負重能力頑強。",
      mod: { maxHp: 1.3, atk: 0.95, speed: 0.8 },
    },
    halfling: {
      name: "半身人",
      desc: "體型嬌小但極其幸運，容易發現寶物。",
      mod: { maxHp: 0.8, atk: 0.9, speed: 1.15 },
    },

    // --- 條件解鎖種族 ---
    undead: {
      name: "亡靈",
      desc: "[隱藏] 非生者，免疫毒素但無法使用藥水恢復。",
      hidden: true,
      mod: { maxHp: 0.7, atk: 1.4, speed: 0.9 },
    },
    dragonkin: {
      name: "龍人",
      desc: "[隱藏] 擁有龍之血脈，攻守兼備的強大戰士。",
      hidden: true,
      mod: { maxHp: 1.2, atk: 1.2, speed: 1.0 },
    },

    // --- 後期特殊種族 ---
    demon_spawn: {
      name: "魔人",
      desc: "[煉獄專屬] 與惡魔融合，以業力為食，越戰越強。",
      hidden: true,
      mod: { maxHp: 1.5, atk: 1.5, speed: 1.1 },
    },
    void_walker: {
      name: "虛空行者",
      desc: "[幻界專屬] 沒有實體，理智值消耗減半，極度敏捷。",
      hidden: true,
      mod: { maxHp: 0.8, atk: 1.3, speed: 1.4 },
    },
};
