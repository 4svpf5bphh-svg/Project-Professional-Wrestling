declare const process: { exitCode?: number };

import {
  activityForPlayer,
  addOpportunity,
  attentionIsDismissed,
  createWorldEngagementState,
  dismissAttention,
  evaluatePlayerInactivity,
  opportunityVisibleToPlayer,
  recordPlayerActivity,
} from "../packages/application/src/index.js";

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
