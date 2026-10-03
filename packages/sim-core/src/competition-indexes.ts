import type { ChampionshipReign, Team, WorldState } from "../../domain/src/types.js";
import { ppwDateToWeekIndex } from "./clock.js";
import { LedgerWriter } from "./ledger.js";

interface TeamIndex {
  syncedTeams: number;
  syncedMemberships: number;
  byId: Map<string, Team>;
  activeMembersByTeam: Map<string, string[]>;
  activeTeamByPair: Map<string, Team>;
  activeTeamsByPerson: Map<string, Set<string>>;
}

interface ChampionshipIndex {
  syncedReigns: number;
  syncedContests: number;
  reignById: Map<string, ChampionshipReign>;
  lastContestWeekByChampionship: Map<string, number>;
}

const teamIndexes = new WeakMap<WorldState, TeamIndex>();
const championshipIndexes = new WeakMap<WorldState, ChampionshipIndex>();

function pairKey(a: string, b: string): string {
  return a < b ? `${a}:${b}` : `${b}:${a}`;
}

function ensureTeamIndex(state: WorldState): TeamIndex {
  const teams = state.teams ?? [];
  const memberships = state.teamMemberships ?? [];
  let index = teamIndexes.get(state);
  if (!index || index.syncedTeams > teams.length || index.syncedMemberships > memberships.length) {
    index = {
      syncedTeams: 0,
      syncedMemberships: 0,
      byId: new Map(),
      activeMembersByTeam: new Map(),
      activeTeamByPair: new Map(),
      activeTeamsByPerson: new Map(),
    };
    teamIndexes.set(state, index);
  }

  for (let i = index.syncedTeams; i < teams.length; i += 1) {
    const team = teams[i]!;
    index.byId.set(team.id, team);
    if (!index.activeMembersByTeam.has(team.id)) index.activeMembersByTeam.set(team.id, []);
  }
  index.syncedTeams = teams.length;

  const affectedTeams = new Set<string>();
  for (let i = index.syncedMemberships; i < memberships.length; i += 1) {
    const membership = memberships[i]!;
    if (!membership.active) continue;
    const members = index.activeMembersByTeam.get(membership.teamId) ?? [];
    if (!members.includes(membership.personId)) members.push(membership.personId);
    members.sort();
    index.activeMembersByTeam.set(membership.teamId, members);
    const personTeams = index.activeTeamsByPerson.get(membership.personId) ?? new Set<string>();
    personTeams.add(membership.teamId);
    index.activeTeamsByPerson.set(membership.personId, personTeams);
    affectedTeams.add(membership.teamId);
  }
  index.syncedMemberships = memberships.length;

  for (const teamId of affectedTeams) {
    const team = index.byId.get(teamId);
    const members = index.activeMembersByTeam.get(teamId) ?? [];
    if (team?.status === "ACTIVE" && members.length === 2) index.activeTeamByPair.set(pairKey(members[0]!, members[1]!), team);
  }
  return index;
}

export function indexedTeamById(state: WorldState, teamId: string): Team | undefined {
  return ensureTeamIndex(state).byId.get(teamId);
}

export function indexedActiveTeamMemberIds(state: WorldState, teamId: string): string[] {
  return [...(ensureTeamIndex(state).activeMembersByTeam.get(teamId) ?? [])];
}

export function indexedActiveTeamForPair(state: WorldState, personAId: string, personBId: string): Team | undefined {
  return ensureTeamIndex(state).activeTeamByPair.get(pairKey(personAId, personBId));
}

export function indexedActiveTeamIdsForPerson(state: WorldState, personId: string): string[] {
  return [...(ensureTeamIndex(state).activeTeamsByPerson.get(personId) ?? new Set<string>())].sort();
}

function retireDisplacedPrimaryTeams(state: WorldState, newTeam: Team): void {
  const memberships = state.teamMemberships ?? [];
  const newMembers = memberships
    .filter((membership) => membership.teamId === newTeam.id && membership.active)
    .map((membership) => membership.personId);
  if (newMembers.length !== 2) return;

  const memberSet = new Set(newMembers);
  const displacedTeamIds = new Set(
    memberships
      .filter((membership) => membership.active && membership.teamId !== newTeam.id && memberSet.has(membership.personId))
      .map((membership) => membership.teamId),
  );
  if (displacedTeamIds.size === 0) return;

  const transitionDate = { ...newTeam.formedDate };
  const ledger = new LedgerWriter(state.world.id, state.ledger);
  for (const teamId of displacedTeamIds) {
    const team = (state.teams ?? []).find((candidate) => candidate.id === teamId);
    if (!team || team.status !== "ACTIVE") continue;
    team.status = "DISBANDED";
    team.disbandedDate = transitionDate;
    for (const membership of memberships) {
      if (membership.teamId !== teamId || !membership.active) continue;
      membership.active = false;
      membership.leftDate = transitionDate;
    }
    ledger.append({
      date: transitionDate,
      type: "TAG_TEAM_DISBANDED",
      significance: "ROUTINE",
      entityIds: [team.id, ...newMembers],
      payload: { reason: "member formed a new primary tag team", replacementTeamId: newTeam.id },
    });
  }
}

export function indexNewTeamState(state: WorldState): void {
  const newestTeam = state.teams?.[state.teams.length - 1];
  if (newestTeam?.status === "ACTIVE") retireDisplacedPrimaryTeams(state, newestTeam);
  teamIndexes.delete(state);
  ensureTeamIndex(state);
}

export function indexTeamDisbanded(state: WorldState, teamId: string): void {
  const index = ensureTeamIndex(state);
  const members = index.activeMembersByTeam.get(teamId) ?? [];
  if (members.length === 2) index.activeTeamByPair.delete(pairKey(members[0]!, members[1]!));
  for (const personId of members) {
    const personTeams = index.activeTeamsByPerson.get(personId);
    personTeams?.delete(teamId);
    if (personTeams?.size === 0) index.activeTeamsByPerson.delete(personId);
  }
  index.activeMembersByTeam.set(teamId, []);
}

function ensureChampionshipIndex(state: WorldState): ChampionshipIndex {
  const reigns = state.championshipReigns ?? [];
  const contests = state.championshipContests ?? [];
  let index = championshipIndexes.get(state);
  if (!index || index.syncedReigns > reigns.length || index.syncedContests > contests.length) {
    index = { syncedReigns: 0, syncedContests: 0, reignById: new Map(), lastContestWeekByChampionship: new Map() };
    championshipIndexes.set(state, index);
  }
  for (let i = index.syncedReigns; i < reigns.length; i += 1) {
    const reign = reigns[i]!;
    index.reignById.set(reign.id, reign);
  }
  index.syncedReigns = reigns.length;
  for (let i = index.syncedContests; i < contests.length; i += 1) {
    const contest = contests[i]!;
    index.lastContestWeekByChampionship.set(
      contest.championshipId,
      ppwDateToWeekIndex(contest.date, state.ruleset.weeksPerYear),
    );
  }
  index.syncedContests = contests.length;
  return index;
}

export function indexedReignById(state: WorldState, reignId: string): ChampionshipReign | undefined {
  return ensureChampionshipIndex(state).reignById.get(reignId);
}

export function indexedLastContestWeek(state: WorldState, championshipId: string): number | null {
  return ensureChampionshipIndex(state).lastContestWeekByChampionship.get(championshipId) ?? null;
}
