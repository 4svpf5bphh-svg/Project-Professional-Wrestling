import type { Contract, WorldState } from "../../domain/src/types.js";
import { contractOverlaps } from "./contracts.js";

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
  }

  for (const promotion of state.promotions) {
    if (promotion.worldId !== state.world.id) errors.push(`promotion ${promotion.id} crosses world boundary`);
    if (!marketIds.has(promotion.homeMarketId)) errors.push(`promotion ${promotion.id} has invalid home market`);
    if (!Number.isFinite(promotion.cash)) errors.push(`promotion ${promotion.id} has non-finite cash`);
    if (promotion.runwayWeeks !== null && promotion.runwayWeeks < 0) errors.push(`promotion ${promotion.id} has negative runway`);
  }

  const contractIds = new Set<string>();
  for (const contract of state.contracts) {
    if (contractIds.has(contract.id)) errors.push(`duplicate contract id: ${contract.id}`);
    contractIds.add(contract.id);
    if (contract.worldId !== state.world.id) errors.push(`contract ${contract.id} crosses world boundary`);
    if (!personIds.has(contract.personId)) errors.push(`contract ${contract.id} references missing person`);
    if (!promotionIds.has(contract.promotionId)) errors.push(`contract ${contract.id} references missing promotion`);
    if (contract.dateEntitlement < 1) errors.push(`contract ${contract.id} has invalid date entitlement`);
    if (contract.datesUsed < 0 || contract.datesUsed > contract.dateEntitlement) errors.push(`contract ${contract.id} has invalid used dates`);
    if (contract.weeklyGuarantee < 0 || contract.appearanceFee < 0 || contract.signingBonus < 0) errors.push(`contract ${contract.id} has negative compensation`);
    if (contract.exclusivity === "EXCLUSIVE" && contract.family !== "EXCLUSIVE") errors.push(`contract ${contract.id} has exclusive rights without exclusive family`);
  }

  const signedByPerson = new Map<string, Contract[]>();
  for (const contract of state.contracts.filter((candidate) => candidate.status === "SIGNED")) {
    const list = signedByPerson.get(contract.personId) ?? [];
    list.push(contract);
    signedByPerson.set(contract.personId, list);
  }
  for (const [personId, contracts] of signedByPerson) {
    for (let i = 0; i < contracts.length; i += 1) {
      for (let j = i + 1; j < contracts.length; j += 1) {
        const a = contracts[i]!;
        const b = contracts[j]!;
        if (!contractOverlaps(a, b, state.ruleset.weeksPerYear)) continue;
        if (a.exclusivity === "EXCLUSIVE" || b.exclusivity === "EXCLUSIVE") {
          errors.push(`person ${personId} has overlapping exclusive contracts ${a.id} and ${b.id}`);
        }
      }
    }
  }

  const offerIds = new Set<string>();
  for (const offer of state.contractOffers) {
    if (offerIds.has(offer.id)) errors.push(`duplicate contract offer id: ${offer.id}`);
    offerIds.add(offer.id);
    if (offer.worldId !== state.world.id) errors.push(`contract offer ${offer.id} crosses world boundary`);
    if (!personIds.has(offer.personId)) errors.push(`contract offer ${offer.id} references missing person`);
    if (!promotionIds.has(offer.promotionId)) errors.push(`contract offer ${offer.id} references missing promotion`);
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
