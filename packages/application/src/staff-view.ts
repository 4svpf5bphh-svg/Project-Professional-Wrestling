import type { Id } from "../../domain/src/types.js";
import { activeTalentManager } from "../../sim-core/src/staff.js";
import { canAddLimitedContractDates, marketWeeklyValue } from "../../sim-core/src/contracts.js";
import { activePromotionControlForPlayer, activeWorldMembership } from "./ownership.js";
import { buildPlayerTalentManagementView } from "./talent-view.js";
import { staffRetentionAdvice } from "./staff-retention-advice.js";
import type { ApplicationWorldAggregate } from "./world-aggregate.js";

/** Conservative limits for each player-authorised staff proposal. Manual terms are unaffected. */
export const STAFF_DATES_MAX_PER_OFFER = 4;
export const STAFF_DATES_PAYMENT_CAP = 250_000;

export interface PlayerStaffView {
  world: { worldId: Id; year: number; week: number };
  promotion: { promotionId: Id; name: string } | null;
  talentManager: {
    employmentId: Id;
    staffId: Id;
    name: string;
    weeklySalary: number;
    insight: number;
  } | null;
  availableManagers: Array<{
    staffId: Id;
    name: string;
    insight: number;
    weeklySalary: number;
  }>;
  dateAddendums: Array<{
    personId: Id;
    personName: string;
    contractId: Id;
    datesRemaining: number;
    weeksToExpiry: number;
    appearanceFee: number;
    maxAdditionalDates: number;
    maxOneTimePayment: number;
  }>;
  renewals: Array<{
    personId: Id;
    personName: string;
    contractId: Id;
    weeksToExpiry: number;
    termWeeks: number;
    dates: number;
    weeklyGuarantee: number;
    appearanceFee: number;
    totalPotential: number;
    creativeControl: string;
    /** Staff insight is a read-only warning, never a contract advantage. */
    advice: string;
  }>;
}
export function buildPlayerStaffView(aggregate: ApplicationWorldAggregate, playerId: string): PlayerStaffView {
  const state = aggregate.state;
  if (!activeWorldMembership(aggregate.ownership, playerId)) throw new Error("player is not a World member");
  const control = activePromotionControlForPlayer(aggregate.ownership, playerId);
  const promotion = state.promotions.find(p => p.id === control?.promotionId);
  const manager = promotion ? activeTalentManager(state, promotion.id) : null;
  const busy = new Set((state.staffEmployments ?? []).filter(e => e.status === "ACTIVE").map(e => e.staffId));
  const availableManagers = promotion
    ? (state.staffMembers ?? []).filter(s => s.specialty === "TALENT_MANAGER" && !busy.has(s.id))
      .map(s => ({ staffId: s.id, name: s.name, insight: s.insight, weeklySalary: s.requestedWeeklySalary }))
      .sort((a, b) => a.weeklySalary - b.weeklySalary)
    : [];
  const roster = promotion ? buildPlayerTalentManagementView(aggregate, playerId).roster : [];
  const renewals = roster.flatMap(row => {
    const terms = row.contract.sameTermsRenewal;
    if (!terms || row.contract.renewalReason !== "EXPIRY_WINDOW"
      || (row.scheduledRenewals?.length ?? 0) > 0) return [];
    // Explicit floor applies to all existing exclusive proposals at submission.
    if (terms.family === "EXCLUSIVE"
      && terms.weeklyGuarantee < Math.ceil(marketWeeklyValue(
        state.people.find(person => person.id === row.personId)!) * 0.5)) return [];
    return [{
      personId: row.personId,
      personName: row.name,
      contractId: row.contractId,
      weeksToExpiry: row.contract.weeksToExpiry,
      termWeeks: terms.termWeeks,
      dates: terms.dateEntitlement,
      weeklyGuarantee: terms.weeklyGuarantee,
      appearanceFee: terms.appearanceFee,
      totalPotential: terms.weeklyGuarantee * terms.termWeeks
        + (terms.family === "EXCLUSIVE" ? 0 : terms.appearanceFee * terms.dateEntitlement),
      creativeControl: terms.creativeControl,
      advice: staffRetentionAdvice({
        insight: manager?.member.insight ?? 0,
        morale: row.morale,
        weeklyGuarantee: terms.weeklyGuarantee,
        appearanceFee: terms.appearanceFee,
        dateEntitlement: terms.dateEntitlement,
        termWeeks: terms.termWeeks,
        marketWeeklyEstimate: marketWeeklyValue(state.people.find(person => person.id === row.personId)!),
        weeksToExpiry: row.contract.weeksToExpiry,
      }),
    }];
  }).filter(row => !state.contractOffers.some(offer =>
    offer.status === "PENDING" && offer.promotionId === promotion?.id && offer.personId === row.personId));
  // Shared Staff eligibility is also rechecked by the authoritative service.
  // Signed future renewals do not block an addendum to the CURRENT contract.
  const pendingPeople = new Set(state.contractOffers
    .filter(offer => offer.status === "PENDING" && offer.promotionId === promotion?.id)
    .map(offer => offer.personId));
  const maxOneTimePayment = Math.min(STAFF_DATES_PAYMENT_CAP, Math.max(0, Math.floor(promotion?.cash ?? 0)));
  const dateAddendums = manager ? roster.flatMap(row => {
    if (row.contract.family !== "LIMITED_NON_EXCLUSIVE" || pendingPeople.has(row.personId)) return [];
    const source = state.contracts.find(contract => contract.id === row.contractId && contract.promotionId === promotion?.id);
    const person = state.people.find(candidate => candidate.id === row.personId);
    if (!source || !person) return [];
    let maxAdditionalDates = 0;
    for (let count = 1; count <= STAFF_DATES_MAX_PER_OFFER; count += 1) {
      if (!canAddLimitedContractDates(state, person, source, count).ok) break;
      maxAdditionalDates = count;
    }
    if (!maxAdditionalDates) return [];
    return [{
      personId: row.personId, personName: row.name, contractId: source.id,
      datesRemaining: row.contract.datesRemaining, weeksToExpiry: row.contract.weeksToExpiry,
      appearanceFee: source.appearanceFee, maxAdditionalDates, maxOneTimePayment,
    }];
  }).sort((a, b) => a.datesRemaining - b.datesRemaining || a.personName.localeCompare(b.personName)) : [];
  return {
    world: { worldId: state.world.id, year: state.world.currentDate.year, week: state.world.currentDate.week },
    promotion: promotion ? { promotionId: promotion.id, name: promotion.name } : null,
    talentManager: manager ? {
      employmentId: manager.employment.id, staffId: manager.member.id,
      name: manager.member.name, insight: manager.member.insight,
      weeklySalary: manager.employment.weeklySalary,
    } : null,
    availableManagers: manager ? [] : availableManagers,
    renewals: manager ? renewals.sort((a,b)=>a.weeksToExpiry-b.weeksToExpiry) : [],
    dateAddendums,
  };
}
