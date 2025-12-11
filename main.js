/* core.js - 核心與存檔管理 (防呆修復版) */

const UI = {
  toast(msg, type = "info") {
    const c = document.getElementById("toast-container");
    if (!c) return;
    const d = document.createElement("div");
    d.className = `toast ${type}`;
    d.innerHTML = msg;
    c.appendChild(d);
    setTimeout(() => {
      d.style.opacity = "0";
      d.style.transform = "translateY(-10px)";
      setTimeout(() => d.remove(), 300);
    }, 2000);
  },

  updatePlayerPanel() {
    if (!Player.class) return;

    const safeSet = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.innerText = val;
    };

    safeSet("header-gold", Player.gold);
    safeSet("stat-hp", `${Math.floor(Player.currentHp)}/${Player.stats.maxHp}`);
    safeSet("stat-atk", Player.stats.atk);
    safeSet("stat-spd", Player.stats.speed);

    const critRate = Math.floor((Player.stats.crit || 0.05) * 100);
    safeSet("stat-crit", `${critRate}%`);

    let defText = "";
    if (Player.stats.block > 0)
      defText += `格擋${Math.floor(Player.stats.block * 100)}% `;
    if (Player.stats.dodge > 0)
      defText += `閃避${Math.floor(Player.stats.dodge * 100)}% `;
    if (Player.stats.def > 0)
      defText += `減傷${Math.floor(Player.stats.def * 100)}% `;
    safeSet("stat-def", defText || "0%");

    // 特殊數值
    const sanityRow = document.getElementById("stat-sanity-row");
    const karmaRow = document.getElementById("stat-karma-row");

    if (Player.currentWorld === "phantasm" && sanityRow) {
      sanityRow.style.display = "flex";
      document.getElementById("stat-sanity").innerText = Player.sanity;
    } else if (sanityRow) {
      sanityRow.style.display = "none";
    }

    if (Player.currentWorld === "purgatory" && karmaRow) {
      karmaRow.style.display = "flex";
      document.getElementById("stat-karma").innerText = Player.karma;
    } else if (karmaRow) {
      karmaRow.style.display = "none";
    }

    // 裝備圖示
    for (let slot in Player.equipment) {
      const el = document.querySelector(`.mini-slot[data-slot="${slot}"]`);
      const item = Player.equipment[slot];
      if (el) {
        if (item) {
          el.innerHTML =
            item.type === "weapon"
              ? "⚔️"
              : item.type.includes("armor")
              ? "👕"
              : "💍";
          el.style.borderColor = `var(--rarity-${item.rarity})`;
          el.style.color = `var(--rarity-${item.rarity})`;
          if (item.setId) el.style.boxShadow = "0 0 5px var(--rarity-common)";
          else el.style.boxShadow = "none";

          el.onclick = () => {
            if (confirm(`卸下 ${item.name}?`)) Inventory.unequip(slot);
          };

          let statsStr = `[${item.name}]\n`;
          if (item.setId && CONFIG.sets[item.setId])
            statsStr += `【${CONFIG.sets[item.setId].name}套裝】\n`;
          for (let k in item.stats) {
            if (item.stats[k] !== 0)
              statsStr += `${k}: ${item.stats[k] > 0 ? "+" : ""}${
                item.stats[k]
              }\n`;
          }
          el.title = statsStr;
        } else {
          el.innerHTML =
            slot === "weapon" ? "⚔️" : slot.includes("armor") ? "👕" : "💍";
          el.style.borderColor = "var(--border)";
          el.style.color = "#555";
          el.style.boxShadow = "none";
          el.onclick = null;
          el.title = "空";
        }
      }
    }

    const setDiv = document.getElementById("active-sets");
    if (setDiv) {
      let txt = [];
      for (let sid in Player.activeSets) {
        const count = Player.activeSets[sid];
        if (count >= 2 && CONFIG.sets[sid]) {
          txt.push(`${CONFIG.sets[sid].name}(${count})`);
        }
      }
      setDiv.innerText = txt.join(", ");
    }
  },
};

