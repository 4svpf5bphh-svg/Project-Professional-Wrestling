/**
 * Observational audit: indie affordability and wrestler liquidity.
 *
 * Uses actual Genesis + weekly-resolution models, and checks both fictional
 * and real-promotion / real-roster Worlds. Does not alter balance, World
 * state, acceptance rules, staff behaviour, prices or contracts.
 *
 * Candidate feasibility/interest is a hypothetical 13-week/four-date offer.
 * It does not guarantee a wrestler will accept and is NOT a forecast of box
 * office, future bookings or human management choices.
 */
declare const process: { exitCode?: number };

import { mkdirSync, writeFileSync } from "node:fs";
import { DEFAULT_RULESET } from "../packages/config/src/default-ruleset.js";
import { REAL_WORLD_ALPHA_RULESET } from "../packages/config/src/real-world-ruleset.js";
import { calibratedRealActiveMixedRosterSource } from "../packages/content/src/real-active-mixed-roster.js";
import { realPromotionEcosystemSource } from "../packages/content/src/real-promotions.js";
import { realWorldInitialRosterAssignmentSource } from "../packages/content/src/real-aew-roh-cmll-rosters.js";
import type { ContractOffer, FinancialTransactionCategory, Promotion, WorldState } from "../packages/domain/src/types.js";
import {
  activeContractsForPerson, activeContractsForPromotion,
  addPpwWeeks, canAcceptContractTerms, calculateRunwayWeeks,
  createWorld, evaluateContractOffer, marketWeeklyValue,
  resolveWorldWeek, validateWorldInvariants,
} from "../packages/sim-core/src/index.js";

type Cohort = "PROCEDURAL" | "REAL_ROSTER";
type Checkpoint = 0 | 13 | 26 | 52;
const SEEDS: Record<Cohort, readonly number[]> = {
  PROCEDURAL: [94101, 94102, 94103, 94104],
  REAL_ROSTER: [94105, 94106, 94107],
};
const CHECKPOINTS: readonly Checkpoint[] = [0, 13, 26, 52];
const RECOGNISABLE = 60;
const FINANCE_CATEGORIES: readonly FinancialTransactionCategory[] = [
  "MEDIA_INCOME", "SPONSOR_INCOME", "FIXED_OVERHEAD",
  "CONTRACT_GUARANTEE", "CONTRACT_SIGNING_BONUS", "CONTRACT_BUYOUT",
  "GATE_REVENUE", "VENUE_COST", "PRODUCTION_COST", "TRAVEL_COST",
  "APPEARANCE_FEE", "RESTRUCTURING_SETTLEMENT",
];
type FinanceCategories = Record<FinancialTransactionCategory, number>;
function emptyFinance(): FinanceCategories {
  return Object.fromEntries(FINANCE_CATEGORIES.map(category => [category, 0]))
    as FinanceCategories;
}
function accumulatedFinance(state: WorldState, firstNewTransaction: number): Map<string, FinanceCategories> {
  const totals = new Map<string, FinanceCategories>();
  // Use actual transaction data, not forecast model constants. Transactions
  // are the canonical cash mutation path and include restructuring payouts.
  for (let index = firstNewTransaction; index < state.financialTransactions.length; index++) {
    const tx = state.financialTransactions[index]!;
    const row = totals.get(tx.promotionId) ?? emptyFinance();
    row[tx.category] += tx.amount;
    totals.set(tx.promotionId, row);
  }
  return totals;
}
function sumCategories(row: FinanceCategories, categories: readonly FinancialTransactionCategory[]): number {
  return categories.reduce((sum, category) => sum + row[category], 0);
}
const SHOW_CATEGORIES: readonly FinancialTransactionCategory[] = [
  "GATE_REVENUE", "VENUE_COST", "PRODUCTION_COST", "TRAVEL_COST", "APPEARANCE_FEE",
];
const RECURRING_CATEGORIES: readonly FinancialTransactionCategory[] = [
  "MEDIA_INCOME", "SPONSOR_INCOME", "FIXED_OVERHEAD", "CONTRACT_GUARANTEE",
];
interface FinanceAttribution {
  initialCash: number;
  transactionCategories: FinanceCategories;
  transactionNet: number;
  cashChange: number;
  cashReconciliationResidual: number;
  completedEventNet: number;
  showTransactionNet: number;
  showReconciliationResidual: number;
  recurringCashflow: number;
  signingAndRestructuringCashflow: number;
  completedShows: number;
  cancelledShows: number;
}
function attributeFinance(
  state: WorldState, promotion: Promotion,
  initialCash: number, categories: FinanceCategories,
): FinanceAttribution {
  const transactionNet = sumCategories(categories, FINANCE_CATEGORIES);
  const actualCashChange = promotion.cash - initialCash;
  const completedEvents = state.events.filter(event =>
    event.promotionId === promotion.id && event.status === "COMPLETED");
  const completedEventNet = completedEvents.reduce((sum, event) => sum + event.netResult, 0);
  const showTransactionNet = sumCategories(categories, SHOW_CATEGORIES);
  return {
    initialCash,
    transactionCategories: { ...categories },
    transactionNet,
    cashChange: actualCashChange,
    cashReconciliationResidual: Math.round((actualCashChange - transactionNet) * 100) / 100,
    completedEventNet,
    showTransactionNet,
    showReconciliationResidual: Math.round((showTransactionNet - completedEventNet) * 100) / 100,
    recurringCashflow: sumCategories(categories, RECURRING_CATEGORIES),
    signingAndRestructuringCashflow: sumCategories(categories,
      ["CONTRACT_SIGNING_BONUS", "CONTRACT_BUYOUT", "RESTRUCTURING_SETTLEMENT"]),
    completedShows: completedEvents.length,
    cancelledShows: state.events.filter(event =>
      event.promotionId === promotion.id && event.status === "CANCELLED").length,
  };
}

