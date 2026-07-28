export const recipes = [
    {
      name: "中級治療藥水",
      type: "consumable",
      effect: { hp: 100 },
      req: { slime_gel: 5, gold: 50 },
      desc: "效果更好的藥水",
    },
    {
      name: "高級治療藥水",
      type: "consumable",
      effect: { hp: 500 },
      req: { life_seed: 1, gold: 100 },
      desc: "能治療嚴重傷勢",
    },
    {
      name: "特級治療藥水",
      type: "consumable",
      effect: { hp: 2000 },
      req: { life_seed: 5, fire_essence: 2 },
      desc: "瞬間恢復大量生命",
    },

    {
      name: "狼牙項鍊",
      type: "accessory",
      setId: "wolf_pack",
      stats: { atk: 10, crit: 0.05 },
      req: { wolf_fang: 10, gold: 200 },
      desc: "散發著野性的氣息",
    },
    {
      name: "火焰劍",
      type: "weapon",
      setId: "flame",
      stats: { atk: 35 },
      req: { fire_essence: 5, iron_ore: 5 },
      desc: "燃燒著永不熄滅的火焰",
    },

    // 幻界入場道具
    {
      name: "幻界之鑰",
      type: "consumable",
      effect: { open_world: "phantasm" },
      req: { wind_crest: 1, earth_shard: 1, eternal_ember: 1 },
      desc: "通往瘋狂世界的鑰匙，需集齊各區精華。",
    },
];
