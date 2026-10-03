import type { MatchType, Person, WorldState, WrestlingEvent, WorkingChemistry } from "../../domain/src/types.js";
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

function removePair(pool: Person[], pair: [Person, Person]): void {
  for (const person of pair) {
    const index = pool.findIndex((candidate) => candidate.id === person.id);
    if (index >= 0) pool.splice(index, 1);
  }
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

  if (remaining.length >= 4 && event.type === "MAJOR" && rng.chance(0.3)) {
    const tag = takeTagCard(remaining, primaryPartners, chemistryByPair);
    if (tag) cards.push(tag);
  }
  if (cards.length === 0 && remaining.length >= 2) {
    cards.push({ type: "SINGLES", sideA: [remaining.shift()!], sideB: [remaining.shift()!] });
  }

  while (remaining.length >= 2) {
    const makeTag = remaining.length >= 4 && rng.chance(event.type === "MAJOR" ? 0.36 : 0.28);
    if (makeTag) {
      const tag = takeTagCard(remaining, primaryPartners, chemistryByPair);
      if (tag) {
        cards.unshift(tag);
        continue;
      }
    }
    cards.unshift({ type: "SINGLES", sideA: [remaining.shift()!], sideB: [remaining.shift()!] });
  }
  return cards;
}
