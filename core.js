/* core.js - 核心系統與數據管理 (自動戰鬥適配版) */

/* UI 工具組 */
const UI = {
  // 顯示浮動提示 (Toast)
  toast(msg, type = "info") {
    const c = document.getElementById("toast-container");
    if (!c) return;
    const d = document.createElement("div");
    d.className = `toast ${type}`;
    d.innerHTML = msg;
    c.appendChild(d);

    // 動畫與移除
    setTimeout(() => {
      d.style.opacity = "0";
      d.style.transform = "translateY(-10px)";
      setTimeout(() => d.remove(), 300);
    }, 2000);
  },

  // 確認視窗 (Promise)
  confirm(title, text) {
    return new Promise((res) => {
      const m = document.getElementById("custom-modal");
      if (!m) {
        res(true);
        return;
      } // 若找不到 modal，預設同意

      document.getElementById("modal-title").innerText = title;
      document.getElementById("modal-text").innerHTML = text;

      const btnYes = document.getElementById("modal-btn-yes");
      const btnNo = document.getElementById("modal-btn-no");

      // 重新綁定事件以避免堆疊
      const newYes = btnYes.cloneNode(true);
      const newNo = btnNo.cloneNode(true);
      btnYes.parentNode.replaceChild(newYes, btnYes);
      btnNo.parentNode.replaceChild(newNo, btnNo);

      newYes.onclick = () => {
        m.style.display = "none";
        res(true);
      };
      newNo.onclick = () => {
        m.style.display = "none";
        res(false);
      };

      m.style.display = "flex";
    });
  },

  // 渲染左側玩家狀態面板 (安全版)
  updatePlayerPanel() {
    if (!Player.class) return;

    // 更新數值文字
    const safeSet = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.innerText = val;
    };

    safeSet("header-gold", Player.gold);
    safeSet("stat-hp", `${Math.floor(Player.currentHp)}/${Player.stats.maxHp}`);
    safeSet("stat-atk", Player.stats.atk);
    safeSet("stat-spd", Player.stats.speed);

    // 暴擊率顯示
    const critRate = Math.floor((Player.stats.crit || 0.05) * 100);
    safeSet("stat-crit", `${critRate}%`);

    // 防禦/減傷顯示
    let defText = "";
    if (Player.stats.block > 0)
      defText += `格擋${Math.floor(Player.stats.block * 100)}% `;
    if (Player.stats.dodge > 0)
      defText += `閃避${Math.floor(Player.stats.dodge * 100)}% `;
    if (Player.stats.def > 0)
      defText += `減傷${Math.floor(Player.stats.def * 100)}% `;
    safeSet("stat-def", defText || "0%");

    // 更新裝備圖示
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
          el.onclick = () => {
            if (confirm(`卸下 ${item.name}?`)) Inventory.unequip(slot);
          };

          // Tooltip 內容
          let statsStr = `[${item.name}]\n`;
          for (let k in item.stats) {
            if (item.stats[k] > 0) statsStr += `${k}: +${item.stats[k]}\n`;
          }
          el.title = statsStr;
        } else {
          el.innerHTML =
            slot === "weapon" ? "⚔️" : slot.includes("armor") ? "👕" : "💍";
          el.style.borderColor = "var(--border)";
          el.style.color = "#555";
          el.onclick = null;
          el.title = "空";
        }
      }
    }
  },
};

