/* UI */
const UI = {
  toast(msg, type = "info") {
    const c = document.getElementById("toast-container");
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
  confirm(title, text) {
    return new Promise((res) => {
      const m = document.getElementById("custom-modal");
      document.getElementById("modal-title").innerText = title;
      document.getElementById("modal-text").innerHTML = text;
      const y = document.getElementById("modal-btn-yes").cloneNode(true);
      const n = document.getElementById("modal-btn-no").cloneNode(true);
      document.getElementById("modal-btn-yes").replaceWith(y);
      document.getElementById("modal-btn-no").replaceWith(n);
      y.onclick = () => {
        m.style.display = "none";
        res(true);
      };
      n.onclick = () => {
        m.style.display = "none";
        res(false);
      };
      m.style.display = "flex";
    });
  },
  showDamage(tid, val, type = "damage") {
    const t = document.getElementById(`unit-${tid}`);
    if (!t) return;
    const e = document.createElement("div");
    e.className = "floating-text";
    e.innerText = val;
    e.style.color =
      type === "heal" ? "#66bb6a" : type === "crit" ? "#ffeb3b" : "#ef5350";
    if (type === "crit") e.style.fontSize = "1.8rem";
    t.appendChild(e);
    setTimeout(() => e.remove(), 800);
  },
  shake(tid) {
    const e = document.getElementById(`unit-${tid}`);
    if (e) {
      e.classList.remove("shake-anim");
      void e.offsetWidth;
      e.classList.add("shake-anim");
    }
  },
};

/* Global & Player */
const GlobalSystem = {
  KEY: "rpg_abyss_global",
  data: {
    unlockedRaces: ["human", "elf", "orc", "dwarf", "halfling"],
    unlockedClasses: ["warrior", "thief", "archer", "mage", "cleric"],
    unlockedItems: [], // Compendium data
    maxDepth: 0,
    totalDeaths: 0,
  },
  load() {
    try {
      const d = localStorage.getItem(this.KEY);
      if (d) this.data = { ...this.data, ...JSON.parse(d) };
    } catch (e) {}
  },
  save() {
    localStorage.setItem(this.KEY, JSON.stringify(this.data));
  },
  unlockClass(id) {
    if (!this.data.unlockedClasses.includes(id)) {
      this.data.unlockedClasses.push(id);
      this.save();
      UI.toast(`解鎖新職業：${CONFIG.classes[id].name}`, "gain");
    }
  },
  registerItem(baseName) {
    if (!baseName) return;
    if (!this.data.unlockedItems.includes(baseName)) {
      this.data.unlockedItems.push(baseName);
      this.save();
    }
  },
  checkLegacy(inv) {
    if (inv.some((i) => i.name === "靈魂定錨")) {
      if (!this.data.unlockedRaces.includes(Player.race))
        this.data.unlockedRaces.push(Player.race);
      if (!this.data.unlockedClasses.includes(Player.class))
        this.data.unlockedClasses.push(Player.class);
      this.save();
      UI.toast("⚓ 靈魂定錨生效", "gain");
    }
  },
};

const Player = {
  name: "勇者",
  race: null,
  class: null,
  depth: 0,
  gold: 0,
  currentHp: 50,
  actionGauge: 0,
  currentBiomeId: "plains",
  biomeOrder: [],
  biomeStartDepth: 1,
  currentWorld: "normal",
  sanity: 100,
  karma: 0,
  stats: {
    maxHp: 50,
    atk: 5,
    speed: 100,
    crit: 0.05,
    dodge: 0,
    block: 0,
    lifesteal: 0,
    hp_regen: 0,
  },
  baseStats: { maxHp: 50, atk: 5, speed: 100 },
  magic_dust: 0,
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
};

/* Item */
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

    let pool =
      Math.random() < 0.5
        ? CONFIG.itemPool.sets[CONFIG.biomes[Player.currentBiomeId].set]
        : CONFIG.itemPool.common;
    if (forcedType) pool = pool.filter((i) => i.type === forcedType);
    if (!pool || !pool.length) pool = CONFIG.itemPool.common;

    const base = pool[Math.floor(Math.random() * pool.length)];
    const rand = Math.random();
    let rarity = "common";

    if (Player.currentWorld === "phantasm") {
      if (rand < 0.1) rarity = "phantasm";
      else if (rand < 0.3) rarity = "legendary";
      else if (rand < 0.6) rarity = "epic";
      else rarity = "rare";
    } else {
      if (rand < 0.05 && Player.depth >= 60) rarity = "legendary";
      else if (rand < 0.15 && Player.depth >= 30) rarity = "epic";
      else if (rand < 0.35 && Player.depth >= 10) rarity = "rare";
      else if (rand < 0.6) rarity = "uncommon";
    }

    let rInfo = CONFIG.rarity[rarity];
    if (!rInfo) {
      if (rarity === "phantasm") {
        rInfo = {
          name: "幻影",
          color: "text-phantasm",
          border: "border-phantasm",
          mult: 10.0,
          affixMult: 10.0,
        };
      } else {
        rarity = "common";
        rInfo = CONFIG.rarity.common;
      }
    }

    let item = {
      id: Date.now() + Math.random().toString().slice(2),
      name: base.name,
      baseName: base.name,
      type: base.type,
      rarity,
      setId: base.setId,
      stats: {},
    };
    if (type === "consumable") {
      item.effect = base.effect;
      item.value = base.value || 5;
      return item;
    }

    let s = { maxHp: 0, atk: 0, speed: 0 };
    if (base.baseAtk) s.atk = base.baseAtk;
    if (base.baseHp) s.maxHp = base.baseHp;
    if (base.baseSpd) s.speed = base.baseSpd;

    if (rarity !== "common") {
      const roll = (k) => {
        const v = CONFIG.affixes[k].filter(
          (a) =>
            !a.minRarity ||
            [
              "common",
              "uncommon",
              "rare",
              "epic",
              "legendary",
              "phantasm",
            ].indexOf(rarity) >=
              [
                "common",
                "uncommon",
                "rare",
                "epic",
                "legendary",
                "phantasm",
              ].indexOf(a.minRarity)
        );
        return v.length ? v[Math.floor(Math.random() * v.length)] : null;
      };

      let p = Math.random() < 0.6 ? roll("prefixes") : null;
      let suf = Math.random() < 0.6 ? roll("suffixes") : null;
      if (
        (rarity === "epic" ||
          rarity === "legendary" ||
          rarity === "phantasm") &&
        !p &&
        !suf
      )
        p = roll("prefixes");

      const app = (a) => {
        if (!a) return;
        const m = rInfo.affixMult || rInfo.mult;
        if (a.type === "atk") s.atk *= 1 + a.val * m;
        if (a.type === "maxHp") s.maxHp *= 1 + a.val * m;
        if (a.type === "speed") s.speed *= 1 + a.val * m;
        if (a.type === "flat_atk") s.atk += a.val * m;
        if (a.type === "flat_hp") s.maxHp += a.val * m;
        if (a.type === "flat_spd") s.speed += a.val * m;
        if (a.type === "lifesteal")
          item.stats.lifesteal = (item.stats.lifesteal || 0) + a.val * m;
        if (a.type === "hp_regen")
          item.stats.hp_regen = (item.stats.hp_regen || 0) + a.val * m;
        if (a.type === "all_pct") {
          s.atk *= 1 + a.val * m;
          s.maxHp *= 1 + a.val * m;
        }
      };
      app(p);
      app(suf);

      let nameParts = [];
      if (p) nameParts.push(p.name);
      if (suf) nameParts.push(suf.name);
      let finalName = item.name;
      if (nameParts.length > 0) {
        if (p && suf) finalName = `${p.name}之${suf.name}的${item.name}`;
        else if (p) finalName = `${p.name}的${item.name}`;
        else if (suf) finalName = `${suf.name}的${item.name}`;
      }
      if (rarity === "legendary") finalName = `★ ${finalName}`;
      if (rarity === "phantasm") finalName = `☠️ ${finalName}`;
      item.name = finalName;
    }

    for (let k in s)
      if (s[k] !== 0) item.stats[k] = Math.floor(s[k] * rInfo.mult);
    return item;
  },
};

