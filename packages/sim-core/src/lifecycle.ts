import type {
  Contract,
  ContractTerms,
  Person,
  Promotion,
  PromotionSurvivalState,
  WorldState,
} from "../../domain/src/types.js";
import { addPpwWeeks, ppwDateToWeekIndex } from "./clock.js";
import {
  activeContractsForPerson,
  activeContractsForPromotion,
  canAcceptContractTerms,
  createSignedContract,
  currentRosterPersonIds,
  marketWeeklyValue,
  targetRosterSize,
} from "./contracts.js";
import { LedgerWriter } from "./ledger.js";
import { DeterministicRng, deterministicSeedFromText } from "./rng.js";
import { recordFinancialTransaction } from "./transactions.js";

export interface HumanPromotionSurvivalAction {
  promotionId: string;
  kind: "RESTRUCTURE_REQUIRED";
  financialDistress: Promotion["financialDistress"];
  stressWeeks: number;
  crisisWeeks: number;
  currentRoster: number;
  minimumViableRoster: number;
}

function survivalStates(state: WorldState): PromotionSurvivalState[] {
  if (!state.promotionSurvivalStates) state.promotionSurvivalStates = [];
  for (const promotion of state.promotions) {
    if (state.promotionSurvivalStates.some((entry) => entry.promotionId === promotion.id)) continue;
    state.promotionSurvivalStates.push({
      worldId: state.world.id,
      promotionId: promotion.id,
      baselineWeeklyFixedOverhead: promotion.weeklyFixedOverhead,
      baselineEventCadenceWeeks: promotion.eventCadenceWeeks,
      stressWeeks: 0,
      crisisWeeks: 0,
      understaffedWeeks: 0,
      healthyWeeks: 0,
      restructuringCount: 0,
      lastRestructureWeekIndex: null,
      dormantSince: null,
    });
  }
  return state.promotionSurvivalStates;
}

export function survivalStateForPromotion(state: WorldState, promotionId: string): PromotionSurvivalState {
  const record = survivalStates(state).find((entry) => entry.promotionId === promotionId);
  if (!record) throw new Error(`missing survival state for ${promotionId}`);
  return record;
}

export function minimumViableRoster(state: WorldState, promotion: Promotion): number {
  return Math.max(
    state.ruleset.minEventParticipants,
    Math.ceil(targetRosterSize(promotion) * state.ruleset.survivalMinimumRosterRatio),
  );
}

function cheapEmergencyTerms(state: WorldState, person: Person): ContractTerms {
  const market = marketWeeklyValue(person);
  return {
    family: "LIMITED_NON_EXCLUSIVE",
    exclusivity: "NON_EXCLUSIVE",
    roleExpectation: person.careerStage === "PROSPECT" ? "DEVELOPMENTAL" : "REGULAR",
    startDate: { ...state.world.currentDate },
    endDate: addPpwWeeks(state.world.currentDate, 12, state.ruleset.weeksPerYear),
    dateEntitlement: 5,
    weeklyGuarantee: Math.round(market * 0.1),
    appearanceFee: Math.round(market * 0.95),
    signingBonus: 0,
  };
}

function emergencyAcceptance(state: WorldState, promotion: Promotion, person: Person): boolean {
  const seed = deterministicSeedFromText(
    `${state.world.seed}:${ppwDateToWeekIndex(state.world.currentDate, state.ruleset.weeksPerYear)}:${promotion.id}:${person.id}:survival-signing`,
  );
  const rng = new DeterministicRng(seed);
  const probability = Math.min(
    0.9,
    0.42
      + person.priorities.exposure / 450
      + (100 - person.priorities.money) / 600
      + person.priorities.role / 900,
  );
  return rng.chance(probability);
}

