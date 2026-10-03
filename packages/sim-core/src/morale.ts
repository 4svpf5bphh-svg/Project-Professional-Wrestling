import type { FinancialDistressState, RoleExpectation, WorldState } from "../../domain/src/types.js";
import { ppwDateToWeekIndex } from "./clock.js";
import { contractIsActive } from "./contracts.js";

function clamp(value: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, value));
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

const MISSED_SHOW_EVIDENCE: Record<RoleExpectation, number> = {
  DEVELOPMENTAL: 54,
  REGULAR: 50,
  FEATURED: 44,
  UPPER_CARD: 38,
  MAIN_EVENT: 32,
  SPECIAL_ATTRACTION: 58,
};

const DISTRESS_PENALTY: Record<FinancialDistressState, number> = {
  HEALTHY: 0,
  WATCH: 2,
  DISTRESSED: 6,
  CRISIS: 10,
};

function currentWeekCompletedPromotionIds(state: WorldState): Set<string> {
  const currentWeekIndex = ppwDateToWeekIndex(state.world.currentDate, state.ruleset.weeksPerYear);
  const ids = new Set<string>();
  for (let index = state.events.length - 1; index >= 0; index -= 1) {
    const event = state.events[index]!;
    const eventWeekIndex = ppwDateToWeekIndex(event.date, state.ruleset.weeksPerYear);
    if (eventWeekIndex < currentWeekIndex) break;
    if (eventWeekIndex === currentWeekIndex && event.status === "COMPLETED") ids.add(event.promotionId);
  }
  return ids;
}

function currentWeekCompletedAppearancePairs(state: WorldState): Set<string> {
  const currentWeekIndex = ppwDateToWeekIndex(state.world.currentDate, state.ruleset.weeksPerYear);
  const pairs = new Set<string>();
  for (let index = state.scheduledAppearances.length - 1; index >= 0; index -= 1) {
    const appearance = state.scheduledAppearances[index]!;
    const appearanceWeekIndex = ppwDateToWeekIndex(appearance.date, state.ruleset.weeksPerYear);
    if (appearanceWeekIndex < currentWeekIndex) break;
    if (appearanceWeekIndex === currentWeekIndex && appearance.status === "COMPLETED") {
      pairs.add(`${appearance.promotionId}|${appearance.personId}`);
    }
  }
  return pairs;
}

function fatiguePenalty(fatigue: number): number {
  if (fatigue >= 80) return 16;
  if (fatigue >= 65) return 10;
  if (fatigue >= 50) return 5;
  return 0;
}

export function processWrestlerMoraleForWeek(state: WorldState): void {
  const completedPromotionIds = currentWeekCompletedPromotionIds(state);
  const completedAppearancePairs = currentWeekCompletedAppearancePairs(state);
  const activeContractsByPerson = new Map<string, typeof state.contracts>();

  for (const contract of state.contracts) {
    if (!contractIsActive(state, contract)) continue;
    const list = activeContractsByPerson.get(contract.personId) ?? [];
    list.push(contract);
    activeContractsByPerson.set(contract.personId, list);
  }

  const promotionById = new Map(state.promotions.map((promotion) => [promotion.id, promotion]));

  for (const person of state.people) {
    if (person.status === "RETIRED") continue;

    const activeContracts = activeContractsByPerson.get(person.id) ?? [];
    const usageEvidence: number[] = [];

    if (person.status !== "INJURED") {
      for (const contract of activeContracts) {
        if (!completedPromotionIds.has(contract.promotionId)) continue;
        const used = completedAppearancePairs.has(`${contract.promotionId}|${person.id}`);
        usageEvidence.push(used ? 68 : MISSED_SHOW_EVIDENCE[contract.roleExpectation]);
      }
    }

    let evidence = usageEvidence.length > 0
      ? usageEvidence.reduce((sum, value) => sum + value, 0) / usageEvidence.length
      : 60;

    evidence += (person.momentum - 50) * 0.12;
    evidence -= fatiguePenalty(person.fatigue);

    let worstPromotionPenalty = 0;
    for (const contract of activeContracts) {
      const promotion = promotionById.get(contract.promotionId);
      if (!promotion) continue;
      const lifecyclePenalty = promotion.lifecycle === "DORMANT" || promotion.lifecycle === "CLOSED" ? 15 : 0;
      worstPromotionPenalty = Math.max(worstPromotionPenalty, DISTRESS_PENALTY[promotion.financialDistress], lifecyclePenalty);
    }
    evidence -= worstPromotionPenalty;
    evidence = clamp(evidence, 15, 90);

    const responseWeight = usageEvidence.length > 0 ? 0.18 : 0.08;
    person.morale = round1(clamp(person.morale + (evidence - person.morale) * responseWeight, 5, 95));
  }
}
