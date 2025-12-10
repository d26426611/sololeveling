/* main.js */
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

    Game.renderEvent(
      "詛咒之劍",
      "🗡️",
      `你拔出了詛咒之劍！<br>獲得：<span class="${
        CONFIG.rarity[i.rarity].color
      }">${
        i.name
      }</span><br>攻擊力 <span style="color:#66bb6a">X3</span>，但最大生命值 <span style="color:#ef5350">-${hpDmg}</span>。`,
      "確認",
      () => {
        Game.nextDepth();
      }
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
      "獻祭防禦，換取極致力量...<br>接受後攻擊力翻倍，但防禦歸零，且死亡會墜入煉獄。",
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
    let item;
    let price = 0;

    if (isEquip) {
      item = ItemSystem.generate();
      if (item.rarity === "common") item.rarity = "rare";
      else if (item.rarity === "uncommon") item.rarity = "epic";

      price = Math.floor(Math.random() * 500) + 200 + Player.depth * 5;
    } else {
      const mats = Object.values(CONFIG.materials).filter((m) => m.value > 50);
      if (mats.length > 0) {
        const m = mats[Math.floor(Math.random() * mats.length)];
        item = {
          id: Date.now(),
          type: "material",
          baseName: m.name,
          ...m,
          rarity: "epic",
        };
        price = Math.floor(m.value * 0.8);
      } else {
        item = ItemSystem.generate("consumable");
        price = 50;
      }
    }

    Game.renderEvent(
      "黑市商人",
      "🕵️",
      `兜售: <span class="${CONFIG.rarity[item.rarity].color}">${
        item.name
      }</span><br>價格: <span class="gold-text">${price} G</span>`,
      "購買",
      () => {
        if (Player.gold >= price) {
          Player.gold -= price;
          Inventory.add(item);
          UI.toast("交易愉快", "gain");
          Game.updateHeader();
          Game.nextDepth();
        } else {
          UI.toast("金幣不足", "warn");
        }
      },
      "出售物品",
      () => {
        Merchant.render();
      }
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

    document.getElementById("btn-combat-skip").onclick = () =>
      BattleSystem.skip();
    document.getElementById("btn-combat-escape").onclick = () =>
      BattleSystem.escape();

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
  },
  triggerAwakening(cid) {
    this.openScreen("event-screen");
    const c = CONFIG.classes[cid];
    this.renderEvent(
      "覺醒",
      "⚡",
      `轉職為 ${c.name}?<br>${c.desc}`,
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
      `晉升為 ${c.name}?<br>${c.desc}`,
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
          } else if (s[k] !== undefined) {
            s[k] += b[k];
          } else {
            s[k] = b[k];
          }
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

    if (Player.depth === 21) {
      Player.currentBiomeId = "forest";
      Player.biomeStartDepth = 21;
      UI.toast("進入區域: 迷霧森林", "gain");
    } else if (Player.depth === 51) {
      Player.currentBiomeId = Player.biomeOrder[0];
      Player.biomeStartDepth = 51;
      UI.toast(
        `進入區域: ${CONFIG.biomes[Player.currentBiomeId].name}`,
        "gain"
      );
    } else if (Player.depth === 101) {
      Player.currentBiomeId = Player.biomeOrder[1];
      Player.biomeStartDepth = 101;
      UI.toast(
        `進入區域: ${CONFIG.biomes[Player.currentBiomeId].name}`,
        "gain"
      );
    } else if (Player.depth === 151) {
      Player.currentBiomeId = Player.biomeOrder[2];
      Player.biomeStartDepth = 151;
      UI.toast(
        `進入區域: ${CONFIG.biomes[Player.currentBiomeId].name}`,
        "gain"
      );
    } else if (Player.depth === 201) {
      Player.currentBiomeId = Player.biomeOrder[3];
      Player.biomeStartDepth = 201;
      UI.toast(
        `進入區域: ${CONFIG.biomes[Player.currentBiomeId].name}`,
        "gain"
      );
    } else if (Player.depth === 251) {
      Player.currentBiomeId = Player.biomeOrder[4];
      Player.biomeStartDepth = 251;
      UI.toast(
        `進入區域: ${CONFIG.biomes[Player.currentBiomeId].name}`,
        "gain"
      );
    } else if (Player.depth > 300 && (Player.depth - 301) % 50 === 0) {
      let pool = [
        "cave",
        "volcano",
        "tundra",
        "graveyard",
        "desert",
        "forest",
        "plains",
      ];
      pool = pool.filter((b) => b !== Player.currentBiomeId);
      Player.currentBiomeId = pool[Math.floor(Math.random() * pool.length)];
      Player.biomeStartDepth = Player.depth;
      UI.toast(
        `進入區域: ${CONFIG.biomes[Player.currentBiomeId].name}`,
        "gain"
      );
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

    let isBossFloor = false;
    if (Player.depth === 20) isBossFloor = true;
    else if (Player.depth === 50) isBossFloor = true;
    else if (Player.depth >= 100 && Player.depth % 50 === 0) isBossFloor = true;

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

    const descriptors = ["兇猛的", "飢餓的", "遊蕩的", "潛伏的"];
    const locations = [
      "擋住了去路",
      "從陰影中出現",
      "向你發出咆哮",
      "正注視著你",
    ];
    const desc = descriptors[Math.floor(Math.random() * descriptors.length)];
    const loc = locations[Math.floor(Math.random() * locations.length)];
    const enemyName = this.tempEnemy.name;
    const prefix = isElite ? "<span style='color:orange'>菁英</span> " : "";

    this.renderEvent(
      "遭遇敵人",
      this.tempEnemy.icon,
      `在 <b>${b.name}</b> 遭遇了 ${prefix}<b>${enemyName}</b>！<br>一隻${desc}${enemyName}${loc}。`,
      "⚔️ 戰鬥",
      () => {
        this.openScreen("combat-screen");
        BattleSystem.start(this.tempEnemy, this.tempIsElite);
      },
      "🏃 嘗試逃跑",
      () => {
        const chance = 0.6;
        if (Math.random() < chance) {
          UI.toast("你成功溜走了...", "gain");
          this.nextDepth();
        } else {
          UI.toast("逃跑失敗！被迫進入戰鬥！", "warn");
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
      `強大的氣息... <b>${t.name}</b> 出現了！<br>這將是一場艱難的戰鬥。`,
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
      `發現寶箱！<br>獲得：<span class="${CONFIG.rarity[i.rarity].color}">${
        i.name
      }</span><br>獲得金幣: <span class="gold-text">${g} G</span>`,
      "確認",
      () => {
        Game.nextDepth();
      }
    );
  },
  renderSetup() {
    const rD = document.getElementById("race-options");
    const cD = document.getElementById("class-options");
    rD.innerHTML = "";
    cD.innerHTML = "";
    for (let k in CONFIG.races) {
      const r = CONFIG.races[k];
      if (r.hidden && !GlobalSystem.data.unlockedRaces.includes(k)) continue;
      let b = document.createElement("div");
      b.className = "select-btn";
      let modTxt = [];
      if (r.mod.maxHp !== 1) modTxt.push(`HP×${r.mod.maxHp}`);
      if (r.mod.atk !== 1) modTxt.push(`攻×${r.mod.atk}`);
      if (r.mod.speed !== 1) modTxt.push(`速×${r.mod.speed}`);
      b.innerHTML = `<span class="btn-name">${
        r.name
      }</span><br><span class="btn-bonus">${modTxt.join(", ")}</span>`;
      if (r.hidden) b.style.color = "#ffd700";
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
      let bonTxt = [];
      if (c.bonus.maxHp)
        bonTxt.push(`HP${c.bonus.maxHp > 0 ? "+" : ""}${c.bonus.maxHp}`);
      if (c.bonus.atk)
        bonTxt.push(`攻${c.bonus.atk > 0 ? "+" : ""}${c.bonus.atk}`);
      if (c.bonus.speed)
        bonTxt.push(`速${c.bonus.speed > 0 ? "+" : ""}${c.bonus.speed}`);
      b.innerHTML = `<span class="btn-name">${
        c.name
      }</span><br><span class="btn-bonus">${
        bonTxt.join(", ") || c.desc
      }</span>`;
      if (c.hidden) b.style.color = "#ffd700";
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
        e.classList.toggle(
          "selected",
          r && e.querySelector(".btn-name").innerText === r.name
        )
      );
    document
      .querySelectorAll("#class-options .select-btn")
      .forEach((e) =>
        e.classList.toggle(
          "selected",
          c && e.querySelector(".btn-name").innerText === c.name
        )
      );
    const b = document.getElementById("btn-start-game");
    if (r && c) {
      document.getElementById(
        "setup-desc"
      ).innerHTML = `<strong>${r.name} ${c.name}</strong><br>${r.desc}<br>${c.desc}`;
      b.disabled = false;
    } else b.disabled = true;
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
    const stages = document.querySelectorAll(".game-stage");
    stages.forEach((s) => (s.style.display = "none"));
    const target = document.getElementById(id);
    if (target) target.style.display = "block";
  },
  closeAllScreens() {
    this.openScreen("event-screen");
  },
  updateHeader() {
    const b = this.getCurrentBiome();
    let depthTxt = `F: ${Player.depth}`;
    if (Player.currentWorld === "phantasm") depthTxt = `🌀 ${depthTxt}`;
    if (Player.currentWorld === "purgatory") depthTxt = `🔥 ${depthTxt}`;

    document.getElementById("header-depth").innerText = depthTxt;
    document.getElementById("header-gold").innerText = `💰 ${Player.gold}`;
    const rName = CONFIG.races[Player.race]
      ? CONFIG.races[Player.race].name
      : "";
    const cName = CONFIG.classes[Player.class]
      ? CONFIG.classes[Player.class].name
      : "";
    document.getElementById("header-name").innerText = `${rName} ${cName}`;
    document.getElementById("header-biome").innerText = `${b.name}`;
    document.getElementById("header-biome").style.color = b.color;

    document.getElementById("stat-hp").innerText = `${Math.floor(
      Player.currentHp
    )}/${Player.stats.maxHp}`;
    document.getElementById("stat-atk").innerText = Player.stats.atk;
    document.getElementById("stat-spd").innerText = Player.stats.speed;
    document.getElementById("stat-crit").innerText = `${Math.floor(
      (Player.stats.crit || 0.05) * 100
    )}%`;
    let defText = "";
    if (Player.stats.block > 0)
      defText += `格擋${Math.floor(Player.stats.block * 100)}% `;
    if (Player.stats.dodge > 0)
      defText += `閃避${Math.floor(Player.stats.dodge * 100)}% `;
    if (Player.stats.def > 0)
      defText += `減傷${Math.floor(Player.stats.def * 100)}% `;
    document.getElementById("stat-def").innerText = defText || "0%";

    const sRow = document.getElementById("stat-sanity-row");
    const kRow = document.getElementById("stat-karma-row");
    if (sRow) {
      if (Player.currentWorld === "phantasm") {
        sRow.style.display = "flex";
        document.getElementById("stat-sanity").innerText = Player.sanity;
      } else {
        sRow.style.display = "none";
      }
    }
    if (kRow) {
      if (Player.currentWorld === "purgatory") {
        kRow.style.display = "flex";
        document.getElementById("stat-karma").innerText = Player.karma;
      } else {
        kRow.style.display = "none";
      }
    }

    for (let s in Player.equipment) {
      const el = document.querySelector(`.mini-slot[data-slot="${s}"]`);
      const item = Player.equipment[s];
      if (el && item) {
        let statsStr = "";
        for (let k in item.stats) {
          let val = item.stats[k];
          if (val === 0) continue;
          let name = this.statNames[k] || k;
          if (
            k === "crit" ||
            k === "block" ||
            k === "dodge" ||
            k === "lifesteal"
          ) {
            val = Math.floor(val * 100) + "%";
          }
          statsStr += `${name}+${val}\n`;
        }
        el.title = `${item.name}\n--------\n${statsStr}`;
      }
    }

    const setsDiv = document.getElementById("active-sets");
    if (setsDiv) {
      let setTxt = [];
      for (let sid in Player.activeSets) {
        if (Player.activeSets[sid] >= 2)
          setTxt.push(`${CONFIG.sets[sid].name}(${Player.activeSets[sid]})`);
      }
      setsDiv.innerText = setTxt.join(", ");
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
    if (worldId === "phantasm") {
      UI.toast("🌌 進入了【幻界】", "gain");
      document.documentElement.style.setProperty("--bg-dark", "#1a0033");
      Player.sanity = 100;
    } else if (worldId === "purgatory") {
      UI.toast("🔥 墮入了【煉獄】", "warn");
      document.documentElement.style.setProperty("--bg-dark", "#330000");
      Player.currentHp = Player.stats.maxHp;
      Player.karma = 0;
    } else {
      document.documentElement.style.setProperty("--bg-dark", "#121212");
    }
    this.updateHeader();
    this.nextDepth();
  },
  leaveWorld() {
    UI.toast("理智耗盡... 回歸現實", "warn");
    Player.currentWorld = "normal";
    document.documentElement.style.setProperty("--bg-dark", "#121212");
    this.updateHeader();
    this.nextDepth();
  },
};

window.onload = () => Game.init();
