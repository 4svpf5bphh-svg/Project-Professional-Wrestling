import type { FinancialDistressState, WorldState } from "../../domain/src/types.js";

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
  globalPromotion: string | null;
  ledgerEvents: number;
  financialTransactions: number;
  totalPromotionCash: number;
  distressCounts: Record<FinancialDistressState, number>;
  deterministicHash: string;
}

export function deterministicWorldHash(state: WorldState): string {
  return fnv1a32(JSON.stringify(state));
}

export function summarizeWorld(state: WorldState): WorldSummary {
  const contracted = state.people.filter((p) => p.contractedPromotionId !== null).length;
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
    globalPromotion: globalPromotion?.name ?? null,
    ledgerEvents: state.ledger.length,
    financialTransactions: state.financialTransactions.length,
    totalPromotionCash: Math.round(state.promotions.reduce((sum, promotion) => sum + promotion.cash, 0)),
    distressCounts,
    deterministicHash: deterministicWorldHash(state),
  };
}
