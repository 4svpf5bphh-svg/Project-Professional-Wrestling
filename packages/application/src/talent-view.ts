import type {
  CareerStage,
  ContractFamily,
  ContractOfferStatus,
  ExclusivityType,
  Id,
  InjurySeverity,
  PersonStatus,
  PpwDate,
  RoleExpectation,
} from "../../domain/src/types.js";
import type { WrestlerAlignment } from "../../domain/src/alignment.js";
import {
  activeContractsForPerson,
  activeContractsForPromotion,
  comparePpwDates,
  contractIsActive,
  marketWeeklyValue,
  ppwDateToWeekIndex,
  wrestlerAlignment,
} from "../../sim-core/src/index.js";
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

export interface PlayerRosterContractView {
  contractId: Id;
  personId: Id;
  name: string;
  alignment: WrestlerAlignment;
  careerStage: CareerStage;
  status: PersonStatus;
  biologicalAge: number;
  recognition: number;
  popularity: number;
  morale: number;
  momentum: number;
  fatigue: number;
  wear: number;
  trust: number;
  skills: PlayerTalentSkillsView;
  injury: PlayerTalentInjuryView | null;
  contract: {
    family: ContractFamily;
    exclusivity: ExclusivityType;
    roleExpectation: RoleExpectation;
    startDate: PpwDate;
    endDate: PpwDate;
    weeksToExpiry: number;
    dateEntitlement: number;
    datesUsed: number;
    datesRemaining: number;
    weeklyGuarantee: number;
    appearanceFee: number;
    signingBonus: number;
    renewalWindowOpen: boolean;
  };
}

export interface PlayerTalentMarketView {
  personId: Id;
  name: string;
  alignment: WrestlerAlignment;
  careerStage: CareerStage;
  status: PersonStatus;
  biologicalAge: number;
  recognition: number;
  popularity: number;
  momentum: number;
  skills: PlayerTalentSkillsView;
  estimatedWeeklyValue: number;
  availability: "FREE_AGENT" | "NON_EXCLUSIVE";
  injury: PlayerTalentInjuryView | null;
  hasOurPendingOffer: boolean;
}

export interface PlayerPendingContractOfferView {
  offerId: Id;
  personId: Id;
  personName: string;
  offerKind: "RECRUITMENT" | "RENEWAL";
  status: ContractOfferStatus;
  submittedDate: PpwDate;
  family: ContractFamily;
  exclusivity: ExclusivityType;
  roleExpectation: RoleExpectation;
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

  const roster = activeContractsForPromotion(aggregate.state, promotion.id)
    .map((contract): PlayerRosterContractView | null => {
      const person = peopleById.get(contract.personId);
      if (!person) return null;
      const remaining = weeksToExpiry(aggregate, contract.endDate);
      const alignment = wrestlerAlignment(person, aggregate.state.world.seed);
      return {
        contractId: contract.id,
        personId: person.id,
        name: person.name,
        alignment,
        careerStage: person.careerStage,
        status: person.status,
        biologicalAge: person.biologicalAge,
        recognition: person.recognition,
        popularity: person.popularity,
        morale: person.morale,
        momentum: person.momentum,
        fatigue: person.fatigue,
        wear: person.wear,
        trust: trustFor(aggregate, promotion.id, person.id),
        skills: publicSkills(person),
        injury: activeInjuryForPerson(aggregate, person.id),
        contract: {
          family: contract.family,
          exclusivity: contract.exclusivity,
          roleExpectation: contract.roleExpectation,
          startDate: { ...contract.startDate },
          endDate: { ...contract.endDate },
          weeksToExpiry: remaining,
          dateEntitlement: contract.dateEntitlement,
          datesUsed: contract.datesUsed,
          datesRemaining: Math.max(0, contract.dateEntitlement - contract.datesUsed),
          weeklyGuarantee: contract.weeklyGuarantee,
          appearanceFee: contract.appearanceFee,
          signingBonus: contract.signingBonus,
          renewalWindowOpen: remaining <= aggregate.state.ruleset.renewalWindowWeeks,
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
        personId: person.id,
        name: person.name,
        alignment,
        careerStage: person.careerStage,
        status: person.status,
        biologicalAge: person.biologicalAge,
        recognition: person.recognition,
        popularity: person.popularity,
        momentum: person.momentum,
        skills: publicSkills(person),
        estimatedWeeklyValue: marketWeeklyValue(person),
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
