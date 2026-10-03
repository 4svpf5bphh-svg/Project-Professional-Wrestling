import type { MatchType, Person, WorldState, WrestlingEvent, WorkingChemistry } from "../../domain/src/types.js";
import { selectNonTitleProgramme } from "./booking-programmes.js";
import { ppwDateToWeekIndex } from "./clock.js";
import { DeterministicRng } from "./rng.js";

export interface BookingCardMatch {
  type: MatchType;
  sideA: Person[];
  sideB: Person[];
}

function pairKey(a: string, b: string): string {
  return a < b ? `${a}:${b}` : `${b}:${a}`;
}

function pushScore(person: Person): number {
  return person.momentum * 0.4 + person.popularity * 0.3 + person.recognition * 0.2 + person.skills.presentation * 0.1;
}

function cardPushScore(card: BookingCardMatch): number {
  const people = [...card.sideA, ...card.sideB];
  return people.reduce((sum, person) => sum + pushScore(person), 0) / people.length;
}

function activePrimaryPartners(state: WorldState): Map<string, string> {
  const activeTeamIds = new Set((state.teams ?? []).filter((team) => team.status === "ACTIVE").map((team) => team.id));
  const membersByTeam = new Map<string, string[]>();
  for (const membership of state.teamMemberships ?? []) {
    if (!membership.active || !activeTeamIds.has(membership.teamId)) continue;
    const members = membersByTeam.get(membership.teamId) ?? [];
    members.push(membership.personId);
    membersByTeam.set(membership.teamId, members);
  }
  const partners = new Map<string, string>();
  for (const members of membersByTeam.values()) {
    if (members.length !== 2) continue;
    partners.set(members[0]!, members[1]!);
    partners.set(members[1]!, members[0]!);
  }
  return partners;
}

function activeTeamMembers(state: WorldState, teamId: string): string[] {
  return (state.teamMemberships ?? [])
    .filter((membership) => membership.active && membership.teamId === teamId)
    .map((membership) => membership.personId)
    .sort();
}

function tagChemistryByPair(state: WorldState): Map<string, WorkingChemistry> {
  const result = new Map<string, WorkingChemistry>();
  for (const chemistry of state.workingChemistry) {
    if (chemistry.context !== "TAG") continue;
    result.set(pairKey(chemistry.personAId, chemistry.personBId), chemistry);
  }
  return result;
}

function pairingScore(
  a: Person,
  b: Person,
  primaryPartners: Map<string, string>,
  chemistryByPair: Map<string, WorkingChemistry>,
): number {
  const key = pairKey(a.id, b.id);
  const chemistry = chemistryByPair.get(key);
  const aPartner = primaryPartners.get(a.id);
  const bPartner = primaryPartners.get(b.id);
  const established = aPartner === b.id && bPartner === a.id;
  const displacedPrimaryPenalty = (aPartner && aPartner !== b.id ? 4000 : 0) + (bPartner && bPartner !== a.id ? 4000 : 0);
  return (established ? 10000 : 0)
    + (chemistry?.matchesTogether ?? 0) * 180
    + (chemistry?.familiarity ?? 0) * 2
    + (chemistry?.compatibility ?? 0) * 0.5
    - displacedPrimaryPenalty;
}

function bestPair(
  people: Person[],
  primaryPartners: Map<string, string>,
  chemistryByPair: Map<string, WorkingChemistry>,
): [Person, Person] | null {
  if (people.length < 2) return null;
  const candidates: { a: Person; b: Person; score: number; star: number; key: string }[] = [];
  for (let i = 0; i < people.length - 1; i += 1) {
    for (let j = i + 1; j < people.length; j += 1) {
      const a = people[i]!;
      const b = people[j]!;
      candidates.push({
        a,
        b,
        score: pairingScore(a, b, primaryPartners, chemistryByPair),
        star: pushScore(a) + pushScore(b),
        key: pairKey(a.id, b.id),
      });
    }
  }
  candidates.sort((left, right) => right.score - left.score || right.star - left.star || left.key.localeCompare(right.key));
  const best = candidates[0];
  return best ? [best.a, best.b] : null;
}

function removePeople(pool: Person[], people: Person[]): void {
  for (const person of people) {
    const index = pool.findIndex((candidate) => candidate.id === person.id);
    if (index >= 0) pool.splice(index, 1);
  }
}

function removePair(pool: Person[], pair: [Person, Person]): void {
  removePeople(pool, pair);
}

