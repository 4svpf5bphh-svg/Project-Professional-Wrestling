import type { Person, Promotion } from "../../domain/src/types.js";
import {
  buildContractTerms,
  currentRosterPersonIds,
  DeterministicRng,
  deterministicSeedFromText,
  targetRosterSize,
} from "../../sim-core/src/index.js";
import { activityForPlayer, activeSchedulerDaysBetween } from "./engagement.js";
import { activePromotionControls } from "./ownership.js";
import {
  executeStewardshipRivalBuyout,
  stewardshipBuyoutQuote,
  STEWARDSHIP_BUYOUT_NOTICE_DAYS,
  type StewardshipBuyoutPlan,
} from "./stewardship-buyout.js";
import type { ApplicationWorldAggregate } from "./world-aggregate.js";

export const AI_STEWARDSHIP_BUYOUT_RESERVE_WEEKS = 8;
export const AI_STEWARDSHIP_BUYOUTS_PER_PROMOTION_PER_CYCLE = 1;

export interface AiStewardshipBuyoutResult {
  eligibleRequests: number;
  buyersConsidered: number;
  candidateAttempts: number;
  executedBuyouts: number;
}

function requireCycleKey(value: string): string {
  const normalized = value.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
    throw new Error("AI Stewardship buyout cycle key must use YYYY-MM-DD UTC format");
  }
  const parsed = new Date(`${normalized}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== normalized) {
    throw new Error("AI Stewardship buyout cycle key is not a valid UTC date");
  }
  return normalized;
}

function daysBetween(startCycleKey: string, endCycleKey: string): number {
  return Math.max(0, Math.floor((Date.parse(`${endCycleKey}T00:00:00.000Z`) - Date.parse(`${startCycleKey}T00:00:00.000Z`)) / 86_400_000));
}

function talentValueForPromotion(person: Person, promotion: Promotion): number {
  const skill = (person.skills.inRingQuality + person.skills.matchCraft + person.skills.presentation) / 3;
  return skill * (0.45 + promotion.aiProfile.matchQualityPreference / 250)
    + person.recognition * (0.25 + promotion.aiProfile.starPreference / 220)
    + person.popularity * 0.25
    + (person.careerStage === "PROSPECT" ? promotion.aiProfile.developmentPreference * 0.22 : 0);
}

function buyerHasRosterNeed(aggregate: ApplicationWorldAggregate, buyer: Promotion): boolean {
  return currentRosterPersonIds(aggregate.state, buyer.id).length < targetRosterSize(buyer);
}

function expectedBuyoutFailure(message: string): boolean {
  return message.includes("wrestler rejected")
    || message.includes("service capacity exceeded")
    || message.includes("exclusive offer overlaps")
    || message.includes("existing exclusive contract blocks")
    || message.includes("buyer promotion cannot afford");
}

function eligibleRequests(
  aggregate: ApplicationWorldAggregate,
  cycleKey: string,
) {
  const engagement = aggregate.engagement;
  if (!engagement) return [];
  const controlsByPromotion = new Map(
    activePromotionControls(aggregate.ownership).map((control) => [control.promotionId, control]),
  );

  return engagement.stewardshipExitRequests.filter((request) => {
    if (request.status !== "OPEN") return false;
    if (activeSchedulerDaysBetween(engagement, request.requestedCycleKey, cycleKey) < STEWARDSHIP_BUYOUT_NOTICE_DAYS) return false;
    const control = controlsByPromotion.get(request.promotionId);
    if (!control) return false;
    if (activityForPlayer(engagement, control.playerId)?.status !== "STEWARDED") return false;
    const contract = aggregate.state.contracts.find((candidate) => candidate.id === request.contractId);
    if (!contract || contract.status !== "SIGNED") return false;
    if (contract.promotionId !== request.promotionId || contract.personId !== request.personId) return false;
    if (aggregate.state.scheduledAppearances.some((appearance) => (
      appearance.contractId === contract.id && appearance.status === "COMMITTED"
    ))) return false;
    const person = aggregate.state.people.find((candidate) => candidate.id === request.personId);
    return Boolean(person && person.status === "ACTIVE");
  });
}

function replacementPlan(
  aggregate: ApplicationWorldAggregate,
  buyer: Promotion,
  person: Person,
  requestId: string,
  cycleKey: string,
): StewardshipBuyoutPlan {
  const rng = new DeterministicRng(deterministicSeedFromText(
    `${aggregate.state.world.seed}:${cycleKey}:${buyer.id}:${person.id}:stewardship-ai-buyout`,
  ));
  return {
    requestId,
    buyerPromotionId: buyer.id,
    ...buildContractTerms(aggregate.state, buyer, person, rng, aggregate.state.world.currentDate),
  };
}

/**
 * Give AI promotions the same Stewardship buyout route available to human rivals.
 *
 * Fairness rules are intentionally strict:
 * - AI only sees OPEN requests whose public notice window has elapsed;
 * - it ranks talent from wrestler/promoter attributes, never hidden seller salary terms;
 * - it receives only the system buyout quote, not the source contract breakdown;
 * - it only acts for a real roster deficit, with healthy/watch finances and an
 *   eight-week fixed-overhead cash reserve after the immediate buyout cost;
 * - the wrestler still evaluates and may reject the replacement contract;
 * - at most one successful buyout per AI promotion per real cycle.
 */
export function runAiStewardshipBuyouts(
  aggregate: ApplicationWorldAggregate,
  rawCycleKey: string,
): AiStewardshipBuyoutResult {
  const cycleKey = requireCycleKey(rawCycleKey);
  const requests = eligibleRequests(aggregate, cycleKey);
  const result: AiStewardshipBuyoutResult = {
    eligibleRequests: requests.length,
    buyersConsidered: 0,
    candidateAttempts: 0,
    executedBuyouts: 0,
  };
  if (requests.length === 0) return result;

  const buyers = aggregate.state.promotions
    .filter((promotion) => promotion.controllerType === "AI")
    .filter((promotion) => promotion.lifecycle === "ACTIVE")
    .filter((promotion) => promotion.financialDistress === "HEALTHY" || promotion.financialDistress === "WATCH")
    .filter((promotion) => buyerHasRosterNeed(aggregate, promotion))
    .sort((a, b) => a.id.localeCompare(b.id));

  for (const buyer of buyers) {
    result.buyersConsidered += 1;
    let successfulForBuyer = 0;
    const buyerRoster = new Set(currentRosterPersonIds(aggregate.state, buyer.id));
    const ranked = requests
      .filter((request) => request.status === "OPEN" && request.promotionId !== buyer.id)
      .map((request) => ({
        request,
        person: aggregate.state.people.find((candidate) => candidate.id === request.personId) ?? null,
      }))
      .filter((candidate): candidate is { request: typeof requests[number]; person: Person } => (
        candidate.person !== null && !buyerRoster.has(candidate.person.id)
      ))
      .sort((a, b) => (
        talentValueForPromotion(b.person, buyer) - talentValueForPromotion(a.person, buyer)
        || a.request.requestId.localeCompare(b.request.requestId)
      ));

    for (const candidate of ranked) {
      if (successfulForBuyer >= AI_STEWARDSHIP_BUYOUTS_PER_PROMOTION_PER_CYCLE) break;
      result.candidateAttempts += 1;

      const quote = stewardshipBuyoutQuote(
        aggregate,
        candidate.request.requestId,
        buyer.id,
        cycleKey,
      );
      const plan = replacementPlan(
        aggregate,
        buyer,
        candidate.person,
        candidate.request.requestId,
        cycleKey,
      );
      const immediateCost = quote.buyoutValue + plan.signingBonus;
      const reserveFloor = buyer.weeklyFixedOverhead * AI_STEWARDSHIP_BUYOUT_RESERVE_WEEKS;
      if (buyer.cash - immediateCost < reserveFloor) continue;

      try {
        executeStewardshipRivalBuyout(aggregate, plan, cycleKey);
        result.executedBuyouts += 1;
        successfulForBuyer += 1;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (expectedBuyoutFailure(message)) continue;
        throw error;
      }
    }
  }

  return result;
}
