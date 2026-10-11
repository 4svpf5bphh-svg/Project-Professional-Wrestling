declare const process: { exitCode?: number };

import { DEFAULT_RULESET } from "../packages/config/src/default-ruleset.js";
import {
  activeContractsForPromotion,
  claimIndependentPromotionForHuman,
  createWorld,
  planWorldEvents,
  plannedMatchFinish,
  prepareHumanShow,
  resolveWorldEvents,
  resolveWorldWeek,
  validateWorldInvariants,
} from "../packages/sim-core/src/index.js";
import type { WorldState } from "../packages/domain/src/types.js";

let passed = 0;
let failed = 0;
function test(name: string, run: () => void): void {
  try { run(); passed++; console.log("PASS", name); }
  catch (error) { failed++; console.error("FAIL", name, error); }
}
function ok(value: unknown, reason: string): asserts value {
  if (!value) throw new Error(reason);
}

function aiEventFixture(seed: number): {
  state: WorldState;
  eventId: string;
  promotionId: string;
  bookedPersonIds: string[];
} {
  const state = createWorld(seed, DEFAULT_RULESET);
  planWorldEvents(state);
  const event = state.events.find((entry) => (
    entry.status === "SCHEDULED"
    && state.promotions.find((promotion) => promotion.id === entry.promotionId)?.controllerType === "AI"
    && state.scheduledAppearances.filter((appearance) => appearance.eventId === entry.id
      && appearance.status === "COMMITTED").length >= state.ruleset.minEventParticipants
  ));
  ok(event, "need a live AI show with adequate booked wrestlers");
  const bookedPersonIds = state.scheduledAppearances
    .filter((appearance) => appearance.eventId === event.id && appearance.status === "COMMITTED")
    .map((appearance) => appearance.personId);
  return { state, eventId: event.id, promotionId: event.promotionId, bookedPersonIds };
}

function actualMatches(state: WorldState, eventId: string) {
  return state.matches.filter((match) => match.eventId === eventId && match.status === "COMPLETED");
}

function losingParticipants(state: WorldState, matchId: string, winner: "A" | "B") {
  return state.matchParticipants.filter((participant) => participant.matchId === matchId
    && participant.side !== winner);
}

test("AI bookers protect clean and submission losses without changing ordinary human scripts", () => {
  const f = aiEventFixture(90501);
  const contracted = new Set(f.bookedPersonIds);
  for (const contract of f.state.contracts) {
    if (contract.promotionId === f.promotionId && contracted.has(contract.personId) && contract.status === "SIGNED") {
      contract.creativeControl = "PROTECTED_FINISHES";
    }
  }
  resolveWorldEvents(f.state);
  const matches = actualMatches(f.state, f.eventId);
  ok(matches.length > 0, "AI show produced no completed matches");
  for (const match of matches) {
    ok(!["CLEAN_PIN", "SUBMISSION"].includes(plannedMatchFinish(match)),
      "AI imposed a protected wrestler's clean or submission loss");
    ok(losingParticipants(f.state, match.id, match.intendedWinnerSide).length > 0,
      "completed match had no booked losing side");
  }
  ok(f.state.ledger.some((entry) => entry.type === "AUTOMATED_CREATIVE_FINISH_PROTECTED"
    && entry.entityIds.includes(f.eventId)), "AI protected finish left no World audit");
  ok(validateWorldInvariants(f.state).length === 0, "protected automated booking broke World invariants");
});