function emergencyRecruit(state: WorldState, promotion: Promotion): number {
  if (promotion.financialDistress !== "DISTRESSED" && promotion.financialDistress !== "CRISIS") return 0;
  const currentRoster = currentRosterPersonIds(state, promotion.id).length;
  const desiredFloor = Math.max(minimumViableRoster(state, promotion), Math.ceil(targetRosterSize(promotion) * 0.55));
  const needed = Math.max(0, desiredFloor - currentRoster);
  if (needed === 0) return 0;

  const maxSignings = Math.min(state.ruleset.survivalEmergencyRecruitmentPerCycle, needed);
  const candidates = state.people
    .filter((person) => person.status === "ACTIVE" && activeContractsForPerson(state, person.id).length === 0)
    .map((person) => ({
      person,
      cost: marketWeeklyValue(person),
      quality: person.skills.inRingQuality + person.skills.matchCraft + person.skills.presentation,
    }))
    .sort((a, b) => a.cost - b.cost || b.quality - a.quality || a.person.id.localeCompare(b.person.id));

  const writer = new LedgerWriter(state.world.id, state.ledger);
  let signed = 0;
  for (const candidate of candidates) {
    if (signed >= maxSignings) break;
    const terms = cheapEmergencyTerms(state, candidate.person);
    if (!canAcceptContractTerms(state, candidate.person, terms).ok) continue;
    if (!emergencyAcceptance(state, promotion, candidate.person)) continue;
    const contract = createSignedContract(state, candidate.person, promotion, terms, null, false);
    writer.append({
      date: state.world.currentDate,
      type: "EMERGENCY_TALENT_SIGNED",
      significance: "ROUTINE",
      entityIds: [promotion.id, candidate.person.id, contract.id],
      payload: {
        weeklyGuarantee: terms.weeklyGuarantee,
        appearanceFee: terms.appearanceFee,
        dates: terms.dateEntitlement,
      },
    });
    signed += 1;
  }
  return signed;
}

function terminateContract(
  state: WorldState,
  promotion: Promotion,
  contract: Contract,
  settlementWeeks: number,
  writer: LedgerWriter,
): void {
  if (contract.status !== "SIGNED") return;
  contract.status = "TERMINATED";
  const settlement = Math.max(0, Math.round(contract.weeklyGuarantee * settlementWeeks));
  if (settlement > 0) {
    recordFinancialTransaction(state, promotion, "RESTRUCTURING_SETTLEMENT", -settlement, contract.id);
  }
  writer.append({
    date: state.world.currentDate,
    type: "CONTRACT_TERMINATED_DURING_RESTRUCTURING",
    significance: "ROUTINE",
    entityIds: [promotion.id, contract.personId, contract.id],
    payload: { settlement },
  });
}

function withdrawPendingOffers(state: WorldState, promotionId: string): number {
  let withdrawn = 0;
  for (const offer of state.contractOffers) {
    if (offer.promotionId !== promotionId || offer.status !== "PENDING") continue;
    offer.status = "WITHDRAWN";
    offer.rejectionReason = "promotion restructuring";
    withdrawn += 1;
  }
  return withdrawn;
}

