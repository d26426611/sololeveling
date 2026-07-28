import { showEventScreen } from "./screens.js";

let currentAction = null;

function handleControlsClick(e) {
  const btn = e.target.closest("[data-action]");
  if (!btn || !currentAction) return;
  currentAction(btn.dataset.action, btn);
}

export function initEventControls() {
  const controls = document.getElementById("event-controls");
  if (controls) controls.addEventListener("click", handleControlsClick);
}

/**
 * 通用事件畫面渲染：標題 + 大圖示 + 內容 HTML + 任意數量的按鈕。
 * buttonsHtml 裡的按鈕用 data-action="xxx" 標記，點擊時透過事件委派呼叫 onAction(action, buttonEl)，
 * 取代舊版到處寫 onclick="Xxx.yyy()" 字串、需要把系統物件掛在 window 上的作法。
 */
export function renderEventStage(title, icon, bodyHtml, buttonsHtml, onAction) {
  document.getElementById("event-title").innerText = title;
  document.getElementById("event-icon").innerText = icon || "";
  document.getElementById("event-desc").innerHTML = bodyHtml;
  document.getElementById("event-content").innerHTML = "";

  const controls = document.getElementById("event-controls");
  if (controls) controls.innerHTML = buttonsHtml || "";

  currentAction = onAction || null;
  showEventScreen();
}

// 給需要在 #event-content 區塊自行渲染子面板的系統（商人/鐵匠/合成）使用。
export function getEventContentEl() {
  return document.getElementById("event-content");
}
