import { CONFIG } from "../data/index.js";
import { Player } from "../state/player.js";
import { Blacksmith, MAX_LEVEL, upgradeCost } from "../systems/blacksmith.js";
import { updatePlayerPanel } from "./playerPanel.js";

export function renderBlacksmith() {
  const list = document.getElementById("blacksmith-list");
  if (!list) return;

  const equipped = Blacksmith.equippedList();
  if (equipped.length === 0) {
    list.innerHTML = "<div style='text-align:center; padding:20px; color:#666'>請先裝備物品</div>";
    return;
  }

  list.innerHTML = equipped
    .map(({ slot, item }) => {
      const level = item.level || 0;
      const rInfo = CONFIG.rarity[item.rarity] || { color: "text-common" };
      if (level >= MAX_LEVEL) {
        return `
          <div class="inv-item">
            <div class="inv-item-info">
              <div class="inv-name ${rInfo.color}">${item.name} (+${level})</div>
              <div class="inv-meta">已達強化上限</div>
            </div>
          </div>`;
      }
      const { gold, dust } = upgradeCost(level);
      const canAfford = Player.gold >= gold && (Player.magicDust || 0) >= dust;
      const dustText = dust > 0 ? ` + ✨${dust}` : "";
      return `
        <div class="inv-item">
          <div class="inv-item-info">
            <div class="inv-name ${rInfo.color}">${item.name} (+${level})</div>
            <div class="inv-meta">下級消耗: 💰${gold}${dustText} | 屬性+10%</div>
          </div>
          <div class="inv-actions">
            <button ${canAfford ? "" : "disabled"} data-action="upgrade" data-slot="${slot}" class="btn-primary">強化</button>
          </div>
        </div>`;
    })
    .join("");
}

export function initBlacksmithPanel() {
  const list = document.getElementById("blacksmith-list");
  if (!list) return;
  list.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-action='upgrade']");
    if (!btn) return;
    if (Blacksmith.upgrade(btn.dataset.slot)) {
      renderBlacksmith();
      updatePlayerPanel();
    }
  });
}