/* 全局系統與存檔 */
const GlobalSystem = {
  KEY: "rpg_abyss_global",
  data: {
    unlockedRaces: ["human", "elf", "orc", "dwarf", "halfling"],
    unlockedClasses: ["warrior", "thief", "archer", "mage", "cleric"],
    unlockedItems: [],
    maxDepth: 0,
    totalDeaths: 0,
  },
  load() {
    try {
      const d = localStorage.getItem(this.KEY);
      if (d) this.data = { ...this.data, ...JSON.parse(d) };
    } catch (e) {
      console.error("Global load failed", e);
    }
  },
  save() {
    localStorage.setItem(this.KEY, JSON.stringify(this.data));
  },
  registerItem(name) {
    if (!name) return;
    if (!this.data.unlockedItems.includes(name)) {
      this.data.unlockedItems.push(name);
      this.save();
    }
  },
  unlockClass(id) {
    if (!this.data.unlockedClasses.includes(id)) {
      this.data.unlockedClasses.push(id);
      this.save();
      UI.toast(`解鎖新職業: ${CONFIG.classes[id].name}`, "gain");
    }
  },
};

/* 玩家物件 (初始狀態) */
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
  // 核心屬性，會被 recalcPlayerStats 覆蓋
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
  flags: {}, // 用於紀錄特殊事件 (如惡魔契約)
};

/* 物品生成系統 */
const ItemSystem = {
  generate(forcedType = null) {
    const types = [
      "weapon",
      "armor_upper",
      "armor_lower",
      "consumable",
      "material",
    ];
    const type = forcedType || types[Math.floor(Math.random() * types.length)];

    // 生成素材
    if (type === "material") {
      const keys = Object.keys(CONFIG.materials);
      const k = keys[Math.floor(Math.random() * keys.length)];
      return {
        id: Date.now() + Math.random(),
        type: "material",
        baseName: CONFIG.materials[k].name,
        ...CONFIG.materials[k],
        rarity: "common",
      };
    }

    // 決定稀有度
    let rarity = "common";
    const rand = Math.random();
    if (Player.depth > 50 && rand < 0.05) rarity = "legendary";
    else if (Player.depth > 30 && rand < 0.15) rarity = "epic";
    else if (Player.depth > 10 && rand < 0.35) rarity = "rare";
    else if (rand < 0.6) rarity = "uncommon";

    // 獲取物品池 (根據當前區域的套裝)
    const biome =
      CONFIG.biomes[Player.currentBiomeId] || CONFIG.biomes["plains"];
    let pool =
      Math.random() < 0.5 && biome.set
        ? CONFIG.itemPool.sets[biome.set]
        : CONFIG.itemPool.common;
    if (forcedType) pool = pool.filter((i) => i.type === forcedType);
    if (!pool || pool.length === 0) pool = CONFIG.itemPool.common;

    const base = pool[Math.floor(Math.random() * pool.length)];

    let item = {
      id: Date.now() + Math.random().toString().slice(2),
      name: base.name,
      baseName: base.name,
      type: base.type,
      rarity: rarity,
      setId: base.setId,
      stats: {},
    };

    // 如果是消耗品
    if (type === "consumable") {
      item.effect = base.effect;
      item.value = base.value || 10;
      return item;
    }

    // 計算數值 (加上稀有度加成)
    const rInfo = CONFIG.rarity[rarity];
    const mult = rInfo ? rInfo.mult : 1.0;

    if (base.baseAtk) item.stats.atk = Math.floor(base.baseAtk * mult);
    if (base.baseHp) item.stats.maxHp = Math.floor(base.baseHp * mult);
    if (base.baseSpd) item.stats.speed = Math.floor(base.baseSpd * mult);

    // 詞綴系統 (Affixes)
    if (rarity !== "common") {
      const rollAffix = (list) => {
        const valid = list.filter(
          (a) =>
            !a.minRarity ||
            CONFIG.rarity[rarity].mult >= CONFIG.rarity[a.minRarity].mult
        );
        return valid.length
          ? valid[Math.floor(Math.random() * valid.length)]
          : null;
      };

      const prefix =
        Math.random() < 0.5 ? rollAffix(CONFIG.affixes.prefixes) : null;
      const suffix =
        Math.random() < 0.5 ? rollAffix(CONFIG.affixes.suffixes) : null;

      const applyAffix = (affix) => {
        if (!affix) return;
        const m = rInfo.affixMult || 1.2;
        if (affix.type === "atk")
          item.stats.atk = Math.floor(
            (item.stats.atk || 0) * (1 + affix.val * m)
          );
        if (affix.type === "maxHp")
          item.stats.maxHp = Math.floor(
            (item.stats.maxHp || 0) * (1 + affix.val * m)
          );
        if (affix.type === "flat_atk")
          item.stats.atk = (item.stats.atk || 0) + Math.floor(affix.val * m);
        if (affix.type === "flat_hp")
          item.stats.maxHp =
            (item.stats.maxHp || 0) + Math.floor(affix.val * m);
        if (affix.type === "crit")
          item.stats.crit = (item.stats.crit || 0) + affix.val;
      };

      applyAffix(prefix);
      applyAffix(suffix);

      // 重組名稱
      let name = item.name;
      if (prefix) name = `${prefix.name}的${name}`;
      if (suffix) name = `${name}${suffix.name}`;
      item.name = name;
    }

    return item;
  },
};