function takeTagCard(
  remaining: Person[],
  primaryPartners: Map<string, string>,
  chemistryByPair: Map<string, WorkingChemistry>,
): BookingCardMatch | null {
  if (remaining.length < 4) return null;
  const first = bestPair(remaining, primaryPartners, chemistryByPair);
  if (!first) return null;
  const afterFirst = remaining.filter((person) => person.id !== first[0].id && person.id !== first[1].id);
  const second = bestPair(afterFirst, primaryPartners, chemistryByPair);
  if (!second) return null;
  removePair(remaining, first);
  removePair(remaining, second);
  return { type: "TAG", sideA: first, sideB: second };
}

function lastContestFor(state: WorldState, championshipId: string) {
  const contests = (state.championshipContests ?? []).filter((contest) => contest.championshipId === championshipId);
  return contests.length ? contests[contests.length - 1]! : null;
}

function titleDue(state: WorldState, championshipId: string, division: "SINGLES" | "TAG", event: WrestlingEvent): boolean {
  if (event.type === "MAJOR") return true;
  const last = lastContestFor(state, championshipId);
  if (!last) return false;
  const interval = division === "SINGLES" ? state.ruleset.singlesTitleDefenseIntervalWeeks : state.ruleset.tagTitleDefenseIntervalWeeks;
  return ppwDateToWeekIndex(event.date, state.ruleset.weeksPerYear) - ppwDateToWeekIndex(last.date, state.ruleset.weeksPerYear) >= interval;
}

function matchParticipantsBySide(state: WorldState, matchId: string): { A: string[]; B: string[] } {
  const result: { A: string[]; B: string[] } = { A: [], B: [] };
  for (const participant of state.matchParticipants) {
    if (participant.matchId !== matchId) continue;
    result[participant.side].push(participant.personId);
  }
  result.A.sort();
  result.B.sort();
  return result;
}

function lastOpponentIds(state: WorldState, championshipId: string, holderIds: string[]): { ids: string[]; rematch: boolean } | null {
  const contest = lastContestFor(state, championshipId);
  if (!contest) return null;
  const sides = matchParticipantsBySide(state, contest.matchId);
  const holderKey = [...holderIds].sort().join(":");
  if (contest.titleChanged && contest.previousHolderId) {
    const championship = (state.championships ?? []).find((candidate) => candidate.id === championshipId);
    if (championship?.division === "SINGLES") return { ids: [contest.previousHolderId], rematch: true };
    const previousMembers = (state.teamMemberships ?? [])
      .filter((membership) => membership.teamId === contest.previousHolderId)
      .map((membership) => membership.personId)
      .filter((id, index, all) => all.indexOf(id) === index)
      .sort();
    return previousMembers.length === 2 ? { ids: previousMembers, rematch: true } : null;
  }
  if (sides.A.join(":") === holderKey) return { ids: sides.B, rematch: false };
  if (sides.B.join(":") === holderKey) return { ids: sides.A, rematch: false };
  return null;
}

function reserveSinglesTitleMatch(state: WorldState, event: WrestlingEvent, remaining: Person[]): BookingCardMatch | null {
  const championship = (state.championships ?? []).find((candidate) => candidate.promotionId === event.promotionId && candidate.division === "SINGLES" && candidate.status === "ACTIVE" && candidate.currentReignId !== null);
  if (!championship || !titleDue(state, championship.id, "SINGLES", event)) return null;
  const reign = (state.championshipReigns ?? []).find((candidate) => candidate.id === championship.currentReignId && candidate.status === "ACTIVE");
  if (!reign || reign.holderType !== "PERSON") return null;
  const champion = remaining.find((person) => person.id === reign.holderId);
  if (!champion) return null;
  const lastOpponent = lastOpponentIds(state, championship.id, [champion.id]);
  const candidates = remaining
    .filter((person) => person.id !== champion.id)
    .map((person) => {
      const sameLast = lastOpponent?.ids.length === 1 && lastOpponent.ids[0] === person.id;
      const programme = sameLast ? (lastOpponent?.rematch ? 800 : -1200) : 0;
      return { person, score: pushScore(person) + programme };
    })
    .sort((a, b) => b.score - a.score || a.person.id.localeCompare(b.person.id));
  const challenger = candidates[0]?.person;
  if (!challenger) return null;
  removePeople(remaining, [champion, challenger]);
  return { type: "SINGLES", sideA: [champion], sideB: [challenger] };
}

