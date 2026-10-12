/**
 * Explicit counterfactual audit of future AI-granted creative control.
 *
 * Each cohort starts as two identical Worlds. The treatment runs normal
 * production resolveWorldWeek; the control strips *only newly generated*
 * AI creative clauses immediately before the usual acceptance engine, with
 * all other offered money/term/roster rules unchanged.
 *
 * This is an observational diagnostic, NOT an online-game switch.
 */
declare const process: { exitCode?: number };

import { writeFileSync, mkdirSync } from "node:fs";
import { DEFAULT_RULESET } from "../packages/config/src/default-ruleset.js";
import { REAL_WORLD_ALPHA_RULESET } from "../packages/config/src/real-world-ruleset.js";
import { calibratedRealActiveMixedRosterSource } from "../packages/content/src/real-active-mixed-roster.js";
import { realPromotionEcosystemSource } from "../packages/content/src/real-promotions.js";
import { realWorldInitialRosterAssignmentSource } from "../packages/content/src/real-aew-roh-cmll-rosters.js";
import type { ContractOffer, CreativeControlLevel, WorldState } from "../packages/domain/src/types.js";
import {
  addPpwWeeks, canAcceptContractTerms, createWorld, evaluateContractOffer,
  marketWeeklyValue, resolveWorldWeek, resolvedCreativeControl,
  validateWorldInvariants,
} from "../packages/sim-core/src/index.js";

type Cohort = "PROCEDURAL" | "REAL_ROSTER";
type Scenario = "CREATIVE_POLICY" | "NO_NEW_AI_RIGHTS";
type Tier = "GLOBAL" | "NATIONAL" | "RISING" | "INDEPENDENT" | "LOCAL";
const RIGHTS: readonly CreativeControlLevel[] = ["NONE", "CONSULTATION", "PROTECTED_FINISHES", "FULL_APPROVAL"];
const SEEDS: Record<Cohort, number[]> = {
  PROCEDURAL: [91301, 91302, 91303, 91304],
  REAL_ROSTER: [91305, 91306, 91307],
};
const WEEKS = 52;
const matches = (state: WorldState) => state.matches.filter(m => m.status === "COMPLETED").length;
const events = (state: WorldState) => state.events.filter(e => e.status === "COMPLETED").length;
const cancelled = (state: WorldState) => state.events.filter(e => e.status === "CANCELLED").length;
const pct = (n: number, d: number) => d > 0 ? Number((100 * n / d).toFixed(2)) : null;

interface AccessibleMarket {
  independentPromotions: number;
  medianAccessibleWrestlers: number;
  minAccessibleWrestlers: number;
  medianInterestedWrestlers: number;
  minInterestedWrestlers: number;
  medianEstablishedWrestlers: number;
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor((sorted.length - 1) / 2)]!;
}

function independentMarket(state: WorldState): AccessibleMarket {
  const indies = state.promotions.filter(p => p.tier === "INDEPENDENT"
    && p.lifecycle === "ACTIVE" && p.playerTakeoverEligibility === "STANDARD");
  const eligible: number[] = [];
  const interested: number[] = [];
  const established: number[] = [];
  // This models only the *technical and bargaining opportunity* for a new
  // indie owner; it cannot prove actual interest or acceptance rates.
  for (const promotion of indies) {
    let count = 0, interestCount = 0, recognisable = 0;
    for (const person of state.people) {
      if (person.status !== "ACTIVE") continue;
      const market = Math.max(1, marketWeeklyValue(person));
      const terms = {
        family: "LIMITED_NON_EXCLUSIVE" as const,
        exclusivity: "NON_EXCLUSIVE" as const,
        roleExpectation: "FEATURED" as const,
        startDate: { ...state.world.currentDate },
        endDate: addPpwWeeks(state.world.currentDate, 12, state.ruleset.weeksPerYear),
        dateEntitlement: 4,
        weeklyGuarantee: Math.round(market * 0.2),
        appearanceFee: market,
        signingBonus: market,
      };
      if (!canAcceptContractTerms(state, person, terms).ok) continue;
      count++;
      if (person.recognition >= 60) recognisable++;
      const offer: ContractOffer = {
        ...terms,
        id: `audit-market:${promotion.id}:${person.id}`,
        worldId: state.world.id, personId: person.id, promotionId: promotion.id,
        submittedDate: { ...state.world.currentDate },
        offerKind: "RECRUITMENT", status: "PENDING",
        resolvedUtility: null, rejectionReason: null,
      };
      const utility = evaluateContractOffer(state, offer);
      if (utility >= state.ruleset.offerAcceptanceThreshold - 12) interestCount++;
    }
    eligible.push(count);
    interested.push(interestCount);
    established.push(recognisable);
  }
  return {
    independentPromotions: indies.length,
    medianAccessibleWrestlers: median(eligible),
    minAccessibleWrestlers: eligible.length ? Math.min(...eligible) : 0,
    medianInterestedWrestlers: median(interested),
    minInterestedWrestlers: interested.length ? Math.min(...interested) : 0,
    medianEstablishedWrestlers: median(established),
  };
}

