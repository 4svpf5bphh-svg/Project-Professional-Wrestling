declare const process: { exitCode?: number };

import {
  buildPlayerShowHistory,
  claimIndependentPromotionForPlayer,
  createWorldCommandState,
  createWorldOwnershipState,
  createWorldPlanningState,
  createWorldRuntimeState,
  joinPlayerToWorld,
  type ApplicationWorldAggregate,
} from "../packages/application/src/index.js";
import { DEFAULT_RULESET } from "../packages/config/src/default-ruleset.js";
import { createWorld, setWrestlerAlignment } from "../packages/sim-core/src/index.js";

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

function twoPlayerFixture(seed: number): {
  aggregate: ApplicationWorldAggregate;
  promotionAId: string;
  promotionBId: string;
} {
  const state = createWorld(seed, DEFAULT_RULESET);
  const ownership = createWorldOwnershipState(state.world.id, 2);
  joinPlayerToWorld(ownership, "player-a", state.world.currentDate);
  joinPlayerToWorld(ownership, "player-b", state.world.currentDate);
  const promotions = state.promotions.filter((promotion) => (
    promotion.controllerType === "AI"
    && promotion.tier === "INDEPENDENT"
    && promotion.lifecycle === "ACTIVE"
  )).slice(0, 2);
  if (promotions.length < 2) throw new Error("results fixture needs two Independent promotions");
  claimIndependentPromotionForPlayer(state, ownership, "player-a", promotions[0]!.id);
  claimIndependentPromotionForPlayer(state, ownership, "player-b", promotions[1]!.id);

  const people = state.people.filter((person) => person.status === "ACTIVE").slice(0, 4);
  if (people.length < 4) throw new Error("results fixture needs four active wrestlers");
  const marketA = state.markets.find((market) => market.id === promotions[0]!.homeMarketId) ?? state.markets[0]!;
  const marketB = state.markets.find((market) => market.id === promotions[1]!.homeMarketId) ?? state.markets[1]!;
  const venueA = state.venues.find((venue) => venue.marketId === marketA.id) ?? state.venues[0]!;
  const venueB = state.venues.find((venue) => venue.marketId === marketB.id) ?? state.venues[1]!;
  const dateA = { year: 1, week: 2, day: 6 };
  const dateB = { year: 1, week: 2, day: 5 };

  state.events.push({
    id: "results-event-a",
    worldId: state.world.id,
    promotionId: promotions[0]!.id,
    marketId: marketA.id,
    venueId: venueA.id,
    date: dateA,
    type: "REGULAR",
    status: "COMPLETED",
    ticketStrategy: "STANDARD",
    expectedDemand: 400,
    attendance: 375,
    ticketYield: 28,
    gateRevenue: 10_500,
    totalCost: 8_000,
    netResult: 2_500,
    eventImportance: 45,
    matchCount: 1,
    averageMatchRating: 3.75,
    bestMatchRating: 3.75,
    crowdResponse: 71,
  });
  state.events.push({
    id: "results-event-b",
    worldId: state.world.id,
    promotionId: promotions[1]!.id,
    marketId: marketB.id,
    venueId: venueB.id,
    date: dateB,
    type: "REGULAR",
    status: "COMPLETED",
    ticketStrategy: "STANDARD",
    expectedDemand: 300,
    attendance: 290,
    ticketYield: 25,
    gateRevenue: 7_250,
    totalCost: 7_500,
    netResult: -250,
    eventImportance: 40,
    matchCount: 1,
    averageMatchRating: 3.1,
    bestMatchRating: 3.1,
    crowdResponse: 61,
  });

  state.matches.push({
    id: "results-match-a",
    worldId: state.world.id,
    eventId: "results-event-a",
    promotionId: promotions[0]!.id,
    order: 1,
    type: "SINGLES",
    status: "COMPLETED",
    intent: "COMPETITIVE",
    plannedLengthMinutes: 15,
    actualLengthMinutes: 14,
    intendedWinnerSide: "A",
    actualWinnerSide: "A",
    finishChangedDueToInjury: false,
    executionQuality: 77,
    criticalRatingStars: 3.75,
    crowdResponse: 72,
  });
  state.matches.push({
    id: "results-match-b",
    worldId: state.world.id,
    eventId: "results-event-b",
    promotionId: promotions[1]!.id,
    order: 1,
    type: "SINGLES",
    status: "COMPLETED",
    intent: "SHOWCASE",
    plannedLengthMinutes: 12,
    actualLengthMinutes: 11,
    intendedWinnerSide: "B",
    actualWinnerSide: "B",
    finishChangedDueToInjury: false,
    executionQuality: 69,
    criticalRatingStars: 3.1,
    crowdResponse: 61,
  });

  state.matchParticipants.push(
    { id: "results-participant-a1", worldId: state.world.id, matchId: "results-match-a", eventId: "results-event-a", personId: people[0]!.id, side: "A", won: true },
    { id: "results-participant-a2", worldId: state.world.id, matchId: "results-match-a", eventId: "results-event-a", personId: people[1]!.id, side: "B", won: false },
    { id: "results-participant-b1", worldId: state.world.id, matchId: "results-match-b", eventId: "results-event-b", personId: people[2]!.id, side: "A", won: false },
    { id: "results-participant-b2", worldId: state.world.id, matchId: "results-match-b", eventId: "results-event-b", personId: people[3]!.id, side: "B", won: true },
  );

  state.injuries.push({
    id: "results-injury-a",
    worldId: state.world.id,
    personId: people[1]!.id,
    matchId: "results-match-a",
    eventId: "results-event-a",
    date: dateA,
    severity: "MINOR",
    weeksOut: 2,
    weeksRemaining: 2,
    status: "ACTIVE",
  });
  state.championships ??= [];
  state.championshipContests ??= [];
  state.championships.push({
    id: "results-title-a",
    worldId: state.world.id,
    promotionId: promotions[0]!.id,
    name: "Independent Championship",
    division: "SINGLES",
    status: "ACTIVE",
    prestige: 50,
    currentReignId: null,
    createdDate: { year: 1, week: 1, day: 1 },
  });
  state.championshipContests.push({
    id: "results-contest-a",
    worldId: state.world.id,
    championshipId: "results-title-a",
    matchId: "results-match-a",
    eventId: "results-event-a",
    date: dateA,
    previousHolderId: people[1]!.id,
    winnerHolderId: people[0]!.id,
    titleChanged: true,
  });

  return {
    aggregate: {
      state,
      ownership,
      commands: createWorldCommandState(state.world.id),
      runtime: createWorldRuntimeState(state.world.id),
      planning: createWorldPlanningState(state.world.id),
    },
    promotionAId: promotions[0]!.id,
    promotionBId: promotions[1]!.id,
  };
}

