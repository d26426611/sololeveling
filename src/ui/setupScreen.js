import { CONFIG } from "../data/index.js";
import { GlobalSystem } from "../state/globalSystem.js";
import { toast } from "./toast.js";

const tempSetup = { race: null, cls: null };

export function getSetupSelection() {
  return tempSetup;
}

function updateSetupUI() {
  document.querySelectorAll(".select-btn").forEach((b) => b.classList.remove("selected"));
  if (tempSetup.race) {
    const el = document.querySelector(`.select-btn[data-race="${tempSetup.race}"]`);
    el?.classList.add("selected");
  }
  if (tempSetup.cls) {
    const el = document.querySelector(`.select-btn[data-class="${tempSetup.cls}"]`);
    el?.classList.add("selected");
  }

  const r = tempSetup.race ? CONFIG.races[tempSetup.race] : null;
  const c = tempSetup.cls ? CONFIG.classes[tempSetup.cls] : null;
  const desc = document.getElementById("setup-desc");
  const startBtn = document.getElementById("btn-start-game");
  if (r && c) {
    if (desc) desc.innerHTML = `<b>${r.name} ${c.name}</b><br>${r.desc}<br>${c.desc}`;
    if (startBtn) startBtn.disabled = false;
  } else {
    if (desc) desc.innerHTML = r ? `<b>${r.name}</b><br>${r.desc}` : c ? `<b>${c.name}</b><br>${c.desc}` : "請選擇種族與職業...";
    if (startBtn) startBtn.disabled = true;
  }
}

export function renderSetup() {
  const raceEl = document.getElementById("race-options");
  const classEl = document.getElementById("class-options");
  if (!raceEl || !classEl) return;
  raceEl.innerHTML = "";
  classEl.innerHTML = "";

  // 每次重新進入創角畫面（含死亡傳承後的下一輪）都要清空上一輪的選擇，
  // 否則舊版留下的 bug 會重現：按鈕悄悄沿用上次的種族/職業，玩家沒意識到就直接開始。
  tempSetup.race = null;
  tempSetup.cls = null;

  for (const key in CONFIG.races) {
    if (CONFIG.races[key].hidden && !GlobalSystem.data.unlockedRaces.includes(key)) continue;
    const btn = document.createElement("div");
    btn.className = "select-btn";
    btn.dataset.race = key;
    btn.innerText = CONFIG.races[key].name;
    btn.onclick = () => {
      tempSetup.race = key;
      updateSetupUI();
    };
    raceEl.appendChild(btn);
  }
  appendLockedHints(raceEl, CONFIG.races, GlobalSystem.data.unlockedRaces);

  for (const key in CONFIG.classes) {
    if (CONFIG.classes[key].hidden && !GlobalSystem.data.unlockedClasses.includes(key)) continue;
    const btn = document.createElement("div");
    btn.className = "select-btn";
    btn.dataset.class = key;
    btn.innerText = CONFIG.classes[key].name;
    btn.onclick = () => {
      tempSetup.cls = key;
      updateSetupUI();
    };
    classEl.appendChild(btn);
  }
  appendLockedHints(classEl, CONFIG.classes, GlobalSystem.data.unlockedClasses);

  updateSetupUI();
}

// 尚未解鎖的隱藏種族/職業顯示成灰階「???」卡片，用原本就寫好的暗示性 desc 文字給玩家一點方向，
// 但不把 unlockCheck 的精確數值門檻外露，保留探索感。
function appendLockedHints(container, entries, unlockedList) {
  for (const key in entries) {
    const entry = entries[key];
    if (!entry.hidden || unlockedList.includes(key)) continue;
    const card = document.createElement("div");
    card.className = "select-btn locked";
    card.innerText = "???";
    card.title = entry.desc || "";
    card.onclick = () => toast(`「${entry.desc || "未知的力量"}」尚未解鎖`, "warn");
    container.appendChild(card);
  }
}
