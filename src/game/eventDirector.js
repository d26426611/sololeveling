import { CONFIG, rollRarity } from "../data/index.js";
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

// 從一組 key 裡挑符合條件的其中一個；沒有符合條件的就回傳 null，呼叫端自行決定 fallback。
function randOfKeys(keys, predicate) {
  const pool = keys.filter(predicate);
  if (!pool.length) return null;
  return pool[Math.floor(Math.random() * pool.length)];
}

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
    const karma = Player.karma || 0;
    renderEventStage(
      "惡魔契約",
      "📜",
      `<p>陰影中傳來低語：「獻上你的靈魂，換取力量吧...」惡魔的眼中閃過算計的光——你已經背負了 <b>${karma}</b> 點業力，它似乎格外中意你。</p>
       <p>接受後，死亡時你將不會真正消逝，而是墮入無間煉獄，用永劫的刑罰償還這份契約。</p>`,
      `<button class="btn-danger" data-action="accept">簽下契約</button><button class="btn-secondary" data-action="reject">轉身離去</button>`,
      (action) => {
        if (action === "accept") {
          Player.flags.mark_of_sin = true;
          recalcAndRefresh();
          toast("獲得【罪惡印記】：死亡不再是終點，而是墮入煉獄的開始", "warn");
        } else {
          toast("你別過頭，假裝沒聽見那陣低語", "sys");
        }
        hooks.nextDepth();
      }
    );
  },

  sanity_altar() {
    const inPhantasm = Player.currentWorld === "phantasm";
    const body = inPhantasm
      ? `<p>祭壇上刻著無法理解的符文，隨著你的凝視緩緩扭曲。獻上理智似乎能換取禁忌的知識與力量，但瘋狂的代價從不打折。</p>
         <p>目前理智：<b>${Player.sanity}</b>/100</p>`
      : "<p>一座蒙塵的祭壇，符文早已風化，似乎需要更深的瘋狂才能發揮作用。你伸手觸碰了一下冰冷的石面。</p>";
    renderEventStage(
      "理智祭壇",
      "🧠",
      body,
      `<button class="btn-primary" data-action="offer">獻祭理智</button><button class="btn-secondary" data-action="leave">轉身離開</button>`,
      (action) => {
        if (action === "offer" && inPhantasm) {
          applySanityLoss(20);
          const item = ItemSystem.generate();
          Inventory.add(item);
          toast(`祭壇低語著禁忌的知識，你獲得了 ${item.name}`, "gain");
          updatePlayerPanel();
        } else if (action === "offer") {
          const dmg = Math.floor(Player.stats.maxHp * 0.05);
          Player.currentHp = Math.max(1, Player.currentHp - dmg);
          toast(`一股寒意竄過全身，你受到了 ${dmg} 點傷害——這座祭壇尚未甦醒`, "warn");
          updatePlayerPanel();
        }
        hooks.nextDepth();
      }
    );
  },

  crafting() {
    const materialKeys = Object.keys(CONFIG.materials);
    const commonKey = randOfKeys(materialKeys, (k) => (CONFIG.materials[k].rarity || "common") === "common") || materialKeys[0];
    const commonMat = CONFIG.materials[commonKey];

    renderEventStage(
      "廢棄工作台",
      "⚒️",
      `<p>一座廢棄的工作台，上面散落著殘留的素材。你可以隨手撿起看得見的東西，或是花點時間仔細翻找——但翻找可能會被銳利的殘骸割傷。</p>`,
      `<button class="btn-secondary" data-action="quick">隨手撿起</button><button class="btn-primary" data-action="search">仔細翻找</button>`,
      (action) => {
        if (action === "search") {
          if (Math.random() < 0.7) {
            const targetRarity = rollRarity((Player.depth || 0) + 20, Player.currentWorld);
            const key = randOfKeys(materialKeys, (k) => (CONFIG.materials[k].rarity || "common") === targetRarity) || commonKey;
            const mat = CONFIG.materials[key];
            Inventory.add({ id: Date.now() + Math.random(), type: "material", baseName: mat.name, ...mat, rarity: mat.rarity || "common" });
            toast(`翻找到了品質更好的素材：${mat.name}`, "gain");
          } else {
            const dmg = 5 + Math.floor(Player.depth * 0.3);
            Player.currentHp = Math.max(1, Player.currentHp - dmg);
            toast(`被銳利的殘骸割傷，受到 ${dmg} 點傷害，但兩手空空`, "warn");
            updatePlayerPanel();
          }
        } else {
          Inventory.add({ id: Date.now() + Math.random(), type: "material", baseName: commonMat.name, ...commonMat, rarity: commonMat.rarity || "common" });
          toast(`撿到了 ${commonMat.name}`, "gain");
        }
        hooks.nextDepth();
      }
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
