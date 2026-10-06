declare const process: { exitCode?: number };

import { DEFAULT_RULESET } from "../packages/config/src/default-ruleset.js";
import type { MatchIntent, MatchSide, MatchType, WorldState } from "../packages/domain/src/types.js";
import {
  activeContractsForPromotion,
  actualMatchFinish,
  claimIndependentPromotionForHuman,
  createWorld,
  plannedMatchFinish,
  prepareHumanMatchCard,
  prepareHumanShow,
  resolveWorldWeek,
  type MatchFinish,
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

function fixture(seed: number): { state: WorldState; eventId: string; participantIds: string[] } {
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

  const venues = state.venues
    .filter((venue) => venue.marketId === promotion.homeMarketId)
    .sort((a, b) => a.capacity - b.capacity);
  const event = prepareHumanShow(state, {
    promotionId: promotion.id,
    marketId: promotion.homeMarketId,
    venueId: venues[1]?.id ?? venues[0]!.id,
    day: 5,
    ticketStrategy: "STANDARD",
    participantIds,
  });

  return { state, eventId: event.id, participantIds };
}

function plan(
  type: MatchType,
  sideAIds: string[],
  sideBIds: string[],
  intendedWinnerSide: MatchSide,
  intent: MatchIntent,
  plannedLengthMinutes: number,
  plannedFinish?: MatchFinish,
) {
  return { type, sideAIds, sideBIds, intendedWinnerSide, intent, plannedLengthMinutes, plannedFinish };
}

function standardCard(ids: string[]) {
  return [
    plan("SINGLES", [ids[0]!], [ids[1]!], "B", "COMPETITIVE", 12, "CLEAN_PIN"),
    plan("TAG", [ids[2]!, ids[3]!], [ids[4]!, ids[5]!], "A", "STORY", 15, "PROTECTED_FINISH"),
    plan("SINGLES", [ids[6]!], [ids[7]!], "A", "TECHNICAL", 18, "SUBMISSION"),
    plan("SINGLES", [ids[8]!], [ids[9]!], "B", "EPIC", 22, "FLASH_PIN"),
  ];
}

test("human promoter controls match order, participants, intent, length, finish and intended winners", () => {
  const { state, eventId, participantIds } = fixture(11101);
  const plans = standardCard(participantIds);
  const matches = prepareHumanMatchCard(state, eventId, plans);

  ok(matches.length === plans.length, "manual card created the wrong number of matches");
  for (let index = 0; index < matches.length; index += 1) {
    const match = matches[index]!;
    const expected = plans[index]!;
    ok(match.order === index + 1, "manual card order was not preserved");
    ok(match.type === expected.type, "manual match type was not preserved");
    ok(match.intent === expected.intent, "manual match intent was not preserved");
    ok(match.plannedLengthMinutes === expected.plannedLengthMinutes, "manual match length was not preserved");
    ok(match.intendedWinnerSide === expected.intendedWinnerSide, "manual intended winner was not preserved");
    ok(plannedMatchFinish(match) === expected.plannedFinish, "manual finish was not preserved");

    const participants = state.matchParticipants.filter((participant) => participant.matchId === match.id);
    const sideA = participants.filter((participant) => participant.side === "A").map((participant) => participant.personId);
    const sideB = participants.filter((participant) => participant.side === "B").map((participant) => participant.personId);
    ok(JSON.stringify(sideA) === JSON.stringify(expected.sideAIds), "manual side A was not preserved");
    ok(JSON.stringify(sideB) === JSON.stringify(expected.sideBIds), "manual side B was not preserved");
  }

  ok(state.ledger[state.ledger.length - 1]!.type === "HUMAN_MATCH_CARD_PREPARED", "manual card was not recorded in World history");
});

test("manual human card resolves the booked finish unless an injury forces a stoppage", () => {
  const { state, eventId, participantIds } = fixture(11102);
  const plans = standardCard(participantIds);
  const matches = prepareHumanMatchCard(state, eventId, plans);
  const matchIds = matches.map((match) => match.id);

  resolveWorldWeek(state);

  const resolved = state.matches.filter((match) => match.eventId === eventId);
  ok(resolved.length === plans.length, `expected ${plans.length} resolved manual matches, found ${resolved.length}`);
  ok(JSON.stringify(resolved.map((match) => match.id)) === JSON.stringify(matchIds), "AI generated a replacement card for the human event");
  ok(resolved.every((match) => match.status === "COMPLETED"), "not every manual match completed");
  ok(resolved.every((match) => match.actualWinnerSide === match.intendedWinnerSide || match.finishChangedDueToInjury), "manual winners were ignored without an injury explanation");
  for (const match of resolved) {
    ok(
      actualMatchFinish(match) === (match.finishChangedDueToInjury ? "INJURY_STOPPAGE" : plannedMatchFinish(match)),
      "resolved match did not preserve the booked finish or explain its injury stoppage",
    );
  }

  const event = state.events.find((candidate) => candidate.id === eventId)!;
  ok(event.status === "COMPLETED", `human event finished as ${event.status}`);
  ok(event.matchCount === plans.length, "human event summary did not use the manual card");
  ok(
    state.ledger.some((entry) => entry.type === "MATCH_COMPLETED" && typeof entry.payload.actualFinish === "string"),
    "completed match history did not record the factual finish",
  );
});

test("intent supplies a sensible finish when a human promoter leaves finish unspecified", () => {
  const { state, eventId, participantIds } = fixture(11105);
  const plans = standardCard(participantIds);
  plans[0] = plan("SINGLES", [participantIds[0]!], [participantIds[1]!], "B", "PROTECTIVE", 12);
  const matches = prepareHumanMatchCard(state, eventId, plans);
  ok(plannedMatchFinish(matches[0]!) === "PROTECTED_FINISH", "protective intent did not default to a protected finish");
});

test("finish choice changes match presentation without changing the booked winner", () => {
  const clean = fixture(11106);
  const protectedFixture = fixture(11106);
  const cleanPlans = standardCard(clean.participantIds);
  const protectedPlans = standardCard(protectedFixture.participantIds);
  cleanPlans[0] = plan("SINGLES", [clean.participantIds[0]!], [clean.participantIds[1]!], "B", "COMPETITIVE", 12, "CLEAN_PIN");
  protectedPlans[0] = plan("SINGLES", [protectedFixture.participantIds[0]!], [protectedFixture.participantIds[1]!], "B", "COMPETITIVE", 12, "PROTECTED_FINISH");

  prepareHumanMatchCard(clean.state, clean.eventId, cleanPlans);
  prepareHumanMatchCard(protectedFixture.state, protectedFixture.eventId, protectedPlans);
  resolveWorldWeek(clean.state);
  resolveWorldWeek(protectedFixture.state);

  const cleanMatch = clean.state.matches.find((match) => match.eventId === clean.eventId && match.order === 1)!;
  const protectedMatch = protectedFixture.state.matches.find((match) => match.eventId === protectedFixture.eventId && match.order === 1)!;
  ok(cleanMatch.actualWinnerSide === protectedMatch.actualWinnerSide, "finish style unexpectedly changed the booked winner");
  ok(
    cleanMatch.executionQuality !== protectedMatch.executionQuality || cleanMatch.crowdResponse !== protectedMatch.crowdResponse,
    "different finish styles produced identical match presentation",
  );
});

test("manual card must use every committed wrestler exactly once", () => {
  const { state, eventId, participantIds } = fixture(11103);
  const invalid = standardCard(participantIds);
  invalid[3] = plan("SINGLES", [participantIds[8]!], [participantIds[7]!], "A", "STORY", 12);

  let rejected = false;
  try {
    prepareHumanMatchCard(state, eventId, invalid);
  } catch {
    rejected = true;
  }
  ok(rejected, "duplicate wrestler could be booked twice while another committed wrestler was omitted");
  ok(!state.matches.some((match) => match.eventId === eventId), "invalid card partially mutated match state");
});

test("unresolved human card is staff-booked only when the week locks", () => {
  const { state, eventId } = fixture(11104);
  const event = state.events.find((candidate) => candidate.id === eventId)!;
  const promotionId = event.promotionId;

  ok(!state.matches.some((match) => match.eventId === eventId), "staff booked the card before the week lock");
  ok(!state.ledger.some((entry) => entry.type === "HUMAN_ROUTINE_CONTINUITY_TAKEOVER" && entry.entityIds.includes(promotionId)), "Routine Continuity triggered before the week lock");

  resolveWorldWeek(state);

  ok(state.matches.some((match) => match.eventId === eventId && match.status === "COMPLETED"), "staff did not book the unresolved card at the week lock");
  ok(event.status === "COMPLETED", `staff-booked human show finished as ${event.status}`);
  ok(state.ledger.some((entry) => entry.type === "HUMAN_ROUTINE_CONTINUITY_TAKEOVER" && entry.entityIds.includes(promotionId) && entry.payload.scope === "CARD_ONLY"), "staff intervention was not explicitly recorded as a card-only takeover");
});

console.log(`\nHuman booking tests: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exitCode = 1;