/* 全局系統與存檔 (修復版) */
const GlobalSystem = {
  KEY: "rpg_abyss_global_v2",
  // 預設值
  defaultData: {
    unlockedRaces: ["human", "elf", "orc", "dwarf", "halfling"],
    unlockedClasses: ["warrior", "thief", "archer", "mage", "cleric"],
    discoveredItems: [],
    maxDepth: 0,
    totalDeaths: 0,
    legacyItem: null,
  },
  data: {},

  init() {
    this.data = JSON.parse(JSON.stringify(this.defaultData)); // Deep copy default
    this.load();
  },

  load() {
    try {
      const d = localStorage.getItem(this.KEY);
      if (d) {
        const loaded = JSON.parse(d);
        // 合併讀取的資料與預設資料 (防止 undefined)
        this.data = { ...this.defaultData, ...loaded };

        // 雙重保險：確保陣列存在
        if (!this.data.unlockedRaces)
          this.data.unlockedRaces = [...this.defaultData.unlockedRaces];
        if (!this.data.unlockedClasses)
          this.data.unlockedClasses = [...this.defaultData.unlockedClasses];
      }
    } catch (e) {
      console.error("Global load failed, using defaults", e);
      this.data = JSON.parse(JSON.stringify(this.defaultData));
    }
  },

  save() {
    localStorage.setItem(this.KEY, JSON.stringify(this.data));
  },
  unlockItem(name) {
    if (!this.data.discoveredItems) this.data.discoveredItems = [];
    if (!this.data.discoveredItems.includes(name)) {
      this.data.discoveredItems.push(name);
      this.save();
    }
  },
  unlockClass(id) {
    if (!this.data.unlockedClasses.includes(id)) {
      this.data.unlockedClasses.push(id);
      this.save();
      UI.toast(`解鎖新職業：${CONFIG.classes[id].name}`, "gain");
    }
  },
  unlockLegacy(race, cls) {
    let changed = false;
    if (race && !this.data.unlockedRaces.includes(race)) {
      this.data.unlockedRaces.push(race);
      changed = true;
    }
    if (cls && !this.data.unlockedClasses.includes(cls)) {
      this.data.unlockedClasses.push(cls);
      changed = true;
    }
    if (changed) {
      this.save();
      alert(`【傳承解鎖】\n下周目已開放種族/職業！`);
    }
  },
  storeLegacyItem(item) {
    this.data.legacyItem = item;
    this.save();
    UI.toast("裝備已存入時空膠囊", "gain");
  },
  retrieveLegacyItem() {
    if (this.data.legacyItem) {
      const item = this.data.legacyItem;
      this.data.legacyItem = null;
      this.save();
      return item;
    }
    return null;
  },
};

const Player = {
  name: "勇者",
  race: null,
  class: null,
  depth: 0,
  gold: 0,
  currentHp: 100,
  currentBiomeId: "plains",
  currentWorld: "normal",
  sanity: 100,
  karma: 0,
  stats: {
    maxHp: 100,
    atk: 10,
    speed: 100,
    crit: 0.05,
    def: 0,
    dodge: 0,
    block: 0,
    lifesteal: 0,
    hp_regen: 0,
  },
  baseStats: { maxHp: 100, atk: 10, speed: 100 },
  inventory: [],
  equipment: {
    weapon: null,
    armor_upper: null,
    armor_lower: null,
    acc1: null,
    acc2: null,
    acc3: null,
  },
  activeSets: {},
  flags: {},
  records: { luckyEventStreak: 0, unarmedWins: 0 },
};

