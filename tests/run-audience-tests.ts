declare const process: { exitCode?: number };

import { DEFAULT_RULESET } from "../packages/config/src/default-ruleset.js";
import type { WrestlingEvent } from "../packages/domain/src/types.js";
import {
  applyCurrentWeekShowFlowAudienceConsequences,
  createWorld,
  decayAudienceMarketHeat,
  planAndResolveWorldEvents,
  planWorldEvents,
  showFlowAudienceStrengthDelta,
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

test("completed shows leave a local audience heat consequence", () => {
  const state = createWorld(10101, DEFAULT_RULESET);
  const before = new Map(state.promotionMarketStates.map((entry) => [`${entry.promotionId}:${entry.marketId}`, entry.liveStrength]));
  planAndResolveWorldEvents(state);
  const completed = state.events.filter((event) => event.status === "COMPLETED");
  ok(completed.length > 0, "expected at least one completed event");
  const changed = completed.some((event) => {
    const local = state.promotionMarketStates.find((entry) => entry.promotionId === event.promotionId && entry.marketId === event.marketId);
    const prior = before.get(`${event.promotionId}:${event.marketId}`);
    return local !== undefined && prior !== undefined && local.liveStrength !== prior;
  });
  ok(changed, "completed events did not change local live strength");
});

test("local audience heat materially influences future event demand", () => {
  const hot = createWorld(10102, DEFAULT_RULESET);
  const cold = createWorld(10102, DEFAULT_RULESET);
  const promotionId = hot.promotions[0]!.id;
  for (const entry of hot.promotionMarketStates) if (entry.promotionId === promotionId) entry.liveStrength = 85;
  for (const entry of cold.promotionMarketStates) if (entry.promotionId === promotionId) entry.liveStrength = 20;
  planWorldEvents(hot);
  planWorldEvents(cold);
  const hotEvent = hot.events.find((event) => event.promotionId === promotionId);
  const coldEvent = cold.events.find((event) => event.promotionId === promotionId);
  ok(hotEvent && coldEvent, "expected matching planned events for the comparison promotion");
  ok(hotEvent!.marketId === coldEvent!.marketId, "heat-only comparison selected different markets");
  ok(hotEvent!.expectedDemand > coldEvent!.expectedDemand * 1.2, `hot demand ${hotEvent!.expectedDemand} was not materially above cold demand ${coldEvent!.expectedDemand}`);
});

test("audience heat decays gradually toward durable loyalty", () => {
  const state = createWorld(10103, DEFAULT_RULESET);
  const local = state.promotionMarketStates[0]!;
  local.loyalty = 40;
  local.liveStrength = 90;
  decayAudienceMarketHeat(local);
  ok(local.liveStrength === 89, `expected hot market to decay to 89, got ${local.liveStrength}`);
  local.loyalty = 60;
  local.liveStrength = 20;
  decayAudienceMarketHeat(local);
  ok(local.liveStrength === 20.8, `expected cold market to recover to 20.8, got ${local.liveStrength}`);
  ok(local.liveStrength < local.loyalty, "heat should not snap immediately back to loyalty");
});

test("show-flow audience consequence is modest and hard-capped", () => {
  ok(showFlowAudienceStrengthDelta(4.2) === 0.4, "positive show-flow adjustment scaled incorrectly");
  ok(showFlowAudienceStrengthDelta(-3.4) === -0.3, "negative show-flow adjustment scaled incorrectly");
  ok(showFlowAudienceStrengthDelta(99) === 0.5, "positive show-flow consequence exceeded its cap");
  ok(showFlowAudienceStrengthDelta(-99) === -0.5, "negative show-flow consequence exceeded its cap");
});

test("frozen show flow changes only local live strength and applies exactly once", () => {
  const state = createWorld(10104, DEFAULT_RULESET);
  const promotion = state.promotions[0]!;
  const local = state.promotionMarketStates.find((entry) => (
    entry.promotionId === promotion.id && entry.marketId === promotion.homeMarketId
  ))!;
  const venue = state.venues.find((candidate) => candidate.marketId === promotion.homeMarketId)!;
  local.liveStrength = 50;
  local.loyalty = 37;
  local.awareness = 61;
  const event: WrestlingEvent = {
    id: "audience-flow-event",
    worldId: state.world.id,
    promotionId: promotion.id,
    marketId: promotion.homeMarketId,
    venueId: venue.id,
    date: { ...state.world.currentDate, day: 6 },
    type: "REGULAR",
    status: "COMPLETED",
    ticketStrategy: "STANDARD",
    expectedDemand: 500,
    attendance: 450,
    ticketYield: 40,
    gateRevenue: 18000,
    totalCost: 15000,
    netResult: 3000,
    eventImportance: 58,
    matchCount: 3,
    averageMatchRating: 3.2,
    bestMatchRating: 3.8,
    crowdResponse: 73,
  };
  state.events.push(event);
  state.ledger.push({
    id: "audience-flow-ledger",
    worldId: state.world.id,
    date: { ...event.date },
    order: 999,
    type: "EVENT_COMPLETED",
    significanceAtTime: "ROUTINE",
    historicalSignificance: "ROUTINE",
    entityIds: [event.id, promotion.id, event.marketId, event.venueId],
    payload: {
      crowdResponse: 73,
      showFlowFrozen: true,
      showFlowAdjustment: 4.2,
    },
  });

  ok(applyCurrentWeekShowFlowAudienceConsequences(state) === 1, "frozen show-flow consequence was not applied");
  ok(local.liveStrength === 50.4, `expected live strength 50.4, got ${local.liveStrength}`);
  ok(local.loyalty === 37, "show flow incorrectly changed durable loyalty");
  ok(local.awareness === 61, "show flow incorrectly changed awareness");
  const ledger = state.ledger.at(-1)!;
  ok(ledger.payload.showFlowAudienceApplied === true, "event history did not mark audience consequence as applied");
  ok(ledger.payload.showFlowAudienceStrengthDelta === 0.4, "event history did not freeze the applied audience delta");
  ok(ledger.payload.showFlowAudienceStrengthBefore === 50, "event history did not freeze pre-consequence local strength");
  ok(ledger.payload.showFlowAudienceStrengthAfter === 50.4, "event history did not freeze post-consequence local strength");

  ok(applyCurrentWeekShowFlowAudienceConsequences(state) === 0, "audience consequence applied twice on retry");
  ok(local.liveStrength === 50.4, "retry changed local audience strength twice");
});

test("unfrozen or legacy show history does not invent a show-flow audience consequence", () => {
  const state = createWorld(10105, DEFAULT_RULESET);
  const promotion = state.promotions[0]!;
  const local = state.promotionMarketStates.find((entry) => (
    entry.promotionId === promotion.id && entry.marketId === promotion.homeMarketId
  ))!;
  const venue = state.venues.find((candidate) => candidate.marketId === promotion.homeMarketId)!;
  const before = local.liveStrength;
  const event: WrestlingEvent = {
    id: "audience-legacy-event",
    worldId: state.world.id,
    promotionId: promotion.id,
    marketId: promotion.homeMarketId,
    venueId: venue.id,
    date: { ...state.world.currentDate, day: 6 },
    type: "REGULAR",
    status: "COMPLETED",
    ticketStrategy: "STANDARD",
    expectedDemand: 500,
    attendance: 450,
    ticketYield: 40,
    gateRevenue: 18000,
    totalCost: 15000,
    netResult: 3000,
    eventImportance: 58,
    matchCount: 3,
    averageMatchRating: 3.2,
    bestMatchRating: 3.8,
    crowdResponse: 70,
  };
  state.events.push(event);
  state.ledger.push({
    id: "audience-legacy-ledger",
    worldId: state.world.id,
    date: { ...event.date },
    order: 999,
    type: "EVENT_COMPLETED",
    significanceAtTime: "ROUTINE",
    historicalSignificance: "ROUTINE",
    entityIds: [event.id, promotion.id, event.marketId, event.venueId],
    payload: { crowdResponse: 70, showFlowAdjustment: 4 },
  });

  ok(applyCurrentWeekShowFlowAudienceConsequences(state) === 0, "legacy event received an invented show-flow consequence");
  ok(local.liveStrength === before, "legacy event changed local audience strength");
});

console.log(`\nAudience tests: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exitCode = 1;
