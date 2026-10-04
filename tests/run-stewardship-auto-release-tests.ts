declare const process: { exitCode?: number };

import {
  claimIndependentPromotionForPlayer,
  createWorldCommandState,
  createWorldEngagementState,
  createWorldOwnershipState,
  createWorldPlanningState,
  createWorldRuntimeState,
  joinPlayerToWorld,
  recordPlayerActivity,
  resolveScheduledWorldCycle,
  settleOverdueStewardshipExitRequests,
  type ApplicationWorldAggregate,
  type StewardshipExitRequest,
} from "../packages/application/src/index.js";
import { DEFAULT_RULESET } from "../packages/config/src/default-ruleset.js";
import { InMemoryApplicationWorldRepository } from "../packages/persistence/src/memory-world-repository.js";
import {
  activeContractsForPerson,
  activeContractsForPromotion,
  createWorld,
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

function equal<T>(actual: T, expected: T, message: string): void {
  if (actual !== expected) throw new Error(`${message}: expected ${String(expected)}, got ${String(actual)}`);
}

function fixture(seed: number): {
  aggregate: ApplicationWorldAggregate;
  playerId: string;
  promotionId: string;
  personId: string;
  contractId: string;
  requestId: string;
} {
  const state = createWorld(seed, DEFAULT_RULESET);
  const ownership = createWorldOwnershipState(state.world.id, 1);
  const playerId = "absent-owner";
  joinPlayerToWorld(ownership, playerId, state.world.currentDate);

  const promotion = state.promotions.find((candidate) => (
    candidate.controllerType === "AI"
    && candidate.tier === "INDEPENDENT"
    && candidate.lifecycle === "ACTIVE"
    && activeContractsForPromotion(state, candidate.id).some((contract) => (
      contract.family !== "ONE_OFF" && activeContractsForPerson(state, contract.personId).length === 1
    ))
  ));
  if (!promotion) throw new Error("auto-release fixture could not find a suitable Independent promotion");
  claimIndependentPromotionForPlayer(state, ownership, playerId, promotion.id);

  const contract = activeContractsForPromotion(state, promotion.id).find((candidate) => (
    candidate.family !== "ONE_OFF" && activeContractsForPerson(state, candidate.personId).length === 1
  ));
  if (!contract) throw new Error("auto-release fixture lost its contract");

  const engagement = createWorldEngagementState(state.world.id);
  recordPlayerActivity(engagement, playerId, state.world.currentDate, 0, "2026-09-01");
  const activity = engagement.playerActivity.find((record) => record.playerId === playerId);
  if (!activity) throw new Error("auto-release fixture lost player activity");
  activity.status = "STEWARDED";
  activity.statusSinceCycleKey = "2026-09-15";

  const requestId = `stewardship-exit:${contract.id}:2026-10-01`;
  const request: StewardshipExitRequest = {
    requestId,
    worldId: state.world.id,
    promotionId: promotion.id,
    personId: contract.personId,
    contractId: contract.id,
    requestedDate: { ...state.world.currentDate },
    requestedCycleKey: "2026-10-01",
    trustAtRequest: 35,
    status: "OPEN",
  };
  engagement.stewardshipExitRequests.push(request);

  return {
    aggregate: {
      state,
      ownership,
      commands: createWorldCommandState(state.world.id),
      runtime: createWorldRuntimeState(state.world.id),
      planning: createWorldPlanningState(state.world.id),
      engagement,
    },
    playerId,
    promotionId: promotion.id,
    personId: contract.personId,
    contractId: contract.id,
    requestId,
  };
}

await test("automatic release waits the full fourteen-day request grace and executes once", () => {
  const f = fixture(18401);
  const early = settleOverdueStewardshipExitRequests(f.aggregate, "2026-10-14");
  equal(early.releasedContracts, 0, "request released before fourteen full days elapsed");
  equal(f.aggregate.engagement?.stewardshipExitRequests[0]?.status, "OPEN", "early check changed request status");
  equal(f.aggregate.state.contracts.find((contract) => contract.id === f.contractId)?.status, "SIGNED", "early check terminated contract");

  const due = settleOverdueStewardshipExitRequests(f.aggregate, "2026-10-15");
  equal(due.eligibleRequests, 1, "due request was not recognized");
  equal(due.releasedContracts, 1, "due request did not release contract");
  equal(f.aggregate.engagement?.stewardshipExitRequests[0]?.status, "SETTLED", "automatic release did not settle request");
  equal(f.aggregate.state.contracts.find((contract) => contract.id === f.contractId)?.status, "TERMINATED", "automatic release did not terminate contract");
  equal(
    f.aggregate.state.ledger.filter((entry) => entry.type === "STEWARDSHIP_EARLY_RELEASE_AUTO_SETTLED" && entry.entityIds[2] === f.contractId).length,
    1,
    "automatic settlement was not recorded exactly once",
  );

  const retry = settleOverdueStewardshipExitRequests(f.aggregate, "2026-10-15");
  equal(retry.releasedContracts, 0, "retry released contract twice");
  equal(
    f.aggregate.state.ledger.filter((entry) => entry.type === "STEWARDSHIP_EARLY_RELEASE_EXECUTED" && entry.entityIds[2] === f.contractId).length,
    1,
    "retry duplicated release execution history",
  );
});

await test("returning owner prevents automatic release even after the grace period", () => {
  const f = fixture(18402);
  recordPlayerActivity(
    f.aggregate.engagement!,
    f.playerId,
    f.aggregate.state.world.currentDate,
    f.aggregate.runtime.revision,
    "2026-10-15",
  );

  const result = settleOverdueStewardshipExitRequests(f.aggregate, "2026-10-15");
  equal(result.releasedContracts, 0, "active owner still lost wrestler automatically");
  equal(f.aggregate.engagement?.stewardshipExitRequests[0]?.status, "OPEN", "active owner request was auto-settled");
  equal(f.aggregate.state.contracts.find((contract) => contract.id === f.contractId)?.status, "SIGNED", "active owner contract was terminated");
});

await test("committed materialized appearance defers automatic release without closing the request", () => {
  const f = fixture(18403);
  f.aggregate.state.scheduledAppearances.push({
    id: "auto-release-defer-appearance",
    worldId: f.aggregate.state.world.id,
    eventId: "auto-release-defer-event",
    promotionId: f.promotionId,
    personId: f.personId,
    contractId: f.contractId,
    date: { ...f.aggregate.state.world.currentDate },
    serviceCapacityAtBooking: 1,
    status: "COMMITTED",
  });

  const result = settleOverdueStewardshipExitRequests(f.aggregate, "2026-10-15");
  equal(result.eligibleRequests, 1, "overdue request was not recognized while appearance was committed");
  equal(result.deferredCommittedAppearances, 1, "committed appearance did not defer release");
  equal(result.releasedContracts, 0, "deferred request still released contract");
  equal(f.aggregate.engagement?.stewardshipExitRequests[0]?.status, "OPEN", "deferred request was closed");
  equal(f.aggregate.state.contracts.find((contract) => contract.id === f.contractId)?.status, "SIGNED", "deferred contract was terminated");
});

await test("daily scheduler automatically releases an overdue request before the weekly lock", async () => {
  const f = fixture(18404);
  const repository = new InMemoryApplicationWorldRepository();
  await repository.initialize(f.aggregate);

  const result = await resolveScheduledWorldCycle(repository, f.aggregate.state.world.id, "2026-10-15");
  const after = await repository.load(f.aggregate.state.world.id);

  equal(result.status, "RESOLVED", "scheduler did not complete the World cycle");
  equal(after.state.contracts.find((contract) => contract.id === f.contractId)?.status, "TERMINATED", "scheduler did not execute overdue release");
  equal(
    after.engagement?.stewardshipExitRequests.find((request) => request.requestId === f.requestId)?.status,
    "SETTLED",
    "scheduler did not settle overdue request",
  );
  ok(
    after.state.ledger.some((entry) => entry.type === "STEWARDSHIP_EARLY_RELEASE_AUTO_SETTLED" && entry.entityIds[2] === f.contractId),
    "scheduler did not record automatic settlement",
  );
  ok(after.runtime.phase === "OPEN", "scheduler did not reopen World after automatic release");
});

console.log(`\nStewardship auto-release tests: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exitCode = 1;
