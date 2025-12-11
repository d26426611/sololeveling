/* combat.js - 自動回合日誌版 */

const BattleSystem = {
  active: false,
  enemy: null,
  turnCount: 0,
  logs: [],

  // 啟動戰鬥
  start(template, isElite = false) {
    this.active = true;
    this.turnCount = 0;
    this.logs = [];

    // 計算敵人屬性 (沿用原有的成長公式)
    let biome = CONFIG.biomes[Player.currentBiomeId] || CONFIG.biomes["plains"];
    let baseScaling = biome.scaling;
    let scaling = baseScaling * (1 + (Player.depth - biome.minDepth) * 0.02);

    if (Player.currentWorld === "phantasm") scaling = Math.pow(scaling, 1.2);
    if (Player.currentWorld === "purgatory") scaling *= 2.0;
    if (isElite) scaling *= 1.5;
    if (template.type === "boss") scaling *= 3.0;

    this.enemy = {
      ...template,
      maxHp: Math.floor(template.baseHp * scaling),
      currentHp: Math.floor(template.baseHp * scaling),
      atk: Math.floor(template.baseAtk * scaling),
      speed: Math.floor(template.speed * (1 + Player.depth * 0.005)),
      gold: Math.floor(template.gold * scaling),
      isElite: isElite,
    };

    // UI 初始化
    document.getElementById("enemy-name").innerText = `${
      isElite ? "菁英 " : ""
    }${this.enemy.name} (Lv.${Player.depth})`;
    document.getElementById("enemy-icon").innerText = this.enemy.icon;

    // 清空日誌並顯示開始訊息
    const logBox = document.getElementById("combat-log");
    logBox.innerHTML = "";
    this.log(`遭遇了 ${this.enemy.name} (HP: ${this.enemy.maxHp})！`, "sys");

    // 更新血條
    this.updateUI();

    // 切換按鈕狀態
    document.getElementById("btn-combat-end").style.display = "none";
    document.getElementById("combat-status-text").innerText =
      "⚡ 自動戰鬥進行中...";
    document.getElementById("combat-status-text").style.display = "block";

    // 啟動戰鬥循環
    this.battleLoop();
  },

  // 自動戰鬥主循環 (Async/Await)
  async battleLoop() {
    // 初始等待
    await this.sleep(800);

    while (this.active && Player.currentHp > 0 && this.enemy.currentHp > 0) {
      this.turnCount++;

      // 速度判定先手 (簡單版：速度高者先攻，若差距極大可二連擊，這裡採輪流制)
      let playerFirst = Player.stats.speed >= this.enemy.speed;

      if (playerFirst) {
        await this.executePlayerTurn();
        if (this.enemy.currentHp <= 0) break;
        await this.sleep(600);
        await this.executeEnemyTurn();
      } else {
        await this.executeEnemyTurn();
        if (Player.currentHp <= 0) break;
        await this.sleep(600);
        await this.executePlayerTurn();
      }

      await this.sleep(800); // 回合間隔
    }

    if (this.active) {
      this.endBattle();
    }
  },

  // 玩家回合
  async executePlayerTurn() {
    let dmg = Player.stats.atk;
    // 浮動傷害 90%~110%
    dmg = Math.floor(dmg * (0.9 + Math.random() * 0.2));

    // 職業特性與屬性計算
    const style = CONFIG.classes[Player.class].style;

    // 暴擊判定
    let isCrit = Math.random() < (Player.stats.crit || 0.05);
    if (isCrit) dmg = Math.floor(dmg * (Player.stats.crit_dmg || 1.5));

    // 閃避判定 (敵人閃避)
    // 這裡簡化：敵人閃避率預設 5%，精英 10%
    let enemyDodge = this.enemy.isElite ? 0.1 : 0.05;
    if (style === "true_strike") enemyDodge = 0; // 法師必中

    if (Math.random() < enemyDodge) {
      this.log(`你攻擊 ${this.enemy.name}，但是被閃開了！`, "p-atk");
      return;
    }

    // 真實傷害
    let trueDmg = Player.stats.true_dmg || 0;
    let finalDmg = Math.max(1, dmg + trueDmg);

    // 執行傷害
    this.enemy.currentHp -= finalDmg;
    this.updateUI();

    let critText = isCrit ? " <span class='val-crit'>(暴擊!)</span>" : "";
    this.log(
      `你對 ${this.enemy.name} 造成 <span class='val-dmg'>${finalDmg}</span>${critText} 傷害。`,
      "p-atk"
    );

    // 吸血
    if (Player.stats.lifesteal > 0) {
      let heal = Math.floor(finalDmg * Player.stats.lifesteal);
      if (heal > 0) {
        Player.currentHp = Math.min(
          Player.stats.maxHp,
          Player.currentHp + heal
        );
        this.log(
          `你吸取了 <span class='val-heal'>${heal}</span> 點生命。`,
          "p-atk"
        );
        this.updateUI();
      }
    }

    // 連擊判定 (職業特性)
    if (style === "multi_hit" || style === "double_cast") {
      if (Math.random() < 0.3) {
        // 30% 機率觸發連擊
        await this.sleep(300);
        let extraDmg = Math.floor(finalDmg * 0.5);
        this.enemy.currentHp -= extraDmg;
        this.log(
          `⚡ 追加攻擊！造成 <span class='val-dmg'>${extraDmg}</span> 傷害。`,
          "p-atk"
        );
        this.updateUI();
      }
    }
  },

  // 敵人回合
  async executeEnemyTurn() {
    let dmg = this.enemy.atk;
    dmg = Math.floor(dmg * (0.9 + Math.random() * 0.2));

    // 玩家閃避
    if (Math.random() < (Player.stats.dodge || 0)) {
      this.log(`你靈巧地閃過了 ${this.enemy.name} 的攻擊！`, "e-atk");
      return;
    }

    // 玩家格擋
    let isBlocked = false;
    if (Math.random() < (Player.stats.block || 0)) {
      isBlocked = true;
      dmg = Math.floor(dmg * 0.5); // 格擋減半
    }

    // 玩家減傷 (防禦力)
    let defReduce = Player.stats.def || 0; // 百分比減傷
    dmg = Math.floor(dmg * (1 - defReduce));
    dmg = Math.max(1, dmg);

    Player.currentHp -= dmg;
    this.updateUI();

    let blockText = isBlocked ? " <span class='val-block'>[格擋]</span>" : "";
    this.log(
      `${this.enemy.name} 攻擊你造成 <span class='val-dmg'>${dmg}</span>${blockText} 傷害。`,
      "e-atk"
    );

    // 反傷 (Reflect)
    if (Player.stats.reflect > 0) {
      let rDmg = Math.floor(dmg * Player.stats.reflect);
      if (rDmg > 0) {
        this.enemy.currentHp -= rDmg;
        this.log(
          `你的反甲造成 <span class='val-dmg'>${rDmg}</span> 反傷！`,
          "p-atk"
        );
        this.updateUI();
      }
    }
  },

  // 結算
  endBattle() {
    this.active = false;
    document.getElementById("combat-status-text").style.display = "none";

    if (Player.currentHp <= 0) {
      this.log("你倒下了...", "sys");
      // 死亡處理
      if (Player.flags.mark_of_sin) {
        setTimeout(() => Game.enterWorld("purgatory"), 1500);
      } else {
        GlobalSystem.data.totalDeaths++;
        GlobalSystem.save();
        setTimeout(() => {
          alert("勝敗乃兵家常事... (點擊確定重新挑戰)");
          location.reload();
        }, 1000);
      }
    } else {
      // 勝利
      let gBonus = Player.stats.gold_drop || 1.0;
      let gold = Math.floor(this.enemy.gold * gBonus);
      Player.gold += gold;

      this.log(
        `<br>戰鬥勝利！獲得 <span style='color:#ffd700'>${gold} G</span>`,
        "sys"
      );

      // 掉落
      if (this.enemy.mat) {
        Inventory.add({
          id: Date.now(),
          type: "material",
          ...CONFIG.materials[this.enemy.mat],
          rarity: "common",
        });
        this.log(`獲得素材: ${CONFIG.materials[this.enemy.mat].name}`, "sys");
      }

      // 裝備掉落
      if (Math.random() < 0.3) {
        const item = ItemSystem.generate();
        Inventory.add(item);
        this.log(
          `獲得裝備: <span class='${CONFIG.rarity[item.rarity].color}'>${
            item.name
          }</span>`,
          "sys"
        );
      }

      if (this.enemy.type === "boss") {
        Game.completeBiome();
      }

      // 顯示離開按鈕
      document.getElementById("btn-combat-end").style.display = "inline-block";
      StorageSystem.saveGame();
    }
  },

  finish() {
    // 點擊按鈕後離開戰鬥畫面
    Game.exitCombat();
  },

  // 輔助功能
  updateUI() {
    const pPct = (Player.currentHp / Player.stats.maxHp) * 100;
    const ePct = (this.enemy.currentHp / this.enemy.maxHp) * 100;

    document.getElementById("player-hp-bar").style.width = `${Math.max(
      0,
      pPct
    )}%`;
    document.getElementById("player-hp-text").innerText = `${Math.floor(
      Player.currentHp
    )}/${Player.stats.maxHp}`;

    document.getElementById("enemy-hp-bar").style.width = `${Math.max(
      0,
      ePct
    )}%`;
    document.getElementById("enemy-hp-text").innerText = `${Math.floor(
      this.enemy.currentHp
    )}/${this.enemy.maxHp}`;
  },

  log(msg, type) {
    const box = document.getElementById("combat-log");
    const div = document.createElement("div");
    div.className = `log-entry ${type}`;
    div.innerHTML = msg;
    box.appendChild(div);
    box.scrollTop = box.scrollHeight;
  },

  sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  },
};
