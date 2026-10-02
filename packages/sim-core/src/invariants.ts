import type { WorldState } from "../../domain/src/types.js";

export function validateWorldInvariants(state: WorldState): string[] {
  const errors: string[] = [];
  const personIds = new Set<string>();
  const promotionIds = new Set(state.promotions.map((p) => p.id));
  const marketIds = new Set(state.markets.map((m) => m.id));

  for (const person of state.people) {
    if (personIds.has(person.id)) errors.push(`duplicate person id: ${person.id}`);
    personIds.add(person.id);
    if (person.worldId !== state.world.id) errors.push(`person ${person.id} crosses world boundary`);
    if (!marketIds.has(person.homeMarketId)) errors.push(`person ${person.id} has invalid home market`);
    if (person.contractedPromotionId && !promotionIds.has(person.contractedPromotionId)) {
      errors.push(`person ${person.id} references missing promotion ${person.contractedPromotionId}`);
    }
  }

  const rosterMembership = new Map<string, string>();
  for (const promotion of state.promotions) {
    if (promotion.worldId !== state.world.id) errors.push(`promotion ${promotion.id} crosses world boundary`);
    if (!marketIds.has(promotion.homeMarketId)) errors.push(`promotion ${promotion.id} has invalid home market`);
    if (!Number.isFinite(promotion.cash)) errors.push(`promotion ${promotion.id} has non-finite cash`);
    if (promotion.runwayWeeks !== null && promotion.runwayWeeks < 0) errors.push(`promotion ${promotion.id} has negative runway`);
    for (const personId of promotion.rosterPersonIds) {
      const previous = rosterMembership.get(personId);
      if (previous) errors.push(`person ${personId} rostered by both ${previous} and ${promotion.id}`);
      rosterMembership.set(personId, promotion.id);
    }
  }

  for (const person of state.people) {
    const rosterPromotion = rosterMembership.get(person.id) ?? null;
    if (rosterPromotion !== person.contractedPromotionId) {
      errors.push(`contract/roster mismatch for ${person.id}: person=${person.contractedPromotionId ?? "none"}, roster=${rosterPromotion ?? "none"}`);
    }
  }

  const transactionIds = new Set<string>();
  for (const transaction of state.financialTransactions) {
    if (transactionIds.has(transaction.id)) errors.push(`duplicate financial transaction id: ${transaction.id}`);
    transactionIds.add(transaction.id);
    if (transaction.worldId !== state.world.id) errors.push(`financial transaction ${transaction.id} crosses world boundary`);
    if (!promotionIds.has(transaction.promotionId)) errors.push(`financial transaction ${transaction.id} references missing promotion`);
    if (!Number.isFinite(transaction.amount)) errors.push(`financial transaction ${transaction.id} has non-finite amount`);
  }

  const ledgerIds = new Set<string>();
  for (const event of state.ledger) {
    if (ledgerIds.has(event.id)) errors.push(`duplicate ledger id: ${event.id}`);
    ledgerIds.add(event.id);
    if (event.worldId !== state.world.id) errors.push(`ledger ${event.id} crosses world boundary`);
  }

  return errors;
}
