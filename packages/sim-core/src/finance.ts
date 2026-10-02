import type {
  FinancialDistressState,
  Promotion,
  WorldState,
} from "../../domain/src/types.js";
import { ppwDateToWeekIndex } from "./clock.js";
import { activeContractsForPromotion } from "./contracts.js";
import { LedgerWriter } from "./ledger.js";
import { recordFinancialTransaction } from "./transactions.js";

export function calculateRunwayWeeks(cash: number, weeklyNet: number): number | null {
  if (weeklyNet >= 0) return null;
  if (cash <= 0) return 0;
  return Math.round((cash / Math.abs(weeklyNet)) * 10) / 10;
}

export function determineFinancialDistress(cash: number, weeklyNet: number): FinancialDistressState {
  if (cash <= 0) return "CRISIS";
  if (weeklyNet >= 0) return "HEALTHY";
  const runway = calculateRunwayWeeks(cash, weeklyNet) ?? Number.POSITIVE_INFINITY;
  if (runway > 20) return "HEALTHY";
  if (runway > 8) return "WATCH";
  if (runway > 2) return "DISTRESSED";
  return "CRISIS";
}

function currentWeekNetByPromotion(state: WorldState): Map<string, number> {
  const currentWeekIndex = ppwDateToWeekIndex(state.world.currentDate, state.ruleset.weeksPerYear);
  const result = new Map<string, number>();
  for (let i = state.financialTransactions.length - 1; i >= 0; i -= 1) {
    const transaction = state.financialTransactions[i]!;
    const transactionWeek = ppwDateToWeekIndex(transaction.date, state.ruleset.weeksPerYear);
    if (transactionWeek < currentWeekIndex) break;
    if (transactionWeek !== currentWeekIndex) continue;
    result.set(transaction.promotionId, (result.get(transaction.promotionId) ?? 0) + transaction.amount);
  }
  return result;
}

function recordWeekly(state: WorldState, promotion: Promotion, category: Parameters<typeof recordFinancialTransaction>[2], amount: number, source: string, net: Map<string, number>): void {
  recordFinancialTransaction(state, promotion, category, amount, source);
  net.set(promotion.id, (net.get(promotion.id) ?? 0) + amount);
}

export function settleWorldFinances(state: WorldState): void {
  const ledgerWriter = new LedgerWriter(state.world.id, state.ledger);
  const weeklyNetByPromotion = currentWeekNetByPromotion(state);

  for (const promotion of state.promotions) {
    if (promotion.lifecycle === "CLOSED" || promotion.lifecycle === "DORMANT") continue;
    const previousDistress = promotion.financialDistress;

    recordWeekly(state, promotion, "MEDIA_INCOME", promotion.weeklyMediaIncome, "baseline media agreement", weeklyNetByPromotion);
    recordWeekly(state, promotion, "SPONSOR_INCOME", promotion.weeklySponsorIncome, "baseline sponsor portfolio", weeklyNetByPromotion);
    recordWeekly(state, promotion, "FIXED_OVERHEAD", -promotion.weeklyFixedOverhead, "promotion operating overhead", weeklyNetByPromotion);
    for (const contract of activeContractsForPromotion(state, promotion.id)) {
      if (contract.weeklyGuarantee > 0) {
        recordWeekly(state, promotion, "CONTRACT_GUARANTEE", -contract.weeklyGuarantee, contract.id, weeklyNetByPromotion);
      }
    }

    const weeklyNet = weeklyNetByPromotion.get(promotion.id) ?? 0;
    promotion.lastWeeklyNet = weeklyNet;
    promotion.runwayWeeks = calculateRunwayWeeks(promotion.cash, weeklyNet);
    promotion.financialDistress = determineFinancialDistress(promotion.cash, weeklyNet);

    if (promotion.financialDistress !== previousDistress) {
      ledgerWriter.append({
        date: state.world.currentDate,
        type: "FINANCIAL_DISTRESS_CHANGED",
        significance: promotion.financialDistress === "CRISIS" ? "MAJOR" : "NOTABLE",
        entityIds: [promotion.id],
        payload: {
          from: previousDistress,
          to: promotion.financialDistress,
          cash: Math.round(promotion.cash),
          weeklyNet: Math.round(weeklyNet),
          runwayWeeks: promotion.runwayWeeks,
        },
      });
    }
  }
}
