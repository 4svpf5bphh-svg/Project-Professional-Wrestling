/**
 * PPW indie-owner baseline, without simulated extra simulation power.
 *
 * Two persisted Alpha Worlds: a human promoter claims a normal indie,
 * proactively negotiates genuine addenda/recruitment via Web Talent, and
 * saves its scripted card, and advances through canonical World Lock.
 *
 * No artificially replenished dates, forced signatures, cash injections or
 * private sim shortcuts. Offers resolve only at canonical World Lock and
 * can reject without giving the player usable appearances.
 */
declare const process: { exitCode?: number };

import { mkdirSync, writeFileSync } from "node:fs";
import { InMemoryApplicationWorldRepository } from "../packages/persistence/src/index.js";
import {
  advanceAlphaWorldWeek, claimAlphaPromotion,
  createAlphaWorldAggregate, loadAlphaPlayerSession,
  saveAlphaCurrentWeekShowPlan,
} from "../packages/web-adapter/src/alpha-service.js";
import {
  loadAlphaCurrentWeekCard, saveAlphaCurrentWeekCard, type AlphaCardMatchView,
} from "../packages/web-adapter/src/card-service.js";
import {
  canAddLimitedContractDates, contractIsActive, marketWeeklyValue,
  promotionShowSeriesDueForDate, validateWorldInvariants,
} from "../packages/sim-core/src/index.js";
import {
  loadAlphaTalentSession, submitAlphaDatesAddendum, submitAlphaTalentOffer,
} from "../packages/web-adapter/src/talent-service.js";
import type { WorldState } from "../packages/domain/src/types.js";

const WEEKS = 26;
const CASES = [
  { seed: 94271, playerId: "indie-baseline-a", promotionIndex: 0, ticketStrategy: "ACCESSIBLE" as const },
  { seed: 94272, playerId: "indie-baseline-b", promotionIndex: 1, ticketStrategy: "STANDARD" as const },
] as const;

function usableSameDivisionRoster(
  state: WorldState, view: NonNullable<Awaited<ReturnType<typeof loadAlphaPlayerSession>>["promotion"]>,
): string[] {
  const divisionById = new Map(state.people.map(person => [person.id, person.division ?? "MEN"] as const));
  const usable = view.roster.filter(person => person.status === "ACTIVE" && person.datesRemaining > 0);
  // A modest indie card rather than the inherited-roster stress test's
  // ten-wrestler bill. Prioritise dates still owed, then lower appearance
  // fees. This consumes real contractual rights and real event payroll.
  const feeById = new Map(state.contracts
    .filter(contract => contract.promotionId === view.promotionId && contract.status === "SIGNED")
    .map(contract => [contract.personId, contract.appearanceFee] as const));
  usable.sort((a, b) => b.datesRemaining - a.datesRemaining
    || (feeById.get(a.personId) ?? 0) - (feeById.get(b.personId) ?? 0)
    || a.personId.localeCompare(b.personId));
  const groups = (["MEN", "WOMEN"] as const)
    .map(division => usable.filter(person => divisionById.get(person.personId) === division))
    .sort((a, b) => b.length - a.length);
  const minimum = view.showPlanning.minParticipants + (view.showPlanning.minParticipants % 2);
  const largest = groups.find(group => group.length >= minimum);
  if (!largest) return [];
  const count = Math.min(largest.length - (largest.length % 2), view.showPlanning.maxParticipants, 6);
  return count >= minimum ? largest.slice(0, count).map(person => person.personId) : [];
}

function authoredSinglesCard(ids: readonly string[], week: number): AlphaCardMatchView[] {
  const matches: AlphaCardMatchView[] = [];
  for (let index = 0; index < ids.length; index += 2) {
    matches.push({
      draftMatchId: `onboarding-week-${week}-match-${index / 2 + 1}`,
      type: "SINGLES",
      sideAIds: [ids[index]!],
      sideBIds: [ids[index + 1]!],
      intendedWinnerSide: index % 4 === 0 ? "A" : "B",
      intent: index === ids.length - 2 ? "STORY" : "COMPETITIVE",
      plannedLengthMinutes: 10 + Math.floor(index / 2) * 2,
    });
  }
  return matches;
}

