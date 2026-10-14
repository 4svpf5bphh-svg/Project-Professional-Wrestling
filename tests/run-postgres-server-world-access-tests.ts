declare const process: { env: Record<string, string | undefined>; exitCode?: number };

import { lockPersistedCurrentWeekShowCommitments } from "../packages/application/src/index.js";
import { createAlphaWorldAggregate, claimAlphaPromotion } from "../packages/web-adapter/src/alpha-service.js";
import { createPostgresServerWorldAccess } from "../packages/persistence/src/postgres-server-world-access.js";
import postgres from "postgres";

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

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is required for PostgreSQL server-world access tests");

await test("lightweight player activity persistence updates engagement without advancing the World", async () => {
  const access = createPostgresServerWorldAccess(connectionString);
  try {
    await access.repository.migrate();
    const aggregate = createAlphaWorldAggregate({ seed: 62021, playerId: "perf-player" });
    await access.repository.initialize(aggregate);
    const worldId = aggregate.state.world.id;
    const before = await access.repository.load(worldId);

    await access.recordPlayerActivity(worldId, "perf-player", "2026-10-06");

    const after = await access.repository.load(worldId);
    const activity = after.engagement?.playerActivity.find((record) => record.playerId === "perf-player");
    ok(activity, "lightweight activity write did not create the player activity record");
    ok(activity?.lastActiveCycleKey === "2026-10-06", "activity cycle key was not persisted");
    ok(activity?.status === "ACTIVE", "activity write did not leave the player active");
    ok(
      activity?.lastActivePpwDate.year === before.state.world.currentDate.year
      && activity.lastActivePpwDate.week === before.state.world.currentDate.week
      && activity.lastActivePpwDate.day === before.state.world.currentDate.day,
      "activity write did not use the current persisted PPW date",
    );
    ok(after.runtime.revision === before.runtime.revision, "activity write advanced the World revision");
    ok(after.state.world.currentDate.week === before.state.world.currentDate.week, "activity write advanced PPW time");
    ok(after.commands.receipts.length === 0, "server read path unexpectedly loaded command receipts");
  } finally {
    await access.close();
  }
});

await test("server-world read path preserves persisted show commitment lock", async () => {
  const access = createPostgresServerWorldAccess(connectionString);
  try {
    await access.repository.migrate();
    const aggregate = createAlphaWorldAggregate({ seed: 62023, playerId: "commitment-player" });
    await access.repository.initialize(aggregate);
    const worldId = aggregate.state.world.id;

    await lockPersistedCurrentWeekShowCommitments(
      access.repository,
      worldId,
      aggregate.runtime.revision,
      "2026-10-07",
    );

    const loaded = await access.repository.load(worldId);
    ok(loaded.runtime.phase === "OPEN", "server read treated commitment lock as World lock");
    ok(loaded.runtime.commitmentLockedPpwDate?.week === aggregate.state.world.currentDate.week, "server read lost commitment PPW week");
    ok(loaded.runtime.commitmentLockedRealCycleKey === "2026-10-07", "server read lost commitment real-cycle key");
  } finally {
    await access.close();
  }
});

await test("server reads omit command history while transactions retain idempotency receipts", async () => {
  const access = createPostgresServerWorldAccess(connectionString);
  try {
    await access.repository.migrate();
    const aggregate = createAlphaWorldAggregate({ seed: 62022, playerId: "receipt-player" });
    await access.repository.initialize(aggregate);
    const worldId = aggregate.state.world.id;

    await access.repository.transact(worldId, null, (working) => {
      working.commands.receipts.push({
        worldId,
        requestId: "receipt-performance-check",
        playerId: "receipt-player",
        commandType: "CLAIM_INDEPENDENT_PROMOTION",
        canonicalPayload: "{}",
        resultJson: "{}",
        committedDate: { ...working.state.world.currentDate },
        committedRevision: working.runtime.revision,
      });
    });

    const readOnly = await access.repository.load(worldId);
    ok(readOnly.commands.receipts.length === 0, "ordinary server read loaded historical command receipts");

    let receiptsVisibleInsideTransaction = 0;
    await access.repository.transact(worldId, null, (working) => {
      receiptsVisibleInsideTransaction = working.commands.receipts.length;
    });
    ok(
      receiptsVisibleInsideTransaction === 1,
      "transaction path did not retain command receipts required for idempotency",
    );
  } finally {
    await access.close();
  }
});