function median(values: number[]): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
}
function pct(part: number, total: number): number | null {
  return total ? Number((100 * part / total).toFixed(1)) : null;
}
function round(n: number): number { return Math.round(n * 10) / 10; }

interface IndieSnapshot {
  id: string;
  name: string;
  lifecycle: string;
  cash: number;
  debt: number;
  lastWeeklyNet: number;
  reportedRunwayWeeks: number | null;
  staticRecurringRunwayWeeks: number | null;
  recurringMediaSponsor: number;
  fixedOverhead: number;
  activeWeeklyGuarantees: number;
  staticNetBeforeShows: number;
  staticPayrollToRecurringIncomePct: number | null;
  contractedWrestlers: number;
  exclusiveWrestlers: number;
  bookedEventsToDate: number;
  completedEventsToDate: number;
  availableCandidates: number;
  openToTalksCandidates: number;
  recognisableCandidates: number;
  financiallyCoveredCandidates: number;
  willingAndCoveredCandidates: number;
  recognisableWillingAndCovered: number;
  cheapestPlausible13WeekFourDateCost: number | null;
  financialWatch: boolean;
  finance: FinanceAttribution;
}

interface WorldSnapshot {
  cohort: Cohort;
  seed: number;
  elapsedWeeks: Checkpoint;
  ppwYear: number;
  ppwWeek: number;
  activePeople: number;
  trulyUncontractedPeople: number;
  nonexclusiveEmployedPeople: number;
  exclusiveEmployedPeople: number;
  multiPromotionWorkers: number;
  recognisableActivePeople: number;
  indiePromotionCountAtGenesis: number;
  activeIndies: number;
  dormantOrClosedIndies: number;
  indieMedianCash: number | null;
  indieMedianActiveWages: number | null;
  indieMedianStaticNet: number | null;
  indieMedianRosterSize: number | null;
  indieMedianAccessible: number | null;
  indieMinAccessible: number | null;
  indieMedianPlausible: number | null;
  indieMinPlausible: number | null;
  indieMedianFinanciallyCovered: number | null;
  indiesStaticWeeklyDeficit: number;
  indiesInDistressOrCrisis: number;
  indiesWithoutOneWillingFundableOffer: number;
  indies: IndieSnapshot[];
}

function makeWorld(cohort: Cohort, seed: number): WorldState {
  if (cohort === "PROCEDURAL") return createWorld(seed, DEFAULT_RULESET);
  return createWorld(seed, REAL_WORLD_ALPHA_RULESET, "PPW Indie Affordability Audit",
    calibratedRealActiveMixedRosterSource, realPromotionEcosystemSource,
    realWorldInitialRosterAssignmentSource);
}

/** All forecasts use the same accessible, four-date 13-week terms as the game.
 * No reserve, artificial offer, transaction or contract is written to state.
 */
