declare const process: { exitCode?: number };

import { createAlphaWorldAggregate } from "../packages/web-adapter/src/alpha-service.js";
import { loadAlphaIndustry } from "../packages/web-adapter/src/industry-service.js";
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

await test("Industry service loads the public competitive projection through the repository boundary", async () => {
  const repository = new InMemoryApplicationWorldRepository();
  const aggregate = createAlphaWorldAggregate({ seed: 73211, playerId: "player-a" });
  await repository.initialize(aggregate);
  const view = await loadAlphaIndustry(repository, aggregate.state.world.id, "player-a");
  ok(view.promotions.length === aggregate.state.promotions.length, "service omitted promotions");
  ok(view.world.worldId === aggregate.state.world.id, "service returned wrong World");
});

console.log(`\nWeb industry-service tests: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exitCode = 1;
