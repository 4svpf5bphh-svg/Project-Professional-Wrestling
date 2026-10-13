import type {
  CareerStage,
  ContractFamily,
  CreativeControlLevel,
  ContractOfferStatus,
  ExclusivityType,
  Id,
  InjurySeverity,
  PersonStatus,
  PpwDate,
  RoleExpectation,
  WrestlerDivision,
} from "../../domain/src/types.js";
import type { WrestlerAlignment } from "../../domain/src/alignment.js";
import type { RecruitmentInterestBand } from "../../sim-core/src/contracts.js";
import {
  activeContractsForPerson,
  activeContractsForPromotion,
  comparePpwDates,
  contractIsActive,
  contractRoleExpectationForPerson,
  resolvedCreativeControl,
  currentRosterPersonIds,
  marketWeeklyValue,
  ppwDateToWeekIndex,
  promotionAlignmentChangeContext,
  recruitmentInterestBand,
  wrestlerAffiliationHasBookingRights,
  wrestlerAlignment,
  wrestlerAlignmentForPromotion,
  wrestlerPromotionAffiliationsForPerson,
} from "../../sim-core/src/index.js";
import { talentIsWatched } from "./engagement.js";
import { sameTermsRenewalTemplate, type SameTermsRenewalTemplate } from "./contract-renewal.js";
import {
  activePromotionControlForPlayer,
  activeWorldMembership,
} from "./ownership.js";
import type { ApplicationWorldAggregate } from "./world-aggregate.js";

export interface PlayerTalentInjuryView {
  severity: InjurySeverity;
  weeksRemaining: number;
}

export interface PlayerTalentSkillsView {
  inRingQuality: number;
  matchCraft: number;
  safety: number;
  stamina: number;
  presentation: number;
}

export interface PlayerPublicTalentPromotionView {
  promotionId: Id;
  promotionName: string;
}

export interface PlayerPublicTalentAffiliationView extends PlayerPublicTalentPromotionView {
  role: "PRIMARY" | "SECONDARY";
  basis: "CONTRACT" | "PARENT_COMPANY";
}

export interface PlayerPublicTalentIdentityView {
  personId: Id;
  name: string;
  division: WrestlerDivision;
  careerStage: CareerStage;
  status: PersonStatus;
  biologicalAge: number;
  recognition: number;
  popularity: number;
  momentum: number;
  rosterAffiliations: PlayerPublicTalentAffiliationView[];
  employmentPromotions: PlayerPublicTalentPromotionView[];
}

export interface PlayerRosterContractView extends PlayerPublicTalentIdentityView {
  contractId: Id;
  /** Signed follow-on agreements that are not yet bookable; owner-only. */
  scheduledRenewals?: Array<{
    contractId: Id;
    startDate: PpwDate;
    endDate: PpwDate;
    family: ContractFamily;
    dateEntitlement: number;
    datesUsed: number;
  }>;
  /** Multiple simultaneous signed contracts with this same promotion are a data-integrity concern. */
  concurrentContractCount?: number;
  alignment: WrestlerAlignment;
  alignmentChangeMode: "INITIAL_PRESENTATION" | "JUST_SIGNED" | "RETURNING" | "OFFSCREEN_SWITCH";
  alignmentNaturalReset: boolean;
  morale: number;
  fatigue: number;
  wear: number;
  trust: number;
  skills: PlayerTalentSkillsView;
  estimatedWeeklyValue: number;
  suggestedRoleExpectation: RoleExpectation;
  injury: PlayerTalentInjuryView | null;
  contract: {
    family: ContractFamily;
    exclusivity: ExclusivityType;
    roleExpectation: RoleExpectation;
    creativeControl: CreativeControlLevel;
    startDate: PpwDate;
    endDate: PpwDate;
    weeksToExpiry: number;
    dateEntitlement: number;
    datesUsed: number;
    datesRemaining: number;
    unlimitedAppearances: boolean;
    weeklyGuarantee: number;
    appearanceFee: number;
    signingBonus: number;
    /** Own contract's repeatable terms; excludes historic one-time bonuses. */
    sameTermsRenewal: SameTermsRenewalTemplate | null;
    renewalWindowOpen: boolean;
    renewalReason: "DATES_EXHAUSTED" | "EXPIRY_WINDOW" | null;
  };
}

