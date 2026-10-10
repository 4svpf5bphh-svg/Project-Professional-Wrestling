import type { Id, Stable, StableMembership, WorldState } from "../../domain/src/types.js";
import { currentRosterPersonIds } from "../../sim-core/src/contracts.js";
import { nextEntityId } from "../../sim-core/src/id-allocator.js";
import { LedgerWriter } from "../../sim-core/src/ledger.js";
import {
  executeIdempotentCommand, type ApplicationCommandEnvelope,
  type WorldCommandState,
} from "./commands.js";
import { activeWorldMembership, playerControlsPromotion, type WorldOwnershipState } from "./ownership.js";
import type { WorldRuntimeState } from "./runtime.js";

export interface CreateStablePayload {
  promotionId: Id;
  name: string;
  personIds: Id[];
}
export interface ChangeStableMemberPayload {
  promotionId: Id;
  stableId: Id;
  personId: Id;
}
export interface DisbandStablePayload {
  promotionId: Id;
  stableId: Id;
}

function requireControl(state: WorldState, ownership: WorldOwnershipState, envelope: ApplicationCommandEnvelope<unknown>, promotionId: Id): void {
  if (state.world.id !== envelope.worldId || ownership.worldId !== state.world.id) throw new Error("stable World boundary mismatch");
  if (!activeWorldMembership(ownership, envelope.playerId)) throw new Error("player is not an active World member");
  if (!playerControlsPromotion(ownership, envelope.playerId, promotionId)) throw new Error("you do not control this promotion");
}
function activeStable(state: WorldState, promotionId: Id, stableId: Id): Stable {
  const stable = (state.stables ?? []).find((entry) => entry.id === stableId && entry.promotionId === promotionId);
  if (!stable || stable.status !== "ACTIVE") throw new Error("stable is not active in your promotion");
  return stable;
}
function validatePerson(state: WorldState, promotionId: Id, personId: string): void {
  if (!currentRosterPersonIds(state, promotionId).includes(personId)) throw new Error("stable member must be on your current roster");
  const person = state.people.find((entry) => entry.id === personId);
  if (!person || person.status !== "ACTIVE") throw new Error("stable member must be an active wrestler");
}
function ensureNotElsewhere(state: WorldState, promotionId: Id, personId: Id): void {
  const other = (state.stables ?? []).filter((stable) => stable.promotionId === promotionId && stable.status === "ACTIVE");
  if ((state.stableMemberships ?? []).some((member) =>
    member.personId === personId && member.active && other.some((stable) => stable.id === member.stableId))) {
    throw new Error("wrestler already belongs to an active stable in this promotion");
  }
}
function addMembership(state: WorldState, stableId: Id, personId: Id): void {
  state.stableMemberships ??= [];
  state.stableMemberships.push({
    id: nextEntityId(state, "stableMembership"), worldId: state.world.id,
    stableId, personId, joinedDate: { ...state.world.currentDate },
    leftDate: null, active: true,
  });
}
function log(state: WorldState, type: string, stable: Stable, people: string[], payload: Record<string, string | number | boolean | null> = {}): void {
  new LedgerWriter(state.world.id, state.ledger).append({
    date: state.world.currentDate, type, significance: "ROUTINE",
    entityIds: [stable.id, stable.promotionId, ...people],
    payload: { stableId: stable.id, promotionId: stable.promotionId, name: stable.name, ...payload },
  });
}

