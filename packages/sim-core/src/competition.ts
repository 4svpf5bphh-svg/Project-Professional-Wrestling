import type {
  Championship,
  ChampionshipContest,
  ChampionshipDivision,
  ChampionshipHolderType,
  ChampionshipReign,
  ChampionshipReignEndReason,
  Match,
  MatchParticipant,
  Person,
  Promotion,
  Team,
  TeamMembership,
  WorldState,
  WrestlingEvent,
} from "../../domain/src/types.js";
import { ppwDateToWeekIndex } from "./clock.js";
import { activeContractsForPerson } from "./contracts.js";
import { personById } from "./indexes.js";
import { LedgerWriter } from "./ledger.js";

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function teams(state: WorldState): Team[] {
  if (!state.teams) state.teams = [];
  return state.teams;
}

function teamMemberships(state: WorldState): TeamMembership[] {
  if (!state.teamMemberships) state.teamMemberships = [];
  return state.teamMemberships;
}

function championships(state: WorldState): Championship[] {
  if (!state.championships) state.championships = [];
  return state.championships;
}

function championshipReigns(state: WorldState): ChampionshipReign[] {
  if (!state.championshipReigns) state.championshipReigns = [];
  return state.championshipReigns;
}

function championshipContests(state: WorldState): ChampionshipContest[] {
  if (!state.championshipContests) state.championshipContests = [];
  return state.championshipContests;
}

function activeMembershipsForTeam(state: WorldState, teamId: string): TeamMembership[] {
  return teamMemberships(state).filter((membership) => membership.teamId === teamId && membership.active);
}

export function activeTeamMemberIds(state: WorldState, teamId: string): string[] {
  return activeMembershipsForTeam(state, teamId).map((membership) => membership.personId).sort();
}

function exactActiveTeamForPair(state: WorldState, personAId: string, personBId: string): Team | undefined {
  const target = [personAId, personBId].sort().join(":");
  for (const team of teams(state)) {
    if (team.status !== "ACTIVE") continue;
    if (activeTeamMemberIds(state, team.id).join(":") === target) return team;
  }
  return undefined;
}

function teamName(a: Person, b: Person): string {
  return `${a.name} & ${b.name}`;
}

export function ensureTeamForPair(state: WorldState, personAId: string, personBId: string, date = state.world.currentDate): Team | null {
  if (personAId === personBId) return null;
  const existing = exactActiveTeamForPair(state, personAId, personBId);
  if (existing) return existing;
  const a = personById(state, personAId);
  const b = personById(state, personBId);
  if (!a || !b || a.status === "RETIRED" || b.status === "RETIRED") return null;
  const team: Team = {
    id: `team-${String(teams(state).length + 1).padStart(7, "0")}`,
    worldId: state.world.id,
    name: teamName(a, b),
    status: "ACTIVE",
    formedDate: { ...date },
    disbandedDate: null,
  };
  teams(state).push(team);
  for (const person of [a, b]) {
    teamMemberships(state).push({
      id: `team-membership-${String(teamMemberships(state).length + 1).padStart(8, "0")}`,
      worldId: state.world.id,
      teamId: team.id,
      personId: person.id,
      joinedDate: { ...date },
      leftDate: null,
      active: true,
    });
  }
  new LedgerWriter(state.world.id, state.ledger).append({
    date,
    type: "TAG_TEAM_FORMED",
    significance: "ROUTINE",
    entityIds: [team.id, a.id, b.id],
    payload: { teamName: team.name },
  });
  return team;
}

function disbandTeam(state: WorldState, team: Team, reason: string): void {
  if (team.status !== "ACTIVE") return;
  team.status = "DISBANDED";
  team.disbandedDate = { ...state.world.currentDate };
  for (const membership of activeMembershipsForTeam(state, team.id)) {
    membership.active = false;
    membership.leftDate = { ...state.world.currentDate };
  }
  new LedgerWriter(state.world.id, state.ledger).append({
    date: state.world.currentDate,
    type: "TAG_TEAM_DISBANDED",
    significance: "ROUTINE",
    entityIds: [team.id],
    payload: { reason },
  });
}