await test("unchanged World repeat loads use version probes, not repeated megabyte snapshots", async () => {
  const access = createPostgresServerWorldAccess(connectionString);
  try {
    await access.repository.migrate();
    const aggregate = createAlphaWorldAggregate({ seed: 62024, playerId: "read-cache-player" });
    await access.repository.initialize(aggregate);
    const worldId = aggregate.state.world.id;
    const first = await access.repository.load(worldId);
    const second = await access.repository.load(worldId);
    ok(first.state.people.length === second.state.people.length, "cache changed World population");
    const counts = access.readStatistics();
    ok(counts.fullSnapshotReads === 1 && counts.cacheHits === 1 && counts.versionProbes === 2,
      `unchanged World re-transferred snapshot: ${JSON.stringify(counts)}`);

    // No caller can mutate the cached snapshot through an exposed reference.
    second.state.promotions[0]!.cash = -999_999;
    const third = await access.repository.load(worldId);
    ok(third.state.promotions[0]!.cash !== -999_999,
      "caller mutated the cached World via a returned view object");
    ok(access.readStatistics().fullSnapshotReads === 1,
      "isolated cached read fetched another full World snapshot");
  } finally {
    await access.close();
  }
});

await test("activity writes update cache without losing authoritative engagement or reloading World", async () => {
  const access = createPostgresServerWorldAccess(connectionString);
  try {
    await access.repository.migrate();
    const aggregate = createAlphaWorldAggregate({ seed: 62025, playerId: "cache-activity-player" });
    await access.repository.initialize(aggregate);
    const worldId = aggregate.state.world.id;
    await access.repository.load(worldId);
    await access.recordPlayerActivity(worldId, "cache-activity-player", "2026-10-14");
    const after = await access.repository.load(worldId);
    ok(after.engagement?.playerActivity.some(a =>
      a.playerId === "cache-activity-player" && a.lastActiveCycleKey === "2026-10-14"),
      "cached World lost activity update");
    ok(access.readStatistics().fullSnapshotReads === 1,
      "activity-only write forced multi-megabyte World reload");
    await access.recordPlayerActivity(worldId, "cache-activity-player", "2026-10-14");
    await access.repository.load(worldId);
    ok(access.readStatistics().fullSnapshotReads === 1,
      "unchanged activity generated a redundant World snapshot read");
  } finally {
    await access.close();
  }
});

await test("external World transactions invalidate warm cache across server instances", async () => {
  const current = createPostgresServerWorldAccess(connectionString);
  const rival = createPostgresServerWorldAccess(connectionString);
  try {
    await current.repository.migrate();
    const aggregate = createAlphaWorldAggregate({ seed: 62026, playerId: "shared-world-player" });
    await current.repository.initialize(aggregate);
    const worldId = aggregate.state.world.id;
    const starting = await current.repository.load(worldId);
    const previousCash = starting.state.promotions[0]!.cash;
    await rival.repository.transact(worldId, null, working => {
      working.state.promotions[0]!.cash += 4321;
      working.runtime.revision += 1;
    });
    const refreshed = await current.repository.load(worldId);
    ok(refreshed.state.promotions[0]!.cash === previousCash + 4321,
      "warm instance hid rival player's authoritative World change");
    ok(current.readStatistics().fullSnapshotReads === 2,
      "World revision change failed to invalidate cached snapshot");
    const warm = await current.repository.load(worldId);
    ok(warm.state.promotions[0]!.cash === previousCash + 4321
      && current.readStatistics().fullSnapshotReads === 2,
      "updated shared state was not cached after invalidation");
  } finally {
    await current.close();
    await rival.close();
  }
});