/* Inventory & Crafting */
const Inventory = {
  add(i) {
    Player.inventory.push(i);
    if (i.baseName) GlobalSystem.registerItem(i.baseName);
    else GlobalSystem.registerItem(i.name);
    UI.toast(
      `獲得：<span class="${
        (CONFIG.rarity[i.rarity] || { color: "text-common" }).color
      }">${i.name}</span>`,
      "gain"
    );
  },
  remove(id) {
    Player.inventory = Player.inventory.filter((i) => i.id !== id);
  },
  disassemble(id) {
    const i = Player.inventory.find((x) => x.id === id);
    if (!i) return;

    let dust = 0;
    if (i.rarity === "common") dust = 1;
    else if (i.rarity === "uncommon") dust = 3;
    else if (i.rarity === "rare") dust = 10;
    else if (i.rarity === "epic") dust = 50;
    else if (i.rarity === "legendary") dust = 200;
    else if (i.rarity === "phantasm") dust = 1000;

    if (dust > 0) {
      Player.magic_dust = (Player.magic_dust || 0) + dust;
      UI.toast(`分解獲得 ${dust} ✨魔塵`, "gain");
      this.remove(id);
      this.render();
      Game.updateHeader();
      StorageSystem.saveGame();
    } else {
      UI.toast("此物品無法分解", "warn");
    }
  },
  countMat(k) {
    if (k === "gold") return Player.gold;
    if (!CONFIG.materials[k]) return 0;
    return Player.inventory.filter(
      (i) => i.type === "material" && i.name === CONFIG.materials[k].name
    ).length;
  },
  removeMat(k, n) {
    if (k === "gold") {
      Player.gold = Math.max(0, Player.gold - n);
      return;
    }
    if (!CONFIG.materials[k]) return;
    for (let i = 0; i < n; i++) {
      const idx = Player.inventory.findIndex(
        (x) => x.name === CONFIG.materials[k].name
      );
      if (idx !== -1) Player.inventory.splice(idx, 1);
    }
  },
  equip(id) {
    const i = Player.inventory.find((x) => x.id === id);
    if (!i) return;
    let slot = i.type;
    if (i.type === "accessory")
      slot = !Player.equipment.acc1
        ? "acc1"
        : !Player.equipment.acc2
        ? "acc2"
        : !Player.equipment.acc3
        ? "acc3"
        : "acc1";
    if (Player.equipment[slot]) this.add(Player.equipment[slot]);
    Player.equipment[slot] = i;
    this.remove(id);
    Game.recalcPlayerStats();
    this.render();
    StorageSystem.saveGame();
  },
  unequip(slot) {
    const i = Player.equipment[slot];
    if (i) {
      this.add(i);
      Player.equipment[slot] = null;
      Game.recalcPlayerStats();
      this.render();
      StorageSystem.saveGame();
    }
  },
  use(id) {
    const i = Player.inventory.find((x) => x.id === id);
    if (!i) return;

    if (i.type === "consumable") {
      if (i.effect && i.effect.open_world) {
        Game.enterWorld(i.effect.open_world);
        this.remove(id);
        this.render();
        return;
      }
      if (i.effect && i.effect.hp) {
        if (Player.currentWorld === "purgatory")
          return UI.toast("煉獄中無法回復！", "warn");
        if (Player.race === "undead")
          return UI.toast("亡靈無法使用藥水！", "warn");
        let h = i.effect.hp;
        if (Player.class === "cleric" || Player.class === "paladin")
          h = Math.floor(h * 1.5);
        Player.currentHp = Math.min(Player.stats.maxHp, Player.currentHp + h);
        UI.toast(`回復 ${h} HP`, "heal");
        UI.showDamage("player", `+${h}`, "heal");
        this.remove(id);
        this.render();
        StorageSystem.saveGame();
      }
    }
  },
  render(filter = "all") {
    for (let s in Player.equipment) {
      const i = Player.equipment[s];
      const el = document.querySelector(`.mini-slot[data-slot="${s}"]`);
      if (el) {
        el.onclick = () => {
          if (i && confirm(`卸下 ${i.name}?`)) this.unequip(s);
        };
        if (i) {
          el.innerHTML =
            i.type === "weapon" ? "⚔️" : i.type.includes("armor") ? "👕" : "💍";
          el.style.borderColor = `var(--rarity-${i.rarity})`;
          el.style.color = `var(--rarity-${i.rarity})`;
        } else {
          el.innerHTML =
            s === "weapon"
              ? "⚔️"
              : s.includes("upper")
              ? "👕"
              : s.includes("lower")
              ? "👖"
              : "💍";
          el.style.borderColor = "var(--border)";
          el.style.color = "#555";
          el.removeAttribute("title");
        }
      }
    }

    const l = document.getElementById("inventory-list");
    if (!l) return;
    l.innerHTML = "";
    if (document.getElementById("inv-count"))
      document.getElementById("inv-count").innerText = `${
        Player.inventory.length
      } | ✨${Player.magic_dust || 0}`;

    let arr = Player.inventory.filter((i) => {
      if (filter === "equip")
        return ["weapon", "armor_upper", "armor_lower", "accessory"].includes(
          i.type
        );
      if (filter === "mat") return ["consumable", "material"].includes(i.type);
      return true;
    });

    if (arr.length === 0) {
      l.innerHTML =
        "<div style='padding:10px; text-align:center; color:#666;'>空空如也</div>";
      return;
    }

    arr.forEach((i) => {
      let r = CONFIG.rarity[i.rarity];
      if (!r && i.rarity === "phantasm")
        r = { color: "text-phantasm", border: "border-phantasm" };
      if (!r) r = CONFIG.rarity.common;

      const div = document.createElement("div");
      div.className = `inv-item ${r.border}`;
      let m = "";
      if (i.stats) {
        let statsArr = [];
        if (i.stats.atk) statsArr.push(`攻${i.stats.atk}`);
        if (i.stats.maxHp) statsArr.push(`血${i.stats.maxHp}`);
        if (i.stats.speed) statsArr.push(`速${i.stats.speed}`);
        m = statsArr.join(" ");
      } else if (i.value) m = `價值 ${i.value}`;
      else if (i.desc) m = i.desc;

      let btn = "";
      if (["consumable"].includes(i.type))
        btn = `<button onclick="Inventory.use('${i.id}')">使用</button> <button class="btn-secondary" onclick="Inventory.disassemble('${i.id}')">分解</button>`;
      else if (!["material"].includes(i.type))
        btn = `<button onclick="Inventory.equip('${i.id}')">裝備</button> <button class="btn-secondary" onclick="Inventory.disassemble('${i.id}')">分解</button>`;

      div.innerHTML = `
        <div class="inv-item-info">
            <div class="inv-name ${r.color}">${i.name}</div>
            <div class="inv-meta">${m}</div>
        </div>
        <div class="inv-actions">${btn}</div>
      `;
      l.appendChild(div);
    });

    document.querySelectorAll(".filter-btn").forEach((btn) => {
      if (
        btn.innerText ===
        (filter === "all" ? "全部" : filter === "equip" ? "裝備" : "道具")
      )
        btn.classList.add("active");
      else btn.classList.remove("active");
    });
  },
};