test("show history exposes match-level consequences for the controlled promotion", () => {
  const { aggregate, promotionAId } = twoPlayerFixture(72001);
  const view = buildPlayerShowHistory(aggregate, "player-a");
  ok(view.player.promotionId === promotionAId, "results projection returned the wrong controlled promotion");
  ok(view.shows.length === 1, "results projection did not return exactly the controlled promotion show");
  const show = view.shows[0]!;
  ok(show.eventId === "results-event-a", "results projection returned the rival event");
  ok(show.matches.length === 1, "show detail did not expose the completed match");
  ok(show.matches[0]!.winnerNames.length === 1, "match result did not expose a winner");
  ok(show.injuryCount === 1 && show.matches[0]!.injuries.length === 1, "show result did not expose injury consequences");
  ok(show.titleChangeCount === 1 && show.matches[0]!.titleOutcomes[0]?.titleChanged, "show result did not expose the title change");
  ok(show.crowdStory === null, "legacy show without frozen flow evidence invented a crowd diagnosis");
  ok(show.matches[0]!.crowdFlowFactors.length === 0, "legacy match without frozen flow evidence invented crowd factors");
});

test("show history merges frozen segments with matches in the original slot order", () => {
  const { aggregate } = twoPlayerFixture(72005);
  const event = aggregate.state.events.find((candidate) => candidate.id === "results-event-a")!;
  const people = aggregate.state.matchParticipants
    .filter((participant) => participant.eventId === event.id)
    .map((participant) => participant.personId);
  aggregate.state.ledger.push({
    id: "results-segment-ledger",
    worldId: aggregate.state.world.id,
    date: { ...event.date },
    order: 900,
    type: "SHOW_SEGMENT_COMPLETED",
    significanceAtTime: "ROUTINE",
    historicalSignificance: "ROUTINE",
    entityIds: [event.id, event.promotionId, people[0]!],
    payload: {
      eventId: event.id,
      promotionId: event.promotionId,
      sourceDraftId: "results-draft",
      draftSegmentId: "results-segment",
      slotOrder: 1,
      segmentType: "INTERVIEW",
      participantIds: people[0]!,
      programmeId: null,
      plannedLengthMinutes: 5,
    },
  });

  const show = buildPlayerShowHistory(aggregate, "player-a").shows[0]!;
  ok(show.segmentCount === 1 && show.segments.length === 1, "resolved segment was not projected");
  ok(show.runningOrder.length === 2, "complete show order did not contain match and segment");
  ok(show.runningOrder[0]?.kind === "SEGMENT" && show.runningOrder[1]?.kind === "MATCH", "segment slot order was not preserved");
  ok(show.segments[0]?.participants[0]?.personId === people[0], "segment participant was not projected");
  ok(show.segments[0]?.plannedLengthMinutes === 5, "private Results lost segment duration");
});