await test("player activity cannot stamp a stale World cache as authoritative", async () => {
  const current = createPostgresServerWorldAccess(connectionString);
  const rival = createPostgresServerWorldAccess(connectionString);
  try {
    await current.repository.migrate();
    const aggregate = createAlphaWorldAggregate({ seed: 62027, playerId: "race-activity-player" });
    await current.repository.initialize(aggregate);
    const worldId = aggregate.state.world.id;
    const before = await current.repository.load(worldId);
    const previousCash = before.state.promotions[0]!.cash;
    await rival.repository.transact(worldId, null, working => {
      working.state.promotions[0]!.cash += 222;
      working.runtime.revision += 1;
    });
    await current.recordPlayerActivity(worldId, "race-activity-player", "2026-10-15");
    const after = await current.repository.load(worldId);
    ok(after.state.promotions[0]!.cash === previousCash + 222,
      "activity incorrectly validated stale snapshot after another player wrote");
    ok(after.engagement?.playerActivity.some(a => a.lastActiveCycleKey === "2026-10-15"),
      "activity was dropped during stale cache invalidation");
    ok(current.readStatistics().fullSnapshotReads === 2,
      "stale snapshot was incorrectly reused after a rival write");
  } finally {
    await current.close();
    await rival.close();
  }
});


await test("verified bootstrap metadata prevents expensive repeat compatibility loading", async () => {
  const first = createPostgresServerWorldAccess(connectionString);
  const second = createPostgresServerWorldAccess(connectionString);
  try {
    await first.repository.migrate();
    const aggregate = createAlphaWorldAggregate({ seed: 62028, playerId: "bootstrap-metadata-player" });
    await first.repository.initialize(aggregate);
    const worldId = aggregate.state.world.id;
    ok(!(await first.bootstrapVerified(worldId, 1)),
      "unverified World incorrectly skipped its required compatibility repairs");
    await first.markBootstrapVerified(worldId, 1);
    ok(await second.bootstrapVerified(worldId, 1),
      "new server instance cannot observe completed compatibility repairs");
    ok(!(await second.bootstrapVerified(worldId, 2)),
      "future repairs must not be skipped by an older verified marker");
    const persisted = await second.repository.load(worldId);
    ok(persisted.runtime.revision === aggregate.runtime.revision
      && persisted.state.people.length === aggregate.state.people.length,
      "bootstrap marker changed World state or revision");
    await second.markBootstrapVerified(worldId, 1);
    ok(await first.bootstrapVerified(worldId, 1),
      "repeated marking lost the durable verification marker");
  } finally {
    await first.close();
    await second.close();
  }
});


