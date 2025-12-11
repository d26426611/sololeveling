/* main.js */
const EventDirector = {
  checkAwakening() {
    for (let cid in CONFIG.classes) {
      const c = CONFIG.classes[cid];
      if (!c.hidden || !c.unlockCheck) continue;
      if (Player.flags[`rej_${cid}`] || Player.class === cid) continue;
      if (c.unlockCheck(Player, {})) return cid; // 移除 combatStats 依賴
    }
    return null;
  },
  trigger() {
    const evts = CONFIG.events;
    let tot = evts.reduce((a, b) => a + b.weight, 0);
    let r = Math.random() * tot;
    let e = evts[0];
    for (let v of evts) {
      if (r < v.weight) {
        e = v;
        break;
      }
      r -= v.weight;
    }
    if (this[e.id]) this[e.id](); // 呼叫對應函式
    else if (e.id === "chest") Game.triggerChest();
    else if (e.id === "black_market") this.black_market();
    else this.trap();
  },
  // 保留原有事件邏輯
  spring() {
    Game.renderEvent("治癒之泉", "⛲", "恢復生命", "飲用", () => {
      Player.currentHp = Player.stats.maxHp;
      UI.toast("滿血", "heal");
      Game.nextDepth();
    });
  },
  trap() {
    Game.renderEvent("陷阱", "🪤", "受傷！", "掙扎", () => {
      let pctDmg = Math.floor(Player.currentHp * 0.25);
      let flatDmg = 10 + Math.floor(Player.depth * 0.5);
      let d = pctDmg + flatDmg;
      Player.currentHp -= d;
      UI.toast(`-${d} HP`, "warn");
      if (Player.currentHp <= 0) {
        if (Player.flags.mark_of_sin) Game.enterWorld("purgatory");
        else {
          alert("死於陷阱");
          location.reload();
        }
      } else Game.nextDepth();
    });
  },
  gambler() {
    Game.renderEvent(
      "賭徒",
      "🎲",
      "賭一把(100G)",
      "比大小",
      () => {
        if (Player.gold < 100) return UI.toast("沒錢", "warn");
        Player.gold -= 100;
        if (Math.random() < 0.5) {
          Player.gold += 250;
          UI.toast("贏了!", "gain");
        } else UI.toast("輸了", "warn");
        Game.updateHeader();
        Game.nextDepth();
      },
      "離開",
      () => Game.nextDepth()
    );
  },
  cursed_sword() {
    // 修正名稱對應
    const i = ItemSystem.generate("weapon");
    i.name = "詛咒之" + i.name;
    i.stats.atk = Math.floor(i.stats.atk * 3);
    const hpDmg = Math.floor(Player.baseStats.maxHp * 0.2);
    Player.baseStats.maxHp = Math.floor(Player.baseStats.maxHp * 0.8);
    Game.recalcPlayerStats();
    Inventory.add(i);
    UI.toast("獲得詛咒力量", "warn");
    Game.nextDepth();
  },
  alchemist() {
    Game.renderEvent(
      "煉金術師",
      "🧪",
      "兩瓶藥水",
      "變種族",
      () => {
        const r = Object.keys(CONFIG.races).filter(
          (k) => !CONFIG.races[k].hidden
        );
        Player.race = r[Math.floor(Math.random() * r.length)];
        Game.recalcPlayerStats();
        UI.toast(`變成 ${CONFIG.races[Player.race].name}`, "gain");
        Game.updateHeader();
        Game.nextDepth();
      },
      "強化武器",
      () => {
        if (Player.equipment.weapon) {
          Player.equipment.weapon.stats.atk += 10;
          UI.toast("攻擊+10", "gain");
        } else UI.toast("無武器", "warn");
        Game.nextDepth();
      }
    );
  },
  demon_whisper() {
    Game.renderEvent(
      "惡魔低語",
      "😈",
      "獻祭防禦，換取力量...",
      "接受",
      () => {
        Player.flags.mark_of_sin = true;
        Game.recalcPlayerStats();
        UI.toast("獲得【罪惡印記】", "warn");
        Game.nextDepth();
      },
      "拒絕",
      () => Game.nextDepth()
    );
  },
  black_market() {
    // 修正名稱
    const isEquip = Math.random() < 0.6;
    let item = isEquip
      ? ItemSystem.generate()
      : ItemSystem.generate("consumable");
    if (item.rarity === "common") item.rarity = "rare";
    let price = 200 + Player.depth * 5;
    Game.renderEvent(
      "黑市商人",
      "🕵️",
      `兜售: <span class="${CONFIG.rarity[item.rarity].color}">${
        item.name
      }</span><br>價格: ${price} G`,
      "購買",
      () => {
        if (Player.gold >= price) {
          Player.gold -= price;
          Inventory.add(item);
          UI.toast("交易愉快", "gain");
          Game.updateHeader();
          Game.nextDepth();
        } else UI.toast("金幣不足", "warn");
      },
      "離開",
      () => Game.nextDepth()
    );
  },
};