export function maintainTeamsForWeek(state: WorldState): void {
  for (const team of teams(state)) {
    if (team.status !== "ACTIVE") continue;
    const memberIds = activeTeamMemberIds(state, team.id);
    const invalid = memberIds.length !== 2 || memberIds.some((personId) => personById(state, personId)?.status === "RETIRED");
    if (invalid) disbandTeam(state, team, "member retired or membership invalid");
  }
}

function promotionBasePrestige(promotion: Promotion): number {
  switch (promotion.tier) {
    case "GLOBAL": return 72;
    case "NATIONAL": return 58;
    case "RISING": return 45;
    case "INDEPENDENT": return 34;
    case "LOCAL": return 25;
  }
}

function championshipName(promotion: Promotion, division: ChampionshipDivision): string {
  return division === "SINGLES"
    ? `${promotion.name} World Championship`
    : `${promotion.name} Tag Team Championship`;
}

function ensurePromotionChampionship(state: WorldState, promotion: Promotion, division: ChampionshipDivision): Championship {
  const existing = championships(state).find((championship) => championship.promotionId === promotion.id && championship.division === division);
  if (existing) return existing;
  const championship: Championship = {
    id: `championship-${String(championships(state).length + 1).padStart(6, "0")}`,
    worldId: state.world.id,
    promotionId: promotion.id,
    name: championshipName(promotion, division),
    division,
    status: promotion.lifecycle === "DORMANT" || promotion.lifecycle === "CLOSED" ? "INACTIVE" : "ACTIVE",
    prestige: promotionBasePrestige(promotion),
    currentReignId: null,
    createdDate: { ...state.world.currentDate },
  };
  championships(state).push(championship);
  new LedgerWriter(state.world.id, state.ledger).append({
    date: state.world.currentDate,
    type: "CHAMPIONSHIP_CREATED",
    significance: division === "SINGLES" ? "NOTABLE" : "ROUTINE",
    entityIds: [championship.id, promotion.id],
    payload: { division, prestige: championship.prestige, name: championship.name },
  });
  return championship;
}

export function ensureWorldChampionships(state: WorldState): void {
  for (const promotion of state.promotions) {
    if (promotion.lifecycle === "CLOSED") continue;
    ensurePromotionChampionship(state, promotion, "SINGLES");
    ensurePromotionChampionship(state, promotion, "TAG");
  }
}

function currentReign(state: WorldState, championship: Championship): ChampionshipReign | null {
  if (!championship.currentReignId) return null;
  return championshipReigns(state).find((reign) => reign.id === championship.currentReignId && reign.status === "ACTIVE") ?? null;
}

function personContractedToPromotion(state: WorldState, personId: string, promotionId: string): boolean {
  return activeContractsForPerson(state, personId).some((contract) => contract.promotionId === promotionId);
}

function teamEligibleForPromotion(state: WorldState, teamId: string, promotionId: string): boolean {
  const team = teams(state).find((candidate) => candidate.id === teamId);
  if (!team || team.status !== "ACTIVE") return false;
  const members = activeTeamMemberIds(state, team.id);
  return members.length === 2 && members.every((personId) => {
    const person = personById(state, personId);
    return person && person.status !== "RETIRED" && personContractedToPromotion(state, personId, promotionId);
  });
}

function endReign(
  state: WorldState,
  championship: Championship,
  reign: ChampionshipReign,
  reason: ChampionshipReignEndReason,
  lostMatchId: string | null,
): void {
  if (reign.status !== "ACTIVE") return;
  reign.status = "ENDED";
  reign.endDate = { ...state.world.currentDate };
  reign.endReason = reason;
  reign.lostMatchId = lostMatchId;
  if (championship.currentReignId === reign.id) championship.currentReignId = null;
}

