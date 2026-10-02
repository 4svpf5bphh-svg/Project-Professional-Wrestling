import type {
  FinancialDistressState,
  FinancialTransaction,
  FinancialTransactionCategory,
  Promotion,
  WorldState,
} from "../../domain/src/types.js";
import { LedgerWriter } from "./ledger.js";

class FinancialTransactionWriter {
  private counter: number;

  constructor(private readonly state: WorldState) {
    this.counter = state.financialTransactions.length;
  }

  append(promotion: Promotion, category: FinancialTransactionCategory, amount: number, source: string): FinancialTransaction {
    this.counter += 1;
    const transaction: FinancialTransaction = {
      id: `finance-${String(this.counter).padStart(8, "0")}`,
      worldId: this.state.world.id,
      promotionId: promotion.id,
      date: { ...this.state.world.currentDate },
      category,
      amount,
      source,
    };
    this.state.financialTransactions.push(transaction);
    return transaction;
  }
}

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

export function settleWorldFinances(state: WorldState): void {
  const transactionWriter = new FinancialTransactionWriter(state);
  const ledgerWriter = new LedgerWriter(state.world.id, state.ledger);

  for (const promotion of state.promotions) {
    if (promotion.lifecycle === "CLOSED" || promotion.lifecycle === "DORMANT") continue;

    const previousDistress = promotion.financialDistress;
    const entries = [
      transactionWriter.append(promotion, "MEDIA_INCOME", promotion.weeklyMediaIncome, "baseline media agreement"),
      transactionWriter.append(promotion, "SPONSOR_INCOME", promotion.weeklySponsorIncome, "baseline sponsor portfolio"),
      transactionWriter.append(promotion, "FIXED_OVERHEAD", -promotion.weeklyFixedOverhead, "promotion operating overhead"),
      transactionWriter.append(promotion, "TALENT_COMMITMENT", -promotion.weeklyTalentCommitment, "genesis roster commitments"),
    ];

    const weeklyNet = entries.reduce((sum, entry) => sum + entry.amount, 0);
    promotion.cash += weeklyNet;
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