function restructure(state: WorldState, promotion: Promotion, survival: PromotionSurvivalState, weekIndex: number): void {
  const writer = new LedgerWriter(state.world.id, state.ledger);
  const crisis = promotion.financialDistress === "CRISIS";
  const overheadFactor = crisis ? 0.68 : 0.84;
  promotion.weeklyFixedOverhead = Math.max(1, Math.round(survival.baselineWeeklyFixedOverhead * overheadFactor));
  promotion.eventCadenceWeeks = Math.min(4, survival.baselineEventCadenceWeeks + 1);
  promotion.lifecycle = "DISTRESSED";

  const minRoster = minimumViableRoster(state, promotion);
  const activeContracts = [...activeContractsForPromotion(state, promotion.id)]
    .filter((contract) => contract.family !== "ONE_OFF")
    .sort((a, b) => b.weeklyGuarantee - a.weeklyGuarantee || b.appearanceFee - a.appearanceFee || a.id.localeCompare(b.id));
  const rosterCount = currentRosterPersonIds(state, promotion.id).length;
  let releaseBudget = Math.min(2, Math.max(0, rosterCount - minRoster));
  const releasedPeople = new Set<string>();
  let released = 0;
  for (const contract of activeContracts) {
    if (releaseBudget <= 0) break;
    if (releasedPeople.has(contract.personId)) continue;
    terminateContract(state, promotion, contract, crisis ? 1 : 2, writer);
    releasedPeople.add(contract.personId);
    releaseBudget -= 1;
    released += 1;
  }

  const withdrawnOffers = withdrawPendingOffers(state, promotion.id);
  survival.restructuringCount += 1;
  survival.lastRestructureWeekIndex = weekIndex;
  writer.append({
    date: state.world.currentDate,
    type: "PROMOTION_RESTRUCTURED",
    significance: crisis ? "MAJOR" : "NOTABLE",
    entityIds: [promotion.id],
    payload: {
      financialState: promotion.financialDistress,
      overhead: promotion.weeklyFixedOverhead,
      cadenceWeeks: promotion.eventCadenceWeeks,
      releasedContracts: released,
      withdrawnOffers,
      restructuringCount: survival.restructuringCount,
    },
  });
}

function enterDormancy(state: WorldState, promotion: Promotion, survival: PromotionSurvivalState): void {
  const writer = new LedgerWriter(state.world.id, state.ledger);
  const contracts = [...activeContractsForPromotion(state, promotion.id)];
  for (const contract of contracts) terminateContract(state, promotion, contract, 1, writer);
  const withdrawnOffers = withdrawPendingOffers(state, promotion.id);
  promotion.lifecycle = "DORMANT";
  promotion.weeklyFixedOverhead = 0;
  survival.dormantSince = { ...state.world.currentDate };
  writer.append({
    date: state.world.currentDate,
    type: "PROMOTION_ENTERED_DORMANCY",
    significance: "MAJOR",
    entityIds: [promotion.id],
    payload: {
      cash: Math.round(promotion.cash),
      releasedContracts: contracts.length,
      withdrawnOffers,
      crisisWeeks: survival.crisisWeeks,
      understaffedWeeks: survival.understaffedWeeks,
    },
  });
}

function recoverPromotion(state: WorldState, promotion: Promotion, survival: PromotionSurvivalState): void {
  if (promotion.lifecycle !== "DISTRESSED") return;
  promotion.lifecycle = "ACTIVE";
  promotion.weeklyFixedOverhead = survival.baselineWeeklyFixedOverhead;
  promotion.eventCadenceWeeks = survival.baselineEventCadenceWeeks;
  new LedgerWriter(state.world.id, state.ledger).append({
    date: state.world.currentDate,
    type: "PROMOTION_RECOVERED_FROM_DISTRESS",
    significance: "NOTABLE",
    entityIds: [promotion.id],
    payload: { restructuringCount: survival.restructuringCount, cash: Math.round(promotion.cash) },
  });
}

function remedialActionDue(
  state: WorldState,
  survival: PromotionSurvivalState,
  weekIndex: number,
): boolean {
  if (survival.stressWeeks < state.ruleset.survivalDistressThresholdWeeks) return false;
  return survival.lastRestructureWeekIndex === null
    || weekIndex - survival.lastRestructureWeekIndex >= state.ruleset.survivalRestructureIntervalWeeks;
}

export function humanPromotionSurvivalAction(
  state: WorldState,
  promotionId: string,
): HumanPromotionSurvivalAction | null {
  const promotion = state.promotions.find((candidate) => candidate.id === promotionId);
  if (!promotion) throw new Error(`unknown promotion ${promotionId}`);
  if (promotion.controllerType !== "HUMAN") throw new Error("survival action is only defined for a human-controlled promotion");
  if (promotion.lifecycle === "CLOSED" || promotion.lifecycle === "DORMANT") return null;

  const weekIndex = ppwDateToWeekIndex(state.world.currentDate, state.ruleset.weeksPerYear);
  const survival = survivalStateForPromotion(state, promotion.id);
  if (!remedialActionDue(state, survival, weekIndex)) return null;

  return {
    promotionId: promotion.id,
    kind: "RESTRUCTURE_REQUIRED",
    financialDistress: promotion.financialDistress,
    stressWeeks: survival.stressWeeks,
    crisisWeeks: survival.crisisWeeks,
    currentRoster: currentRosterPersonIds(state, promotion.id).length,
    minimumViableRoster: minimumViableRoster(state, promotion),
  };
}

