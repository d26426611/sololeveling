import { renderInventory } from "./inventoryPanel.js";
import { renderCrafting } from "./craftingPanel.js";
import { renderBlacksmith } from "./blacksmithPanel.js";
import { renderCompendium } from "./compendiumPanel.js";

const renderers = {
  inventory: () => renderInventory(),
  crafting: () => renderCrafting(),
  blacksmith: () => renderBlacksmith(),
  compendium: () => renderCompendium(),
  system: () => {},
};

export function switchTab(tabId) {
  document.querySelectorAll(".tab-btn").forEach((b) => b.classList.toggle("active", b.dataset.tab === tabId));
  document.querySelectorAll(".tab-pane").forEach((p) => p.classList.toggle("active", p.id === `tab-${tabId}`));
  renderers[tabId]?.();
}

export function initTabs() {
  document.querySelectorAll(".tab-btn").forEach((btn) => {
    btn.addEventListener("click", () => switchTab(btn.dataset.tab));
  });
}
