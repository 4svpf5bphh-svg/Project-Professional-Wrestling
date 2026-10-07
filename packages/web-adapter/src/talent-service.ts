import type {
  ContractFamily,
  ContractOffer,
  RoleExpectation,
} from "../../domain/src/types.js";
import type { WrestlerAlignment } from "../../domain/src/alignment.js";
import {
  addPpwWeeks,
  contractIsActive,
  ppwDateToWeekIndex,
  weeksBetween,
} from "../../sim-core/src/index.js";
import {
  activePromotionControlForPlayer,
  buildPlayerTalentManagementView,
  setWrestlerAlignmentCommand,
  submitContractOfferCommand,
  type ApplicationWorldAggregate,
  type ApplicationWorldRepository,
  type PlayerTalentManagementView,
} from "../../application/src/index.js";

const CONTRACT_FAMILIES = new Set<ContractFamily>(["ONE_OFF", "LIMITED_NON_EXCLUSIVE", "EXCLUSIVE"]);
const ROLES = new Set<RoleExpectation>([
  "MAIN_EVENT",
  "UPPER_CARD",
  "FEATURED",
  "REGULAR",
  "DEVELOPMENTAL",
  "SPECIAL_ATTRACTION",
]);

export interface AlphaTalentOfferRequest {
  requestId: string;
  personId: string;
  sourceContractId?: string | null;
  family: ContractFamily;
  roleExpectation: RoleExpectation;
  termWeeks: number;
  dateEntitlement: number;
  weeklyGuarantee: number;
  appearanceFee: number;
  signingBonus: number;
}

export interface AlphaTalentOfferResult {
  offerId: string;
  offerKind: "RECRUITMENT" | "RENEWAL";
  view: PlayerTalentManagementView;
}

export interface AlphaRosterAlignmentRequest {
  requestId: string;
  personId: string;
  alignment: WrestlerAlignment;
}

export interface AlphaRosterAlignmentResult {
  personId: string;
  alignment: WrestlerAlignment;
  changeMode: "INITIAL_PRESENTATION" | "JUST_SIGNED" | "RETURNING" | "OFFSCREEN_SWITCH";
  naturalReset: boolean;
  view: PlayerTalentManagementView;
}

function boundedText(value: string, label: string, maxLength = 256): string {
  const normalized = value.trim();
  if (!normalized) throw new Error(`${label} must not be empty`);
  if (normalized.length > maxLength) throw new Error(`${label} is too long`);
  return normalized;
}

function nonNegativeInteger(value: number, label: string, max = 1_000_000_000): number {
  if (!Number.isSafeInteger(value) || value < 0 || value > max) {
    throw new Error(`${label} must be an integer from 0 to ${max}`);
  }
  return value;
}

function validateRequestShape(request: AlphaTalentOfferRequest): void {
  if (!CONTRACT_FAMILIES.has(request.family)) throw new Error("unsupported contract family");
  if (!ROLES.has(request.roleExpectation)) throw new Error("unsupported role expectation");
  nonNegativeInteger(request.dateEntitlement, "date entitlement", 104);
  if (request.dateEntitlement < 1) throw new Error("date entitlement must contain at least one date");
  nonNegativeInteger(request.weeklyGuarantee, "weekly guarantee");
  nonNegativeInteger(request.appearanceFee, "appearance fee");
  nonNegativeInteger(request.signingBonus, "signing bonus");

  if (request.family === "ONE_OFF") {
    if (request.termWeeks !== 1) throw new Error("one-off offer must be one PPW week");
    if (request.dateEntitlement !== 1) throw new Error("one-off offer must contain exactly one date");
    if (request.weeklyGuarantee !== 0) throw new Error("one-off offer cannot contain a weekly guarantee");
    return;
  }

  const allowedTerms = request.family === "EXCLUSIVE" ? [13, 26, 52] : [4, 13, 26];
  if (!allowedTerms.includes(request.termWeeks)) {
    throw new Error(`${request.family === "EXCLUSIVE" ? "exclusive" : "limited non-exclusive"} term must be ${allowedTerms.join(", ")} PPW weeks`);
  }
  if (request.dateEntitlement > request.termWeeks * 2) {
    throw new Error("date entitlement exceeds the contract term's service-capacity guardrail");
  }
}