test("show history keeps positive alignment clarity separate from negative volatility", () => {
  const { aggregate } = twoPlayerFixture(72006);
  const event = aggregate.state.events.find((candidate) => candidate.id === "results-event-a")!;
  const match = aggregate.state.matches.find((candidate) => candidate.eventId === event.id)!;
  const ledger = aggregate.state.ledger.find((entry) => entry.type === "MATCH_COMPLETED" && entry.entityIds.includes(match.id));
  if (!ledger) throw new Error("alignment-factor fixture lacks MATCH_COMPLETED ledger");
  ledger.payload.showFlowAlignmentModifier = 1.1;
  ledger.payload.showFlowAlignmentReason = "ALIGNMENT_VOLATILITY";
  ledger.payload.showFlowAlignmentBaseModifier = 2.2;
  ledger.payload.showFlowAlignmentBaseReason = "FACE_HEEL_CLARITY";
  ledger.payload.showFlowAlignmentVolatilityModifier = -1.1;
  ledger.payload.showFlowAlignmentVolatilityReason = "ALIGNMENT_VOLATILITY";

  const show = buildPlayerShowHistory(aggregate, "player-a").shows[0]!;
  const factors = show.matches[0]!.crowdFlowFactors.filter((factor) => factor.scope === "ALIGNMENT");
  ok(factors.some((factor) => factor.reason === "FACE_HEEL_CLARITY" && factor.impact === 2.2), "positive alignment clarity was not exposed");
  ok(factors.some((factor) => factor.reason === "ALIGNMENT_VOLATILITY" && factor.impact === -1.1), "negative alignment volatility was not exposed");
  ok(!factors.some((factor) => factor.reason === "ALIGNMENT_VOLATILITY" && factor.impact > 0), "confusion was displayed as a positive crowd factor");
});

test("show history remains scoped to each player's controlled promotion", () => {
  const { aggregate, promotionAId, promotionBId } = twoPlayerFixture(72002);
  const playerA = buildPlayerShowHistory(aggregate, "player-a");
  const playerB = buildPlayerShowHistory(aggregate, "player-b");
  ok(playerA.shows.every((show) => aggregate.state.events.find((event) => event.id === show.eventId)?.promotionId === promotionAId), "player A received rival show history");
  ok(playerB.shows.every((show) => aggregate.state.events.find((event) => event.id === show.eventId)?.promotionId === promotionBId), "player B received rival show history");
  ok(!playerA.shows.some((show) => show.eventId === "results-event-b"), "player A leaked player B's show");
  ok(!playerB.shows.some((show) => show.eventId === "results-event-a"), "player B leaked player A's show");
});

