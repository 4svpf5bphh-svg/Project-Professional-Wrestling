import type { PromotionMarketState, WorldState } from "../../domain/src/types.js";

const SHOW_FLOW_STRENGTH_PER_CROWD_POINT = 0.1;
const MAX_SHOW_FLOW_STRENGTH_DELTA = 0.5;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

function sameWeek(left: { year: number; week: number }, right: { year: number; week: number }): boolean {
  return left.year === right.year && left.week === right.week;
}

function eventCompletedLedgerEntry(state: WorldState, eventId: string) {
  for (let index = state.ledger.length - 1; index >= 0; index -= 1) {
    const entry = state.ledger[index]!;
    if (entry.type === "EVENT_COMPLETED" && entry.entityIds.includes(eventId)) return entry;
  }
  return null;
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
  marketState.liveStrength = round1(clamp(marketState.liveStrength + gap * 0.02, 2, 100));
}

/**
 * Converts only the incremental show-flow adjustment into short-term local audience
 * heat after the normal event market update has already consumed attendance, ratings
 * and the base match-generated crowd response. This avoids double-counting match
 * quality while still letting card construction matter to the next visit.
 */
export function showFlowAudienceStrengthDelta(showFlowAdjustment: number): number {
  if (!Number.isFinite(showFlowAdjustment)) return 0;
  return round1(clamp(
    showFlowAdjustment * SHOW_FLOW_STRENGTH_PER_CROWD_POINT,
    -MAX_SHOW_FLOW_STRENGTH_DELTA,
    MAX_SHOW_FLOW_STRENGTH_DELTA,
  ));
}

/**
 * Applies the frozen current-week show-flow consequence exactly once. The effect is
 * intentionally restricted to liveStrength: show pacing can heat or cool a territory,
 * but durable loyalty and awareness remain governed by the established audience model.
 * Exact before/after values are retained on the event ledger for historical truth.
 */
export function applyCurrentWeekShowFlowAudienceConsequences(state: WorldState): number {
  let applied = 0;
  for (const event of state.events) {
    if (event.status !== "COMPLETED" || !sameWeek(event.date, state.world.currentDate)) continue;

    const eventLedger = eventCompletedLedgerEntry(state, event.id);
    if (!eventLedger || eventLedger.payload.showFlowFrozen !== true) continue;
    if (eventLedger.payload.showFlowAudienceApplied === true) continue;

    const adjustment = eventLedger.payload.showFlowAdjustment;
    if (typeof adjustment !== "number" || !Number.isFinite(adjustment)) continue;
    const local = state.promotionMarketStates.find((entry) => (
      entry.promotionId === event.promotionId && entry.marketId === event.marketId
    ));
    if (!local) continue;

    const before = local.liveStrength;
    const requestedDelta = showFlowAudienceStrengthDelta(adjustment);
    local.liveStrength = round1(clamp(before + requestedDelta, 2, 100));
    const appliedDelta = round1(local.liveStrength - before);

    eventLedger.payload.showFlowAudienceApplied = true;
    eventLedger.payload.showFlowAudienceStrengthDelta = appliedDelta;
    eventLedger.payload.showFlowAudienceStrengthBefore = before;
    eventLedger.payload.showFlowAudienceStrengthAfter = local.liveStrength;
    applied += 1;
  }
  return applied;
}