export function applyHumanPromotionRestructure(state: WorldState, promotionId: string): void {
  const promotion = state.promotions.find((candidate) => candidate.id === promotionId);
  if (!promotion) throw new Error(`unknown promotion ${promotionId}`);
  if (promotion.controllerType !== "HUMAN") throw new Error("human restructuring requires a human-controlled promotion");
  if (promotion.lifecycle === "CLOSED" || promotion.lifecycle === "DORMANT") {
    throw new Error("inactive promotion cannot restructure");
  }

  const weekIndex = ppwDateToWeekIndex(state.world.currentDate, state.ruleset.weeksPerYear);
  const survival = survivalStateForPromotion(state, promotion.id);
  if (!remedialActionDue(state, survival, weekIndex)) throw new Error("promotion has no restructuring action due");

  restructure(state, promotion, survival, weekIndex);
  emergencyRecruit(state, promotion);
}

export function processPromotionSurvivalForWeek(state: WorldState): void {
  const weekIndex = ppwDateToWeekIndex(state.world.currentDate, state.ruleset.weeksPerYear);
  const interval = Math.max(1, state.ruleset.survivalEvaluationIntervalWeeks);
  if (weekIndex % interval !== 0) return;

  survivalStates(state);
  for (const promotion of state.promotions) {
    if (promotion.lifecycle === "CLOSED" || promotion.lifecycle === "DORMANT") continue;
    const survival = survivalStateForPromotion(state, promotion.id);
    const rosterBefore = currentRosterPersonIds(state, promotion.id).length;
    const minRoster = minimumViableRoster(state, promotion);

    if (promotion.financialDistress === "HEALTHY") {
      survival.healthyWeeks += interval;
      survival.stressWeeks = 0;
      survival.crisisWeeks = 0;
    } else {
      survival.healthyWeeks = 0;
      if (promotion.financialDistress === "DISTRESSED" || promotion.financialDistress === "CRISIS") {
        survival.stressWeeks += interval;
      } else {
        survival.stressWeeks = Math.max(0, survival.stressWeeks - interval);
      }
      survival.crisisWeeks = promotion.financialDistress === "CRISIS" ? survival.crisisWeeks + interval : 0;
    }

    survival.understaffedWeeks = rosterBefore < minRoster ? survival.understaffedWeeks + interval : 0;

    if (survival.stressWeeks >= state.ruleset.survivalDistressThresholdWeeks) {
      promotion.lifecycle = "DISTRESSED";
    }

    if (survival.healthyWeeks >= state.ruleset.survivalRecoveryWeeks) {
      recoverPromotion(state, promotion, survival);
    }

    if (promotion.controllerType === "AI" && survival.stressWeeks >= state.ruleset.survivalDistressThresholdWeeks) {
      if (remedialActionDue(state, survival, weekIndex)) restructure(state, promotion, survival, weekIndex);
      emergencyRecruit(state, promotion);
    }

    const rosterAfter = currentRosterPersonIds(state, promotion.id).length;
    const shouldDormant = promotion.financialDistress === "CRISIS"
      && promotion.cash <= 0
      && survival.crisisWeeks >= state.ruleset.survivalCrisisDormancyWeeks
      && survival.understaffedWeeks >= state.ruleset.survivalUnderstaffedDormancyWeeks
      && rosterAfter < state.ruleset.minEventParticipants;
    if (shouldDormant) enterDormancy(state, promotion, survival);
  }
}
