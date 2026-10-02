import type { FinancialDistressState, WorldState } from "../../domain/src/types.js";
import { activeContractsForPerson, activeContractsForPromotion, contractIsActive } from "./contracts.js";

function fnv1a32(text: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

export interface WorldSummary {
  worldId: string;
  seed: number;
  ruleset: string;
  year: number;
  week: number;
  markets: number;
  promotions: number;
  wrestlers: number;
  contractedWrestlers: number;
  freeAgents: number;
  multiPromotionWrestlers: number;
  activeContracts: number;
  exclusiveContracts: number;
  limitedContracts: number;
  oneOffContracts: number;
  expiredContracts: number;
  contractOffers: number;
  acceptedOffers: number;
  rejectedOffers: number;
  globalPromotion: string | null;
  ledgerEvents: number;
  financialTransactions: number;
  totalPromotionCash: number;
  distressCounts: Record<FinancialDistressState, number>;
  rosterSizes: { promotionId: string; tier: string; activePeople: number }[];
  deterministicHash: string;
}

export function deterministicWorldHash(state: WorldState): string {
  return fnv1a32(JSON.stringify(state));
}

export function summarizeWorld(state: WorldState): WorldSummary {
  const activeContracts = state.contracts.filter((contract) => contractIsActive(state, contract));
  const contracted = state.people.filter((person) => activeContractsForPerson(state, person.id).length > 0).length;
  const multiPromotionWrestlers = state.people.filter((person) => new Set(activeContractsForPerson(state, person.id).map((contract) => contract.promotionId)).size > 1).length;
  const globalPromotion = state.promotions.find((p) => p.tier === "GLOBAL") ?? null;
  const distressCounts: Record<FinancialDistressState, number> = {
    HEALTHY: 0,
    WATCH: 0,
    DISTRESSED: 0,
    CRISIS: 0,
  };
  for (const promotion of state.promotions) distressCounts[promotion.financialDistress] += 1;

  return {
    worldId: state.world.id,
    seed: state.world.seed,
    ruleset: state.ruleset.version,
    year: state.world.currentDate.year,
    week: state.world.currentDate.week,
    markets: state.markets.length,
    promotions: state.promotions.length,
    wrestlers: state.people.length,
    contractedWrestlers: contracted,
    freeAgents: state.people.length - contracted,
    multiPromotionWrestlers,
    activeContracts: activeContracts.length,
    exclusiveContracts: activeContracts.filter((contract) => contract.family === "EXCLUSIVE").length,
    limitedContracts: activeContracts.filter((contract) => contract.family === "LIMITED_NON_EXCLUSIVE").length,
    oneOffContracts: activeContracts.filter((contract) => contract.family === "ONE_OFF").length,
    expiredContracts: state.contracts.filter((contract) => contract.status === "EXPIRED").length,
    contractOffers: state.contractOffers.length,
    acceptedOffers: state.contractOffers.filter((offer) => offer.status === "ACCEPTED").length,
    rejectedOffers: state.contractOffers.filter((offer) => offer.status === "REJECTED").length,
    globalPromotion: globalPromotion?.name ?? null,
    ledgerEvents: state.ledger.length,
    financialTransactions: state.financialTransactions.length,
    totalPromotionCash: Math.round(state.promotions.reduce((sum, promotion) => sum + promotion.cash, 0)),
    distressCounts,
    rosterSizes: state.promotions.map((promotion) => ({ promotionId: promotion.id, tier: promotion.tier, activePeople: activeContractsForPromotion(state, promotion.id).length })),
    deterministicHash: deterministicWorldHash(state),
  };
}
