import type { WorldState } from "../../domain/src/types.js";
import { advanceWeek } from "./clock.js";
import { settleWorldFinances } from "./finance.js";

export function resolveWorldWeek(state: WorldState): void {
  settleWorldFinances(state);
  advanceWeek(state.world, state.ruleset.weeksPerYear);
}

export function resolveWorldWeeks(state: WorldState, count: number): void {
  if (!Number.isInteger(count) || count < 0) throw new Error("weeks must be a non-negative integer");
  for (let i = 0; i < count; i += 1) resolveWorldWeek(state);
}
