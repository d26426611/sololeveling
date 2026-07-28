import { Player } from "../state/player.js";

export function setEnemyDisplay(enemy) {
  document.getElementById("enemy-name").innerText = enemy.name;
  document.getElementById("enemy-icon").innerText = enemy.icon;
}

export function resetLog() {
  const box = document.getElementById("combat-log");
  if (box) box.innerHTML = "";
}

export function logMessage(msg, type) {
  const box = document.getElementById("combat-log");
  if (!box) return;
  box.innerHTML += `<div class="log-entry ${type}">${msg}</div>`;
  box.scrollTop = box.scrollHeight;
}

export function updateBars(enemy) {
  const pPct = Math.max(0, (Player.currentHp / Player.stats.maxHp) * 100);
  const ePct = Math.max(0, (enemy.currentHp / enemy.maxHp) * 100);
  document.getElementById("player-hp-bar").style.width = pPct + "%";
  document.getElementById("player-hp-text").innerText = `${Math.floor(Player.currentHp)}/${Player.stats.maxHp}`;
  document.getElementById("enemy-hp-bar").style.width = ePct + "%";
  document.getElementById("enemy-hp-text").innerText = `${Math.floor(enemy.currentHp)}/${enemy.maxHp}`;
}