function vacateChampionship(state: WorldState, championship: Championship, reason: ChampionshipReignEndReason): void {
  const reign = currentReign(state, championship);
  if (!reign) return;
  endReign(state, championship, reign, reason, null);
  new LedgerWriter(state.world.id, state.ledger).append({
    date: state.world.currentDate,
    type: "CHAMPIONSHIP_VACATED",
    significance: "NOTABLE",
    entityIds: [championship.id, reign.holderId, reign.id],
    payload: { reason, division: championship.division },
  });
}

export function maintainChampionshipsForWeek(state: WorldState): void {
  ensureWorldChampionships(state);
  maintainTeamsForWeek(state);
  for (const championship of championships(state)) {
    const promotion = state.promotions.find((candidate) => candidate.id === championship.promotionId);
    if (!promotion) continue;
    if (promotion.lifecycle === "DORMANT" || promotion.lifecycle === "CLOSED") {
      championship.status = "INACTIVE";
      vacateChampionship(state, championship, "PROMOTION_DORMANT");
      continue;
    }
    championship.status = "ACTIVE";
    const reign = currentReign(state, championship);
    if (!reign) continue;
    if (reign.holderType === "PERSON") {
      const person = personById(state, reign.holderId);
      if (!person || person.status === "RETIRED") vacateChampionship(state, championship, "RETIRED");
      else if (!personContractedToPromotion(state, person.id, promotion.id)) vacateChampionship(state, championship, "CONTRACT_ENDED");
    } else if (!teamEligibleForPromotion(state, reign.holderId, promotion.id)) {
      const team = teams(state).find((candidate) => candidate.id === reign.holderId);
      vacateChampionship(state, championship, !team || team.status !== "ACTIVE" ? "TEAM_INACTIVE" : "CONTRACT_ENDED");
    }
  }
}

function currentWeekCompletedEvents(state: WorldState): WrestlingEvent[] {
  const currentIndex = ppwDateToWeekIndex(state.world.currentDate, state.ruleset.weeksPerYear);
  const result: WrestlingEvent[] = [];
  for (let i = state.events.length - 1; i >= 0; i -= 1) {
    const event = state.events[i]!;
    const eventIndex = ppwDateToWeekIndex(event.date, state.ruleset.weeksPerYear);
    if (eventIndex < currentIndex) break;
    if (eventIndex === currentIndex && event.status === "COMPLETED") result.push(event);
  }
  return result.sort((a, b) => a.date.day - b.date.day || a.id.localeCompare(b.id));
}

function currentWeekMatchesByEvent(state: WorldState, eventIds: Set<string>): Map<string, Match[]> {
  const result = new Map<string, Match[]>();
  let foundCurrent = false;
  for (let i = state.matches.length - 1; i >= 0; i -= 1) {
    const match = state.matches[i]!;
    if (!eventIds.has(match.eventId)) {
      if (foundCurrent) break;
      continue;
    }
    foundCurrent = true;
    if (match.status !== "COMPLETED") continue;
    const list = result.get(match.eventId) ?? [];
    list.push(match);
    result.set(match.eventId, list);
  }
  for (const list of result.values()) list.sort((a, b) => a.order - b.order);
  return result;
}

function participantsByMatchForCurrentWeek(state: WorldState, matchIds: Set<string>): Map<string, MatchParticipant[]> {
  const result = new Map<string, MatchParticipant[]>();
  let foundCurrent = false;
  for (let i = state.matchParticipants.length - 1; i >= 0; i -= 1) {
    const participant = state.matchParticipants[i]!;
    if (!matchIds.has(participant.matchId)) {
      if (foundCurrent) break;
      continue;
    }
    foundCurrent = true;
    const list = result.get(participant.matchId) ?? [];
    list.push(participant);
    result.set(participant.matchId, list);
  }
  return result;
}

function sideIds(participants: MatchParticipant[], side: "A" | "B"): string[] {
  return participants.filter((participant) => participant.side === side).map((participant) => participant.personId).sort();
}