/* 物品生成系統 */
const ItemSystem = {
  generate(forcedType = null) {
    const types = [
      "weapon",
      "armor_upper",
      "armor_lower",
      "accessory",
      "material",
    ];
    const type = forcedType || types[Math.floor(Math.random() * types.length)];

    if (type === "material") {
      const keys = Object.keys(CONFIG.materials);
      const k = keys[Math.floor(Math.random() * keys.length)];
      return {
        id: Date.now() + Math.random(),
        type: "material",
        baseName: CONFIG.materials[k].name,
        ...CONFIG.materials[k],
        rarity: CONFIG.materials[k].rarity || "common",
      };
    }

    const biome =
      CONFIG.biomes[Player.currentBiomeId] || CONFIG.biomes["plains"];
    let pool = [];
    if (Math.random() < 0.5 && biome.set && CONFIG.itemPool.sets[biome.set]) {
      pool = CONFIG.itemPool.sets[biome.set];
    }
    if (!pool || pool.length === 0) pool = CONFIG.itemPool.common;

    if (forcedType) pool = pool.filter((i) => i.type === forcedType);
    if (pool.length === 0) pool = CONFIG.itemPool.common;

    const base = pool[Math.floor(Math.random() * pool.length)];

    let rarity = "common";
    const rand = Math.random();
    if (Player.currentWorld === "purgatory")
      rarity = rand < 0.2 ? "abyssal" : "legendary";
    else if (Player.currentWorld === "phantasm")
      rarity = rand < 0.2 ? "phantasm" : "epic";
    else {
      if (Player.depth > 100 && rand < 0.05) rarity = "legendary";
      else if (Player.depth > 50 && rand < 0.15) rarity = "epic";
      else if (Player.depth > 20 && rand < 0.35) rarity = "rare";
      else if (rand < 0.6) rarity = "uncommon";
    }
    if (base.rarity) rarity = base.rarity;

    let item = {
      id: Date.now() + Math.random().toString().slice(2),
      name: base.name,
      baseName: base.name,
      type: base.type,
      subtype: base.subtype,
      rarity: rarity,
      setId: base.setId,
      desc: base.desc,
      stats: {},
    };

    if (base.baseAtk) item.stats.atk = base.baseAtk;
    if (base.baseHp) item.stats.maxHp = base.baseHp;
    if (base.baseSpd) item.stats.speed = base.baseSpd;
    if (base.baseDef) item.stats.def = base.baseDef;
    if (base.baseCrit) item.stats.crit = base.baseCrit;

    const rInfo = CONFIG.rarity[rarity];
    const mult = rInfo ? rInfo.mult : 1.0;

    for (let k in item.stats) {
      if (!["def", "crit", "dodge", "block"].includes(k)) {
        item.stats[k] = Math.floor(item.stats[k] * mult);
      }
    }

    if (rarity !== "common" && rarity !== "abyssal" && rarity !== "phantasm") {
      const prefix =
        Math.random() < 0.6
          ? CONFIG.affixes.prefixes[
              Math.floor(Math.random() * CONFIG.affixes.prefixes.length)
            ]
          : null;
      const suffix =
        Math.random() < 0.6
          ? CONFIG.affixes.suffixes[
              Math.floor(Math.random() * CONFIG.affixes.suffixes.length)
            ]
          : null;

      let nameParts = [];
      if (prefix) {
        nameParts.push(prefix.name);
        if (prefix.type && prefix.val) {
          let key = prefix.type;
          let val = prefix.val;
          if (["atk", "maxHp", "speed"].includes(key) && val < 2) {
            item.stats[key] = Math.floor((item.stats[key] || 10) * (1 + val));
          } else {
            item.stats[key] = (item.stats[key] || 0) + val;
          }
        }
      }
      nameParts.push(base.name);
      if (suffix) {
        nameParts.push(suffix.name);
        if (suffix.type && suffix.val) {
          let key = suffix.type.replace("flat_", "");
          item.stats[key] = (item.stats[key] || 0) + suffix.val;
        }
      }
      item.name = nameParts.join("");
    }
    return item;
  },
};