await test("Talent and Staff read-only projections match full authoritative views", async () => {
  const access = createPostgresServerWorldAccess(connectionString);
  // A fresh server instance must exercise the cold projection: promotion
  // claiming legitimately warmed the original instance's full read cache.
  const reader = createPostgresServerWorldAccess(connectionString);
  try {
    await access.repository.migrate();
    const aggregate = createAlphaWorldAggregate({ seed: 62029, playerId: "lean-talent-player" });
    const indie = aggregate.state.promotions.find(p =>
      p.playerTakeoverEligibility === "STANDARD" && p.lifecycle === "ACTIVE");
    if (!indie) throw new Error("projection test needs a promotion with a roster");
    await access.repository.initialize(aggregate);
    const worldId = aggregate.state.world.id;
    await claimAlphaPromotion(access.repository, worldId, "lean-talent-player",
      { promotionId: indie.id, requestId: "lean-views-claim" });
    const lean = await reader.repository.loadTalentView(worldId);
    ok(lean.state.ledger.length > 0 && lean.state.financialTransactions.length === 0,
      "Talent view lost the ledger needed for wrestler creative and alignment");

    ok(reader.readStatistics().trimmedHistoryReads === 1,
      "cold Talent instance did not use the read-only projection");
    const again = await reader.repository.loadTalentView(worldId);
    ok(reader.readStatistics().trimmedHistoryReads === 1
      && reader.readStatistics().cacheHits === 1,
      "repeat Talent view transferred another snapshot");
    ok(again.state.people.length === lean.state.people.length, "cached Talent view changed wrestler population");

    const { buildPlayerTalentManagementView } = await import("../packages/application/src/talent-view.js");
    const { buildPlayerTalentDirectoryView } = await import("../packages/application/src/talent-view.js");
    const { buildPlayerStaffView } = await import("../packages/application/src/staff-view.js");
    const full = await access.repository.load(worldId);
    ok(lean.state.ledger.length === full.state.ledger.length,
      "lean Talent view dropped alignment and contract decision history");
    const same = (left: unknown, right: unknown, label: string) =>
      ok(JSON.stringify(left) === JSON.stringify(right), `lean ${label} differs from full World read`);
    const management = buildPlayerTalentManagementView(lean, "lean-talent-player");
    ok(management.roster.length > 0, "projection fixture lacks meaningful wrestler contract state");
    same(management, buildPlayerTalentManagementView(full, "lean-talent-player"), "Talent management");
    same(buildPlayerTalentDirectoryView(lean, "lean-talent-player"),
      buildPlayerTalentDirectoryView(full, "lean-talent-player"), "Wrestler directory");
    same(buildPlayerStaffView(lean, "lean-talent-player"),
      buildPlayerStaffView(full, "lean-talent-player"), "Staff");
  } finally {
    await access.close();
    await reader.close();
  }
});


await test("legacy JSONB snapshot backfills gzip once without mutating World revision", async () => {
  const sql = postgres(connectionString, { max: 1 });
  const first = createPostgresServerWorldAccess(connectionString);
  const second = createPostgresServerWorldAccess(connectionString);
  try {
    await first.repository.migrate();
    const aggregate = createAlphaWorldAggregate({ seed: 62031, playerId: "gzip-backfill-player" });
    await first.repository.initialize(aggregate);
    const worldId = aggregate.state.world.id;
    await sql`UPDATE ppw_worlds SET world_state_gzip = NULL WHERE world_id = ${worldId}`;
    const loaded = await first.repository.load(worldId);
    ok(loaded.runtime.revision === aggregate.runtime.revision
      && loaded.state.people.length === aggregate.state.people.length,
      "legacy fallback altered World during gzip backfill");
    const stats = first.readStatistics();
    ok(stats.rawFallbackReads === 1 && stats.backfilledSnapshots === 1,
      "legacy World was not backfilled after its first raw read");
    const inspected = await sql`
      SELECT octet_length(world_state::text) AS raw_bytes,
             octet_length(world_state_gzip) AS gzip_bytes,
             runtime_revision
      FROM ppw_worlds WHERE world_id = ${worldId}
    ` as unknown as Array<{ raw_bytes: number; gzip_bytes: number | null; runtime_revision: string }>;
    ok(Number(inspected[0]?.gzip_bytes) > 0
      && Number(inspected[0]?.gzip_bytes) < Number(inspected[0]?.raw_bytes),
      "backfill did not create a compact transport snapshot");
    ok(Number(inspected[0]?.runtime_revision) === aggregate.runtime.revision,
      "backfill advanced the multiplayer World revision");
    const onAnotherServer = await second.repository.load(worldId);
    ok(second.readStatistics().compressedSnapshotReads === 1,
      "new server transferred the full raw World after backfill");
    ok(onAnotherServer.state.people.length === aggregate.state.people.length,
      "compressed World lost wrestlers on a cold server instance");
  } finally {
    await first.close();
    await second.close();
    await sql.end({ timeout: 5 });
  }
});

console.log(`\nPostgreSQL server-world access tests: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exitCode = 1;
