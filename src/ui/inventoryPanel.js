import { Player } from "../state/player.js";
import { Inventory } from "../systems/inventory.js";
import { updatePlayerPanel } from "./playerPanel.js";
import { setBonusPreview } from "./setBonusText.js";

let currentFilter = "all";

const FILTER_TYPES = {
  weapon: ["weapon"],
  armor: ["armor_upper", "armor_lower"],
  accessory: ["accessory"],
  mat: ["material", "consumable"],
};

function rarityColor(rarity) {
  return `var(--rarity-${rarity || "common"})`;
}

export function renderInventory(filter = currentFilter) {
  currentFilter = filter;
  const list = document.getElementById("inventory-list");
  if (!list) return;

  const countEl = document.getElementById("inv-count");
  if (countEl) countEl.innerText = `${Player.inventory.length} | ✨${Player.magicDust || 0}`;

  document.querySelectorAll(".filter-btn").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.filter === filter);
  });

  let items = Player.inventory;
  if (FILTER_TYPES[filter]) items = items.filter((i) => FILTER_TYPES[filter].includes(i.type));

  if (items.length === 0) {
    list.innerHTML = "<div style='color:#666; text-align:center; padding:20px;'>背包是空的</div>";
    return;
  }

  list.innerHTML = items
    .map((item) => {
      const rColor = rarityColor(item.rarity);
      let meta = item.desc || "";
      if (item.stats) {
        const parts = [];
        if (item.stats.atk) parts.push(`攻${item.stats.atk}`);
        if (item.stats.maxHp) parts.push(`血${item.stats.maxHp}`);
        if (parts.length) meta = parts.join(" ");
      }
      if (item.setId) meta += (meta ? "<br>" : "") + setBonusPreview(item.setId);
      let btns = "";
      if (item.type === "consumable") {
        btns = `<button class="btn-secondary" data-action="use" data-id="${item.id}">使用</button>`;
      } else if (item.type !== "material") {
        btns = `<button class="btn-secondary" data-action="equip" data-id="${item.id}">裝備</button>`;
      }
      if (item.type !== "material") {
        btns += `<button class="btn-secondary" data-action="disassemble" data-id="${item.id}">分解</button>`;
      }
      return `
        <div class="inv-item" style="border-left:4px solid ${rColor}">
          <div class="inv-item-info">
            <div class="inv-name" style="color:${rColor}">${item.name}${item.level ? ` +${item.level}` : ""}</div>
            <div class="inv-meta">${meta}</div>
          </div>
          <div class="inv-actions">${btns}</div>
        </div>`;
    })
    .join("");
}

export function initInventoryPanel() {
  const list = document.getElementById("inventory-list");
  if (list) {
    list.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-action]");
      if (!btn) return;
      const id = btn.dataset.id;
      if (btn.dataset.action === "equip") {
        Inventory.equip(id);
        renderInventory();
        updatePlayerPanel();
      } else if (btn.dataset.action === "use") {
        const result = Inventory.use(id);
        renderInventory();
        updatePlayerPanel();
        if (result?.openWorld) document.dispatchEvent(new CustomEvent("game:enter-world", { detail: result.openWorld }));
      } else if (btn.dataset.action === "disassemble") {
        Inventory.disassemble(id);
        renderInventory();
      }
    });
  }

  document.querySelectorAll(".filter-btn").forEach((btn) => {
    btn.addEventListener("click", () => renderInventory(btn.dataset.filter));
  });
}
