declare const process: { exitCode?: number };

import {
  createAlphaWorldAggregate,
  claimAlphaPromotion,
} from "../packages/web-adapter/src/alpha-service.js";
import { loadAlphaWrestlerProfile } from "../packages/web-adapter/src/wrestler-profile-service.js";
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

await test("Wrestler profile service loads a player-safe profile from the persistent repository boundary", async () => {
  const repository = new InMemoryApplicationWorldRepository();
  const aggregate = createAlphaWorldAggregate({ seed: 73111, playerId: "player-a" });
  await repository.initialize(aggregate);
  const independent = aggregate.state.promotions.find((promotion) => promotion.tier === "INDEPENDENT" && promotion.lifecycle === "ACTIVE");
  if (!independent) throw new Error("fixture has no Independent promotion");
  await claimAlphaPromotion(repository, aggregate.state.world.id, "player-a", {
    promotionId: independent.id,
    requestId: "profile-service-claim",
  });
  const loaded = await repository.load(aggregate.state.world.id);
  const ownContract = loaded.state.contracts.find((contract) => contract.promotionId === independent.id && contract.status === "SIGNED");
  if (!ownContract) throw new Error("claimed promotion has no signed wrestler");

  const view = await loadAlphaWrestlerProfile(repository, aggregate.state.world.id, "player-a", ownContract.personId);
  ok(view.person.personId === ownContract.personId, "service returned the wrong wrestler");
  ok(view.relationship?.employmentStatus === "OUR_ROSTER", "service did not preserve player relationship context");
  ok(view.player.promotionId === independent.id, "service returned the wrong controlling promotion");
});

await test("Wrestler profile service rejects invalid person IDs before projection", async () => {
  const repository = new InMemoryApplicationWorldRepository();
  const aggregate = createAlphaWorldAggregate({ seed: 73112, playerId: "player-a" });
  await repository.initialize(aggregate);
  let rejected = false;
  try {
    await loadAlphaWrestlerProfile(repository, aggregate.state.world.id, "player-a", "   ");
  } catch (error) {
    rejected = error instanceof Error && error.message.includes("must not be empty");
  }
  ok(rejected, "blank personId was accepted by profile service");
});

console.log(`\nWeb wrestler-profile service tests: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exitCode = 1;
