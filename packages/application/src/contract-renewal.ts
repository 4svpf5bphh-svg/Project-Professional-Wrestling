import type { Contract, ContractFamily, CreativeControlLevel, RoleExpectation, WorldState } from "../../domain/src/types.js";
import { ppwDateToWeekIndex } from "../../sim-core/src/clock.js";
import { resolvedCreativeControl } from "../../sim-core/src/creative-control.js";

/**
 * Existing recurring terms only; a historical signing bonus is NOT a standing
 * obligation. Future staff can present this exact proposal, but cannot accept
 * it for the wrestler or bypass the player's authorisation.
 */
export interface SameTermsRenewalTemplate {
  family: Exclude<ContractFamily, "ONE_OFF">;
  roleExpectation: RoleExpectation;
  creativeControl: CreativeControlLevel;
  termWeeks: number;
  dateEntitlement: number;
  weeklyGuarantee: number;
  appearanceFee: number;
  signingBonus: 0;
}

export function sameTermsRenewalTemplate(
  state: WorldState,
  contract: Contract,
): SameTermsRenewalTemplate | null {
  if (contract.status !== "SIGNED" || contract.family === "ONE_OFF") return null;
  const termWeeks = ppwDateToWeekIndex(contract.endDate, state.ruleset.weeksPerYear)
    - ppwDateToWeekIndex(contract.startDate, state.ruleset.weeksPerYear) + 1;
  const allowedTerms = contract.family === "EXCLUSIVE" ? [13, 26, 52] : [4, 13, 26];
  // Existing historic/AI terms may not match player-offer guardrails. In that
  // case require a deliberate manual negotiation rather than a false preset.
  if (!allowedTerms.includes(termWeeks)) return null;
  if (contract.dateEntitlement < 1 || contract.dateEntitlement > 104
    || contract.dateEntitlement > termWeeks * 2) return null;
  return {
    family: contract.family,
    roleExpectation: contract.roleExpectation,
    creativeControl: resolvedCreativeControl(contract.creativeControl),
    termWeeks,
    dateEntitlement: contract.family === "EXCLUSIVE" ? termWeeks : contract.dateEntitlement,
    weeklyGuarantee: contract.weeklyGuarantee,
    appearanceFee: contract.appearanceFee,
    signingBonus: 0,
  };
}
