declare const process: { exitCode?: number };

import {
  buildPlayerWorldResultsView,
  claimIndependentPromotionForPlayer,
  createWorldCommandState,
  createWorldOwnershipState,
  createWorldPlanningState,
  createWorldRuntimeState,
  joinPlayerToWorld,
  type ApplicationWorldAggregate,
} from "../packages/application/src/index.js";
import { DEFAULT_RULESET } from "../packages/config/src/default-ruleset.js";
import type { Person, PpwDate } from "../packages/domain/src/types.js";
import { activeContractsForPromotion, createWorld } from "../packages/sim-core/src/index.js";

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

function fixture(seed: number): {
  aggregate: ApplicationWorldAggregate;
  playerPromotionId: string;
  rivalPromotionId: string;
  people: Person[];
} {
  const state = createWorld(seed, DEFAULT_RULESET);
  const ownership = createWorldOwnershipState(state.world.id, 1);
  joinPlayerToWorld(ownership, "player-a", state.world.currentDate);
  const playerPromotion = state.promotions.find((candidate) => (
    candidate.controllerType === "AI" && candidate.tier === "INDEPENDENT" && candidate.lifecycle === "ACTIVE"
  ));
  if (!playerPromotion) throw new Error("world-results fixture needs an Independent promotion");
  claimIndependentPromotionForPlayer(state, ownership, "player-a", playerPromotion.id);
  const rival = state.promotions.find((candidate) => (
    candidate.id !== playerPromotion.id && activeContractsForPromotion(state, candidate.id).length > 0
  ));
  if (!rival) throw new Error("world-results fixture needs a contracted rival promotion");
  const people = state.people.slice(0, 4);
  if (people.length < 4) throw new Error("world-results fixture needs four wrestlers");

  state.world.currentDate = { year: 1, week: 2, day: 1 };
  state.events = [];
  state.matches = [];
  state.matchParticipants = [];
  state.injuries = [];
  state.championshipContests = [];

  return {
    aggregate: {
      state,
      ownership,
      commands: createWorldCommandState(state.world.id),
      runtime: createWorldRuntimeState(state.world.id),
      planning: createWorldPlanningState(state.world.id),
    },
    playerPromotionId: playerPromotion.id,
    rivalPromotionId: rival.id,
    people,
  };
}

function addCompletedShow(
  aggregate: ApplicationWorldAggregate,
  promotionId: string,
  eventId: string,
  date: PpwDate,
  wrestlerA: Person,
  wrestlerB: Person,
  rating: number,
): void {
  const venue = aggregate.state.venues[0];
  if (!venue) throw new Error("world-results fixture needs a venue");
  const attendance = Math.max(1, Math.min(venue.capacity, 600));
  aggregate.state.events.push({
    id: eventId,
    worldId: aggregate.state.world.id,
    promotionId,
    marketId: venue.marketId,
    venueId: venue.id,
    date: { ...date },
    type: "REGULAR",
    status: "COMPLETED",
    ticketStrategy: "STANDARD",
    expectedDemand: attendance,
    attendance,
    ticketYield: 35,
    gateRevenue: 21_000,
    totalCost: 12_000,
    netResult: 9_000,
    eventImportance: 52,
    matchCount: 1,
    averageMatchRating: rating,
    bestMatchRating: rating,
    crowdResponse: 78,
  });
  aggregate.state.matches.push({
    id: `${eventId}-match`,
    worldId: aggregate.state.world.id,
    eventId,
    promotionId,
    order: 1,
    type: "SINGLES",
    status: "COMPLETED",
    intent: "HIGH_RISK",
    plannedLengthMinutes: 23,
    actualLengthMinutes: 19,
    intendedWinnerSide: "A",
    actualWinnerSide: "A",
    finishChangedDueToInjury: false,
    executionQuality: 84,
    criticalRatingStars: rating,
    crowdResponse: 79,
  });
  aggregate.state.matchParticipants.push(
    {
      id: `${eventId}-participant-a`,
      worldId: aggregate.state.world.id,
      matchId: `${eventId}-match`,
      eventId,
      personId: wrestlerA.id,
      side: "A",
      won: true,
    },
    {
      id: `${eventId}-participant-b`,
      worldId: aggregate.state.world.id,
      matchId: `${eventId}-match`,
      eventId,
      personId: wrestlerB.id,
      side: "B",
      won: false,
    },
  );
}

