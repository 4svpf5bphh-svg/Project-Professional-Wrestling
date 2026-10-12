declare const process: { exitCode?: number };

import { promotionLiveAppearanceHistory } from "../packages/application/src/live-appearance-history.js";
import { DEFAULT_RULESET } from "../packages/config/src/default-ruleset.js";
import { createWorld } from "../packages/sim-core/src/index.js";
import type { LedgerEvent, PpwDate, WrestlingEvent } from "../packages/domain/src/types.js";

let passed = 0; let failed = 0;
function test(name: string, fn: () => void): void {
  try { fn(); passed++; console.log("PASS " + name); }
  catch (error) { failed++; console.error("FAIL " + name, error); }
}
function equal(actual: unknown, expected: unknown, message: string): void {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(message + ": expected " + JSON.stringify(expected) + ", got " + JSON.stringify(actual));
  }
}
function fixture(seed: number) {
  const state = createWorld(seed, DEFAULT_RULESET);
  const promotion = state.promotions.find((p) => p.tier === "INDEPENDENT" && p.lifecycle === "ACTIVE");
  if (!promotion) throw new Error("no active indie promotion");
  const promotionId = promotion.id;
  const personId = state.contracts.find((c) => c.promotionId === promotionId && c.status === "SIGNED")?.personId;
  if (!personId) throw new Error("no contracted indie wrestler");
  const date = (week: number): PpwDate => ({year: 1, week, day: 6});
  function completed(week: number, targetPromotionId = promotionId): WrestlingEvent {
    const market = state.markets[0]!, venue = state.venues[0]!;
    const event: WrestlingEvent = {
      id: `live-history-${seed}-${week}-${targetPromotionId}`,
      worldId: state.world.id, promotionId: targetPromotionId,
      marketId: market.id, venueId: venue.id, date: date(week),
      type: "REGULAR", status: "COMPLETED", ticketStrategy: "STANDARD",
      expectedDemand: 100, attendance: 100, ticketYield: 20, gateRevenue: 2000,
      totalCost: 1500, netResult: 500, eventImportance: 30, matchCount: 0,
      averageMatchRating: 0, bestMatchRating: 0, crowdResponse: 55,
    };
    state.events.push(event);
    return event;
  }
  function segment(event: WrestlingEvent, segmentType: string, participantIds: string): void {
    const entry: LedgerEvent = {
      id: "segment-history-" + state.ledger.length, worldId: state.world.id,
      date: {...event.date}, order: state.ledger.length + 1,
      type: "SHOW_SEGMENT_COMPLETED", significanceAtTime: "ROUTINE",
      historicalSignificance: "ROUTINE", entityIds: [event.id],
      payload: { eventId: event.id, promotionId: event.promotionId, segmentType, participantIds },
    };
    state.ledger.push(entry);
  }
  function appearance(event: WrestlingEvent, status: "COMPLETED" | "COMMITTED" | "CANCELLED" = "COMPLETED"): void {
    state.scheduledAppearances.push({
      id: `history-appearance-${state.scheduledAppearances.length}`,
      worldId: state.world.id, eventId: event.id, promotionId: event.promotionId,
      personId: personId!, contractId: state.contracts.find((c) => c.personId === personId)!.id,
      date: {...event.date}, serviceCapacityAtBooking: 1, status,
    });
  }
  return {state, promotionId, personId, completed, segment, appearance, date};
}