const Blacksmith = {
  render() {
    const content = document.getElementById("event-content");
    if (content)
      content.innerHTML =
        '<div id="blacksmith-list" class="inventory-list"></div>';
    const l = document.getElementById("blacksmith-list");
    if (!l) return;
    l.innerHTML = "";

    let hasItem = false;
    for (let s in Player.equipment) {
      const item = Player.equipment[s];
      if (!item) continue;
      hasItem = true;
      const level = item.level || 0;
      const cost = Math.floor(50 * Math.pow(1.5, level));

      const div = document.createElement("div");
      div.className = "inv-item";
      let rInfo = CONFIG.rarity[item.rarity] || { color: "text-common" };
      if (item.rarity === "phantasm") rInfo = { color: "text-phantasm" };

      div.innerHTML = `
                <div class="inv-item-info">
                    <div class="inv-name ${rInfo.color}">${item.name} (+${level})</div>
                    <div class="inv-meta">下級消耗: 💰${cost} | 屬性+10%</div>
                </div>
                <div class="inv-actions"><button onclick="Blacksmith.upgrade('${s}')">強化</button></div>
            `;
      l.appendChild(div);
    }
    if (!hasItem)
      l.innerHTML =
        "<div style='text-align:center; padding:10px; color:#666'>請先裝備物品</div>";
  },
  upgrade(slot) {
    const item = Player.equipment[slot];
    if (!item) return;
    const level = item.level || 0;
    const cost = Math.floor(50 * Math.pow(1.5, level));
    if (Player.gold < cost) return UI.toast("金幣不足", "warn");

    Player.gold -= cost;
    item.level = level + 1;
    for (let k in item.stats) item.stats[k] = Math.ceil(item.stats[k] * 1.1);

    UI.toast(`強化成功！${item.name} +${item.level}`, "gain");
    Game.recalcPlayerStats();
    this.render();
    Game.updateHeader();
    StorageSystem.saveGame();
  },
};

