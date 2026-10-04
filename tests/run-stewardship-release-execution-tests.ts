declare const process: { exitCode?: number };

import {
  claimIndependentPromotionForPlayer,
  createWorldCommandState,
  createWorldEngagementState,
  createWorldOwnershipState,
  createWorldPlanningState,
  createWorldRuntimeState,
  executeAgreedStewardshipRelease,
  joinPlayerToWorld,
  recordPlayerActivity,
  type ApplicationWorldAggregate,
  type StewardshipExitRequest,
} from "../packages/application/src/index.js";
import { DEFAULT_RULESET } from "../packages/config/src/default-ruleset.js";
import {
  activeContractsForPerson,
  activeContractsForPromotion,
  createWorld,
  ensureWorldChampionships,
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

function executionFixture(seed: number): {
  aggregate: ApplicationWorldAggregate;
  contractId: string;
  promotionId: string;
  personId: string;
  requestId: string;
} {
  const state = createWorld(seed, DEFAULT_RULESET);
  const ownership = createWorldOwnershipState(state.world.id, 1);
  const playerId = "player-a";
  joinPlayerToWorld(ownership, playerId, state.world.currentDate);

  const promotion = state.promotions.find((candidate) => {
    if (candidate.controllerType !== "AI" || candidate.tier !== "INDEPENDENT" || candidate.lifecycle !== "ACTIVE") return false;
    return activeContractsForPromotion(state, candidate.id).some((contract) => (
      contract.family !== "ONE_OFF"
      && activeContractsForPerson(state, contract.personId).filter((other) => other.promotionId === candidate.id).length === 1
    ));
  });
  if (!promotion) throw new Error("execution fixture could not find a suitable Independent promotion");
  claimIndependentPromotionForPlayer(state, ownership, playerId, promotion.id);

  const contract = activeContractsForPromotion(state, promotion.id).find((candidate) => (
    candidate.family !== "ONE_OFF"
    && activeContractsForPerson(state, candidate.personId).filter((other) => other.promotionId === promotion.id).length === 1
  ));
  if (!contract) throw new Error("execution fixture has no suitable continuing contract");

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
    status: "SETTLED",
  };
  engagement.stewardshipExitRequests.push(request);

  const planning = createWorldPlanningState(state.world.id);
  const market = state.markets[0];
  const venue = state.venues.find((candidate) => candidate.marketId === market?.id);
  if (!market || !venue) throw new Error("execution fixture has no market/venue pair");
  planning.showReservations.push({
    reservationId: `test-reservation:${contract.id}`,
    sourceDraftId: `test-draft:${contract.id}`,
    promotionId: promotion.id,
    targetDate: { ...state.world.currentDate },
    marketId: market.id,
    venueId: venue.id,
    ticketStrategy: "STANDARD",
    participants: [{
      personId: contract.personId,
      contractId: contract.id,
      serviceCapacityAtReservation: 1,
    }],
    reservedPlanVersion: 0,
  });

  state.contractOffers.push({
    id: `test-offer:${contract.id}`,
    worldId: state.world.id,
    personId: contract.personId,
    promotionId: promotion.id,
    submittedDate: { ...state.world.currentDate },
    status: "PENDING",
    offerKind: "RENEWAL",
    resolvedUtility: null,
    rejectionReason: null,
    family: contract.family,
    exclusivity: contract.exclusivity,
    roleExpectation: contract.roleExpectation,
    startDate: { ...contract.startDate },
    endDate: { ...contract.endDate },
    dateEntitlement: contract.dateEntitlement,
    weeklyGuarantee: contract.weeklyGuarantee,
    appearanceFee: contract.appearanceFee,
    signingBonus: 0,
  });

  ensureWorldChampionships(state);
  const championship = state.championships?.find((candidate) => (
    candidate.promotionId === promotion.id && candidate.division === "SINGLES"
  ));
  if (!championship) throw new Error("execution fixture has no singles championship");
  state.championshipReigns ??= [];
  let reign = championship.currentReignId
    ? state.championshipReigns.find((candidate) => candidate.id === championship.currentReignId)
    : undefined;
  if (!reign) {
    reign = {
      id: `test-reign:${contract.id}`,
      worldId: state.world.id,
      championshipId: championship.id,
      holderType: "PERSON",
      holderId: contract.personId,
      status: "ACTIVE",
      startDate: { ...state.world.currentDate },
      endDate: null,
      wonMatchId: null,
      lostMatchId: null,
      defenses: 0,
      endReason: null,
    };
    state.championshipReigns.push(reign);
    championship.currentReignId = reign.id;
  } else {
    reign.holderType = "PERSON";
    reign.holderId = contract.personId;
    reign.status = "ACTIVE";
    reign.endDate = null;
    reign.lostMatchId = null;
    reign.endReason = null;
  }

  return {
    aggregate: {
      state,
      ownership,
      commands: createWorldCommandState(state.world.id),
      runtime: createWorldRuntimeState(state.world.id),
      planning,
      engagement,
    },
    contractId: contract.id,
    promotionId: promotion.id,
    personId: contract.personId,
    requestId,
  };
}