export interface PlayerTalentMarketView extends PlayerPublicTalentIdentityView {
  alignment: WrestlerAlignment;
  interest: RecruitmentInterestBand;
  watched: boolean;
  skills: PlayerTalentSkillsView;
  estimatedWeeklyValue: number;
  suggestedRoleExpectation: RoleExpectation;
  availability: "FREE_AGENT" | "NON_EXCLUSIVE";
  injury: PlayerTalentInjuryView | null;
  hasOurPendingOffer: boolean;
}

export type PlayerTalentDirectoryStatus =
  | "YOUR_ROSTER"
  | "FREE_AGENT"
  | "NON_EXCLUSIVE"
  | "EXCLUSIVE"
  | "RETIRED";

export interface PlayerTalentDirectoryEntryView extends PlayerPublicTalentIdentityView {
  directoryStatus: PlayerTalentDirectoryStatus;
  watched: boolean;
}

export interface PlayerTalentDirectoryView {
  world: {
    worldId: Id;
    name: string;
    currentDate: PpwDate;
  };
  player: {
    playerId: string;
    promotionId: Id | null;
  };
  promotion: {
    promotionId: Id;
    name: string;
  } | null;
  entries: PlayerTalentDirectoryEntryView[];
}

export interface PlayerPendingContractOfferView {
  offerId: Id;
  personId: Id;
  personName: string;
  offerKind: "RECRUITMENT" | "RENEWAL" | "DATES_ADDENDUM";
  status: ContractOfferStatus;
  submittedDate: PpwDate;
  family: ContractFamily;
  exclusivity: ExclusivityType;
  roleExpectation: RoleExpectation;
  creativeControl: CreativeControlLevel;
  endDate: PpwDate;
  dateEntitlement: number;
  weeklyGuarantee: number;
  appearanceFee: number;
  signingBonus: number;
}

export interface PlayerTalentManagementView {
  world: {
    worldId: Id;
    name: string;
    currentDate: PpwDate;
  };
  player: {
    playerId: string;
    promotionId: Id | null;
  };
  promotion: {
    promotionId: Id;
    name: string;
  } | null;
  roster: PlayerRosterContractView[];
  market: PlayerTalentMarketView[];
  pendingOffers: PlayerPendingContractOfferView[];
}

function activeInjuryForPerson(
  aggregate: ApplicationWorldAggregate,
  personId: Id,
): PlayerTalentInjuryView | null {
  const injury = aggregate.state.injuries
    .filter((candidate) => candidate.personId === personId && candidate.status === "ACTIVE")
    .sort((left, right) => right.weeksRemaining - left.weeksRemaining || right.id.localeCompare(left.id))[0];
  return injury ? { severity: injury.severity, weeksRemaining: injury.weeksRemaining } : null;
}

function weeksToExpiry(aggregate: ApplicationWorldAggregate, endDate: PpwDate): number {
  const current = ppwDateToWeekIndex(aggregate.state.world.currentDate, aggregate.state.ruleset.weeksPerYear);
  const end = ppwDateToWeekIndex(endDate, aggregate.state.ruleset.weeksPerYear);
  return Math.max(0, end - current);
}

function trustFor(
  aggregate: ApplicationWorldAggregate,
  promotionId: Id,
  personId: Id,
): number {
  return aggregate.state.promotionTalentTrust?.find((entry) => (
    entry.promotionId === promotionId && entry.personId === personId
  ))?.trust ?? 50;
}