const Crafting = {
  render() {
    const l = document.getElementById("recipe-list");
    if (!l) return;
    l.innerHTML = "";
    CONFIG.recipes.forEach((r) => {
      let visible = false;
      for (let k in r.req) {
        if (k === "gold") continue;
        const mName = CONFIG.materials[k] ? CONFIG.materials[k].name : k;
        if (GlobalSystem.data.unlockedItems.includes(mName)) {
          visible = true;
          break;
        }
      }
      if (!visible) return;

      const d = document.createElement("div");
      d.className = "recipe-item inv-item border-rare";
      let ok = true;
      let reqArr = [];
      for (let k in r.req) {
        const h = Inventory.countMat(k);
        const n = r.req[k];
        if (h < n) ok = false;
        let matName =
          k === "gold"
            ? "💰"
            : CONFIG.materials[k]
            ? CONFIG.materials[k].name
            : k;
        reqArr.push(`${matName} ${h}/${n}`);
      }

      d.innerHTML = `
        <div class="inv-item-info">
            <div class="inv-name text-rare">${r.name}</div>
            <div class="inv-meta">${
              r.setId ? CONFIG.sets[r.setId].name : r.desc || ""
            } | 需: ${reqArr.join(", ")}</div>
        </div>
        <div class="inv-actions"><button ${
          ok ? "" : "disabled"
        } onclick="Crafting.craft('${r.name}')">合成</button></div>`;
      l.appendChild(d);
    });
  },
  craft(name) {
    const r = CONFIG.recipes.find((x) => x.name === name);
    if (!r) return;
    for (let k in r.req)
      if (Inventory.countMat(k) < r.req[k]) return UI.toast("素材不足", "warn");
    for (let k in r.req) Inventory.removeMat(k, r.req[k]);

    if (r.type === "consumable") {
      let item = {
        id: Date.now() + Math.random(),
        name: r.name,
        baseName: r.name,
        type: "consumable",
        rarity: "legendary",
        effect: r.effect,
        desc: r.desc,
        value: 0,
      };
      Inventory.add(item);
      this.render();
      return;
    }

    let item = {
      id: Date.now() + Math.random(),
      name: r.name,
      baseName: r.name,
      type: "accessory",
      rarity: "common",
      setId: r.setId,
      stats: { ...r.stats },
    };
    const rd = Math.random();
    let rar = "common";
    if (rd < 0.1) rar = "epic";
    else if (rd < 0.3) rar = "rare";
    else if (rd < 0.6) rar = "uncommon";
    item.rarity = rar;
    const mul = CONFIG.rarity[rar].mult;
    for (let k in item.stats) item.stats[k] = Math.floor(item.stats[k] * mul);
    Inventory.add(item);
    this.render();
    Game.recalcPlayerStats();
    StorageSystem.saveGame();
  },
};

