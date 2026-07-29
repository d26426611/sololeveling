import { CONFIG } from "../data/index.js";
import { Player } from "../state/player.js";
import { Inventory } from "../systems/inventory.js";
import { ItemSystem } from "../systems/itemGenerator.js";
import { Merchant } from "../systems/merchant.js";
import { recalcAndRefresh, updatePlayerPanel } from "../ui/playerPanel.js";
import { applySanityLoss } from "../state/playerStats.js";
import { renderEventStage } from "../ui/eventScreen.js";
import { renderMerchant } from "../ui/merchantPanel.js";
import { toast } from "../ui/toast.js";
import { GlobalSystem } from "../state/globalSystem.js";

// game.js 在啟動時注入，避免 eventDirector.js <-> game.js 循環 import。
let hooks = {
  nextDepth: () => {},
  enterWorld: () => {},
  gameOver: () => {},
};

export function configureEventDirector(injected) {
  hooks = { ...hooks, ...injected };
}

// 排除 chest：寶箱在 Game.nextDepth() 有自己獨立的機率分支，這裡只在「事件」分支內加權抽選。
const WEIGHTED_EVENT_IDS = ["spring", "merchant", "crafting", "gambler", "alchemist", "trap", "demon_contract", "sanity_altar"];

export const EventDirector = {
  checkAwakening() {
    for (const cid in CONFIG.classes) {
      const c = CONFIG.classes[cid];
      if (!c.hidden || !c.unlockCheck) continue;
      if (Player.class === cid || Player.flags[`rej_${cid}`]) continue;
      if (c.unlockCheck(Player)) return cid;
    }
    return null;
  },

  // T1 -> T2 職業升職：利用 data/classes.js 既有但從未被使用過的 promotesTo 欄位，
  // 在玩家撐過第一個區域關卡(深度 20)後開放選擇是否升職，而不是讓 T2 職業一開始就擠進創角清單。
  checkPromotion() {
    if (Player.flags.promotion_resolved) return null;
    const current = CONFIG.classes[Player.class];
    if (!current?.promotesTo) return null;
    if (Player.depth < 20) return null;
    return current.promotesTo;
  },

  trigger() {
    const pool = CONFIG.events.filter((e) => WEIGHTED_EVENT_IDS.includes(e.id));
    const total = pool.reduce((a, b) => a + b.weight, 0);
    let r = Math.random() * total;
    let picked = pool[0];
    for (const e of pool) {
      if (r < e.weight) {
        picked = e;
        break;
      }
      r -= e.weight;
    }
    GlobalSystem.unlockEvent(picked.id);
    (this[picked.id] || this.trap).call(this);
  },

  spring() {
    renderEventStage("治癒之泉", "⛲", "<p>清澈的泉水散發著溫暖的光輝。</p>", `<button class="btn-primary" data-action="drink">飲用</button>`, () => {
      Player.currentHp = Player.stats.maxHp;
      toast("HP 已回滿", "heal");
      updatePlayerPanel();
      hooks.nextDepth();
    });
  },

  trap() {
    renderEventStage("陷阱", "🪤", "<p>你踩中了偽裝的陷阱！</p>", `<button class="btn-danger" data-action="struggle">掙扎脫身</button>`, () => {
      const pctDmg = Math.floor(Player.currentHp * 0.25);
      const flatDmg = 10 + Math.floor(Player.depth * 0.5);
      const dmg = pctDmg + flatDmg;
      Player.currentHp -= dmg;
      toast(`-${dmg} HP`, "warn");
      updatePlayerPanel();
      if (Player.currentHp <= 0) {
        if (Player.flags.mark_of_sin) hooks.enterWorld("purgatory");
        else hooks.gameOver();
      } else {
        hooks.nextDepth();
      }
    });
  },

  gambler() {
    renderEventStage(
      "瘋狂賭徒",
      "🎲",
      "<p>「要不要賭一把？100 金幣，比大小。」</p>",
      `<button class="btn-primary" data-action="bet">賭一把 (100G)</button><button class="btn-secondary" data-action="leave">離開</button>`,
      (action) => {
        if (action === "bet") {
          if (Player.gold < 100) {
            toast("金幣不足", "warn");
            return;
          }
          Player.gold -= 100;
          if (Math.random() < 0.5) {
            Player.gold += 250;
            toast("贏了！", "gain");
          } else {
            toast("輸了", "warn");
          }
          updatePlayerPanel();
        }
        hooks.nextDepth();
      }
    );
  },

  alchemist() {
    renderEventStage(
      "煉金術師",
      "🧪",
      "<p>神秘的煉金術師願意用藥劑跟你交換點什麼。</p>",
      `<button class="btn-primary" data-action="potions">兩瓶藥水</button><button class="btn-secondary" data-action="enchant">強化武器</button>`,
      (action) => {
        if (action === "potions") {
          for (let i = 0; i < 2; i++) {
            Inventory.add({ id: Date.now() + Math.random(), name: "治療藥水", baseName: "治療藥水", type: "consumable", rarity: "common", effect: { hp: 80 }, desc: "恢復 80 HP" });
          }
        } else if (action === "enchant") {
          if (Player.equipment.weapon) {
            Player.equipment.weapon.stats.atk = (Player.equipment.weapon.stats.atk || 0) + 10;
            toast("攻擊 +10", "gain");
            recalcAndRefresh();
          } else {
            toast("沒有武器可強化", "warn");
          }
        }
        hooks.nextDepth();
      }
    );
  },

  demon_contract() {
    renderEventStage(
      "惡魔契約",
      "📜",
      "<p>陰影中傳來低語：「獻上你的靈魂，換取力量吧...」<br>接受後，死亡時你將不會真正消逝，而是墮入煉獄。</p>",
      `<button class="btn-danger" data-action="accept">接受</button><button class="btn-secondary" data-action="reject">拒絕</button>`,
      (action) => {
        if (action === "accept") {
          Player.flags.mark_of_sin = true;
          recalcAndRefresh();
          toast("獲得【罪惡印記】", "warn");
        }
        hooks.nextDepth();
      }
    );
  },

  sanity_altar() {
    const inPhantasm = Player.currentWorld === "phantasm";
    const body = inPhantasm
      ? "<p>祭壇上刻著無法理解的符文，獻上理智似乎能換取禁忌的知識。</p>"
      : "<p>一座蒙塵的祭壇，似乎需要更深的瘋狂才能發揮作用...</p>";
    renderEventStage("理智祭壇", "🧠", body, `<button class="btn-primary" data-action="offer">獻祭</button><button class="btn-secondary" data-action="leave">離開</button>`, (action) => {
      if (action === "offer" && inPhantasm) {
        applySanityLoss(20);
        const item = ItemSystem.generate();
        Inventory.add(item);
        updatePlayerPanel();
      } else if (action === "offer") {
        toast("祭壇沒有反應...", "warn");
      }
      hooks.nextDepth();
    });
  },

  crafting() {
    const mat = Object.values(CONFIG.materials)[Math.floor(Math.random() * Object.values(CONFIG.materials).length)];
    Inventory.add({ id: Date.now() + Math.random(), type: "material", baseName: mat.name, ...mat, rarity: mat.rarity || "common" });
    renderEventStage(
      "廢棄工作台",
      "⚒️",
      `<p>你在廢棄的工作台上找到了一些殘留的素材：<b>${mat.name}</b>。<br>回到「合成」分頁即可查看可用配方。</p>`,
      `<button class="btn-primary" data-action="continue">離開</button>`,
      () => hooks.nextDepth()
    );
  },

  merchant() {
    Merchant.rollStock(Player.depth);
    renderEventStage(
      "流浪商人",
      "👳",
      "<p>「稀客啊，要不要看看我的貨品？」</p>",
      `<button class="btn-secondary" data-action="leave">離開</button>`,
      (action) => {
        if (action === "leave") hooks.nextDepth();
      }
    );
    renderMerchant();
  },
};
