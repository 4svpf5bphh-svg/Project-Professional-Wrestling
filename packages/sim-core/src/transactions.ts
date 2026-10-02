import type { FinancialTransaction, FinancialTransactionCategory, Promotion, WorldState } from "../../domain/src/types.js";

export function recordFinancialTransaction(
  state: WorldState,
  promotion: Promotion,
  category: FinancialTransactionCategory,
  amount: number,
  source: string,
): FinancialTransaction {
  const transaction: FinancialTransaction = {
    id: `finance-${String(state.financialTransactions.length + 1).padStart(8, "0")}`,
    worldId: state.world.id,
    promotionId: promotion.id,
    date: { ...state.world.currentDate },
    category,
    amount,
    source,
  };
  state.financialTransactions.push(transaction);
  promotion.cash += amount;
  return transaction;
}
