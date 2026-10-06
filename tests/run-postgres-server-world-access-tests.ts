declare const process: { env: Record<string, string | undefined>; exitCode?: number };

import { createAlphaWorldAggregate } from "../packages/web-adapter/src/alpha-service.js";
import { createPostgresServerWorldAccess } from "../packages/persistence/src/postgres-server-world-access.js";

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
    ok(after.commands.receipts.length === before.commands.receipts.length, "activity write changed command receipts");
  } finally {
    await access.close();
  }
});

console.log(`\nPostgreSQL server-world access tests: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exitCode = 1;
