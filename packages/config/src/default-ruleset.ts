import type { Ruleset } from "../../domain/src/types.js";

export const DEFAULT_RULESET: Ruleset = {
  version: "sim0.0.6",
  weeksPerYear: 52,
  markets: 20,
  promotions: 9,
  wrestlers: 400,
  initialContractedTalentRatio: 0.68,
  careerTimeFactor: 0.14,
  renewalWindowWeeks: 4,
  maxRecruitmentOffersPerPromotionPerWeek: 2,
  offerAcceptanceThreshold: 50,
  majorEventIntervalWeeks: 13,
  minEventParticipants: 6,
  injuryRateMultiplier: 1,
  fatigueRecoveryBase: 14,
  developmentRate: 1,
  retirementBaseAge: 42,
  talentGenerationFloorRatio: 0.96,
  maxProspectsGeneratedPerWeek: 2,
};
