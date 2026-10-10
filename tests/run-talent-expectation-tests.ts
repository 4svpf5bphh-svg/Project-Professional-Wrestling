declare const process: { exitCode?: number };

import { talentExpectationEvidenceForContract } from "../packages/application/src/talent-expectations.js";
import { DEFAULT_RULESET } from "../packages/config/src/default-ruleset.js";
import type { Match, WrestlingEvent } from "../packages/domain/src/types.js";
import { addPpwWeeks } from "../packages/sim-core/src/clock.js";
import { activeContractsForPromotion, createWorld } from "../packages/sim-core/src/index.js";
import { LedgerWriter } from "../packages/sim-core/src/ledger.js";

let passed = 0;
let failed = 0;
function test(name: string, run: () => void): void {
  try { run(); console.log("PASS " + name); passed += 1; }
  catch (error) {
    console.error("FAIL " + name + ": " + (error instanceof Error ? error.message : String(error)));
    failed += 1;
  }
}
function ok(value: unknown, message: string): void {
  if (!value) throw Error(message);
}

function fixture() {
  const state = createWorld(9208, DEFAULT_RULESET);
  const promotion = state.promotions.find((candidate) => candidate.tier === "INDEPENDENT" && candidate.lifecycle === "ACTIVE");
  if (!promotion) throw Error("expectation fixture needs independent promotion");
  const contract = activeContractsForPromotion(state, promotion.id)[0];
  if (!contract) throw Error("expectation fixture needs contracted wrestler");
  const start = { ...state.world.currentDate };
  contract.startDate = start;
  contract.endDate = addPpwWeeks(start, 16, state.ruleset.weeksPerYear);
  contract.roleExpectation = "MAIN_EVENT";
  contract.dateEntitlement = 5;
  contract.datesUsed = 3;
  state.world.currentDate = addPpwWeeks(start, 6, state.ruleset.weeksPerYear);
  const venue = state.venues.find((entry) => entry.marketId === promotion.homeMarketId) ?? state.venues[0]!;
  const makeEvent = (id: string, weekOffset: number, status: "COMPLETED" | "CANCELLED" = "COMPLETED"): WrestlingEvent => ({
    id, worldId: state.world.id, promotionId: promotion.id,
    marketId: promotion.homeMarketId, venueId: venue.id,
    date: addPpwWeeks(start, weekOffset, state.ruleset.weeksPerYear),
    type: "REGULAR", status, ticketStrategy: "STANDARD",
    expectedDemand: 100, attendance: 100, ticketYield: 20,
    gateRevenue: 2000, totalCost: 1500, netResult: 500, eventImportance: 50,
    matchCount: 3, averageMatchRating: 3.5, bestMatchRating: 4, crowdResponse: 60,
  });
  const addAppearance = (event: WrestlingEvent, contractId = contract.id, status: "COMPLETED" | "CANCELLED" = "COMPLETED") => {
    state.scheduledAppearances.push({
      id: "appearance:" + event.id, worldId: state.world.id, eventId: event.id,
      promotionId: promotion.id, personId: contract.personId, contractId,
      date: event.date, serviceCapacityAtBooking: 1, status,
    });
  };
  const addCard = (event: WrestlingEvent, targetOrder: number) => {
    for (let index = 1; index <= 3; index += 1) {
      const match: Match = {
        id: event.id + ":match:" + index, worldId: state.world.id,
        eventId: event.id, promotionId: promotion.id, order: index,
        type: "SINGLES", status: "COMPLETED", intent: "COMPETITIVE",
        plannedLengthMinutes: 10, actualLengthMinutes: 10,
        intendedWinnerSide: "A", actualWinnerSide: "A",
        finishChangedDueToInjury: false, executionQuality: 60,
        criticalRatingStars: 3, crowdResponse: 60,
      };
      state.matches.push(match);
      if (index === targetOrder) {
        state.matchParticipants.push({
          id: "participant:" + match.id, worldId: state.world.id,
          matchId: match.id, eventId: event.id, personId: contract.personId, side: "A", won: true,
        });
      }
    }
  };
  return { state, promotion, contract, start, makeEvent, addAppearance, addCard };
}

