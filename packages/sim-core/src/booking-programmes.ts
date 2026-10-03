import type { Match, Person, WorldState, WrestlingEvent } from "../../domain/src/types.js";
import { ppwDateToWeekIndex } from "./clock.js";
import { DeterministicRng } from "./rng.js";

export interface ProgrammeSelection {
  sideA: [Person];
  sideB: [Person];
  meetings: number;
  score: number;
}

interface PairHistory {
  personAId: string;
  personBId: string;
  meetings: number;
  lastWeek: number;
  ratingTotal: number;
  crowdTotal: number;
}

function pairKey(a: string, b: string): string {
  return a < b ? `${a}:${b}` : `${b}:${a}`;
}

function pushScore(person: Person): number {
  return person.momentum * 0.4 + person.popularity * 0.3 + person.recognition * 0.2 + person.skills.presentation * 0.1;
}

function recentEventWeeks(state: WorldState, promotionId: string, currentWeek: number, cutoffWeek: number): Map<string, number> {
  const result = new Map<string, number>();
  for (let i = state.events.length - 1; i >= 0; i -= 1) {
    const event = state.events[i]!;
    const week = ppwDateToWeekIndex(event.date, state.ruleset.weeksPerYear);
    if (week < cutoffWeek) break;
    if (week > currentWeek || event.promotionId !== promotionId || event.status !== "COMPLETED") continue;
    result.set(event.id, week);
  }
  return result;
}

function recentTitleMatchIds(state: WorldState, currentWeek: number, cutoffWeek: number): Set<string> {
  const result = new Set<string>();
  const contests = state.championshipContests ?? [];
  for (let i = contests.length - 1; i >= 0; i -= 1) {
    const contest = contests[i]!;
    const week = ppwDateToWeekIndex(contest.date, state.ruleset.weeksPerYear);
    if (week < cutoffWeek) break;
    if (week <= currentWeek) result.add(contest.matchId);
  }
  return result;
}

function participantsForMatches(state: WorldState, matchIds: Set<string>): Map<string, string[]> {
  const result = new Map<string, string[]>();
  const unresolved = new Set(matchIds);
  for (let i = state.matchParticipants.length - 1; i >= 0 && unresolved.size > 0; i -= 1) {
    const participant = state.matchParticipants[i]!;
    if (!unresolved.has(participant.matchId)) continue;
    const members = result.get(participant.matchId) ?? [];
    members.push(participant.personId);
    result.set(participant.matchId, members);
    if (members.length >= 2) unresolved.delete(participant.matchId);
  }
  return result;
}

function recentSinglesPairKeys(state: WorldState, event: WrestlingEvent, windowWeeks: number): Set<string> {
  const currentWeek = ppwDateToWeekIndex(event.date, state.ruleset.weeksPerYear);
  const cutoffWeek = Math.max(0, currentWeek - windowWeeks);
  const eventWeeks = recentEventWeeks(state, event.promotionId, currentWeek, cutoffWeek);
  const recentMatches = state.matches.filter((match) => match.status === "COMPLETED" && match.type === "SINGLES" && eventWeeks.has(match.eventId));
  const participants = participantsForMatches(state, new Set(recentMatches.map((match) => match.id)));
  const result = new Set<string>();
  for (const match of recentMatches) {
    const ids = participants.get(match.id) ?? [];
    if (ids.length === 2) result.add(pairKey(ids[0]!, ids[1]!));
  }
  return result;
}

function buildRecentHistories(state: WorldState, event: WrestlingEvent, eligibleIds: Set<string>): Map<string, PairHistory> {
  const currentWeek = ppwDateToWeekIndex(event.date, state.ruleset.weeksPerYear);
  const cutoffWeek = Math.max(0, currentWeek - 16);
  const eventWeeks = recentEventWeeks(state, event.promotionId, currentWeek, cutoffWeek);
  const titleMatchIds = recentTitleMatchIds(state, currentWeek, cutoffWeek);
  const recentMatches: Match[] = [];
  for (let i = state.matches.length - 1; i >= 0; i -= 1) {
    const match = state.matches[i]!;
    const week = eventWeeks.get(match.eventId);
    if (week === undefined) continue;
    if (match.status !== "COMPLETED" || match.type !== "SINGLES" || titleMatchIds.has(match.id)) continue;
    recentMatches.push(match);
  }
  const participants = participantsForMatches(state, new Set(recentMatches.map((match) => match.id)));
  const histories = new Map<string, PairHistory>();
  for (const match of recentMatches) {
    const ids = participants.get(match.id) ?? [];
    if (ids.length !== 2 || !eligibleIds.has(ids[0]!) || !eligibleIds.has(ids[1]!)) continue;
    const [personAId, personBId] = ids[0]! < ids[1]! ? [ids[0]!, ids[1]!] : [ids[1]!, ids[0]!];
    const key = pairKey(personAId, personBId);
    const week = eventWeeks.get(match.eventId)!;
    const existing = histories.get(key) ?? { personAId, personBId, meetings: 0, lastWeek: -1, ratingTotal: 0, crowdTotal: 0 };
    existing.meetings += 1;
    existing.lastWeek = Math.max(existing.lastWeek, week);
    existing.ratingTotal += match.criticalRatingStars;
    existing.crowdTotal += match.crowdResponse;
    histories.set(key, existing);
  }
  return histories;
}

export function selectFreshSinglesPair(state: WorldState, event: WrestlingEvent, remaining: Person[]): [Person, Person] | null {
  if (remaining.length < 2) return null;
  const first = remaining[0]!;
  const recentPairs = recentSinglesPairKeys(state, event, 2);
  const opponent = remaining.slice(1).find((candidate) => !recentPairs.has(pairKey(first.id, candidate.id))) ?? remaining[1]!;
  return [first, opponent];
}

export function selectNonTitleProgramme(
  state: WorldState,
  event: WrestlingEvent,
  remaining: Person[],
  rng: DeterministicRng,
): ProgrammeSelection | null {
  if (remaining.length < 2) return null;
  if (!rng.chance(event.type === "MAJOR" ? 1 : 0.75)) return null;
  const peopleById = new Map(remaining.map((person) => [person.id, person]));
  const histories = buildRecentHistories(state, event, new Set(peopleById.keys()));
  const currentWeek = ppwDateToWeekIndex(event.date, state.ruleset.weeksPerYear);
  const candidates: ProgrammeSelection[] = [];
  for (const history of histories.values()) {
    if (history.meetings < 1 || history.meetings >= 4) continue;
    const gap = currentWeek - history.lastWeek;
    if (gap < 2 || gap > 10) continue;
    const a = peopleById.get(history.personAId);
    const b = peopleById.get(history.personBId);
    if (!a || !b) continue;
    const averageRating = history.ratingTotal / history.meetings;
    const averageCrowd = history.crowdTotal / history.meetings;
    if (averageRating < 2.75 && averageCrowd < 52) continue;
    const qualityHeat = averageRating * 8 + averageCrowd * 0.18;
    const starHeat = (pushScore(a) + pushScore(b)) * 0.35;
    const continuity = history.meetings === 2 ? 10 : history.meetings === 1 ? 6 : 2;
    const spacing = gap >= 3 && gap <= 6 ? 8 : 2;
    candidates.push({ sideA: [a], sideB: [b], meetings: history.meetings, score: qualityHeat + starHeat + continuity + spacing });
  }
  candidates.sort((left, right) => right.score - left.score || pairKey(left.sideA[0].id, left.sideB[0].id).localeCompare(pairKey(right.sideA[0].id, right.sideB[0].id)));
  return candidates[0] ?? null;
}
