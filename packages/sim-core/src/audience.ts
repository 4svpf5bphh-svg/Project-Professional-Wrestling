import type { PromotionMarketState, WorldState } from "../../domain/src/types.js";

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * liveStrength is short/medium-term local heat; loyalty is the durable audience anchor.
 * Each PPW week, heat regresses a little toward loyalty so a hot or cold run matters
 * for future demand without becoming a permanent modifier. A 2% weekly pull gives
 * roughly a 34-week half-life to the gap between current heat and durable loyalty.
 */
export function decayAudienceMarketHeatForWeek(state: WorldState): void {
  for (const marketState of state.promotionMarketStates) {
    decayAudienceMarketHeat(marketState);
  }
}

export function decayAudienceMarketHeat(marketState: PromotionMarketState): void {
  const gap = marketState.loyalty - marketState.liveStrength;
  if (Math.abs(gap) < 0.05) return;
  marketState.liveStrength = Math.round(clamp(marketState.liveStrength + gap * 0.02, 2, 100) * 10) / 10;
}
