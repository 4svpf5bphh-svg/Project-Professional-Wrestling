import type {
  ChampionshipContest,
  ChemistryContext,
  Contract,
  Id,
  Match,
  MatchParticipant,
  WorkingChemistry,
  WorldState,
} from "../../domain/src/types.js";
import { ppwDateToWeekIndex } from "./clock.js";

interface ContractIndex {
  syncedLength: number;
  byId: Map<Id, Contract>;
  byPerson: Map<Id, Contract[]>;
  byPromotion: Map<Id, Contract[]>;
  byEndWeek: Map<number, Contract[]>;
}

interface PersonIndex {
  syncedLength: number;
  byId: Map<Id, WorldState["people"][number]>;
}

interface MatchHistoryIndex {
  syncedMatches: number;
  syncedParticipants: number;
  matchesByEvent: Map<Id, Match[]>;
  participantsByMatch: Map<Id, MatchParticipant[]>;
}

interface BookingHistoryIndex {
  syncedContests: number;
  syncedChemistry: number;
  lastContestByChampionship: Map<Id, ChampionshipContest>;
  chemistryByPair: Map<string, WorkingChemistry>;
}

const contractIndexes = new WeakMap<WorldState, ContractIndex>();
const personIndexes = new WeakMap<WorldState, PersonIndex>();
const matchHistoryIndexes = new WeakMap<WorldState, MatchHistoryIndex>();
const bookingHistoryIndexes = new WeakMap<WorldState, BookingHistoryIndex>();

function ensureContractIndex(state: WorldState): ContractIndex {
  let index = contractIndexes.get(state);
  if (!index || index.syncedLength > state.contracts.length) {
    index = { syncedLength: 0, byId: new Map(), byPerson: new Map(), byPromotion: new Map(), byEndWeek: new Map() };
    contractIndexes.set(state, index);
  }
  for (let i = index.syncedLength; i < state.contracts.length; i += 1) {
    const contract = state.contracts[i]!;
    index.byId.set(contract.id, contract);
    const personContracts = index.byPerson.get(contract.personId) ?? [];
    personContracts.push(contract);
    index.byPerson.set(contract.personId, personContracts);

    const promotionContracts = index.byPromotion.get(contract.promotionId) ?? [];
    promotionContracts.push(contract);
    index.byPromotion.set(contract.promotionId, promotionContracts);

    const endWeek = ppwDateToWeekIndex(contract.endDate, state.ruleset.weeksPerYear);
    const ending = index.byEndWeek.get(endWeek) ?? [];
    ending.push(contract);
    index.byEndWeek.set(endWeek, ending);
  }
  index.syncedLength = state.contracts.length;
  return index;
}

export function contractsForPerson(state: WorldState, personId: Id): readonly Contract[] {
  return ensureContractIndex(state).byPerson.get(personId) ?? [];
}

export function contractsForPromotion(state: WorldState, promotionId: Id): readonly Contract[] {
  return ensureContractIndex(state).byPromotion.get(promotionId) ?? [];
}

export function contractsEndingInWeek(state: WorldState, weekIndex: number): readonly Contract[] {
  return ensureContractIndex(state).byEndWeek.get(weekIndex) ?? [];
}

export function contractById(state: WorldState, contractId: Id): Contract | undefined {
  return ensureContractIndex(state).byId.get(contractId);
}

export function personById(state: WorldState, personId: Id): WorldState["people"][number] | undefined {
  let index = personIndexes.get(state);
  if (!index || index.syncedLength > state.people.length) {
    index = { syncedLength: 0, byId: new Map() };
    personIndexes.set(state, index);
  }
  for (let i = index.syncedLength; i < state.people.length; i += 1) {
    const person = state.people[i]!;
    index.byId.set(person.id, person);
  }
  index.syncedLength = state.people.length;
  return index.byId.get(personId);
}

function ensureMatchHistoryIndex(state: WorldState): MatchHistoryIndex {
  let index = matchHistoryIndexes.get(state);
  if (
    !index
    || index.syncedMatches > state.matches.length
    || index.syncedParticipants > state.matchParticipants.length
  ) {
    index = {
      syncedMatches: 0,
      syncedParticipants: 0,
      matchesByEvent: new Map(),
      participantsByMatch: new Map(),
    };
    matchHistoryIndexes.set(state, index);
  }

  for (let i = index.syncedMatches; i < state.matches.length; i += 1) {
    const match = state.matches[i]!;
    const matches = index.matchesByEvent.get(match.eventId) ?? [];
    matches.push(match);
    index.matchesByEvent.set(match.eventId, matches);
  }
  index.syncedMatches = state.matches.length;

  for (let i = index.syncedParticipants; i < state.matchParticipants.length; i += 1) {
    const participant = state.matchParticipants[i]!;
    const participants = index.participantsByMatch.get(participant.matchId) ?? [];
    participants.push(participant);
    index.participantsByMatch.set(participant.matchId, participants);
  }
  index.syncedParticipants = state.matchParticipants.length;
  return index;
}

export function matchesForEvent(state: WorldState, eventId: Id): readonly Match[] {
  return ensureMatchHistoryIndex(state).matchesByEvent.get(eventId) ?? [];
}

export function participantsForMatch(state: WorldState, matchId: Id): readonly MatchParticipant[] {
  return ensureMatchHistoryIndex(state).participantsByMatch.get(matchId) ?? [];
}

function chemistryKey(personAId: Id, personBId: Id, context: ChemistryContext): string {
  const [a, b] = personAId < personBId ? [personAId, personBId] : [personBId, personAId];
  return `${a}:${b}:${context}`;
}

function ensureBookingHistoryIndex(state: WorldState): BookingHistoryIndex {
  const contests = state.championshipContests ?? [];
  let index = bookingHistoryIndexes.get(state);
  if (
    !index
    || index.syncedContests > contests.length
    || index.syncedChemistry > state.workingChemistry.length
  ) {
    index = {
      syncedContests: 0,
      syncedChemistry: 0,
      lastContestByChampionship: new Map(),
      chemistryByPair: new Map(),
    };
    bookingHistoryIndexes.set(state, index);
  }

  for (let i = index.syncedContests; i < contests.length; i += 1) {
    const contest = contests[i]!;
    index.lastContestByChampionship.set(contest.championshipId, contest);
  }
  index.syncedContests = contests.length;

  for (let i = index.syncedChemistry; i < state.workingChemistry.length; i += 1) {
    const chemistry = state.workingChemistry[i]!;
    index.chemistryByPair.set(chemistryKey(chemistry.personAId, chemistry.personBId, chemistry.context), chemistry);
  }
  index.syncedChemistry = state.workingChemistry.length;
  return index;
}

export function lastContestForChampionship(state: WorldState, championshipId: Id): ChampionshipContest | null {
  return ensureBookingHistoryIndex(state).lastContestByChampionship.get(championshipId) ?? null;
}

export function workingChemistryForPair(
  state: WorldState,
  personAId: Id,
  personBId: Id,
  context: ChemistryContext,
): WorkingChemistry | undefined {
  return ensureBookingHistoryIndex(state).chemistryByPair.get(chemistryKey(personAId, personBId, context));
}
