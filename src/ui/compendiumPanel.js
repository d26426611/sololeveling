import { GlobalSystem } from "../state/globalSystem.js";

export function renderCompendium() {
  const list = document.getElementById("compendium-list");
  if (!list) return;
  const items = GlobalSystem.data.discoveredItems || [];
  if (items.length === 0) {
    list.innerHTML = "<div style='text-align:center;color:#666'>尚無紀錄</div>";
    return;
  }
  list.innerHTML = items.map((name) => `<div class="inv-item"><div class="inv-name text-common">${name}</div></div>`).join("");
}
