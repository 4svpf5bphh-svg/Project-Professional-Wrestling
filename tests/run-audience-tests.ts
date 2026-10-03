declare const process: { exitCode?: number };

import { DEFAULT_RULESET } from "../packages/config/src/default-ruleset.js";
import {
  createWorld,
  decayAudienceMarketHeat,
  planAndResolveWorldEvents,
  planWorldEvents,
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

console.log(`\nAudience tests: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exitCode = 1;
