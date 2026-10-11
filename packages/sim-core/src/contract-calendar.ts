import type { Contract, PpwDate, WorldState } from "../../domain/src/types.js";
import { comparePpwDates, ppwDateToWeekIndex } from "./clock.js";

/**
 * Shared booking/creative-approval contract window for a 7-day PPW week.
 *
 * Historical and newly generated multiweek contracts commonly use D1 as
 * endDate even though their *final PPW week* is fully paid and bookable.
 * Honour the real start day, but include D1–D7 of the final week.
 *
 * Do NOT mutate stored terms, make the following week available, or bypass
 * the separate appearance-count and exclusivity protections.
 */
export function contractCoversBookedDate(
  state: Pick<WorldState, "ruleset">,
  contract: Contract,
  showDate: PpwDate,
): boolean {
  if (contract.status !== "SIGNED") return false;
  const weeksPerYear = state.ruleset.weeksPerYear;
  return comparePpwDates(showDate, contract.startDate, weeksPerYear) >= 0
    && ppwDateToWeekIndex(showDate, weeksPerYear)
      <= ppwDateToWeekIndex(contract.endDate, weeksPerYear);
}