/* 背包系統 */
const Inventory = {
  add(item) {
    Player.inventory.push(item);
    GlobalSystem.registerItem(item.baseName || item.name);
    // 自動更新 UI (如果是在非戰鬥狀態)
    const invList = document.getElementById("inventory-list");
    if (invList && invList.offsetParent !== null) {
      this.render();
    }
    // 增加一個小紅點或計數更新
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
    // 飾品邏輯：自動找空位
    if (item.type === "accessory") {
      if (!Player.equipment.acc1) slot = "acc1";
      else if (!Player.equipment.acc2) slot = "acc2";
      else if (!Player.equipment.acc3) slot = "acc3";
      else slot = "acc1"; // 預設替換第一個
    }

    // 交換裝備
    if (Player.equipment[slot]) {
      this.add(Player.equipment[slot]);
    }
    Player.equipment[slot] = item;

    // 從背包移除
    this.remove(id);

    // 重新計算屬性
    if (typeof Game !== "undefined" && Game.recalcPlayerStats) {
      Game.recalcPlayerStats();
    }

    this.render();
    UI.updatePlayerPanel();
    StorageSystem.saveGame();
  },

  unequip(slot) {
    const item = Player.equipment[slot];
    if (item) {
      this.add(item);
      Player.equipment[slot] = null;
      if (typeof Game !== "undefined" && Game.recalcPlayerStats) {
        Game.recalcPlayerStats();
      }
      this.render();
      UI.updatePlayerPanel();
      StorageSystem.saveGame();
    }
  },

  use(id) {
    const item = Player.inventory.find((i) => i.id === id);
    if (!item) return;

    if (item.type === "consumable") {
      if (item.effect && item.effect.hp) {
        const heal = item.effect.hp;
        Player.currentHp = Math.min(
          Player.stats.maxHp,
          Player.currentHp + heal
        );
        UI.toast(`恢復了 ${heal} 點生命`, "heal");
        UI.updatePlayerPanel();
      } else {
        UI.toast("使用了物品", "info");
      }
      this.remove(id);
      this.render();
      StorageSystem.saveGame();
    }
  },

  // 渲染背包列表
  render(filter = "all") {
    const l = document.getElementById("inventory-list");
    if (!l) return;
    l.innerHTML = "";

    // 更新計數
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
      const rColor = CONFIG.rarity[item.rarity]
        ? CONFIG.rarity[item.rarity].color
        : "text-common";
      const rBorder = CONFIG.rarity[item.rarity]
        ? CONFIG.rarity[item.rarity].border
        : "border-common";

      div.className = `inv-item ${rBorder}`;

      let actions = "";
      if (item.type === "consumable") {
        actions = `<button class="btn-secondary" onclick="Inventory.use('${item.id}')">使用</button>`;
      } else if (item.type !== "material") {
        actions = `<button class="btn-secondary" onclick="Inventory.equip('${item.id}')">裝備</button>`;
      }

      // 構建屬性描述
      let statsTxt = "";
      if (item.stats) {
        if (item.stats.atk) statsTxt += `攻${item.stats.atk} `;
        if (item.stats.maxHp) statsTxt += `血${item.stats.maxHp} `;
        if (item.stats.crit)
          statsTxt += `暴${(item.stats.crit * 100).toFixed(0)}% `;
      }

      div.innerHTML = `
            <div class="inv-item-info">
                <div class="inv-name ${rColor}">${item.name}</div>
                <div class="inv-meta" style="font-size:0.8em; color:#888;">${
                  statsTxt || item.desc || "無屬性"
                }</div>
            </div>
            <div class="inv-actions">${actions}</div>
        `;
      l.appendChild(div);
    });
  },
};

