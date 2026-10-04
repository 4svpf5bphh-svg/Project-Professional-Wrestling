import type { Id } from "../../domain/src/types.js";
import {
  LedgerWriter,
  maintainChampionshipsForWeek,
} from "../../sim-core/src/index.js";
import type { ApplicationWorldAggregate } from "./world-aggregate.js";

const STEWARDSHIP_RELEASE_EXECUTED_LEDGER_TYPE = "STEWARDSHIP_EARLY_RELEASE_EXECUTED";

export interface StewardshipReleaseExecutionResult {
  requestId: string;
  contractId: Id;
  promotionId: Id;
  personId: Id;
  releasedReservations: number;
  withdrawnOffers: number;
  alreadyExecuted: boolean;
}

function normalizedRequestId(value: string): string {
  const normalized = value.trim();
  if (!normalized) throw new Error("requestId must not be empty");
  return normalized;
}

function previousExecution(
  aggregate: ApplicationWorldAggregate,
  requestId: string,
): StewardshipReleaseExecutionResult | null {
  for (let index = aggregate.state.ledger.length - 1; index >= 0; index -= 1) {
    const entry = aggregate.state.ledger[index]!;
    if (entry.type !== STEWARDSHIP_RELEASE_EXECUTED_LEDGER_TYPE) continue;
    if (String(entry.payload.requestId ?? "") !== requestId) continue;
    return {
      requestId,
      contractId: String(entry.payload.contractId ?? entry.entityIds[2] ?? ""),
      promotionId: entry.entityIds[0] ?? "",
      personId: entry.entityIds[1] ?? "",
      releasedReservations: Number(entry.payload.releasedReservations ?? 0),
      withdrawnOffers: Number(entry.payload.withdrawnOffers ?? 0),
      alreadyExecuted: true,
    };
  }
  return null;
}

export function executeAgreedStewardshipRelease(
  aggregate: ApplicationWorldAggregate,
  rawRequestId: string,
): StewardshipReleaseExecutionResult {
  const requestId = normalizedRequestId(rawRequestId);
  const engagement = aggregate.engagement;
  if (!engagement) throw new Error("World has no engagement state");

  const request = engagement.stewardshipExitRequests.find((candidate) => candidate.requestId === requestId);
  if (!request) throw new Error(`unknown Stewardship exit request ${requestId}`);
  if (request.status !== "SETTLED") {
    throw new Error(`Stewardship exit request ${requestId} must be settled before release execution`);
  }

  const prior = previousExecution(aggregate, requestId);
  if (prior) {
    const priorContract = aggregate.state.contracts.find((candidate) => candidate.id === prior.contractId);
    if (!priorContract || priorContract.status !== "TERMINATED") {
      throw new Error("Stewardship release execution history disagrees with contract state");
    }
    return prior;
  }

  const contract = aggregate.state.contracts.find((candidate) => candidate.id === request.contractId);
  if (!contract || contract.status !== "SIGNED") {
    throw new Error("settled Stewardship release no longer has a signed contract to terminate");
  }
  if (contract.promotionId !== request.promotionId || contract.personId !== request.personId) {
    throw new Error("settled Stewardship release does not match its contract");
  }

  const committedAppearances = aggregate.state.scheduledAppearances.filter((appearance) => (
    appearance.contractId === contract.id && appearance.status === "COMMITTED"
  ));
  if (committedAppearances.length > 0) {
    throw new Error("cannot execute Stewardship release while the contract has committed materialized appearances");
  }

  const affectedReservationIds = new Set(
    aggregate.planning.showReservations
      .filter((reservation) => reservation.participants.some((participant) => participant.contractId === contract.id))
      .map((reservation) => reservation.reservationId),
  );
  if (affectedReservationIds.size > 0) {
    aggregate.planning.showReservations = aggregate.planning.showReservations.filter(
      (reservation) => !affectedReservationIds.has(reservation.reservationId),
    );
  }

  let withdrawnOffers = 0;
  for (const offer of aggregate.state.contractOffers) {
    if (
      offer.personId !== contract.personId
      || offer.promotionId !== contract.promotionId
      || offer.status !== "PENDING"
    ) {
      continue;
    }
    offer.status = "WITHDRAWN";
    offer.rejectionReason = "stewardship early release";
    withdrawnOffers += 1;
  }

  contract.status = "TERMINATED";
  maintainChampionshipsForWeek(aggregate.state);

  new LedgerWriter(aggregate.state.world.id, aggregate.state.ledger).append({
    date: aggregate.state.world.currentDate,
    type: STEWARDSHIP_RELEASE_EXECUTED_LEDGER_TYPE,
    significance: "NOTABLE",
    entityIds: [request.promotionId, request.personId, request.contractId],
    payload: {
      requestId,
      contractId: contract.id,
      releasedReservations: affectedReservationIds.size,
      withdrawnOffers,
      settlement: 0,
    },
  });

  return {
    requestId,
    contractId: contract.id,
    promotionId: request.promotionId,
    personId: request.personId,
    releasedReservations: affectedReservationIds.size,
    withdrawnOffers,
    alreadyExecuted: false,
  };
}
