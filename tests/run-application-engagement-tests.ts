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
  STEWARDSHIP_EXIT_GRACE_DAYS,
  STEWARDSHIP_EXIT_TRUST_THRESHOLD,
  stewardshipExitEligibilityForContract,
  stewardshipExitEligibleContracts,
  STEWARDSHIP_TRUST_PRESSURE_PER_WEEK,
  type ApplicationWorldAggregate,
} from "../packages/application/src/index.js";
import { DEFAULT_RULESET } from "../packages/config/src/default-ruleset.js";
import { InMemoryApplicationWorldRepository } from "../packages/persistence/src/memory-world-repository.js";
import {
  activeContractsForPromotion,
  createWorld,
  ensurePromotionTalentTrust,
  promotionTalentTrustFor,
} from "../packages/sim-core/src/index.js";

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
    && activeContractsForPromotion(state, candidate.id).some((contract) => contract.family !== "ONE_OFF")
  ));
  if (!promotion) throw new Error("stewardship fixture could not find a contracted Independent promotion");
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

await test("Stewardship applies promotion-specific Trust pressure once per PPW week and stops on return", async () => {
  const aggregate = stewardedWorldFixture(18102, "2026-10-01");
  const control = aggregate.ownership.promotionControls[0];
  if (!control) throw new Error("stewardship fixture has no promotion control");
  ensurePromotionTalentTrust(aggregate.state);
  const contract = activeContractsForPromotion(aggregate.state, control.promotionId)
    .find((candidate) => candidate.family !== "ONE_OFF");
  if (!contract) throw new Error("stewardship fixture has no continuing contract");
  const initialTrust = promotionTalentTrustFor(aggregate.state, control.promotionId, contract.personId).trust;

  const repository = new InMemoryApplicationWorldRepository();
  await repository.initialize(aggregate);
  const worldId = aggregate.state.world.id;

  await resolveScheduledWorldCycle(repository, worldId, "2026-10-15");
  let after = await repository.load(worldId);
  let trust = promotionTalentTrustFor(after.state, control.promotionId, contract.personId).trust;
  ok(
    trust === Math.max(10, initialTrust - STEWARDSHIP_TRUST_PRESSURE_PER_WEEK),
    "first STEWARDED week did not apply the expected Trust pressure",
  );
  const pressureEvents = after.state.ledger.filter((entry) => (
    entry.type === "STEWARDSHIP_TALENT_TRUST_PRESSURE"
    && entry.entityIds[0] === control.promotionId
  ));
  ok(pressureEvents.length === 1, "Stewardship Trust pressure was not recorded exactly once");

  await resolveScheduledWorldCycle(repository, worldId, "2026-10-15");
  after = await repository.load(worldId);
  const duplicateTrust = promotionTalentTrustFor(after.state, control.promotionId, contract.personId).trust;
  ok(duplicateTrust === trust, "duplicate scheduler delivery applied Stewardship Trust pressure twice");

  await repository.transact(worldId, after.runtime.revision, (current) => {
    if (!current.engagement) throw new Error("engagement state disappeared before return activity");
    recordPlayerActivity(
      current.engagement,
      control.playerId,
      current.state.world.currentDate,
      current.runtime.revision,
      "2026-10-16",
    );
  });
  const returned = await repository.load(worldId);
  await resolveScheduledWorldCycle(repository, worldId, "2026-10-16");
  after = await repository.load(worldId);
  trust = promotionTalentTrustFor(after.state, control.promotionId, contract.personId).trust;
  ok(trust === duplicateTrust, "returning player still received Stewardship Trust pressure");
  const returnedRecord = after.engagement ? activityForPlayer(after.engagement, control.playerId) : null;
  ok(returnedRecord?.status === "ACTIVE", "returning player was not ACTIVE after the next scheduler cycle");
  ok(after.runtime.revision >= returned.runtime.revision, "return flow regressed World revision");
});

await test("Stewardship exit eligibility requires extended grace and low Trust, and closes immediately on return", () => {
  const aggregate = stewardedWorldFixture(18103, "2026-10-01");
  const control = aggregate.ownership.promotionControls[0];
  if (!control || !aggregate.engagement) throw new Error("exit fixture is missing control or engagement state");
  ensurePromotionTalentTrust(aggregate.state);
  const contract = activeContractsForPromotion(aggregate.state, control.promotionId)
    .find((candidate) => candidate.family !== "ONE_OFF");
  if (!contract) throw new Error("exit fixture has no continuing contract");
  const relationship = promotionTalentTrustFor(aggregate.state, control.promotionId, contract.personId);

  evaluatePlayerInactivity(aggregate.engagement, control.playerId, "2026-10-15");
  relationship.trust = STEWARDSHIP_EXIT_TRUST_THRESHOLD;

  let eligibility = stewardshipExitEligibilityForContract(aggregate, contract.id, "2026-10-28");
  ok(!eligibility.eligible, "contract became exit-eligible before the Stewardship grace period ended");
  ok(eligibility.reason === "GRACE_PERIOD", "early exit was blocked for the wrong reason");
  ok(eligibility.stewardedDays === STEWARDSHIP_EXIT_GRACE_DAYS - 1, "Stewardship duration was calculated incorrectly");

  eligibility = stewardshipExitEligibilityForContract(aggregate, contract.id, "2026-10-29");
  ok(eligibility.eligible, "low-Trust contract did not become exit-eligible after the full grace period");
  ok(eligibility.reason === "ELIGIBLE", "eligible contract did not expose the ELIGIBLE reason");
  ok(
    stewardshipExitEligibleContracts(aggregate, "2026-10-29").some((candidate) => candidate.contractId === contract.id),
    "eligible contract was missing from the World exit-eligibility list",
  );

  relationship.trust = STEWARDSHIP_EXIT_TRUST_THRESHOLD + 1;
  eligibility = stewardshipExitEligibilityForContract(aggregate, contract.id, "2026-10-29");
  ok(!eligibility.eligible, "high-Trust relationship incorrectly qualified for an accelerated exit");
  ok(eligibility.reason === "TRUST_TOO_HIGH", "high Trust was blocked for the wrong reason");

  relationship.trust = STEWARDSHIP_EXIT_TRUST_THRESHOLD;
  recordPlayerActivity(
    aggregate.engagement,
    control.playerId,
    aggregate.state.world.currentDate,
    aggregate.runtime.revision,
    "2026-10-29",
  );
  eligibility = stewardshipExitEligibilityForContract(aggregate, contract.id, "2026-10-29");
  ok(!eligibility.eligible, "returning owner left an accelerated exit route open");
  ok(eligibility.reason === "NOT_STEWARDED", "returning owner closed eligibility for the wrong reason");
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
