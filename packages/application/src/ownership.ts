import type { Id, PpwDate, Promotion, WorldState } from "../../domain/src/types.js";
import {
  claimIndependentPromotionForHuman,
  type HumanPromotionClaimOptions,
} from "../../sim-core/src/human-control.js";

export type WorldMembershipStatus = "ACTIVE" | "LEFT";
export type PromotionControlStatus = "ACTIVE" | "ENDED";

export interface WorldMembership {
  worldId: Id;
  playerId: string;
  joinedDate: PpwDate;
  status: WorldMembershipStatus;
}

export interface PromotionControl {
  worldId: Id;
  promotionId: Id;
  playerId: string;
  controlStartDate: PpwDate;
  controlEndDate: PpwDate | null;
  status: PromotionControlStatus;
}

export interface WorldOwnershipState {
  worldId: Id;
  humanSeatLimit: number;
  memberships: WorldMembership[];
  promotionControls: PromotionControl[];
}

function cloneDate(date: PpwDate): PpwDate {
  return { ...date };
}

function validatedPlayerId(playerId: string): string {
  const normalized = playerId.trim();
  if (normalized.length === 0) throw new Error("playerId must not be empty");
  if (normalized.length > 256) throw new Error("playerId must contain at most 256 characters");
  return normalized;
}

export function createWorldOwnershipState(worldId: Id, humanSeatLimit = 1): WorldOwnershipState {
  if (!Number.isInteger(humanSeatLimit) || humanSeatLimit < 1) {
    throw new Error("humanSeatLimit must be a positive integer");
  }
  return {
    worldId,
    humanSeatLimit,
    memberships: [],
    promotionControls: [],
  };
}

export function joinPlayerToWorld(
  ownership: WorldOwnershipState,
  playerId: string,
  joinedDate: PpwDate,
): WorldMembership {
  const normalizedPlayerId = validatedPlayerId(playerId);
  const existing = ownership.memberships.find(
    (membership) => membership.playerId === normalizedPlayerId && membership.status === "ACTIVE",
  );
  if (existing) throw new Error(`${normalizedPlayerId} is already an active member of ${ownership.worldId}`);

  const membership: WorldMembership = {
    worldId: ownership.worldId,
    playerId: normalizedPlayerId,
    joinedDate: cloneDate(joinedDate),
    status: "ACTIVE",
  };
  ownership.memberships.push(membership);
  return membership;
}

export function activeWorldMembership(
  ownership: WorldOwnershipState,
  playerId: string,
): WorldMembership | null {
  const normalizedPlayerId = validatedPlayerId(playerId);
  return ownership.memberships.find(
    (membership) => membership.playerId === normalizedPlayerId && membership.status === "ACTIVE",
  ) ?? null;
}

export function activePromotionControls(ownership: WorldOwnershipState): PromotionControl[] {
  return ownership.promotionControls.filter((control) => control.status === "ACTIVE");
}

export function activePromotionControlForPlayer(
  ownership: WorldOwnershipState,
  playerId: string,
): PromotionControl | null {
  const normalizedPlayerId = validatedPlayerId(playerId);
  return ownership.promotionControls.find(
    (control) => control.playerId === normalizedPlayerId && control.status === "ACTIVE",
  ) ?? null;
}

export function activePromotionControlForPromotion(
  ownership: WorldOwnershipState,
  promotionId: Id,
): PromotionControl | null {
  return ownership.promotionControls.find(
    (control) => control.promotionId === promotionId && control.status === "ACTIVE",
  ) ?? null;
}

export function playerControlsPromotion(
  ownership: WorldOwnershipState,
  playerId: string,
  promotionId: Id,
): boolean {
  const control = activePromotionControlForPlayer(ownership, playerId);
  return control?.promotionId === promotionId;
}

export function claimIndependentPromotionForPlayer(
  state: WorldState,
  ownership: WorldOwnershipState,
  playerId: string,
  promotionId: Id,
  options: HumanPromotionClaimOptions = {},
): Promotion {
  if (ownership.worldId !== state.world.id) {
    throw new Error(`ownership state ${ownership.worldId} does not belong to World ${state.world.id}`);
  }

  const normalizedPlayerId = validatedPlayerId(playerId);
  if (!activeWorldMembership(ownership, normalizedPlayerId)) {
    throw new Error(`${normalizedPlayerId} is not an active member of ${state.world.id}`);
  }
  if (activePromotionControlForPlayer(ownership, normalizedPlayerId)) {
    throw new Error(`${normalizedPlayerId} already controls a promotion in ${state.world.id}`);
  }
  if (activePromotionControlForPromotion(ownership, promotionId)) {
    throw new Error(`${promotionId} already has an active human controller`);
  }
  if (activePromotionControls(ownership).length >= ownership.humanSeatLimit) {
    throw new Error(`${state.world.id} has reached its human seat limit of ${ownership.humanSeatLimit}`);
  }

  const promotion = claimIndependentPromotionForHuman(state, promotionId, options);
  ownership.promotionControls.push({
    worldId: state.world.id,
    promotionId: promotion.id,
    playerId: normalizedPlayerId,
    controlStartDate: cloneDate(state.world.currentDate),
    controlEndDate: null,
    status: "ACTIVE",
  });
  return promotion;
}