test("Contract expectation evidence separates main events, undercard, angles and unbooked shows", () => {
  const f = fixture();
  const headliner = f.makeEvent("headliner", 2);
  const undercard = f.makeEvent("undercard", 3);
  const angleOnly = f.makeEvent("angle", 4);
  const unused = f.makeEvent("unused", 5);
  const cancelled = f.makeEvent("cancelled", 6, "CANCELLED");
  f.state.events.push(headliner, undercard, angleOnly, unused, cancelled);
  f.addAppearance(headliner);
  f.addAppearance(undercard);
  f.addAppearance(angleOnly);
  f.addAppearance(cancelled, f.contract.id, "CANCELLED");
  f.addCard(headliner, 3);
  f.addCard(undercard, 1);
  const writer = new LedgerWriter(f.state.world.id, f.state.ledger);
  writer.append({
    date: angleOnly.date, type: "SHOW_SEGMENT_COMPLETED", significance: "ROUTINE",
    entityIds: [angleOnly.id, f.contract.personId],
    payload: { eventId: angleOnly.id, promotionId: f.promotion.id, segmentType: "PROMO",
      participantIds: f.contract.personId, draftSegmentId: "angle-only", sourceDraftId: "booked" },
  });

  const snapshot = JSON.stringify(f.state);
  const observed = talentExpectationEvidenceForContract(f.state, f.contract.id);
  ok(observed !== null, "active signed deal has no expectation evidence");
  ok(observed!.roleExpectation === "MAIN_EVENT", "contractual promise was lost");
  ok(observed!.completedPromotionShows === 4 && observed!.completedAppearanceShows === 3
    && observed!.showsWithoutAppearance === 1, "promotion show/appearance counts were incorrect");
  ok(observed!.inRingShows === 2 && observed!.segmentShows === 1, "in-ring and angle exposure mixed up");
  ok(observed!.mainEventShows === 1 && observed!.upperCardShows === 0 && observed!.lowerCardShows === 1,
    "card position did not respect the actual completed match running order");
  ok(observed!.datesPurchased === 5 && observed!.datesUsed === 3 && observed!.datesRemaining === 2,
    "limited-dates promise evidence was lost");
  ok(observed!.recentBookings[0]?.eventId === "angle"
    && observed!.recentBookings[0]?.position === "SEGMENT_ONLY"
    && observed!.recentBookings[1]?.position === "LOWER_CARD"
    && observed!.recentBookings[2]?.position === "MAIN_EVENT", "recent exposure order or position is wrong");
  ok(JSON.stringify(f.state) === snapshot, "read-only expectation evidence mutated the World");
});

test("Evidence respects current signed contract, date boundaries and contract-specific appearances", () => {
  const f = fixture();
  const valid = f.makeEvent("valid", 3);
  const wrongContract = f.makeEvent("wrong-contract", 4);
  const after = f.makeEvent("after-current", 8);
  const before = f.makeEvent("before-start", 0);
  const cancelled = f.makeEvent("cancelled-appearance", 5);
  f.contract.startDate = addPpwWeeks(f.start, 1, f.state.ruleset.weeksPerYear);
  f.state.events.push(valid, wrongContract, after, before, cancelled);
  f.addAppearance(valid);
  f.addAppearance(wrongContract, "some-other-deal");
  f.addAppearance(after);
  f.addAppearance(before);
  f.addAppearance(cancelled, f.contract.id, "CANCELLED");
  f.addCard(valid, 3);
  const observed = talentExpectationEvidenceForContract(f.state, f.contract.id, 4);
  ok(observed?.completedPromotionShows === 3, "contract window admitted a future or old event");
  ok(observed?.completedAppearanceShows === 1, "another contract or cancelled booking counted as delivered");
  ok(observed?.observationWindowWeeks === 4, "custom evidence window was ignored");
  let rejected = false;
  try { talentExpectationEvidenceForContract(f.state, f.contract.id, 53); }
  catch { rejected = true; }
  ok(rejected, "invalid evidence window accepted");
  f.contract.status = "EXPIRED";
  ok(talentExpectationEvidenceForContract(f.state, f.contract.id) === null,
    "ended contract was treated as a current promise");
});

test("A selective special-attraction deal is described factually, never auto-penalised", () => {
  const f = fixture();
  f.contract.roleExpectation = "SPECIAL_ATTRACTION";
  f.contract.dateEntitlement = 2;
  f.contract.datesUsed = 0;
  f.state.events.push(f.makeEvent("first-show", 2), f.makeEvent("second-show", 4));
  const observed = talentExpectationEvidenceForContract(f.state, f.contract.id);
  ok(observed?.roleExpectation === "SPECIAL_ATTRACTION", "special-attraction expectation missing");
  ok(observed?.completedPromotionShows === 2 && observed?.showsWithoutAppearance === 2,
    "selective role should expose shows without inventing dissatisfaction");
  ok(observed?.recentBookings.length === 0 && observed?.datesRemaining === 2,
    "selective booking fabricated appearances");
});

console.log("\nTalent expectation evidence tests: " + passed + " passed, " + failed + " failed");
if (failed > 0) process.exitCode = 1;
