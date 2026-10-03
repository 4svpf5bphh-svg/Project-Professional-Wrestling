import type { FinancialTransaction, FinancialTransactionCategory, Promotion, WorldState } from "../../domain/src/types.js";
import { nextEntityId } from "./id-allocator.js";

export function recordFinancialTransaction(
  state: WorldState,
  promotion: Promotion,
  category: FinancialTransactionCategory,
  amount: number,
  source: string,
): FinancialTransaction {
  const transaction: FinancialTransaction = {
    id: nextEntityId(state, "financialTransaction"),
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
