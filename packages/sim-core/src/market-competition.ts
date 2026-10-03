import type { PromotionMarketState, WorldState, WrestlingEvent } from "../../domain/src/types.js";

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function marketState(state: WorldState, promotionId: string, marketId: string): PromotionMarketState | undefined {
  return state.promotionMarketStates.find((entry) => entry.promotionId === promotionId && entry.marketId === marketId);
}

function localAudiencePower(state: WorldState, promotionId: string, marketId: string): number {
  const local = marketState(state, promotionId, marketId);
  const promotion = state.promotions.find((entry) => entry.id === promotionId);
  if (!local || !promotion) return 0;
  const localStrength = local.liveStrength * 0.5 + local.awareness * 0.3 + local.loyalty * 0.2;
  return clamp(localStrength * 0.8 + promotion.mediaReach * 0.2, 0, 100);
}

function proximityWeight(dayGap: number): number {
  if (dayGap === 0) return 1;
  if (dayGap <= 2) return 0.85;
  if (dayGap <= 4) return 0.7;
  return 0.55;
}

/**
 * Converts same-market rival events in the same PPW week into a demand multiplier.
 * Competition is asymmetric: a locally powerful rival takes a larger bite than a
 * weak newcomer, while same-day clashes matter more than events several days apart.
 */
export function competitionDemandFactor(
  state: WorldState,
  event: WrestlingEvent,
  weekEvents: WrestlingEvent[],
): number {
  const targetPower = localAudiencePower(state, event.promotionId, event.marketId);
  let pressure = 0;

  for (const rival of weekEvents) {
    if (rival.id === event.id || rival.promotionId === event.promotionId) continue;
    if (rival.marketId !== event.marketId || rival.status === "CANCELLED") continue;
    if (rival.date.year !== event.date.year || rival.date.week !== event.date.week) continue;

    const rivalPower = localAudiencePower(state, rival.promotionId, rival.marketId);
    const relativeStrength = rivalPower / Math.max(1, targetPower + rivalPower);
    const basePressure = 0.035 + 0.22 * (rivalPower / 100) * (0.65 + 0.7 * relativeStrength);
    pressure += basePressure * proximityWeight(Math.abs(rival.date.day - event.date.day));
  }

  return clamp(1 / (1 + pressure), 0.58, 1);
}
