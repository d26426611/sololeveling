# 難度公式改用「區域內相對深度」為主，而非全域絕對深度

模擬測試（數百輪自動化 playthrough）發現：跨區域時難度會斷崖式暴增，剛進新區域連一般小怪都幾乎立刻打死人，即使該區域的王本身已經個別調整過也一樣。追下去發現有兩層原因：

1. **舊公式 `depthScale = 1 + Player.depth * 0.05` 直接用全域深度**，代表玩家剛進森林(絕對深度 21)時，怪物強度是用「深度 21」去算，而不是「森林第 1 層」——完全繼承了在平原累積的深度加成，跟玩家實際在新區域的起跑點完全脫節。
2. **`biome.scaling`(1x→12x) 疊加在monsters.js 本來就已經逐區域遞增的 baseHp/baseAtk 之上**——monsters.js 的怪物數值本身已經編碼了跨區域的難度級距(平原史萊姆 30/5 一路到沙漠沙蟲 3000/250，已經是 100x/50x)，`biome.scaling` 再乘一次等於同一個級距被算了兩次，複合成 1200x 的落差。

決定：
- **拿掉 `biome.scaling`**，讓怪物 baseHp/baseAtk 本身單獨負責跨區域的難度級距，不再疊加第二層倍率。
- **`depthScale` 改成 `1 + biomeDepth*0.05 + priorJourneyDepth*0.01`**，其中 `priorJourneyDepth = Player.depth - Player.biomeDepth`（進入目前區域「之前」累積的深度，不是原始 `Player.depth`）。這讓每個區域開局時難度重新從接近基準線起跑（`biomeDepth*0.05` 這段歸零），同時保留一個很小的全域分量，讓「無盡爬塔」在同一區域反覆迴圈時難度仍會隨總樓層數緩慢爬升，不會永遠卡在同一個強度。

**易踩的陷阱**：對第一個區域（平原）而言，`biomeDepth` 恆等於 `Player.depth`（因為前面沒有其他區域）。如果 `priorJourneyDepth` 誤用原始 `Player.depth` 而不是 `depth - biomeDepth`，平原自己會被兩個分量重複計算，讓已經驗證過能打贏的平原王难度悄悄拉高。已經在模擬中踩過這個坑一次並修正——這正是這份 ADR 存在的原因：省得未來有人為了「加一點全域深度感」又寫回 `Player.depth`，重蹈覆轍。

## 怪物數值重新校準方法

`biome.scaling` 拿掉之後，各區域怪物的 baseHp/baseAtk 需要一次性重新校準，方法：
1. 以已經驗證過打得贏的平原王(`gnoll_king` 2000hp/100atk) 為基準點。
2. 目標：每個區域的王，「總難度」（`baseHp/baseAtk × depthScale × 王倍率`）大約是前一個區域的 2 倍，模擬對應「玩家在該區域累積 gear 之後大約能維持的難度追趕速度」。
3. 反推出每個區域王應有的 baseHp/baseAtk，套用到 `depthScale` 新公式上。
4. 該區域的一般怪與菁英怪，維持它們「相對於該區域王」原本的比例（例如平原 wolf_king 的 hp 是 gnoll_king 的 0.25 倍），套用到新的王數值上，藉此保留原作者對「同區域內一般/菁英/王」相對強度的設計，只修正「跨區域」的爬升速度。

計算與套用腳本：`/private/tmp/.../scratchpad/compute_curve.mjs` + `apply_curve.mjs`（一次性工具，不隨程式碼庫保留，但方法論記在這裡以便日後重新校準時複用）。