/* 存檔系統 */
const StorageSystem = {
  SAVE_KEY: "rpg_abyss_v4",

  saveGame(manual = false) {
    if (Player.currentHp <= 0 || !Player.class) return;
    try {
      const data = {
        player: Player,
        global: GlobalSystem.data,
        ts: Date.now(),
      };
      localStorage.setItem(this.SAVE_KEY, JSON.stringify(data));
      if (manual) UI.toast("✅ 進度已保存", "gain");
    } catch (e) {
      console.error("Save failed", e);
    }
  },

  loadGame() {
    try {
      const raw = localStorage.getItem(this.SAVE_KEY);
      if (!raw) return false;
      const d = JSON.parse(raw);

      if (d.player) {
        // 深度合併防止屬性遺失
        Object.assign(Player, d.player);
        // 確保 stats 存在 (舊存檔兼容)
        if (!Player.stats) Player.stats = { ...Player.baseStats };
      }
      if (d.global) GlobalSystem.data = d.global;

      // 載入後立即更新 UI
      UI.updatePlayerPanel();
      return true;
    } catch (e) {
      console.error("Load failed", e);
      return false;
    }
  },

  hardReset() {
    if (confirm("確定要刪除所有進度嗎？此操作無法復原。")) {
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
    UI.toast("存檔代碼已複製！", "gain");
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
      UI.toast("無效的代碼", "warn");
    }
  },
};

/* 製作與商人介面 (簡化版) */
const Crafting = {
  render() {
    const l = document.getElementById("recipe-list");
    if (!l) return;
    l.innerHTML = "";
    CONFIG.recipes.forEach((r) => {
      // 簡單渲染邏輯
      const div = document.createElement("div");
      div.className = "inv-item border-rare";
      // 檢查素材
      let canCraft = true;
      let reqTxt = "";
      for (let k in r.req) {
        const count = Player.inventory.filter(
          (i) => i.baseName === CONFIG.materials[k]?.name
        ).length;
        if (count < r.req[k]) canCraft = false;
        reqTxt += `${CONFIG.materials[k]?.name || k} ${count}/${r.req[k]} `;
      }

      div.innerHTML = `
                <div>
                    <div class="text-rare">${r.name}</div>
                    <div style="font-size:0.8em; color:#888">${reqTxt}</div>
                </div>
                <button ${
                  canCraft ? "" : "disabled"
                } onclick="Crafting.craft('${r.name}')">合成</button>
            `;
      l.appendChild(div);
    });
  },
  craft(name) {
    const r = CONFIG.recipes.find((x) => x.name === name);
    if (!r) return;
    // 扣除素材邏輯 (略，為保持穩定暫時簡化)
    UI.toast("合成功能暫時簡化，請期待更新", "info");
  },
};

const Compendium = {
  render() {
    const l = document.getElementById("compendium-list");
    if (!l) return;
    l.innerHTML = "";
    GlobalSystem.data.unlockedItems.forEach((name) => {
      const d = document.createElement("div");
      d.className = "inv-item border-common";
      d.innerText = name;
      l.appendChild(d);
    });
  },
};

const Blacksmith = { render() {} }; // 佔位符防止報錯
