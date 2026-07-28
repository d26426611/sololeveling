function freshPlayerData() {
  return {
    name: "勇者",
    race: null,
    class: null,
    depth: 0,
    biomeDepth: 0, // 目前區域內已走幾層，換區域時歸零；決定菁英/區域王的觸發節奏
    biomeIndex: 0, // 目前是第幾個一般區域（依 CONFIG.biomes[x].order 排序），打贏區域王才會 +1
    gold: 0,
    currentHp: 100,
    currentBiomeId: "plains",
    currentWorld: "normal",
    sanity: 100,
    karma: 0,
    magicDust: 0,
    stats: {
      maxHp: 100,
      atk: 10,
      speed: 100,
      crit: 0.05,
      def: 0,
      dodge: 0,
      block: 0,
      lifesteal: 0,
      hp_regen: 0,
    },
    baseStats: { maxHp: 100, atk: 10, speed: 100 },
    inventory: [],
    equipment: {
      weapon: null,
      armor_upper: null,
      armor_lower: null,
      acc1: null,
      acc2: null,
      acc3: null,
    },
    activeSets: {},
    flags: {},
  };
}

// 單例狀態物件：沿用舊架構「直接掛在模組上、就地 mutate」的模式，
// 避免這次重寫牽動所有呼叫端改用 immutable state 帶來的大量改動風險。
export const Player = freshPlayerData();

export function resetPlayer() {
  Object.assign(Player, freshPlayerData());
}