test("world results combine public completed shows from player and rival promotions", () => {
  const { aggregate, playerPromotionId, rivalPromotionId, people } = fixture(73401);
  addCompletedShow(aggregate, playerPromotionId, "player-show", { year: 1, week: 1, day: 2 }, people[0]!, people[1]!, 3.7);
  addCompletedShow(aggregate, rivalPromotionId, "rival-show", { year: 1, week: 1, day: 4 }, people[2]!, people[3]!, 4.4);

  aggregate.state.championships = aggregate.state.championships ?? [];
  aggregate.state.championships.push({
    id: "world-results-title",
    worldId: aggregate.state.world.id,
    promotionId: rivalPromotionId,
    name: "World Results Test Championship",
    division: "SINGLES",
    status: "ACTIVE",
    prestige: 70,
    currentReignId: null,
    createdDate: { year: 1, week: 1, day: 1 },
  });
  aggregate.state.championshipContests = aggregate.state.championshipContests ?? [];
  aggregate.state.championshipContests.push({
    id: "world-results-contest",
    worldId: aggregate.state.world.id,
    championshipId: "world-results-title",
    matchId: "rival-show-match",
    eventId: "rival-show",
    date: { year: 1, week: 1, day: 4 },
    previousHolderId: people[3]!.id,
    winnerHolderId: people[2]!.id,
    titleChanged: true,
  });
  aggregate.state.injuries.push({
    id: "world-results-injury",
    worldId: aggregate.state.world.id,
    personId: people[3]!.id,
    matchId: "rival-show-match",
    eventId: "rival-show",
    date: { year: 1, week: 1, day: 4 },
    severity: "MODERATE",
    weeksOut: 4,
    weeksRemaining: 4,
    status: "ACTIVE",
  });

  const view = buildPlayerWorldResultsView(aggregate, "player-a", 10);
  ok(view.shows.length === 2, "world results did not combine both promotions");
  ok(view.shows[0]?.eventId === "rival-show", "newest World show was not first");
  ok(view.shows[0]?.isPlayerPromotion === false, "rival show was marked as the player's show");
  ok(view.shows[1]?.isPlayerPromotion === true, "player show was not identified");
  const rivalShow = view.shows[0]!;
  ok(rivalShow.matches[0]?.winnerNames[0] === people[2]!.name, "public winner was not resolved");
  ok(rivalShow.matches[0]?.titleOutcomes[0]?.championshipName === "World Results Test Championship", "title outcome was omitted");
  ok(rivalShow.matches[0]?.titleOutcomes[0]?.titleChanged === true, "title change was not preserved");
  ok(rivalShow.injuryCount === 1, "show injury count was wrong");
  ok(rivalShow.matches[0]?.injuries[0]?.personName === people[3]!.name, "public injury was not resolved");
});

test("world results hide rival economics, contracts and private booking details", () => {
  const { aggregate, rivalPromotionId, people } = fixture(73402);
  const rival = aggregate.state.promotions.find((promotion) => promotion.id === rivalPromotionId)!;
  const rivalContract = activeContractsForPromotion(aggregate.state, rivalPromotionId)[0];
  ok(rivalContract, "rival contract missing from privacy fixture");
  rival.cash = 881_337_001;
  rival.debt = 881_337_002;
  rivalContract!.weeklyGuarantee = 881_337_003;
  rivalContract!.appearanceFee = 881_337_004;
  addCompletedShow(aggregate, rivalPromotionId, "private-rival-show", { year: 1, week: 1, day: 3 }, people[0]!, people[1]!, 4.1);
  const event = aggregate.state.events.find((candidate) => candidate.id === "private-rival-show")!;
  event.gateRevenue = 881_337_005;
  event.totalCost = 881_337_006;
  event.netResult = 881_337_007;

  const view = buildPlayerWorldResultsView(aggregate, "player-a", 10);
  const serialized = JSON.stringify(view);
  for (const sentinel of ["881337001", "881337002", "881337003", "881337004", "881337005", "881337006", "881337007"]) {
    ok(!serialized.includes(sentinel), `private rival value ${sentinel} leaked into World results`);
  }
  for (const privateKey of [
    "gateRevenue",
    "totalCost",
    "netResult",
    "weeklyGuarantee",
    "appearanceFee",
    "intent",
    "plannedLengthMinutes",
    "executionQuality",
  ]) {
    ok(!serialized.includes(`\"${privateKey}\"`), `private field ${privateKey} leaked into World results`);
  }
  ok(!serialized.includes(rivalContract!.id), "rival contract ID leaked into World results");
});

test("world results validate limits and return newest shows first", () => {
  const { aggregate, playerPromotionId, rivalPromotionId, people } = fixture(73403);
  addCompletedShow(aggregate, playerPromotionId, "older-show", { year: 1, week: 1, day: 1 }, people[0]!, people[1]!, 3.2);
  addCompletedShow(aggregate, rivalPromotionId, "newer-show", { year: 1, week: 1, day: 5 }, people[2]!, people[3]!, 4.0);
  const limited = buildPlayerWorldResultsView(aggregate, "player-a", 1);
  ok(limited.shows.length === 1 && limited.shows[0]?.eventId === "newer-show", "World-results limit did not preserve newest show");
  let rejected = false;
  try {
    buildPlayerWorldResultsView(aggregate, "player-a", 0);
  } catch (error) {
    rejected = error instanceof Error && error.message.includes("integer from 1 to 100");
  }
  ok(rejected, "invalid World-results limit was accepted");
});

test("non-members cannot read World results", () => {
  const { aggregate } = fixture(73404);
  let rejected = false;
  try {
    buildPlayerWorldResultsView(aggregate, "stranger");
  } catch (error) {
    rejected = error instanceof Error && error.message.includes("not an active member");
  }
  ok(rejected, "non-member could read World results");
});

console.log(`\nApplication world-results tests: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exitCode = 1;
