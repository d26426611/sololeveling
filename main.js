/* main.js - Fix v2 */

const EventDirector = {
  checkAwakening() {
    for (let cid in CONFIG.classes) {
      const c = CONFIG.classes[cid];
      if (!c.hidden || !c.unlockCheck) continue;
      if (Player.flags[`rej_${cid}`] || Player.class === cid) continue;
      if (c.unlockCheck(Player, BattleSystem.combatStats)) return cid;
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

    if (e.id === "gambler") this.gambler();
    else if (e.id === "cursed_sword") this.cursed();
    else if (e.id === "alchemist") this.alchemist();
    else if (e.id === "spring") this.spring();
    else if (e.id === "chest") Game.triggerChest();
    else if (e.id === "demon_whisper") this.demonWhisper();
    else if (e.id === "black_market") this.blackMarket();
    else this.trap();
  },
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
        if (Player.flags.mark_of_sin) {
          Game.enterWorld("purgatory");
        } else {
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
  cursed() {
    const i = ItemSystem.generate("weapon");
    i.name = "詛咒之" + i.name;
    i.stats.atk = Math.floor(i.stats.atk * 3);
    const hpDmg = Math.floor(Player.baseStats.maxHp * 0.2);
    Player.baseStats.maxHp = Math.floor(Player.baseStats.maxHp * 0.8);
    Game.recalcPlayerStats();
    Inventory.add(i);
    UI.toast("獲得詛咒力量", "warn");
    Game.renderEvent("詛咒之劍", "🗡️", `你拔出了詛咒之劍！`, "確認", () =>
      Game.nextDepth()
    );
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
  demonWhisper() {
    Game.renderEvent(
      "惡魔低語",
      "😈",
      "獻祭防禦...",
      "接受契約",
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
  blackMarket() {
    const isEquip = Math.random() < 0.6;
    let item,
      price = 0;
    if (isEquip) {
      item = ItemSystem.generate();
      price = Math.floor(Math.random() * 500) + 200 + Player.depth * 5;
    } else {
      item = ItemSystem.generate("consumable");
      price = 50;
    }
    Game.renderEvent(
      "黑市商人",
      "🕵️",
      `兜售: ${item.name} (${price}G)`,
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
      "出售物品",
      () => Merchant.render()
    );
  },
};

const Game = {
  tempSetup: { race: null, cls: null },
  statNames: {
    atk: "攻擊",
    maxHp: "生命",
    speed: "速度",
    def: "防禦",
    crit: "暴擊",
    dodge: "閃避",
    block: "格擋",
    lifesteal: "吸血",
    hp_regen: "再生",
    gold: "金幣",
  },

  init() {
    GlobalSystem.load();
    this.renderSetup();
    this.initTabs();

    const btnStart = document.getElementById("btn-start-game");
    if (btnStart) btnStart.onclick = () => this.startGame();

    if (localStorage.getItem(StorageSystem.SAVE_KEY)) {
      const lb = document.getElementById("btn-load-game");
      if (lb) {
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
    }

    // 重新綁定戰鬥按鈕，防止 HTML 覆蓋後失效
    const btnSkip = document.getElementById("btn-combat-skip");
    const btnEscape = document.getElementById("btn-combat-escape");
    if (btnSkip) btnSkip.onclick = () => BattleSystem.skip();
    if (btnEscape) btnEscape.onclick = () => BattleSystem.escape();

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
    const btn = document.querySelector(`.tab-btn[data-tab="${tabId}"]`);
    const pane = document.getElementById(`tab-${tabId}`);
    if (btn) btn.classList.add("active");
    if (pane) pane.classList.add("active");

    if (tabId === "crafting") Crafting.render();
    if (tabId === "inventory") Inventory.render();
    if (tabId === "compendium") Compendium.render();
    if (tabId === "blacksmith") Blacksmith.render();
  },

  triggerAwakening(cid) {
    this.openScreen("event-screen");
    const c = CONFIG.classes[cid];
    this.renderEvent(
      "覺醒",
      "⚡",
      `轉職為 ${c.name}?`,
      "接受",
      () => {
        Player.class = cid;
        GlobalSystem.unlockClass(cid);
        Player.currentHp = Player.stats.maxHp;
        this.recalcPlayerStats();
        this.updateHeader();
        UI.toast("轉職成功", "gain");
        this.nextDepth();
      },
      "拒絕",
      () => {
        Player.flags[`rej_${cid}`] = true;
        this.nextDepth();
      }
    );
  },
  triggerPromotion() {
    const cid = CONFIG.classes[Player.class].promotesTo;
    if (!cid) {
      this.nextDepth();
      return;
    }
    const c = CONFIG.classes[cid];
    this.renderEvent(
      "晉升",
      "✨",
      `晉升為 ${c.name}?`,
      "晉升",
      () => {
        Player.class = cid;
        GlobalSystem.unlockClass(cid);
        Player.currentHp = Player.stats.maxHp;
        this.recalcPlayerStats();
        this.updateHeader();
        UI.toast("晉升成功", "gain");
        this.nextDepth();
      },
      "稍後",
      () => this.nextDepth()
    );
  },

  recalcPlayerStats() {
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
      extra_turn: 0,
      multi_hit_chance: 0,
      gold_drop: 1.0,
      damage_reduce: 0,
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
    for (let sid in Player.activeSets) {
      const cnt = Player.activeSets[sid];
      const set = CONFIG.sets[sid];
      const app = (b) => {
        for (let k in b) {
          if (k.endsWith("_pct")) {
            const key = k.replace("_pct", "");
            if (s[key] !== undefined) s[key] = Math.floor(s[key] * (1 + b[k]));
          } else if (k === "all_stats") {
            s.atk = Math.floor(s.atk * (1 + b[k]));
            s.maxHp = Math.floor(s.maxHp * (1 + b[k]));
            s.speed = Math.floor(s.speed * (1 + b[k]));
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
      s.atk = Math.floor(s.atk * 2);
      s.def = 0;
      s.damage_reduce = 0;
      s.block = 0;
    }
    Player.stats = s;
    this.updateHeader();
  },

  getCurrentBiome() {
    return CONFIG.biomes[Player.currentBiomeId] || CONFIG.biomes["plains"];
  },

  shuffleBiomes() {
    let pool = ["cave", "volcano", "tundra", "graveyard", "desert"];
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    Player.biomeOrder = pool;
    Player.biomeStartDepth = 1;
    Player.currentBiomeId = "plains";
  },

  completeBiome() {
    UI.toast("區域 Boss 已擊敗！前往下一個區域...", "gain");
    this.updateHeader();
  },

  nextDepth() {
    Player.depth++;
    // Biome Logic (簡化)
    if (Player.depth === 21) {
      Player.currentBiomeId = "forest";
      UI.toast("進入區域: 迷霧森林", "gain");
    } else if ([51, 101, 151, 201, 251].includes(Player.depth)) {
      let idx = Math.floor((Player.depth - 1) / 50) - 1;
      if (Player.biomeOrder[idx]) {
        Player.currentBiomeId = Player.biomeOrder[idx];
        UI.toast(
          `進入區域: ${CONFIG.biomes[Player.currentBiomeId].name}`,
          "gain"
        );
      }
    }

    if (Player.currentWorld === "phantasm") {
      Player.sanity = Math.max(0, Player.sanity - 1);
      if (Player.sanity <= 0) {
        this.leaveWorld();
        return;
      }
    }

    this.updateHeader();
    if (
      Player.currentWorld !== "purgatory" &&
      Player.race !== "undead" &&
      Player.currentHp < Player.stats.maxHp
    )
      Player.currentHp = Math.min(Player.stats.maxHp, Player.currentHp + 5);

    StorageSystem.saveGame();

    let isBossFloor =
      Player.depth === 20 ||
      Player.depth === 50 ||
      (Player.depth >= 100 && Player.depth % 50 === 0);
    if (isBossFloor) {
      this.triggerBoss();
      return;
    }
    if (Player.depth % 50 === 0 && CONFIG.classes[Player.class].promotesTo) {
      this.triggerPromotion();
      return;
    }

    let r = Math.random();
    if (r < 0.7) this.triggerCombat();
    else if (r < 0.85) EventDirector.trigger();
    else this.triggerChest();
  },

  triggerCombat() {
    const b = this.getCurrentBiome();
    const isElite = Math.random() < 0.2;
    const commons = b.monsters;
    const mid = commons[Math.floor(Math.random() * commons.length)];

    this.tempEnemy = { ...CONFIG.monsters[mid], id: mid };
    this.tempIsElite = isElite;

    const enemyName = this.tempEnemy.name;
    const prefix = isElite ? "<span style='color:orange'>菁英</span> " : "";

    this.renderEvent(
      "遭遇敵人",
      this.tempEnemy.icon,
      `在 <b>${b.name}</b> 遭遇了 ${prefix}<b>${enemyName}</b>`,
      "⚔️ 戰鬥",
      () => {
        this.openScreen("combat-screen");
        // 確保 BattleSystem 存在再呼叫
        if (window.BattleSystem)
          BattleSystem.start(this.tempEnemy, this.tempIsElite);
        else console.error("BattleSystem missing");
      },
      "🏃 嘗試逃跑",
      () => {
        const chance = 0.6;
        if (Math.random() < chance) {
          UI.toast("你成功溜走了...", "gain");
          this.nextDepth();
        } else {
          UI.toast("逃跑失敗！", "warn");
          this.openScreen("combat-screen");
          BattleSystem.start(this.tempEnemy, this.tempIsElite);
        }
      }
    );
  },

  triggerBoss() {
    const b = this.getCurrentBiome();
    const t = { ...CONFIG.monsters[b.boss], id: b.boss, type: "boss" };
    UI.toast("⚠️ 區域領主!", "warn");
    this.renderEvent(
      "⚠️ 區域領主",
      "👑",
      `強大的氣息... <b>${t.name}</b> 出現了！`,
      "決一死戰",
      () => {
        this.openScreen("combat-screen");
        BattleSystem.start(t);
      }
    );
  },

  triggerChest() {
    const i = ItemSystem.generate();
    Inventory.add(i);
    const g = Math.floor(Math.random() * 30 * Math.max(1, Player.depth / 10));
    Player.gold += g;
    UI.toast(`+${g} G`, "gain");
    Game.updateHeader();
    this.renderEvent(
      "寶箱",
      "📦",
      `發現寶箱！獲得：${i.name} / ${g} G`,
      "確認",
      () => Game.nextDepth()
    );
  },

  renderSetup() {
    const rD = document.getElementById("race-options");
    const cD = document.getElementById("class-options");
    if (!rD || !cD) return;
    rD.innerHTML = "";
    cD.innerHTML = "";

    // 渲染種族與職業 (省略重複代碼，邏輯與之前相同)
    for (let k in CONFIG.races) {
      const r = CONFIG.races[k];
      if (r.hidden && !GlobalSystem.data.unlockedRaces.includes(k)) continue;
      let b = document.createElement("div");
      b.className = "select-btn";
      b.innerHTML = `<span class="btn-name">${r.name}</span><br><span class="btn-bonus">${r.desc}</span>`;
      b.onclick = () => {
        this.tempSetup.race = k;
        this.updateSetupUI();
      };
      rD.appendChild(b);
    }
    for (let k in CONFIG.classes) {
      const c = CONFIG.classes[k];
      if (c.hidden && !GlobalSystem.data.unlockedClasses.includes(k)) continue;
      if (["knight", "assassin", "ranger", "archmage", "paladin"].includes(k))
        continue;
      let b = document.createElement("div");
      b.className = "select-btn";
      b.innerHTML = `<span class="btn-name">${c.name}</span><br><span class="btn-bonus">${c.desc}</span>`;
      b.onclick = () => {
        this.tempSetup.cls = k;
        this.updateSetupUI();
      };
      cD.appendChild(b);
    }
  },

  updateSetupUI() {
    const r = this.tempSetup.race ? CONFIG.races[this.tempSetup.race] : null;
    const c = this.tempSetup.cls ? CONFIG.classes[this.tempSetup.cls] : null;
    document
      .querySelectorAll("#race-options .select-btn")
      .forEach((e) =>
        e.classList.toggle("selected", r && e.innerText.includes(r.name))
      );
    document
      .querySelectorAll("#class-options .select-btn")
      .forEach((e) =>
        e.classList.toggle("selected", c && e.innerText.includes(c.name))
      );
    const b = document.getElementById("btn-start-game");
    if (b) b.disabled = !(r && c);
  },

  startGame() {
    Player.race = this.tempSetup.race;
    Player.class = this.tempSetup.cls;
    Inventory.add(ItemSystem.generate("weapon"));
    this.shuffleBiomes();
    this.recalcPlayerStats();
    Player.currentHp = Player.stats.maxHp;
    document.getElementById("setup-screen").style.display = "none";
    document.getElementById("app").style.display = "grid";
    this.openScreen("event-screen");
    this.updateHeader();
    this.nextDepth();
  },

  openScreen(id) {
    document
      .querySelectorAll(".game-stage")
      .forEach((s) => (s.style.display = "none"));
    const target = document.getElementById(id);
    if (target) target.style.display = "block";
  },

  updateHeader() {
    const b = this.getCurrentBiome();
    const hpTxt = document.getElementById("stat-hp");
    if (hpTxt)
      hpTxt.innerText = `${Math.floor(Math.max(0, Player.currentHp))}/${
        Player.stats.maxHp
      }`;

    document.getElementById("header-depth").innerText = `F: ${Player.depth}`;
    document.getElementById("header-gold").innerText = `💰 ${Player.gold}`;
    document.getElementById("header-name").innerText = `${
      CONFIG.races[Player.race].name
    } ${CONFIG.classes[Player.class].name}`;
    document.getElementById("header-biome").innerText = b.name;
    document.getElementById("header-biome").style.color = b.color;
    document.getElementById("stat-atk").innerText = Player.stats.atk;
    document.getElementById("stat-spd").innerText = Player.stats.speed;
    document.getElementById("stat-crit").innerText = `${Math.floor(
      (Player.stats.crit || 0.05) * 100
    )}%`;

    // 裝備與套裝更新邏輯 (保持原樣)
    const setsDiv = document.getElementById("active-sets");
    if (setsDiv) {
      let setTxt = [];
      for (let sid in Player.activeSets) {
        if (Player.activeSets[sid] >= 2)
          setTxt.push(`${CONFIG.sets[sid].name}(${Player.activeSets[sid]})`);
      }
      setsDiv.innerText = setTxt.join(" ");
    }
  },

  renderEvent(t, i, d, b1t, a1, b2t = null, a2 = null) {
    document.getElementById("event-title").innerText = t;
    document.getElementById("event-icon").innerText = i;
    document.getElementById("event-desc").innerHTML = d;
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

  enterWorld(worldId) {
    Player.currentWorld = worldId;
    document.documentElement.style.setProperty(
      "--bg-dark",
      worldId === "phantasm"
        ? "#1a0033"
        : worldId === "purgatory"
        ? "#330000"
        : "#121212"
    );
    if (worldId === "phantasm") Player.sanity = 100;
    else if (worldId === "purgatory") {
      Player.currentHp = Player.stats.maxHp;
      Player.karma = 0;
    }
    UI.toast(`進入${worldId === "phantasm" ? "幻界" : "煉獄"}`, "warn");
    this.updateHeader();
    this.nextDepth();
  },

  leaveWorld() {
    UI.toast("回歸現實", "gain");
    Player.currentWorld = "normal";
    document.documentElement.style.setProperty("--bg-dark", "#121212");
    this.updateHeader();
    this.nextDepth();
  },
};

window.onload = () => Game.init();
