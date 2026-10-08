declare const process: { exitCode?: number };

import { DEFAULT_RULESET } from "../packages/config/src/default-ruleset.js";
import type { Match, WrestlingEvent } from "../packages/domain/src/types.js";
import {
  activeContractsForPromotion,
  createProgramme,
  createWorld,
  evaluateProgrammeSignals,
  recordProgrammeActivity,
  updateProgrammeSignalsForCurrentWeek,
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

function fixture(seed: number) {
  const state = createWorld(seed, DEFAULT_RULESET);
  const promotion = state.promotions.find((candidate) => candidate.tier === "INDEPENDENT" && candidate.lifecycle === "ACTIVE");
  if (!promotion) throw new Error("Programme signal fixture needs an active Independent promotion");
  const rosterIds = [...new Set(activeContractsForPromotion(state, promotion.id).map((contract) => contract.personId))];
  ok(rosterIds.length >= 4, "Programme signal fixture needs four contracted wrestlers");
  return { state, promotion, rosterIds };
}

function addMatchActivity(
  setup: ReturnType<typeof fixture>,
  programmeId: string,
  week: number,
  matchId: string,
  sideAId: string,
  sideBId: string,
  executionQuality: number,
  crowdResponse: number,
  eventImportance: number,
): void {
  const { state, promotion } = setup;
  const market = state.markets.find((candidate) => candidate.id === promotion.homeMarketId) ?? state.markets[0]!;
  const venue = state.venues.find((candidate) => candidate.marketId === market.id) ?? state.venues[0]!;
  const eventId = `${matchId}:event`;
  const event: WrestlingEvent = {
    id: eventId,
    worldId: state.world.id,
    promotionId: promotion.id,
    marketId: market.id,
    venueId: venue.id,
    date: { year: 1, week, day: 6 },
    type: "REGULAR",
    status: "COMPLETED",
    ticketStrategy: "STANDARD",
    expectedDemand: 100,
    attendance: 100,
    ticketYield: 25,
    gateRevenue: 2500,
    totalCost: 2000,
    netResult: 500,
    eventImportance,
    matchCount: 1,
    averageMatchRating: Math.max(0.5, Math.min(5, executionQuality / 20)),
    bestMatchRating: Math.max(0.5, Math.min(5, executionQuality / 20)),
    crowdResponse,
  };
  state.events.push(event);
  const match: Match = {
    id: matchId,
    worldId: state.world.id,
    eventId,
    promotionId: promotion.id,
    order: 1,
    type: "SINGLES",
    status: "COMPLETED",
    intent: "COMPETITIVE",
    plannedLengthMinutes: 15,
    actualLengthMinutes: 15,
    intendedWinnerSide: "A",
    actualWinnerSide: "A",
    finishChangedDueToInjury: false,
    executionQuality,
    criticalRatingStars: Math.max(0.5, Math.min(5, executionQuality / 20)),
    crowdResponse,
  };
  state.matches.push(match);
  recordProgrammeActivity(state, {
    programmeId,
    kind: "MATCH",
    date: event.date,
    participantEntityIds: [sideAId, sideBId],
    eventId,
    matchId,
    winnerSide: "A",
  });
}

test("strong resolved matches create more Programme heat than weak matches", () => {
  const weak = fixture(9131);
  weak.state.world.currentDate = { year: 1, week: 1, day: 1 };
  const weakProgramme = createProgramme(weak.state, {
    promotionId: weak.promotion.id,
    sideA: [{ kind: "PERSON", entityId: weak.rosterIds[0]! }],
    sideB: [{ kind: "PERSON", entityId: weak.rosterIds[1]! }],
  });
  addMatchActivity(weak, weakProgramme.id, 1, "weak-programme-match", weak.rosterIds[0]!, weak.rosterIds[1]!, 35, 30, 35);
  const weakSignals = evaluateProgrammeSignals(weak.state, weakProgramme);

  const strong = fixture(9132);
  strong.state.world.currentDate = { year: 1, week: 1, day: 1 };
  const strongProgramme = createProgramme(strong.state, {
    promotionId: strong.promotion.id,
    sideA: [{ kind: "PERSON", entityId: strong.rosterIds[0]! }],
    sideB: [{ kind: "PERSON", entityId: strong.rosterIds[1]! }],
  });
  addMatchActivity(strong, strongProgramme.id, 1, "strong-programme-match", strong.rosterIds[0]!, strong.rosterIds[1]!, 92, 90, 85);
  const strongSignals = evaluateProgrammeSignals(strong.state, strongProgramme);

  ok(weakSignals.repetition === 0 && strongSignals.repetition === 0, "a first Programme match should not be labelled repetitive");
  ok(
    strongSignals.heat !== null && weakSignals.heat !== null && strongSignals.heat >= weakSignals.heat + 25,
    `strong match heat ${strongSignals.heat} did not clearly exceed weak match heat ${weakSignals.heat}`,
  );
});

test("repeating the same matchup builds substantially more fatigue than varied Programme matches", () => {
  const repeated = fixture(9133);
  repeated.state.world.currentDate = { year: 1, week: 1, day: 1 };
  const repeatedProgramme = createProgramme(repeated.state, {
    promotionId: repeated.promotion.id,
    sideA: [
      { kind: "PERSON", entityId: repeated.rosterIds[0]! },
      { kind: "PERSON", entityId: repeated.rosterIds[1]! },
    ],
    sideB: [
      { kind: "PERSON", entityId: repeated.rosterIds[2]! },
      { kind: "PERSON", entityId: repeated.rosterIds[3]! },
    ],
  });
  for (let week = 1; week <= 4; week += 1) {
    addMatchActivity(repeated, repeatedProgramme.id, week, `repeat-${week}`, repeated.rosterIds[0]!, repeated.rosterIds[2]!, 74, 72, 60);
  }
  repeated.state.world.currentDate = { year: 1, week: 4, day: 1 };
  const repeatedSignals = evaluateProgrammeSignals(repeated.state, repeatedProgramme);

  const varied = fixture(9134);
  varied.state.world.currentDate = { year: 1, week: 1, day: 1 };
  const variedProgramme = createProgramme(varied.state, {
    promotionId: varied.promotion.id,
    sideA: [
      { kind: "PERSON", entityId: varied.rosterIds[0]! },
      { kind: "PERSON", entityId: varied.rosterIds[1]! },
    ],
    sideB: [
      { kind: "PERSON", entityId: varied.rosterIds[2]! },
      { kind: "PERSON", entityId: varied.rosterIds[3]! },
    ],
  });
  const pairings: Array<[string, string]> = [
    [varied.rosterIds[0]!, varied.rosterIds[2]!],
    [varied.rosterIds[1]!, varied.rosterIds[3]!],
    [varied.rosterIds[0]!, varied.rosterIds[3]!],
    [varied.rosterIds[1]!, varied.rosterIds[2]!],
  ];
  pairings.forEach(([sideAId, sideBId], index) => {
    addMatchActivity(varied, variedProgramme.id, index + 1, `varied-${index + 1}`, sideAId, sideBId, 74, 72, 60);
  });
  varied.state.world.currentDate = { year: 1, week: 4, day: 1 };
  const variedSignals = evaluateProgrammeSignals(varied.state, variedProgramme);

  ok(
    repeatedSignals.repetition >= variedSignals.repetition + 30,
    `repeated matchup fatigue ${repeatedSignals.repetition} was not clearly above varied booking ${variedSignals.repetition}`,
  );
  ok(
    repeatedSignals.heat !== null && variedSignals.heat !== null && variedSignals.heat > repeatedSignals.heat,
    "overexposure should suppress heat relative to equally good varied Programme booking",
  );
});

test("time apart relieves repetition while an inactive Programme cools", () => {
  const setup = fixture(9135);
  setup.state.world.currentDate = { year: 1, week: 1, day: 1 };
  const programme = createProgramme(setup.state, {
    promotionId: setup.promotion.id,
    sideA: [{ kind: "PERSON", entityId: setup.rosterIds[0]! }],
    sideB: [{ kind: "PERSON", entityId: setup.rosterIds[1]! }],
  });
  for (let week = 1; week <= 4; week += 1) {
    addMatchActivity(setup, programme.id, week, `rest-${week}`, setup.rosterIds[0]!, setup.rosterIds[1]!, 78, 78, 65);
  }
  setup.state.world.currentDate = { year: 1, week: 4, day: 1 };
  const hot = evaluateProgrammeSignals(setup.state, programme);

  setup.state.world.currentDate = { year: 1, week: 12, day: 1 };
  const rested = evaluateProgrammeSignals(setup.state, programme);
  ok(rested.repetition === 0, `eight weeks apart should clear repetition pressure, found ${rested.repetition}`);
  ok(
    hot.heat !== null && rested.heat !== null && rested.heat <= hot.heat - 20,
    `inactive Programme did not cool enough: ${hot.heat} -> ${rested.heat}`,
  );

  setup.state.world.currentDate = { year: 1, week: 14, day: 1 };
  const cold = evaluateProgrammeSignals(setup.state, programme);
  ok(cold.heat === 10 && cold.repetition === 0, `long-idle Programme should settle cold, got heat ${cold.heat} repetition ${cold.repetition}`);
});

test("Programme signal recomputation is idempotent", () => {
  const setup = fixture(9136);
  setup.state.world.currentDate = { year: 1, week: 1, day: 1 };
  const programme = createProgramme(setup.state, {
    promotionId: setup.promotion.id,
    sideA: [{ kind: "PERSON", entityId: setup.rosterIds[0]! }],
    sideB: [{ kind: "PERSON", entityId: setup.rosterIds[1]! }],
  });
  addMatchActivity(setup, programme.id, 1, "idempotent-match", setup.rosterIds[0]!, setup.rosterIds[1]!, 80, 75, 70);

  updateProgrammeSignalsForCurrentWeek(setup.state);
  const first = { heat: programme.heat, repetition: programme.repetition };
  updateProgrammeSignalsForCurrentWeek(setup.state);
  const second = { heat: programme.heat, repetition: programme.repetition };
  ok(first.heat === second.heat && first.repetition === second.repetition, "retrying Programme signal calculation changed the result");
});

console.log(`\nProgramme signal tests: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exitCode = 1;
