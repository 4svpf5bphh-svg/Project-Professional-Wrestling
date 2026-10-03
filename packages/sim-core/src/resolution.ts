import type { WorldState } from "../../domain/src/types.js";
import { decayAudienceMarketHeatForWeek } from "./audience.js";
import { advanceWeek } from "./clock.js";
import { processCareerProgressionForWeek, recoverWrestlersForNewWeek } from "./career.js";
import { maintainChampionshipsForWeek, processCompetitionForWeek } from "./competition.js";
import { expireContracts, generateAiContractOffers, resolveContractOffers } from "./contracts.js";
import { planAndResolveWorldEvents } from "./events.js";
import { settleWorldFinances } from "./finance.js";
import { processPromotionTierGrowthForWeek } from "./growth.js";
import { processPromotionSurvivalForWeek } from "./lifecycle.js";
import { processWrestlerMoraleForWeek } from "./morale.js";
import { processPromotionStandingForWeek } from "./reputation.js";
import { applyRenewalRelationshipResistance } from "./renewal-resistance.js";
import { processTalentTrustForWeek } from "./talent-trust.js";

export function resolveWorldWeek(state: WorldState): void {
  recoverWrestlersForNewWeek(state);
  decayAudienceMarketHeatForWeek(state);
  expireContracts(state);
  maintainChampionshipsForWeek(state);
  generateAiContractOffers(state);
  applyRenewalRelationshipResistance(state);
  resolveContractOffers(state);
  planAndResolveWorldEvents(state);
  processCompetitionForWeek(state);
  settleWorldFinances(state);
  processPromotionSurvivalForWeek(state);
  processWrestlerMoraleForWeek(state);
  processPromotionTierGrowthForWeek(state);
  processPromotionStandingForWeek(state);
  processTalentTrustForWeek(state);
  processCareerProgressionForWeek(state);
  advanceWeek(state.world, state.ruleset.weeksPerYear);
}

export function resolveWorldWeeks(state: WorldState, count: number): void {
  if (!Number.isInteger(count) || count < 0) throw new Error("weeks must be a non-negative integer");
  for (let i = 0; i < count; i += 1) resolveWorldWeek(state);
}
