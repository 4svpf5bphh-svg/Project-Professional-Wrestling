declare const process: { exitCode?: number };

import { createAlphaWorldAggregate } from "../packages/web-adapter/src/alpha-service.js";
import { loadAlphaResultsOverview } from "../packages/web-adapter/src/results-overview-service.js";
import { loadAlphaWorldResults } from "../packages/web-adapter/src/world-results-service.js";
import { InMemoryApplicationWorldRepository } from "../packages/persistence/src/index.js";
import type { ApplicationWorldRepository } from "../packages/application/src/index.js";

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

await test("World-results service loads the public shared-results projection through the repository boundary", async () => {
  const repository = new InMemoryApplicationWorldRepository();
  const aggregate = createAlphaWorldAggregate({ seed: 73411, playerId: "player-a" });
  await repository.initialize(aggregate);
  const view = await loadAlphaWorldResults(repository, aggregate.state.world.id, "player-a", 12);
  ok(Array.isArray(view.shows), "service did not return a show collection");
  ok(view.world.worldId === aggregate.state.world.id, "service returned wrong World");
  ok(view.player.playerId === "player-a", "service returned wrong player context");
});

await test("Results overview builds promotion and World projections from one repository load", async () => {
  const backing = new InMemoryApplicationWorldRepository();
  const aggregate = createAlphaWorldAggregate({ seed: 73412, playerId: "player-a" });
  await backing.initialize(aggregate);
  let loadCount = 0;
  const repository: ApplicationWorldRepository = {
    initialize: (next) => backing.initialize(next),
    load: async (worldId) => {
      loadCount += 1;
      return backing.load(worldId);
    },
    transact: (worldId, expectedRevision, action) => backing.transact(worldId, expectedRevision, action),
  };

  const view = await loadAlphaResultsOverview(repository, aggregate.state.world.id, "player-a", 12);
  ok(loadCount === 1, `Results overview performed ${loadCount} World reads instead of one`);
  ok(view.promotion.world.worldId === aggregate.state.world.id, "promotion results returned wrong World");
  ok(view.world.world.worldId === aggregate.state.world.id, "World results returned wrong World");
  ok(view.world.player.playerId === "player-a", "World results returned wrong player context");
});

console.log(`\nWeb world-results-service tests: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exitCode = 1;