interface NegotiationRecord {
  week: number;
  kind: "DATES_ADDENDUM" | "RECRUITMENT";
  offerId: string;
  amount: number;
  personId: string;
  originalContractId: string | null;
  status: string;
  rejectionReason: string | null;
}

async function makeFairOffers(
  repository: InMemoryApplicationWorldRepository,
  worldId: string, playerId: string, promotionId: string,
  week: number, records: NegotiationRecord[],
): Promise<void> {
  // Decisions at useful planning intervals, rather than free instant date
  // replenishment. Both offers and consent must survive World Resolution.
  if (![5, 8, 11, 14, 17, 20, 23].includes(week)) return;
  const aggregate = await repository.load(worldId);
  const state = aggregate.state;
  const personById = new Map(state.people.map(person => [person.id, person] as const));
  const own = state.contracts.filter(contract => contract.promotionId === promotionId
    && contract.status === "SIGNED" && contractIsActive(state, contract));
  const eligible = own
    .filter(contract => contract.family === "LIMITED_NON_EXCLUSIVE")
    .map(contract => ({ contract, person: personById.get(contract.personId) }))
    .filter((entry): entry is { contract: typeof own[number]; person: NonNullable<typeof entry.person> } => !!entry.person)
    .filter(({ contract, person }) => {
      const remaining = contract.dateEntitlement - contract.datesUsed;
      return remaining <= 4 && canAddLimitedContractDates(state, person, contract, 1).ok;
    })
    .sort((a, b) => (a.contract.dateEntitlement - a.contract.datesUsed)
      - (b.contract.dateEntitlement - b.contract.datesUsed) || a.contract.id.localeCompare(b.contract.id));
  // A player can renegotiate selected talent, not magically refresh the
  // whole roster at once. Test 4 addenda each negotiation opportunity.
  for (const { contract, person } of eligible.slice(0, 4)) {
    const more = canAddLimitedContractDates(state, person, contract, 2).ok ? 2 : 1;
    const market = Math.max(1, marketWeeklyValue(person));
    const paid = Math.round(market * more * 1.8);
    try {
      const receipt = await submitAlphaDatesAddendum(repository, worldId, playerId, {
        requestId: `engaged-dates-${week}-${contract.id}`,
        personId: person.id, contractId: contract.id,
        additionalDates: more, additionalPayment: paid,
      });
      records.push({
        week, kind: "DATES_ADDENDUM", offerId: receipt.offerId,
        amount: paid, personId: person.id, originalContractId: contract.id,
        status: "PENDING", rejectionReason: null,
      });
    } catch (error) {
      // A failed player-authored negotiation must not silently grant dates.
      records.push({
        week, kind: "DATES_ADDENDUM", offerId: "",
        amount: paid, personId: person.id, originalContractId: contract.id,
        status: "SUBMISSION_REJECTED",
        rejectionReason: error instanceof Error ? error.message : String(error),
      });
    }
  }
  if (![8, 11, 14, 17, 20].includes(week)) return;
  const marketView = await loadAlphaTalentSession(repository, worldId, playerId);
  const rosterDivision = (["MEN", "WOMEN"] as const).map(division => ({
    division, count: marketView.roster.filter(p => p.division === division).length,
  })).sort((a, b) => b.count - a.count)[0]?.division ?? "MEN";
  const currentNewOffers = records.filter(r => r.kind === "RECRUITMENT" && r.offerId).length;
  if (currentNewOffers >= 8) return;
  const cash = state.promotions.find(p => p.id === promotionId)?.cash ?? 0;
  const candidates = marketView.market.filter(p =>
    p.status === "ACTIVE"
    && p.division === rosterDivision && !p.hasOurPendingOffer
    && ["FREE_AGENT", "NON_EXCLUSIVE"].includes(p.availability)
    && ["KEEN", "INTERESTED", "OPEN_TO_TALKS"].includes(p.interest))
    .filter(p => {
      const value = Math.max(1, p.estimatedWeeklyValue);
      // Full-cost exposure: 13 weeks wages + five possible appearance fees
      // + signing bonus. Keep a real contingency instead of unbounded bids.
      return value * (13 * 0.25 + 5 * 1.2 + 2.0) < cash * 0.18;
    })
    .sort((a, b) => a.estimatedWeeklyValue - b.estimatedWeeklyValue
      || b.recognition - a.recognition || a.personId.localeCompare(b.personId));
  for (const candidate of candidates.slice(0, Math.min(2, 8 - currentNewOffers))) {
    const value = Math.max(1, candidate.estimatedWeeklyValue);
    const paid = Math.round(value * 2);
    try {
      const receipt = await submitAlphaTalentOffer(repository, worldId, playerId, {
        requestId: `engaged-recruit-${week}-${candidate.personId}`,
        personId: candidate.personId, sourceContractId: null,
        family: "LIMITED_NON_EXCLUSIVE", roleExpectation: candidate.suggestedRoleExpectation,
        creativeControl: "NONE", termWeeks: 13, dateEntitlement: 5,
        weeklyGuarantee: Math.round(value * 0.25),
        appearanceFee: Math.round(value * 1.2),
        signingBonus: paid,
      });
      records.push({
        week, kind: "RECRUITMENT", offerId: receipt.offerId,
        amount: paid, personId: candidate.personId, originalContractId: null,
        status: "PENDING", rejectionReason: null,
      });
    } catch (error) {
      records.push({
        week, kind: "RECRUITMENT", offerId: "",
        amount: paid, personId: candidate.personId, originalContractId: null,
        status: "SUBMISSION_REJECTED",
        rejectionReason: error instanceof Error ? error.message : String(error),
      });
    }
  }
}

