declare const process: { exitCode?: number };

import { createWorld } from "../packages/sim-core/src/index.js";
import { DEFAULT_RULESET } from "../packages/config/src/default-ruleset.js";
import { addPpwWeeks } from "../packages/sim-core/src/clock.js";
import { latestPromotionLiveAppearance, validateLiveAppearanceHistory } from "../packages/sim-core/src/live-appearance-history.js";
import type { WrestlingEvent } from "../packages/domain/src/types.js";

let passed = 0; let failed = 0;
function ok(value: unknown, explanation: string): void { if (!value) throw new Error(explanation); }
function test(name: string, action: () => void): void {
  try { action(); console.log("PASS " + name); passed++; }
  catch (error) { console.error("FAIL " + name, error); failed++; }
}
function throwsContaining(action: () => void, phrase: string): void {
  let message = ""; try { action(); } catch (error) { message = error instanceof Error ? error.message : String(error); }
  ok(message.includes(phrase), "expected " + phrase + ", got " + message);
}
function fixture(seed: number) {
  const state = createWorld(seed, DEFAULT_RULESET);
  const promotion = state.promotions.find((entry) => entry.tier === "INDEPENDENT" && entry.lifecycle === "ACTIVE")!;
  const wrestler = state.people.find((entry) => entry.status === "ACTIVE")!;
  const market = state.markets[0]!, venue = state.venues[0]!;
  const date = { year: 1, week: 2, day: 6 };
  const event: WrestlingEvent = {
    id: "live-history-test", worldId: state.world.id, promotionId: promotion.id,
    marketId: market.id, venueId: venue.id, date, type: "REGULAR", status: "COMPLETED",
    ticketStrategy: "STANDARD", expectedDemand: 100, attendance: 100,
    ticketYield: 20, gateRevenue: 2000, totalCost: 1500, netResult: 500,
    eventImportance: 50, matchCount: 0, averageMatchRating: 0, bestMatchRating: 0, crowdResponse: 60,
  };
  return { state, promotion, wrestler, event };
}

test("a clean in-person promotion debut is allowed without historical appearances", () => {
  const { state, promotion, wrestler } = fixture(82011);
  validateLiveAppearanceHistory(state, promotion.id, wrestler.id, { year: 1, week: 3, day: 6 }, "DEBUT");
  throwsContaining(() => validateLiveAppearanceHistory(state, promotion.id, wrestler.id, { year: 1, week: 3, day: 6 }, "RETURN"), "earlier live appearance");
});

test("a completed on-site appearance blocks a second debut and requires four weeks for return", () => {
  const { state, promotion, wrestler, event } = fixture(82012);
  state.events.push(event);
  state.scheduledAppearances.push({
    id: "actual-show-person", worldId: state.world.id, eventId: event.id,
    promotionId: promotion.id, personId: wrestler.id, contractId: "historic-contract",
    date: event.date, serviceCapacityAtBooking: 1, status: "COMPLETED",
  });
  const shortlyAfter = addPpwWeeks(event.date, 2, state.ruleset.weeksPerYear);
  const returnDate = addPpwWeeks(event.date, 4, state.ruleset.weeksPerYear);
  ok(latestPromotionLiveAppearance(state, promotion.id, wrestler.id, returnDate)?.week === event.date.week, "historical live debut missing");
  throwsContaining(() => validateLiveAppearanceHistory(state, promotion.id, wrestler.id, returnDate, "DEBUT"), "previous completed");
  throwsContaining(() => validateLiveAppearanceHistory(state, promotion.id, wrestler.id, shortlyAfter, "RETURN"), "at least 4");
  validateLiveAppearanceHistory(state, promotion.id, wrestler.id, returnDate, "RETURN");
});

test("a cryptic video is not an appearance or a return, and another promotion's appearances do not count", () => {
  const { state, promotion, wrestler, event } = fixture(82013);
  state.events.push(event);
  state.ledger.push({
    id: "video-historical",
    worldId: state.world.id, date: event.date, type: "SHOW_SEGMENT_COMPLETED",
    order: state.ledger.length + 1, significanceAtTime: "ROUTINE", historicalSignificance: "ROUTINE",
    entityIds: [event.id, promotion.id, wrestler.id],
    payload: { eventId: event.id, promotionId: promotion.id, segmentType: "VIDEO_PACKAGE", participantIds: "", videoSubjectPersonId: wrestler.id },
  });
  const future = addPpwWeeks(event.date, 5, state.ruleset.weeksPerYear);
  ok(latestPromotionLiveAppearance(state, promotion.id, wrestler.id, future) === null, "video wrongly counted as physical debut");
  validateLiveAppearanceHistory(state, promotion.id, wrestler.id, future, "DEBUT");
  const otherPromotion = state.promotions.find((entry) => entry.id !== promotion.id)!;
  state.scheduledAppearances.push({
    id: "other-promo-appearance", worldId: state.world.id, eventId: event.id,
    promotionId: otherPromotion.id, personId: wrestler.id, contractId: "other-contract",
    date: event.date, serviceCapacityAtBooking: 1, status: "COMPLETED",
  });
  ok(latestPromotionLiveAppearance(state, promotion.id, wrestler.id, future) === null, "other promotion counted as debut");
});

console.log("\nLive appearance tests: " + passed + " passed, " + failed + " failed");
if (failed) process.exitCode = 1;
