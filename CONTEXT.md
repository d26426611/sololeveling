# 無盡爬塔：深淵傳說

Roguelite power-fantasy compulsion loop：自動戰鬥、獎勵揭曉是主要爽感來源，死亡透過傳承機制轉化為下一輪的起跑優勢。

## Language

**Dimension（次元）**:
遊戲中敘事上獨立、手工設計的特殊世界，目前指「地獄」（Purgatory，業力/懲罰主題）與「幻界」（Phantasm，理智/瘋狂主題）。次元有自己的怪物、王、掉落與規則，數量刻意維持少而精，不作為長期新鮮感的主要來源。
_Avoid_: World, realm（除非明確指一般生物群系）

**Procedural Modifier（程序化調整）**:
套用在次元或無盡循環之上的規則層（例如「傷害雙倍」「掉落 x3 但防禦歸零」），用資料表定義、由 Combat Modifier Pipeline 套用。用來取代「不斷手工做新內容」，是解決深層樓層（如第 500 層）新鮮感問題的主要手段。
_Avoid_: Buff/debuff（那是效果的性質，不是這個機制本身）

**Endless Loop（無盡循環）**:
玩家打完所有一般區域（7 個生物群系）的王之後進入的終局階段：不再有新區域可換，持續在最後一區重複迎戰區域王續進度。Procedural Modifier 與 Rift 只在此階段生效，避免干擾新手期的學習曲線。
_Avoid_: Endgame（範圍太模糊）

**Rift（裂隙）**:
無盡循環中極低機率（約 1/40 層）觸發的非自願事件，把玩家短暫拉進一個套用了 Procedural Modifier 的 Dimension 片段，持續數層後自動送回原本進度。與既有的「刻意進入次元」路徑（業力印記死亡、幻界之鑰）是互補而非取代關係——Rift 專門負責製造「意外驚喜」，刻意路徑負責「玩家主動追求」。
_Avoid_: Portal, gateway

**Mechanical Identity（機制身分）**:
一個 build（武器子類型/職業/種族組合）在戰鬥中實際「玩起來」的方式不同，而不只是數值大小不同。目前主要透過武器子類型體現：匕首=爆擊搖擺、戰斧=高爆發慢速、法杖=爆傷爆發、弓=先攻/速度、錘=坦克向、盾=純防禦。
_Avoid_: Build diversity（那是結果，這個詞指手段/現象本身）

**Combat Modifier（戰鬥修飾器）**:
Combat Modifier Pipeline 裡的一個掛載單元：帶有來源標籤（class / race / set / dimension）與掛載點（傷害計算、承傷、回合開始、擊殺等），是職業技能、種族特性、套裝加成、次元調整共用的唯一資料形狀。新增其中任何一種效果，就是新增一個 Combat Modifier，不寫新的專用程式碼路徑。
_Avoid_: Ability, effect, style（"style" 是舊版 `CONFIG.classes[x].style` 遺留命名，遷移後應統一用 Combat Modifier 稱呼）
