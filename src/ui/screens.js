// 集中管理事件畫面／戰鬥畫面切換。
// 舊版 bug：combat.js 寫的是 #event-layer / #combat-layer，但 index.html 實際 id 是
// #event-screen / #combat-screen，兩邊對不上導致戰鬥畫面永遠切不過去 —— 這裡統一用實際存在的 id。
export function openScreen(id) {
  document.querySelectorAll(".game-stage").forEach((s) => (s.style.display = "none"));
  const target = document.getElementById(id);
  if (target) target.style.display = "flex";
}

export function showEventScreen() {
  openScreen("event-screen");
}

export function showCombatScreen() {
  openScreen("combat-screen");
}