const Inventory = {
  add(item) {
    Player.inventory.push(item);
    GlobalSystem.unlockItem(item.baseName || item.name);
    const invList = document.getElementById("inventory-list");
    if (invList && invList.offsetParent !== null) this.render();
    const countEl = document.getElementById("inv-count");
    if (countEl) countEl.innerText = `${Player.inventory.length}`;
  },
  remove(id) {
    Player.inventory = Player.inventory.filter((i) => i.id !== id);
  },
  equip(id) {
    const item = Player.inventory.find((i) => i.id === id);
    if (!item) return;
    let slot = item.type;
    if (item.type === "accessory") {
      if (!Player.equipment.acc1) slot = "acc1";
      else if (!Player.equipment.acc2) slot = "acc2";
      else if (!Player.equipment.acc3) slot = "acc3";
      else slot = "acc1";
    }
    if (Player.equipment[slot]) this.add(Player.equipment[slot]);
    Player.equipment[slot] = item;
    this.remove(id);
    if (typeof Game !== "undefined") Game.recalcPlayerStats();
    this.render();
    UI.updatePlayerPanel();
    StorageSystem.saveGame();
  },
  unequip(slot) {
    const item = Player.equipment[slot];
    if (item) {
      this.add(item);
      Player.equipment[slot] = null;
      if (typeof Game !== "undefined") Game.recalcPlayerStats();
      this.render();
      UI.updatePlayerPanel();
      StorageSystem.saveGame();
    }
  },
  use(id) {
    const item = Player.inventory.find((i) => i.id === id);
    if (!item) return;
    if (item.type === "consumable") {
      if (item.effect) {
        if (item.effect.hp) {
          const heal = item.effect.hp;
          Player.currentHp = Math.min(
            Player.stats.maxHp,
            Player.currentHp + heal
          );
          UI.toast(`恢復了 ${heal} HP`, "heal");
        }
        if (item.effect.open_world && typeof Game !== "undefined") {
          Game.enterWorld(item.effect.open_world);
        }
      }
      this.remove(id);
      UI.updatePlayerPanel();
      this.render();
      StorageSystem.saveGame();
    }
  },
  render(filter = "all") {
    const l = document.getElementById("inventory-list");
    if (!l) return;
    l.innerHTML = "";
    const countEl = document.getElementById("inv-count");
    if (countEl) countEl.innerText = `${Player.inventory.length} | ✨0`;

    let list = Player.inventory;
    if (filter === "equip")
      list = list.filter((i) =>
        ["weapon", "armor_upper", "armor_lower", "accessory"].includes(i.type)
      );
    if (filter === "mat")
      list = list.filter((i) => ["material", "consumable"].includes(i.type));

    if (list.length === 0) {
      l.innerHTML =
        "<div style='color:#666; text-align:center; padding:20px;'>背包是空的</div>";
      return;
    }

    list.forEach((item) => {
      const div = document.createElement("div");
      const rColor = `var(--rarity-${item.rarity || "common"})`;
      div.className = "inv-item";
      div.style.borderLeft = `4px solid ${rColor}`;
      let meta = item.desc || "";
      if (item.stats) {
        let s = [];
        if (item.stats.atk) s.push(`攻${item.stats.atk}`);
        if (item.stats.maxHp) s.push(`血${item.stats.maxHp}`);
        if (s.length > 0) meta = s.join(" ");
      }
      let btn = "";
      if (item.type === "consumable")
        btn = `<button class="btn-secondary" onclick="Inventory.use('${item.id}')">使用</button>`;
      else if (item.type !== "material")
        btn = `<button class="btn-secondary" onclick="Inventory.equip('${item.id}')">裝備</button>`;

      div.innerHTML = `
            <div class="inv-item-info">
                <div class="inv-name" style="color:${rColor}">${item.name}</div>
                <div class="inv-meta">${meta}</div>
            </div>
            <div class="inv-actions">${btn}</div>
        `;
      l.appendChild(div);
    });
  },
};

const StorageSystem = {
  SAVE_KEY: "rpg_abyss_v5_fixed",
  saveGame(manual = false) {
    if (Player.currentHp <= 0 || !Player.class) return;
    const data = { player: Player, global: GlobalSystem.data, ts: Date.now() };
    localStorage.setItem(this.SAVE_KEY, JSON.stringify(data));
    if (manual) UI.toast("✅ 進度已保存", "gain");
  },
  loadGame() {
    try {
      const raw = localStorage.getItem(this.SAVE_KEY);
      if (!raw) return false;
      const d = JSON.parse(raw);
      if (d.player) Object.assign(Player, d.player);
      if (d.global)
        GlobalSystem.data = { ...GlobalSystem.defaultData, ...d.global }; // 合併防呆
      if (!Player.stats) Player.stats = { ...Player.baseStats }; // 確保 stats 存在
      UI.updatePlayerPanel();
      return true;
    } catch (e) {
      return false;
    }
  },
  hardReset() {
    if (confirm("確定要刪除進度嗎？")) {
      localStorage.removeItem(this.SAVE_KEY);
      location.reload();
    }
  },
  exportSave() {
    const code = btoa(
      encodeURIComponent(
        JSON.stringify({ player: Player, global: GlobalSystem.data })
      )
    );
    const area = document.getElementById("save-code-area");
    area.value = code;
    area.select();
    document.execCommand("copy");
    UI.toast("代碼已複製", "gain");
  },
  importSave() {
    const area = document.getElementById("save-code-area");
    if (!area.value) return UI.toast("請貼上代碼", "warn");
    try {
      const d = JSON.parse(decodeURIComponent(atob(area.value)));
      if (d.player) {
        Object.assign(Player, d.player);
        GlobalSystem.data = d.global;
        this.saveGame(true);
        setTimeout(() => location.reload(), 500);
      }
    } catch (e) {
      UI.toast("無效代碼", "warn");
    }
  },
};