const Merchant = {
  render() {
    const content = document.getElementById("event-content");
    if (content)
      content.innerHTML =
        '<div id="merchant-list" class="inventory-list"></div>';
    const l = document.getElementById("merchant-list");
    if (!l) return;
    l.innerHTML = "";

    let arr = Player.inventory;
    if (arr.length === 0) {
      l.innerHTML =
        "<div style='text-align:center; padding:10px; color:#666'>背包是空的</div>";
      return;
    }

    arr.forEach((i) => {
      let price = i.value || 0;
      if (!price) {
        let rarityMult = 1;
        if (i.rarity === "uncommon") rarityMult = 1.5;
        if (i.rarity === "rare") rarityMult = 3;
        if (i.rarity === "epic") rarityMult = 8;
        if (i.rarity === "legendary") rarityMult = 20;
        if (i.rarity === "phantasm") rarityMult = 100;
        price = Math.floor(50 * rarityMult);
      }

      const div = document.createElement("div");
      div.className = "inv-item";
      let rInfo = CONFIG.rarity[i.rarity] || { color: "text-common" };
      if (i.rarity === "phantasm") rInfo = { color: "text-phantasm" };

      div.innerHTML = `
                <div class="inv-item-info">
                    <div class="inv-name ${rInfo.color}">${i.name}</div>
                    <div class="inv-meta">售價: 💰${price}</div>
                </div>
                <div class="inv-actions"><button onclick="Merchant.sell('${i.id}', ${price})">出售</button></div>
             `;
      l.appendChild(div);
    });
  },
  sell(id, price) {
    const i = Player.inventory.find((x) => x.id === id);
    if (!i) return;
    Player.gold += price;
    Inventory.remove(id);
    UI.toast(`出售 ${i.name} 獲得 ${price}G`, "gain");
    Game.updateHeader();
    this.render();
    StorageSystem.saveGame();
  },
};

