declare const process: { exitCode?: number };

import { InMemoryApplicationWorldRepository } from "../packages/persistence/src/index.js";
import { addPpwWeeks } from "../packages/sim-core/src/clock.js";
import {
  claimAlphaPromotion,
  createAlphaWorldAggregate,
  dismissAlphaAttention,
  loadAlphaPlayerSession,
} from "../packages/web-adapter/src/alpha-service.js";

let passed = 0;
let failed = 0;

function ok(value: unknown, message: string): void {
  if (!value) throw new Error(message);
}

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

await test("Alpha Attention dismissal persists, retries safely and cannot hide Action Required", async () => {
  const repository = new InMemoryApplicationWorldRepository();
  const aggregate = createAlphaWorldAggregate({ seed: 61010, playerId: "alpha-player" });
  await repository.initialize(aggregate);
  const worldId = aggregate.state.world.id;
  const choice = (await loadAlphaPlayerSession(repository, worldId, "alpha-player")).availableIndependentPromotions[0]!;
  await claimAlphaPromotion(repository, worldId, "alpha-player", {
    promotionId: choice.promotionId,
    requestId: "attention-dismiss-claim",
  });

  await repository.transact(worldId, null, (current) => {
    const continuing = current.state.contracts.filter((contract) => (
      contract.promotionId === choice.promotionId
      && contract.status === "SIGNED"
      && contract.family !== "ONE_OFF"
    ));
    if (continuing.length < 2) throw new Error("dismissal fixture needs two continuing contracts");
    continuing[0]!.endDate = addPpwWeeks(
      current.state.world.currentDate,
      2,
      current.state.ruleset.weeksPerYear,
    );
    continuing[1]!.endDate = { ...current.state.world.currentDate, day: 7 };
    // Create a real mandatory Roster shortage alongside dismissible contract
    // notices. An urgent contract notice is no longer non-dismissible news.
    for (const contract of current.state.contracts) {
      if (contract.promotionId === choice.promotionId
        && contract.status === "SIGNED"
        && contract.id !== continuing[0]!.id
        && contract.id !== continuing[1]!.id) contract.status = "TERMINATED";
    }
  });

  const before = await loadAlphaPlayerSession(repository, worldId, "alpha-player");
  const dismissible = before.attention.find((item) => (
    item.attentionId.startsWith("contract-expiry:") && item.dismissible && item.category !== "ACTION_REQUIRED"
  ));
  const urgent = before.attention.find((item) => (
    item.attentionId.startsWith("contract-expiry:") && item.category === "ACTION_REQUIRED"
  ));
  const required = before.attention.find((item) =>
    item.attentionId.startsWith("roster-shortage:") && !item.dismissible);
  ok(dismissible, "fixture did not expose a dismissible renewal-window item");
  ok(urgent?.dismissible === true, "urgent contract news must be dismissible");
  ok(required, "fixture did not expose a protected show/roster Action Required item");

  const after = await dismissAlphaAttention(repository, worldId, "alpha-player", {
    attentionId: dismissible!.attentionId,
  });
  ok(!after.attention.some((item) => item.attentionId === dismissible!.attentionId), "dismissed item remained visible");
  ok(after.attention.some((item) => item.attentionId === urgent!.attentionId), "dismissing one contract removed other urgent contract news");
  ok(after.attention.some((item) => item.attentionId === required!.attentionId), "dismissing contract news removed a mandatory show/roster requirement");

  const persisted = await repository.load(worldId);
  const dismissals = persisted.engagement?.attentionDismissals.filter((record) => (
    record.playerId === "alpha-player" && record.attentionId === dismissible!.attentionId
  )) ?? [];
  ok(dismissals.length === 1, "dismissal did not persist exactly once for the player");

  const retried = await dismissAlphaAttention(repository, worldId, "alpha-player", {
    attentionId: dismissible!.attentionId,
  });
  ok(!retried.attention.some((item) => item.attentionId === dismissible!.attentionId), "dismissal retry resurfaced the item");
  const afterRetry = await repository.load(worldId);
  ok(
    (afterRetry.engagement?.attentionDismissals ?? []).filter((record) => (
      record.playerId === "alpha-player" && record.attentionId === dismissible!.attentionId
    )).length === 1,
    "dismissal retry duplicated the persisted record",
  );

  let protectedRejected = false;
  try {
    await dismissAlphaAttention(repository, worldId, "alpha-player", { attentionId: required!.attentionId });
  } catch (error) {
    protectedRejected = error instanceof Error && error.message.includes("cannot be dismissed");
  }
  ok(protectedRejected, "service allowed a mandatory non-dismissible game requirement to be dismissed");
  const dismissedUrgent = await dismissAlphaAttention(repository, worldId, "alpha-player", { attentionId: urgent!.attentionId });
  ok(!dismissedUrgent.attention.some((item) => item.attentionId === urgent!.attentionId),
    "urgent contract news ignored the player's Dismiss choice");
});

console.log(`\nWeb Attention-dismissal tests: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exitCode = 1;
