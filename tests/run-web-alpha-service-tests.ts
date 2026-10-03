declare const process: { exitCode?: number };

import { InMemoryApplicationWorldRepository } from "../packages/persistence/src/index.js";
import {
  claimAlphaPromotion,
  createAlphaWorldAggregate,
  ensureAlphaWorld,
  loadAlphaPlayerSession,
} from "../apps/web/lib/alpha-service.js";

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

await test("Alpha web service bootstraps and exposes a player-safe promotion choice", async () => {
  const repository = new InMemoryApplicationWorldRepository();
  const worldId = await ensureAlphaWorld(repository, { seed: 61001, playerId: "alpha-player" });
  const view = await loadAlphaPlayerSession(repository, worldId, "alpha-player");
  ok(view.player.playerId === "alpha-player", "session exposed the wrong player");
  ok(view.player.promotionId === null, "fresh Alpha player unexpectedly controls a promotion");
  ok(view.availableIndependentPromotions.length > 0, "no eligible Independent promotion choices were exposed");
  ok(view.promotion === null, "fresh Alpha session unexpectedly exposed a controlled promotion dashboard");
});

await test("Alpha claim travels through the transactional command path and survives reload", async () => {
  const repository = new InMemoryApplicationWorldRepository();
  const aggregate = createAlphaWorldAggregate({ seed: 61002, playerId: "alpha-player" });
  await repository.initialize(aggregate);
  const worldId = aggregate.state.world.id;
  const before = await loadAlphaPlayerSession(repository, worldId, "alpha-player");
  const choice = before.availableIndependentPromotions[0]!;

  const after = await claimAlphaPromotion(repository, worldId, "alpha-player", {
    promotionId: choice.promotionId,
    requestId: "web-claim-001",
  });
  ok(after.player.promotionId === choice.promotionId, "claim did not attach the promotion to the player");
  ok(after.promotion?.promotionId === choice.promotionId, "dashboard did not expose the claimed promotion");
  ok(after.world.revision === 1, "claim did not advance the World revision exactly once");
  ok(after.availableIndependentPromotions.length === 0, "claimed player still received promotion choices");

  const persisted = await repository.load(worldId);
  ok(persisted.ownership.promotionControls.length === 1, "claim did not persist exactly one promotion control");
  ok(persisted.commands.receipts.length === 1, "claim did not persist exactly one command receipt");
  ok(
    persisted.state.ledger.filter((entry) => entry.type === "HUMAN_PROMOTION_CLAIMED").length === 1,
    "claim history was not written exactly once",
  );
});

await test("Alpha service retry reuses the original request without duplicate mutation", async () => {
  const repository = new InMemoryApplicationWorldRepository();
  const aggregate = createAlphaWorldAggregate({ seed: 61003, playerId: "alpha-player" });
  await repository.initialize(aggregate);
  const worldId = aggregate.state.world.id;
  const choice = (await loadAlphaPlayerSession(repository, worldId, "alpha-player")).availableIndependentPromotions[0]!;
  const request = { promotionId: choice.promotionId, requestId: "web-claim-retry" };

  const first = await claimAlphaPromotion(repository, worldId, "alpha-player", request);
  const second = await claimAlphaPromotion(repository, worldId, "alpha-player", request);
  ok(first.world.revision === 1 && second.world.revision === 1, "idempotent web retry advanced revision twice");

  const persisted = await repository.load(worldId);
  ok(persisted.ownership.promotionControls.length === 1, "retry duplicated promotion control");
  ok(persisted.commands.receipts.length === 1, "retry duplicated command receipt");
  ok(
    persisted.state.ledger.filter((entry) => entry.type === "HUMAN_PROMOTION_CLAIMED").length === 1,
    "retry duplicated claim history",
  );
});

console.log(`\nAlpha web service tests: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exitCode = 1;
