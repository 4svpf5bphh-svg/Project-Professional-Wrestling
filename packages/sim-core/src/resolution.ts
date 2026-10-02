import type { WorldState } from "../../domain/src/types.js";
import { advanceWeek } from "./clock.js";
import { expireContracts, generateAiContractOffers, resolveContractOffers } from "./contracts.js";
import { settleWorldFinances } from "./finance.js";

export function resolveWorldWeek(state: WorldState): void {
  expireContracts(state);
  generateAiContractOffers(state);
  resolveContractOffers(state);
  settleWorldFinances(state);
  advanceWeek(state.world, state.ruleset.weeksPerYear);
}

export function resolveWorldWeeks(state: WorldState, count: number): void {
  if (!Number.isInteger(count) || count < 0) throw new Error("weeks must be a non-negative integer");
  for (let i = 0; i < count; i += 1) resolveWorldWeek(state);
}
