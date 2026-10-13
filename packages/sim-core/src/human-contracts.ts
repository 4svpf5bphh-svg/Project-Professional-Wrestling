import type { ContractOffer, ContractTerms, Id, WorldState } from "../../domain/src/types.js";
import { comparePpwDates } from "./clock.js";
import { canAcceptContractTerms, canAddLimitedContractDates, contractIsActive, contractOverlaps } from "./contracts.js";
import { resolvedCreativeControl, validCreativeControl } from "./creative-control.js";
import { nextEntityId } from "./id-allocator.js";
import { LedgerWriter } from "./ledger.js";

export type HumanContractOfferPlan = ContractTerms & {
  promotionId: Id;
  personId: Id;
  sourceContractId?: Id | null;
};

function requireNonNegativeInteger(value: number, label: string): void {
  if (!Number.isFinite(value) || !Number.isInteger(value) || value < 0) {
    throw new Error(`${label} must be a non-negative integer`);
  }
}

function validateContractFamily(plan: HumanContractOfferPlan): void {
  if (plan.family === "EXCLUSIVE" && plan.exclusivity !== "EXCLUSIVE") {
    throw new Error("exclusive contract family requires EXCLUSIVE exclusivity");
  }
  if (plan.family === "LIMITED_NON_EXCLUSIVE" && plan.exclusivity !== "NON_EXCLUSIVE") {
    throw new Error("limited non-exclusive contract family requires NON_EXCLUSIVE exclusivity");
  }
  if (plan.family === "ONE_OFF") {
    if (plan.exclusivity !== "OPEN") throw new Error("one-off contract requires OPEN exclusivity");
    if (plan.dateEntitlement !== 1) throw new Error("one-off contract must contain exactly one purchased date");
    if (plan.weeklyGuarantee !== 0) throw new Error("one-off contract cannot contain a weekly guarantee");
  }
}

export function submitHumanContractOffer(state: WorldState, plan: HumanContractOfferPlan): ContractOffer {
  const promotion = state.promotions.find((candidate) => candidate.id === plan.promotionId);
  if (!promotion) throw new Error(`unknown promotion ${plan.promotionId}`);
  if (promotion.controllerType !== "HUMAN") throw new Error("contract offer requires a human-controlled promotion");
  if (promotion.lifecycle === "DORMANT" || promotion.lifecycle === "CLOSED") {
    throw new Error("dormant or closed promotion cannot submit contract offers");
  }

  const person = state.people.find((candidate) => candidate.id === plan.personId);
  if (!person) throw new Error(`unknown wrestler ${plan.personId}`);
  if (person.status === "RETIRED") throw new Error("retired wrestler cannot receive a contract offer");

  if (comparePpwDates(plan.startDate, state.world.currentDate, state.ruleset.weeksPerYear) < 0) {
    throw new Error("contract offer cannot start in the past");
  }
  if (comparePpwDates(plan.endDate, plan.startDate, state.ruleset.weeksPerYear) < 0) {
    throw new Error("contract end date cannot precede its start date");
  }

  requireNonNegativeInteger(plan.dateEntitlement, "date entitlement");
  if (plan.dateEntitlement < 1) throw new Error("date entitlement must contain at least one date");
  requireNonNegativeInteger(plan.weeklyGuarantee, "weekly guarantee");
  requireNonNegativeInteger(plan.appearanceFee, "appearance fee");
  requireNonNegativeInteger(plan.signingBonus, "signing bonus");
  validateContractFamily(plan);
  if (!validCreativeControl(resolvedCreativeControl(plan.creativeControl))) {
    throw new Error("unsupported creative control clause");
  }

  if (state.contractOffers.some((offer) => (
    offer.status === "PENDING"
    && offer.promotionId === promotion.id
    && offer.personId === person.id
  ))) {
    throw new Error(`${promotion.name} already has a pending offer for ${person.name}`);
  }

  const sourceContractId = plan.sourceContractId ?? null;
  const source = sourceContractId
    ? state.contracts.find((contract) => contract.id === sourceContractId)
    : null;
  if (sourceContractId && (
    !source
    || source.promotionId !== promotion.id
    || source.personId !== person.id
    || source.status !== "SIGNED"
  )) {
    throw new Error("renewal source contract does not belong to this promotion/wrestler");
  }
  // A human promotion cannot sign a second overlapping term with the same wrestler
  // just because the previous accepted renewal starts in a future PPW week.
  // This enforces the invariant for BOTH manual offers and Talent Manager commands.
  const signedDuplicate = state.contracts.some((contract) =>
    contract.id !== sourceContractId
    && contract.status === "SIGNED"
    && contract.promotionId === promotion.id
    && contract.personId === person.id
    && contractOverlaps(contract, plan, state.ruleset.weeksPerYear)
  );
  if (signedDuplicate) {
    throw new Error("Your promotion already has a signed overlapping contract for this wrestler. Review upcoming agreements in Contracts.");
  }

  const replacingExhausted = Boolean(
    source
    && source.family === "LIMITED_NON_EXCLUSIVE"
    && source.datesUsed >= source.dateEntitlement
    && contractOverlaps(source, plan, state.ruleset.weeksPerYear)
  );
  const capacity = canAcceptContractTerms(state, person, plan, {
    ignoreContractId: replacingExhausted ? source!.id : null,
  });
  if (!capacity.ok) throw new Error(capacity.reason ?? "contract terms cannot be accepted");

  const priorRelationship = state.contracts.some(
    (contract) => contract.promotionId === promotion.id && contract.personId === person.id,
  );
  const offer: ContractOffer = {
    id: nextEntityId(state, "contractOffer"),
    worldId: state.world.id,
    personId: person.id,
    promotionId: promotion.id,
    submittedDate: { ...state.world.currentDate },
    status: "PENDING",
    offerKind: priorRelationship ? "RENEWAL" : "RECRUITMENT",
    resolvedUtility: null,
    rejectionReason: null,
    sourceContractId,
    family: plan.family,
    exclusivity: plan.exclusivity,
    roleExpectation: plan.roleExpectation,
    creativeControl: resolvedCreativeControl(plan.creativeControl),
    startDate: { ...plan.startDate },
    endDate: { ...plan.endDate },
    dateEntitlement: plan.dateEntitlement,
    weeklyGuarantee: plan.weeklyGuarantee,
    appearanceFee: plan.appearanceFee,
    signingBonus: plan.signingBonus,
  };
  state.contractOffers.push(offer);

  new LedgerWriter(state.world.id, state.ledger).append({
    date: state.world.currentDate,
    type: "HUMAN_CONTRACT_OFFER_SUBMITTED",
    significance: plan.exclusivity === "EXCLUSIVE" ? "NOTABLE" : "ROUTINE",
    entityIds: [offer.id, promotion.id, person.id],
    payload: {
      offerKind: offer.offerKind,
      family: offer.family,
      exclusivity: offer.exclusivity,
      roleExpectation: offer.roleExpectation,
      creativeControl: resolvedCreativeControl(offer.creativeControl),
      dateEntitlement: offer.dateEntitlement,
      weeklyGuarantee: offer.weeklyGuarantee,
      appearanceFee: offer.appearanceFee,
      signingBonus: offer.signingBonus,
    },
  });

  return offer;
}

