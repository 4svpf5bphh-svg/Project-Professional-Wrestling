import type { ContractOffer, Id, PpwDate, Promotion, Team, WorldState } from "../../domain/src/types.js";
import type { WrestlerAlignment } from "../../domain/src/alignment.js";
import type { WorldPlanningState } from "./planning.js";
import { requestCreativeBookingConsent, type CreativeConsentRecord } from "./creative-consent.js";
import { requestStandingProgrammeCreativeAgreement,
  type StandingProgrammeCreativeAgreement, type StandingProgrammeCreativeRequest } from "./programme-creative-standing.js";
import type { Programme, ProgrammeParticipantRef } from "../../domain/src/programmes.js";
import {
  submitHumanContractOffer,
  submitHumanDatesAddendum,
  type HumanContractOfferPlan,
  type HumanDatesAddendumPlan,
} from "../../sim-core/src/human-contracts.js";
import type { HumanPromotionClaimOptions } from "../../sim-core/src/human-control.js";
import { createProgramme } from "../../sim-core/src/programmes.js";
import { currentRosterPersonIds } from "../../sim-core/src/contracts.js";
import { nextEntityId } from "../../sim-core/src/id-allocator.js";
import { LedgerWriter } from "../../sim-core/src/ledger.js";
import { requireSameWrestlerDivision } from "../../sim-core/src/wrestler-division.js";
import {
  changePromotionWrestlerAlignment,
  type PromotionAlignmentChangeResult,
} from "../../sim-core/src/alignment.js";
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
  | "SUBMIT_CONTRACT_OFFER"
  | "SUBMIT_CONTRACT_DATES_ADDENDUM"
  | "REQUEST_CREATIVE_BOOKING_CONSENT"
  | "REQUEST_STANDING_PROGRAMME_CREATIVE_AGREEMENT"
  | "WITHDRAW_CREATIVE_CARD_AMENDMENT"
  | "PURSUE_TALENT_OPPORTUNITY"
  | "UPSERT_DETAILED_SHOW_DRAFT"
  | "REMOVE_DETAILED_SHOW_DRAFT"
  | "RESERVE_DETAILED_SHOW_DRAFT"
  | "RELEASE_DETAILED_SHOW_RESERVATION"
  | "START_PROGRAMME"
  | "SET_WRESTLER_ALIGNMENT"
  | "CREATE_TAG_TEAM"
  | "CREATE_STABLE"
  | "ADD_STABLE_MEMBER"
  | "REMOVE_STABLE_MEMBER"
  | "DISBAND_STABLE"
  | "UPSERT_PROMOTION_SHOW_SERIES"
  | "ARCHIVE_PROMOTION_SHOW_SERIES"
  | "RESPOND_BACKSTAGE_CONVERSATION"
  | "SET_WRESTLER_CREATIVE_PROFILE";

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

export interface RequestCreativeBookingConsentPayload {
  promotionId: Id;
  draftId: string;
  draftMatchId: string;
  personId: Id;
  expectedPlanVersion: number;
}

export type RequestStandingProgrammeCreativeAgreementPayload = StandingProgrammeCreativeRequest;

export interface StartProgrammePayload {
  promotionId: Id;
  sideA: ProgrammeParticipantRef[];
  sideB: ProgrammeParticipantRef[];
  championshipId?: Id | null;
}

export interface SetWrestlerAlignmentPayload {
  promotionId: Id;
  personId: Id;
  alignment: WrestlerAlignment;
}