function activeEstablishedPairs(state: WorldState, remaining: Person[]): [Person, Person][] {
  const peopleById = new Map(remaining.map((person) => [person.id, person]));
  const pairs: [Person, Person][] = [];
  const seen = new Set<string>();
  for (const team of state.teams ?? []) {
    if (team.status !== "ACTIVE") continue;
    const members = activeTeamMembers(state, team.id);
    if (members.length !== 2) continue;
    const a = peopleById.get(members[0]!);
    const b = peopleById.get(members[1]!);
    if (!a || !b) continue;
    const key = pairKey(a.id, b.id);
    if (seen.has(key)) continue;
    seen.add(key);
    pairs.push([a, b]);
  }
  return pairs;
}

function reserveTagTitleMatch(state: WorldState, event: WrestlingEvent, remaining: Person[], chemistryByPair: Map<string, WorkingChemistry>): BookingCardMatch | null {
  const championship = (state.championships ?? []).find((candidate) => candidate.promotionId === event.promotionId && candidate.division === "TAG" && candidate.status === "ACTIVE" && candidate.currentReignId !== null);
  if (!championship || !titleDue(state, championship.id, "TAG", event)) return null;
  const reign = (state.championshipReigns ?? []).find((candidate) => candidate.id === championship.currentReignId && candidate.status === "ACTIVE");
  if (!reign || reign.holderType !== "TEAM") return null;
  const championIds = activeTeamMembers(state, reign.holderId);
  if (championIds.length !== 2) return null;
  const peopleById = new Map(remaining.map((person) => [person.id, person]));
  const champions = championIds.map((id) => peopleById.get(id)).filter((person): person is Person => Boolean(person));
  if (champions.length !== 2) return null;
  const championKey = pairKey(champions[0]!.id, champions[1]!.id);
  const lastOpponent = lastOpponentIds(state, championship.id, championIds);
  const lastOpponentKey = lastOpponent?.ids.length === 2 ? pairKey(lastOpponent.ids[0]!, lastOpponent.ids[1]!) : null;
  const candidates = activeEstablishedPairs(state, remaining)
    .filter((pair) => pairKey(pair[0].id, pair[1].id) !== championKey)
    .map((pair) => {
      const key = pairKey(pair[0].id, pair[1].id);
      const chemistry = chemistryByPair.get(key);
      const sameLast = key === lastOpponentKey;
      const programme = sameLast ? (lastOpponent?.rematch ? 1200 : -1800) : 0;
      return {
        pair,
        score: pushScore(pair[0]) + pushScore(pair[1]) + (chemistry?.familiarity ?? 0) * 0.1 + programme,
        key,
      };
    })
    .sort((a, b) => b.score - a.score || a.key.localeCompare(b.key));
  const challengers = candidates[0]?.pair;
  if (!challengers) return null;
  removePeople(remaining, [...champions, ...challengers]);
  return { type: "TAG", sideA: champions, sideB: challengers };
}

export function buildBookingCard(
  state: WorldState,
  event: WrestlingEvent,
  ranked: Person[],
  rng: DeterministicRng,
): BookingCardMatch[] {
  const cards: BookingCardMatch[] = [];
  const remaining = [...ranked];
  const primaryPartners = activePrimaryPartners(state);
  const chemistryByPair = tagChemistryByPair(state);

  const singlesTitle = reserveSinglesTitleMatch(state, event, remaining);
  const tagTitle = reserveTagTitleMatch(state, event, remaining, chemistryByPair);
  const programme = selectNonTitleProgramme(state, event, remaining, rng);
  if (programme) removePeople(remaining, [programme.sideA[0], programme.sideB[0]]);

  if (!singlesTitle && !tagTitle && !programme) {
    if (remaining.length >= 4 && event.type === "MAJOR" && rng.chance(0.3)) {
      const tag = takeTagCard(remaining, primaryPartners, chemistryByPair);
      if (tag) cards.push(tag);
    }
    if (cards.length === 0 && remaining.length >= 2) {
      cards.push({ type: "SINGLES", sideA: [remaining.shift()!], sideB: [remaining.shift()!] });
    }
  }

  while (remaining.length >= 2) {
    const makeTag = remaining.length >= 4 && rng.chance(event.type === "MAJOR" ? 0.36 : 0.28);
    if (makeTag) {
      const tag = takeTagCard(remaining, primaryPartners, chemistryByPair);
      if (tag) {
        cards.push(tag);
        continue;
      }
    }
    cards.push({ type: "SINGLES", sideA: [remaining.shift()!], sideB: [remaining.shift()!] });
  }

  cards.sort((a, b) => cardPushScore(a) - cardPushScore(b));
  if (programme) cards.push({ type: "SINGLES", sideA: programme.sideA, sideB: programme.sideB });
  if (tagTitle) cards.push(tagTitle);
  if (singlesTitle) cards.push(singlesTitle);
  return cards;
}
