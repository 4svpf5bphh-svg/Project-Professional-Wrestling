import type {
  ContractFamily,
  ContractOffer,
  CreativeControlLevel,
  RoleExpectation,
} from "../../domain/src/types.js";
import type { WrestlerAlignment } from "../../domain/src/alignment.js";
import {
  addPpwWeeks,
  contractIsActive,
  ppwDateToWeekIndex,
  promotionShowSeriesDueForDate,
  weeksBetween,
  resolvedCreativeControl,
  validCreativeControl,
} from "../../sim-core/src/index.js";
import {
  activePromotionControlForPlayer,
  activeWorldMembership,
  DETAILED_PLANNING_HORIZON_WEEKS,
  buildPlayerTalentDirectoryView,
  buildPlayerTalentManagementView,
  createWorldEngagementState,
  setTalentWatched,
  setWrestlerAlignmentCommand,
  submitContractOfferCommand,
  submitContractDatesAddendumCommand,
  type ApplicationWorldAggregate,
  type ApplicationWorldRepository,
  type PlayerTalentDirectoryView,
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
  /** Optional for older clients; default is no creative control. */
  creativeControl?: CreativeControlLevel;
  termWeeks: number;
  dateEntitlement: number;
  weeklyGuarantee: number;
  appearanceFee: number;
  signingBonus: number;
}

export interface AlphaDatesAddendumRequest {
  requestId: string;
  personId: string;
  contractId: string;
  additionalDates: number;
  additionalPayment: number;
}

export interface AlphaDatesAddendumResult {
  offerId: string;
  offerKind: "DATES_ADDENDUM";
  view: PlayerTalentManagementView;
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


export interface AlphaTalentWatchRequest {
  personId: string;
  watched: boolean;
}

export interface AlphaTalentWatchResult {
  personId: string;
  watched: boolean;
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
  if (request.creativeControl !== undefined && !validCreativeControl(request.creativeControl)) {
    throw new Error("unsupported creative control clause");
  }
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
    sourceContractId: offer.sourceContractId ?? null,
    family: offer.family,
    exclusivity: offer.exclusivity,
    roleExpectation: offer.roleExpectation,
    creativeControl: resolvedCreativeControl(offer.creativeControl),
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
    && (offer.sourceContractId ?? null) === (request.sourceContractId ?? null)
    && offer.family === request.family
    && offer.roleExpectation === request.roleExpectation
    && resolvedCreativeControl(offer.creativeControl) === resolvedCreativeControl(request.creativeControl)
    && termWeeks === request.termWeeks
    // An exclusive's dateEntitlement is a legacy transport field, not a
    // purchased-date cap. Fresh offers canonicalise it to the contract term;
    // retries must compare the same effective terms even for older callers.
    && offer.dateEntitlement === (request.family === "EXCLUSIVE" ? request.termWeeks : request.dateEntitlement)
    && offer.weeklyGuarantee === request.weeklyGuarantee
    && offer.appearanceFee === request.appearanceFee
    && offer.signingBonus === request.signingBonus;
}

export function buildFreshPlan(
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
    const datesExhausted = source.family === "LIMITED_NON_EXCLUSIVE" && source.datesUsed >= source.dateEntitlement;
    if (!datesExhausted && endIndex - currentIndex > state.ruleset.renewalWindowWeeks) {
      throw new Error("renewal window is not open for this contract yet");
    }
    startDate = datesExhausted
      ? { ...state.world.currentDate }
      : addPpwWeeks(source.endDate, 1, state.ruleset.weeksPerYear);
  } else {
    const alreadyOurs = state.contracts.some((contract) => (
      contract.promotionId === promotionId
      && contract.personId === personId
      && contractIsActive(state, contract)
    ));
    if (alreadyOurs) throw new Error("wrestler is already on your active roster; use the renewal action");
  }

  // New multiweek player agreements are accepted during World Resolution,
  // after the submission week's player show is already locked. Starting and
  // charging them in that week costs a week of guaranteed salary without a
  // player-bookable week of service. Leave future renewals after the signed
  // source term untouched, and retain the one-off's show-aware scheduling.
  if (request.family !== "ONE_OFF"
    && ppwDateToWeekIndex(startDate, state.ruleset.weeksPerYear)
      <= ppwDateToWeekIndex(state.world.currentDate, state.ruleset.weeksPerYear)) {
    startDate = { ...addPpwWeeks(state.world.currentDate, 1, state.ruleset.weeksPerYear), day: 1 };
  }

