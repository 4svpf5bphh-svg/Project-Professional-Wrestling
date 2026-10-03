declare const process: { exitCode?: number };

import {
  createPersistedApplicationWorld,
  createWorldCommandState,
  createWorldOwnershipState,
  createWorldPlanningState,
  createWorldRuntimeState,
  restorePersistedApplicationWorld,
  type ApplicationWorldAggregate,
} from "../packages/application/src/index.js";
import { DEFAULT_RULESET } from "../packages/config/src/default-ruleset.js";
import { createWorld } from "../packages/sim-core/src/index.js";

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

test("C1 planning snapshots without reservation state restore with an empty reservation set", () => {
  const state = createWorld(16060, DEFAULT_RULESET);
  const aggregate: ApplicationWorldAggregate = {
    state,
    ownership: createWorldOwnershipState(state.world.id, 1),
    commands: createWorldCommandState(state.world.id),
    runtime: createWorldRuntimeState(state.world.id),
    planning: createWorldPlanningState(state.world.id),
  };
  const snapshot = createPersistedApplicationWorld(aggregate);
  const legacyPlanning = snapshot.planning as unknown as { showReservations?: unknown[] };
  delete legacyPlanning.showReservations;
  const restored = restorePersistedApplicationWorld(snapshot);
  ok(Array.isArray(restored.planning.showReservations), "legacy planning snapshot did not materialize reservation array");
  ok(restored.planning.showReservations.length === 0, "legacy planning snapshot invented reservations");
});

console.log(`\nApplication planning compatibility tests: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exitCode = 1;
