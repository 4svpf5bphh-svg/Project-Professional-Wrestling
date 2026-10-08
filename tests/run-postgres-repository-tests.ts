declare const process: { env: Record<string, string | undefined>; exitCode?: number };

import postgres from "postgres";
import {
  claimIndependentPromotionCommand,
  createWorldCommandState,
  createWorldOwnershipState,
  createWorldPlanningState,
  createWorldRuntimeState,
  joinPlayerToWorld,
  lockPersistedCurrentWeekShowCommitments,
  lockPersistedWorldForResolution,
  resolvePersistedWorldWeek,
  upsertDetailedShowDraftCommand,
  type ApplicationWorldAggregate,
} from "../packages/application/src/index.js";
import { DEFAULT_RULESET } from "../packages/config/src/default-ruleset.js";
import {
  POSTGRES_APPLICATION_MIGRATIONS,
  createPostgresApplicationWorldRepository,
} from "../packages/persistence/src/postgres-world-repository.js";
import { createWorld } from "../packages/sim-core/src/index.js";

function ok(value: unknown, message: string): void {
  if (!value) throw new Error(message);
}

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is required for PostgreSQL repository integration tests");

const { repository, close } = createPostgresApplicationWorldRepository(connectionString);
const inspectionSql = postgres(connectionString, { max: 1 });
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
    planning: createWorldPlanningState(state.world.id),
  };
}

