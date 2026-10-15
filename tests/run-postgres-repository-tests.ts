declare const process: { env: Record<string, string | undefined>; exitCode?: number };

import postgres from "postgres";
import {
  claimIndependentPromotionCommand,
  createWorldCommandState,
  createWorldOwnershipState,
  createWorldPlanningState,
  createWorldRuntimeState,
  joinPlayerToWorld,
  transactWithReceiptIds,
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



  await test("selective receipt lookups return only requested historical rows", async () => {
    const aggregate = fixture(14012);
    await repository.initialize(aggregate);
    const worldId = aggregate.state.world.id;
    const old = (id: string) => ({
      worldId, requestId: id, playerId: "selective-player",
      commandType: "CLAIM_INDEPENDENT_PROMOTION" as const,
      canonicalPayload: "{}", resultJson: "{}", committedDate: { ...aggregate.state.world.currentDate },
      committedRevision: aggregate.runtime.revision,
    });
    await repository.transact(worldId, null, working => {
      working.commands.receipts.push(old("first-very-old"), old("second-very-old"), old("third-very-old"));
    });
    const selected = await repository.transact(worldId, null, working => (
      working.commands.receipts.map(receipt => receipt.requestId)
    ), ["second-very-old"]);
    ok(selected.result.length === 1 && selected.result[0] === "second-very-old",
      "specific request lookup loaded the wrong historical receipts");
    const untouched = await repository.load(worldId);
    ok(untouched.commands.receipts.length === 3,
      "selective transaction truncated persisted command history");
  });

  await test("receipt-free transactions skip historical history without removing persisted receipts", async () => {
    const aggregate = fixture(14010);
    joinPlayerToWorld(aggregate.ownership, "receipt-free-player", aggregate.state.world.currentDate);
    await repository.initialize(aggregate);
    const worldId = aggregate.state.world.id;
    const promotion = aggregate.state.promotions.find(p =>
      p.tier === "INDEPENDENT" && p.lifecycle === "ACTIVE")!;
    const claim = {
      requestId: "historic-claim", worldId, playerId: "receipt-free-player",
      commandType: "CLAIM_INDEPENDENT_PROMOTION" as const,
      payload: { promotionId: promotion.id },
    };
    await repository.transact(worldId, null, working => {
      claimIndependentPromotionCommand(
        working.state, working.ownership, working.commands, working.runtime, claim,
      );
    });
    const before = await repository.load(worldId);
    ok(before.commands.receipts.length === 1, "fixture failed to persist historic command");
    const afterTransaction = await repository.transact(worldId, null, working => {
      ok(working.commands.receipts.length === 0, "receipt-free transaction downloaded historical rows");
      working.state.promotions[0]!.cash += 25;
      working.runtime.revision += 1;
      return working.runtime.revision;
    }, []);
    ok(afterTransaction.result === before.runtime.revision + 1,
      "receipt-free World transaction lost simulation revision");
    const after = await repository.load(worldId);
    ok(after.commands.receipts.length === 1
      && after.commands.receipts[0]!.requestId === claim.requestId,
      "receipt-free transaction deleted a historical command receipt");
    ok(after.state.promotions[0]!.cash === before.state.promotions[0]!.cash + 25,
      "receipt-free transaction lost a World state change");
    const retry = await transactWithReceiptIds(repository, worldId, null, ["  historic-claim  "], working =>
      claimIndependentPromotionCommand(
        working.state, working.ownership, working.commands, working.runtime,
        { ...claim, requestId: "  historic-claim  " },
      ));
    ok(retry.revision === after.runtime.revision,
      "selective historical idempotent retry changed World revision");
  });

  await test("accidentally skipping an existing receipt rejects duplicate writes atomically", async () => {
    const aggregate = fixture(14011);
    await repository.initialize(aggregate);
    const worldId = aggregate.state.world.id;
    const receipt = {
      worldId, requestId: "double-submit", playerId: "player",
      commandType: "CLAIM_INDEPENDENT_PROMOTION" as const,
      canonicalPayload: "{}", resultJson: "{}", committedDate: { ...aggregate.state.world.currentDate },
      committedRevision: aggregate.runtime.revision,
    };
    await repository.transact(worldId, null, working => { working.commands.receipts.push(receipt); });
    let conflict = false;
    try {
      await repository.transact(worldId, null, working => {
        ok(working.commands.receipts.length === 0, "fixture did not omit receipts");
        working.commands.receipts.push(receipt);
        working.state.promotions[0]!.cash += 1000;
      }, []);
    } catch (error) {
      conflict = /unique|duplicate key|ppw_command_receipts/i.test(String(error));
    }
    ok(conflict, "duplicate receipt was silently ignored despite missing history lookup");
    const after = await repository.load(worldId);
    ok(after.commands.receipts.length === 1
      && after.state.promotions[0]!.cash === aggregate.state.promotions[0]!.cash,
      "conflicting World transaction partially committed");
  });

  await test("compressed transport is smaller, lossless, and transactionally maintained", async () => {
    const sample = fixture(62030);
    await repository.initialize(sample);
    const worldId = sample.state.world.id;
    const rows = await inspectionSql`
      SELECT octet_length(world_state::text) AS raw_bytes,
             octet_length(world_state_gzip) AS gzip_bytes
      FROM ppw_worlds WHERE world_id = ${worldId}
    ` as unknown as Array<{ raw_bytes: number; gzip_bytes: number | null }>;
    ok(Number(rows[0]?.gzip_bytes) > 0
      && Number(rows[0]?.gzip_bytes) <= Number(rows[0]?.raw_bytes) * 0.35,
      "gzip transfer has regressed beyond 35% of the JSONB snapshot");
    const restored = await repository.load(worldId);
    ok(restored.state.people.length === sample.state.people.length,
      "compressed World did not restore its real roster");

    await repository.transact(worldId, null, state => {
      state.state.promotions[0]!.cash += 1234;
      state.runtime.revision += 1;
    });
    const after = await repository.load(worldId);
    ok(after.state.promotions[0]!.cash === sample.state.promotions[0]!.cash + 1234,
      "compressed copy was not updated in the authoritative transaction");

    // Existing legacy Worlds may not yet have gzip. Retain the old JSONB
    // fallback and upgrade on the next authoritative transaction.
    await inspectionSql`UPDATE ppw_worlds SET world_state_gzip = NULL WHERE world_id = ${worldId}`;
    const fallback = await repository.load(worldId);
    ok(fallback.state.promotions[0]!.cash === after.state.promotions[0]!.cash,
      "uncompressed legacy World was not readable");
    await repository.transact(worldId, null, state => {
      state.state.promotions[0]!.cash += 42;
      state.runtime.revision += 1;
    });
    const repaired = await inspectionSql`
      SELECT octet_length(world_state_gzip) AS gzip_bytes
      FROM ppw_worlds WHERE world_id = ${worldId}
    ` as unknown as Array<{ gzip_bytes: number | null }>;
    ok(Number(repaired[0]?.gzip_bytes) > 0,
      "authoritative write did not restore compressed transport for legacy World");
    const finalWorld = await repository.load(worldId);
    ok(finalWorld.state.promotions[0]!.cash === after.state.promotions[0]!.cash + 42,
      "legacy compressed transition lost World updates");
  });


  await test("raw SQL World edits invalidate stale gzip and cross-server caches", async () => {
    const sample = fixture(62032);
    await repository.initialize(sample);
    const worldId = sample.state.world.id;
    const changed = sample.state.promotions[0]!.cash + 777;
    const before = await inspectionSql`
      SELECT updated_at::text AS snapshot_version FROM ppw_worlds
      WHERE world_id = ${worldId}
    ` as unknown as Array<{ snapshot_version: string }>;
    await inspectionSql`
      UPDATE ppw_worlds SET world_state =
        jsonb_set(world_state, '{promotions,0,cash}', to_jsonb(${changed}::numeric))
      WHERE world_id = ${worldId}
    `;
    const row = await inspectionSql`
      SELECT world_state_gzip IS NULL AS invalidated,
        updated_at::text AS snapshot_version FROM ppw_worlds
      WHERE world_id = ${worldId}
    ` as unknown as Array<{ invalidated: boolean; snapshot_version: string }>;
    ok(row[0]?.invalidated, "JSONB-only change left obsolete gzip active");
    ok(row[0]?.snapshot_version !== before[0]?.snapshot_version,
      "JSONB-only change did not invalidate version probes");
    ok((await repository.load(worldId)).state.promotions[0]!.cash === changed,
      "old compressed state hid newer authoritative JSONB");
    await repository.transact(worldId, null, world => { world.runtime.revision += 1; });
    const copy = await inspectionSql`
      SELECT octet_length(world_state_gzip) AS bytes FROM ppw_worlds
      WHERE world_id = ${worldId}
    ` as unknown as Array<{ bytes: number | null }>;
    ok(Number(copy[0]?.bytes) > 0, "normal transaction did not rebuild gzip copy");
    ok((await repository.load(worldId)).state.promotions[0]!.cash === changed,
      "transport rebuilding reverted external authoritative edit");
  });

  await test("planning-only writes avoid retransmitting unchanged World snapshots and ownership", async () => {
    const sample = fixture(62033);
    await repository.initialize(sample);
    const worldId = sample.state.world.id;
    const before = await inspectionSql`
      SELECT world_state, world_state_gzip, planning_state,
             updated_at::text AS version
      FROM ppw_worlds WHERE world_id = ${worldId}
    ` as unknown as Array<{ world_state: unknown; world_state_gzip: Uint8Array; planning_state: unknown; version: string }>;
    const beforeGzip = Buffer.from(before[0]!.world_state_gzip);
    await repository.transact(worldId, null, working => {
      working.runtime.revision += 1;
      working.planning.workspaces.push({
        worldId, promotionId: "test-promotion", version: 0,
        detailedShowDrafts: [],
      } as never);
    }, []);
    const after = await inspectionSql`
      SELECT world_state, world_state_gzip, planning_state,
             updated_at::text AS version
      FROM ppw_worlds WHERE world_id = ${worldId}
    ` as unknown as Array<{ world_state: unknown; world_state_gzip: Uint8Array; planning_state: unknown; version: string }>;
    ok(JSON.stringify(after[0]!.world_state) === JSON.stringify(before[0]!.world_state),
      "planning-only command changed authoritative World JSON");
    ok(Buffer.from(after[0]!.world_state_gzip).equals(beforeGzip),
      "planning-only command replaced compressed World snapshot");
    ok(after[0]!.version !== before[0]!.version,
      "planning-only command failed to invalidate cached planning views");
    ok((await repository.load(worldId)).runtime.revision === 1,
      "planning-only command did not advance runtime revision");
  });

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

  await test("real-world cutover reset removes only the Alpha World and cascades its child rows", async () => {
    await inspectionSql`DELETE FROM ppw_worlds WHERE world_id = 'world-20261002'`;

    const target = fixture(20261002);
    target.state.world.name = "PPW Alpha World";
    joinPlayerToWorld(target.ownership, "alpha-player-1", target.state.world.currentDate);
    const targetPromotion = target.state.promotions.find(
      (candidate) => candidate.tier === "INDEPENDENT" && candidate.lifecycle === "ACTIVE",
    )!;
    claimIndependentPromotionCommand(target.state, target.ownership, target.commands, target.runtime, {
      requestId: "real-world-cutover-target-claim",
      worldId: target.state.world.id,
      playerId: "alpha-player-1",
      commandType: "CLAIM_INDEPENDENT_PROMOTION",
      payload: { promotionId: targetPromotion.id },
    });
    await repository.initialize(target);

    const unrelated = fixture(14006);
    unrelated.state.world.name = "Unrelated Test World";
    joinPlayerToWorld(unrelated.ownership, "alpha-player-1", unrelated.state.world.currentDate);
    await repository.initialize(unrelated);

    await inspectionSql`DELETE FROM ppw_schema_migrations WHERE version = 7`;
    await repository.migrate();

    let targetMissing = false;
    try {
      await repository.load(target.state.world.id);
    } catch (error) {
      targetMissing = (error instanceof Error ? error.message : String(error)).includes("was not found");
    }
    ok(targetMissing, "real-world cutover reset did not remove the deterministic Alpha World");

    const preserved = await repository.load(unrelated.state.world.id);
    ok(preserved.state.world.name === "Unrelated Test World", "real-world cutover reset removed an unrelated World sharing the Alpha player id");

    const childRows = await inspectionSql`
      SELECT
        (SELECT count(*)::int FROM ppw_world_memberships WHERE world_id = ${target.state.world.id}) AS memberships,
        (SELECT count(*)::int FROM ppw_promotion_controls WHERE world_id = ${target.state.world.id}) AS controls,
        (SELECT count(*)::int FROM ppw_command_receipts WHERE world_id = ${target.state.world.id}) AS receipts
    ` as unknown as Array<{ memberships: number; controls: number; receipts: number }>;
    ok(Number(childRows[0]?.memberships) === 0, "cutover reset left Alpha membership rows behind");
    ok(Number(childRows[0]?.controls) === 0, "cutover reset left Alpha promotion-control rows behind");
    ok(Number(childRows[0]?.receipts) === 0, "cutover reset left Alpha command-receipt rows behind");

    const migrationRows = await inspectionSql`
      SELECT count(*)::int AS count FROM ppw_schema_migrations WHERE version = 7
    ` as unknown as Array<{ count: number }>;
    ok(Number(migrationRows[0]?.count) === 1, "cutover reset migration was not recorded exactly once after replay");
  });

  await test("Reality Check reset removes only the Alpha World and records migration 8 once", async () => {
    await inspectionSql`DELETE FROM ppw_worlds WHERE world_id = 'world-20261002'`;

    const target = fixture(20261002);
    target.state.world.name = "PPW Alpha World";
    joinPlayerToWorld(target.ownership, "alpha-player-1", target.state.world.currentDate);
    const targetPromotion = target.state.promotions.find(
      (candidate) => candidate.tier === "INDEPENDENT" && candidate.lifecycle === "ACTIVE",
    )!;
    claimIndependentPromotionCommand(target.state, target.ownership, target.commands, target.runtime, {
      requestId: "reality-check-reset-target-claim",
      worldId: target.state.world.id,
      playerId: "alpha-player-1",
      commandType: "CLAIM_INDEPENDENT_PROMOTION",
      payload: { promotionId: targetPromotion.id },
    });
    await repository.initialize(target);

    const unrelated = fixture(14008);
    unrelated.state.world.name = "Unrelated Reality Check Test World";
    joinPlayerToWorld(unrelated.ownership, "alpha-player-1", unrelated.state.world.currentDate);
    await repository.initialize(unrelated);

    await inspectionSql`DELETE FROM ppw_schema_migrations WHERE version = 8`;
    await repository.migrate();

    let targetMissing = false;
    try {
      await repository.load(target.state.world.id);
    } catch (error) {
      targetMissing = (error instanceof Error ? error.message : String(error)).includes("was not found");
    }
    ok(targetMissing, "Reality Check reset did not remove the deterministic Alpha World");

    const preserved = await repository.load(unrelated.state.world.id);
    ok(
      preserved.state.world.name === "Unrelated Reality Check Test World",
      "Reality Check reset removed an unrelated World sharing the Alpha player id",
    );

    const childRows = await inspectionSql`
      SELECT
        (SELECT count(*)::int FROM ppw_world_memberships WHERE world_id = ${target.state.world.id}) AS memberships,
        (SELECT count(*)::int FROM ppw_promotion_controls WHERE world_id = ${target.state.world.id}) AS controls,
        (SELECT count(*)::int FROM ppw_command_receipts WHERE world_id = ${target.state.world.id}) AS receipts
    ` as unknown as Array<{ memberships: number; controls: number; receipts: number }>;
    ok(Number(childRows[0]?.memberships) === 0, "Reality Check reset left Alpha membership rows behind");
    ok(Number(childRows[0]?.controls) === 0, "Reality Check reset left Alpha promotion-control rows behind");
    ok(Number(childRows[0]?.receipts) === 0, "Reality Check reset left Alpha command-receipt rows behind");

    const migrationRows = await inspectionSql`
      SELECT count(*)::int AS count FROM ppw_schema_migrations WHERE version = 8
    ` as unknown as Array<{ count: number }>;
    ok(Number(migrationRows[0]?.count) === 1, "Reality Check reset migration was not recorded exactly once after replay");
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

    const beforeReceipt = await inspectionSql`
      SELECT xmin::text AS tuple_revision
      FROM ppw_command_receipts
      WHERE world_id = ${aggregate.state.world.id} AND request_id = ${envelope.requestId}
    ` as unknown as Array<{ tuple_revision: string }>;
    const retry = await repository.transact(aggregate.state.world.id, 1, (working) => (
      claimIndependentPromotionCommand(working.state, working.ownership, working.commands, working.runtime, envelope)
    ));
    const afterReceipt = await inspectionSql`
      SELECT xmin::text AS tuple_revision
      FROM ppw_command_receipts
      WHERE world_id = ${aggregate.state.world.id} AND request_id = ${envelope.requestId}
    ` as unknown as Array<{ tuple_revision: string }>;
    ok(beforeReceipt[0]?.tuple_revision === afterReceipt[0]?.tuple_revision,
      "idempotent retry rewrote an unchanged historical receipt");
    ok(retry.revision === 1, "idempotent retry revised persisted World");
    const afterRetry = await repository.load(aggregate.state.world.id);
    ok(afterRetry.commands.receipts.length === 1, "idempotent retry duplicated persisted receipt");
    ok(afterRetry.ownership.promotionControls.length === 1, "idempotent retry duplicated persisted control");
  });


  await test("transaction refuses to rewrite historical command receipts", async () => {
    const aggregate = fixture(14009);
    joinPlayerToWorld(aggregate.ownership, "player-protected", aggregate.state.world.currentDate);
    await repository.initialize(aggregate);
    const worldId = aggregate.state.world.id;
    const promotion = aggregate.state.promotions.find(x =>
      x.tier === "INDEPENDENT" && x.lifecycle === "ACTIVE")!;
    await repository.transact(worldId, null, working => {
      claimIndependentPromotionCommand(
        working.state, working.ownership, working.commands, working.runtime,
        { requestId: "protected-original", worldId, playerId: "player-protected",
          commandType: "CLAIM_INDEPENDENT_PROMOTION", payload: { promotionId: promotion.id } },
      );
    });
    let rejected = false;
    try {
      await repository.transact(worldId, null, working => {
        working.commands.receipts[0]!.canonicalPayload = '{"tampered":true}';
      });
    } catch (error) {
      rejected = error instanceof Error && error.message.includes("immutable command receipt");
    }
    ok(rejected, "transaction accepted a rewrite of an idempotency receipt");
    const intact = await repository.load(worldId);
    ok(intact.commands.receipts[0]?.canonicalPayload !== '{"tampered":true}',
      "an old receipt changed despite its transaction being rejected");
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