const Game = {
  tempSetup: { race: null, cls: null },
  init() {
    GlobalSystem.load();
    this.renderSetup();
    this.initTabs();
    document.getElementById("btn-start-game").onclick = () => this.startGame();
    if (localStorage.getItem(StorageSystem.SAVE_KEY)) {
      const lb = document.getElementById("btn-load-game");
      lb.style.display = "inline-block";
      lb.onclick = () => {
        if (StorageSystem.loadGame()) {
          this.recalcPlayerStats();
          document.getElementById("setup-screen").style.display = "none";
          document.getElementById("app").style.display = "grid";
          this.openScreen("event-screen");
          this.updateHeader();
          UI.toast("讀取成功", "gain");
        }
      };
    }
    Crafting.render();
  },
  initTabs() {
    document.querySelectorAll(".tab-btn").forEach((btn) => {
      btn.onclick = () => {
        const tabId = btn.dataset.tab;
        this.switchTab(tabId);
      };
    });
  },
  switchTab(tabId) {
    document
      .querySelectorAll(".tab-btn")
      .forEach((b) => b.classList.remove("active"));
    document
      .querySelectorAll(".tab-pane")
      .forEach((p) => p.classList.remove("active"));
    document
      .querySelector(`.tab-btn[data-tab="${tabId}"]`)
      .classList.add("active");
    document.getElementById(`tab-${tabId}`).classList.add("active");
    if (tabId === "crafting") Crafting.render();
    if (tabId === "inventory") Inventory.render();
    if (tabId === "compendium") Compendium.render();
    if (tabId === "blacksmith") Blacksmith.render();

    // 手機版切換 tab 時顯示右側面板
    if (window.innerWidth <= 900) {
      const panel = document.getElementById("action-panel");
      if (panel.style.display === "flex")
        panel.style.display = "none"; // Toggle off
      else {
        panel.style.display = "flex"; // Toggle on
        panel.classList.add("show");
      }
    }
  },
  recalcPlayerStats() {
    // 保持原本邏輯
    const r = CONFIG.races[Player.race];
    const c = CONFIG.classes[Player.class];
    let s = {
      ...Player.baseStats,
      crit: 0.05,
      dodge: 0,
      block: 0,
      lifesteal: 0,
      hp_regen: 0,
      def: 0,
      crit_dmg: 1.5,
      true_dmg: 0,
      reflect: 0,
      gold_drop: 1.0,
    };
    for (let k in c.bonus) if (s[k] !== undefined) s[k] += c.bonus[k];
    Player.activeSets = {};
    for (let sl in Player.equipment) {
      const i = Player.equipment[sl];
      if (i) {
        if (i.stats)
          for (let k in i.stats)
            if (s[k] !== undefined) s[k] += i.stats[k];
            else s[k] = i.stats[k];
        if (i.setId)
          Player.activeSets[i.setId] = (Player.activeSets[i.setId] || 0) + 1;
      }
    }
    // Set Bonuses (Simplified for brevity, keep your original logic if needed)
    for (let sid in Player.activeSets) {
      const cnt = Player.activeSets[sid];
      const set = CONFIG.sets[sid];
      const app = (b) => {
        for (let k in b) {
          if (k === "all_stats") {
            s.atk = Math.floor(s.atk * (1 + b[k]));
            s.maxHp = Math.floor(s.maxHp * (1 + b[k]));
          } else if (s[k] !== undefined) s[k] += b[k];
          else s[k] = b[k];
        }
      };
      if (cnt >= 2 && set.bonus2) app(set.bonus2);
      if (cnt >= 4 && set.bonus4) app(set.bonus4);
      if (cnt >= 6 && set.bonus6) app(set.bonus6);
    }
    for (let k in r.mod) if (s[k]) s[k] = Math.floor(s[k] * r.mod[k]);
    if (Player.flags.mark_of_sin) {
      s.atk *= 2;
      s.def = 0;
    }
    Player.stats = s;
    this.updateHeader();
  },
  nextDepth() {
    Player.depth++;
    // Biome Logic
    if (Player.depth === 21) Player.currentBiomeId = "forest";
    else if (Player.depth === 51)
      Player.currentBiomeId = "cave"; // 簡化：直接切換，不隨機
    else if (Player.depth === 101) Player.currentBiomeId = "volcano";

    if (Player.currentWorld === "phantasm") Player.sanity--;
    if (Player.sanity <= 0 && Player.currentWorld === "phantasm")
      this.leaveWorld();

    this.updateHeader();
    StorageSystem.saveGame();

    // Regen
    if (Player.currentHp < Player.stats.maxHp)
      Player.currentHp = Math.min(Player.stats.maxHp, Player.currentHp + 5);

    // Event Routing
    if (Player.depth % 20 === 0) this.triggerBoss();
    else {
      let r = Math.random();
      if (r < 0.7) this.triggerCombat();
      else if (r < 0.85) EventDirector.trigger();
      else this.triggerChest();
    }
  },
  triggerCombat() {
    const b = CONFIG.biomes[Player.currentBiomeId] || CONFIG.biomes["plains"];
    const isElite = Math.random() < 0.2;
    const mid = b.monsters[Math.floor(Math.random() * b.monsters.length)];
    const enemy = { ...CONFIG.monsters[mid], id: mid };

    // 切換到戰鬥畫面
    this.openScreen("combat-screen");
    BattleSystem.start(enemy, isElite);
  },
  triggerBoss() {
    const b = CONFIG.biomes[Player.currentBiomeId];
    const enemy = { ...CONFIG.monsters[b.boss], id: b.boss, type: "boss" };
    this.openScreen("combat-screen");
    BattleSystem.start(enemy);
  },
  exitCombat() {
    this.openScreen("event-screen");
    this.nextDepth();
  },
  // --- Rendering Helpers ---
  renderSetup() {
    const rD = document.getElementById("race-options");
    const cD = document.getElementById("class-options");
    rD.innerHTML = "";
    cD.innerHTML = "";
    for (let k in CONFIG.races) {
      if (
        CONFIG.races[k].hidden &&
        !GlobalSystem.data.unlockedRaces.includes(k)
      )
        continue;
      let b = document.createElement("div");
      b.className = "select-btn";
      b.innerHTML = CONFIG.races[k].name;
      b.onclick = () => {
        this.tempSetup.race = k;
        this.updateSetupUI();
      };
      rD.appendChild(b);
    }
    for (let k in CONFIG.classes) {
      if (
        CONFIG.classes[k].hidden &&
        !GlobalSystem.data.unlockedClasses.includes(k)
      )
        continue;
      let b = document.createElement("div");
      b.className = "select-btn";
      b.innerHTML = CONFIG.classes[k].name;
      b.onclick = () => {
        this.tempSetup.cls = k;
        this.updateSetupUI();
      };
      cD.appendChild(b);
    }
  },
  updateSetupUI() {
    document
      .querySelectorAll(".select-btn")
      .forEach((b) => b.classList.remove("selected"));
    // 簡單處理：點擊變色
    const r = this.tempSetup.race ? CONFIG.races[this.tempSetup.race] : null;
    const c = this.tempSetup.cls ? CONFIG.classes[this.tempSetup.cls] : null;
    if (r && c) {
      document.getElementById(
        "setup-desc"
      ).innerHTML = `<b>${r.name} ${c.name}</b><br>${r.desc}<br>${c.desc}`;
      document.getElementById("btn-start-game").disabled = false;
    }
  },
  startGame() {
    Player.race = this.tempSetup.race;
    Player.class = this.tempSetup.cls;
    Inventory.add(ItemSystem.generate("weapon"));
    this.recalcPlayerStats();
    Player.currentHp = Player.stats.maxHp;
    document.getElementById("setup-screen").style.display = "none";
    document.getElementById("app").style.display = "grid";
    this.openScreen("event-screen");
    this.nextDepth();
  },
  openScreen(id) {
    document
      .querySelectorAll(".game-stage")
      .forEach((s) => (s.style.display = "none"));
    document.getElementById(id).style.display = "flex"; // Changed to flex for centering
  },
  updateHeader() {
    const b = CONFIG.biomes[Player.currentBiomeId] || {
      name: "未知",
      color: "#fff",
    };
    document.getElementById("header-depth").innerText = `F: ${Player.depth}`;
    document.getElementById("header-biome").innerText = b.name;
    document.getElementById("header-biome").style.color = b.color;
    document.getElementById("header-gold").innerText = `💰 ${Player.gold}`;
    document.getElementById("header-name").innerText = `${
      CONFIG.races[Player.race].name
    } ${CONFIG.classes[Player.class].name}`;

    // Stats
    document.getElementById("stat-hp").innerText = `${Math.floor(
      Player.currentHp
    )}/${Player.stats.maxHp}`;
    document.getElementById("stat-atk").innerText = Player.stats.atk;
    document.getElementById("stat-spd").innerText = Player.stats.speed;
    document.getElementById("stat-crit").innerText =
      Math.floor((Player.stats.crit || 0.05) * 100) + "%";
    document.getElementById("stat-def").innerText =
      Math.floor((Player.stats.def || 0) * 100) + "%";

    // Equipment Icons
    for (let s in Player.equipment) {
      const el = document.querySelector(`.mini-slot[data-slot="${s}"]`);
      const item = Player.equipment[s];
      if (el) {
        el.innerHTML = item
          ? item.type === "weapon"
            ? "⚔️"
            : item.type.includes("armor")
            ? "🛡️"
            : "💍"
          : s === "weapon"
          ? "⚔️"
          : s.includes("armor")
          ? "👕"
          : "💍";
        el.style.borderColor = item ? `var(--rarity-${item.rarity})` : "#333";
        el.style.color = item ? `var(--rarity-${item.rarity})` : "#555";
      }
    }
    // Sets
    const setsDiv = document.getElementById("active-sets");
    if (setsDiv) {
      let txt = [];
      for (let sid in Player.activeSets)
        if (Player.activeSets[sid] >= 2)
          txt.push(`${CONFIG.sets[sid].name}(${Player.activeSets[sid]})`);
      setsDiv.innerText = txt.join(", ");
    }
  },
  renderEvent(t, i, d, b1t, a1, b2t, a2) {
    document.getElementById("event-title").innerText = t;
    document.getElementById("event-icon").innerText = i;
    document.getElementById("event-desc").innerHTML = d;
    document.getElementById("event-content").innerHTML = ""; // Clear dynamic content like shop
    const b1 = document.getElementById("btn-event-main");
    b1.innerText = b1t;
    b1.onclick = a1;
    const b2 = document.getElementById("btn-event-sub");
    if (b2t) {
      b2.style.display = "inline-block";
      b2.innerText = b2t;
      b2.onclick = a2;
    } else b2.style.display = "none";
    this.openScreen("event-screen");
  },
  triggerChest() {
    const i = ItemSystem.generate();
    Inventory.add(i);
    const g = Math.floor(Math.random() * 50) + 10;
    Player.gold += g;
    this.renderEvent(
      "寶箱",
      "📦",
      `獲得 <span class='${CONFIG.rarity[i.rarity].color}'>${
        i.name
      }</span> 與 ${g}G`,
      "確認",
      () => this.nextDepth()
    );
  },
  completeBiome() {
    UI.toast("區域通關！", "gain");
  },
  enterWorld(w) {
    Player.currentWorld = w;
    UI.toast("進入新世界", "warn");
    this.nextDepth();
  },
  leaveWorld() {
    Player.currentWorld = "normal";
    UI.toast("回歸現實", "gain");
    this.nextDepth();
  },
};

window.onload = () => Game.init();