try {
  await repository.migrate();

  await test("PostgreSQL migration ledger is numbered and idempotent", async () => {
    await repository.migrate();
    const rows = await inspectionSql`SELECT version, name FROM ppw_schema_migrations ORDER BY version` as unknown as Array<{ version: number; name: string }>;
    const expected = POSTGRES_APPLICATION_MIGRATIONS.map((migration) => migration.version);
    const actual = rows.map((row) => Number(row.version));
    ok(JSON.stringify(actual) === JSON.stringify(expected), `migration ledger mismatch: expected ${expected.join(",")}, got ${actual.join(",")}`);
    ok(new Set(actual).size === actual.length, "migration ledger contains duplicate versions");
  });

  await test("one-time Alpha playtest reset deletes only the target World and cascades its relational state", async () => {
    // The HTTP integration uses the same CI database and may already have
    // bootstrapped the default Alpha World after migration 5 first ran.
    // Clear that fixture so this test can deliberately replay migration 5
    // against a known pre-reset target.
    await inspectionSql`DELETE FROM ppw_worlds WHERE world_id = 'world-20261002'`;

    const target = fixture(20261002);
    joinPlayerToWorld(target.ownership, "alpha-player-1", target.state.world.currentDate);
    const targetPromotion = target.state.promotions.find(
      (candidate) => candidate.tier === "INDEPENDENT" && candidate.lifecycle === "ACTIVE",
    )!;
    claimIndependentPromotionCommand(target.state, target.ownership, target.commands, target.runtime, {
      requestId: "alpha-reset-target-claim",
      worldId: target.state.world.id,
      playerId: "alpha-player-1",
      commandType: "CLAIM_INDEPENDENT_PROMOTION",
      payload: { promotionId: targetPromotion.id },
    });
    await repository.initialize(target);

    const unrelated = fixture(14000);
    joinPlayerToWorld(unrelated.ownership, "unrelated-player", unrelated.state.world.currentDate);
    await repository.initialize(unrelated);

    const beforeChildren = await inspectionSql`
      SELECT
        (SELECT count(*)::int FROM ppw_world_memberships WHERE world_id = ${target.state.world.id}) AS memberships,
        (SELECT count(*)::int FROM ppw_promotion_controls WHERE world_id = ${target.state.world.id}) AS controls,
        (SELECT count(*)::int FROM ppw_command_receipts WHERE world_id = ${target.state.world.id}) AS receipts
    ` as unknown as Array<{ memberships: number; controls: number; receipts: number }>;
    ok(Number(beforeChildren[0]?.memberships) > 0, "reset fixture did not persist membership children");
    ok(Number(beforeChildren[0]?.controls) > 0, "reset fixture did not persist promotion-control children");
    ok(Number(beforeChildren[0]?.receipts) > 0, "reset fixture did not persist command-receipt children");

    await inspectionSql`DELETE FROM ppw_schema_migrations WHERE version = 5`;
    await repository.migrate();

    let targetMissing = false;
    try {
      await repository.load(target.state.world.id);
    } catch (error) {
      targetMissing = (error instanceof Error ? error.message : String(error)).includes("was not found");
    }
    ok(targetMissing, "Alpha reset migration did not remove the target World");

    const preserved = await repository.load(unrelated.state.world.id);
    ok(preserved.state.world.id === unrelated.state.world.id, "Alpha reset migration removed an unrelated World");

    const afterChildren = await inspectionSql`
      SELECT
        (SELECT count(*)::int FROM ppw_world_memberships WHERE world_id = ${target.state.world.id}) AS memberships,
        (SELECT count(*)::int FROM ppw_promotion_controls WHERE world_id = ${target.state.world.id}) AS controls,
        (SELECT count(*)::int FROM ppw_command_receipts WHERE world_id = ${target.state.world.id}) AS receipts
    ` as unknown as Array<{ memberships: number; controls: number; receipts: number }>;
    ok(Number(afterChildren[0]?.memberships) === 0, "Alpha reset left membership rows behind");
    ok(Number(afterChildren[0]?.controls) === 0, "Alpha reset left promotion-control rows behind");
    ok(Number(afterChildren[0]?.receipts) === 0, "Alpha reset left command-receipt rows behind");

    const migrationRows = await inspectionSql`
      SELECT count(*)::int AS count FROM ppw_schema_migrations WHERE version = 5
    ` as unknown as Array<{ count: number }>;
    ok(Number(migrationRows[0]?.count) === 1, "Alpha reset migration was not recorded exactly once after replay");
  });

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
    ok(loaded.planning.workspaces.length === 0, "rollback unexpectedly created planning state");
    ok(loaded.state.promotions.find((candidate) => candidate.id === promotion.id)?.controllerType === "AI", "rollback left simulation mutation");
  });

  await test("PostgreSQL persists show commitment lock across reload", async () => {
    const aggregate = fixture(14005);
    await repository.initialize(aggregate);
    const worldId = aggregate.state.world.id;

    await lockPersistedCurrentWeekShowCommitments(repository, worldId, 0, "2026-10-07");
    const loaded = await repository.load(worldId);

    ok(loaded.runtime.phase === "OPEN", "persisted commitment lock incorrectly closed the World");
    ok(loaded.runtime.commitmentLockedPpwDate?.year === aggregate.state.world.currentDate.year, "commitment lock year was not persisted");
    ok(loaded.runtime.commitmentLockedPpwDate?.week === aggregate.state.world.currentDate.week, "commitment lock week was not persisted");
    ok(loaded.runtime.commitmentLockedRealCycleKey === "2026-10-07", "commitment lock real-cycle key was not persisted");
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

  await test("PostgreSQL persists editable planning state independently of simulation state", async () => {
    const aggregate = fixture(14004);
    joinPlayerToWorld(aggregate.ownership, "player-c", aggregate.state.world.currentDate);
    const promotion = aggregate.state.promotions.find((candidate) => candidate.tier === "INDEPENDENT" && candidate.lifecycle === "ACTIVE")!;
    claimIndependentPromotionCommand(aggregate.state, aggregate.ownership, aggregate.commands, aggregate.runtime, {
      requestId: "planning-claim",
      worldId: aggregate.state.world.id,
      playerId: "player-c",
      commandType: "CLAIM_INDEPENDENT_PROMOTION",
      payload: { promotionId: promotion.id },
    });
    await repository.initialize(aggregate);
    const eventsBefore = aggregate.state.events.length;

    await repository.transact(aggregate.state.world.id, 1, (working) => {
      upsertDetailedShowDraftCommand(working.state, working.ownership, working.planning, working.commands, working.runtime, {
        requestId: "postgres-plan",
        worldId: working.state.world.id,
        playerId: "player-c",
        commandType: "UPSERT_DETAILED_SHOW_DRAFT",
        payload: {
          promotionId: promotion.id,
          expectedPlanVersion: 0,
          draft: {
            draftId: "future-show",
            promotionId: promotion.id,
            targetDate: { ...working.state.world.currentDate },
            marketId: null,
            venueId: null,
            ticketStrategy: null,
            participantIds: [],
            matches: [],
            championshipAssignments: [],
          },
        },
      });
    });

    const loaded = await repository.load(aggregate.state.world.id);
    ok(loaded.runtime.revision === 2, "planning edit revision was not persisted");
    ok(loaded.planning.workspaces[0]?.version === 1, "PostgreSQL lost planning workspace version");
    ok(loaded.planning.workspaces[0]?.detailedShowDrafts[0]?.draftId === "future-show", "PostgreSQL lost planning draft");
    ok(loaded.state.events.length === eventsBefore, "planning persistence created a real simulation event");
  });
} finally {
  await inspectionSql.end({ timeout: 5 });
  await close();
}

console.log(`\nPostgreSQL repository tests: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exitCode = 1;