function indieSnapshot(
  state: WorldState, promotion: Promotion, genesisCash: number, totals: FinanceCategories,
): IndieSnapshot {
  const contracts = activeContractsForPromotion(state, promotion.id);
  const signedPeople = new Set(contracts.map(contract => contract.personId));
  const weeklyGuarantees = contracts.reduce((sum, contract) => sum + contract.weeklyGuarantee, 0);
  const recurring = promotion.weeklyMediaIncome + promotion.weeklySponsorIncome;
  const staticNet = recurring - promotion.weeklyFixedOverhead - weeklyGuarantees;
  let accessible = 0, plausible = 0, recognisable = 0;
  let covered = 0, willingCovered = 0, recognisableCovered = 0;
  const costs: number[] = [];

  for (const person of state.people) {
    if (person.status !== "ACTIVE" || signedPeople.has(person.id)) continue;
    const market = Math.max(1, marketWeeklyValue(person));
    const startDate = { ...addPpwWeeks(state.world.currentDate, 1, state.ruleset.weeksPerYear), day: 1 };
    const weeklyGuarantee = Math.round(market * 0.2);
    const terms = {
      family: "LIMITED_NON_EXCLUSIVE" as const, exclusivity: "NON_EXCLUSIVE" as const,
      roleExpectation: "FEATURED" as const, startDate,
      endDate: addPpwWeeks(startDate, 12, state.ruleset.weeksPerYear),
      dateEntitlement: 4, weeklyGuarantee, appearanceFee: market, signingBonus: market,
    };
    if (!canAcceptContractTerms(state, person, terms).ok) continue;
    accessible++;
    if (person.recognition >= RECOGNISABLE) recognisable++;

    const offer: ContractOffer = {
      ...terms, id: `indie-audit:${state.world.seed}:${promotion.id}:${person.id}`,
      worldId: state.world.id, personId: person.id, promotionId: promotion.id,
      submittedDate: { ...state.world.currentDate }, status: "PENDING",
      offerKind: "RECRUITMENT", resolvedUtility: null, rejectionReason: null,
    };
    const willing = evaluateContractOffer(state, offer) >= state.ruleset.offerAcceptanceThreshold;
    if (willing) plausible++;
    // Full 13-week cash exposure: signing + all four appearance fees +
    // thirteen guaranteed wages. No optimistic ticket-sales assumption.
    const totalCost = market + 4 * market + 13 * weeklyGuarantee;
    // Could fund the complete additional contract, without taking future
    // ticket sales or unmodelled lending for granted. Positive baseline
    // recurring surplus is available; negative deficit consumes cash.
    const uncommittedCash = promotion.cash + Math.min(0, 13 * staticNet);
    const funded = uncommittedCash >= totalCost
      && promotion.lifecycle !== "DORMANT" && promotion.lifecycle !== "CLOSED";
    if (funded) covered++;
    if (funded && willing) {
      willingCovered++;
      costs.push(totalCost);
      if (person.recognition >= RECOGNISABLE) recognisableCovered++;
    }
  }

  return {
    id: promotion.id, name: promotion.name, lifecycle: promotion.lifecycle,
    cash: promotion.cash, debt: promotion.debt, lastWeeklyNet: promotion.lastWeeklyNet,
    reportedRunwayWeeks: promotion.runwayWeeks,
    staticRecurringRunwayWeeks: calculateRunwayWeeks(promotion.cash, staticNet),
    recurringMediaSponsor: recurring, fixedOverhead: promotion.weeklyFixedOverhead,
    activeWeeklyGuarantees: weeklyGuarantees, staticNetBeforeShows: staticNet,
    staticPayrollToRecurringIncomePct: pct(weeklyGuarantees, recurring),
    contractedWrestlers: signedPeople.size,
    exclusiveWrestlers: contracts.filter(contract => contract.family === "EXCLUSIVE").length,
    bookedEventsToDate: state.events.filter(event => event.promotionId === promotion.id).length,
    completedEventsToDate: state.events.filter(event =>
      event.promotionId === promotion.id && event.status === "COMPLETED").length,
    availableCandidates: accessible, openToTalksCandidates: plausible,
    recognisableCandidates: recognisable,
    financiallyCoveredCandidates: covered,
    willingAndCoveredCandidates: willingCovered,
    recognisableWillingAndCovered: recognisableCovered,
    cheapestPlausible13WeekFourDateCost: costs.length ? Math.min(...costs) : null,
    financialWatch: promotion.financialDistress !== "HEALTHY",
    finance: attributeFinance(state, promotion, genesisCash, totals),
  };
}

