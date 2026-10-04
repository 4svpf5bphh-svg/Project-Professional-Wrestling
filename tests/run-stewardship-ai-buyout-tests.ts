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
  runAiStewardshipBuyouts,
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
  sellerPromotionId: string;
  buyerPromotionId: string;
  personId: string;
  contractId: string;
  requestId: string;
} {
  const state = createWorld(seed, DEFAULT_RULESET);
  const ownership = createWorldOwnershipState(state.world.id, 1);
  const playerId = "inactive-owner";
  joinPlayerToWorld(ownership, playerId, state.world.currentDate);

  const seller = state.promotions.find((promotion) => (
    promotion.controllerType === "AI"
    && promotion.tier === "INDEPENDENT"
    && promotion.lifecycle === "ACTIVE"
    && activeContractsForPromotion(state, promotion.id).some((contract) => (
      contract.family !== "ONE_OFF"
      && activeContractsForPerson(state, contract.personId).length === 1
    ))
  ));
  if (!seller) throw new Error("AI buyout fixture could not find a seller");
  claimIndependentPromotionForPlayer(state, ownership, playerId, seller.id);

  const contract = activeContractsForPromotion(state, seller.id).find((candidate) => (
    candidate.family !== "ONE_OFF" && activeContractsForPerson(state, candidate.personId).length === 1
  ));
  if (!contract) throw new Error("AI buyout fixture lost source contract");

  const buyer = state.promotions.find((promotion) => (
    promotion.id !== seller.id
    && promotion.controllerType === "AI"
    && promotion.lifecycle === "ACTIVE"
  ));
  if (!buyer) throw new Error("AI buyout fixture could not find buyer");
  buyer.cash = 100_000_000;
  buyer.financialDistress = "HEALTHY";

  // Force a clear roster deficit for the one AI promotion allowed to bid.
  for (const buyerContract of activeContractsForPromotion(state, buyer.id)) {
    buyerContract.status = "TERMINATED";
  }
  for (const promotion of state.promotions) {
    if (promotion.controllerType === "AI" && promotion.id !== buyer.id) {
      promotion.financialDistress = "CRISIS";
    }
  }

  // The policy still uses the normal wrestler-consent machinery; zero threshold
  // makes this fixture deterministic rather than depending on generated priorities.
  state.ruleset.offerAcceptanceThreshold = 0;

  const engagement = createWorldEngagementState(state.world.id);
  recordPlayerActivity(engagement, playerId, state.world.currentDate, 0, "2026-09-01");
  const activity = engagement.playerActivity.find((record) => record.playerId === playerId);
  if (!activity) throw new Error("AI buyout fixture lost player activity");
  activity.status = "STEWARDED";
  activity.statusSinceCycleKey = "2026-09-15";

  const requestId = `stewardship-exit:${contract.id}:2026-10-01`;
  const request: StewardshipExitRequest = {
    requestId,
    worldId: state.world.id,
    promotionId: seller.id,
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
    sellerPromotionId: seller.id,
    buyerPromotionId: buyer.id,
    personId: contract.personId,
    contractId: contract.id,
    requestId,
  };
}

await test("AI rival uses an eligible Stewardship buyout without bypassing the contract path", () => {
  const f = fixture(18401);
  const result = runAiStewardshipBuyouts(f.aggregate, "2026-10-08");

  equal(result.executedBuyouts, 1, "AI did not execute the eligible buyout");
  equal(f.aggregate.state.contracts.find((contract) => contract.id === f.contractId)?.status, "TERMINATED", "AI buyout did not terminate source contract");
  equal(f.aggregate.engagement?.stewardshipExitRequests[0]?.status, "SETTLED", "AI buyout did not settle release request");
  ok(
    f.aggregate.state.contracts.some((contract) => (
      contract.status === "SIGNED"
      && contract.promotionId === f.buyerPromotionId
      && contract.personId === f.personId
    )),
    "AI buyout did not create an accepted replacement contract",
  );
  ok(
    f.aggregate.state.ledger.some((entry) => entry.type === "STEWARDSHIP_RIVAL_BUYOUT_EXECUTED"),
    "AI buyout did not use the normal audited buyout executor",
  );
});

await test("AI rival cannot act before the Stewardship buyout notice expires", () => {
  const f = fixture(18402);
  const result = runAiStewardshipBuyouts(f.aggregate, "2026-10-07");
  equal(result.executedBuyouts, 0, "AI bypassed buyout notice period");
  equal(f.aggregate.state.contracts.find((contract) => contract.id === f.contractId)?.status, "SIGNED", "early AI attempt changed source contract");
});

await test("financially distressed AI promotion will not raid a Stewarded roster", () => {
  const f = fixture(18403);
  const buyer = f.aggregate.state.promotions.find((promotion) => promotion.id === f.buyerPromotionId)!;
  buyer.financialDistress = "DISTRESSED";
  const result = runAiStewardshipBuyouts(f.aggregate, "2026-10-08");
  equal(result.executedBuyouts, 0, "distressed AI executed a Stewardship buyout");
  equal(f.aggregate.state.contracts.find((contract) => contract.id === f.contractId)?.status, "SIGNED", "distressed AI changed source contract");
});

await test("returning owner immediately removes the AI rival buyout opportunity", () => {
  const f = fixture(18404);
  recordPlayerActivity(
    f.aggregate.engagement!,
    f.playerId,
    f.aggregate.state.world.currentDate,
    f.aggregate.runtime.revision,
    "2026-10-08",
  );
  const result = runAiStewardshipBuyouts(f.aggregate, "2026-10-08");
  equal(result.executedBuyouts, 0, "AI bought out talent after owner returned");
  equal(f.aggregate.state.contracts.find((contract) => contract.id === f.contractId)?.status, "SIGNED", "return protection failed");
});

await test("daily scheduler runs AI Stewardship buyouts before weekly lock", async () => {
  const f = fixture(18405);
  const repository = new InMemoryApplicationWorldRepository();
  await repository.initialize(f.aggregate);

  await resolveScheduledWorldCycle(repository, f.aggregate.state.world.id, "2026-10-08");
  const after = await repository.load(f.aggregate.state.world.id);

  equal(after.state.contracts.find((contract) => contract.id === f.contractId)?.status, "TERMINATED", "scheduler did not execute eligible AI buyout");
  ok(
    after.state.ledger.some((entry) => entry.type === "STEWARDSHIP_RIVAL_BUYOUT_EXECUTED"),
    "scheduler AI buyout was not recorded",
  );
  equal(after.runtime.phase, "OPEN", "scheduler did not reopen World after AI buyout cycle");
});

console.log(`\nStewardship AI buyout tests: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exitCode = 1;
