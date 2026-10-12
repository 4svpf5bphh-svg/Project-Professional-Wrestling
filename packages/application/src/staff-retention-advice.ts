/**
 * Advisory only. A manager can explain existing public/owned wrestler signals
 * but cannot infer secret rival terms or modify offer utility/consent.
 *
 * Keeping this calculation in the read-only application projection prevents
 * on-line staff interactions from creating extra World simulation power.
 */
export function staffRetentionAdvice(input: {
  insight: number;
  morale: number;
  weeklyGuarantee: number;
  appearanceFee: number;
  dateEntitlement: number;
  termWeeks: number;
  marketWeeklyEstimate: number;
  weeksToExpiry: number;
}): string {
  const { insight, morale, weeklyGuarantee, appearanceFee, dateEntitlement,
    termWeeks, marketWeeklyEstimate, weeksToExpiry } = input;
  // Do not compare a non-exclusive guarantee alone to estimated total pay:
  // contracted appearance fees are part of the actual deal economics.
  const estimatedPackagePerWeek = weeklyGuarantee
    + appearanceFee * dateEntitlement / Math.max(1, termWeeks);
  if (insight < 55) {
    return "Routine renewal: check wages and morale before approving. Acceptance is never guaranteed.";
  }
  if (morale < 45) {
    return "Low wrestler morale is a retention warning. An unchanged offer may not be enough.";
  }
  if (insight >= 75 && estimatedPackagePerWeek < marketWeeklyEstimate * 0.8) {
    return "The current estimated weekly package is below market valuation. Identical terms may be uncompetitive.";
  }
  if (weeksToExpiry <= 1) {
    return "The agreement is near expiry. Prioritise a decision, but do not assume the wrestler will accept.";
  }
  if (insight >= 75) {
    return "No obvious warning from known morale or pay signals. Rival opportunities and acceptance remain uncertain.";
  }
  return "Check the wrestler's current valuation before approving unchanged terms. Acceptance remains uncertain.";
}
