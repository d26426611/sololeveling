import { CONFIG } from "../data/index.js";
import { GlobalSystem } from "../state/globalSystem.js";

// 圖鑑的「總表」直接列舉資料本身(itemPool 的裝備模板、materials、recipes)，而不是碰運氣
// 收集到什麼才顯示什麼——discoveredItems 只負責標記「這個名字見過沒」，追蹤機制完全沿用原本
// 的樣子，這裡只是把渲染從「一行名字」升級成「完整卡片 + 未發現的 ??? 佔位」。
function catalogEntries() {
  const entries = [];
  const seen = new Set();
  const push = (entry) => {
    if (seen.has(entry.name)) return;
    seen.add(entry.name);
    entries.push(entry);
  };

  for (const base of CONFIG.itemPool.common) push(base);
  for (const setId in CONFIG.itemPool.sets) {
    for (const base of CONFIG.itemPool.sets[setId]) push(base);
  }
  for (const key in CONFIG.materials) {
    push({ ...CONFIG.materials[key], type: "material" });
  }
  for (const recipe of CONFIG.recipes) {
    push({
      name: recipe.name,
      type: recipe.type,
      desc: recipe.desc,
      stats: recipe.stats,
      rarity: recipe.type === "consumable" ? "legendary" : "epic",
    });
  }
  return entries;
}

function statsSummary(entry) {
  const parts = [];
  if (entry.baseAtk) parts.push(`攻擊 ${entry.baseAtk}`);
  if (entry.baseHp) parts.push(`生命 ${entry.baseHp}`);
  if (entry.baseSpd) parts.push(`速度 ${entry.baseSpd}`);
  if (entry.baseDef) parts.push(`防禦 ${entry.baseDef}`);
  if (entry.baseCrit) parts.push(`爆擊 ${entry.baseCrit}`);
  if (entry.stats) for (const k in entry.stats) parts.push(`${k} ${entry.stats[k]}`);
  return parts.join(" / ") || "—";
}

export function renderCompendium() {
  const list = document.getElementById("compendium-list");
  if (!list) return;
  const discovered = GlobalSystem.data.discoveredItems || [];

  list.innerHTML = catalogEntries()
    .map((entry) => {
      if (!discovered.includes(entry.name)) {
        return `<div class="inv-item locked"><div class="inv-name">???</div><div class="inv-meta">尚未發現</div></div>`;
      }
      const rarity = entry.rarity || "common";
      const colorClass = CONFIG.rarity[rarity]?.color || "text-common";
      return `
        <div class="inv-item">
          <div>
            <div class="inv-name ${colorClass}">${entry.name}</div>
            ${entry.desc ? `<div class="inv-meta">${entry.desc}</div>` : ""}
            <div class="inv-meta">${statsSummary(entry)}</div>
          </div>
        </div>
      `;
    })
    .join("");
}