function publicTalentIdentity(
  aggregate: ApplicationWorldAggregate,
  person: ApplicationWorldAggregate["state"]["people"][number],
): PlayerPublicTalentIdentityView {
  const promotionById = new Map(aggregate.state.promotions.map((promotion) => [promotion.id, promotion]));
  const employmentPromotions = [...new Set(
    activeContractsForPerson(aggregate.state, person.id)
      .filter((contract) => contractIsActive(aggregate.state, contract))
      .map((contract) => contract.promotionId),
  )]
    .map((promotionId) => promotionById.get(promotionId))
    .filter((promotion): promotion is NonNullable<typeof promotion> => promotion !== undefined)
    .sort((left, right) => left.name.localeCompare(right.name))
    .map((promotion) => ({
      promotionId: promotion.id,
      promotionName: promotion.name,
    }));

  const explicitAffiliations = wrestlerPromotionAffiliationsForPerson(aggregate.state, person.id)
    .filter((affiliation) => wrestlerAffiliationHasBookingRights(aggregate.state, affiliation))
    .map((affiliation) => {
      const promotion = promotionById.get(affiliation.promotionId);
      return promotion ? {
        promotionId: promotion.id,
        promotionName: promotion.name,
        role: affiliation.role,
        basis: affiliation.basis,
      } satisfies PlayerPublicTalentAffiliationView : null;
    })
    .filter((affiliation): affiliation is PlayerPublicTalentAffiliationView => affiliation !== null);

  const rosterAffiliations = explicitAffiliations.length > 0
    ? explicitAffiliations
    : employmentPromotions.map((promotion) => ({
      ...promotion,
      role: "PRIMARY" as const,
      basis: "CONTRACT" as const,
    }));

  rosterAffiliations.sort((left, right) => (
    (left.role === "PRIMARY" ? 0 : 1) - (right.role === "PRIMARY" ? 0 : 1)
    || left.promotionName.localeCompare(right.promotionName)
  ));

  return {
    personId: person.id,
    name: person.name,
    division: person.division ?? "MEN",
    careerStage: person.careerStage,
    status: person.status,
    biologicalAge: person.biologicalAge,
    recognition: person.recognition,
    popularity: person.popularity,
    momentum: person.momentum,
    rosterAffiliations,
    employmentPromotions,
  };
}

function publicSkills(person: ApplicationWorldAggregate["state"]["people"][number]): PlayerTalentSkillsView {
  return {
    inRingQuality: person.skills.inRingQuality,
    matchCraft: person.skills.matchCraft,
    safety: person.skills.safety,
    stamina: person.skills.stamina,
    presentation: person.skills.presentation,
  };
}

function signedCurrentOrFutureContracts(
  aggregate: ApplicationWorldAggregate,
  personId: Id,
) {
  return aggregate.state.contracts.filter((contract) => (
    contract.personId === personId
    && contract.status === "SIGNED"
    && comparePpwDates(
      contract.endDate,
      aggregate.state.world.currentDate,
      aggregate.state.ruleset.weeksPerYear,
    ) >= 0
  ));
}

export function buildPlayerTalentDirectoryView(
  aggregate: ApplicationWorldAggregate,
  playerId: string,
): PlayerTalentDirectoryView {
  const membership = activeWorldMembership(aggregate.ownership, playerId);
  if (!membership) throw new Error(`${playerId} is not an active member of ${aggregate.state.world.id}`);
  const control = activePromotionControlForPlayer(aggregate.ownership, playerId);
  const currentDate = { ...aggregate.state.world.currentDate };
  const promotion = control
    ? aggregate.state.promotions.find((candidate) => candidate.id === control.promotionId) ?? null
    : null;
  const ownRosterIds = promotion
    ? new Set(currentRosterPersonIds(aggregate.state, promotion.id))
    : new Set<Id>();

  const entries = aggregate.state.people
    .map((person): PlayerTalentDirectoryEntryView => {
      const signed = signedCurrentOrFutureContracts(aggregate, person.id);
      const active = activeContractsForPerson(aggregate.state, person.id)
        .filter((contract) => contractIsActive(aggregate.state, contract));
      const directoryStatus: PlayerTalentDirectoryStatus = person.status === "RETIRED"
        ? "RETIRED"
        : ownRosterIds.has(person.id)
          ? "YOUR_ROSTER"
          : signed.some((contract) => contract.exclusivity === "EXCLUSIVE")
            ? "EXCLUSIVE"
            : active.length > 0
              ? "NON_EXCLUSIVE"
              : "FREE_AGENT";

      return {
        ...publicTalentIdentity(aggregate, person),
        directoryStatus,
        watched: talentIsWatched(aggregate.engagement, playerId, person.id),
      };
    })
    .sort((left, right) => (
      right.popularity - left.popularity
      || right.recognition - left.recognition
      || left.name.localeCompare(right.name)
    ));

  return {
    world: { worldId: aggregate.state.world.id, name: aggregate.state.world.name, currentDate },
    player: { playerId: membership.playerId, promotionId: promotion?.id ?? null },
    promotion: promotion ? { promotionId: promotion.id, name: promotion.name } : null,
    entries,
  };
}

/**
 * Player-safe Roster / Talent Market projection.
 *
 * Own contract terms and own pending offers are private-but-visible to the
 * controlling player. Market entries expose wrestler/public availability data
 * only: they deliberately do not expose another promotion's salary, dates,
 * bonuses, role, contract ID or pending offers.
 */
