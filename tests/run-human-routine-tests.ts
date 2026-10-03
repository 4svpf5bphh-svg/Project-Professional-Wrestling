declare const process: { exitCode?: number };

import { DEFAULT_RULESET } from "../packages/config/src/default-ruleset.js";
import type { WorldState } from "../packages/domain/src/types.js";
import {
  activeContractsForPromotion,
  claimIndependentPromotionForHuman,
  createWorld,
  humanWeekReadiness,
  prepareHumanMatchCard,
  prepareHumanShow,
  resolveWorldWeek,
} from "../packages/sim-core/src/index.js";

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void): void {
  try {
    fn();
    passed += 1;
    console.log(`PASS ${name}`);
  } catch (error) {
    failed += 1;
    console.error(`FAIL ${name}`);
    console.error(error instanceof Error ? error.message : String(error));
  }
}

function ok(value: unknown, message: string): void {
  if (!value) throw new Error(message);
}

function fixture(seed: number): { state: WorldState; promotionId: string; participantIds: string[] } {
  const state = createWorld(seed, DEFAULT_RULESET);
  const promotion = state.promotions.find(
    (candidate) => candidate.tier === "INDEPENDENT" && candidate.lifecycle === "ACTIVE",
  )!;
  claimIndependentPromotionForHuman(state, promotion.id, { name: "Player Wrestling" });

  const participantIds = [...new Set(
    activeContractsForPromotion(state, promotion.id)
      .map((contract) => contract.personId)
      .filter((personId) => state.people.find((person) => person.id === personId)?.status === "ACTIVE"),
  )].slice(0, 10);
  ok(participantIds.length === 10, `expected 10 available wrestlers, found ${participantIds.length}`);
  return { state, promotionId: promotion.id, participantIds };
}

function prepareShow(state: WorldState, promotionId: string, participantIds: string[]) {
  const promotion = state.promotions.find((candidate) => candidate.id === promotionId)!;
  const venues = state.venues
    .filter((venue) => venue.marketId === promotion.homeMarketId)
    .sort((a, b) => a.capacity - b.capacity);
  return prepareHumanShow(state, {
    promotionId,
    marketId: promotion.homeMarketId,
    venueId: venues[1]?.id ?? venues[0]!.id,
    day: 5,
    ticketStrategy: "STANDARD",
    participantIds,
  });
}

function prepareSinglesCard(state: WorldState, eventId: string, ids: string[]) {
  return prepareHumanMatchCard(state, eventId, [
    { type: "SINGLES", sideAIds: [ids[0]!], sideBIds: [ids[1]!], intendedWinnerSide: "A", intent: "COMPETITIVE", plannedLengthMinutes: 12 },
    { type: "SINGLES", sideAIds: [ids[2]!], sideBIds: [ids[3]!], intendedWinnerSide: "B", intent: "STORY", plannedLengthMinutes: 14 },
    { type: "SINGLES", sideAIds: [ids[4]!], sideBIds: [ids[5]!], intendedWinnerSide: "A", intent: "TECHNICAL", plannedLengthMinutes: 16 },
    { type: "SINGLES", sideAIds: [ids[6]!], sideBIds: [ids[7]!], intendedWinnerSide: "B", intent: "SHOWCASE", plannedLengthMinutes: 11 },
    { type: "SINGLES", sideAIds: [ids[8]!], sideBIds: [ids[9]!], intendedWinnerSide: "A", intent: "EPIC", plannedLengthMinutes: 22 },
  ]);
}

function takeovers(state: WorldState, promotionId: string) {
  return state.ledger.filter(
    (entry) => entry.type === "HUMAN_ROUTINE_CONTINUITY_TAKEOVER" && entry.entityIds.includes(promotionId),
  );
}

test("human week readiness exposes show, card and ready states", () => {
  const { state, promotionId, participantIds } = fixture(13001);
  ok(humanWeekReadiness(state, promotionId).status === "SHOW_REQUIRED", "missing required show was not exposed");

  const event = prepareShow(state, promotionId, participantIds);
  const afterShow = humanWeekReadiness(state, promotionId);
  ok(afterShow.status === "CARD_REQUIRED", "prepared show without a card was not exposed");
  ok(afterShow.eventId === event.id, "readiness did not point to the prepared event");

  prepareSinglesCard(state, event.id, participantIds);
  const ready = humanWeekReadiness(state, promotionId);
  ok(ready.status === "READY" && ready.readyToAdvance, "fully prepared show was not ready to advance");
});

