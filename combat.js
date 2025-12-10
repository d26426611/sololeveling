const LOG_TEMPLATES = {
  attack: [
    "{atker} 向 {dfder} 發起進攻",
    "{atker} 揮舞武器斬向 {dfder}",
    "{atker} 怒吼一聲，襲向 {dfder}",
    "{atker} 迅猛地突襲 {dfder}",
    "{atker} 尋找機會攻擊 {dfder}",
  ],
  crit: [
    "這一擊勢大力沉，造成暴擊",
    "{atker} 擊中了要害，暴擊",
    "毀滅性的一擊！暴擊",
  ],
  miss: [
    "{atker} 的攻擊落空了",
    "{dfder} 靈巧地閃過了攻擊",
    "{atker} 這一擊被看穿了",
  ],
  block: ["{dfder} 架起防禦，格擋了傷害", "{dfder} 的護甲抵消了部分衝擊"],
  skill: ["{atker} 施展了強力的技能", "{atker} 體內的魔力湧動"],
};

function getNarrative(type, params) {
  const templates = LOG_TEMPLATES[type] || LOG_TEMPLATES["attack"];
  let text = templates[Math.floor(Math.random() * templates.length)];
  for (let key in params) {
    text = text.replace(`{${key}}`, params[key]);
  }
  return text;
}

