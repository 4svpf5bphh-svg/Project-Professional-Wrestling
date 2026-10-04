import type { Contract, Person, Promotion } from "../../domain/src/types.js";
import {
  addPpwWeeks,
  comparePpwDates,
  contractsForPerson,
  marketWeeklyValue,
} from "../../sim-core/src/index.js";
import {
  activityForPlayer,
  addOpportunity,
  createWorldEngagementState,
} from "./engagement.js";
import { activePromotionControls } from "./ownership.js";
import type { ApplicationWorldAggregate } from "./world-aggregate.js";

export const TALENT_OPPORTUNITY_WINDOW_WEEKS = 2;
export const TALENT_OPPORTUNITY_MIN_SCORE = 62;
export const TALENT_OPPORTUNITY_RESERVE_WEEKS = 2;

export interface OpportunityGenerationResult {
  promotionsConsidered: number;
  talentWindowsCreated: number;
}

function personPublicValue(person: Person): number {
  const skill = (person.skills.inRingQuality + person.skills.matchCraft + person.skills.presentation) / 3;
  return person.recognition * 0.45 + person.popularity * 0.30 + skill * 0.25;
}

function meaningfulTalentOpportunity(person: Person): boolean {
  return personPublicValue(person) >= TALENT_OPPORTUNITY_MIN_SCORE
    && (person.recognition >= 55 || person.popularity >= 60);
}

function hasCurrentOrFutureSignedContract(
  aggregate: ApplicationWorldAggregate,
  personId: string,
): boolean {
  const currentDate = aggregate.state.world.currentDate;
  return contractsForPerson(aggregate.state, personId).some((contract) => (
    contract.status === "SIGNED"
    && comparePpwDates(contract.endDate, currentDate, aggregate.state.ruleset.weeksPerYear) >= 0
  ));
}

function latestEndedContract(
  aggregate: ApplicationWorldAggregate,
  personId: string,
): Contract | null {
  const currentDate = aggregate.state.world.currentDate;
  return [...contractsForPerson(aggregate.state, personId)]
    .filter((contract) => (
      contract.status !== "SIGNED"
      || comparePpwDates(contract.endDate, currentDate, aggregate.state.ruleset.weeksPerYear) < 0
    ))
    .sort((left, right) => (
      comparePpwDates(right.endDate, left.endDate, aggregate.state.ruleset.weeksPerYear)
      || right.id.localeCompare(left.id)
    ))[0] ?? null;
}

function availabilityEpisodeKey(
  aggregate: ApplicationWorldAggregate,
  personId: string,
): string {
  return latestEndedContract(aggregate, personId)?.id ?? "initial";
}

function opportunityIsOpen(
  aggregate: ApplicationWorldAggregate,
  opensDate: { year: number; week: number; day: number },
  closesDate: { year: number; week: number; day: number },
): boolean {
  const currentDate = aggregate.state.world.currentDate;
  const weeksPerYear = aggregate.state.ruleset.weeksPerYear;
  return comparePpwDates(currentDate, opensDate, weeksPerYear) >= 0
    && comparePpwDates(currentDate, closesDate, weeksPerYear) <= 0;
}

function hasOpenTalentWindow(
  aggregate: ApplicationWorldAggregate,
  promotionId: string,
): boolean {
  return (aggregate.engagement?.opportunities ?? []).some((opportunity) => (
    opportunity.category === "TALENT"
    && opportunity.eligiblePromotionIds.includes(promotionId)
    && opportunityIsOpen(aggregate, opportunity.opensDate, opportunity.closesDate)
  ));
}

function canPlausiblyPursue(
  promotion: Promotion,
  person: Person,
): boolean {
  if (promotion.financialDistress === "CRISIS" || promotion.cash <= 0) return false;
  const reserve = promotion.weeklyFixedOverhead * TALENT_OPPORTUNITY_RESERVE_WEEKS;
  const indicativeCommitment = marketWeeklyValue(person) * 4;
  return promotion.cash - indicativeCommitment >= reserve;
}

function candidatePool(
  aggregate: ApplicationWorldAggregate,
  promotion: Promotion,
): Person[] {
  return aggregate.state.people
    .filter((person) => person.status === "ACTIVE")
    .filter((person) => meaningfulTalentOpportunity(person))
    .filter((person) => !hasCurrentOrFutureSignedContract(aggregate, person.id))
    .filter((person) => canPlausiblyPursue(promotion, person))
    .sort((left, right) => (
      personPublicValue(right) - personPublicValue(left)
      || marketWeeklyValue(left) - marketWeeklyValue(right)
      || left.id.localeCompare(right.id)
    ));
}

/**
 * Generates scarce, player-scoped Opportunity records from real World state.
 *
 * ALPHA-1A starts with Talent Windows only. They are not random events and do
 * not grant a hidden buff: the wrestler is genuinely unattached and can still
 * sign elsewhere. A stable availability-episode key prevents the same free
 * agent from being re-announced every PPW week.
 */
export function generateWorldOpportunities(
  aggregate: ApplicationWorldAggregate,
): OpportunityGenerationResult {
  const result: OpportunityGenerationResult = {
    promotionsConsidered: 0,
    talentWindowsCreated: 0,
  };
  const controls = activePromotionControls(aggregate.ownership);
  if (controls.length === 0) return result;

  const engagement = aggregate.engagement ?? createWorldEngagementState(aggregate.state.world.id);
  aggregate.engagement = engagement;
  const currentDate = aggregate.state.world.currentDate;
  const closesDate = addPpwWeeks(
    currentDate,
    TALENT_OPPORTUNITY_WINDOW_WEEKS - 1,
    aggregate.state.ruleset.weeksPerYear,
  );
  closesDate.day = 7;

  for (const control of controls) {
    const activity = activityForPlayer(engagement, control.playerId);
    if (activity?.status === "STEWARDED") continue;
    const promotion = aggregate.state.promotions.find((candidate) => candidate.id === control.promotionId);
    if (!promotion) continue;
    if (promotion.lifecycle === "DORMANT" || promotion.lifecycle === "CLOSED") continue;
    result.promotionsConsidered += 1;
    if (hasOpenTalentWindow(aggregate, promotion.id)) continue;

    for (const person of candidatePool(aggregate, promotion)) {
      const episodeKey = availabilityEpisodeKey(aggregate, person.id);
      const opportunityId = `talent-window:${promotion.id}:${person.id}:${episodeKey}`;
      if (engagement.opportunities.some((opportunity) => opportunity.opportunityId === opportunityId)) continue;

      addOpportunity(engagement, {
        opportunityId,
        worldId: aggregate.state.world.id,
        category: "TALENT",
        title: `${person.name} is available`,
        summary: `${person.name} is currently unattached and has emerged as a realistic recruitment opening for ${promotion.name}. The window remains highlighted through Year ${closesDate.year}, Week ${closesDate.week}; availability can change if another promotion signs them.`,
        createdDate: { ...currentDate },
        opensDate: { ...currentDate },
        closesDate: { ...closesDate },
        eligiblePlayerIds: [control.playerId],
        eligiblePromotionIds: [promotion.id],
        deepLink: null,
      });
      result.talentWindowsCreated += 1;
      break;
    }
  }

  return result;
}
