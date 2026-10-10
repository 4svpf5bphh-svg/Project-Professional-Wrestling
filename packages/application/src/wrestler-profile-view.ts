import type {
  CareerStage,
  ChampionshipDivision,
  ChampionshipHolderType,
  ContractFamily,
  ExclusivityType,
  Id,
  InjurySeverity,
  InjuryStatus,
  MatchIntent,
  MatchType,
  PersonStatus,
  PpwDate,
  RoleExpectation,
} from "../../domain/src/types.js";
import {
  activeContractsForPerson,
  comparePpwDates,
  contractIsActive,
  marketWeeklyValue,
  ppwDateToWeekIndex,
} from "../../sim-core/src/index.js";
import {
  activePromotionControlForPlayer,
  activeWorldMembership,
} from "./ownership.js";
import type { PlayerTalentSkillsView } from "./talent-view.js";
import { talentExpectationEvidenceForContract, type TalentExpectationEvidence } from "./talent-expectations.js";
import type { ApplicationWorldAggregate } from "./world-aggregate.js";
import { baselineWrestlingStyle, defaultWrestlerCreativeFields, wrestlerCreativeProfileFor, type WrestlerCreativeFields, type WrestlerCreativeChange, type WrestlingStyle } from "./wrestler-creative.js";
import { wrestlerPersonalityFor, type WrestlerPersonalityView } from "./wrestler-personality.js";
import { wrestlerCreativeInterestFor, type WrestlerCreativeInterestView } from "./wrestler-creative-interests.js";

export type WrestlerProfileEmploymentStatus =
  | "OUR_ROSTER"
  | "FREE_AGENT"
  | "NON_EXCLUSIVE"
  | "EXCLUSIVE_ELSEWHERE";

export interface PlayerWrestlerProfileContractView {
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
}

export interface PlayerWrestlerProfileRecentMatchView {
  matchId: Id;
  eventId: Id;
  date: PpwDate;
  promotionName: string;
  type: MatchType;
  intent: MatchIntent;
  won: boolean;
  partners: string[];
  opponents: string[];
  criticalRatingStars: number;
  crowdResponse: number;
  championshipNames: string[];
}

