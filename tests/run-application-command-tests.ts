declare const process: { exitCode?: number };

import {
  claimIndependentPromotionCommand,
  createWorldCommandState,
  createWorldOwnershipState,
  createWorldRuntimeState,
  joinPlayerToWorld,
  submitContractOfferCommand,
} from "../packages/application/src/index.js";
import { DEFAULT_RULESET } from "../packages/config/src/default-ruleset.js";
import {
  activeContractsForPerson,
  addPpwWeeks,
  createWorld,
} from "../packages/sim-core/src/index.js";

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void): void {
  try {
    fn();
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

function fixture(seed: number) {
  const state = createWorld(seed, DEFAULT_RULESET);
  const ownership = createWorldOwnershipState(state.world.id, 2);
  const commands = createWorldCommandState(state.world.id);
  const runtime = createWorldRuntimeState(state.world.id);
  return { state, ownership, commands, runtime };
}

test("retrying the same promotion claim returns the committed result without mutating twice", () => {
  const { state, ownership, commands, runtime } = fixture(12001);
  joinPlayerToWorld(ownership, "player-a", state.world.currentDate);
  const promotion = state.promotions.find(
    (candidate) => candidate.tier === "INDEPENDENT" && candidate.lifecycle === "ACTIVE",
  )!;
  const envelope = {
    requestId: "claim-001",
    worldId: state.world.id,
    playerId: "player-a",
    commandType: "CLAIM_INDEPENDENT_PROMOTION" as const,
    payload: { promotionId: promotion.id, options: { name: "Retry Wrestling" } },
  };

  const first = claimIndependentPromotionCommand(state, ownership, commands, runtime, envelope);
  const controlsAfterFirst = ownership.promotionControls.length;
  const ledgerAfterFirst = state.ledger.filter((entry) => entry.type === "HUMAN_PROMOTION_CLAIMED").length;
  const revisionAfterFirst = runtime.revision;
  const second = claimIndependentPromotionCommand(state, ownership, commands, runtime, {
    ...envelope,
    payload: { options: { name: "Retry Wrestling" }, promotionId: promotion.id },
  });

  ok(first.id === second.id, "retry did not return the originally committed promotion");
  ok(ownership.promotionControls.length === controlsAfterFirst, "retry created another promotion-control record");
  ok(
    state.ledger.filter((entry) => entry.type === "HUMAN_PROMOTION_CLAIMED").length === ledgerAfterFirst,
    "retry wrote the promotion claim to history twice",
  );
  ok(commands.receipts.length === 1, "retry created more than one command receipt");
  ok(revisionAfterFirst === 1 && runtime.revision === 1, "idempotent retry advanced the World revision");
  ok(commands.receipts[0]!.committedRevision === 1, "receipt did not record the committed revision");
});

test("a request ID cannot be reused for a different payload or player", () => {
  const { state, ownership, commands, runtime } = fixture(12002);
  joinPlayerToWorld(ownership, "player-a", state.world.currentDate);
  joinPlayerToWorld(ownership, "player-b", state.world.currentDate);
  const promotions = state.promotions.filter(
    (candidate) => candidate.tier === "INDEPENDENT" && candidate.lifecycle === "ACTIVE",
  );

  claimIndependentPromotionCommand(state, ownership, commands, runtime, {
    requestId: "claim-conflict",
    worldId: state.world.id,
    playerId: "player-a",
    commandType: "CLAIM_INDEPENDENT_PROMOTION",
    payload: { promotionId: promotions[0]!.id },
  });

  let payloadRejected = false;
  try {
    claimIndependentPromotionCommand(state, ownership, commands, runtime, {
      requestId: "claim-conflict",
      worldId: state.world.id,
      playerId: "player-a",
      commandType: "CLAIM_INDEPENDENT_PROMOTION",
      payload: { promotionId: promotions[1]!.id },
    });
  } catch {
    payloadRejected = true;
  }
  ok(payloadRejected, "request ID could be reused with a different payload");
  ok(promotions[1]!.controllerType === "AI", "conflicting retry mutated the second promotion");

  let playerRejected = false;
  try {
    claimIndependentPromotionCommand(state, ownership, commands, runtime, {
      requestId: "claim-conflict",
      worldId: state.world.id,
      playerId: "player-b",
      commandType: "CLAIM_INDEPENDENT_PROMOTION",
      payload: { promotionId: promotions[0]!.id },
    });
  } catch {
    playerRejected = true;
  }
  ok(playerRejected, "request ID could be reused by a different player");
  ok(runtime.revision === 1, "conflicting request reuse advanced the World revision");
});

test("a failed command does not consume its request ID or revision", () => {
  const { state, ownership, commands, runtime } = fixture(12003);
  const promotion = state.promotions.find(
    (candidate) => candidate.tier === "INDEPENDENT" && candidate.lifecycle === "ACTIVE",
  )!;
  const envelope = {
    requestId: "claim-after-failure",
    worldId: state.world.id,
    playerId: "player-a",
    commandType: "CLAIM_INDEPENDENT_PROMOTION" as const,
    payload: { promotionId: promotion.id },
  };

  let rejected = false;
  try {
    claimIndependentPromotionCommand(state, ownership, commands, runtime, envelope);
  } catch {
    rejected = true;
  }
  ok(rejected, "claim without World membership unexpectedly succeeded");
  ok(commands.receipts.length === 0, "failed command was recorded as committed");
  ok(runtime.revision === 0, "failed command advanced the World revision");
  ok(promotion.controllerType === "AI", "failed command partially mutated promotion control");

  joinPlayerToWorld(ownership, "player-a", state.world.currentDate);
  const claimed = claimIndependentPromotionCommand(state, ownership, commands, runtime, envelope);
  ok(claimed.controllerType === "HUMAN", "same request could not succeed after the underlying problem was fixed");
  ok(commands.receipts.length === 1, "successful retry did not create exactly one receipt");
  ok(runtime.revision === 1, "successful retry did not advance revision exactly once");
});

test("retrying a contract offer cannot submit, allocate or revise twice", () => {
  const { state, ownership, commands, runtime } = fixture(12004);
  joinPlayerToWorld(ownership, "player-a", state.world.currentDate);
  const promotion = state.promotions.find(
    (candidate) => candidate.tier === "INDEPENDENT" && candidate.lifecycle === "ACTIVE",
  )!;
  claimIndependentPromotionCommand(state, ownership, commands, runtime, {
    requestId: "claim-for-contract",
    worldId: state.world.id,
    playerId: "player-a",
    commandType: "CLAIM_INDEPENDENT_PROMOTION",
    payload: { promotionId: promotion.id },
  });
  const freeAgent = state.people.find(
    (person) => person.status === "ACTIVE" && activeContractsForPerson(state, person.id).length === 0,
  )!;
  const payload = {
    promotionId: promotion.id,
    personId: freeAgent.id,
    family: "LIMITED_NON_EXCLUSIVE" as const,
    exclusivity: "NON_EXCLUSIVE" as const,
    roleExpectation: "FEATURED" as const,
    startDate: { ...state.world.currentDate },
    endDate: addPpwWeeks(state.world.currentDate, 12, state.ruleset.weeksPerYear),
    dateEntitlement: 4,
    weeklyGuarantee: 12_000,
    appearanceFee: 6_500,
    signingBonus: 8_000,
  };
  const envelope = {
    requestId: "offer-001",
    worldId: state.world.id,
    playerId: "player-a",
    commandType: "SUBMIT_CONTRACT_OFFER" as const,
    payload,
  };

  const first = submitContractOfferCommand(state, ownership, commands, runtime, envelope);
  const offerCount = state.contractOffers.length;
  const ledgerCount = state.ledger.filter((entry) => entry.type === "HUMAN_CONTRACT_OFFER_SUBMITTED").length;
  const revisionAfterFirst = runtime.revision;
  const second = submitContractOfferCommand(state, ownership, commands, runtime, envelope);

  ok(first.id === second.id, "contract retry did not return the original offer");
  ok(state.contractOffers.length === offerCount, "contract retry submitted a duplicate offer");
  ok(
    state.ledger.filter((entry) => entry.type === "HUMAN_CONTRACT_OFFER_SUBMITTED").length === ledgerCount,
    "contract retry wrote a duplicate Ledger entry",
  );
  ok(commands.receipts.filter((receipt) => receipt.requestId === "offer-001").length === 1, "offer retry duplicated receipt");
  ok(revisionAfterFirst === 2 && runtime.revision === 2, "contract retry advanced revision more than once");
});

test("contract command authorization is tied to the player-owned promotion", () => {
  const { state, ownership, commands, runtime } = fixture(12005);
  joinPlayerToWorld(ownership, "player-a", state.world.currentDate);
  joinPlayerToWorld(ownership, "player-b", state.world.currentDate);
  const promotion = state.promotions.find(
    (candidate) => candidate.tier === "INDEPENDENT" && candidate.lifecycle === "ACTIVE",
  )!;
  claimIndependentPromotionCommand(state, ownership, commands, runtime, {
    requestId: "claim-owned",
    worldId: state.world.id,
    playerId: "player-a",
    commandType: "CLAIM_INDEPENDENT_PROMOTION",
    payload: { promotionId: promotion.id },
  });
  const freeAgent = state.people.find(
    (person) => person.status === "ACTIVE" && activeContractsForPerson(state, person.id).length === 0,
  )!;

  let rejected = false;
  try {
    submitContractOfferCommand(state, ownership, commands, runtime, {
      requestId: "unauthorized-offer",
      worldId: state.world.id,
      playerId: "player-b",
      commandType: "SUBMIT_CONTRACT_OFFER",
      payload: {
        promotionId: promotion.id,
        personId: freeAgent.id,
        family: "ONE_OFF",
        exclusivity: "OPEN",
        roleExpectation: "REGULAR",
        startDate: { ...state.world.currentDate },
        endDate: { ...state.world.currentDate },
        dateEntitlement: 1,
        weeklyGuarantee: 0,
        appearanceFee: 10_000,
        signingBonus: 0,
      },
    });
  } catch {
    rejected = true;
  }

  ok(rejected, "player could submit a contract offer for another player's promotion");
  ok(!commands.receipts.some((receipt) => receipt.requestId === "unauthorized-offer"), "unauthorized command was committed");
  ok(runtime.revision === 1, "unauthorized command advanced World revision");
});

console.log(`\nApplication command tests: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exitCode = 1;
