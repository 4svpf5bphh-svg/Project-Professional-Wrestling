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
  respondToStewardshipExitRequest,
  type ApplicationWorldAggregate,
  type StewardshipExitRequest,
} from "../packages/application/src/index.js";
import { DEFAULT_RULESET } from "../packages/config/src/default-ruleset.js";
import {
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

function expectThrow(fn: () => void, includes: string): void {
  try {
    fn();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!message.includes(includes)) throw new Error(`expected error containing ${includes}, got: ${message}`);
    return;
  }
  throw new Error(`expected error containing ${includes}`);
}

function responseFixture(seed: number): {
  aggregate: ApplicationWorldAggregate;
  playerId: string;
  contractId: string;
  requestId: string;
} {
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
  if (!promotion) throw new Error("response fixture could not find a contracted Independent promotion");
  claimIndependentPromotionForPlayer(state, ownership, playerId, promotion.id);

  const contract = activeContractsForPromotion(state, promotion.id)
    .find((candidate) => candidate.family !== "ONE_OFF");
  if (!contract) throw new Error("response fixture has no continuing contract");

  const engagement = createWorldEngagementState(state.world.id);
  recordPlayerActivity(engagement, playerId, state.world.currentDate, 0, "2026-10-30");
  const requestId = `stewardship-exit:${contract.id}:2026-10-29`;
  const request: StewardshipExitRequest = {
    requestId,
    worldId: state.world.id,
    promotionId: promotion.id,
    personId: contract.personId,
    contractId: contract.id,
    requestedDate: { ...state.world.currentDate },
    requestedCycleKey: "2026-10-29",
    trustAtRequest: 40,
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
    contractId: contract.id,
    requestId,
  };
}

await test("returning owner can retain talent and withdraw the open Stewardship release request", () => {
  const fixture = responseFixture(18201);
  const { aggregate, playerId, contractId, requestId } = fixture;

  expectThrow(
    () => respondToStewardshipExitRequest(aggregate, "player-b", requestId, "RETAIN", "2026-10-30"),
    "does not control",
  );
  ok(aggregate.engagement?.stewardshipExitRequests[0]?.status === "OPEN", "unauthorized response mutated the request");

  const resolved = respondToStewardshipExitRequest(aggregate, playerId, requestId, "RETAIN", "2026-10-30");
  ok(resolved.status === "WITHDRAWN", "retain decision did not withdraw the release request");
  ok(aggregate.state.contracts.find((contract) => contract.id === contractId)?.status === "SIGNED", "retain decision changed the contract");
  ok(
    aggregate.state.ledger.filter((entry) => entry.type === "STEWARDSHIP_EARLY_RELEASE_RETAINED" && entry.entityIds[2] === contractId).length === 1,
    "retain decision was not written once to World history",
  );

  expectThrow(
    () => respondToStewardshipExitRequest(aggregate, playerId, requestId, "RETAIN", "2026-10-30"),
    "already withdrawn",
  );
});

await test("returning owner can agree a release without terminating the contract in the response slice", () => {
  const fixture = responseFixture(18202);
  const { aggregate, playerId, contractId, requestId } = fixture;

  const activity = aggregate.engagement?.playerActivity.find((record) => record.playerId === playerId);
  if (!activity) throw new Error("response fixture lost player activity");
  activity.status = "STEWARDED";
  expectThrow(
    () => respondToStewardshipExitRequest(aggregate, playerId, requestId, "AGREE_RELEASE", "2026-10-30"),
    "must return to ACTIVE",
  );
  ok(aggregate.engagement?.stewardshipExitRequests[0]?.status === "OPEN", "inactive-owner response mutated the request");

  recordPlayerActivity(aggregate.engagement!, playerId, aggregate.state.world.currentDate, aggregate.runtime.revision, "2026-10-30");
  const resolved = respondToStewardshipExitRequest(aggregate, playerId, requestId, "AGREE_RELEASE", "2026-10-30");
  ok(resolved.status === "SETTLED", "agree-release decision did not settle the request");
  ok(aggregate.state.contracts.find((contract) => contract.id === contractId)?.status === "SIGNED", "response slice terminated the contract prematurely");
  ok(
    aggregate.state.ledger.filter((entry) => entry.type === "STEWARDSHIP_EARLY_RELEASE_AGREED" && entry.entityIds[2] === contractId).length === 1,
    "agreed release was not written once to World history",
  );
});

console.log(`\nStewardship exit response tests: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exitCode = 1;
