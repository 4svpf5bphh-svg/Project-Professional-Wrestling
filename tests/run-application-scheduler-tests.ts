declare const process: { exitCode?: number };

import {
  createWorldCommandState,
  createWorldOwnershipState,
  createWorldPlanningState,
  createWorldRuntimeState,
  lockPersistedWorldForResolution,
  resolveScheduledWorldCycle,
  type ApplicationWorldAggregate,
} from "../packages/application/src/index.js";
import { DEFAULT_RULESET } from "../packages/config/src/default-ruleset.js";
import { InMemoryApplicationWorldRepository } from "../packages/persistence/src/memory-world-repository.js";
import { createWorld } from "../packages/sim-core/src/index.js";

let passed = 0;
let failed = 0;

async function test(name: string, fn: () => Promise<void>): Promise<void> {
  try {
    await fn();
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

function fixture(seed: number): ApplicationWorldAggregate {
  const state = createWorld(seed, DEFAULT_RULESET);
  return {
    state,
    ownership: createWorldOwnershipState(state.world.id, 1),
    commands: createWorldCommandState(state.world.id),
    runtime: createWorldRuntimeState(state.world.id),
    planning: createWorldPlanningState(state.world.id),
  };
}

await test("scheduled resolver advances exactly one week for a new UTC cycle", async () => {
  const aggregate = fixture(18001);
  const repository = new InMemoryApplicationWorldRepository();
  await repository.initialize(aggregate);
  const worldId = aggregate.state.world.id;

  const result = await resolveScheduledWorldCycle(repository, worldId, "2026-10-04");
  const after = await repository.load(worldId);

  ok(result.status === "RESOLVED", "first scheduled cycle did not resolve");
  ok(after.state.world.currentDate.week === 2, "scheduled cycle did not advance exactly one PPW week");
  ok(after.runtime.phase === "OPEN", "scheduled cycle did not reopen the World");
  ok(after.runtime.lastResolvedRealCycleKey === "2026-10-04", "scheduled cycle key was not persisted");
  ok(after.runtime.lockedRealCycleKey === null, "resolved World retained its scheduled lock key");
});

await test("duplicate scheduler delivery cannot resolve the same real cycle twice", async () => {
  const aggregate = fixture(18002);
  const repository = new InMemoryApplicationWorldRepository();
  await repository.initialize(aggregate);
  const worldId = aggregate.state.world.id;

  await resolveScheduledWorldCycle(repository, worldId, "2026-10-04");
  const first = await repository.load(worldId);
  const duplicate = await resolveScheduledWorldCycle(repository, worldId, "2026-10-04");
  const after = await repository.load(worldId);

  ok(duplicate.status === "ALREADY_RESOLVED", "duplicate scheduled cycle was not recognized");
  ok(after.state.world.currentDate.week === first.state.world.currentDate.week, "duplicate scheduler delivery advanced another PPW week");
  ok(after.runtime.revision === first.runtime.revision, "duplicate scheduler delivery changed World revision");
});

await test("a later UTC cycle resolves the next PPW week", async () => {
  const aggregate = fixture(18003);
  const repository = new InMemoryApplicationWorldRepository();
  await repository.initialize(aggregate);
  const worldId = aggregate.state.world.id;

  await resolveScheduledWorldCycle(repository, worldId, "2026-10-04");
  const second = await resolveScheduledWorldCycle(repository, worldId, "2026-10-05");
  const after = await repository.load(worldId);

  ok(second.status === "RESOLVED", "later scheduled cycle did not resolve");
  ok(after.state.world.currentDate.week === 3, "later scheduled cycle did not advance the next PPW week");
  ok(after.runtime.lastResolvedRealCycleKey === "2026-10-05", "latest scheduled cycle key was not persisted");
});

await test("scheduler recovers a durable lock for the same cycle without double advancing", async () => {
  const aggregate = fixture(18004);
  const repository = new InMemoryApplicationWorldRepository();
  await repository.initialize(aggregate);
  const worldId = aggregate.state.world.id;

  await lockPersistedWorldForResolution(repository, worldId, 0, "2026-10-04");
  const locked = await repository.load(worldId);
  ok(locked.runtime.phase === "LOCKING", "fixture did not persist the World lock");
  ok(locked.runtime.lockedRealCycleKey === "2026-10-04", "fixture did not persist the cycle key");

  const recovered = await resolveScheduledWorldCycle(repository, worldId, "2026-10-04");
  const afterRecovery = await repository.load(worldId);
  const duplicate = await resolveScheduledWorldCycle(repository, worldId, "2026-10-04");
  const finalState = await repository.load(worldId);

  ok(recovered.status === "RESOLVED", "scheduler did not recover the durable lock");
  ok(afterRecovery.state.world.currentDate.week === 2, "recovered lock did not resolve exactly one week");
  ok(duplicate.status === "ALREADY_RESOLVED", "recovered cycle was not protected from retry");
  ok(finalState.state.world.currentDate.week === 2, "retry after recovery double-resolved the World");
});

await test("an older scheduler delivery is harmless after a newer cycle has resolved", async () => {
  const aggregate = fixture(18005);
  const repository = new InMemoryApplicationWorldRepository();
  await repository.initialize(aggregate);
  const worldId = aggregate.state.world.id;

  await resolveScheduledWorldCycle(repository, worldId, "2026-10-05");
  const before = await repository.load(worldId);
  const stale = await resolveScheduledWorldCycle(repository, worldId, "2026-10-04");
  const after = await repository.load(worldId);

  ok(stale.status === "ALREADY_RESOLVED", "older scheduler delivery was not treated as stale/already resolved");
  ok(after.state.world.currentDate.week === before.state.world.currentDate.week, "older scheduler delivery advanced the World");
  ok(after.runtime.revision === before.runtime.revision, "older scheduler delivery changed World revision");
});

await test("scheduler rejects malformed real-cycle keys", async () => {
  const aggregate = fixture(18006);
  const repository = new InMemoryApplicationWorldRepository();
  await repository.initialize(aggregate);

  let rejected = false;
  try {
    await resolveScheduledWorldCycle(repository, aggregate.state.world.id, "04-10-2026");
  } catch {
    rejected = true;
  }
  ok(rejected, "malformed cycle key was accepted");
});

console.log(`\nApplication scheduler tests: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exitCode = 1;
