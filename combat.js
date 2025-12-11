/* combat.js - Fix v2 */

// 戰鬥日誌模板
const LOG_TEMPLATES = {
  attack: [
    "{atker} 向 {dfder} 發起進攻",
    "{atker} 揮舞武器斬向 {dfder}",
    "{atker} 迅猛地突襲 {dfder}",
  ],
  crit: ["這一擊勢大力沉，造成暴擊!", "致命一擊!", "弱點擊破!"],
  miss: ["{atker} 的攻擊落空了", "{dfder} 靈巧地閃過了"],
  block: ["{dfder} 格擋了傷害", "{dfder} 的護甲抵消了衝擊"],
};

function getNarrative(type, params) {
  const templates = LOG_TEMPLATES[type] || LOG_TEMPLATES["attack"];
  let text = templates[Math.floor(Math.random() * templates.length)];
  for (let key in params) text = text.replace(`{${key}}`, params[key]);
  return text;
}

const BattleSystem = {
  active: false,
  timer: null,
  enemy: null,
  THRESHOLD: 1000,
  combatStats: { critCount: 0 },

  // 初始化戰鬥
  start(template, isElite = false) {
    try {
      this.active = true;
      this.combatStats = { critCount: 0 };
      if (this.timer) clearInterval(this.timer);

      // 1. 數值計算 (包含防呆)
      let biome =
        CONFIG.biomes[Player.currentBiomeId] || CONFIG.biomes["plains"];
      let scaling =
        (biome.scaling || 1) *
        (1 + Math.max(0, Player.depth - biome.minDepth) * 0.02);

      if (Player.currentWorld === "phantasm") scaling = Math.pow(scaling, 1.2);
      else if (Player.currentWorld === "purgatory") scaling *= 2.0;
      if (isElite) scaling *= 1.5;
      if (template.type === "boss") scaling *= 3.0;

      // 確保速度至少為 1，防止除以零導致卡死
      const enemySpeed = Math.max(
        1,
        Math.floor((template.speed || 100) * (1 + Player.depth * 0.005))
      );

      this.enemy = {
        ...template,
        maxHp: Math.floor(template.baseHp * scaling),
        currentHp: Math.floor(template.baseHp * scaling),
        atk: Math.floor(template.baseAtk * scaling),
        speed: enemySpeed,
        gold: Math.floor(template.gold * scaling),
        actionGauge: 0,
        isElite: isElite,
      };

      // 2. UI 更新
      let pre = isElite ? "菁英 " : template.type === "boss" ? "👑 " : "";
      document.getElementById(
        "enemy-name"
      ).innerText = `${pre}${this.enemy.name} (Lv.${Player.depth})`;
      document.getElementById("enemy-icon").innerText = this.enemy.icon;

      // 重置按鈕狀態
      const btnSkip = document.getElementById("btn-combat-skip");
      if (btnSkip) {
        btnSkip.innerText = "⏩ 跳過動畫";
        btnSkip.disabled = false;
        btnSkip.onclick = () => this.skip();
      }

      const logBox = document.getElementById("combat-log");
      if (logBox) {
        logBox.innerHTML = "";
        this.log(
          '<div class="log-entry" style="color:#ffd700">⚔️ 戰鬥開始！</div>'
        );
      }

      // 3. 玩家狀態重算
      Player.actionGauge = 0;
      const style = CONFIG.classes[Player.class]
        ? CONFIG.classes[Player.class].style
        : "standard";
      if (style === "preemptive" || style === "stun_shot")
        Player.actionGauge = this.THRESHOLD;

      if (window.Game) Game.recalcPlayerStats();
      Player.currentHp = Math.min(Player.currentHp, Player.stats.maxHp);

      this.updateUI();

      // 4. 強制啟動計時器
      console.log("Battle started, timer initiating...");
      this.startAutoTimer();
    } catch (e) {
      console.error("Battle Start Error:", e);
      alert("戰鬥啟動失敗，請查看控制台或重整");
      this.active = false;
    }
  },

  startAutoTimer() {
    if (this.timer) clearInterval(this.timer);
    // 使用 50ms 間隔，確保效能與流暢度平衡
    this.timer = setInterval(() => {
      if (this.active) {
        this.nextTick();
      } else {
        clearInterval(this.timer);
      }
    }, 50);
  },

  // 時間推進邏輯
  nextTick() {
    try {
      if (!this.active) return;

      // 確保速度是有效數值
      let pSpd = Math.max(1, Player.stats.speed || 100);
      let eSpd = Math.max(1, this.enemy.speed || 100);

      // 計算 tick，避免無限大
      let tick = Math.min(
        (this.THRESHOLD - Player.actionGauge) / pSpd,
        (this.THRESHOLD - this.enemy.actionGauge) / eSpd
      );

      // 如果 tick 計算異常（例如已經超過閾值），強制給一個極小值推進
      if (tick <= 0 || !isFinite(tick)) tick = 0.1;

      Player.actionGauge += tick * pSpd;
      this.enemy.actionGauge += tick * eSpd;

      // 觸發行動
      if (Player.actionGauge >= this.THRESHOLD) {
        this.executeTurn(Player, this.enemy);
        Player.actionGauge -= this.THRESHOLD;
      }

      // 檢查是否戰鬥已結束 (防止敵人死後還攻擊)
      if (!this.active) return;

      if (
        this.enemy.currentHp > 0 &&
        this.enemy.actionGauge >= this.THRESHOLD
      ) {
        this.executeTurn(this.enemy, Player);
        this.enemy.actionGauge -= this.THRESHOLD;
      }

      this.updateUI();
      this.checkEnd();
    } catch (e) {
      console.error("Tick Error:", e);
      this.active = false; // 停止以防無限報錯
    }
  },

  // 執行回合 (攻擊)
  executeTurn(atker, dfder) {
    if (!this.active) return;

    const isP = atker === Player;
    const name = isP ? Player.name : this.enemy.name;
    const targetName = isP ? this.enemy.name : Player.name;
    const cInfo = CONFIG.classes[Player.class] || {};
    const style = isP ? cInfo.style : this.enemy.isElite ? "elite" : "standard";

    // 計算傷害
    let atkVal = atker.stats ? atker.stats.atk : atker.atk;
    let dmg = Math.floor(atkVal * (0.9 + Math.random() * 0.2));
    let trueDmg = atker.stats ? atker.stats.true_dmg || 0 : 0;

    // 職業特效
    if (isP && Player.class === "berserker")
      dmg = Math.floor(dmg * (1 + (1 - Player.currentHp / Player.stats.maxHp)));
    if (isP && Player.class === "merchant")
      dmg += Math.floor(Player.gold * 0.05);

    // 暴擊判定
    let isCrit = false;
    let cRate = atker.stats ? atker.stats.crit || 0.05 : 0.05;
    if (
      isP &&
      Player.class === "assassin" &&
      dfder.currentHp / dfder.maxHp < 0.3
    )
      isCrit = true;
    else if (Math.random() < cRate) isCrit = true;

    if (isCrit) {
      let cd = atker.stats ? atker.stats.crit_dmg || 1.5 : 1.5;
      dmg = Math.floor(dmg * cd);
      if (isP) this.combatStats.critCount++;
    }

    // 閃避判定
    let dRate = dfder.stats ? dfder.stats.dodge || 0 : 0;
    const trueStrike =
      isP && (style === "true_strike" || style === "double_cast");
    if (!trueStrike && Math.random() < dRate) {
      this.log(
        `<span style="color:#aaa">${getNarrative("miss", {
          atker: name,
          dfder: targetName,
        })}</span>`
      );
      return;
    }

    // 防禦減傷
    let defPct = dfder.stats ? dfder.stats.def || 0 : 0;
    let drPct = dfder.stats ? dfder.stats.damage_reduce || 0 : 0;
    let totalRed = Math.min(0.9, defPct + drPct);
    if (!trueStrike && totalRed > 0) dmg = Math.floor(dmg * (1 - totalRed));

    // 格擋判定
    let bRate = dfder.stats ? dfder.stats.block || 0 : 0;
    let isBlock = false;
    if (!trueStrike && Math.random() < bRate) {
      isBlock = true;
      dmg = Math.floor(dmg * 0.5);
      // 騎士反擊
      if (!isP && style === "counter_attack") {
        let cDmg = Math.floor(Player.stats.atk * 0.8);
        this.enemy.currentHp -= cDmg;
        UI.showDamage("enemy", cDmg);
        this.log(`<span style="color:#42a5f5">🛡️ 反擊! 造成 ${cDmg}</span>`);
      }
    }

    // 執行傷害扣除
    let totalDmg = Math.max(1, dmg + trueDmg);
    let hits = 1;
    if (isP && style === "multi_hit") hits = cInfo.hits || 2;
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

      let color = isP ? "#fff" : "#ef5350";
      let txt = isCrit ? "暴擊" : isBlock ? "格擋" : "攻擊";
      this.log(
        `<span style="color:${color}">${
          atker === Player ? "你" : this.enemy.name
        } ${txt} 造成 <b>${totalDmg}</b> 傷害</span>`
      );

      // 反傷
      let rRate = dfder.stats ? dfder.stats.reflect || 0 : 0;
      if (rRate > 0) {
        let rDmg = Math.floor(totalDmg * rRate);
        if (rDmg > 0) {
          atker.currentHp -= rDmg;
          UI.showDamage(isP ? "player" : "enemy", rDmg);
        }
      }

      // 吸血
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

    // 再生
    if (isP && Player.stats.hp_regen > 0) {
      Player.currentHp = Math.min(
        Player.stats.maxHp,
        Player.currentHp + Player.stats.hp_regen
      );
    }
  },

  // 跳過戰鬥 / 強制結束
  skip() {
    if (!this.active) return;
    this.log('<span style="color:orange">⚡ 快速結算中...</span>');
    this.enemy.currentHp = 0;
    this.updateUI();
    this.checkEnd(); // 手動觸發結束檢查
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
      Player.actionGauge = 0; // 懲罰
    }
  },

  // 檢查戰鬥結束 (最關鍵的修復部分)
  checkEnd() {
    // 1. 玩家死亡
    if (Player.currentHp <= 0) {
      this.active = false;
      if (this.timer) clearInterval(this.timer);

      // 確保血量顯示不為負
      Player.currentHp = 0;
      this.updateUI();

      if (Player.flags.mark_of_sin) {
        Game.enterWorld("purgatory");
        return;
      }

      GlobalSystem.checkLegacy(Player.inventory);
      GlobalSystem.data.totalDeaths++;
      GlobalSystem.save();

      this.log(
        '<div class="log-entry" style="color:red; font-weight:bold">你倒下了...</div>'
      );

      // 使用 setTimeout 確保 UI 渲染完畢後再彈出 alert
      setTimeout(() => {
        alert("你倒下了...\n(點擊確定重新開始)");
        location.reload();
      }, 500);
      return;
    }

    // 2. 敵人死亡
    else if (this.enemy.currentHp <= 0) {
      // 防止重複結算
      if (!this.active) return;

      this.active = false;
      if (this.timer) clearInterval(this.timer);

      // 確保敵人血量顯示不為負
      this.enemy.currentHp = 0;
      this.updateUI();

      // 獎勵結算
      let gBonus = Player.stats ? Player.stats.gold_drop || 1.0 : 1.0;
      let g = Math.floor(this.enemy.gold * gBonus);
      Player.gold += g;
      this.log(`<span style="color:yellow">戰鬥勝利！獲得 ${g} 金幣</span>`);

      // 掉落
      if (this.enemy.type === "boss") {
        if (Player.depth >= 300 && Math.random() < 0.1)
          Inventory.add(CONFIG.specialItems.soul_anchor);
        Game.completeBiome();
      } else if (this.enemy.mat) {
        Inventory.add({
          id: Date.now(),
          type: "material",
          ...CONFIG.materials[this.enemy.mat],
          rarity: "common",
        });
      }
      if (Math.random() < 0.3) Inventory.add(ItemSystem.generate());

      StorageSystem.saveGame();

      // 延遲跳轉下一層
      setTimeout(() => {
        try {
          // 檢查是否有覺醒
          const awk = window.EventDirector
            ? EventDirector.checkAwakening(this.combatStats)
            : null;
          if (awk) {
            Game.triggerAwakening(awk);
          } else {
            this.exitCombat();
          }
        } catch (e) {
          console.error("End Check Error:", e);
          // 如果出錯，強制離開
          this.exitCombat();
        }
      }, 800);
    }
  },

  exitCombat() {
    try {
      if (window.Game) {
        Game.openScreen("event-screen");
        Game.updateHeader();
        Game.nextDepth();
      } else {
        console.error("Game object missing!");
        location.reload(); // 嚴重錯誤，重整
      }
    } catch (e) {
      console.error("Exit Combat Failed:", e);
      // 如果自動跳轉失敗，將跳過按鈕變成手動離開按鈕
      const btn = document.getElementById("btn-combat-skip");
      if (btn) {
        btn.innerText = "🚪 離開戰鬥 (Debug)";
        btn.onclick = () => {
          document.getElementById("combat-screen").style.display = "none";
          document.getElementById("event-screen").style.display = "block";
          Game.nextDepth();
        };
      }
    }
  },

  updateUI() {
    try {
      const up = (p, c, m, g) => {
        const elBar = document.getElementById(`${p}-hp-bar`);
        const elTxt = document.getElementById(`${p}-hp-text`);
        const elAp = document.getElementById(`${p}-ap-bar`);

        // 視覺修正：不顯示負數，也不顯示超過100%
        const pct = Math.max(0, Math.min(100, (c / m) * 100));
        const apPct = Math.max(0, Math.min(100, (g / this.THRESHOLD) * 100));

        if (elBar) elBar.style.width = `${pct}%`;
        if (elTxt) elTxt.innerText = `${Math.max(0, Math.floor(c))}/${m}`; // 顯示文字也過濾負數
        if (elAp) elAp.style.width = `${apPct}%`;
      };
      up("player", Player.currentHp, Player.stats.maxHp, Player.actionGauge);
      up(
        "enemy",
        this.enemy.currentHp,
        this.enemy.maxHp,
        this.enemy.actionGauge
      );
    } catch (e) {
      // UI 更新失敗不應導致邏輯崩潰，忽略錯誤
    }
  },

  log(msg) {
    const b = document.getElementById("combat-log");
    if (!b) return;
    const div = document.createElement("div");
    div.className = "log-entry";
    div.innerHTML = msg;
    b.appendChild(div);
    if (b.children.length > 50) b.removeChild(b.firstChild);
    b.scrollTop = b.scrollHeight;
  },
};