export function buildPlayerTalentManagementView(
  aggregate: ApplicationWorldAggregate,
  playerId: string,
): PlayerTalentManagementView {
  const membership = activeWorldMembership(aggregate.ownership, playerId);
  if (!membership) throw new Error(`${playerId} is not an active member of ${aggregate.state.world.id}`);
  const control = activePromotionControlForPlayer(aggregate.ownership, playerId);
  const currentDate = { ...aggregate.state.world.currentDate };

  if (!control) {
    return {
      world: { worldId: aggregate.state.world.id, name: aggregate.state.world.name, currentDate },
      player: { playerId: membership.playerId, promotionId: null },
      promotion: null,
      roster: [],
      market: [],
      pendingOffers: [],
    };
  }

  const promotion = aggregate.state.promotions.find((candidate) => candidate.id === control.promotionId);
  if (!promotion) throw new Error(`controlled promotion ${control.promotionId} no longer exists`);
  const peopleById = new Map(aggregate.state.people.map((person) => [person.id, person]));
  const pendingPersonIds = new Set(
    aggregate.state.contractOffers
      .filter((offer) => offer.promotionId === promotion.id && offer.status === "PENDING")
      .map((offer) => offer.personId),
  );

  // Older Worlds can contain overlapping accepted renewals for one wrestler.
  // Show one roster identity, but retain visible evidence of all signed terms.
  const activeRosterContracts = activeContractsForPromotion(aggregate.state, promotion.id);
  const activeRosterByPerson = new Map<Id, (typeof activeRosterContracts)[number]>();
  for (const contract of activeRosterContracts) {
    const previous = activeRosterByPerson.get(contract.personId);
    if (!previous || comparePpwDates(contract.startDate, previous.startDate, aggregate.state.ruleset.weeksPerYear) > 0
      || (comparePpwDates(contract.startDate, previous.startDate, aggregate.state.ruleset.weeksPerYear) === 0
        && contract.id > previous.id)) {
      activeRosterByPerson.set(contract.personId, contract);
    }
  }

  const roster = [...activeRosterByPerson.values()]
    .map((contract): PlayerRosterContractView | null => {
      const person = peopleById.get(contract.personId);
      if (!person) return null;
      const remaining = weeksToExpiry(aggregate, contract.endDate);
      const datesRemaining = Math.max(0, contract.dateEntitlement - contract.datesUsed);
      const datesExhausted = contract.family === "LIMITED_NON_EXCLUSIVE" && datesRemaining === 0;
      const expiryWindowOpen = remaining <= aggregate.state.ruleset.renewalWindowWeeks;
      const ownSignedContracts = aggregate.state.contracts.filter((candidate) =>
        candidate.promotionId === promotion.id && candidate.personId === contract.personId
          && candidate.status === "SIGNED"
          && comparePpwDates(candidate.endDate, currentDate, aggregate.state.ruleset.weeksPerYear) >= 0);
      const scheduledRenewals = ownSignedContracts
        .filter((candidate) => comparePpwDates(candidate.startDate, currentDate, aggregate.state.ruleset.weeksPerYear) > 0)
        .sort((left, right) =>
          comparePpwDates(left.startDate, right.startDate, aggregate.state.ruleset.weeksPerYear)
          || left.id.localeCompare(right.id))
        .map((candidate) => ({
          contractId: candidate.id,
          startDate: { ...candidate.startDate },
          endDate: { ...candidate.endDate },
          family: candidate.family,
          dateEntitlement: candidate.dateEntitlement,
          datesUsed: candidate.datesUsed,
        }));
      const alignment = wrestlerAlignmentForPromotion(aggregate.state, promotion.id, person.id);
      const alignmentContext = promotionAlignmentChangeContext(aggregate.state, promotion.id, person.id);
      return {
        ...publicTalentIdentity(aggregate, person),
        contractId: contract.id,
        scheduledRenewals,
        concurrentContractCount: activeRosterContracts.filter((candidate) => candidate.personId === contract.personId).length,
        alignment,
        alignmentChangeMode: alignmentContext.method,
        alignmentNaturalReset: alignmentContext.naturalReset,
        morale: person.morale,
        fatigue: person.fatigue,
        wear: person.wear,
        trust: trustFor(aggregate, promotion.id, person.id),
        skills: publicSkills(person),
        estimatedWeeklyValue: marketWeeklyValue(person),
        suggestedRoleExpectation: contractRoleExpectationForPerson(person),
        injury: activeInjuryForPerson(aggregate, person.id),
        contract: {
          family: contract.family,
          exclusivity: contract.exclusivity,
          roleExpectation: contract.roleExpectation,
          creativeControl: resolvedCreativeControl(contract.creativeControl),
          startDate: { ...contract.startDate },
          endDate: { ...contract.endDate },
          weeksToExpiry: remaining,
          dateEntitlement: contract.dateEntitlement,
          datesUsed: contract.datesUsed,
          datesRemaining,
          unlimitedAppearances: contract.family === "EXCLUSIVE",
          weeklyGuarantee: contract.weeklyGuarantee,
          appearanceFee: contract.appearanceFee,
          signingBonus: contract.signingBonus,
          sameTermsRenewal: scheduledRenewals.length > 0 ? null : sameTermsRenewalTemplate(aggregate.state, contract),
          renewalWindowOpen: scheduledRenewals.length === 0 && (datesExhausted || expiryWindowOpen),
          renewalReason: scheduledRenewals.length > 0 ? null : datesExhausted ? "DATES_EXHAUSTED" : expiryWindowOpen ? "EXPIRY_WINDOW" : null,
        },
      };
    })
    .filter((entry): entry is PlayerRosterContractView => entry !== null)
    .sort((left, right) => (
      right.popularity - left.popularity
      || right.recognition - left.recognition
      || left.name.localeCompare(right.name)
    ));

  const rosterPersonIds = new Set(roster.map((entry) => entry.personId));
  const market = aggregate.state.people
    .filter((person) => person.status !== "RETIRED" && !rosterPersonIds.has(person.id))
    .map((person): PlayerTalentMarketView | null => {
      const signed = signedCurrentOrFutureContracts(aggregate, person.id);
      if (signed.some((contract) => contract.exclusivity === "EXCLUSIVE")) return null;
      const activeOutside = activeContractsForPerson(aggregate.state, person.id)
        .filter((contract) => contract.promotionId !== promotion.id && contractIsActive(aggregate.state, contract));
      const alignment = wrestlerAlignment(person, aggregate.state.world.seed);
      return {
        ...publicTalentIdentity(aggregate, person),
        alignment,
        interest: recruitmentInterestBand(aggregate.state, promotion, person),
        watched: talentIsWatched(aggregate.engagement, playerId, person.id),
        skills: publicSkills(person),
        estimatedWeeklyValue: marketWeeklyValue(person),
        suggestedRoleExpectation: contractRoleExpectationForPerson(person),
        availability: activeOutside.length > 0 ? "NON_EXCLUSIVE" : "FREE_AGENT",
        injury: activeInjuryForPerson(aggregate, person.id),
        hasOurPendingOffer: pendingPersonIds.has(person.id),
      };
    })
    .filter((entry): entry is PlayerTalentMarketView => entry !== null)
    .sort((left, right) => (
      right.estimatedWeeklyValue - left.estimatedWeeklyValue
      || right.popularity - left.popularity
      || left.name.localeCompare(right.name)
    ));

  const pendingOffers = aggregate.state.contractOffers
    .filter((offer) => offer.promotionId === promotion.id && offer.status === "PENDING")
    .map((offer): PlayerPendingContractOfferView => ({
      offerId: offer.id,
      personId: offer.personId,
      personName: peopleById.get(offer.personId)?.name ?? "Unknown wrestler",
      offerKind: offer.offerKind,
      status: offer.status,
      submittedDate: { ...offer.submittedDate },
      family: offer.family,
      exclusivity: offer.exclusivity,
      roleExpectation: offer.roleExpectation,
      creativeControl: resolvedCreativeControl(offer.creativeControl),
      endDate: { ...offer.endDate },
      dateEntitlement: offer.dateEntitlement,
      weeklyGuarantee: offer.weeklyGuarantee,
      appearanceFee: offer.appearanceFee,
      signingBonus: offer.signingBonus,
    }))
    .sort((left, right) => left.personName.localeCompare(right.personName));

  return {
    world: { worldId: aggregate.state.world.id, name: aggregate.state.world.name, currentDate },
    player: { playerId: membership.playerId, promotionId: promotion.id },
    promotion: { promotionId: promotion.id, name: promotion.name },
    roster,
    market,
    pendingOffers,
  };
}