async function scenario(c: typeof CASES[number]) {
  const repository = new InMemoryApplicationWorldRepository();
  const aggregate = createAlphaWorldAggregate({ seed: c.seed, playerId: c.playerId });
  const eligible = aggregate.state.promotions
    .filter(p => p.playerTakeoverEligibility === "STANDARD" && p.lifecycle === "ACTIVE")
    .sort((a, b) => a.id.localeCompare(b.id));
  const independent = eligible[c.promotionIndex];
  if (!independent) throw new Error("scenario has no takeover-eligible indie");
  await repository.initialize(aggregate);
  const worldId = aggregate.state.world.id;
  await claimAlphaPromotion(repository, worldId, c.playerId, {
    promotionId: independent.id, requestId: `baseline-claim-${c.seed}`, takeoverMode: "CONTINUE",
  });
  const initialCash = (await repository.load(worldId)).state.promotions
    .find(p => p.id === independent.id)!.cash;
  const weekly: Array<{
    elapsedWeek: number; ppwYear: number; ppwWeek: number; showDue: number;
    playerBookedShow: boolean; cardAuthored: boolean; rosterAvailable: number;
    cashBefore: number; cashAfter: number; playerShowCompleted: number;
    staffTakeoversThisWeek: number; bookingError: string | null;
    progressionError: string | null;
  }> = [];
  const negotiations: NegotiationRecord[] = [];
  let blockedWeek: number | null = null;
  let blockedReason: string | null = null;
  for (let week = 1; week <= WEEKS; week++) {
    const before = await repository.load(worldId);
    const state = before.state;
    const promotion = state.promotions.find(p => p.id === independent.id)!;
    const date = { ...state.world.currentDate };
    const cashAtStart = promotion.cash;
    const due = promotionShowSeriesDueForDate(state, independent.id, date).length;
    await makeFairOffers(repository, worldId, c.playerId, independent.id, week, negotiations);
    const session = await loadAlphaPlayerSession(repository, worldId, c.playerId);
    if (!session.promotion) throw new Error("owned indie not exposed in session");
    const participants = usableSameDivisionRoster(state, session.promotion);
    let booked = false, authored = false, bookingError: string | null = null;
    if (due > 0) {
      if (!participants.length) {
        bookingError = "insufficient usable, same-division inherited wrestler dates";
      } else if (!session.promotion.showPlanning.canPlanThisWeek) {
        bookingError = "show required but current-week planner is not editable";
      } else {
        const market = session.promotion.showPlanning.markets
          .find(m => m.marketId === promotion.homeMarketId)
          ?? session.promotion.showPlanning.markets[0];
        const venue = market?.venues[0];
        if (!market || !venue) bookingError = "no valid player-selected market/venue";
        else try {
          await saveAlphaCurrentWeekShowPlan(repository, worldId, c.playerId, {
            requestId: `baseline-show-${c.seed}-${week}`,
            expectedRevision: session.world.revision,
            expectedPlanVersion: session.promotion.showPlanning.workspaceVersion,
            day: 6, marketId: market.marketId, venueId: venue.venueId,
            ticketStrategy: c.ticketStrategy, participantIds: participants,
          });
          booked = true;
          const card = await loadAlphaCurrentWeekCard(repository, worldId, c.playerId);
          await saveAlphaCurrentWeekCard(repository, worldId, c.playerId, {
            requestId: `baseline-card-${c.seed}-${week}`,
            expectedRevision: card.world.revision,
            expectedPlanVersion: card.workspaceVersion,
            matches: authoredSinglesCard(participants, week),
            championshipAssignments: [],
          });
          authored = true;
        } catch (error) {
          bookingError = error instanceof Error ? error.message : String(error);
        }
      }
    }

    const beforeResolve = await repository.load(worldId);
    let progressionError: string | null = null;
    try {
      await advanceAlphaWorldWeek(repository, worldId, c.playerId, {
        expectedRevision: beforeResolve.runtime.revision,
      });
    } catch (error) {
      progressionError = error instanceof Error ? error.message : String(error);
      blockedWeek = week;
      blockedReason = progressionError;
    }
    const after = await repository.load(worldId);
    // Read real server decisions after the single canonical weekly pass.
    for (const record of negotiations) {
      if (record.status !== "PENDING") continue;
      const offer = after.state.contractOffers.find(candidate => candidate.id === record.offerId);
      if (offer?.status && offer.status !== "PENDING") {
        record.status = offer.status;
        record.rejectionReason = offer.rejectionReason;
      }
    }
    const fromThisWeek = (entry: { date: { year: number; week: number } }) =>
      entry.date.year === date.year && entry.date.week === date.week;
    weekly.push({
      elapsedWeek: week, ppwYear: date.year, ppwWeek: date.week, showDue: due,
      playerBookedShow: booked, cardAuthored: authored,
      rosterAvailable: participants.length, cashBefore: cashAtStart,
      cashAfter: after.state.promotions.find(p => p.id === independent.id)!.cash,
      playerShowCompleted: after.state.events.filter(event => event.promotionId === independent.id
        && event.status === "COMPLETED" && fromThisWeek(event)).length,
      staffTakeoversThisWeek: after.state.ledger.filter(entry =>
        entry.type === "HUMAN_ROUTINE_CONTINUITY_TAKEOVER"
        && entry.entityIds.includes(independent.id) && fromThisWeek(entry)).length,
      bookingError, progressionError,
    });
    if (progressionError) break;
  }
  const final = (await repository.load(worldId)).state;
  const closing = final.promotions.find(p => p.id === independent.id)!;
  const categories: Record<string, number> = {};
  for (const tx of final.financialTransactions.filter(tx => tx.promotionId === independent.id)) {
    categories[tx.category] = (categories[tx.category] ?? 0) + tx.amount;
  }
  const events = final.events.filter(event => event.promotionId === independent.id);
  const errors = validateWorldInvariants(final);
  return {
    seed: c.seed, company: independent.name, playerId: c.playerId,
    ticketStrategy: c.ticketStrategy, plannedWeeks: WEEKS,
    advancedWeeks: weekly.filter(w => w.progressionError === null).length,
    blockedWeek, blockedReason,
    initialCash, finalCash: closing.cash, cashDelta: closing.cash - initialCash,
    finalRunwayWeeks: closing.runwayWeeks,
    finalFinancialDistress: closing.financialDistress,
    bookedWeeks: weekly.filter(w => w.playerBookedShow).length,
    authoredWeeks: weekly.filter(w => w.cardAuthored).length,
    dueShowOccurrences: weekly.reduce((sum, w) => sum + w.showDue, 0),
    completedShows: events.filter(event => event.status === "COMPLETED").length,
    cancelledShows: events.filter(event => event.status === "CANCELLED").length,
    staffTakeovers: weekly.reduce((sum, w) => sum + w.staffTakeoversThisWeek, 0),
    negotiations, acceptedAddenda: negotiations.filter(n => n.kind === "DATES_ADDENDUM" && n.status === "ACCEPTED").length,
    acceptedRecruitments: negotiations.filter(n => n.kind === "RECRUITMENT" && n.status === "ACCEPTED").length,
    rejectedNegotiations: negotiations.filter(n => n.status === "REJECTED" || n.status === "SUBMISSION_REJECTED").length,
    cardOrReservationFailures: weekly.filter(w => w.bookingError !== null).length,
    completedShowNet: events.filter(event => event.status === "COMPLETED")
      .reduce((sum, event) => sum + event.netResult, 0),
    financeCategories: categories,
    rosterAtEnd: new Set(final.contracts.filter(contract =>
      contract.promotionId === independent.id && contract.status === "SIGNED")
      .map(contract => contract.personId)).size,
    invariantErrors: errors.slice(0, 12),
    weekly,
  };
}