function recognizeTeamsFromMatch(state: WorldState, match: Match, participants: MatchParticipant[], event: WrestlingEvent): void {
  if (match.type !== "TAG") return;
  for (const side of ["A", "B"] as const) {
    const ids = sideIds(participants, side);
    if (ids.length !== 2) continue;
    const chemistry = state.workingChemistry.find((record) => record.context === "TAG"
      && ((record.personAId === ids[0] && record.personBId === ids[1]) || (record.personAId === ids[1] && record.personBId === ids[0])));
    if (chemistry && chemistry.matchesTogether >= state.ruleset.teamRecognitionMatches) ensureTeamForPair(state, ids[0]!, ids[1]!, event.date);
  }
}

function holderSide(
  state: WorldState,
  reign: ChampionshipReign,
  match: Match,
  participants: MatchParticipant[],
): "A" | "B" | null {
  if (reign.holderType === "PERSON") {
    const participant = participants.find((candidate) => candidate.personId === reign.holderId);
    return participant?.side ?? null;
  }
  if (match.type !== "TAG") return null;
  const members = activeTeamMemberIds(state, reign.holderId);
  if (members.length !== 2) return null;
  for (const side of ["A", "B"] as const) {
    if (sideIds(participants, side).join(":") === members.join(":")) return side;
  }
  return null;
}

function lastContestWeek(state: WorldState, championshipId: string): number | null {
  const contests = championshipContests(state);
  for (let i = contests.length - 1; i >= 0; i -= 1) {
    const contest = contests[i]!;
    if (contest.championshipId === championshipId) return ppwDateToWeekIndex(contest.date, state.ruleset.weeksPerYear);
  }
  return null;
}

function titleDue(state: WorldState, championship: Championship, event: WrestlingEvent): boolean {
  if (event.type === "MAJOR") return true;
  const last = lastContestWeek(state, championship.id);
  if (last === null) return false;
  const interval = championship.division === "SINGLES"
    ? state.ruleset.singlesTitleDefenseIntervalWeeks
    : state.ruleset.tagTitleDefenseIntervalWeeks;
  return ppwDateToWeekIndex(event.date, state.ruleset.weeksPerYear) - last >= interval;
}

function candidateTitleMatch(
  state: WorldState,
  championship: Championship,
  event: WrestlingEvent,
  eventMatches: Match[],
  participantsByMatch: Map<string, MatchParticipant[]>,
): Match | null {
  const reign = currentReign(state, championship);
  if (!reign) {
    if (event.type !== "MAJOR") return null;
    const type = championship.division === "SINGLES" ? "SINGLES" : "TAG";
    return [...eventMatches].filter((match) => match.type === type).sort((a, b) => b.order - a.order)[0] ?? null;
  }
  if (!titleDue(state, championship, event)) return null;
  const type = championship.division === "SINGLES" ? "SINGLES" : "TAG";
  return [...eventMatches]
    .filter((match) => match.type === type && holderSide(state, reign, match, participantsByMatch.get(match.id) ?? []) !== null)
    .sort((a, b) => b.order - a.order)[0] ?? null;
}

function holderFromWinningSide(
  state: WorldState,
  championship: Championship,
  match: Match,
  participants: MatchParticipant[],
  event: WrestlingEvent,
): { holderType: ChampionshipHolderType; holderId: string } | null {
  if (!match.actualWinnerSide) return null;
  const winners = sideIds(participants, match.actualWinnerSide);
  if (championship.division === "SINGLES") {
    if (winners.length !== 1) return null;
    return { holderType: "PERSON", holderId: winners[0]! };
  }
  if (winners.length !== 2) return null;
  const team = ensureTeamForPair(state, winners[0]!, winners[1]!, event.date);
  return team ? { holderType: "TEAM", holderId: team.id } : null;
}