const BattleSystem = {
  active: false,
  autoMode: false,
  timer: null,
  enemy: null,
  THRESHOLD: 1000,
  combatStats: { critCount: 0 },

  start(template, isElite = false) {
    this.active = true;
    this.combatStats = { critCount: 0 };
    if (this.timer) clearInterval(this.timer);

    // New Scaling Logic (Staircase + Linear)
    let biome = CONFIG.biomes[Player.currentBiomeId] || CONFIG.biomes["plains"];

    // Base scaling from Biome (1.0, 2.0, 4.0, etc.)
    let baseScaling = biome.scaling;

    // Linear growth within biome (+2% per depth beyond minDepth)
    let biomeDepth = Math.max(0, Player.depth - biome.minDepth);
    let linearScaling = 1 + biomeDepth * 0.02;

    let scaling = baseScaling * linearScaling;

    // World Modifier
    if (Player.currentWorld === "phantasm") {
      scaling = Math.pow(scaling, 1.2); // Exponential growth
    } else if (Player.currentWorld === "purgatory") {
      scaling *= 2.0; // Harder base
    }

    if (isElite) scaling *= 1.5;
    if (template.type === "boss") scaling *= 3.0;

    this.enemy = {
      ...template,
      maxHp: Math.floor(template.baseHp * scaling),
      currentHp: Math.floor(template.baseHp * scaling),
      atk: Math.floor(template.baseAtk * scaling),
      speed: Math.floor(template.speed * (1 + Player.depth * 0.005)),
      gold: Math.floor(template.gold * scaling),
      actionGauge: 0,
      isElite: isElite,
    };

    let pre = isElite ? "菁英 " : template.type === "boss" ? "👑 " : "";
    document.getElementById(
      "enemy-name"
    ).innerText = `${pre}${this.enemy.name} (Lv.${Player.depth})`;
    document.getElementById("enemy-icon").innerText = this.enemy.icon;

    // Clear log and add start message
    const logBox = document.getElementById("combat-log");
    logBox.innerHTML = "";
    this.log(
      '<div class="log-entry" style="color:#ffd700">⚔️ 戰鬥開始！</div>'
    );

    Player.actionGauge = 0;
    const style = CONFIG.classes[Player.class].style;
    if (style === "preemptive" || style === "stun_shot")
      Player.actionGauge = this.THRESHOLD;

    Game.recalcPlayerStats();
    Player.currentHp = Math.min(Player.currentHp, Player.stats.maxHp);
    this.toggleButtons(true);

    if (document.getElementById("opt-skip-combat").checked) {
      this.autoResolve();
      document.getElementById("btn-combat-next").disabled = true;
    } else {
      this.autoMode = document.getElementById("opt-auto-combat").checked;
      if (this.autoMode) {
        this.startAutoTimer();
        document.getElementById("btn-combat-next").disabled = true;
      } else {
        document.getElementById("btn-combat-next").disabled = false;
      }
    }
  },

  startAutoTimer() {
    if (this.timer) clearInterval(this.timer);
    this.timer = setInterval(() => {
      if (this.active && this.autoMode) {
        this.nextTick();
      } else {
        clearInterval(this.timer);
      }
    }, 50);
  },

  escape() {
    if (!this.active) return;
    const chance = 0.5 + (Player.stats.speed - this.enemy.speed) * 0.002;
    if (Math.random() < chance) {
      UI.toast("逃跑成功!", "gain");
      this.active = false;
      if (this.timer) clearInterval(this.timer);
      this.exitCombat();
    } else {
      UI.toast("逃跑失敗!", "warn");
      this.updateUI();
      this.checkEnd();
    }
  },

  skip() {
    this.autoResolve();
  },

  nextTick() {
    if (!this.active) {
      if (this.timer) clearInterval(this.timer);
      return;
    }
    let pSpd = Math.max(1, Player.stats.speed);
    let eSpd = Math.max(1, this.enemy.speed);
    let tick = Math.min(
      Math.max(0, this.THRESHOLD - Player.actionGauge) / pSpd,
      Math.max(0, this.THRESHOLD - this.enemy.actionGauge) / eSpd
    );
    Player.actionGauge += tick * pSpd;
    this.enemy.actionGauge += tick * eSpd;

    if (Player.actionGauge >= this.THRESHOLD) {
      this.executeTurn(Player, this.enemy);
      Player.actionGauge -= this.THRESHOLD;
    }
    if (this.enemy.currentHp > 0 && this.enemy.actionGauge >= this.THRESHOLD) {
      this.executeTurn(this.enemy, Player);
      this.enemy.actionGauge -= this.THRESHOLD;
    }
    this.updateUI();
    this.checkEnd();
  },

  executeTurn(atker, dfder) {
    const isP = atker === Player;
    const name = isP ? Player.name : this.enemy.name;
    const targetName = isP ? this.enemy.name : Player.name;
    const style = isP
      ? CONFIG.classes[Player.class].style
      : this.enemy.isElite
      ? "elite"
      : "standard";

    let dmg = atker.stats ? atker.stats.atk : atker.atk;
    dmg = Math.floor(dmg * (0.9 + Math.random() * 0.2));

    // True Damage
    let trueDmg = atker.stats ? atker.stats.true_dmg || 0 : 0;

    if (isP && Player.class === "berserker")
      dmg = Math.floor(dmg * (1 + (1 - Player.currentHp / Player.stats.maxHp)));
    if (isP && Player.class === "merchant")
      dmg += Math.floor(Player.gold * 0.05);
    if (isP && style === "scaling_atk") {
      Player.stats.atk += Math.ceil(Player.baseStats.atk * 0.02);
      dmg = atker.stats.atk;
    }

    const trueStrike =
      isP && (style === "true_strike" || style === "double_cast");
    let isCrit = false;
    let cRate = atker.stats ? atker.stats.crit || 0.05 : 0.05;

    // Assassin Execute check
    if (
      isP &&
      Player.class === "assassin" &&
      dfder.currentHp / dfder.maxHp < 0.3
    )
      isCrit = true;
    else if (Math.random() < cRate) isCrit = true;

    if (isCrit) {
      // Crit Dmg Multiplier
      let cd = atker.stats ? atker.stats.crit_dmg || 1.5 : 1.5;
      dmg = Math.floor(dmg * cd);
      if (isP) this.combatStats.critCount++;
    }

    let dRate = dfder.stats ? dfder.stats.dodge || 0 : 0;
    if (!trueStrike && Math.random() < dRate) {
      this.log(
        `<span style="color:#aaa">${getNarrative("miss", {
          atker: name,
          dfder: targetName,
        })}！</span>`
      );
      return;
    }

    // Damage Reduction (Def + DamageReduce)
    let defPct = dfder.stats ? dfder.stats.def || 0 : 0;
    let drPct = dfder.stats ? dfder.stats.damage_reduce || 0 : 0;
    let totalRed = Math.min(0.9, defPct + drPct); // Cap at 90%
    if (!trueStrike && totalRed > 0) dmg = Math.floor(dmg * (1 - totalRed));

    let bRate = dfder.stats ? dfder.stats.block || 0 : 0;
    let isBlock = false;
    if (!trueStrike && Math.random() < bRate) {
      isBlock = true;
      dmg = Math.floor(dmg * 0.5);
      if (!isP && CONFIG.classes[Player.class].style === "counter_attack") {
        const cDmg = Math.floor(Player.stats.atk * 0.8);
        this.enemy.currentHp -= cDmg;
        UI.showDamage("enemy", cDmg);
        this.log(
          `<span style="color:#42a5f5">🛡️ 觸發反擊！造成 ${cDmg} 傷害</span>`
        );
      }
    }

    let totalDmg = Math.max(1, dmg + trueDmg);

    let hits = 1;
    if (isP && style === "multi_hit")
      hits = CONFIG.classes[Player.class].hits || 2;

    // Multi Hit Chance from stats
    let mChance = atker.stats ? atker.stats.multi_hit_chance || 0 : 0;
    if (Math.random() < mChance) hits++;

    for (let i = 0; i < hits; i++) {
      dfder.currentHp -= totalDmg;
      UI.showDamage(
        isP ? "enemy" : "player",
        totalDmg,
        isCrit ? "crit" : "damage"
      );
      UI.shake(isP ? "enemy" : "player");

      // Narrative Log
      let logColor = isP ? "#fff" : "#ef5350";
      let narrative = "";
      if (isCrit) {
        narrative = getNarrative("crit", { atker: name, dfder: targetName });
      } else if (isBlock) {
        narrative = getNarrative("block", { atker: name, dfder: targetName });
      } else {
        narrative = getNarrative("attack", { atker: name, dfder: targetName });
      }

      this.log(
        `<span style="color:${logColor}">${narrative}，造成 <b>${totalDmg}</b> 傷害</span>`
      );

      // Reflect
      let rRate = dfder.stats ? dfder.stats.reflect || 0 : 0;
      if (rRate > 0) {
        let rDmg = Math.floor(totalDmg * rRate);
        if (rDmg > 0) {
          atker.currentHp -= rDmg;
          UI.showDamage(isP ? "player" : "enemy", rDmg);
          this.log(`<span style="color:#aa00ff">⚡ 反彈傷害 ${rDmg}</span>`);
        }
      }

      if (isP && style === "stun_shot" && Math.random() < 0.2) {
        dfder.actionGauge = Math.max(0, dfder.actionGauge - 300);
        UI.toast("擊暈!", "gain");
      }
      if (isP && Player.stats.lifesteal > 0) {
        let heal = Math.floor(totalDmg * Player.stats.lifesteal);
        if (heal > 0) {
          Player.currentHp = Math.min(
            Player.stats.maxHp,
            Player.currentHp + heal
          );
          UI.showDamage("player", `+${heal}`, "heal");
        }
      }
      if (dfder.currentHp <= 0 || atker.currentHp <= 0) break;
    }

    if (isP && style === "double_cast" && Math.random() < 0.3) {
      UI.toast("連續詠唱!", "gain");
      Player.actionGauge += 1000;
    }

    // Extra Turn
    let et = atker.stats ? atker.stats.extra_turn || 0 : 0;
    if (isP && Math.random() < et) {
      Player.actionGauge += 1000;
      this.log("<b>⚡ 獲得額外回合！</b>");
    }

    if (isP && Player.stats.hp_regen > 0)
      Player.currentHp = Math.min(
        Player.stats.maxHp,
        Player.currentHp + Player.stats.hp_regen
      );
  },

  autoResolve() {
    let s = 0;
    while (this.active && s++ < 500) this.nextTick();
  },
  updateUI() {
    const up = (p, c, m, g) => {
      document.getElementById(`${p}-hp-bar`).style.width = `${Math.max(
        0,
        (c / m) * 100
      )}%`;
      document.getElementById(`${p}-hp-text`).innerText = `${Math.floor(
        c
      )}/${m}`;
      document.getElementById(`${p}-ap-bar`).style.width = `${Math.min(
        100,
        (g / this.THRESHOLD) * 100
      )}%`;
    };
    up("player", Player.currentHp, Player.stats.maxHp, Player.actionGauge);
    up("enemy", this.enemy.currentHp, this.enemy.maxHp, this.enemy.actionGauge);
  },
  checkEnd() {
    if (Player.currentHp <= 0) {
      this.active = false;
      this.toggleButtons(false);

      // Check Purgatory Entry
      if (Player.flags.mark_of_sin) {
        Game.enterWorld("purgatory");
        return;
      }

      GlobalSystem.checkLegacy(Player.inventory);
      GlobalSystem.data.totalDeaths++;
      GlobalSystem.save();
      setTimeout(() => {
        alert("你倒下了...");
        location.reload();
      }, 1000);
    } else if (this.enemy.currentHp <= 0) {
      this.active = false;
      this.toggleButtons(false);

      // Gold Drop Bonus
      let gBonus = Player.stats ? Player.stats.gold_drop || 1.0 : 1.0;
      let g = Math.floor(this.enemy.gold * gBonus);
      Player.gold += g;

      const awk = EventDirector.checkAwakening(this.combatStats);

      if (this.enemy.type === "boss") {
        if (Player.depth >= 300 && Math.random() < 0.1)
          Inventory.add(CONFIG.specialItems.soul_anchor);
        Game.completeBiome();
      } else if (this.enemy.mat)
        Inventory.add({
          id: Date.now(),
          type: "material",
          ...CONFIG.materials[this.enemy.mat],
          rarity: "common",
        });

      if (Math.random() < 0.3) Inventory.add(ItemSystem.generate());

      StorageSystem.saveGame();
      if (awk) setTimeout(() => Game.triggerAwakening(awk), 800);
      else setTimeout(() => this.exitCombat(), 800);
    }
  },
  exitCombat() {
    Game.openScreen("event-screen");
    Game.updateHeader();
    Game.nextDepth();
  },
  log(msg) {
    const b = document.getElementById("combat-log");
    const div = document.createElement("div");
    div.className = "log-entry";
    div.innerHTML = msg;
    b.appendChild(div);
    // Limit log entries to improve performance
    if (b.children.length > 50) {
      b.removeChild(b.firstChild);
    }
    b.scrollTop = b.scrollHeight;
  },
  toggleButtons(e) {
    document.getElementById("btn-combat-next").disabled = !e;
    document.getElementById("btn-combat-auto").disabled = !e;
  },
};