export interface PlayerWrestlerProfileView {
  world: {
    worldId: Id;
    name: string;
    currentDate: PpwDate;
    revision: number;
  };
  player: {
    playerId: string;
    promotionId: Id | null;
  };
  person: {
    personId: Id;
    name: string;
    careerStage: CareerStage;
    status: PersonStatus;
    biologicalAge: number;
    debutDate: PpwDate;
    homeMarketName: string;
    recognition: number;
    popularity: number;
    momentum: number;
    estimatedWeeklyValue: number;
    skills: PlayerTalentSkillsView;
    /** Fictional character modelling; independent of match ratings. */
    personality: WrestlerPersonalityView;
    creativeInterests: WrestlerCreativeInterestView;
    /** Shared-world baseline; never edited by a rival promotion. */
    baselineStyle: WrestlingStyle;
    /** Visible neutral character entry even before a player books this wrestler. */
    baselinePresentation: WrestlerCreativeFields;
    currentInjury: {
      severity: InjurySeverity;
      weeksRemaining: number;
    } | null;
  };
  relationship: {
    promotionId: Id;
    promotionName: string;
    employmentStatus: WrestlerProfileEmploymentStatus;
    trust: number;
    morale: number | null;
    fatigue: number | null;
    wear: number | null;
    hasPendingOffer: boolean;
    ourContract: PlayerWrestlerProfileContractView | null;
    bookingEvidence: TalentExpectationEvidence | null;
  } | null;
  creativeProfile: {
    /** Only the current controller's presentation of their roster wrestler. */
    promotionId: Id;
    promotionName: string;
    canEdit: boolean;
    fields: WrestlerCreativeFields;
    history: WrestlerCreativeChange[];
  } | null;
  careerStats: {
    completedMatches: number;
    wins: number;
    losses: number;
    singlesMatches: number;
    tagMatches: number;
    averageCriticalRating: number;
    bestCriticalRating: number;
  };
  /** Only this player's controlled promotion's private Backstage discussion history. */
  backstageHistory: Array<{
    conversationId: Id;
    kind: import("./engagement.js").BackstageConversation["kind"];
    createdDate: PpwDate;
    status: "OPEN" | "ANSWERED" | "NOTED";
    response: import("./engagement.js").BackstageResponse | null;
    counterpartName: string | null;
  }>;
  activeTeams: Array<{
    teamId: Id;
    name: string;
    formedDate: PpwDate;
    partners: string[];
  }>;
  currentChampionships: Array<{
    championshipId: Id;
    name: string;
    division: ChampionshipDivision;
    promotionName: string;
    holderType: ChampionshipHolderType;
    reignStartDate: PpwDate;
    defenses: number;
  }>;
  recentMatches: PlayerWrestlerProfileRecentMatchView[];
  injuryHistory: Array<{
    injuryId: Id;
    date: PpwDate;
    severity: InjurySeverity;
    status: InjuryStatus;
    weeksOut: number;
    weeksRemaining: number;
  }>;
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

function trustFor(aggregate: ApplicationWorldAggregate, promotionId: Id, personId: Id): number {
  return aggregate.state.promotionTalentTrust?.find((entry) => (
    entry.promotionId === promotionId && entry.personId === personId
  ))?.trust ?? 50;
}

function weeksToExpiry(aggregate: ApplicationWorldAggregate, endDate: PpwDate): number {
  const current = ppwDateToWeekIndex(aggregate.state.world.currentDate, aggregate.state.ruleset.weeksPerYear);
  const end = ppwDateToWeekIndex(endDate, aggregate.state.ruleset.weeksPerYear);
  return Math.max(0, end - current);
}

function currentInjuryFor(
  aggregate: ApplicationWorldAggregate,
  personId: Id,
): PlayerWrestlerProfileView["person"]["currentInjury"] {
  const injury = aggregate.state.injuries
    .filter((candidate) => candidate.personId === personId && candidate.status === "ACTIVE")
    .sort((left, right) => right.weeksRemaining - left.weeksRemaining || right.id.localeCompare(left.id))[0];
  return injury ? { severity: injury.severity, weeksRemaining: injury.weeksRemaining } : null;
}

function currentOrFutureSignedContracts(aggregate: ApplicationWorldAggregate, personId: Id) {
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

function ownContractView(
  aggregate: ApplicationWorldAggregate,
  promotionId: Id,
  personId: Id,
): PlayerWrestlerProfileContractView | null {
  const contract = activeContractsForPerson(aggregate.state, personId)
    .find((candidate) => candidate.promotionId === promotionId && contractIsActive(aggregate.state, candidate));
  if (!contract) return null;
  const remaining = weeksToExpiry(aggregate, contract.endDate);
  return {
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
  };
}

/**
 * Builds a wrestler profile without exposing another promotion's private deal
 * terms or internal condition data. Match, team, title and injury history are
 * public World history; contract money, role, dates, Morale, fatigue and Wear
 * are exposed only when the wrestler is on the player's own active roster.
 */
export function buildPlayerWrestlerProfileView(
  aggregate: ApplicationWorldAggregate,
  playerId: string,
  personId: Id,
): PlayerWrestlerProfileView {
  const membership = activeWorldMembership(aggregate.ownership, playerId);
  if (!membership) throw new Error(`${playerId} is not an active member of ${aggregate.state.world.id}`);
  const person = aggregate.state.people.find((candidate) => candidate.id === personId);
  if (!person) throw new Error(`unknown wrestler ${personId}`);

  const control = activePromotionControlForPlayer(aggregate.ownership, playerId);
  const playerPromotion = control
    ? aggregate.state.promotions.find((promotion) => promotion.id === control.promotionId) ?? null
    : null;
  if (control && !playerPromotion) throw new Error(`controlled promotion ${control.promotionId} no longer exists`);

  const peopleById = new Map(aggregate.state.people.map((candidate) => [candidate.id, candidate]));
  const promotionsById = new Map(aggregate.state.promotions.map((promotion) => [promotion.id, promotion]));
  const eventsById = new Map(aggregate.state.events.map((event) => [event.id, event]));
  const matchesById = new Map(aggregate.state.matches.map((match) => [match.id, match]));
  const championships = aggregate.state.championships ?? [];
  const championshipsById = new Map(championships.map((championship) => [championship.id, championship]));
  const contestsByMatchId = new Map<Id, typeof aggregate.state.championshipContests>();
  for (const contest of aggregate.state.championshipContests ?? []) {
    const list = contestsByMatchId.get(contest.matchId) ?? [];
    list.push(contest);
    contestsByMatchId.set(contest.matchId, list);
  }

  const participantsByMatchId = new Map<Id, typeof aggregate.state.matchParticipants>();
  for (const participant of aggregate.state.matchParticipants) {
    const list = participantsByMatchId.get(participant.matchId) ?? [];
    list.push(participant);
    participantsByMatchId.set(participant.matchId, list);
  }

  const participation = aggregate.state.matchParticipants
    .filter((participant) => participant.personId === personId)
    .map((participant) => ({
      participant,
      match: matchesById.get(participant.matchId),
    }))
    .filter((entry): entry is typeof entry & { match: NonNullable<typeof entry.match> } => (
      entry.match !== undefined && entry.match.status === "COMPLETED"
    ));

  const ratedMatches = participation.map((entry) => entry.match);
  const wins = participation.filter((entry) => entry.participant.won).length;
  const averageCriticalRating = ratedMatches.length > 0
    ? ratedMatches.reduce((sum, match) => sum + match.criticalRatingStars, 0) / ratedMatches.length
    : 0;
  const bestCriticalRating = ratedMatches.reduce((best, match) => Math.max(best, match.criticalRatingStars), 0);

  const recentMatches = participation
    .map((entry) => ({ ...entry, event: eventsById.get(entry.match.eventId) }))
    .filter((entry): entry is typeof entry & { event: NonNullable<typeof entry.event> } => entry.event !== undefined)
    .sort((left, right) => (
      comparePpwDates(right.event.date, left.event.date, aggregate.state.ruleset.weeksPerYear)
      || right.match.order - left.match.order
      || right.match.id.localeCompare(left.match.id)
    ))
    .slice(0, 8)
    .map(({ participant, match, event }): PlayerWrestlerProfileRecentMatchView => {
      const matchParticipants = participantsByMatchId.get(match.id) ?? [];
      const partners = matchParticipants
        .filter((candidate) => candidate.side === participant.side && candidate.personId !== personId)
        .map((candidate) => peopleById.get(candidate.personId)?.name ?? "Unknown wrestler")
        .sort((left, right) => left.localeCompare(right));
      const opponents = matchParticipants
        .filter((candidate) => candidate.side !== participant.side)
        .map((candidate) => peopleById.get(candidate.personId)?.name ?? "Unknown wrestler")
        .sort((left, right) => left.localeCompare(right));
      const championshipNames = (contestsByMatchId.get(match.id) ?? [])
        .map((contest) => championshipsById.get(contest.championshipId)?.name)
        .filter((name): name is string => Boolean(name))
        .sort((left, right) => left.localeCompare(right));
      return {
        matchId: match.id,
        eventId: event.id,
        date: { ...event.date },
        promotionName: promotionsById.get(event.promotionId)?.name ?? "Unknown promotion",
        type: match.type,
        intent: match.intent,
        won: participant.won,
        partners,
        opponents,
        criticalRatingStars: match.criticalRatingStars,
        crowdResponse: match.crowdResponse,
        championshipNames,
      };
    });

  const teams = aggregate.state.teams ?? [];
  const memberships = aggregate.state.teamMemberships ?? [];
  const activeMemberships = memberships.filter((membershipEntry) => (
    membershipEntry.personId === personId && membershipEntry.active && membershipEntry.leftDate === null
  ));
  const activeTeamIds = new Set(activeMemberships.map((membershipEntry) => membershipEntry.teamId));
  const activeTeams = activeMemberships
    .map((membershipEntry) => {
      const team = teams.find((candidate) => candidate.id === membershipEntry.teamId && candidate.status === "ACTIVE");
      if (!team) return null;
      const partners = memberships
        .filter((candidate) => candidate.teamId === team.id && candidate.active && candidate.leftDate === null && candidate.personId !== personId)
        .map((candidate) => peopleById.get(candidate.personId)?.name ?? "Unknown wrestler")
        .sort((left, right) => left.localeCompare(right));
      return {
        teamId: team.id,
        name: team.name,
        formedDate: { ...team.formedDate },
        partners,
      };
    })
    .filter((entry): entry is NonNullable<typeof entry> => entry !== null)
    .sort((left, right) => left.name.localeCompare(right.name));

  const currentChampionships = (aggregate.state.championshipReigns ?? [])
    .filter((reign) => (
      reign.status === "ACTIVE"
      && (
        (reign.holderType === "PERSON" && reign.holderId === personId)
        || (reign.holderType === "TEAM" && activeTeamIds.has(reign.holderId))
      )
    ))
    .map((reign) => {
      const championship = championshipsById.get(reign.championshipId);
      if (!championship || championship.status !== "ACTIVE") return null;
      return {
        championshipId: championship.id,
        name: championship.name,
        division: championship.division,
        promotionName: promotionsById.get(championship.promotionId)?.name ?? "Unknown promotion",
        holderType: reign.holderType,
        reignStartDate: { ...reign.startDate },
        defenses: reign.defenses,
      };
    })
    .filter((entry): entry is NonNullable<typeof entry> => entry !== null)
    .sort((left, right) => left.name.localeCompare(right.name));

  const injuryHistory = aggregate.state.injuries
    .filter((injury) => injury.personId === personId)
    .sort((left, right) => (
      comparePpwDates(right.date, left.date, aggregate.state.ruleset.weeksPerYear)
      || right.id.localeCompare(left.id)
    ))
    .slice(0, 6)
    .map((injury) => ({
      injuryId: injury.id,
      date: { ...injury.date },
      severity: injury.severity,
      status: injury.status,
      weeksOut: injury.weeksOut,
      weeksRemaining: injury.weeksRemaining,
    }));

  let relationship: PlayerWrestlerProfileView["relationship"] = null;
  if (playerPromotion) {
    const ourContract = ownContractView(aggregate, playerPromotion.id, personId);
    const activeOutsideContracts = activeContractsForPerson(aggregate.state, personId)
      .filter((contract) => contract.promotionId !== playerPromotion.id && contractIsActive(aggregate.state, contract));
    const signedCurrentOrFutureOutside = currentOrFutureSignedContracts(aggregate, personId)
      .filter((contract) => contract.promotionId !== playerPromotion.id);
    let employmentStatus: WrestlerProfileEmploymentStatus;
    if (ourContract) employmentStatus = "OUR_ROSTER";
    else if (signedCurrentOrFutureOutside.some((contract) => contract.exclusivity === "EXCLUSIVE")) employmentStatus = "EXCLUSIVE_ELSEWHERE";
    else if (activeOutsideContracts.length > 0) employmentStatus = "NON_EXCLUSIVE";
    else employmentStatus = "FREE_AGENT";

    relationship = {
      promotionId: playerPromotion.id,
      promotionName: playerPromotion.name,
      employmentStatus,
      trust: trustFor(aggregate, playerPromotion.id, personId),
      morale: ourContract ? person.morale : null,
      fatigue: ourContract ? person.fatigue : null,
      wear: ourContract ? person.wear : null,
      hasPendingOffer: aggregate.state.contractOffers.some((offer) => (
        offer.promotionId === playerPromotion.id && offer.personId === personId && offer.status === "PENDING"
      )),
      ourContract,
      bookingEvidence: ourContract
        ? talentExpectationEvidenceForContract(aggregate.state, activeContractsForPerson(aggregate.state, personId)
          .find((candidate) => candidate.promotionId === playerPromotion.id)!.id)
        : null,
    };
  }

  return {
    world: {
      worldId: aggregate.state.world.id,
      name: aggregate.state.world.name,
      currentDate: { ...aggregate.state.world.currentDate },
      revision: aggregate.runtime.revision,
    },
    player: {
      playerId: membership.playerId,
      promotionId: playerPromotion?.id ?? null,
    },
    person: {
      personId: person.id,
      name: person.name,
      careerStage: person.careerStage,
      status: person.status,
      biologicalAge: person.biologicalAge,
      debutDate: { ...person.debutDate },
      homeMarketName: aggregate.state.markets.find((market) => market.id === person.homeMarketId)?.name ?? "Unknown market",
      recognition: person.recognition,
      popularity: person.popularity,
      momentum: person.momentum,
      estimatedWeeklyValue: marketWeeklyValue(person),
      skills: publicSkills(person),
      personality: wrestlerPersonalityFor(person),
      creativeInterests: wrestlerCreativeInterestFor(person),
      baselineStyle: baselineWrestlingStyle(person),
      baselinePresentation: defaultWrestlerCreativeFields(person),
      currentInjury: currentInjuryFor(aggregate, person.id),
    },
    relationship,
    creativeProfile: playerPromotion && relationship?.employmentStatus === "OUR_ROSTER" ? {
      promotionId: playerPromotion.id,
      promotionName: playerPromotion.name,
      canEdit: true,
      fields: wrestlerCreativeProfileFor(aggregate.engagement, playerPromotion.id, person),
      history: structuredClone((aggregate.engagement?.wrestlerCreativeProfiles ?? [])
        .find((record) => record.promotionId === playerPromotion.id && record.personId === person.id)?.history ?? []),
    } : null,
    backstageHistory: playerPromotion
      ? (aggregate.engagement?.backstageConversations ?? [])
        .filter(item => item.promotionId===playerPromotion.id
          && (item.wrestlerId===personId || item.partnerPersonId===personId || item.rivalPersonId===personId))
        .sort((a,b)=>comparePpwDates(b.createdDate,a.createdDate,aggregate.state.ruleset.weeksPerYear)
          || b.conversationId.localeCompare(a.conversationId))
        .slice(0,8).map(item=>({
          conversationId:item.conversationId,
          kind:item.kind,
          createdDate:{...item.createdDate},
          status:item.status,
          response:item.response,
          counterpartName: item.partnerPersonId || item.rivalPersonId
            ? aggregate.state.people.find(other=>other.id===(
                item.wrestlerId===personId ? (item.partnerPersonId ?? item.rivalPersonId) : item.wrestlerId
              ))?.name ?? null
            : null,
        }))
      : [],
    careerStats: {
      completedMatches: participation.length,
      wins,
      losses: participation.length - wins,
      singlesMatches: participation.filter((entry) => entry.match.type === "SINGLES").length,
      tagMatches: participation.filter((entry) => entry.match.type === "TAG").length,
      averageCriticalRating,
      bestCriticalRating,
    },
    activeTeams,
    currentChampionships,
    recentMatches,
    injuryHistory,
  };
}
