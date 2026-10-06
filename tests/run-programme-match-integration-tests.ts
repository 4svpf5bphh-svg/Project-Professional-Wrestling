declare const process: { exitCode?: number };

import { DEFAULT_RULESET } from "../packages/config/src/default-ruleset.js";
import type { Match, MatchParticipant, WrestlingEvent } from "../packages/domain/src/types.js";
import {
  activeContractsForPromotion,
  createProgramme,
  createWorld,
  programmeActivities,
  resolveWorldWeek,
  validateProgrammeState,
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

function completedMatch(
  state: ReturnType<typeof createWorld>,
  event: WrestlingEvent,
  id: string,
  sideAId: string,
  sideBId: string,
  actualWinnerSide: "A" | "B",
  order: number,
): void {
  const match: Match = {
    id,
    worldId: state.world.id,
    eventId: event.id,
    promotionId: event.promotionId,
    order,
    type: "SINGLES",
    status: "COMPLETED",
    intent: "COMPETITIVE",
    plannedLengthMinutes: 12,
    actualLengthMinutes: 12,
    intendedWinnerSide: actualWinnerSide,
    actualWinnerSide,
    finishChangedDueToInjury: false,
    executionQuality: 70,
    criticalRatingStars: 3.5,
    crowdResponse: 65,
  };
  state.matches.push(match);

  const participants: MatchParticipant[] = [
    {
      id: `${id}:participant:a`,
      worldId: state.world.id,
      matchId: id,
      eventId: event.id,
      personId: sideAId,
      side: "A",
      won: actualWinnerSide === "A",
    },
    {
      id: `${id}:participant:b`,
      worldId: state.world.id,
      matchId: id,
      eventId: event.id,
      personId: sideBId,
      side: "B",
      won: actualWinnerSide === "B",
    },
  ];
  state.matchParticipants.push(...participants);
}

test("weekly resolution automatically records clear resolved Programme matches", () => {
  const state = createWorld(9121, DEFAULT_RULESET);
  state.world.currentDate = { year: 1, week: 2, day: 1 };
  const promotion = state.promotions.find((candidate) => candidate.tier === "INDEPENDENT" && candidate.lifecycle === "ACTIVE");
  if (!promotion) throw new Error("integration fixture needs an active Independent promotion");
  // Week 2 is not due when cadence is this large, keeping the fixture focused on the completed test event.
  promotion.eventCadenceWeeks = 999;

  const rosterIds = [...new Set(
    activeContractsForPromotion(state, promotion.id)
      .filter((contract) => contract.status === "SIGNED")
      .map((contract) => contract.personId),
  )];
  ok(rosterIds.length >= 3, "integration fixture needs at least three contracted wrestlers");
  const [sideAId, sideBId, outsiderId] = rosterIds as [string, string, string];

  const programme = createProgramme(state, {
    promotionId: promotion.id,
    sideA: [{ kind: "PERSON", entityId: sideAId }],
    sideB: [{ kind: "PERSON", entityId: sideBId }],
  });

  const market = state.markets.find((candidate) => candidate.id === promotion.homeMarketId) ?? state.markets[0]!;
  const venue = state.venues.find((candidate) => candidate.marketId === market.id) ?? state.venues[0]!;
  const event: WrestlingEvent = {
    id: "programme-integration-event",
    worldId: state.world.id,
    promotionId: promotion.id,
    marketId: market.id,
    venueId: venue.id,
    date: { year: 1, week: 2, day: 6 },
    type: "REGULAR",
    status: "COMPLETED",
    ticketStrategy: "STANDARD",
    expectedDemand: 100,
    attendance: 100,
    ticketYield: 25,
    gateRevenue: 2500,
    totalCost: 2000,
    netResult: 500,
    eventImportance: 50,
    matchCount: 3,
    averageMatchRating: 3.5,
    bestMatchRating: 3.5,
    crowdResponse: 65,
  };
  state.events.push(event);

  // Normal orientation: B wins -> Programme side B win.
  completedMatch(state, event, "programme-integration-match-1", sideAId, sideBId, "B", 1);
  // Reversed ring orientation: match side A is Programme side B, so an A win is still Programme side B.
  completedMatch(state, event, "programme-integration-match-2", sideBId, sideAId, "A", 2);
  // One Programme participant against somebody outside the story is not a Programme match.
  completedMatch(state, event, "programme-integration-match-3", sideAId, outsiderId, "A", 3);

  resolveWorldWeek(state);

  const activities = programmeActivities(state, programme.id);
  ok(activities.length === 2, `expected two Programme match activities, found ${activities.length}`);
  ok(activities.every((activity) => activity.kind === "MATCH"), "automatic Programme history recorded a non-match activity");
  ok(activities.every((activity) => activity.eventId === event.id), "Programme match history lost the resolved event link");
  ok(
    activities.some((activity) => activity.matchId === "programme-integration-match-1")
      && activities.some((activity) => activity.matchId === "programme-integration-match-2"),
    "Programme match history lost one of the qualifying matches",
  );
  ok(
    !activities.some((activity) => activity.matchId === "programme-integration-match-3"),
    "unrelated match was incorrectly attached to the Programme",
  );
  ok(programme.matchCount === 2 && programme.activityCount === 2, "Programme counters did not follow resolved match history");
  ok(programme.sideAWins === 0 && programme.sideBWins === 2 && programme.draws === 0, "Programme winner mapping ignored reversed match orientation");
  ok(
    programme.lastActivityDate?.year === 1
      && programme.lastActivityDate.week === 2
      && programme.lastActivityDate.day === 6,
    "Programme last activity did not use the resolved show's date",
  );
  ok(validateProgrammeState(state).length === 0, "automatic Programme match history failed state validation");
});

console.log(`\nProgramme match integration tests: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exitCode = 1;
