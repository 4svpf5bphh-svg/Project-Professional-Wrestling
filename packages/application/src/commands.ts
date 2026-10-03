import type { ContractOffer, Id, PpwDate, Promotion, WorldState } from "../../domain/src/types.js";
import {
  submitHumanContractOffer,
  type HumanContractOfferPlan,
} from "../../sim-core/src/human-contracts.js";
import type { HumanPromotionClaimOptions } from "../../sim-core/src/human-control.js";
import {
  activeWorldMembership,
  claimIndependentPromotionForPlayer,
  playerControlsPromotion,
  type WorldOwnershipState,
} from "./ownership.js";
import {
  assertWorldOpenForPlayerMutation,
  incrementWorldRevision,
  type WorldRuntimeState,
} from "./runtime.js";

export type ApplicationCommandType =
  | "CLAIM_INDEPENDENT_PROMOTION"
  | "SUBMIT_CONTRACT_OFFER";

export interface ApplicationCommandEnvelope<TPayload> {
  requestId: string;
  worldId: Id;
  playerId: string;
  commandType: ApplicationCommandType;
  payload: TPayload;
}

export interface ApplicationCommandReceipt {
  worldId: Id;
  requestId: string;
  playerId: string;
  commandType: ApplicationCommandType;
  canonicalPayload: string;
  resultJson: string;
  committedDate: PpwDate;
  committedRevision: number;
}

export interface WorldCommandState {
  worldId: Id;
  receipts: ApplicationCommandReceipt[];
}

export interface ClaimIndependentPromotionPayload {
  promotionId: Id;
  options?: HumanPromotionClaimOptions;
}

function cloneDate(date: PpwDate): PpwDate {
  return { ...date };
}

function normalizedBoundedText(value: string, label: string, maxLength: number): string {
  const normalized = value.trim();
  if (normalized.length === 0) throw new Error(`${label} must not be empty`);
  if (normalized.length > maxLength) throw new Error(`${label} must contain at most ${maxLength} characters`);
  return normalized;
}

function canonicalJson(value: unknown, seen: Set<object> = new Set()): string {
  if (value === null) return "null";
  if (typeof value === "string") return JSON.stringify(value);
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new Error("command payload numbers must be finite");
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((entry) => {
      if (entry === undefined) throw new Error("command payload arrays cannot contain undefined");
      return canonicalJson(entry, seen);
    }).join(",")}]`;
  }
  if (typeof value === "object") {
    const object = value as Record<string, unknown>;
    if (seen.has(object)) throw new Error("command payload must not contain cycles");
    seen.add(object);
    const entries = Object.keys(object)
      .filter((key) => object[key] !== undefined)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalJson(object[key], seen)}`);
    seen.delete(object);
    return `{${entries.join(",")}}`;
  }
  throw new Error(`command payload contains unsupported ${typeof value} value`);
}

function cloneResult<TResult>(resultJson: string): TResult {
  return JSON.parse(resultJson) as TResult;
}

export function createWorldCommandState(worldId: Id): WorldCommandState {
  return { worldId, receipts: [] };
}

export function executeIdempotentCommand<TPayload, TResult>(
  commandState: WorldCommandState,
  runtime: WorldRuntimeState,
  envelope: ApplicationCommandEnvelope<TPayload>,
  committedDate: PpwDate,
  execute: () => TResult,
): TResult {
  if (commandState.worldId !== envelope.worldId) {
    throw new Error(`command state ${commandState.worldId} does not belong to World ${envelope.worldId}`);
  }
  if (runtime.worldId !== envelope.worldId) {
    throw new Error(`runtime ${runtime.worldId} does not belong to World ${envelope.worldId}`);
  }

  const requestId = normalizedBoundedText(envelope.requestId, "requestId", 256);
  const playerId = normalizedBoundedText(envelope.playerId, "playerId", 256);
  const canonicalPayload = canonicalJson(envelope.payload);
  const existing = commandState.receipts.find((receipt) => receipt.requestId === requestId);

  if (existing) {
    const sameCommand = existing.worldId === envelope.worldId
      && existing.playerId === playerId
      && existing.commandType === envelope.commandType
      && existing.canonicalPayload === canonicalPayload;
    if (!sameCommand) {
      throw new Error(`requestId ${requestId} has already been used for a different command`);
    }
    return cloneResult<TResult>(existing.resultJson);
  }

  assertWorldOpenForPlayerMutation(runtime);

  const result = execute();
  const resultJson = JSON.stringify(result);
  if (resultJson === undefined) throw new Error("application command result must be JSON-serializable");
  const committedRevision = incrementWorldRevision(runtime);

  commandState.receipts.push({
    worldId: envelope.worldId,
    requestId,
    playerId,
    commandType: envelope.commandType,
    canonicalPayload,
    resultJson,
    committedDate: cloneDate(committedDate),
    committedRevision,
  });

  return cloneResult<TResult>(resultJson);
}

export function claimIndependentPromotionCommand(
  state: WorldState,
  ownership: WorldOwnershipState,
  commandState: WorldCommandState,
  runtime: WorldRuntimeState,
  envelope: ApplicationCommandEnvelope<ClaimIndependentPromotionPayload>,
): Promotion {
  if (envelope.commandType !== "CLAIM_INDEPENDENT_PROMOTION") {
    throw new Error(`expected CLAIM_INDEPENDENT_PROMOTION command, received ${envelope.commandType}`);
  }
  if (envelope.worldId !== state.world.id || ownership.worldId !== state.world.id) {
    throw new Error("promotion-claim command ownership/World mismatch");
  }

  return executeIdempotentCommand(commandState, runtime, envelope, state.world.currentDate, () => (
    claimIndependentPromotionForPlayer(
      state,
      ownership,
      envelope.playerId,
      envelope.payload.promotionId,
      envelope.payload.options ?? {},
    )
  ));
}

export function submitContractOfferCommand(
  state: WorldState,
  ownership: WorldOwnershipState,
  commandState: WorldCommandState,
  runtime: WorldRuntimeState,
  envelope: ApplicationCommandEnvelope<HumanContractOfferPlan>,
): ContractOffer {
  if (envelope.commandType !== "SUBMIT_CONTRACT_OFFER") {
    throw new Error(`expected SUBMIT_CONTRACT_OFFER command, received ${envelope.commandType}`);
  }
  if (envelope.worldId !== state.world.id || ownership.worldId !== state.world.id) {
    throw new Error("contract command ownership/World mismatch");
  }

  return executeIdempotentCommand(commandState, runtime, envelope, state.world.currentDate, () => {
    if (!activeWorldMembership(ownership, envelope.playerId)) {
      throw new Error(`${envelope.playerId} is not an active member of ${state.world.id}`);
    }
    if (!playerControlsPromotion(ownership, envelope.playerId, envelope.payload.promotionId)) {
      throw new Error(`${envelope.playerId} does not control ${envelope.payload.promotionId}`);
    }
    return submitHumanContractOffer(state, envelope.payload);
  });
}
