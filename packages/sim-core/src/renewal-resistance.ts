import type { Id, WorldState } from "../../domain/src/types.js";
import { evaluateContractOffer } from "./contracts.js";

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

function relationshipTrust(state: WorldState, personId: Id, promotionId: Id): number {
  return state.promotionTalentTrust?.find(
    (entry) => entry.personId === personId && entry.promotionId === promotionId,
  )?.trust ?? 50;
}

export function renewalRelationshipPenalty(morale: number, trust: number): number {
  const relationshipAverage = (morale + trust) / 2;
  return round1(Math.max(0, 55 - relationshipAverage) * 0.35);
}

export function applyRenewalRelationshipResistance(state: WorldState): number {
  let rejected = 0;

  for (const offer of state.contractOffers) {
    if (offer.status !== "PENDING" || offer.offerKind !== "RENEWAL") continue;
    const person = state.people.find((candidate) => candidate.id === offer.personId);
    if (!person) continue;

    const trust = relationshipTrust(state, offer.personId, offer.promotionId);
    const penalty = renewalRelationshipPenalty(person.morale, trust);
    if (penalty <= 0) continue;

    const baseUtility = evaluateContractOffer(state, offer);
    const adjustedUtility = round1(baseUtility - penalty);
    if (baseUtility < state.ruleset.offerAcceptanceThreshold || adjustedUtility >= state.ruleset.offerAcceptanceThreshold) continue;

    offer.resolvedUtility = adjustedUtility;
    offer.status = "REJECTED";
    offer.rejectionReason = "low morale and trust undermine renewal willingness";
    rejected += 1;
  }

  return rejected;
}