export function createStableCommand(
  state: WorldState, ownership: WorldOwnershipState, commands: WorldCommandState,
  runtime: WorldRuntimeState, envelope: ApplicationCommandEnvelope<CreateStablePayload>,
): Stable {
  if (envelope.commandType !== "CREATE_STABLE") throw new Error("incorrect stable creation command");
  return executeIdempotentCommand(commands, runtime, envelope, state.world.currentDate, () => {
    const { promotionId, personIds } = envelope.payload;
    requireControl(state, ownership, envelope, promotionId);
    const name = envelope.payload.name.trim();
    if (!name || name.length > 60) throw new Error("stable name must be 1–60 characters");
    if (personIds.length < 3 || personIds.length > 12 || new Set(personIds).size !== personIds.length) {
      throw new Error("a new stable requires 3–12 distinct wrestlers");
    }
    if ((state.stables ?? []).some((stable) =>
      stable.status === "ACTIVE" && stable.promotionId === promotionId
      && stable.name.trim().toLocaleLowerCase("en-GB") === name.toLocaleLowerCase("en-GB"))) {
      throw new Error("an active stable in your promotion already has that name");
    }
    for (const personId of personIds) {
      validatePerson(state, promotionId, personId);
      ensureNotElsewhere(state, promotionId, personId);
    }
    const stable: Stable = {
      id: nextEntityId(state, "stable"), worldId: state.world.id, promotionId,
      name, status: "ACTIVE", formedDate: { ...state.world.currentDate }, disbandedDate: null,
    };
    state.stables ??= [];
    state.stables.push(stable);
    for (const personId of personIds) addMembership(state, stable.id, personId);
    log(state, "STABLE_FORMED", stable, personIds, { memberCount: personIds.length });
    return structuredClone(stable);
  });
}

export function addStableMemberCommand(
  state: WorldState, ownership: WorldOwnershipState, commands: WorldCommandState,
  runtime: WorldRuntimeState, envelope: ApplicationCommandEnvelope<ChangeStableMemberPayload>,
): StableMembership {
  if (envelope.commandType !== "ADD_STABLE_MEMBER") throw new Error("incorrect stable membership command");
  return executeIdempotentCommand(commands, runtime, envelope, state.world.currentDate, () => {
    const { promotionId, stableId, personId } = envelope.payload;
    requireControl(state, ownership, envelope, promotionId);
    const stable = activeStable(state, promotionId, stableId);
    const active = (state.stableMemberships ?? []).filter((member) => member.stableId === stableId && member.active);
    if (active.length >= 12) throw new Error("a stable cannot have more than 12 active members");
    validatePerson(state, promotionId, personId);
    ensureNotElsewhere(state, promotionId, personId);
    addMembership(state, stable.id, personId);
    log(state, "STABLE_MEMBER_JOINED", stable, [personId]);
    return structuredClone(state.stableMemberships!.at(-1)!);
  });
}

export function removeStableMemberCommand(
  state: WorldState, ownership: WorldOwnershipState, commands: WorldCommandState,
  runtime: WorldRuntimeState, envelope: ApplicationCommandEnvelope<ChangeStableMemberPayload>,
): StableMembership {
  if (envelope.commandType !== "REMOVE_STABLE_MEMBER") throw new Error("incorrect stable membership command");
  return executeIdempotentCommand(commands, runtime, envelope, state.world.currentDate, () => {
    const { promotionId, stableId, personId } = envelope.payload;
    requireControl(state, ownership, envelope, promotionId);
    const stable = activeStable(state, promotionId, stableId);
    const membership = (state.stableMemberships ?? []).find((entry) =>
      entry.stableId === stable.id && entry.personId === personId && entry.active);
    if (!membership) throw new Error("wrestler is not an active member of this stable");
    membership.active = false;
    membership.leftDate = { ...state.world.currentDate };
    log(state, "STABLE_MEMBER_LEFT", stable, [personId]);
    return structuredClone(membership);
  });
}

export function disbandStableCommand(
  state: WorldState, ownership: WorldOwnershipState, commands: WorldCommandState,
  runtime: WorldRuntimeState, envelope: ApplicationCommandEnvelope<DisbandStablePayload>,
): Stable {
  if (envelope.commandType !== "DISBAND_STABLE") throw new Error("incorrect stable disband command");
  return executeIdempotentCommand(commands, runtime, envelope, state.world.currentDate, () => {
    const { promotionId, stableId } = envelope.payload;
    requireControl(state, ownership, envelope, promotionId);
    const stable = activeStable(state, promotionId, stableId);
    const formerMembers: Id[] = [];
    for (const member of state.stableMemberships ?? []) {
      if (member.stableId !== stable.id || !member.active) continue;
      formerMembers.push(member.personId);
      member.active = false;
      member.leftDate = { ...state.world.currentDate };
    }
    stable.status = "DISBANDED";
    stable.disbandedDate = { ...state.world.currentDate };
    log(state, "STABLE_DISBANDED", stable, formerMembers, { memberCount: formerMembers.length });
    return structuredClone(stable);
  });
}
