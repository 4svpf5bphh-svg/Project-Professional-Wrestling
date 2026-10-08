declare const process: { exitCode?: number };

import { createAlphaWorldAggregate } from "../packages/web-adapter/src/alpha-service.js";
import { loadAlphaChampionshipHistory } from "../packages/web-adapter/src/championship-history-service.js";
import { InMemoryApplicationWorldRepository } from "../packages/persistence/src/index.js";

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

await test("championship-history service loads the public lineage projection through the repository boundary", async () => {
  const repository = new InMemoryApplicationWorldRepository();
  const aggregate = createAlphaWorldAggregate({ seed: 73311, playerId: "player-a" });
  await repository.initialize(aggregate);
  const view = await loadAlphaChampionshipHistory(repository, aggregate.state.world.id, "player-a");
  ok(view.world.worldId === aggregate.state.world.id, "service returned wrong World");
  ok(view.player.playerId === "player-a", "service returned wrong player context");
  ok(Array.isArray(view.championships), "service did not return championship history");
});

console.log(`\nWeb championship-history-service tests: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exitCode = 1;