interface CreativeRefusalPattern {
  wrestlerId: string;
  wrestlerName: string;
  promotionName: string;
  refusals: number;
  firstPpwWeek: string;
  lastPpwWeek: string;
  minDecisionScore: number;
  maxDecisionScore: number;
}

interface AuditRow {
  cohort: Cohort; seed: number; scenario: Scenario; weeks: number;
  distinctCreativeRefusers: number;
  topCreativeRefusers: CreativeRefusalPattern[];
  offers: number; accepted: number; acceptedPercent: number | null;
  offersByRight: Record<CreativeControlLevel, number>;
  acceptedByRight: Record<CreativeControlLevel, number>;
  acceptedByPromotionTier: Record<Tier, Record<CreativeControlLevel, number>>;
  activeSignedByRight: Record<CreativeControlLevel, number>;
  automatedApproved: number; automatedDeclined: number;
  protectedFinishes: number; matchCount: number; completedShows: number;
  cancelledShows: number; showCancellationPercent: number | null;
  marketAtGenesis: AccessibleMarket; marketAtYearEnd: AccessibleMarket;
  activePromotionsAtYearEnd: number;
  operationalErrors: string[];
}

function counts(): Record<CreativeControlLevel, number> {
  return { NONE: 0, CONSULTATION: 0, PROTECTED_FINISHES: 0, FULL_APPROVAL: 0 };
}

function byTier(): Record<Tier, Record<CreativeControlLevel, number>> {
  return {
    GLOBAL: counts(), NATIONAL: counts(), RISING: counts(),
    INDEPENDENT: counts(), LOCAL: counts(),
  };
}

function makeWorld(seed: number, cohort: Cohort): WorldState {
  return cohort === "PROCEDURAL"
    ? createWorld(seed, DEFAULT_RULESET)
    : createWorld(
      seed, REAL_WORLD_ALPHA_RULESET, "PPW Contract Rights Audit",
      calibratedRealActiveMixedRosterSource,
      realPromotionEcosystemSource,
      realWorldInitialRosterAssignmentSource,
    );
}

