import { CONFIG } from "../data/index.js";
import { Crafting } from "../systems/crafting.js";
import { Inventory } from "../systems/inventory.js";
import { renderInventory } from "./inventoryPanel.js";
import { updatePlayerPanel } from "./playerPanel.js";

export function renderCrafting() {
  const list = document.getElementById("recipe-list");
  if (!list) return;

  const recipes = Crafting.visibleRecipes();
  if (recipes.length === 0) {
    list.innerHTML = "<div style='text-align:center; padding:20px; color:#666'>收集素材以解鎖配方...</div>";
    return;
  }

  list.innerHTML = recipes
    .map((r) => {
      const canCraft = Crafting.canCraft(r);
      const reqHtml = Object.keys(r.req)
        .map((k) => {
          const has = Inventory.countMat(k);
          const need = r.req[k];
          const label = k === "gold" ? "💰" : CONFIG.materials[k]?.name || k;
          return `<span class="${has >= need ? "text-common" : "text-uncommon"}">${label} ${has}/${need}</span>`;
        })
        .join(", ");
      return `
        <div class="inv-item border-rare">
          <div style="flex:1">
            <div class="text-rare" style="font-weight:bold">${r.name}</div>
            <div style="font-size:0.8em; color:#aaa">${r.desc || ""}</div>
            <div style="font-size:0.8em; margin-top:4px;">${reqHtml}</div>
          </div>
          <button ${canCraft ? "" : "disabled"} data-action="craft" data-name="${r.name}" class="btn-primary">合成</button>
        </div>`;
    })
    .join("");
}

export function initCraftingPanel() {
  const list = document.getElementById("recipe-list");
  if (!list) return;
  list.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-action='craft']");
    if (!btn) return;
    if (Crafting.craft(btn.dataset.name)) {
      renderCrafting();
      renderInventory();
      updatePlayerPanel();
    }
  });
}
