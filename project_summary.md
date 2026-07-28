# Project: 無盡爬塔：深淵傳說 (Endless Tower Climb: Abyss Legend)

單頁瀏覽器文字/圖示 RPG：角色創建、回合制戰鬥、物品與裝備管理、合成、鐵匠強化、商人交易、隨機事件、死亡傳承。

## 檔案結構

```
.
├── index.html          # 只載入 src/main.js (type="module")
├── style.css
└── src/
    ├── main.js          # 進場點
    ├── data/            # 遊戲數據 (CONFIG)：races/classes/biomes/monsters/items/sets/
    │                    # recipes/materials/events/rarity/affixes，index.js 匯總匯出
    ├── state/           # Player 狀態、GlobalSystem(跨周目資料/傳承)、playerStats(屬性重算)
    ├── systems/         # 無 DOM 依賴的遊戲邏輯：inventory/crafting/blacksmith/merchant/
    │                    # itemGenerator/combat/storage
    ├── ui/               # 純畫面渲染 + 事件委派：各分頁面板、事件畫面、戰鬥畫面、setup 畫面
    └── game/             # game.js(主控流程) + eventDirector.js(隨機事件)
```

模組間用 `import`/`export` 明確宣告依賴。避免循環 import 的地方（例如 combat.js／eventDirector.js
需要呼叫 game.js 的畫面流程函式）改用依賴注入：game.js 啟動時呼叫 `configureBattleSystem()` /
`configureEventDirector()` 把回呼函式注入進去，而不是讓底層系統直接 import 上層 controller。

## 核心系統

- **角色創建**：`ui/setupScreen.js` 渲染種族/職業選項（依 `GlobalSystem` 已解鎖清單過濾隱藏項目）。
- **戰鬥**：`systems/combat.js`，偷襲/正面迎戰/逃跑、速度判定回合制、暴擊/閃避/減傷/煉獄反噬等機制。
- **物品**：`systems/itemGenerator.js` 依深度用連續曲線（`data/rarity.js`）決定稀有度，取代舊版
  在深度 20/50/100 硬門檻造成前期落差過大的問題。
- **鐵匠 `systems/blacksmith.js`**：裝備強化，Lv1-5 純金幣、Lv6起需搭配「魔塵」(分解裝備取得)，
  軟上限 15 級。
- **商人 `systems/merchant.js`**：隨機事件觸發，可出售背包物品，也會隨深度生成一批可購買的貨品。
- **合成 `systems/crafting.js`**：依已發現素材解鎖配方。
- **死亡傳承**：`game/game.js` 的 `gameOver()` — 死亡時把裝備中最高稀有度的一件存入時空膠囊，
  並依本輪最大深度解鎖新的種族/職業，下一輪開局自動取回，是無限爬塔難度成長的核心平衡手段。
- **存讀檔**：`systems/storage.js`，localStorage 自動/手動存檔、匯出入 Base64 存檔代碼。

## 已知範圍外事項

隨機事件（`data/events.js`）的文字內容與選項設計维持原樣，之後再迭代擴充；此次重寫聚焦在
架構模組化、阻斷性 bug 修復（啟動失敗、畫面切換 id 對不上、合成分頁沒有按鈕等）、
找回並強化商人/鐵匠系統、以及數值平衡調整。

## 專案文件

- **`CONTEXT.md`**：領域詞彙表（Dimension、Procedural Modifier、Endless Loop、Rift、
  Mechanical Identity、Combat Modifier 等）。
- **`docs/adr/`**：架構決策紀錄，包含核心體驗定位、統一戰鬥修飾器管線的規劃、
  區域相對難度曲線公式，以及一個反覆出現的「級距重複計算」bug 模式（新增內容/倍率前建議先讀）。

## 平衡系統現況（2026 這輪調校後）

- 難度公式已改用「區域內相對深度」為主（見 `docs/adr/0004`），`biome.scaling` 已移除，
  避免與 `monsters.js` 本身的跨區域級距重複相乘。
- 平原（第一區）已用大量模擬驗證為可穩定通關；森林已驗證可完整走完全程、王戰進入
  「差一點就贏」的合理難度區間（跟平原王當初被修好前的狀態相同模式）；洞穴以後的 5 個區域
  已套用同一套一致曲線但尚未逐一模擬驗證到王戰。
- `true_dmg`／`reflect`／`lifesteal`／`sanity_regen`／`gold_drop`／`block` 六個原本定義了
  卻從未被讀取的 dead stat，這輪已全部接上實際戰鬥邏輯。
- 武器子類型（`data/weaponSubtypes.js`）與偏好武器加成已實作，讓不同 build 有機制上的差異
  （匕首爆擊流、法杖爆傷流、盾純防禦等），對應 `docs/adr/0001` 的機制身分設計方向。
