import { CONFIG } from "../data/index.js";
import { GlobalSystem } from "../state/globalSystem.js";

// 跟隱藏種族/職業的「???」模式刻意相反：成就無論鎖定與否都顯示名稱與描述，
// 只用視覺樣式(.locked 的灰階/虛線)區分，讓玩家能預先看到有哪些目標。
export function renderAchievements() {
  const list = document.getElementById("achievement-list");
  if (!list) return;
  const unlocked = GlobalSystem.data.unlockedAchievements || [];

  list.innerHTML = Object.entries(CONFIG.achievements)
    .map(([id, a]) => {
      const isUnlocked = unlocked.includes(id);
      return `
        <div class="inv-item${isUnlocked ? "" : " locked"}">
          <div>
            <div class="inv-name">${a.icon} ${a.name}</div>
            <div class="inv-meta">${a.desc}</div>
          </div>
          <div class="inv-meta">${isUnlocked ? "✅" : "🔒"}</div>
        </div>
      `;
    })
    .join("");
}