function measure(cohort: Cohort, seed: number, scenario: Scenario): AuditRow {
  const state = makeWorld(seed, cohort);
  const genesis = independentMarket(state);
  for (let week = 0; week < WEEKS; week++) {
    const previousOfferCount = state.contractOffers.length;
    resolveWorldWeek(state, scenario === "NO_NEW_AI_RIGHTS"
      ? { afterAiContractOffers: (world) => {
        for (let i = previousOfferCount; i < world.contractOffers.length; i++) {
          const offer = world.contractOffers[i]!;
          const promotion = world.promotions.find(p => p.id === offer.promotionId);
          if (promotion?.controllerType === "AI") offer.creativeControl = "NONE";
        }
      } }
      : {});
  }

  const errs = validateWorldInvariants(state);
  const aiIds = new Set(state.promotions.filter(p => p.controllerType === "AI").map(p => p.id));
  const offers = state.contractOffers.filter(o =>
    aiIds.has(o.promotionId) && o.offerKind !== "DATES_ADDENDUM");
  const accepted = offers.filter(o => o.status === "ACCEPTED");
  const offerRights = counts(), acceptedRights = counts(), activeRights = counts();
  const tierRights = byTier();
  for (const offer of offers) offerRights[resolvedCreativeControl(offer.creativeControl)]++;
  for (const offer of accepted) {
    const level = resolvedCreativeControl(offer.creativeControl);
    acceptedRights[level]++;
    const tier = state.promotions.find(p => p.id === offer.promotionId)!.tier;
    tierRights[tier][level]++;
  }
  for (const signed of state.contracts) {
    if (signed.status !== "SIGNED" || !aiIds.has(signed.promotionId)) continue;
    activeRights[resolvedCreativeControl(signed.creativeControl)]++;
  }
  const eventCount = events(state);
  const cancelledCount = cancelled(state);
  const refusalCounts = new Map<string, CreativeRefusalPattern>();
  for (const item of state.ledger.filter(x => x.type === "AUTOMATED_CREATIVE_MATCH_DECLINED")) {
    // Ledger entityIds: event, promotion, wrestler, contract.
    const wrestlerId = item.entityIds[2] ?? "";
    const promotionId = item.entityIds[1] ?? "";
    const key = `${promotionId}:${wrestlerId}`;
    const decisionScore = Number(item.payload.score);
    const dateLabel = `Y${item.date.year} W${item.date.week}`;
    const prior = refusalCounts.get(key);
    if (prior) {
      prior.refusals += 1;
      prior.lastPpwWeek = dateLabel;
      prior.minDecisionScore = Math.min(prior.minDecisionScore, decisionScore);
      prior.maxDecisionScore = Math.max(prior.maxDecisionScore, decisionScore);
    } else {
      refusalCounts.set(key, {
        wrestlerId,
        wrestlerName: state.people.find(person => person.id === wrestlerId)?.name ?? wrestlerId,
        promotionName: state.promotions.find(promotion => promotion.id === promotionId)?.name ?? promotionId,
        refusals: 1, firstPpwWeek: dateLabel, lastPpwWeek: dateLabel,
        minDecisionScore: decisionScore, maxDecisionScore: decisionScore,
      });
    }
  }
  const topRefusers = [...refusalCounts.values()]
    .sort((a, b) => b.refusals - a.refusals || a.wrestlerId.localeCompare(b.wrestlerId))
    .slice(0, 5);
  return {
    cohort, seed, scenario, weeks: WEEKS,
    distinctCreativeRefusers: refusalCounts.size,
    topCreativeRefusers: topRefusers,
    offers: offers.length, accepted: accepted.length,
    acceptedPercent: pct(accepted.length, offers.length),
    offersByRight: offerRights, acceptedByRight: acceptedRights,
    acceptedByPromotionTier: tierRights,
    activeSignedByRight: activeRights,
    automatedApproved: state.ledger.filter(x => x.type === "AUTOMATED_CREATIVE_MATCH_APPROVED").length,
    automatedDeclined: state.ledger.filter(x => x.type === "AUTOMATED_CREATIVE_MATCH_DECLINED").length,
    protectedFinishes: state.ledger.filter(x => x.type === "AUTOMATED_CREATIVE_FINISH_PROTECTED").length,
    matchCount: matches(state), completedShows: eventCount,
    cancelledShows: cancelledCount,
    showCancellationPercent: pct(cancelledCount, eventCount + cancelledCount),
    marketAtGenesis: genesis,
    marketAtYearEnd: independentMarket(state),
    activePromotionsAtYearEnd: state.promotions.filter(p => p.lifecycle === "ACTIVE").length,
    operationalErrors: errs,
  };
}

interface PairedDifference {
  cohort: Cohort; seed: number;
  deltaOfferAcceptancePp: number | null;
  deltaCancelledShows: number; deltaCreativeDeclines: number;
  deltaCompletedMatches: number; deltaIndependentAccess: number;
  deltaIndependentInterest: number;
}

const rows: AuditRow[] = [];
const differences: PairedDifference[] = [];
let failed = false;
for (const cohort of ["PROCEDURAL", "REAL_ROSTER"] as const) {
  for (const seed of SEEDS[cohort]) {
    const policy = measure(cohort, seed, "CREATIVE_POLICY");
    const control = measure(cohort, seed, "NO_NEW_AI_RIGHTS");
    rows.push(policy, control);
    const difference: PairedDifference = {
      cohort, seed,
      deltaOfferAcceptancePp: policy.acceptedPercent !== null && control.acceptedPercent !== null
        ? Number((policy.acceptedPercent - control.acceptedPercent).toFixed(2)) : null,
      deltaCancelledShows: policy.cancelledShows - control.cancelledShows,
      deltaCreativeDeclines: policy.automatedDeclined - control.automatedDeclined,
      deltaCompletedMatches: policy.matchCount - control.matchCount,
      deltaIndependentAccess: policy.marketAtYearEnd.minAccessibleWrestlers
        - control.marketAtYearEnd.minAccessibleWrestlers,
      deltaIndependentInterest: policy.marketAtYearEnd.minInterestedWrestlers
        - control.marketAtYearEnd.minInterestedWrestlers,
    };
    differences.push(difference);
    console.log("CREATIVE_AUDIT_PAIR " + JSON.stringify({
      cohort, seed, policy: {
        offers: policy.offers, accepted: policy.accepted,
        offerRights: policy.offersByRight, signedRights: policy.acceptedByRight,
        acceptedPercent: policy.acceptedPercent,
        completedMatches: policy.matchCount, cancelled: policy.cancelledShows,
        creativeDeclines: policy.automatedDeclined,
        distinctCreativeRefusers: policy.distinctCreativeRefusers,
        topCreativeRefusers: policy.topCreativeRefusers,
        market: policy.marketAtYearEnd,
      },
      control: {
        offers: control.offers, accepted: control.accepted,
        completedMatches: control.matchCount, cancelled: control.cancelledShows,
        creativeDeclines: control.automatedDeclined,
        market: control.marketAtYearEnd,
      }, difference,
    }));
    if (policy.operationalErrors.length || control.operationalErrors.length) {
      failed = true;
      console.error(`FAIL invariant cohort=${cohort} seed=${seed}: ${JSON.stringify([
        ...policy.operationalErrors.slice(0, 4),
        ...control.operationalErrors.slice(0, 4),
      ])}`);
    }
    if (policy.offers === 0 || control.offers === 0) {
      failed = true;
      console.error(`FAIL audit fixture generated zero offers cohort=${cohort} seed=${seed}`);
    }
  }
}

