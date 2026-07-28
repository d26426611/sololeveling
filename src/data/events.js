export const events = [
    { id: "spring", weight: 20, icon: "⛲", name: "治癒之泉" },
    { id: "chest", weight: 25, icon: "📦", name: "寶箱" },
    { id: "merchant", weight: 15, icon: "👳", name: "流浪商人" },
    { id: "crafting", weight: 12, icon: "⚒️", name: "廢棄工作台" },
    { id: "gambler", weight: 8, icon: "🎲", name: "瘋狂賭徒" },
    { id: "alchemist", weight: 8, icon: "🧪", name: "煉金術師" },
    { id: "trap", weight: 10, icon: "🪤", name: "陷阱" },

    // 特殊高階事件 (極低機率)
    {
      id: "demon_contract",
      weight: 1,
      icon: "📜",
      name: "惡魔契約",
      desc: "用靈魂換取力量，但代價是墮入煉獄...",
    },
    {
      id: "sanity_altar",
      weight: 5,
      icon: "🧠",
      name: "理智祭壇",
      desc: "[幻界] 獻祭理智以換取禁忌的知識。",
    },
];