export interface HumanDatesAddendumPlan {
  promotionId: Id;
  personId: Id;
  contractId: Id;
  additionalDates: number;
  /** Negotiated one-time extra payment; no change to existing weekly pay. */
  additionalPayment: number;
}

/** Propose extra appearances, without issuing a replacement contract. */
export function submitHumanDatesAddendum(
  state: WorldState,
  plan: HumanDatesAddendumPlan,
): ContractOffer {
  const promotion = state.promotions.find(entry => entry.id === plan.promotionId);
  if (!promotion || promotion.controllerType !== "HUMAN"
    || promotion.lifecycle === "DORMANT" || promotion.lifecycle === "CLOSED") {
    throw new Error("date-addendum offer requires an active human-controlled promotion");
  }
  const person = state.people.find(entry => entry.id === plan.personId);
  const source = state.contracts.find(entry => entry.id === plan.contractId);
  if (!person || person.status === "RETIRED"
    || !source || source.promotionId !== plan.promotionId || source.personId !== plan.personId
    || !contractIsActive(state, source)) {
    throw new Error("no active contract for wrestler and promotion");
  }
  requireNonNegativeInteger(plan.additionalPayment, "additional payment");
  const capacity = canAddLimitedContractDates(state, person, source, plan.additionalDates);
  if (!capacity.ok) throw new Error(capacity.reason ?? "additional dates not possible");
  if (state.contractOffers.some(offer =>
    offer.status === "PENDING" && offer.promotionId === plan.promotionId && offer.personId === plan.personId)) {
    throw new Error("a contract offer for this wrestler is already pending");
  }
  const offer: ContractOffer = {
    id: nextEntityId(state, "contractOffer"),
    worldId: state.world.id,
    personId: person.id,
    promotionId: promotion.id,
    submittedDate: { ...state.world.currentDate },
    status: "PENDING",
    offerKind: "DATES_ADDENDUM",
    resolvedUtility: null,
    rejectionReason: null,
    sourceContractId: source.id,
    family: source.family,
    exclusivity: source.exclusivity,
    roleExpectation: source.roleExpectation,
    creativeControl: resolvedCreativeControl(source.creativeControl),
    // The offer stores the proposed *new total*, not extra dates or used dates.
    startDate: { ...source.startDate },
    endDate: { ...source.endDate },
    dateEntitlement: source.dateEntitlement + plan.additionalDates,
    weeklyGuarantee: source.weeklyGuarantee,
    appearanceFee: source.appearanceFee,
    // In an addendum only, this is a one-time incremental payment.
    signingBonus: plan.additionalPayment,
  };
  state.contractOffers.push(offer);
  new LedgerWriter(state.world.id, state.ledger).append({
    date: state.world.currentDate,
    type: "CONTRACT_EXTRA_DATES_PROPOSED",
    significance: "ROUTINE",
    entityIds: [offer.id, source.id, person.id, promotion.id],
    payload: { additionalDates: plan.additionalDates, additionalPayment: plan.additionalPayment },
  });
  return offer;
}