test("no live appearances means an eligible debut", () => {
  const f = fixture(91551);
  equal(promotionLiveAppearanceHistory(f.state, f.promotionId, f.personId, f.date(6)).status,
    "DEBUT_ELIGIBLE", "first appearance must remain available");
});
test("cryptic and named video teasers never consume debut history", () => {
  const f = fixture(91552), e = f.completed(2);
  f.segment(e, "VIDEO_PACKAGE", "");
  equal(promotionLiveAppearanceHistory(f.state, f.promotionId, f.personId, f.date(6)).status,
    "DEBUT_ELIGIBLE", "video did not debut the wrestler");
});
test("completed on-site appearance establishes the performer, then allows return after four weeks", () => {
  const f = fixture(91553), e = f.completed(2);
  f.appearance(e);
  f.segment(e, "PROMO", f.personId);
  const soon = promotionLiveAppearanceHistory(f.state, f.promotionId, f.personId, f.date(4));
  equal(soon.status, "ESTABLISHED", "two-week absence is not a comeback");
  equal(soon.appearanceCount, 1, "same show should not count twice");
  const later = promotionLiveAppearanceHistory(f.state, f.promotionId, f.personId, f.date(6));
  equal(later.status, "RETURN_ELIGIBLE", "four-week gap permits a return");
  equal(later.lastAppearanceDate, f.date(2), "last actual appearance date");
});
test("unfulfilled commitments cannot create debut history", () => {
  const f = fixture(91554), e = f.completed(2);
  f.appearance(e, "CANCELLED");
  const e2 = f.completed(3);
  f.appearance(e2, "COMMITTED");
  equal(promotionLiveAppearanceHistory(f.state, f.promotionId, f.personId, f.date(8)).status,
    "DEBUT_ELIGIBLE", "unfulfilled commitments are not appearances");
});
test("resolved live segment counts without a legacy ScheduledAppearance", () => {
  const f = fixture(91555), e = f.completed(1);
  f.segment(e, "INTERVIEW", f.personId);
  equal(promotionLiveAppearanceHistory(f.state, f.promotionId, f.personId, f.date(3)).status,
    "ESTABLISHED", "legacy resolved segment counts");
});
test("same-world appearances in a rival promotion never erase a local debut", () => {
  const f = fixture(91556);
  const rival = f.state.promotions.find((p) => p.id !== f.promotionId)!.id;
  f.appearance(f.completed(2,rival));
  equal(promotionLiveAppearanceHistory(f.state, f.promotionId, f.personId, f.date(8)).status,
    "DEBUT_ELIGIBLE", "a debut belongs to the promotion");
});
test("an appearance on the same show date never becomes earlier debut history", () => {
  const f = fixture(91558), e = f.completed(2);
  f.appearance(e);
  equal(promotionLiveAppearanceHistory(f.state, f.promotionId, f.personId, f.date(2)).status,
    "DEBUT_ELIGIBLE", "same show must be checked with slot-order validation separately");
});

test("return eligibility respects the PPW year boundary", () => {
  const f = fixture(91559), event = f.completed(52);
  f.appearance(event);
  equal(promotionLiveAppearanceHistory(f.state, f.promotionId, f.personId, {year:2,week:2,day:6}).status,
    "ESTABLISHED", "a two-week rollover is not a comeback");
  equal(promotionLiveAppearanceHistory(f.state, f.promotionId, f.personId, {year:2,week:4,day:6}).status,
    "RETURN_ELIGIBLE", "four weeks over the PPW year must count");
});

test("completed matches count even without a completed appearance ledger", () => {
  const f = fixture(91557), e = f.completed(2);
  f.state.matches.push({
    id: "live-historical-match", worldId: f.state.world.id, eventId: e.id,
    promotionId: f.promotionId, order: 1, type: "SINGLES", status: "COMPLETED",
    intent: "COMPETITIVE", plannedLengthMinutes: 12, actualLengthMinutes: 12,
    intendedWinnerSide: "A", actualWinnerSide: "A", finishChangedDueToInjury: false,
    executionQuality: 70, criticalRatingStars: 3, crowdResponse: 66,
  });
  f.state.matchParticipants.push({
    id: "live-historical-participant", worldId: f.state.world.id, matchId: "live-historical-match",
    eventId: e.id, personId: f.personId, side: "A", won: true,
  });
  equal(promotionLiveAppearanceHistory(f.state, f.promotionId, f.personId, f.date(3)).status,
    "ESTABLISHED", "match participant should be recorded");
});
console.log("\nLive appearance history: " + passed + " passed, " + failed + " failed");
if (failed) process.exitCode = 1;
