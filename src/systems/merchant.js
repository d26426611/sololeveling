import { Player } from "../state/player.js";
import { Inventory } from "./inventory.js";
import { ItemSystem } from "./itemGenerator.js";
import { toast } from "../ui/toast.js";

const SELL_MULT = { common: 1, uncommon: 1.5, rare: 3, epic: 8, legendary: 20, phantasm: 100, abyssal: 100 };

// 找回舊版被拿掉的商人系統，並新增「收購」讓流浪商人事件除了賣東西外，
// 也是一個額外的裝備取得管道，增加事件的可玩性。
export const Merchant = {
  stock: [],

  sellPrice(item) {
    if (item.value) return item.value;
    return Math.floor(50 * (SELL_MULT[item.rarity] || 1));
  },

  sell(id) {
    const item = Inventory.find(id);
    if (!item) return false;
    const price = this.sellPrice(item);
    Player.gold += price;
    Inventory.remove(id);
    toast(`出售 ${item.name} 獲得 ${price}G`, "gain");
    return true;
  },

  rollStock(depth) {
    const count = 3 + Math.floor(Math.random() * 2);
    this.stock = Array.from({ length: count }, () => {
      const item = ItemSystem.generate(null, depth);
      const price = Math.floor(this.sellPrice(item) * 1.6);
      return { item, price };
    });
    return this.stock;
  },

  buy(idx) {
    const entry = this.stock[idx];
    if (!entry) return false;
    if (Player.gold < entry.price) {
      toast("金幣不足", "warn");
      return false;
    }
    Player.gold -= entry.price;
    Inventory.add(entry.item);
    this.stock.splice(idx, 1);
    toast("交易愉快", "gain");
    return true;
  },
};
