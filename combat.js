/* combat.js - 戰鬥系統 (適配 Data v2.0) */

const BattleSystem = {
  active: false,
  enemy: null,
  logs: [],

  // 1. 遭遇階段 (顯示資訊與選擇)
  encounter(enemyKey, isBoss = false, isElite = false) {
    const monster = CONFIG.monsters[enemyKey];
    if (!monster) return console.error("Monster not found:", enemyKey);

    const biome = CONFIG.biomes[Player.currentBiomeId];

    // 渲染遭遇介面
    let html = `
        <div style="color:#aaa; font-style:italic; margin-bottom:10px;">${
          biome.desc
        }</div>
        <div style="text-align:center; padding:20px;">
            <div class="e-icon" style="font-size:5em; animation: float 3s infinite ease-in-out;">${
              monster.icon
            }</div>
            <h2 style="color:${isBoss ? "#ff5252" : "#fff"}">${
      isBoss ? "👑 " : ""
    }${monster.name}</h2>
            <p>${monster.desc}</p>
            <div style="font-size:0.9em; color:#888; margin-top:10px;">
                HP: ??? | 攻擊力: ???
            </div>
        </div>
    `;

    // 幻界特殊邏輯：顯示理智消耗警告
    if (Player.currentWorld === "phantasm") {
      html += `<p style="color:#b39ddb; text-align:center;">⚠️ 凝視此生物消耗了你的理智...</p>`;
      Player.sanity = Math.max(0, Player.sanity - (isBoss ? 5 : 1));
      UI.updatePlayerPanel();
      if (Player.sanity <= 0) {
        html += `<p style="color:red; font-weight:bold; text-align:center;">理智歸零！你陷入了瘋狂！(全屬性大幅下降)</p>`;
      }
    }

    // 計算偷襲率
    let sneakChance = 0.3 + (Player.stats.speed - monster.speed) * 0.005;
    if (Player.class === "thief") sneakChance += 0.2;
    sneakChance = Math.min(0.8, Math.max(0, sneakChance));

    let btns = "";
    // 戰鬥按鈕
    btns += `<button class="btn-primary" onclick="BattleSystem.start('${enemyKey}', ${isBoss}, ${isElite}, 'normal')">正面迎戰</button>`;

    // 偷襲按鈕 (成功率顯示)
    btns += `<button class="btn-secondary" onclick="BattleSystem.trySneak('${enemyKey}', ${isBoss}, ${isElite}, ${sneakChance})">嘗試偷襲 (${Math.floor(
      sneakChance * 100
    )}%)</button>`;

    // 逃跑按鈕 (Boss 不可逃)
    if (!isBoss) {
      btns += `<button class="btn-danger" onclick="BattleSystem.flee()">逃跑</button>`;
    }

    Game.renderEventStage("遭遇強敵", html, btns);
  },

  trySneak(key, boss, elite, chance) {
    if (Math.random() < chance) {
      this.start(key, boss, elite, "sneak"); // 偷襲成功：玩家先攻 + 傷害加成
    } else {
      this.start(key, boss, elite, "ambush"); // 偷襲失敗：被偷襲 (怪物先攻)
    }
  },

  flee() {
    if (Math.random() < 0.6) {
      Game.renderEventStage(
        "逃跑成功",
        "<p>你狼狽地逃離了戰場，沒有回頭。</p>",
        `<button class="btn-primary" onclick="Game.nextDepth()">繼續前進</button>`
      );
    } else {
      // 逃跑失敗，強制進入戰鬥且被偷襲
      // 這裡需要知道原本的怪是誰，比較複雜，簡化處理：扣血後離開
      const dmg = Math.floor(Player.stats.maxHp * 0.1);
      Player.currentHp -= dmg;
      UI.updatePlayerPanel();
      Game.renderEventStage(
        "逃跑失敗",
        `<p>怪物追上了你並給了你一擊！<br>受到 <span style='color:red'>${dmg}</span> 傷害。</p>`,
        `<button class="btn-primary" onclick="Game.nextDepth()">負傷離開</button>`
      );
    }
  },

  // 2. 戰鬥初始化
  async start(enemyKey, isBoss, isElite, mode) {
    this.active = true;
    const template = CONFIG.monsters[enemyKey];

    // 難度成長公式
    let biome = CONFIG.biomes[Player.currentBiomeId];
    let depthScale = 1 + Player.depth * 0.05; // 每層 +5%
    let biomeScale = biome.scaling; // 區域倍率 (煉獄50倍, 幻界30倍)

    // 計算最終屬性
    this.enemy = {
      ...template,
      maxHp: Math.floor(
        template.baseHp *
          depthScale *
          biomeScale *
          (isBoss ? 5 : 1) *
          (isElite ? 2 : 1)
      ),
      atk: Math.floor(
        template.baseAtk *
          depthScale *
          biomeScale *
          (isBoss ? 1.5 : 1) *
          (isElite ? 1.2 : 1)
      ),
      speed: Math.floor(template.speed * (1 + Player.depth * 0.01)),
      gold: Math.floor(template.gold * depthScale * biomeScale),
      isBoss: isBoss,
      isElite: isElite,
    };
    this.enemy.currentHp = this.enemy.maxHp;

    // UI 切換
    document.getElementById("event-layer").style.display = "none";
    document.getElementById("combat-layer").style.display = "flex";

    document.getElementById("enemy-name").innerText = this.enemy.name;
    document.getElementById("enemy-icon").innerText = this.enemy.icon;

    // 清空日誌
    const logBox = document.getElementById("combat-log");
    logBox.innerHTML = "";

    // 開場白
    if (mode === "sneak")
      this.log(`你悄悄繞到了 ${this.enemy.name} 背後...`, "sys");
    else if (mode === "ambush")
      this.log(`${this.enemy.name} 發現了你的意圖並發動突襲！`, "e-atk");
    else this.log(`戰鬥開始！`, "sys");

    this.updateBars();

    // 戰鬥循環
    await this.battleLoop(mode);
  },

  // 3. 戰鬥主循環
  async battleLoop(mode) {
    // 偷襲/被偷襲的首回合處理
    if (mode === "sneak") {
      await this.playerTurn(1.5); // 1.5倍傷害
      if (this.enemy.currentHp <= 0) {
        this.win();
        return;
      }
    } else if (mode === "ambush") {
      await this.enemyTurn();
      if (Player.currentHp <= 0) {
        this.lose();
        return;
      }
    }

    while (this.active && Player.currentHp > 0 && this.enemy.currentHp > 0) {
      await this.wait(800);

      // 速度判定
      if (Player.stats.speed >= this.enemy.speed) {
        await this.playerTurn();
        if (this.enemy.currentHp <= 0) break;
        await this.wait(500);
        await this.enemyTurn();
      } else {
        await this.enemyTurn();
        if (Player.currentHp <= 0) break;
        await this.wait(500);
        await this.playerTurn();
      }
    }

    if (this.active) {
      if (Player.currentHp <= 0) this.lose();
      else this.win();
    }
  },

  async playerTurn(mult = 1.0) {
    let dmg = Math.floor(Player.stats.atk * mult * (0.9 + Math.random() * 0.2));

    // 暴擊
    let isCrit = Math.random() < Player.stats.crit;
    if (isCrit) dmg = Math.floor(dmg * 1.5);

    // 職業特技：狂戰士 (血越低越痛)
    if (CONFIG.classes[Player.class].style === "blood_rage") {
      let hpPct = Player.currentHp / Player.stats.maxHp;
      if (hpPct < 0.5) dmg = Math.floor(dmg * (1 + (0.5 - hpPct)));
    }

    // 煉獄懲罰：攻擊時受到反傷 (罪孽值模擬)
    if (Player.currentWorld === "purgatory") {
      let karmaDmg = Math.floor(dmg * 0.05); // 5% 反傷
      Player.currentHp -= karmaDmg;
      this.log(`罪孽反噬：你受到了 ${karmaDmg} 點傷害`, "sys");
    }

    this.enemy.currentHp -= dmg;
    this.updateBars();

    let critTxt = isCrit ? " <span class='val-crit'>(暴擊!)</span>" : "";
    this.log(
      `你對 ${this.enemy.name} 造成 <span class='val-dmg'>${dmg}</span> 傷害${critTxt}。`,
      "p-atk"
    );
  },

  async enemyTurn() {
    let dmg = this.enemy.atk;

    // 閃避
    if (Math.random() < Player.stats.dodge) {
      this.log(`你閃過了 ${this.enemy.name} 的攻擊！`, "p-atk");
      return;
    }

    // 減傷
    let def = Player.stats.def || 0;
    dmg = Math.floor(dmg * (1 - def));

    // 幻界懲罰：理智過低受傷加倍
    if (Player.currentWorld === "phantasm" && Player.sanity <= 0) {
      dmg *= 2;
      this.log(`因瘋狂而無法防禦！`, "sys");
    }

    Player.currentHp -= dmg;
    this.updateBars();
    this.log(
      `${this.enemy.name} 攻擊造成 <span class='val-dmg'>${dmg}</span> 傷害。`,
      "e-atk"
    );
  },

  win() {
    this.active = false;
    let drops = [];
    let dropTxt = "";

    // 金幣
    let gold = this.enemy.gold;
    // 豪商加成
    if (CONFIG.classes[Player.class].style === "money_power")
      gold = Math.floor(gold * 1.5);

    Player.gold += gold;
    dropTxt += `金幣 +${gold}<br>`;

    // 素材掉落 (必掉)
    if (this.enemy.mat) {
      let mat = CONFIG.materials[this.enemy.mat];
      Inventory.add({
        id: Date.now(),
        type: "material",
        baseName: mat.name,
        ...mat,
        rarity: mat.rarity || "common",
      });
      dropTxt += `素材: ${mat.name}<br>`;
    }

    // 裝備掉落 (機率)
    if (Math.random() < 0.3 || this.enemy.isBoss) {
      let item = ItemSystem.generate();
      Inventory.add(item);
      dropTxt += `裝備: <span style="color:var(--rarity-${item.rarity})">${item.name}</span><br>`;
    }

    // Boss 處理 (區域通關 / 鑰匙掉落)
    if (this.enemy.isBoss) {
      // 若是區域 BOSS，可能掉落幻界鑰匙碎片
      if (Player.currentWorld === "normal") {
        // 邏輯省略，可在此加入碎片掉落
      }
      if (Player.currentWorld === "purgatory") {
        // 擊敗煉獄 BOSS -> 脫離煉獄
        dropTxt += "<br><strong>你成功淨化了罪孽，靈魂得以解脫。</strong>";
        setTimeout(() => Game.leaveWorld(), 3000);
      }
    }

    Game.renderEventStage(
      "戰鬥勝利",
      "<p>敵人倒下了，化為塵埃。</p>",
      `<div style='margin-bottom:10px'>${dropTxt}</div><button class="btn-primary" onclick="Game.nextDepth()">繼續冒險</button>`
    );
    StorageSystem.saveGame();
  },

  lose() {
    this.active = false;

    // 惡魔契約判定：若死亡且有機率 -> 墮入煉獄
    if (Player.currentWorld === "normal" && Math.random() < 0.1) {
      // 這裡為了測試設高一點，實際可設 0.01
      Game.enterWorld("purgatory");
    } else if (Player.currentWorld === "phantasm") {
      // 幻界死亡 -> 回歸現實，扣血
      Game.leaveWorld(true); // true = 死亡懲罰
    } else {
      // 真的死亡
      Game.renderEventStage(
        "你死了",
        "<p>視線逐漸模糊，你的旅程到此為止。</p>",
        `<button class="btn-danger" onclick="StorageSystem.hardReset()">重新開始</button>`
      );
      // 這裡應該清除存檔
    }
  },

  log(msg, type) {
    const b = document.getElementById("combat-log");
    b.innerHTML += `<div class="log-entry ${type}">${msg}</div>`;
    b.scrollTop = b.scrollHeight;
  },

  updateBars() {
    const pPct = Math.max(0, (Player.currentHp / Player.stats.maxHp) * 100);
    const ePct = Math.max(0, (this.enemy.currentHp / this.enemy.maxHp) * 100);
    document.getElementById("player-hp-bar").style.width = pPct + "%";
    document.getElementById("player-hp-text").innerText = `${Math.floor(
      Player.currentHp
    )}/${Player.stats.maxHp}`;
    document.getElementById("enemy-hp-bar").style.width = ePct + "%";
    document.getElementById("enemy-hp-text").innerText = `${Math.floor(
      this.enemy.currentHp
    )}/${this.enemy.maxHp}`;
    UI.updatePlayerPanel();
  },

  wait(ms) {
    return new Promise((r) => setTimeout(r, ms));
  },
};
