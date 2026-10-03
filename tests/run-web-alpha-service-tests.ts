declare const process: { exitCode?: number };

import { lockPersistedWorldForResolution } from "../packages/application/src/index.js";
import { InMemoryApplicationWorldRepository } from "../packages/persistence/src/index.js";
import {
  advanceAlphaWorldWeek,
  claimAlphaPromotion,
  createAlphaWorldAggregate,
  ensureAlphaWorld,
  loadAlphaPlayerSession,
  saveAlphaCurrentWeekShowPlan,
} from "../packages/web-adapter/src/alpha-service.js";

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

function weekKey(view: { world: { year: number; week: number } }): string {
  return `${view.world.year}:${view.world.week}`;
}

function showPlanRequest(view: Awaited<ReturnType<typeof loadAlphaPlayerSession>>, requestId: string) {
  const promotion = view.promotion;
  if (!promotion) throw new Error("test player does not control a promotion");
  const planning = promotion.showPlanning;
  const market = planning.markets[0];
  const venue = market?.venues[0];
  if (!market || !venue) throw new Error("planning view has no market/venue option");
  let participantIds = promotion.roster
    .filter((person) => person.status === "ACTIVE" && person.datesRemaining > 0)
    .slice(0, planning.maxParticipants)
    .map((person) => person.personId);
  if (participantIds.length % 2 !== 0) participantIds = participantIds.slice(0, -1);
  if (participantIds.length < planning.minParticipants) throw new Error("planning view has too few available wrestlers");
  return {
    requestId,
    expectedRevision: view.world.revision,
    expectedPlanVersion: planning.workspaceVersion,
    day: 6,
    marketId: market.marketId,
    venueId: venue.venueId,
    ticketStrategy: "STANDARD" as const,
    participantIds,
  };
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
  ok(after.promotion?.weekReadiness.status !== undefined, "claimed dashboard did not expose week readiness");
  ok((after.promotion?.showPlanning.markets.length ?? 0) > 0, "claimed dashboard did not expose planning markets");

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

await test("Alpha show planning atomically commits a current-week draft and scarce-resource reservation", async () => {
  const repository = new InMemoryApplicationWorldRepository();
  const aggregate = createAlphaWorldAggregate({ seed: 61006, playerId: "alpha-player" });
  await repository.initialize(aggregate);
  const worldId = aggregate.state.world.id;
  const choice = (await loadAlphaPlayerSession(repository, worldId, "alpha-player")).availableIndependentPromotions[0]!;
  const claimed = await claimAlphaPromotion(repository, worldId, "alpha-player", {
    promotionId: choice.promotionId,
    requestId: "web-plan-claim",
  });
  ok(claimed.promotion?.showPlanning.canPlanThisWeek, "current-week show planner was not available after claim");

  const request = showPlanRequest(claimed, "web-plan-save-001");
  const planned = await saveAlphaCurrentWeekShowPlan(repository, worldId, "alpha-player", request);
  ok(planned.world.revision === claimed.world.revision + 2, "draft plus reservation did not advance revision twice");
  ok(planned.promotion?.showPlanning.workspaceVersion === 1, "show draft did not advance plan version");
  ok(planned.promotion?.showPlanning.currentPlan?.state === "RESERVED", "show plan was not returned as reserved");
  ok(planned.promotion?.showPlanning.currentPlan?.venueId === request.venueId, "reserved plan lost selected venue");
  ok(planned.promotion?.showPlanning.currentPlan?.participantIds.length === request.participantIds.length, "reserved plan lost selected talent");

  const persisted = await repository.load(worldId);
  ok(persisted.state.events.length === 0, "show reservation created simulation event before materialization");
  ok(persisted.planning.workspaces[0]?.detailedShowDrafts.length === 1, "show draft was not persisted exactly once");
  ok(persisted.planning.showReservations.length === 1, "show reservation was not persisted exactly once");
  ok(persisted.commands.receipts.length === 3, "claim plus planning did not persist exactly three command receipts");

  const retry = await saveAlphaCurrentWeekShowPlan(repository, worldId, "alpha-player", request);
  ok(retry.world.revision === planned.world.revision, "idempotent show-plan retry advanced revision again");
  const afterRetry = await repository.load(worldId);
  ok(afterRetry.planning.showReservations.length === 1, "show-plan retry duplicated reservation");
});

await test("Alpha week finish resolves exactly one World week and exposes the previous show result", async () => {
  const repository = new InMemoryApplicationWorldRepository();
  const aggregate = createAlphaWorldAggregate({ seed: 61004, playerId: "alpha-player" });
  const independent = aggregate.state.promotions.find((promotion) => (
    promotion.tier === "INDEPENDENT" && promotion.lifecycle === "ACTIVE"
  ));
  ok(independent, "test World had no Independent promotion");
  independent!.eventCadenceWeeks = 1;
  await repository.initialize(aggregate);
  const worldId = aggregate.state.world.id;

  const claimed = await claimAlphaPromotion(repository, worldId, "alpha-player", {
    promotionId: independent!.id,
    requestId: "web-week-claim",
  });
  ok(claimed.promotion?.weekReadiness.status === "SHOW_REQUIRED", "weekly dashboard did not expose missing-show readiness");
  const beforeWeek = weekKey(claimed);
  const startingRevision = claimed.world.revision;

  const after = await advanceAlphaWorldWeek(repository, worldId, "alpha-player", {
    expectedRevision: startingRevision,
  });
  ok(weekKey(after) !== beforeWeek, "Alpha finish week did not advance the PPW calendar");
  ok(after.world.phase === "OPEN", "World did not reopen after weekly resolution");
  ok(after.world.revision > startingRevision, "weekly resolution did not advance World revision");
  ok(after.world.lastResolvedPpwDate?.week === claimed.world.week, "dashboard did not expose the resolved PPW week");
  ok(after.promotion?.lastResolvedShow !== null, "staff-completed mandatory show was not exposed in the result summary");
  ok((after.promotion?.lastResolvedShow?.matchCount ?? 0) > 0, "resolved show summary contains no matches");

  let staleRejected = false;
  try {
    await advanceAlphaWorldWeek(repository, worldId, "alpha-player", {
      expectedRevision: startingRevision,
    });
  } catch (error) {
    staleRejected = error instanceof Error && error.message.includes("stale World revision");
  }
  ok(staleRejected, "stale finish-week retry was not rejected");
  const reloaded = await loadAlphaPlayerSession(repository, worldId, "alpha-player");
  ok(weekKey(reloaded) === weekKey(after), "stale retry advanced the World twice");
});

await test("Alpha week finish safely resumes a durably locked World", async () => {
  const repository = new InMemoryApplicationWorldRepository();
  const aggregate = createAlphaWorldAggregate({ seed: 61005, playerId: "alpha-player" });
  await repository.initialize(aggregate);
  const worldId = aggregate.state.world.id;
  const choice = (await loadAlphaPlayerSession(repository, worldId, "alpha-player")).availableIndependentPromotions[0]!;
  const claimed = await claimAlphaPromotion(repository, worldId, "alpha-player", {
    promotionId: choice.promotionId,
    requestId: "web-lock-recovery-claim",
  });
  const beforeWeek = weekKey(claimed);

  const lockedRevision = await lockPersistedWorldForResolution(repository, worldId, claimed.world.revision);
  const locked = await repository.load(worldId);
  ok(locked.runtime.phase === "LOCKING", "test failed to persist the weekly lock");

  const recovered = await advanceAlphaWorldWeek(repository, worldId, "alpha-player", {
    expectedRevision: lockedRevision,
  });
  ok(recovered.world.phase === "OPEN", "Alpha recovery did not reopen the World");
  ok(weekKey(recovered) !== beforeWeek, "Alpha recovery did not resolve the locked week");
});

console.log(`\nAlpha web service tests: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exitCode = 1;