const Compendium = {
  render() {
    const l = document.getElementById("compendium-list");
    if (!l) return;
    l.innerHTML = "";
    const mats = Object.values(CONFIG.materials).map((m) => ({
      name: m.name,
      type: "material",
      desc: "合成素材",
    }));
    const poolItems = [...CONFIG.itemPool.common];
    for (let k in CONFIG.itemPool.sets)
      poolItems.push(...CONFIG.itemPool.sets[k]);
    const recipes = CONFIG.recipes.map((r) => ({
      name: r.name,
      type: r.type,
      desc: "可合成",
    }));
    const allItems = [...mats, ...poolItems, ...recipes];
    const uniqueItems = [];
    const seen = new Set();
    for (let i of allItems) {
      if (!seen.has(i.name)) {
        seen.add(i.name);
        uniqueItems.push(i);
      }
    }
    uniqueItems.forEach((item) => {
      const unlocked = GlobalSystem.data.unlockedItems.includes(item.name);
      const div = document.createElement("div");
      div.className = `inv-item ${unlocked ? "border-common" : "locked-item"}`;
      let nameDisplay = unlocked ? item.name : "???";
      let descDisplay = unlocked ? item.desc || item.type : "未發現";
      let colorClass = unlocked ? "text-common" : "text-sub";
      div.innerHTML = `
                <div class="inv-item-info">
                    <div class="inv-name ${colorClass}">${nameDisplay}</div>
                    <div class="inv-meta">${descDisplay}</div>
                </div>`;
      l.appendChild(div);
    });
  },
};

/* 存檔系統 - 升級版 */
const StorageSystem = {
  SAVE_KEY: "rpg_abyss_v4",

  saveGame(m = false) {
    if (Player.currentHp > 0 && Player.class) {
      const data = {
        player: Player,
        global: GlobalSystem.data,
        ts: Date.now(),
        version: 1.0,
      };
      localStorage.setItem(this.SAVE_KEY, JSON.stringify(data));
      if (m) UI.toast("✅ 進度已保存", "gain");
    }
  },

  loadGame() {
    try {
      const raw = localStorage.getItem(this.SAVE_KEY);
      if (!raw) return false;
      const d = JSON.parse(raw);
      if (d.player) Object.assign(Player, d.player);
      if (d.global) GlobalSystem.data = d.global;
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
    if (!Player.class) return UI.toast("無存檔可匯出", "warn");

    // 1. Prepare Data
    const data = {
      player: Player,
      global: GlobalSystem.data,
      ts: Date.now(),
    };

    // 2. Encode (Base64 + URI Component for Unicode safety)
    // 這會產生一串 "亂碼"
    const json = JSON.stringify(data);
    const code = btoa(encodeURIComponent(json));

    // 3. UI Handling
    const area = document.getElementById("save-code-area");
    area.value = code;
    area.select();

    // 4. Copy to Clipboard
    navigator.clipboard
      .writeText(code)
      .then(() => {
        UI.toast("📋 存檔碼已複製！", "gain");
      })
      .catch(() => {
        UI.toast("✅ 存檔碼已生成 (請手動複製)", "gain");
      });
  },

  importSave() {
    const area = document.getElementById("save-code-area");
    const code = area.value.trim();

    if (!code) return UI.toast("請貼上存檔代碼", "warn");

    try {
      // 1. Decode
      const json = decodeURIComponent(atob(code));
      const data = JSON.parse(json);

      // 2. Validate
      if (!data.player || !data.global) throw new Error("Format Error");

      // 3. Confirm & Load
      if (confirm("讀取此存檔將覆蓋當前進度，確定嗎？")) {
        Object.assign(Player, data.player);
        GlobalSystem.data = data.global;
        this.saveGame(); // Save immediately
        UI.toast("📂 匯入成功，正在重啟...", "gain");
        setTimeout(() => location.reload(), 1000);
      }
    } catch (e) {
      UI.toast("❌ 無效的存檔代碼", "warn");
      console.error(e);
    }
  },
};
