import type { Id, WorldState } from "../../domain/src/types.js";
import { ppwDateToWeekIndex } from "./clock.js";
import { evaluateContractOffer } from "./contracts.js";

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

function relationshipKey(personId: Id, promotionId: Id): string {
  return `${personId}:${promotionId}`;
}

export function renewalRelationshipPenalty(morale: number, trust: number): number {
  const relationshipAverage = (morale + trust) / 2;
  return round1(Math.max(0, 55 - relationshipAverage) * 0.2);
}

export function applyRenewalRelationshipResistance(state: WorldState): number {
  let rejected = 0;
  const currentIndex = ppwDateToWeekIndex(state.world.currentDate, state.ruleset.weeksPerYear);
  const peopleById = new Map(state.people.map((person) => [person.id, person] as const));
  const trustByRelationship = new Map(
    (state.promotionTalentTrust ?? []).map((entry) => [relationshipKey(entry.personId, entry.promotionId), entry.trust] as const),
  );

  for (let i = state.contractOffers.length - 1; i >= 0; i -= 1) {
    const offer = state.contractOffers[i]!;
    const submittedIndex = ppwDateToWeekIndex(offer.submittedDate, state.ruleset.weeksPerYear);
    if (submittedIndex < currentIndex) break;
    if (submittedIndex !== currentIndex || offer.status !== "PENDING" || offer.offerKind !== "RENEWAL") continue;

    const person = peopleById.get(offer.personId);
    if (!person) continue;

    const trust = trustByRelationship.get(relationshipKey(offer.personId, offer.promotionId)) ?? 50;
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
