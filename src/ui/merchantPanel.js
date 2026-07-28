import { CONFIG } from "../data/index.js";
import { Player } from "../state/player.js";
import { Merchant } from "../systems/merchant.js";
import { getEventContentEl } from "./eventScreen.js";
import { updatePlayerPanel } from "./playerPanel.js";

function rarityColor(item) {
  return (CONFIG.rarity[item.rarity] || { color: "text-common" }).color;
}

export function renderMerchant() {
  const content = getEventContentEl();
  if (!content) return;

  const sellRows = Player.inventory
    .map((item) => {
      const price = Merchant.sellPrice(item);
      return `
        <div class="inv-item">
          <div class="inv-item-info">
            <div class="inv-name ${rarityColor(item)}">${item.name}</div>
            <div class="inv-meta">售價: 💰${price}</div>
          </div>
          <div class="inv-actions"><button data-action="sell" data-id="${item.id}" class="btn-secondary">出售</button></div>
        </div>`;
    })
    .join("");

  const buyRows = Merchant.stock
    .map(
      (entry, idx) => `
        <div class="inv-item">
          <div class="inv-item-info">
            <div class="inv-name ${rarityColor(entry.item)}">${entry.item.name}</div>
            <div class="inv-meta">價格: 💰${entry.price}</div>
          </div>
          <div class="inv-actions"><button data-action="buy" data-idx="${idx}" class="btn-primary">購買</button></div>
        </div>`
    )
    .join("");

  content.innerHTML = `
    <div class="merchant-section">
      <h4>🛒 商人的貨品</h4>
      <div id="merchant-buy-list" class="inventory-list compact">${buyRows || "<div style='text-align:center;color:#666;padding:10px'>沒有庫存了</div>"}</div>
      <h4 style="margin-top:14px">💰 出售你的物品</h4>
      <div id="merchant-sell-list" class="inventory-list compact">${sellRows || "<div style='text-align:center;color:#666;padding:10px'>背包是空的</div>"}</div>
    </div>`;

  content.onclick = (e) => {
    const btn = e.target.closest("[data-action]");
    if (!btn) return;
    if (btn.dataset.action === "sell") {
      Merchant.sell(btn.dataset.id);
      renderMerchant();
      updatePlayerPanel();
    } else if (btn.dataset.action === "buy") {
      if (Merchant.buy(Number(btn.dataset.idx))) {
        renderMerchant();
        updatePlayerPanel();
      }
    }
  };
}