test("automated full creative rights support actual yes/no decisions rather than unconditional approvals", () => {
  const f = aiEventFixture(90502);
  const [refusingId, approvingId] = f.bookedPersonIds;
  ok(refusingId && approvingId, "fixture missing two booked wrestlers");
  for (const contract of f.state.contracts) {
    if (contract.promotionId !== f.promotionId || contract.status !== "SIGNED") continue;
    if (contract.personId === refusingId || contract.personId === approvingId) {
      contract.creativeControl = "FULL_APPROVAL";
    }
  }
  const refusing = f.state.people.find((person) => person.id === refusingId)!;
  refusing.morale = 0; refusing.fatigue = 100;
  refusing.priorities.loyalty = 0; refusing.priorities.role = 100;
  const approving = f.state.people.find((person) => person.id === approvingId)!;
  approving.morale = 100; approving.fatigue = 0;
  approving.priorities.loyalty = 100; approving.priorities.role = 0;
  resolveWorldEvents(f.state);
  const matchIds = new Set(actualMatches(f.state, f.eventId).map((match) => match.id));
  const usedPersonIds = new Set(f.state.matchParticipants
    .filter((entry) => matchIds.has(entry.matchId)).map((entry) => entry.personId));
  ok(!usedPersonIds.has(refusingId), "refusing full-control wrestler was forced into an AI match");
  ok(f.state.ledger.some((entry) => entry.type === "AUTOMATED_CREATIVE_MATCH_DECLINED"
    && entry.entityIds.includes(refusingId) && entry.entityIds.includes(f.eventId)),
    "full-approval refusal was not recorded in World history");
  ok(f.state.ledger.some((entry) => entry.type === "AUTOMATED_CREATIVE_MATCH_APPROVED"
    && entry.entityIds.includes(approvingId) && entry.entityIds.includes(f.eventId)),
    "approved full-control wrestler never consented to their AI-created match");
  ok(validateWorldInvariants(f.state).length === 0, "full-control AI booking broke World invariants");
});

test("Routine Continuity staff-generated cards obey the same protected finishes", () => {
  const state = createWorld(90503, DEFAULT_RULESET);
  const promotion = state.promotions.find((entry) => entry.tier === "INDEPENDENT" && entry.lifecycle === "ACTIVE")!;
  claimIndependentPromotionForHuman(state, promotion.id, { name: "Creative Booking Test" });
  const roster = activeContractsForPromotion(state, promotion.id)
    .filter((contract) => contract.status === "SIGNED")
    .map((contract) => contract.personId)
    .filter((id, index, all) => all.indexOf(id) === index)
    .slice(0, state.ruleset.minEventParticipants);
  ok(roster.length === state.ruleset.minEventParticipants, "staff fixture lacks a viable roster");
  const market = state.markets.find((entry) => entry.id === promotion.homeMarketId)!;
  const venue = state.venues.find((entry) => entry.marketId === market.id)!;
  for (const contract of state.contracts) {
    if (contract.promotionId === promotion.id && roster.includes(contract.personId) && contract.status === "SIGNED") {
      contract.creativeControl = "PROTECTED_FINISHES";
    }
  }
  const event = prepareHumanShow(state, {
    promotionId: promotion.id, marketId: market.id, venueId: venue.id,
    day: 5, ticketStrategy: "STANDARD", participantIds: roster,
  });
  resolveWorldWeek(state);
  const matches = actualMatches(state, event.id);
  ok(matches.length > 0, "staff fallback did not create matches for an otherwise viable show");
  ok(matches.every((match) => !["CLEAN_PIN", "SUBMISSION"].includes(plannedMatchFinish(match))),
    "Routine Continuity ignored protected-finish clauses");
  ok(state.ledger.some((entry) => entry.type === "HUMAN_ROUTINE_CONTINUITY_TAKEOVER"
    && entry.entityIds.includes(promotion.id)), "staff booking did not record Routine Continuity takeover");
  ok(state.ledger.some((entry) => entry.type === "AUTOMATED_CREATIVE_FINISH_PROTECTED"
    && entry.entityIds.includes(event.id)), "staff booking did not record wrestler protection");
  ok(validateWorldInvariants(state).length === 0, "staff creative protections broke World invariants");
});

console.log(`Automated creative-booking tests: ${passed} passed, ${failed} failed`);
if (failed) process.exitCode = 1;
