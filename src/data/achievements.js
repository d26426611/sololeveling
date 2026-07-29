// 成就一律顯示名稱與描述（鎖定或已解鎖都一樣），跟隱藏種族/職業的「???」模式刻意相反——
// 玩家應該能預先看到有哪些目標，而不是被動被驚喜。見 docs/adr（Achievement 相關）。
export const achievements = {
  first_kill: { name: "初戰告捷", desc: "在戰鬥中擊敗你的第一個敵人", icon: "⚔️", category: "combat" },
  first_boss: { name: "屠王者", desc: "擊敗你的第一個區域王", icon: "👑", category: "combat" },
  depth_50: { name: "深淵旅人", desc: "抵達第 50 層", icon: "🕳️", category: "exploration" },
  depth_100: { name: "無底深淵", desc: "抵達第 100 層", icon: "🌌", category: "exploration" },
  depth_500: { name: "無盡爬塔者", desc: "抵達第 500 層", icon: "♾️", category: "exploration" },
  full_set: { name: "全套武裝", desc: "同時裝備一整套(6件)套裝效果", icon: "🛡️", category: "collection" },
  death_legacy: { name: "薪火相傳", desc: "觸發死亡傳承機制，將裝備與經驗傳給下一輪", icon: "🔥", category: "collection" },
  all_races: { name: "血脈大全", desc: "解鎖遊戲中所有種族", icon: "🧬", category: "collection" },
  all_classes: { name: "職業大師", desc: "解鎖遊戲中所有職業", icon: "🎓", category: "collection" },
};
