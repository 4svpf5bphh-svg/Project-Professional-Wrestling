declare const process: { exitCode?: number };

import { createWorldPlanningState, upsertDetailedShowDraft } from "../packages/application/src/planning.js";
import { recordResolvedProgrammeSegments } from "../packages/application/src/programme-segments.js";
import { DEFAULT_RULESET } from "../packages/config/src/default-ruleset.js";
import type { WrestlingEvent } from "../packages/domain/src/types.js";
import {
  activeContractsForPromotion,
  createProgramme,
  createWorld,
  evaluateProgrammeSignals,
  programmeActivities,
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
  if (!promotion) throw new Error("Programme segment fixture needs an active Independent promotion");
  const rosterIds = [...new Set(activeContractsForPromotion(state, promotion.id).map((contract) => contract.personId))];
  ok(rosterIds.length >= 4, "Programme segment fixture needs four contracted wrestlers");
  const programme = createProgramme(state, {
    promotionId: promotion.id,
    sideA: [{ kind: "PERSON", entityId: rosterIds[0]! }],
    sideB: [{ kind: "PERSON", entityId: rosterIds[1]! }],
  });
  const planning = createWorldPlanningState(state.world.id);
  const targetDate = { ...state.world.currentDate, day: 6 };
  return { state, promotion, rosterIds, programme, planning, targetDate };
}

function completedEvent(setup: ReturnType<typeof fixture>, status: "SCHEDULED" | "COMPLETED" = "COMPLETED"): WrestlingEvent {
  const market = setup.state.markets.find((candidate) => candidate.id === setup.promotion.homeMarketId) ?? setup.state.markets[0]!;
  const venue = setup.state.venues.find((candidate) => candidate.marketId === market.id) ?? setup.state.venues[0]!;
  return {
    id: `programme-segment-event:${setup.state.world.seed}`,
    worldId: setup.state.world.id,
    promotionId: setup.promotion.id,
    marketId: market.id,
    venueId: venue.id,
    date: setup.targetDate,
    type: "REGULAR",
    status,
    ticketStrategy: "STANDARD",
    expectedDemand: 100,
    attendance: status === "COMPLETED" ? 100 : 0,
    ticketYield: 25,
    gateRevenue: status === "COMPLETED" ? 2500 : 0,
    totalCost: status === "COMPLETED" ? 2000 : 0,
    netResult: status === "COMPLETED" ? 500 : 0,
    eventImportance: 60,
    matchCount: 0,
    averageMatchRating: 0,
    bestMatchRating: 0,
    crowdResponse: status === "COMPLETED" ? 65 : 0,
  };
}

function addSegmentDraft(setup: ReturnType<typeof fixture>, participantIds = [setup.rosterIds[0]!, setup.rosterIds[1]!]): void {
  upsertDetailedShowDraft(setup.state, setup.planning, setup.promotion.id, 0, {
    draftId: "segment-show",
    promotionId: setup.promotion.id,
    targetDate: setup.targetDate,
    marketId: null,
    venueId: null,
    ticketStrategy: null,
    participantIds: setup.rosterIds.slice(0, 4),
    matches: [],
    championshipAssignments: [],
    programmeSegments: [{
      draftSegmentId: "segment-1",
      programmeId: setup.programme.id,
      participantIds,
    }],
  });
}

function throwsContaining(fn: () => void, expected: string): void {
  let message = "";
  try {
    fn();
  } catch (error) {
    message = error instanceof Error ? error.message : String(error);
  }
  ok(message.includes(expected), `expected error containing '${expected}', received '${message || "no error"}'`);
}

test("Programme segments are validated against the show roster and Programme participants", () => {
  const setup = fixture(9141);
  addSegmentDraft(setup);
  const stored = setup.planning.workspaces[0]?.detailedShowDrafts[0]?.programmeSegments?.[0];
  ok(stored?.programmeId === setup.programme.id, "valid Programme segment was not persisted in the draft");

  const invalid = fixture(9142);
  throwsContaining(
    () => addSegmentDraft(invalid, [invalid.rosterIds[0]!, invalid.rosterIds[2]!]),
    "does not belong to Programme",
  );
});

test("typed show segments can attach an active Programme and preserve running order", () => {
  const setup = fixture(9150);
  upsertDetailedShowDraft(setup.state, setup.planning, setup.promotion.id, 0, {
    draftId: "typed-segment-show",
    promotionId: setup.promotion.id,
    targetDate: setup.targetDate,
    marketId: null,
    venueId: null,
    ticketStrategy: null,
    participantIds: setup.rosterIds.slice(0, 4),
    matches: [],
    championshipAssignments: [],
    segments: [{
      draftSegmentId: "typed-segment-1",
      type: "CONFRONTATION",
      participantIds: [setup.rosterIds[0]!, setup.rosterIds[1]!],
      programmeId: setup.programme.id,
      plannedLengthMinutes: 7,
    }],
    runningOrder: [{ kind: "SEGMENT", refId: "typed-segment-1" }],
  });

  const stored = setup.planning.workspaces[0]!.detailedShowDrafts[0]!;
  ok(stored.segments?.[0]?.type === "CONFRONTATION", "typed segment did not persist its story beat");
  ok(stored.runningOrder?.[0]?.refId === "typed-segment-1", "typed segment running order was not persisted");

  setup.state.events.push(completedEvent(setup));
  const recorded = recordResolvedProgrammeSegments(setup.state, setup.planning);
  ok(recorded === 1, `typed Programme segment recorded ${recorded} factual beats`);
  ok(programmeActivities(setup.state, setup.programme.id)[0]?.kind === "SEGMENT", "typed segment did not feed Programme history");
});

test("Programme segments remain planned until their show has completed", () => {
  const setup = fixture(9143);
  addSegmentDraft(setup);
  setup.state.events.push(completedEvent(setup, "SCHEDULED"));
  const recorded = recordResolvedProgrammeSegments(setup.state, setup.planning);
  ok(recorded === 0, `scheduled show recorded ${recorded} Programme segments before resolution`);
  ok(programmeActivities(setup.state, setup.programme.id).length === 0, "planned segment leaked into factual Programme history");
});

test("completed Programme segments become factual history once and contribute to Heat", () => {
  const setup = fixture(9144);
  addSegmentDraft(setup);
  setup.state.events.push(completedEvent(setup));

  const first = recordResolvedProgrammeSegments(setup.state, setup.planning);
  const second = recordResolvedProgrammeSegments(setup.state, setup.planning);
  const activities = programmeActivities(setup.state, setup.programme.id);
  const signals = evaluateProgrammeSignals(setup.state, setup.programme);

  ok(first === 1, `expected one completed Programme segment, recorded ${first}`);
  ok(second === 0, `retry recorded ${second} duplicate Programme segments`);
  ok(activities.length === 1 && activities[0]?.kind === "SEGMENT", "resolved segment was not stored as Programme activity");
  ok(activities[0]?.eventId === setup.state.events[0]?.id, "resolved segment did not retain its event link");
  ok(setup.programme.segmentCount === 1 && setup.programme.activityCount === 1, "Programme counters did not record the segment exactly once");
  ok(signals.heat !== null && signals.heat > 40, `resolved segment did not establish meaningful Programme heat: ${signals.heat}`);
  ok(signals.repetition === 0, `first Programme segment should not create repetition, found ${signals.repetition}`);
});

console.log(`\nProgramme segment tests: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exitCode = 1;