function snapshot(
  state: WorldState, cohort: Cohort, seed: number,
  elapsedWeeks: Checkpoint, genesisIndieIds: readonly string[],
  genesisCash: ReadonlyMap<string, number>, startingTransactionIndex: number,
): WorldSnapshot {
  const transactionTotals = accumulatedFinance(state, startingTransactionIndex);
  const indies = genesisIndieIds.map(id => state.promotions.find(p => p.id === id))
    .filter((p): p is Promotion => p !== undefined)
    .map(p => indieSnapshot(state, p, genesisCash.get(p.id) ?? p.cash,
      transactionTotals.get(p.id) ?? emptyFinance()));
  const active = state.people.filter(person => person.status === "ACTIVE");
  let free = 0, nonexclusive = 0, exclusive = 0, multi = 0;
  for (const person of active) {
    const contracts = activeContractsForPerson(state, person.id);
    if (contracts.length === 0) { free++; continue; }
    if (contracts.some(contract => contract.exclusivity === "EXCLUSIVE")) exclusive++;
    else nonexclusive++;
    if (new Set(contracts.map(contract => contract.promotionId)).size >= 2) multi++;
  }
  return {
    cohort, seed, elapsedWeeks,
    ppwYear: state.world.currentDate.year, ppwWeek: state.world.currentDate.week,
    activePeople: active.length,
    trulyUncontractedPeople: free, nonexclusiveEmployedPeople: nonexclusive,
    exclusiveEmployedPeople: exclusive, multiPromotionWorkers: multi,
    recognisableActivePeople: active.filter(person => person.recognition >= RECOGNISABLE).length,
    indiePromotionCountAtGenesis: genesisIndieIds.length,
    activeIndies: indies.filter(p => p.lifecycle === "ACTIVE").length,
    dormantOrClosedIndies: indies.filter(p => p.lifecycle === "DORMANT" || p.lifecycle === "CLOSED").length,
    indieMedianCash: median(indies.map(p => p.cash)),
    indieMedianActiveWages: median(indies.map(p => p.activeWeeklyGuarantees)),
    indieMedianStaticNet: median(indies.map(p => p.staticNetBeforeShows)),
    indieMedianRosterSize: median(indies.map(p => p.contractedWrestlers)),
    indieMedianAccessible: median(indies.map(p => p.availableCandidates)),
    indieMinAccessible: indies.length ? Math.min(...indies.map(p => p.availableCandidates)) : null,
    indieMedianPlausible: median(indies.map(p => p.openToTalksCandidates)),
    indieMinPlausible: indies.length ? Math.min(...indies.map(p => p.openToTalksCandidates)) : null,
    indieMedianFinanciallyCovered: median(indies.map(p => p.willingAndCoveredCandidates)),
    indiesStaticWeeklyDeficit: indies.filter(p => p.staticNetBeforeShows < 0).length,
    indiesInDistressOrCrisis: indies.filter(p => p.financialWatch).length,
    indiesWithoutOneWillingFundableOffer: indies.filter(p => p.willingAndCoveredCandidates === 0).length,
    indies,
  };
}

const rows: WorldSnapshot[] = [];
const invariantFailures: { cohort: Cohort; seed: number; errors: string[] }[] = [];
for (const cohort of ["PROCEDURAL", "REAL_ROSTER"] as const) {
  for (const seed of SEEDS[cohort]) {
    const state = makeWorld(cohort, seed);
    const indieIds = state.promotions.filter(p =>
      p.tier === "INDEPENDENT" && p.playerTakeoverEligibility === "STANDARD")
      .map(p => p.id);
    if (!indieIds.length) {
      invariantFailures.push({ cohort, seed, errors: ["zero takeover-eligible independent promotions"] });
      continue;
    }

    const genesisCash = new Map(state.promotions.map(p => [p.id, p.cash] as const));
    const startingTransactionIndex = state.financialTransactions.length;
    rows.push(snapshot(state, cohort, seed, 0, indieIds, genesisCash, startingTransactionIndex));
    for (let week = 1; week <= 52; week++) {
      resolveWorldWeek(state);
      if (week === 13 || week === 26 || week === 52) {
        rows.push(snapshot(state, cohort, seed, week, indieIds, genesisCash, startingTransactionIndex));
      }
    }
    const errors = validateWorldInvariants(state);
    if (errors.length) invariantFailures.push({ cohort, seed, errors: errors.slice(0, 12) });
    for (const checkpoint of CHECKPOINTS) {
      const row = rows.find(r => r.cohort === cohort && r.seed === seed && r.elapsedWeeks === checkpoint);
      if (!row || row.indiePromotionCountAtGenesis !== indieIds.length) {
        invariantFailures.push({ cohort, seed, errors: [`missing or incomplete checkpoint ${checkpoint}`] });
      }
    }
  }
}

