import type { ContractOffer, ContractTerms, Id, WorldState } from "../../domain/src/types.js";
import { comparePpwDates } from "./clock.js";
import { canAcceptContractTerms } from "./contracts.js";
import { nextEntityId } from "./id-allocator.js";
import { LedgerWriter } from "./ledger.js";

export type HumanContractOfferPlan = ContractTerms & {
  promotionId: Id;
  personId: Id;
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

  if (state.contractOffers.some((offer) => (
    offer.status === "PENDING"
    && offer.promotionId === promotion.id
    && offer.personId === person.id
  ))) {
    throw new Error(`${promotion.name} already has a pending offer for ${person.name}`);
  }

  const capacity = canAcceptContractTerms(state, person, plan);
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
    family: plan.family,
    exclusivity: plan.exclusivity,
    roleExpectation: plan.roleExpectation,
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
      dateEntitlement: offer.dateEntitlement,
      weeklyGuarantee: offer.weeklyGuarantee,
      appearanceFee: offer.appearanceFee,
      signingBonus: offer.signingBonus,
    },
  });

  return offer;
}
