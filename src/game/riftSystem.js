// Rift（裂隙）：無盡循環中極低機率的非自願事件，把玩家短暫拉進一個套用了 Procedural
// Modifier 的既有次元(地獄/幻界)片段，持續數層後自動送回原本進度。跟既有的「刻意進入次元」
// 路徑（業力印記死亡、幻界之鑰，見 game.js 的 enterWorld/leaveWorld）完全獨立、互不影響——
// Rift 自己記錄進入前的快照並自己還原，不重用 enterWorld/leaveWorld 的狀態變更邏輯。
// 見 docs/adr/0002-procedural-dimension-modifiers-for-endless-freshness.md、CONTEXT.md 的 Rift 詞條。
import { Player } from "../state/player.js";
import { activateDimensionModifier, deactivateDimensionModifier, listDimensionModifiers } from "./dimensionModifiers.js";

export const RIFT_TRIGGER_CHANCE = 1 / 40;
export const RIFT_DURATION_FLOORS = 4;
const RIFT_DIMENSIONS = ["purgatory", "phantasm"];

export function canTriggerRift() {
  return Player.currentWorld === "normal" && Player.endlessLoopActive && !Player.rift;
}

export function isRiftActive() {
  return !!Player.rift;
}

// 強制觸發入口：略過機率骰，供測試與 rollForRift() 共用，滿足「稀有機率必須能被覆寫測試」的要求。
export function triggerRift(dimensionId, modifierId) {
  const snapshot = {
    currentWorld: Player.currentWorld,
    currentBiomeId: Player.currentBiomeId,
    biomeDepth: Player.biomeDepth,
    biomeIndex: Player.biomeIndex,
  };

  activateDimensionModifier(modifierId);
  Player.rift = { snapshot, modifierId, floorsRemaining: RIFT_DURATION_FLOORS };
  Player.currentWorld = dimensionId;
  Player.currentBiomeId = dimensionId;
  Player.biomeDepth = 0;
}

function randomDimension() {
  return RIFT_DIMENSIONS[Math.floor(Math.random() * RIFT_DIMENSIONS.length)];
}

function randomModifier() {
  const ids = listDimensionModifiers();
  return ids[Math.floor(Math.random() * ids.length)];
}

// 實際遊玩流程呼叫的機率骰入口；dimensionId/modifierId 可選，未指定時隨機挑選。
export function rollForRift(dimensionId, modifierId) {
  if (!canTriggerRift()) return false;
  if (Math.random() >= RIFT_TRIGGER_CHANCE) return false;
  triggerRift(dimensionId ?? randomDimension(), modifierId ?? randomModifier());
  return true;
}

function expireRift() {
  const { snapshot, modifierId } = Player.rift;
  deactivateDimensionModifier(modifierId);
  Player.currentWorld = snapshot.currentWorld;
  Player.currentBiomeId = snapshot.currentBiomeId;
  Player.biomeDepth = snapshot.biomeDepth;
  Player.biomeIndex = snapshot.biomeIndex;
  Player.rift = null;
}

// 每進一層呼叫一次；倒數到 0 時自動且精確地還原進入前的狀態。
export function tickRift() {
  if (!Player.rift) return;
  Player.rift.floorsRemaining--;
  if (Player.rift.floorsRemaining <= 0) expireRift();
}