// Source-of-truth cash must reconcile to posted transactions. Flag any
// direct, unrecorded cash mutation separately from legitimate poor economics.
const financeReconciliationErrors = rows.flatMap(row => row.indies
  .filter(indie => Math.abs(indie.finance.cashReconciliationResidual) > 0.01
    || Math.abs(indie.finance.showReconciliationResidual) > 0.01)
  .map(indie => ({
    cohort: row.cohort, seed: row.seed, week: row.elapsedWeeks,
    promotion: indie.name, cashResidual: indie.finance.cashReconciliationResidual,
    showResidual: indie.finance.showReconciliationResidual,
  })));

const summary = {
  observationOnly: true,
  seedsByCohort: SEEDS,
  checkpointWeeks: CHECKPOINTS,
  recognitionThreshold: RECOGNISABLE,
  worlds: 7,
  totalSimulatedWeeks: 7 * 52,
  worldSnapshots: rows.length,
  indieObservations: rows.reduce((sum, row) => sum + row.indies.length, 0),
  byCohort: (["PROCEDURAL", "REAL_ROSTER"] as const).map(cohort => ({
    cohort,
    checkpoints: CHECKPOINTS.map(week => {
      const items = rows.filter(row => row.cohort === cohort && row.elapsedWeeks === week);
      return {
        elapsedWeeks: week, seedWorlds: items.length,
        medianIndieCash: median(items.map(r => r.indieMedianCash).filter((x): x is number => x !== null)),
        medianIndiePayroll: median(items.map(r => r.indieMedianActiveWages).filter((x): x is number => x !== null)),
        medianIndieStaticNet: median(items.map(r => r.indieMedianStaticNet).filter((x): x is number => x !== null)),
        minMarketCandidates: items.length ? Math.min(...items.map(r => r.indieMinAccessible ?? 0)) : null,
        minPlausibleCandidates: items.length ? Math.min(...items.map(r => r.indieMinPlausible ?? 0)) : null,
        medianWillingFundable: median(items.map(r => r.indieMedianFinanciallyCovered).filter((x): x is number => x !== null)),
        staticDeficitIndies: items.reduce((sum, r) => sum + r.indiesStaticWeeklyDeficit, 0),
        indiesWithoutWillingFundable: items.reduce((sum, r) => sum + r.indiesWithoutOneWillingFundableOffer, 0),
        dormantOrClosedIndies: items.reduce((sum, r) => sum + r.dormantOrClosedIndies, 0),
        medianMultiPromotionWorkers: median(items.map(r => r.multiPromotionWorkers)),
      };
    }),
  })),
  watchlist: {
    noInterestedIndieAtAnyCheckpoint: rows.some(r => r.indies.some(p => p.openToTalksCandidates === 0)),
    noFundableIndieAtAnyCheckpoint: rows.some(r => r.indies.some(p => p.willingAndCoveredCandidates === 0)),
    cashCrisisAtYearEnd: rows.some(r => r.elapsedWeeks === 52 && r.indies.some(p => p.cash <= 0)),
    dormantIndieAtYearEnd: rows.some(r => r.elapsedWeeks === 52 && r.dormantOrClosedIndies > 0),
    noConcurrentNonexclusiveWorkersAtYearEnd: rows.some(r => r.elapsedWeeks === 52 && r.multiPromotionWorkers === 0),
    baselineRecurringDeficitAtGenesis: rows.some(r => r.elapsedWeeks === 0 && r.indies.some(p => p.staticNetBeforeShows < 0)),
  },
  financeReconciliationErrors,
  invariantFailures,
};

mkdirSync("artifacts", { recursive: true });
writeFileSync("artifacts/indie-affordability-market-audit.json", JSON.stringify({ summary, rows }, null, 2) + "\n");
for (const result of summary.byCohort) {
  for (const point of result.checkpoints) {
    console.log("INDIE_AUDIT_CHECKPOINT " + JSON.stringify({ cohort: result.cohort, ...point }));
  }
}
console.log("INDIE_AUDIT_SUMMARY " + JSON.stringify({
  worlds: summary.worlds, totalSimulatedWeeks: summary.totalSimulatedWeeks,
  worldSnapshots: summary.worldSnapshots,
  indieObservations: summary.indieObservations,
  watchlist: summary.watchlist,
  financeReconciliationErrors: summary.financeReconciliationErrors,
  invariantFailures: summary.invariantFailures,
}));
// Financial integrity failures are distinct from economic weakness: missing
// money is a release blocker; a cash-poor indie is a balance signal only.
if (invariantFailures.length || financeReconciliationErrors.length) process.exitCode = 1;