const Crafting = {
  render() {
    const l = document.getElementById("recipe-list");
    if (!l) return;
    l.innerHTML = "";
    // 防呆：確保 discoveredItems 存在
    const discovered = GlobalSystem.data.discoveredItems || [];

    CONFIG.recipes.forEach((r) => {
      const mats = Object.keys(r.req);
      const known = mats.some(
        (mKey) =>
          mKey !== "gold" && discovered.includes(CONFIG.materials[mKey]?.name)
      );
      if (!known && mats.length > 0) return;

      const div = document.createElement("div");
      div.className = "inv-item border-rare";
      let canCraft = true;
      let reqHtml = [];
      for (let mKey in r.req) {
        if (mKey === "gold") {
          const has = Player.gold;
          const need = r.req[mKey];
          if (has < need) canCraft = false;
          reqHtml.push(
            `<span class="${
              has >= need ? "text-common" : "text-uncommon"
            }">${need}G</span>`
          );
        } else {
          const matName = CONFIG.materials[mKey]
            ? CONFIG.materials[mKey].name
            : mKey;
          const has = Player.inventory.filter(
            (i) => i.baseName === matName
          ).length;
          const need = r.req[mKey];
          if (has < need) canCraft = false;
          reqHtml.push(
            `<span class="${
              has >= need ? "text-common" : "text-uncommon"
            }">${matName} ${has}/${need}</span>`
          );
        }
      }
      div.innerHTML = `
                <div style="flex:1"><div class="text-rare" style="font-weight:bold">${
                  r.name
                }</div>
                <div style="font-size:0.8em; color:#aaa">${r.desc}</div>
                <div style="font-size:0.8em; margin-top:4px;">${reqHtml.join(
                  ", "
                )}</div></div>
                <button ${
                  canCraft ? "" : "disabled"
                } onclick="Crafting.craft('${
        r.name
      }')" class="btn-primary">合成</button>
            `;
      l.appendChild(div);
    });
    if (l.innerHTML === "")
      l.innerHTML =
        "<div style='text-align:center; padding:20px; color:#666'>收集素材以解鎖配方...</div>";
  },
  craft(rName) {
    const r = CONFIG.recipes.find((x) => x.name === rName);
    if (!r) return;
    for (let mKey in r.req) {
      if (mKey === "gold") Player.gold -= r.req[mKey];
      else {
        const matName = CONFIG.materials[mKey].name;
        for (let i = 0; i < r.req[mKey]; i++) {
          const idx = Player.inventory.findIndex((x) => x.baseName === matName);
          if (idx > -1) Player.inventory.splice(idx, 1);
        }
      }
    }
    let item = {
      id: Date.now(),
      name: r.name,
      type: r.type,
      rarity: "epic",
      stats: { ...r.stats },
      setId: r.setId,
      desc: r.desc,
    };
    if (r.type === "consumable") item.effect = r.effect;
    Inventory.add(item);
    UI.toast(`合成成功：${r.name}`, "gain");
    this.render();
    UI.updatePlayerPanel();
  },
};

const Compendium = {
  render() {
    const l = document.getElementById("compendium-list");
    if (!l) return;
    l.innerHTML = "";
    const items = GlobalSystem.data.discoveredItems || [];
    if (items.length === 0) {
      l.innerHTML = "<div style='text-align:center;color:#666'>尚無紀錄</div>";
      return;
    }
    items.forEach((name) => {
      const d = document.createElement("div");
      d.className = "inv-item";
      d.innerHTML = `<div class="inv-name text-common">${name}</div>`;
      l.appendChild(d);
    });
  },
};
const Blacksmith = { render() {} };