const avg = (list: number[]) => list.length
  ? Number((list.reduce((a, b) => a + b, 0) / list.length).toFixed(2)) : 0;
const totals = rows.filter(r => r.scenario === "CREATIVE_POLICY");
const aggregateOffers = totals.reduce((s, r) => s + r.offers, 0);
const aggregateAccepts = totals.reduce((s, r) => s + r.accepted, 0);
const rightCounts = counts();
const acceptedRightCounts = counts();
for (const row of totals) for (const right of RIGHTS) {
  rightCounts[right] += row.offersByRight[right];
  acceptedRightCounts[right] += row.acceptedByRight[right];
}
const summary = {
  seedsPerCohort: Object.fromEntries(
    (["PROCEDURAL", "REAL_ROSTER"] as const).map(cohort => [cohort, SEEDS[cohort]]),
  ),
  weeksPerWorld: WEEKS,
  worldRuns: rows.length,
  simulatedPpwWeeks: rows.length * WEEKS,
  aggregateOffers, aggregateAccepts, acceptancePercent: pct(aggregateAccepts, aggregateOffers),
  offersByRight: rightCounts, acceptedByRight: acceptedRightCounts,
  shareOffersWithBlockingRightsPct: pct(
    rightCounts.PROTECTED_FINISHES + rightCounts.FULL_APPROVAL, aggregateOffers,
  ),
  avgDeltaCompletedMatches: avg(differences.map(d => d.deltaCompletedMatches)),
  avgDeltaCancelledShows: avg(differences.map(d => d.deltaCancelledShows)),
  avgDeltaCreativeDeclines: avg(differences.map(d => d.deltaCreativeDeclines)),
  avgDeltaMinIndependentAccess: avg(differences.map(d => d.deltaIndependentAccess)),
  avgDeltaMinIndependentInterest: avg(differences.map(d => d.deltaIndependentInterest)),
  minIndependentMarketInterested: Math.min(...totals.map(r => r.marketAtYearEnd.minInterestedWrestlers)),
  maxRefusalsFromOneWrestler: Math.max(0,
    ...totals.flatMap(r => r.topCreativeRefusers.map(person => person.refusals))),
  maxDistinctRefusersInOneSeed: Math.max(...totals.map(r => r.distinctCreativeRefusers)),
  anyInvariantViolations: failed,
  // Diagnostics rather than an arbitrary tuning verdict; thresholds for
  // acceptable match loss, market access and rights prevalence require review.
  watchlist: {
    anyScenarioWithCancelledShowIncrease: differences.some(d => d.deltaCancelledShows > 0),
    anyScenarioWithFewerCompletedMatches: differences.some(d => d.deltaCompletedMatches < 0),
    anyScenarioWithLessMarketAccess: differences.some(d => d.deltaIndependentAccess < 0),
    anyScenarioWithNoInterestedIndieCandidates: totals.some(r =>
      r.marketAtYearEnd.independentPromotions > 0 && r.marketAtYearEnd.minInterestedWrestlers === 0),
    noBlockingRightsActuallyOffered: rightCounts.PROTECTED_FINISHES + rightCounts.FULL_APPROVAL === 0,
    repeatedRefusalLoopFourOrMoreWeeks: totals.some(r =>
      r.topCreativeRefusers.some(person => person.refusals >= 4)),
  },
};
mkdirSync("artifacts", { recursive: true });
writeFileSync("artifacts/creative-multiseed-audit.json",
  JSON.stringify({ summary, differences, rows }, null, 2) + "\n");
console.log("CREATIVE_AUDIT_SUMMARY " + JSON.stringify(summary));
if (failed) process.exitCode = 1;