function createReign(
  state: WorldState,
  championship: Championship,
  holderType: ChampionshipHolderType,
  holderId: string,
  matchId: string,
  event: WrestlingEvent,
): ChampionshipReign {
  const reign: ChampionshipReign = {
    id: `championship-reign-${String(championshipReigns(state).length + 1).padStart(7, "0")}`,
    worldId: state.world.id,
    championshipId: championship.id,
    holderType,
    holderId,
    status: "ACTIVE",
    startDate: { ...event.date },
    endDate: null,
    wonMatchId: matchId,
    lostMatchId: null,
    defenses: 0,
    endReason: null,
  };
  championshipReigns(state).push(reign);
  championship.currentReignId = reign.id;
  return reign;
}

function adjustPrestige(championship: Championship, match: Match, event: WrestlingEvent): void {
  const delta = (match.criticalRatingStars - 3) * 0.65 + (event.type === "MAJOR" ? 0.35 : 0);
  championship.prestige = Math.round(clamp(championship.prestige + delta, 10, 100) * 100) / 100;
}

function recordChampionshipContest(
  state: WorldState,
  championship: Championship,
  match: Match,
  participants: MatchParticipant[],
  event: WrestlingEvent,
): void {
  const winner = holderFromWinningSide(state, championship, match, participants, event);
  if (!winner) return;
  const previous = currentReign(state, championship);
  const previousHolderId = previous?.holderId ?? null;
  const titleChanged = previousHolderId !== winner.holderId;
  if (!previous) {
    createReign(state, championship, winner.holderType, winner.holderId, match.id, event);
  } else if (titleChanged) {
    endReign(state, championship, previous, "LOST", match.id);
    createReign(state, championship, winner.holderType, winner.holderId, match.id, event);
  } else {
    previous.defenses += 1;
  }
  const contest: ChampionshipContest = {
    id: `championship-contest-${String(championshipContests(state).length + 1).padStart(8, "0")}`,
    worldId: state.world.id,
    championshipId: championship.id,
    matchId: match.id,
    eventId: event.id,
    date: { ...event.date },
    previousHolderId,
    winnerHolderId: winner.holderId,
    titleChanged,
  };
  championshipContests(state).push(contest);
  adjustPrestige(championship, match, event);
  new LedgerWriter(state.world.id, state.ledger).append({
    date: event.date,
    type: previous ? (titleChanged ? "CHAMPIONSHIP_CHANGED" : "CHAMPIONSHIP_DEFENDED") : "CHAMPIONSHIP_CROWNED",
    significance: titleChanged || !previous ? "NOTABLE" : "ROUTINE",
    entityIds: [championship.id, contest.id, match.id, winner.holderId, ...(previousHolderId ? [previousHolderId] : [])],
    payload: {
      division: championship.division,
      titleChanged,
      rating: match.criticalRatingStars,
      prestige: championship.prestige,
    },
  });
}

export function processCompetitionForWeek(state: WorldState): void {
  ensureWorldChampionships(state);
  const events = currentWeekCompletedEvents(state);
  if (events.length === 0) return;
  const eventIds = new Set(events.map((event) => event.id));
  const matchesByEvent = currentWeekMatchesByEvent(state, eventIds);
  const allCurrentMatches = [...matchesByEvent.values()].flat();
  const participantsByMatch = participantsByMatchForCurrentWeek(state, new Set(allCurrentMatches.map((match) => match.id)));

  for (const event of events) {
    const eventMatches = matchesByEvent.get(event.id) ?? [];
    for (const match of eventMatches) recognizeTeamsFromMatch(state, match, participantsByMatch.get(match.id) ?? [], event);
    for (const championship of championships(state).filter((candidate) => candidate.promotionId === event.promotionId && candidate.status === "ACTIVE")) {
      const match = candidateTitleMatch(state, championship, event, eventMatches, participantsByMatch);
      if (!match) continue;
      if (championshipContests(state).some((contest) => contest.championshipId === championship.id && contest.matchId === match.id)) continue;
      recordChampionshipContest(state, championship, match, participantsByMatch.get(match.id) ?? [], event);
    }
  }
}
