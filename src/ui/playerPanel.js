import { CONFIG } from "../data/index.js";
import { Player } from "../state/player.js";
import { Inventory } from "../systems/inventory.js";
import { recalcPlayerStats } from "../state/playerStats.js";
import { setProgressSummary } from "./setBonusText.js";

function safeSet(id, val) {
  const el = document.getElementById(id);
  if (el) el.innerText = val;
}

export function updatePlayerPanel() {
  if (!Player.class) return;

  const biome = CONFIG.biomes[Player.currentBiomeId] || { name: "未知", color: "#fff" };
  safeSet("header-depth", `F: ${Player.depth}`);
  const biomeEl = document.getElementById("header-biome");
  if (biomeEl) {
    biomeEl.innerText = biome.name;
    biomeEl.style.color = biome.color;
  }
  safeSet("header-name", `${CONFIG.races[Player.race].name} ${CONFIG.classes[Player.class].name}`);
  safeSet("header-gold", Player.gold);

  safeSet("stat-hp", `${Math.floor(Player.currentHp)}/${Player.stats.maxHp}`);
  safeSet("stat-atk", Player.stats.atk);
  safeSet("stat-spd", Player.stats.speed);
  safeSet("stat-crit", `${Math.floor((Player.stats.crit || 0.05) * 100)}%`);

  let defText = "";
  if (Player.stats.block > 0) defText += `格擋${Math.floor(Player.stats.block * 100)}% `;
  if (Player.stats.dodge > 0) defText += `閃避${Math.floor(Player.stats.dodge * 100)}% `;
  if (Player.stats.def > 0) defText += `減傷${Math.floor(Player.stats.def * 100)}% `;
  safeSet("stat-def", defText || "0%");

  const sanityRow = document.getElementById("stat-sanity-row");
  if (sanityRow) {
    if (Player.currentWorld === "phantasm") {
      sanityRow.style.display = "flex";
      safeSet("stat-sanity", Player.sanity);
    } else {
      sanityRow.style.display = "none";
    }
  }

  const karmaRow = document.getElementById("stat-karma-row");
  if (karmaRow) {
    if (Player.currentWorld === "purgatory") {
      karmaRow.style.display = "flex";
      safeSet("stat-karma", Player.karma);
    } else {
      karmaRow.style.display = "none";
    }
  }

  for (let slot in Player.equipment) {
    const el = document.querySelector(`.mini-slot[data-slot="${slot}"]`);
    const item = Player.equipment[slot];
    if (!el) continue;
    if (item) {
      el.innerHTML = item.type === "weapon" ? "⚔️" : item.type.includes("armor") ? "👕" : "💍";
      el.style.borderColor = `var(--rarity-${item.rarity})`;
      el.style.color = `var(--rarity-${item.rarity})`;
      el.style.boxShadow = item.setId ? "0 0 5px var(--rarity-common)" : "none";
      el.onclick = () => {
        if (confirm(`卸下 ${item.name}?`)) {
          Inventory.unequip(slot);
          updatePlayerPanel();
        }
      };
      let statsStr = `[${item.name}]${item.level ? ` +${item.level}` : ""}\n`;
      if (item.setId && CONFIG.sets[item.setId]) statsStr += `【${CONFIG.sets[item.setId].name}套裝】\n`;
      for (let k in item.stats) {
        if (item.stats[k] !== 0) statsStr += `${k}: ${item.stats[k] > 0 ? "+" : ""}${item.stats[k]}\n`;
      }
      el.title = statsStr;
    } else {
      el.innerHTML = slot === "weapon" ? "⚔️" : slot.includes("armor") ? "👕" : "💍";
      el.style.borderColor = "var(--border)";
      el.style.color = "#555";
      el.style.boxShadow = "none";
      el.onclick = null;
      el.title = "空";
    }
  }

  const setDiv = document.getElementById("active-sets");
  if (setDiv) {
    const lines = [];
    for (let sid in Player.activeSets) {
      const count = Player.activeSets[sid];
      if (count >= 1 && CONFIG.sets[sid]) lines.push(setProgressSummary(sid, count));
    }
    setDiv.innerHTML = lines.join("<br>");
  }
}

export function recalcAndRefresh() {
  recalcPlayerStats();
  updatePlayerPanel();
}