function replayPlanFromOffer(offer: ContractOffer) {
  return {
    promotionId: offer.promotionId,
    personId: offer.personId,
    family: offer.family,
    exclusivity: offer.exclusivity,
    roleExpectation: offer.roleExpectation,
    startDate: { ...offer.startDate },
    endDate: { ...offer.endDate },
    dateEntitlement: offer.dateEntitlement,
    weeklyGuarantee: offer.weeklyGuarantee,
    appearanceFee: offer.appearanceFee,
    signingBonus: offer.signingBonus,
  };
}

function requestMatchesOffer(
  aggregate: ApplicationWorldAggregate,
  request: AlphaTalentOfferRequest,
  offer: ContractOffer,
): boolean {
  const termWeeks = weeksBetween(offer.startDate, offer.endDate, aggregate.state.ruleset.weeksPerYear) + 1;
  return offer.personId === request.personId
    && offer.family === request.family
    && offer.roleExpectation === request.roleExpectation
    && termWeeks === request.termWeeks
    && offer.dateEntitlement === request.dateEntitlement
    && offer.weeklyGuarantee === request.weeklyGuarantee
    && offer.appearanceFee === request.appearanceFee
    && offer.signingBonus === request.signingBonus;
}

function buildFreshPlan(
  aggregate: ApplicationWorldAggregate,
  promotionId: string,
  request: AlphaTalentOfferRequest,
) {
  const state = aggregate.state;
  const personId = boundedText(request.personId, "personId");
  const person = state.people.find((candidate) => candidate.id === personId);
  if (!person) throw new Error(`unknown wrestler ${personId}`);

  let startDate = { ...state.world.currentDate };
  const sourceContractId = request.sourceContractId?.trim() || null;
  if (sourceContractId) {
    const source = state.contracts.find((contract) => contract.id === sourceContractId);
    if (!source || source.promotionId !== promotionId || source.personId !== personId) {
      throw new Error("renewal source contract does not belong to this promotion/wrestler");
    }
    if (source.status !== "SIGNED" || !contractIsActive(state, source)) {
      throw new Error("only an active signed contract can be renewed");
    }
    const currentIndex = ppwDateToWeekIndex(state.world.currentDate, state.ruleset.weeksPerYear);
    const endIndex = ppwDateToWeekIndex(source.endDate, state.ruleset.weeksPerYear);
    if (endIndex - currentIndex > state.ruleset.renewalWindowWeeks) {
      throw new Error("renewal window is not open for this contract yet");
    }
    startDate = addPpwWeeks(source.endDate, 1, state.ruleset.weeksPerYear);
  } else {
    const alreadyOurs = state.contracts.some((contract) => (
      contract.promotionId === promotionId
      && contract.personId === personId
      && contractIsActive(state, contract)
    ));
    if (alreadyOurs) throw new Error("wrestler is already on your active roster; use the renewal action");
  }

  const exclusivity = request.family === "ONE_OFF" ? "OPEN"
    : request.family === "EXCLUSIVE" ? "EXCLUSIVE"
      : "NON_EXCLUSIVE";
  const endDate = addPpwWeeks(startDate, request.termWeeks - 1, state.ruleset.weeksPerYear);

  return {
    promotionId,
    personId,
    family: request.family,
    exclusivity,
    roleExpectation: request.roleExpectation,
    startDate,
    endDate,
    dateEntitlement: request.dateEntitlement,
    weeklyGuarantee: request.weeklyGuarantee,
    appearanceFee: request.appearanceFee,
    signingBonus: request.signingBonus,
  } as const;
}

