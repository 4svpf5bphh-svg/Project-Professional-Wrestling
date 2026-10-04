declare const process: { exitCode?: number };

import {
  activityForPlayer,
  addOpportunity,
  attentionIsDismissed,
  claimIndependentPromotionForPlayer,
  createWorldCommandState,
  createWorldEngagementState,
  createWorldOwnershipState,
  createWorldPlanningState,
  createWorldRuntimeState,
  dismissAttention,
  evaluatePlayerInactivity,
  joinPlayerToWorld,
  opportunityVisibleToPlayer,
  recordPlayerActivity,
  resolveScheduledWorldCycle,
  type ApplicationWorldAggregate,
} from "../packages/application/src/index.js";
import { DEFAULT_RULESET } from "../packages/config/src/default-ruleset.js";
import { InMemoryApplicationWorldRepository } from "../packages/persistence/src/memory-world-repository.js";
import { createWorld } from "../packages/sim-core/src/index.js";

let passed = 0;
let failed = 0;

async function test(name: string, fn: () => void | Promise<void>): Promise<void> {
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

function stewardedWorldFixture(seed: number, lastActiveCycleKey: string): ApplicationWorldAggregate {
  const state = createWorld(seed, DEFAULT_RULESET);
  const ownership = createWorldOwnershipState(state.world.id, 1);
  const playerId = "player-a";
  joinPlayerToWorld(ownership, playerId, state.world.currentDate);

  const promotion = state.promotions.find((candidate) => (
    candidate.controllerType === "AI"
    && candidate.tier === "INDEPENDENT"
    && candidate.lifecycle === "ACTIVE"
  ));
  if (!promotion) throw new Error("stewardship fixture could not find an Independent promotion");
  claimIndependentPromotionForPlayer(state, ownership, playerId, promotion.id);

  const engagement = createWorldEngagementState(state.world.id);
  recordPlayerActivity(engagement, playerId, state.world.currentDate, 0, lastActiveCycleKey);

  return {
    state,
    ownership,
    commands: createWorldCommandState(state.world.id),
    runtime: createWorldRuntimeState(state.world.id),
    planning: createWorldPlanningState(state.world.id),
    engagement,
  };
}

await test("activity transitions ACTIVE to WARNING to STEWARDED and back without rewriting status start on ordinary activity", () => {
  const engagement = createWorldEngagementState("world-test");
  recordPlayerActivity(engagement, "player-a", { year: 1, week: 1, day: 1 }, 3, "2026-10-01");
  recordPlayerActivity(engagement, "player-a", { year: 1, week: 1, day: 2 }, 3, "2026-10-02");

  let record = activityForPlayer(engagement, "player-a");
  ok(record?.status === "ACTIVE", "ordinary activity did not remain ACTIVE");
  ok(record?.lastActiveCycleKey === "2026-10-02", "last activity cycle was not updated");
  ok(record?.statusSinceCycleKey === "2026-10-01", "ordinary activity incorrectly reset ACTIVE status start");

  ok(evaluatePlayerInactivity(engagement, "player-a", "2026-10-09") === "WARNING", "seven inactive days did not enter WARNING");
  record = activityForPlayer(engagement, "player-a");
  ok(record?.statusSinceCycleKey === "2026-10-09", "WARNING transition date was not recorded");

  ok(evaluatePlayerInactivity(engagement, "player-a", "2026-10-16") === "STEWARDED", "fourteen inactive days did not enter STEWARDED");
  record = activityForPlayer(engagement, "player-a");
  ok(record?.statusSinceCycleKey === "2026-10-16", "STEWARDED transition date was not recorded");

  recordPlayerActivity(engagement, "player-a", { year: 1, week: 3, day: 3 }, 4, "2026-10-17");
  record = activityForPlayer(engagement, "player-a");
  ok(record?.status === "ACTIVE", "returning player did not restore ACTIVE status");
  ok(record?.statusSinceCycleKey === "2026-10-17", "return to ACTIVE did not record the transition date");
});

await test("scheduled World resolution evaluates real inactivity before lock", async () => {
  const aggregate = stewardedWorldFixture(18101, "2026-10-01");
  const repository = new InMemoryApplicationWorldRepository();
  await repository.initialize(aggregate);
  const worldId = aggregate.state.world.id;

  await resolveScheduledWorldCycle(repository, worldId, "2026-10-08");
  let after = await repository.load(worldId);
  let record = after.engagement ? activityForPlayer(after.engagement, "player-a") : null;
  ok(record?.status === "WARNING", "scheduler did not move seven-day inactive player to WARNING");
  ok(record?.statusSinceCycleKey === "2026-10-08", "scheduler did not record WARNING transition cycle");

  await resolveScheduledWorldCycle(repository, worldId, "2026-10-15");
  after = await repository.load(worldId);
  record = after.engagement ? activityForPlayer(after.engagement, "player-a") : null;
  ok(record?.status === "STEWARDED", "scheduler did not move fourteen-day inactive player to STEWARDED");
  ok(record?.statusSinceCycleKey === "2026-10-15", "scheduler did not record STEWARDED transition cycle");
  ok(after.runtime.phase === "OPEN", "stewardship evaluation interfered with World resolution");
});

await test("opportunity eligibility never leaks across player or promotion scopes", () => {
  const engagement = createWorldEngagementState("world-test");
  const opportunity = addOpportunity(engagement, {
    opportunityId: "talent-window-1",
    worldId: "world-test",
    category: "TALENT",
    title: "Talent window",
    summary: "A scoped opportunity.",
    createdDate: { year: 1, week: 1, day: 1 },
    opensDate: { year: 1, week: 1, day: 1 },
    closesDate: { year: 1, week: 2, day: 7 },
    eligiblePlayerIds: ["player-a"],
    eligiblePromotionIds: ["promotion-a"],
    deepLink: null,
  });

  ok(opportunityVisibleToPlayer(opportunity, "player-a", "promotion-a"), "eligible player/promotion could not see opportunity");
  ok(!opportunityVisibleToPlayer(opportunity, "player-b", "promotion-a"), "opportunity leaked to another player");
  ok(!opportunityVisibleToPlayer(opportunity, "player-a", "promotion-b"), "opportunity leaked to another promotion");
  ok(!opportunityVisibleToPlayer(opportunity, "player-a", null), "promotion-scoped opportunity leaked to an unclaimed player");
});

await test("Attention dismissal is player-scoped and idempotent", () => {
  const engagement = createWorldEngagementState("world-test");
  dismissAttention(engagement, "player-a", "news-1", 5);
  dismissAttention(engagement, "player-a", "news-1", 6);

  ok(attentionIsDismissed(engagement, "player-a", "news-1"), "dismissed Attention item was not remembered");
  ok(!attentionIsDismissed(engagement, "player-b", "news-1"), "Attention dismissal leaked to another player");
  ok(engagement.attentionDismissals.length === 1, "idempotent dismissal created duplicate records");
  ok(engagement.attentionDismissals[0]?.dismissedAtRevision === 6, "dismissal retry did not refresh its revision");
});

console.log(`\nApplication engagement tests: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exitCode = 1;