await test("agreed Stewardship release terminates the contract and cleans dependent World state once", () => {
  const fixture = executionFixture(18301);
  const { aggregate, contractId, promotionId, personId, requestId } = fixture;

  const result = executeAgreedStewardshipRelease(aggregate, requestId);
  ok(!result.alreadyExecuted, "first release execution was incorrectly reported as a retry");
  ok(result.releasedReservations === 1, "dependent show reservation was not released");
  ok(result.withdrawnOffers === 1, "pending same-company offer was not withdrawn");
  ok(aggregate.state.contracts.find((contract) => contract.id === contractId)?.status === "TERMINATED", "agreed contract was not terminated");
  ok(!aggregate.planning.showReservations.some((reservation) => reservation.participants.some((entry) => entry.contractId === contractId)), "terminated contract still owns a future reservation");
  ok(
    aggregate.state.contractOffers.find((offer) => offer.id === `test-offer:${contractId}`)?.status === "WITHDRAWN",
    "pending same-company offer remained live after release",
  );
  ok(
    !activeContractsForPromotion(aggregate.state, promotionId).some((contract) => contract.id === contractId),
    "terminated contract still appears on the active promotion roster",
  );

  const championship = aggregate.state.championships?.find((candidate) => (
    candidate.promotionId === promotionId && candidate.division === "SINGLES"
  ));
  const endedReign = aggregate.state.championshipReigns?.find((candidate) => (
    candidate.championshipId === championship?.id && candidate.holderType === "PERSON" && candidate.holderId === personId
  ));
  ok(championship?.currentReignId === null, "released wrestler remained current singles champion");
  ok(endedReign?.status === "ENDED" && endedReign.endReason === "CONTRACT_ENDED", "championship reign was not ended for CONTRACT_ENDED");

  ok(
    aggregate.state.ledger.filter((entry) => entry.type === "STEWARDSHIP_EARLY_RELEASE_EXECUTED" && entry.payload.requestId === requestId).length === 1,
    "release execution was not recorded exactly once",
  );
  const retry = executeAgreedStewardshipRelease(aggregate, requestId);
  ok(retry.alreadyExecuted, "duplicate release execution was not handled idempotently");
  ok(
    aggregate.state.ledger.filter((entry) => entry.type === "STEWARDSHIP_EARLY_RELEASE_EXECUTED" && entry.payload.requestId === requestId).length === 1,
    "duplicate execution wrote a second release event",
  );
});

await test("release execution refuses to break an already materialized committed appearance", () => {
  const fixture = executionFixture(18302);
  const { aggregate, contractId, promotionId, personId, requestId } = fixture;
  aggregate.state.scheduledAppearances.push({
    id: `test-appearance:${contractId}`,
    worldId: aggregate.state.world.id,
    eventId: "test-materialized-event",
    promotionId,
    personId,
    contractId,
    date: { ...aggregate.state.world.currentDate },
    serviceCapacityAtBooking: 1,
    status: "COMMITTED",
  });

  expectThrow(
    () => executeAgreedStewardshipRelease(aggregate, requestId),
    "committed materialized appearances",
  );
  ok(aggregate.state.contracts.find((contract) => contract.id === contractId)?.status === "SIGNED", "blocked execution still terminated the contract");
  ok(aggregate.planning.showReservations.length === 1, "blocked execution released planning state before validation completed");
  ok(
    aggregate.state.ledger.filter((entry) => entry.type === "STEWARDSHIP_EARLY_RELEASE_EXECUTED").length === 0,
    "blocked execution wrote an execution event",
  );

  aggregate.state.scheduledAppearances[aggregate.state.scheduledAppearances.length - 1]!.status = "CANCELLED";
  const released = executeAgreedStewardshipRelease(aggregate, requestId);
  ok(!released.alreadyExecuted, "release did not execute after the committed appearance was cancelled");
});

await test("only a settled Stewardship request can execute a release", () => {
  const fixture = executionFixture(18303);
  if (!fixture.aggregate.engagement) throw new Error("execution fixture lost engagement state");
  fixture.aggregate.engagement.stewardshipExitRequests[0]!.status = "OPEN";
  expectThrow(
    () => executeAgreedStewardshipRelease(fixture.aggregate, fixture.requestId),
    "must be settled",
  );
  ok(fixture.aggregate.state.contracts.find((contract) => contract.id === fixture.contractId)?.status === "SIGNED", "unsettled request terminated its contract");
});

console.log(`\nStewardship release execution tests: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exitCode = 1;