test("frozen crowd-flow evidence is projected without reinterpreting mutable World state", () => {
  const { aggregate, promotionAId } = twoPlayerFixture(72004);
  const event = aggregate.state.events.find((candidate) => candidate.id === "results-event-a")!;
  event.crowdResponse = 73;
  aggregate.state.ledger.push(
    {
      id: "results-match-a-ledger",
      worldId: aggregate.state.world.id,
      date: { ...event.date },
      order: 1001,
      type: "MATCH_COMPLETED",
      significanceAtTime: "ROUTINE",
      historicalSignificance: "ROUTINE",
      entityIds: ["results-match-a", "results-event-a"],
      payload: {
        showFlowAlignmentModifier: 2.2,
        showFlowAlignmentReason: "FACE_HEEL_CLARITY",
        showFlowProgrammeModifier: -1.4,
        showFlowProgrammeReason: "PROGRAMME_REPETITION",
        showFlowPacingModifier: 1.2,
        showFlowPacingReason: "BIG_CLOSER",
        showFlowAdjustedCrowd: 74,
        showFlowWeight: 1,
      },
    },
    {
      id: "results-event-a-ledger",
      worldId: aggregate.state.world.id,
      date: { ...event.date },
      order: 1002,
      type: "EVENT_COMPLETED",
      significanceAtTime: "ROUTINE",
      historicalSignificance: "ROUTINE",
      entityIds: ["results-event-a", promotionAId],
      payload: {
        crowdResponse: 73,
        showFlowBaseCrowdResponse: 71,
        showFlowAdjustment: 2,
        showFlowFrozen: true,
      },
    },
  );

  const before = buildPlayerShowHistory(aggregate, "player-a");
  const show = before.shows[0]!;
  ok(show.crowdStory !== null, "frozen crowd evidence did not produce a crowd story");
  ok(show.crowdStory!.baseCrowdResponse === 71, "crowd story did not use frozen baseline");
  ok(show.crowdStory!.finalCrowdResponse === 73 && show.crowdStory!.adjustment === 2, "crowd story did not use frozen final result");
  ok(show.crowdStory!.tone === "POSITIVE", "positive flow adjustment did not classify correctly");
  ok(show.crowdStory!.positiveDrivers.some((driver) => driver.reason === "FACE_HEEL_CLARITY"), "alignment driver was not explained");
  ok(show.crowdStory!.positiveDrivers.some((driver) => driver.reason === "BIG_CLOSER"), "pacing driver was not explained");
  ok(show.crowdStory!.negativeDrivers.some((driver) => driver.reason === "PROGRAMME_REPETITION"), "Programme repetition drag was not explained");
  ok(show.matches[0]!.crowdFlowFactors.length === 3, "material match crowd factors were not projected");

  const matchPeople = aggregate.state.matchParticipants
    .filter((participant) => participant.matchId === "results-match-a")
    .map((participant) => aggregate.state.people.find((person) => person.id === participant.personId)!)
    .filter(Boolean);
  for (const person of matchPeople) setWrestlerAlignment(person, "HEEL");
  aggregate.state.programmes ??= [];
  aggregate.state.programmes.push({
    id: "results-later-programme",
    worldId: aggregate.state.world.id,
    promotionId: promotionAId,
    status: "ACTIVE",
    sideA: [{ kind: "PERSON", entityId: matchPeople[0]!.id }],
    sideB: [{ kind: "PERSON", entityId: matchPeople[1]!.id }],
    championshipId: null,
    startedDate: { year: 1, week: 3, day: 1 },
    endedDate: null,
    heat: 5,
    repetition: 100,
    activityCount: 20,
    matchCount: 15,
    segmentCount: 5,
    sideAWins: 8,
    sideBWins: 7,
    draws: 0,
    lastActivityDate: { year: 1, week: 3, day: 1 },
  });

  const after = buildPlayerShowHistory(aggregate, "player-a");
  ok(
    JSON.stringify(after.shows[0]!.crowdStory) === JSON.stringify(show.crowdStory),
    "old show crowd story changed after present-day alignment or Programme state changed",
  );
});

test("non-members cannot read World show history", () => {
  const { aggregate } = twoPlayerFixture(72003);
  let rejected = false;
  try {
    buildPlayerShowHistory(aggregate, "stranger");
  } catch (error) {
    rejected = error instanceof Error && error.message.includes("not an active member");
  }
  ok(rejected, "non-member could read show history");
});

console.log(`\nApplication results-view tests: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exitCode = 1;