export interface CreateTagTeamPayload {
  promotionId: Id;
  name: string;
  personIds: [Id, Id];
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

export function submitContractDatesAddendumCommand(
  state: WorldState,
  ownership: WorldOwnershipState,
  commandState: WorldCommandState,
  runtime: WorldRuntimeState,
  envelope: ApplicationCommandEnvelope<HumanDatesAddendumPlan>,
): ContractOffer {
  if (envelope.commandType !== "SUBMIT_CONTRACT_DATES_ADDENDUM") {
    throw new Error("expected SUBMIT_CONTRACT_DATES_ADDENDUM command");
  }
  if (envelope.worldId !== state.world.id || ownership.worldId !== state.world.id) {
    throw new Error("date-addendum command ownership/World mismatch");
  }
  return executeIdempotentCommand(commandState, runtime, envelope, state.world.currentDate, () => {
    if (!activeWorldMembership(ownership, envelope.playerId)
      || !playerControlsPromotion(ownership, envelope.playerId, envelope.payload.promotionId)) {
      throw new Error("player cannot amend another promotion's signed contract");
    }
    return submitHumanDatesAddendum(state, envelope.payload);
  });
}

/**
 * Explicit pre-lock negotiation command. It never changes any intended winner,
 * finish, booking or match outcome; only the approval evidence is persisted.
 */
export function requestCreativeBookingConsentCommand(
  state: WorldState,
  ownership: WorldOwnershipState,
  planning: WorldPlanningState,
  commandState: WorldCommandState,
  runtime: WorldRuntimeState,
  envelope: ApplicationCommandEnvelope<RequestCreativeBookingConsentPayload>,
): CreativeConsentRecord {
  if (envelope.commandType !== "REQUEST_CREATIVE_BOOKING_CONSENT") {
    throw new Error("expected REQUEST_CREATIVE_BOOKING_CONSENT command");
  }
  if (envelope.worldId !== state.world.id || ownership.worldId !== state.world.id
    || planning.worldId !== state.world.id) {
    throw new Error("creative consent command World boundary mismatch");
  }
  return executeIdempotentCommand(commandState, runtime, envelope, state.world.currentDate, () => {
    if (!activeWorldMembership(ownership, envelope.playerId)
      || !playerControlsPromotion(ownership, envelope.playerId, envelope.payload.promotionId)) {
      throw new Error("player cannot request creative consent for another promotion");
    }
    return requestCreativeBookingConsent(state, planning, envelope.payload);
  });
}

/**
 * Server-authoritative, player-owned and idempotent negotiation for a narrow
 * future Programme arc. This does not auto-book or change any scripted match.
 */
export function requestStandingProgrammeCreativeAgreementCommand(
  state: WorldState,
  ownership: WorldOwnershipState,
  planning: WorldPlanningState,
  commandState: WorldCommandState,
  runtime: WorldRuntimeState,
  envelope: ApplicationCommandEnvelope<RequestStandingProgrammeCreativeAgreementPayload>,
): StandingProgrammeCreativeAgreement {
  if (envelope.commandType !== "REQUEST_STANDING_PROGRAMME_CREATIVE_AGREEMENT") {
    throw new Error("expected REQUEST_STANDING_PROGRAMME_CREATIVE_AGREEMENT command");
  }
  if (envelope.worldId !== state.world.id || ownership.worldId !== state.world.id
    || planning.worldId !== state.world.id) {
    throw new Error("standing Programme consent command World mismatch");
  }
  return executeIdempotentCommand(commandState, runtime, envelope, state.world.currentDate, () => {
    if (!activeWorldMembership(ownership, envelope.playerId)
      || !playerControlsPromotion(ownership, envelope.playerId, envelope.payload.promotionId)) {
      throw new Error("player cannot negotiate a different promotion's Programme");
    }
    return requestStandingProgrammeCreativeAgreement(state, planning, envelope.payload);
  });
}

export function startProgrammeCommand(
  state: WorldState,
  ownership: WorldOwnershipState,
  commandState: WorldCommandState,
  runtime: WorldRuntimeState,
  envelope: ApplicationCommandEnvelope<StartProgrammePayload>,
): Programme {
  if (envelope.commandType !== "START_PROGRAMME") {
    throw new Error(`expected START_PROGRAMME command, received ${envelope.commandType}`);
  }
  if (envelope.worldId !== state.world.id || ownership.worldId !== state.world.id) {
    throw new Error("Programme command ownership/World mismatch");
  }

  return executeIdempotentCommand(commandState, runtime, envelope, state.world.currentDate, () => {
    if (!activeWorldMembership(ownership, envelope.playerId)) {
      throw new Error(`${envelope.playerId} is not an active member of ${state.world.id}`);
    }
    if (!playerControlsPromotion(ownership, envelope.playerId, envelope.payload.promotionId)) {
      throw new Error(`${envelope.playerId} does not control ${envelope.payload.promotionId}`);
    }
    return createProgramme(state, {
      promotionId: envelope.payload.promotionId,
      sideA: structuredClone(envelope.payload.sideA),
      sideB: structuredClone(envelope.payload.sideB),
      championshipId: envelope.payload.championshipId ?? null,
    });
  });
}

export function setWrestlerAlignmentCommand(
  state: WorldState,
  ownership: WorldOwnershipState,
  commandState: WorldCommandState,
  runtime: WorldRuntimeState,
  envelope: ApplicationCommandEnvelope<SetWrestlerAlignmentPayload>,
): PromotionAlignmentChangeResult {
  if (envelope.commandType !== "SET_WRESTLER_ALIGNMENT") {
    throw new Error(`expected SET_WRESTLER_ALIGNMENT command, received ${envelope.commandType}`);
  }
  if (envelope.worldId !== state.world.id || ownership.worldId !== state.world.id) {
    throw new Error("alignment command ownership/World mismatch");
  }

  return executeIdempotentCommand(commandState, runtime, envelope, state.world.currentDate, () => {
    if (!activeWorldMembership(ownership, envelope.playerId)) {
      throw new Error(`${envelope.playerId} is not an active member of ${state.world.id}`);
    }
    if (!playerControlsPromotion(ownership, envelope.playerId, envelope.payload.promotionId)) {
      throw new Error(`${envelope.playerId} does not control ${envelope.payload.promotionId}`);
    }
    if (!currentRosterPersonIds(state, envelope.payload.promotionId).includes(envelope.payload.personId)) {
      throw new Error("only a wrestler on your current roster can have a promotion alignment");
    }
    return changePromotionWrestlerAlignment(
      state,
      envelope.payload.promotionId,
      envelope.payload.personId,
      envelope.payload.alignment,
    );
  });
}


export function createTagTeamCommand(
  state: WorldState,
  ownership: WorldOwnershipState,
  commandState: WorldCommandState,
  runtime: WorldRuntimeState,
  envelope: ApplicationCommandEnvelope<CreateTagTeamPayload>,
): Team {
  if (envelope.commandType !== "CREATE_TAG_TEAM") {
    throw new Error(`expected CREATE_TAG_TEAM command, received ${envelope.commandType}`);
  }
  if (envelope.worldId !== state.world.id || ownership.worldId !== state.world.id) {
    throw new Error("tag-team command ownership/World mismatch");
  }

  return executeIdempotentCommand(commandState, runtime, envelope, state.world.currentDate, () => {
    if (!activeWorldMembership(ownership, envelope.playerId)) {
      throw new Error(`${envelope.playerId} is not an active member of ${state.world.id}`);
    }
    if (!playerControlsPromotion(ownership, envelope.playerId, envelope.payload.promotionId)) {
      throw new Error(`${envelope.playerId} does not control ${envelope.payload.promotionId}`);
    }

    const name = normalizedBoundedText(envelope.payload.name, "team name", 60);
    const personIds = [...envelope.payload.personIds].map((personId) => (
      normalizedBoundedText(personId, "team wrestler", 128)
    ));
    if (personIds.length !== 2 || new Set(personIds).size !== 2) {
      throw new Error("a tag team requires exactly two different wrestlers");
    }

    const rosterIds = new Set(currentRosterPersonIds(state, envelope.payload.promotionId));
    const teamPeople = personIds.map((personId) => {
      if (!rosterIds.has(personId)) throw new Error("both tag-team members must be on your current roster");
      const person = state.people.find((candidate) => candidate.id === personId);
      if (!person || person.status === "RETIRED") throw new Error("tag-team members must be active wrestlers");
      return person;
    });
    requireSameWrestlerDivision(
      teamPeople,
      "tag teams cannot mix men's and women's divisions",
    );

    const normalizedName = name.toLocaleLowerCase("en-GB");
    if ((state.teams ?? []).some((team) => (
      team.status === "ACTIVE"
      && team.name.trim().toLocaleLowerCase("en-GB") === normalizedName
    ))) {
      throw new Error("an active tag team already uses that name");
    }

    const pair = [...personIds].sort();
    const duplicatePair = (state.teams ?? []).find((team) => {
      if (team.status !== "ACTIVE") return false;
      const members = (state.teamMemberships ?? [])
        .filter((membership) => membership.teamId === team.id && membership.active && membership.leftDate === null)
        .map((membership) => membership.personId)
        .sort();
      return members.length === 2 && members[0] === pair[0] && members[1] === pair[1];
    });
    if (duplicatePair) throw new Error(`these wrestlers already form the active team ${duplicatePair.name}`);

    const team: Team = {
      id: nextEntityId(state, "team"),
      worldId: state.world.id,
      name,
      status: "ACTIVE",
      formedDate: { ...state.world.currentDate },
      disbandedDate: null,
    };
    state.teams ??= [];
    state.teamMemberships ??= [];
    state.teams.push(team);
    for (const personId of personIds) {
      state.teamMemberships.push({
        id: nextEntityId(state, "teamMembership"),
        worldId: state.world.id,
        teamId: team.id,
        personId,
        joinedDate: { ...state.world.currentDate },
        leftDate: null,
        active: true,
      });
    }

    new LedgerWriter(state.world.id, state.ledger).append({
      date: state.world.currentDate,
      type: "TEAM_FORMED",
      significance: "ROUTINE",
      entityIds: [team.id, envelope.payload.promotionId, ...personIds],
      payload: {
        name: team.name,
        promotionId: envelope.payload.promotionId,
        personIds: personIds.join(","),
      },
    });

    return structuredClone(team);
  });
}
