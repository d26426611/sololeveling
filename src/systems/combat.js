import { CONFIG } from "../data/index.js";
import { Player } from "../state/player.js";
import { Inventory } from "./inventory.js";
import { ItemSystem } from "./itemGenerator.js";
import { StorageSystem } from "./storage.js";
import { applySanityLoss } from "../state/playerStats.js";
import { showCombatScreen } from "../ui/screens.js";
import { setEnemyDisplay, resetLog, logMessage, updateBars } from "../ui/combatScreen.js";
import { updatePlayerPanel } from "../ui/playerPanel.js";
import { toast } from "../ui/toast.js";
import { emit } from "./combatModifierPipeline.js";

// game.js 在啟動時透過 configureBattleSystem() 注入畫面流程回呼，避免 combat.js <-> game.js 循環 import。
let hooks = {
  renderEventStage: () => {},
  nextDepth: () => {},
  enterWorld: () => {},
  leaveWorld: () => {},
  gameOver: () => {},
  advanceBiome: () => {},
};

export function configureBattleSystem(injected) {
  hooks = { ...hooks, ...injected };
}

export const BattleSystem = {
  active: false,
  enemy: null,
  turnCount: 0,
  enemyStunned: false,

  encounter(enemyKey, isBoss = false, isElite = false) {
    const monster = CONFIG.monsters[enemyKey];
    if (!monster) return console.error("Monster not found:", enemyKey);

    const biome = CONFIG.biomes[Player.currentBiomeId];

    let html = `
        <div style="color:#aaa; font-style:italic; margin-bottom:10px;">${biome.desc}</div>
        <div style="text-align:center; padding:20px;">
            <div class="e-icon" style="font-size:5em; animation: float 3s infinite ease-in-out;">${monster.icon}</div>
            <h2 style="color:${isBoss ? "#ff5252" : "#fff"}">${isBoss ? "👑 " : ""}${monster.name}</h2>
            <p>${monster.desc}</p>
            <div style="font-size:0.9em; color:#888; margin-top:10px;">HP: ??? | 攻擊力: ???</div>
        </div>
    `;

    if (Player.currentWorld === "phantasm") {
      html += `<p style="color:#b39ddb; text-align:center;">⚠️ 凝視此生物消耗了你的理智...</p>`;
      applySanityLoss(isBoss ? 5 : 1);
      updatePlayerPanel();
      if (Player.sanity <= 0) {
        html += `<p style="color:red; font-weight:bold; text-align:center;">理智歸零！你陷入了瘋狂！(全屬性大幅下降)</p>`;
      }
    }

    let sneakChance = 0.3 + (Player.stats.speed - monster.speed) * 0.005;
    if (Player.class === "thief") sneakChance += 0.2;
    sneakChance = Math.min(0.8, Math.max(0, sneakChance));

    let btns = `<button class="btn-primary" data-action="fight">正面迎戰</button>`;
    btns += `<button class="btn-secondary" data-action="sneak">嘗試偷襲 (${Math.floor(sneakChance * 100)}%)</button>`;
    if (!isBoss) btns += `<button class="btn-danger" data-action="flee">逃跑</button>`;

    hooks.renderEventStage("遭遇強敵", monster.icon, html, btns, (action) => {
      if (action === "fight") this.start(enemyKey, isBoss, isElite, "normal");
      else if (action === "sneak") this.trySneak(enemyKey, isBoss, isElite, sneakChance);
      else if (action === "flee") this.flee();
    });
  },

  trySneak(key, boss, elite, chance) {
    if (Math.random() < chance) this.start(key, boss, elite, "sneak");
    else this.start(key, boss, elite, "ambush");
  },

  flee() {
    if (Math.random() < 0.6) {
      hooks.renderEventStage(
        "逃跑成功",
        "💨",
        "<p>你狼狽地逃離了戰場，沒有回頭。</p>",
        `<button class="btn-primary" data-action="continue">繼續前進</button>`,
        () => hooks.nextDepth()
      );
    } else {
      const dmg = Math.floor(Player.stats.maxHp * 0.1);
      Player.currentHp -= dmg;
      updatePlayerPanel();
      hooks.renderEventStage(
        "逃跑失敗",
        "💢",
        `<p>怪物追上了你並給了你一擊！<br>受到 <span style='color:red'>${dmg}</span> 傷害。</p>`,
        `<button class="btn-primary" data-action="continue">負傷離開</button>`,
        () => hooks.nextDepth()
      );
    }
  },

  async start(enemyKey, isBoss, isElite, mode) {
    this.active = true;
    this.turnCount = 0;
    this.enemyStunned = false;
    const template = CONFIG.monsters[enemyKey];

    const biome = CONFIG.biomes[Player.currentBiomeId];

    // 模擬測試延伸到森林區後發現：跨區域時難度會「斷崖式」暴增，而且不只是王 —— 剛進森林
    // 連一般小怪都幾乎立刻打死人。追下去發現這是同一種「級距重複算」的 bug，只是換一層：
    // monsters.js 裡每個區域的怪物 baseHp/baseAtk 本身就已經一路遞增(平原史萊姆 30/5 一路到
    // 沙漠沙蟲 3000/250，本身就是 100x/50x 的級距)，但 biome.scaling(1x→12x) 又在這之上
    // 再乘一次，兩者疊加變成 1200x 的落差——跟先前修過的「菁英/王倍率疊加」是同一種錯誤，
    // 只是發生在「區域」這一層。這裡拿掉 biomeScale，讓怪物本身的 base 數值單獨負責跨區域
    // 的難度級距，不再疊加第二次。
    //
    // depthScale 也一併改用「區域內相對深度」為主 (biomeDepth，每次換區域歸零)，避免剛進新
    // 區域時直接繼承整趟旅程累積的全域深度加成；但保留一個很小的「進入本區域之前，已經走了
    // 多少層」分量，讓「無盡循環」裡樓層數持續往上爬時戰鬥還是會漸漸變難。注意這裡用的是
    // `depth - biomeDepth`（進入當前區域之前的深度），不是原始 Player.depth —— 對第一個
    // 區域(平原)而言 biomeDepth 恆等於 depth，若直接用 Player.depth 會讓 0.05 跟 0.01 兩個
    // 分量同時疊加算到「平原自己的深度」上，等於又把已經驗證過的平原倍率重複計算了一次。
    const priorJourneyDepth = Player.depth - Player.biomeDepth;
    const depthScale = 1 + Player.biomeDepth * 0.05 + priorJourneyDepth * 0.01;

    // 王/菁英倍率維持先前模擬驗證過、平原王能在 10~15 下打完的數值不變 —— biomeScale 對平原
    // 本來就是 1x(無效果)，拿掉它不會改變平原的數字，只有 biomeScale>1 的後續區域才會變輕鬆，
    // 不需要也不應該連帶再調整這兩個已經驗證過的倍率，否則等於沒有隔離變因、平原可能又壞掉。
    this.enemy = {
      ...template,
      maxHp: Math.floor(template.baseHp * depthScale * (isBoss ? 0.15 : 1) * (isElite ? 0.25 : 1)),
      atk: Math.floor(template.baseAtk * depthScale * (isBoss ? 0.2 : 1) * (isElite ? 0.3 : 1)),
      speed: Math.floor(template.speed * (1 + Player.depth * 0.01)),
      gold: Math.floor(template.gold * depthScale * (biome.scaling || 1)),
      isBoss,
      isElite,
    };
    this.enemy.currentHp = this.enemy.maxHp;

    showCombatScreen();
    setEnemyDisplay(this.enemy);
    resetLog();

    if (mode === "sneak") logMessage(`你悄悄繞到了 ${this.enemy.name} 背後...`, "sys");
    else if (mode === "ambush") logMessage(`${this.enemy.name} 發現了你的意圖並發動突襲！`, "e-atk");
    else logMessage(`戰鬥開始！`, "sys");

    updateBars(this.enemy);
    updatePlayerPanel();

    await this.battleLoop(mode);
  },

  async battleLoop(mode) {
    if (mode === "sneak") {
      await this.playerTurn(1.5);
      if (this.enemy.currentHp <= 0) return this.win();
    } else if (mode === "ambush") {
      await this.enemyTurn();
      if (Player.currentHp <= 0) return this.lose();
    } else if (mode === "normal") {
      // 弓手「先制」：正面迎戰時搶在正常回合順序前先攻一次。
      const style = CONFIG.classes[Player.class]?.style;
      const startCtx = { style, mode, grantExtraTurn: false };
      emit("onCombatStart", startCtx);
      if (startCtx.grantExtraTurn) {
        logMessage(`${CONFIG.classes[Player.class].name}搶先出手！`, "sys");
        await this.playerTurn();
        if (this.enemy.currentHp <= 0) return this.win();
      }
    }

    while (this.active && Player.currentHp > 0 && this.enemy.currentHp > 0) {
      await this.wait(800);
      if (Player.stats.speed >= this.enemy.speed) {
        await this.playerTurn();
        if (this.enemy.currentHp <= 0) break;
        await this.wait(500);
        await this.resolveEnemyTurn();
        if (Player.currentHp <= 0) break;
      } else {
        await this.resolveEnemyTurn();
        if (Player.currentHp <= 0) break;
        if (this.enemy.currentHp <= 0) break; // 騎士反擊可能已經在敵人回合中致死
        await this.wait(500);
        await this.playerTurn();
      }
    }

    if (this.active) {
      if (Player.currentHp <= 0) this.lose();
      else this.win();
    }
  },

  // 遊俠「暈眩射擊」觸發時，敵人這回合會被跳過。
  async resolveEnemyTurn() {
    if (this.enemyStunned) {
      this.enemyStunned = false;
      logMessage(`${this.enemy.name} 暈眩中，無法行動！`, "sys");
      return;
    }
    await this.enemyTurn();
  },

  async playerTurn(mult = 1.0) {
    this.turnCount++;
    const style = CONFIG.classes[Player.class]?.style;

    // 牧師「回復」+ 通用 hp_regen 屬性（種族/套裝加成，原本是完全沒被套用過的 dead stat）。
    // 模擬測試發現：牧師沒有任何攻擊加成，戰鬥回合數天生比其他職業長，3% 回復量完全跟不上
    // 拉長的戰鬥累積傷害，是唯一一個從沒贏過王的組合、且輸的margin都很小 —— 加重牧師的
    // 招牌機制（回復）而不是給它攻擊力，才不會模糊掉「續航型職業」的機制身分。
    const turnStartCtx = { style, maxHp: Player.stats.maxHp, healAmount: 0, hits: 1, hitScale: 1 };
    emit("onTurnStart", turnStartCtx);
    const regen = (Player.stats.hp_regen || 0) + turnStartCtx.healAmount;
    if (regen > 0 && Player.currentHp < Player.stats.maxHp) {
      const healed = Math.min(regen, Player.stats.maxHp - Player.currentHp);
      Player.currentHp += healed;
      logMessage(`你恢復了 <span class='val-heal'>${healed}</span> HP`, "sys");
    }

    // 盜賊「連擊」/大魔導士「雙重詠唱」：一回合內攻擊兩次，每次傷害打折以免總傷害直接翻倍。
    const hits = turnStartCtx.hits;
    const hitScale = turnStartCtx.hitScale;

    for (let i = 0; i < hits; i++) {
      this.resolveHit(mult * hitScale, style);
      if (this.enemy.currentHp <= 0) break;
    }
    updateBars(this.enemy);
  },

  resolveHit(mult, style) {
    // 法師「必中」：捨棄較差的傷害浮動下限；賭徒「輪盤」：傷害浮動極端放大。
    const rollCtx = { style, rand: null };
    emit("rollDamage", rollCtx);
    const rand = rollCtx.rand ?? 0.9 + Math.random() * 0.2;
    let dmg = Math.floor(Player.stats.atk * mult * rand);

    const isCrit = Math.random() < Player.stats.crit;
    if (isCrit) dmg = Math.floor(dmg * (Player.stats.crit_dmg || 1.5));

    // 狂戰士「血怒」/聖騎士「愈戰愈強」/織夢者「操縱理智」/地獄騎士「業火打擊」。
    const beforeHitCtx = {
      style,
      dmg,
      hpPct: Player.currentHp / Player.stats.maxHp,
      turnCount: this.turnCount,
      world: Player.currentWorld,
      sanity: Player.sanity,
      karma: Player.karma || 0,
    };
    emit("beforePlayerHit", beforeHitCtx);
    dmg = beforeHitCtx.dmg;

    // 通用「真實傷害」屬性（火焰/沙暴/七宗罪套裝提供）：套裝資料裡定義了這個數值，
    // 但原本從沒被任何戰鬥邏輯讀取過，等於穿了也白穿。固定加在最終傷害之後，不受爆擊加成影響。
    if (Player.stats.true_dmg) dmg += Math.floor(Player.stats.true_dmg);

    if (Player.currentWorld === "purgatory") {
      const karmaDmg = Math.floor(dmg * 0.05);
      Player.currentHp -= karmaDmg;
      Player.karma = (Player.karma || 0) + karmaDmg;
      logMessage(`罪孽反噬：你受到了 ${karmaDmg} 點傷害`, "sys");
    }

    this.enemy.currentHp -= dmg;

    const critTxt = isCrit ? " <span class='val-crit'>(暴擊!)</span>" : "";
    logMessage(`你對 ${this.enemy.name} 造成 <span class='val-dmg'>${dmg}</span> 傷害${critTxt}。`, "p-atk");

    // 通用「吸血」屬性（沙暴詞綴/亡靈大軍/七宗罪套裝提供）：同樣是定義了卻從沒被讀取過的 dead stat。
    if (Player.stats.lifesteal > 0 && Player.currentHp < Player.stats.maxHp) {
      const healed = Math.min(Math.floor(dmg * Player.stats.lifesteal), Player.stats.maxHp - Player.currentHp);
      if (healed > 0) {
        Player.currentHp += healed;
        logMessage(`吸血恢復了 <span class='val-heal'>${healed}</span> HP`, "sys");
      }
    }

    // 暗影刺客「處決」/叢林遊俠「暈眩射擊」：兩者都只在敵人還活著時才有機會觸發。
    const afterHitCtx = {
      style,
      enemyHp: this.enemy.currentHp,
      enemyMaxHp: this.enemy.maxHp,
      executeDmg: 0,
      roll: Math.random(),
      stunned: false,
    };
    emit("afterPlayerHit", afterHitCtx);
    if (afterHitCtx.executeDmg > 0) {
      this.enemy.currentHp -= afterHitCtx.executeDmg;
      logMessage(`處決！額外造成 <span class='val-dmg'>${afterHitCtx.executeDmg}</span> 傷害`, "p-atk");
    }
    if (afterHitCtx.stunned) {
      this.enemyStunned = true;
      logMessage(`精準的箭矢讓 ${this.enemy.name} 踉蹌了一下！`, "sys");
    }
  },

  async enemyTurn() {
    let dmg = this.enemy.atk;

    if (Math.random() < Player.stats.dodge) {
      logMessage(`你閃過了 ${this.enemy.name} 的攻擊！`, "p-atk");
      return;
    }

    // 通用「格擋」屬性（盾牌/礦工/絕對零度套裝提供）：跟 dodge(完全避開)不同，
    // 是機率減半傷害而不是完全避開，原本也是定義了卻從沒被讀取過的 dead stat。
    let blocked = false;
    if (Player.stats.block > 0 && Math.random() < Player.stats.block) {
      dmg = Math.floor(dmg * 0.5);
      blocked = true;
    }

    const def = Player.stats.def || 0;
    dmg = Math.floor(dmg * (1 - def));

    if (Player.currentWorld === "phantasm" && Player.sanity <= 0) {
      dmg *= 2;
      logMessage(`因瘋狂而無法防禦！`, "sys");
    }

    // 次元 Procedural Modifier（例如「傷害雙倍」）掛勾點：敵人傷害算完閃避/格擋/防禦之後、
    // 扣血之前的最後調整層，跟玩家攻擊的 beforePlayerHit 對稱。
    const beforeEnemyHitCtx = { dmg };
    emit("beforeEnemyHit", beforeEnemyHitCtx);
    dmg = beforeEnemyHitCtx.dmg;

    Player.currentHp -= dmg;
    updateBars(this.enemy);
    const blockTxt = blocked ? " <span class='val-crit'>(格擋!)</span>" : "";
    logMessage(`${this.enemy.name} 攻擊造成 <span class='val-dmg'>${dmg}</span> 傷害${blockTxt}。`, "e-atk");

    // 通用「反傷」屬性（絕對零度套裝提供）：一樣是定義了卻從沒被讀取過的 dead stat，
    // 受到攻擊時把承受傷害的一部分彈回敵人身上。
    if (Player.stats.reflect > 0 && this.enemy.currentHp > 0) {
      const reflectDmg = Math.floor(dmg * Player.stats.reflect);
      if (reflectDmg > 0) {
        this.enemy.currentHp -= reflectDmg;
        updateBars(this.enemy);
        logMessage(`反傷造成 <span class='val-dmg'>${reflectDmg}</span> 傷害！`, "p-atk");
      }
    }

    // 皇家騎士「反擊」：受到攻擊後有機率立即回敬一擊。
    const style = CONFIG.classes[Player.class]?.style;
    const counterCtx = { style, playerHp: Player.currentHp, roll: Math.random(), atk: Player.stats.atk, counterDmg: 0 };
    emit("afterEnemyHit", counterCtx);
    if (counterCtx.counterDmg > 0) {
      this.enemy.currentHp -= counterCtx.counterDmg;
      updateBars(this.enemy);
      logMessage(`你反擊造成 <span class='val-dmg'>${counterCtx.counterDmg}</span> 傷害！`, "p-atk");
    }
  },

  win() {
    this.active = false;
    let dropTxt = "";

    // 通用「金幣加成」屬性（豪商職業提供 +0.5）：原本 win() 硬寫死判斷 style==='money_power'
    // 給固定 1.5 倍，卻完全沒讀 Player.stats.gold_drop 這個通用欄位本身，等於職業加成的
    // 屬性數值是裝飾用的、真正生效的是另一段寫死的邏輯。改成直接讀通用屬性，任何未來的
    // 種族/套裝/事件想給金幣加成，都只要疊加 gold_drop 這個屬性就好，不用再寫新的判斷式。
    let gold = Math.floor(this.enemy.gold * (Player.stats.gold_drop || 1.0));
    Player.gold += gold;
    dropTxt += `金幣 +${gold}<br>`;

    if (this.enemy.mat) {
      const mat = CONFIG.materials[this.enemy.mat];
      Inventory.add({ id: Date.now() + Math.random(), type: "material", baseName: mat.name, ...mat, rarity: mat.rarity || "common" });
      dropTxt += `素材: ${mat.name}<br>`;
    }

    if (Math.random() < 0.3 || this.enemy.isBoss || this.enemy.isElite) {
      const item = ItemSystem.generate(null, null, { elite: this.enemy.isElite });
      Inventory.add(item);
      dropTxt += `裝備: <span style="color:var(--rarity-${item.rarity})">${item.name}</span><br>`;
    }

    if (this.enemy.isBoss && Player.currentWorld === "purgatory") {
      dropTxt += "<br><strong>你成功淨化了罪孽，靈魂得以解脫。</strong>";
      setTimeout(() => hooks.leaveWorld(), 3000);
    } else if (this.enemy.isBoss && Player.currentWorld === "normal") {
      dropTxt += "<br><strong>區域王已被擊敗，前方出現了通往下一區域的道路。</strong>";
      hooks.advanceBiome();
    }

    updatePlayerPanel();
    hooks.renderEventStage(
      "戰鬥勝利",
      "🏆",
      "<p>敵人倒下了，化為塵埃。</p>",
      `<div style='margin-bottom:10px'>${dropTxt}</div><button class="btn-primary" data-action="continue">繼續冒險</button>`,
      () => hooks.nextDepth()
    );
    StorageSystem.saveGame();
  },

  lose() {
    this.active = false;

    // 罪惡印記(接受過惡魔契約)死亡時墮入煉獄，取代舊版「10% 亂數、for 測試設高」的臨時邏輯。
    if (Player.currentWorld === "normal" && Player.flags.mark_of_sin) {
      hooks.enterWorld("purgatory");
    } else if (Player.currentWorld === "phantasm") {
      hooks.leaveWorld(true);
    } else {
      hooks.renderEventStage(
        "你死了",
        "💀",
        "<p>視線逐漸模糊，你的旅程到此為止。</p>",
        `<button class="btn-danger" data-action="restart">接受命運</button>`,
        () => hooks.gameOver()
      );
    }
  },

  wait(ms) {
    const skip = document.getElementById("opt-skip-combat")?.checked;
    return new Promise((r) => setTimeout(r, skip ? 0 : ms));
  },
};