const cases = [];
for (const c of CASES) {
  const result = await scenario(c);
  cases.push(result);
  console.log("HUMAN_INDIE_ENGAGED_CASE " + JSON.stringify({
    seed: result.seed, company: result.company, ticketStrategy: result.ticketStrategy,
    advancedWeeks: result.advancedWeeks, finalCash: result.finalCash,
    cashDelta: result.cashDelta, dueShowOccurrences: result.dueShowOccurrences,
    bookedWeeks: result.bookedWeeks, authoredWeeks: result.authoredWeeks,
    completedShows: result.completedShows, cancelledShows: result.cancelledShows,
    staffTakeovers: result.staffTakeovers, acceptedAddenda: result.acceptedAddenda,
    acceptedRecruitments: result.acceptedRecruitments,
    rejectedNegotiations: result.rejectedNegotiations,
    cardOrReservationFailures: result.cardOrReservationFailures,
    blockedWeek: result.blockedWeek, blockedReason: result.blockedReason,
    invariantErrors: result.invariantErrors,
  }));
}
const summary = {
  observational: true,
  weeksPerScenario: WEEKS,
  caseCount: cases.length,
  totalAdvancedWeeks: cases.reduce((sum, c) => sum + c.advancedWeeks, 0),
  anyWorldInvariants: cases.some(c => c.invariantErrors.length > 0),
  stoppedEarly: cases.filter(c => c.blockedWeek !== null).length,
  unableToAuthorAllDueShows: cases.some(c => c.authoredWeeks < c.dueShowOccurrences),
  anyIndieCashCrisis: cases.some(c => c.finalCash <= 0),
  cases: cases.map(c => ({
    seed: c.seed, company: c.company, cashDelta: c.cashDelta,
    advancedWeeks: c.advancedWeeks, completedShows: c.completedShows,
    authoredWeeks: c.authoredWeeks, staffTakeovers: c.staffTakeovers,
    acceptedAddenda: c.acceptedAddenda, acceptedRecruitments: c.acceptedRecruitments,
    rejectedNegotiations: c.rejectedNegotiations,
    cardOrReservationFailures: c.cardOrReservationFailures,
  })),
};
mkdirSync("artifacts", { recursive: true });
writeFileSync("artifacts/human-indie-engaged-26week-audit.json",
  JSON.stringify({ summary, cases }, null, 2) + "\n");
console.log("HUMAN_INDIE_ENGAGED_SUMMARY " + JSON.stringify(summary));
if (summary.anyWorldInvariants) process.exitCode = 1;