test("fully prepared human show runs untouched without a routine takeover", () => {
  const { state, promotionId, participantIds } = fixture(13002);
  const event = prepareShow(state, promotionId, participantIds);
  const planned = prepareSinglesCard(state, event.id, participantIds);
  const plannedIds = planned.map((match) => match.id);

  resolveWorldWeek(state);

  ok(event.status === "COMPLETED", `fully prepared show finished as ${event.status}`);
  const resolvedIds = state.matches.filter((match) => match.eventId === event.id).map((match) => match.id);
  ok(JSON.stringify(resolvedIds) === JSON.stringify(plannedIds), "staff replaced a fully prepared player card");
  ok(takeovers(state, promotionId).length === 0, "fully prepared work incorrectly triggered Routine Continuity");
  ok(state.promotions.find((promotion) => promotion.id === promotionId)!.controllerType === "HUMAN", "player control was not restored after resolution");
});

test("missing card triggers staff card booking while preserving player show logistics", () => {
  const { state, promotionId, participantIds } = fixture(13003);
  const event = prepareShow(state, promotionId, participantIds);
  const selectedVenue = event.venueId;
  const selectedMarket = event.marketId;
  const selectedTicketStrategy = event.ticketStrategy;

  resolveWorldWeek(state);

  ok(event.status === "COMPLETED", `staff-booked card show finished as ${event.status}`);
  ok(event.venueId === selectedVenue && event.marketId === selectedMarket, "staff overwrote player venue or market choices");
  ok(event.ticketStrategy === selectedTicketStrategy, "staff overwrote the player ticket strategy");
  ok(state.matches.some((match) => match.eventId === event.id && match.status === "COMPLETED"), "staff did not complete the missing card");
  const entries = takeovers(state, promotionId);
  ok(entries.length === 1, "missing card did not create exactly one Routine Continuity takeover");
  ok(entries[0]!.payload.scope === "CARD_ONLY", "missing card takeover used the wrong scope");
  ok(state.promotions.find((promotion) => promotion.id === promotionId)!.controllerType === "HUMAN", "player control was not restored after staff card booking");
});

test("missing entire mandatory show lets staff run the week instead of cancelling for inactivity", () => {
  const { state, promotionId } = fixture(13004);

  resolveWorldWeek(state);

  const event = state.events.find(
    (candidate) => candidate.promotionId === promotionId && candidate.date.year === 1 && candidate.date.week === 1,
  );
  ok(event, "staff did not create the missing mandatory show");
  ok(event!.status === "COMPLETED", `staff takeover show finished as ${event!.status}`);
  ok(state.matches.some((match) => match.eventId === event!.id && match.status === "COMPLETED"), "staff takeover did not book a match card");
  const entries = takeovers(state, promotionId);
  ok(entries.length === 1, "missing show did not create exactly one Routine Continuity takeover");
  ok(entries[0]!.payload.scope === "SHOW_AND_CARD", "missing-show takeover used the wrong scope");
  ok(state.promotions.find((promotion) => promotion.id === promotionId)!.controllerType === "HUMAN", "Routine Continuity permanently converted the promotion to AI control");
});

test("a week with no mandatory show is immediately ready and receives no takeover", () => {
  const { state, promotionId } = fixture(13005);
  state.world.currentDate = { year: 1, week: 2, day: 1 };
  const before = takeovers(state, promotionId).length;

  const readiness = humanWeekReadiness(state, promotionId);
  ok(readiness.status === "NOT_REQUIRED" && readiness.readyToAdvance, "off-cadence human week was not ready to advance");
  resolveWorldWeek(state);

  ok(takeovers(state, promotionId).length === before, "off-cadence week incorrectly triggered staff takeover");
});

console.log(`\nHuman routine tests: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exitCode = 1;