  // An accepted human one-off becomes bookable only after World Resolution,
  // not in the offer week. Align its single week with a real scheduled show,
  // otherwise a biweekly/irregular promotion can buy an unusable date.
  // Do not reserve speculative one-offs beyond the six-week player planner.
  if (request.family === "ONE_OFF") {
    const currentWeek = ppwDateToWeekIndex(state.world.currentDate, state.ruleset.weeksPerYear);
    const earliestWeek = Math.max(currentWeek + 1, ppwDateToWeekIndex(startDate, state.ruleset.weeksPerYear));
    let showDate: typeof startDate | null = null;
    for (let offset = earliestWeek - currentWeek; offset <= DETAILED_PLANNING_HORIZON_WEEKS; offset += 1) {
      const candidate = addPpwWeeks(state.world.currentDate, offset, state.ruleset.weeksPerYear);
      if (promotionShowSeriesDueForDate(state, promotionId, candidate).length > 0) {
        showDate = { ...candidate, day: 1 };
        break;
      }
    }
    if (!showDate) {
      throw new Error(
        `No scheduled promotion show within the next ${DETAILED_PLANNING_HORIZON_WEEKS} PPW weeks `
        + "after this offer can take effect. Arrange a show or negotiate closer to the next event.",
      );
    }
    // Exact-day reservation checks require the entire show week. This is
    // still ONE purchased appearance, not seven separate dates.
    startDate = showDate;
  }

  const exclusivity = request.family === "ONE_OFF" ? "OPEN"
    : request.family === "EXCLUSIVE" ? "EXCLUSIVE"
      : "NON_EXCLUSIVE";
  const endDate = request.family === "ONE_OFF"
    ? { ...startDate, day: 7 }
    : addPpwWeeks(startDate, request.termWeeks - 1, state.ruleset.weeksPerYear);

  return {
    promotionId,
    personId,
    sourceContractId,
    family: request.family,
    exclusivity,
    roleExpectation: request.roleExpectation,
    creativeControl: resolvedCreativeControl(request.creativeControl),
    startDate,
    endDate,
    dateEntitlement: request.family === "EXCLUSIVE" ? request.termWeeks : request.dateEntitlement,
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


export async function loadAlphaTalentDirectorySession(
  repository: ApplicationWorldRepository,
  worldId: string,
  playerId: string,
): Promise<PlayerTalentDirectoryView> {
  return buildPlayerTalentDirectoryView(await repository.load(worldId), playerId);
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

    // This endpoint only creates full recruitment / renewal offers.
    // Dates addenda use their dedicated same-contract endpoint.
    if (offer.offerKind === "DATES_ADDENDUM") throw new Error("unexpected additional-dates offer type");
    return {
      offerId: offer.id,
      offerKind: offer.offerKind,
      view: buildPlayerTalentManagementView(aggregate, playerId),
    } satisfies AlphaTalentOfferResult;
  });

  return transaction.result;
}

/** Submits a consensual addendum through the same authoritative World command queue. */
export async function submitAlphaDatesAddendum(
  repository: ApplicationWorldRepository,
  worldId: string,
  playerId: string,
  rawRequest: AlphaDatesAddendumRequest,
): Promise<AlphaDatesAddendumResult> {
  const request: AlphaDatesAddendumRequest = {
    requestId: boundedText(rawRequest.requestId, "requestId"),
    personId: boundedText(rawRequest.personId, "personId"),
    contractId: boundedText(rawRequest.contractId, "contractId"),
    additionalDates: nonNegativeInteger(rawRequest.additionalDates, "additional dates", 104),
    additionalPayment: nonNegativeInteger(rawRequest.additionalPayment, "additional payment"),
  };
  if (request.additionalDates < 1) throw new Error("additional dates must contain at least one appearance");

  const result = await repository.transact(worldId, null, (aggregate) => {
    const control = activePromotionControlForPlayer(aggregate.ownership, playerId);
    if (!control) throw new Error("player must control a promotion before negotiating dates");
    const offer = submitContractDatesAddendumCommand(
      aggregate.state,
      aggregate.ownership,
      aggregate.commands,
      aggregate.runtime,
      {
        requestId: request.requestId,
        worldId,
        playerId,
        commandType: "SUBMIT_CONTRACT_DATES_ADDENDUM",
        payload: {
          promotionId: control.promotionId,
          personId: request.personId,
          contractId: request.contractId,
          additionalDates: request.additionalDates,
          additionalPayment: request.additionalPayment,
        },
      },
    );
    return {
      offerId: offer.id,
      offerKind: "DATES_ADDENDUM" as const,
      view: buildPlayerTalentManagementView(aggregate, playerId),
    };
  });
  return result.result;
}

export async function setAlphaTalentWatch(
  repository: ApplicationWorldRepository,
  worldId: string,
  playerId: string,
  rawRequest: AlphaTalentWatchRequest,
): Promise<AlphaTalentWatchResult> {
  const personId = boundedText(rawRequest.personId, "personId");
  if (typeof rawRequest.watched !== "boolean") throw new Error("watched must be a boolean");

  const transaction = await repository.transact(worldId, null, (aggregate) => {
    if (!activeWorldMembership(aggregate.ownership, playerId)) {
      throw new Error("player must be an active World member before changing Watchlist");
    }
    const person = aggregate.state.people.find((candidate) => candidate.id === personId);
    if (!person || person.status === "RETIRED") throw new Error(`unknown active wrestler ${personId}`);

    const engagement = aggregate.engagement ?? createWorldEngagementState(worldId);
    aggregate.engagement = engagement;
    setTalentWatched(engagement, playerId, personId, rawRequest.watched, aggregate.runtime.revision);

    return {
      personId,
      watched: rawRequest.watched,
      view: buildPlayerTalentManagementView(aggregate, playerId),
    } satisfies AlphaTalentWatchResult;
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
