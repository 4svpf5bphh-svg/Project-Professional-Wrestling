declare const process: { env: Record<string, string | undefined>; exitCode?: number };

import {
  claimIndependentPromotionCommand,
  createWorldCommandState,
  createWorldOwnershipState,
  createWorldRuntimeState,
  joinPlayerToWorld,
  lockPersistedWorldForResolution,
  resolvePersistedWorldWeek,
  type ApplicationWorldAggregate,
} from "../packages/application/src/index.js";
import { DEFAULT_RULESET } from "../packages/config/src/default-ruleset.js";
import { createPostgresApplicationWorldRepository } from "../packages/persistence/src/index.js";
import { createWorld } from "../packages/sim-core/src/index.js";

function ok(value: unknown, message: string): void {
  if (!value) throw new Error(message);
}

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is required for PostgreSQL repository integration tests");

const { repository, close } = createPostgresApplicationWorldRepository(connectionString);
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

function fixture(seed: number): ApplicationWorldAggregate {
  const state = createWorld(seed, DEFAULT_RULESET);
  return {
    state,
    ownership: createWorldOwnershipState(state.world.id, 1),
    commands: createWorldCommandState(state.world.id),
    runtime: createWorldRuntimeState(state.world.id),
  };
}

try {
  await repository.migrate();

  await test("PostgreSQL repository atomically persists command ownership receipt and World state", async () => {
    const aggregate = fixture(14001);
    joinPlayerToWorld(aggregate.ownership, "player-a", aggregate.state.world.currentDate);
    await repository.initialize(aggregate);
    const promotion = aggregate.state.promotions.find((candidate) => candidate.tier === "INDEPENDENT" && candidate.lifecycle === "ACTIVE")!;
    const envelope = {
      requestId: "postgres-claim",
      worldId: aggregate.state.world.id,
      playerId: "player-a",
      commandType: "CLAIM_INDEPENDENT_PROMOTION" as const,
      payload: { promotionId: promotion.id },
    };

    await repository.transact(aggregate.state.world.id, 0, (working) => {
      claimIndependentPromotionCommand(working.state, working.ownership, working.commands, working.runtime, envelope);
    });
    const loaded = await repository.load(aggregate.state.world.id);
    ok(loaded.runtime.revision === 1, "runtime revision was not persisted");
    ok(loaded.ownership.promotionControls.length === 1, "relational promotion control was not persisted");
    ok(loaded.commands.receipts.length === 1, "relational command receipt was not persisted");
    ok(loaded.state.promotions.find((candidate) => candidate.id === promotion.id)?.controllerType === "HUMAN", "simulation snapshot was not persisted");

    const retry = await repository.transact(aggregate.state.world.id, 1, (working) => (
      claimIndependentPromotionCommand(working.state, working.ownership, working.commands, working.runtime, envelope)
    ));
    ok(retry.revision === 1, "idempotent retry revised persisted World");
    const afterRetry = await repository.load(aggregate.state.world.id);
    ok(afterRetry.commands.receipts.length === 1, "idempotent retry duplicated persisted receipt");
    ok(afterRetry.ownership.promotionControls.length === 1, "idempotent retry duplicated persisted control");
  });

  await test("PostgreSQL transaction rollback leaves no partial World mutation", async () => {
    const aggregate = fixture(14002);
    joinPlayerToWorld(aggregate.ownership, "player-b", aggregate.state.world.currentDate);
    await repository.initialize(aggregate);
    const promotion = aggregate.state.promotions.find((candidate) => candidate.tier === "INDEPENDENT" && candidate.lifecycle === "ACTIVE")!;

    let rejected = false;
    try {
      await repository.transact(aggregate.state.world.id, 0, (working) => {
        claimIndependentPromotionCommand(working.state, working.ownership, working.commands, working.runtime, {
          requestId: "postgres-rollback",
          worldId: working.state.world.id,
          playerId: "player-b",
          commandType: "CLAIM_INDEPENDENT_PROMOTION",
          payload: { promotionId: promotion.id },
        });
        throw new Error("simulated database transaction failure");
      });
    } catch {
      rejected = true;
    }
    ok(rejected, "failing PostgreSQL transaction unexpectedly committed");
    const loaded = await repository.load(aggregate.state.world.id);
    ok(loaded.runtime.revision === 0, "rollback left revised runtime");
    ok(loaded.ownership.promotionControls.length === 0, "rollback left promotion control");
    ok(loaded.commands.receipts.length === 0, "rollback left command receipt");
    ok(loaded.state.promotions.find((candidate) => candidate.id === promotion.id)?.controllerType === "AI", "rollback left simulation mutation");
  });

  await test("PostgreSQL keeps weekly lock durable and resolves the week atomically", async () => {
    const aggregate = fixture(14003);
    await repository.initialize(aggregate);
    const worldId = aggregate.state.world.id;
    const originalWeek = aggregate.state.world.currentDate.week;

    await lockPersistedWorldForResolution(repository, worldId, 0);
    const locked = await repository.load(worldId);
    ok(locked.runtime.phase === "LOCKING", "durable PostgreSQL lock was not visible after transaction");

    await resolvePersistedWorldWeek(repository, worldId, 0);
    const resolved = await repository.load(worldId);
    ok(resolved.runtime.phase === "OPEN", "resolved PostgreSQL World did not reopen");
    ok(resolved.runtime.revision === 1, "weekly resolution did not persist exactly one revision");
    ok(resolved.runtime.lastResolvedPpwDate?.week === originalWeek, "resolved PPW week was not persisted");
    ok(resolved.state.world.currentDate.week !== originalWeek || resolved.state.world.currentDate.year > 1, "World snapshot did not advance after resolution");
  });
} finally {
  await close();
}

console.log(`\nPostgreSQL repository tests: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exitCode = 1;