export async function loadAlphaTalentSession(
  repository: ApplicationWorldRepository,
  worldId: string,
  playerId: string,
): Promise<PlayerTalentManagementView> {
  return buildPlayerTalentManagementView(await repository.load(worldId), playerId);
}

export async function submitAlphaTalentOffer(
  repository: ApplicationWorldRepository,
  worldId: string,
  playerId: string,
  rawRequest: AlphaTalentOfferRequest,
): Promise<AlphaTalentOfferResult> {
  const request: AlphaTalentOfferRequest = {
    ...rawRequest,
    requestId: boundedText(rawRequest.requestId, "requestId"),
    personId: boundedText(rawRequest.personId, "personId"),
    sourceContractId: rawRequest.sourceContractId?.trim() || null,
  };
  validateRequestShape(request);

  const transaction = await repository.transact(worldId, null, (aggregate) => {
    const control = activePromotionControlForPlayer(aggregate.ownership, playerId);
    if (!control) throw new Error("player must control a promotion before submitting contract offers");

    const receipt = aggregate.commands.receipts.find((candidate) => candidate.requestId === request.requestId);
    let plan;
    if (receipt) {
      if (receipt.commandType !== "SUBMIT_CONTRACT_OFFER" || receipt.playerId !== playerId) {
        throw new Error(`requestId ${request.requestId} has already been used for a different command`);
      }
      const priorOffer = JSON.parse(receipt.resultJson) as ContractOffer;
      if (!requestMatchesOffer(aggregate, request, priorOffer)) {
        throw new Error(`requestId ${request.requestId} has already been used for different contract terms`);
      }
      plan = replayPlanFromOffer(priorOffer);
    } else {
      plan = buildFreshPlan(aggregate, control.promotionId, request);
    }

    const offer = submitContractOfferCommand(
      aggregate.state,
      aggregate.ownership,
      aggregate.commands,
      aggregate.runtime,
      {
        requestId: request.requestId,
        worldId,
        playerId,
        commandType: "SUBMIT_CONTRACT_OFFER",
        payload: plan,
      },
    );

    return {
      offerId: offer.id,
      offerKind: offer.offerKind,
      view: buildPlayerTalentManagementView(aggregate, playerId),
    } satisfies AlphaTalentOfferResult;
  });

  return transaction.result;
}

export async function setAlphaRosterAlignment(
  repository: ApplicationWorldRepository,
  worldId: string,
  playerId: string,
  rawRequest: AlphaRosterAlignmentRequest,
): Promise<AlphaRosterAlignmentResult> {
  const request: AlphaRosterAlignmentRequest = {
    requestId: boundedText(rawRequest.requestId, "requestId"),
    personId: boundedText(rawRequest.personId, "personId"),
    alignment: rawRequest.alignment,
  };
  if (!["FACE", "HEEL", "TWEENER"].includes(request.alignment)) {
    throw new Error("unsupported wrestler alignment");
  }

  const transaction = await repository.transact(worldId, null, (aggregate) => {
    const control = activePromotionControlForPlayer(aggregate.ownership, playerId);
    if (!control) throw new Error("player must control a promotion before changing roster alignment");

    const change = setWrestlerAlignmentCommand(
      aggregate.state,
      aggregate.ownership,
      aggregate.commands,
      aggregate.runtime,
      {
        requestId: request.requestId,
        worldId,
        playerId,
        commandType: "SET_WRESTLER_ALIGNMENT",
        payload: {
          promotionId: control.promotionId,
          personId: request.personId,
          alignment: request.alignment,
        },
      },
    );

    return {
      personId: request.personId,
      alignment: change.alignment,
      changeMode: change.method as AlphaRosterAlignmentResult["changeMode"],
      naturalReset: change.method !== "OFFSCREEN_SWITCH",
      view: buildPlayerTalentManagementView(aggregate, playerId),
    } satisfies AlphaRosterAlignmentResult;
  });

  return transaction.result;
}
