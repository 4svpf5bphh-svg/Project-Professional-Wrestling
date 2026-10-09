import type { Person, WorldState, WrestlingEvent } from "../../domain/src/types.js";
import { ppwDateToWeekIndex } from "./clock.js";
import { matchesForEvent, participantsForMatch } from "./indexes.js";
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

function participantIds(state: WorldState, matchId: string): string[] {
  return participantsForMatch(state, matchId).map((participant) => participant.personId);
}

interface RecentSinglesPairHistory {
  meetings: number;
  lastWeek: number;
}

function recentSinglesPairHistory(
  state: WorldState,
  event: WrestlingEvent,
  windowWeeks: number,
): Map<string, RecentSinglesPairHistory> {
  const currentWeek = ppwDateToWeekIndex(event.date, state.ruleset.weeksPerYear);
  const cutoffWeek = Math.max(0, currentWeek - windowWeeks);
  const eventWeeks = recentEventWeeks(state, event.promotionId, currentWeek, cutoffWeek);
  const result = new Map<string, RecentSinglesPairHistory>();
  for (const [eventId, week] of eventWeeks) {
    for (const match of matchesForEvent(state, eventId)) {
      if (match.status !== "COMPLETED" || match.type !== "SINGLES") continue;
      const ids = participantIds(state, match.id);
      if (ids.length !== 2) continue;
      const key = pairKey(ids[0]!, ids[1]!);
      const existing = result.get(key) ?? { meetings: 0, lastWeek: -1 };
      existing.meetings += 1;
      existing.lastWeek = Math.max(existing.lastWeek, week);
      result.set(key, existing);
    }
  }
  return result;
}

function buildRecentHistories(state: WorldState, event: WrestlingEvent, eligibleIds: Set<string>): Map<string, PairHistory> {
  const currentWeek = ppwDateToWeekIndex(event.date, state.ruleset.weeksPerYear);
  const cutoffWeek = Math.max(0, currentWeek - 16);
  const eventWeeks = recentEventWeeks(state, event.promotionId, currentWeek, cutoffWeek);
  const titleMatchIds = recentTitleMatchIds(state, currentWeek, cutoffWeek);
  const histories = new Map<string, PairHistory>();

  for (const [eventId, week] of eventWeeks) {
    for (const match of matchesForEvent(state, eventId)) {
      if (match.status !== "COMPLETED" || match.type !== "SINGLES" || titleMatchIds.has(match.id)) continue;
      const ids = participantIds(state, match.id);
      if (ids.length !== 2 || !eligibleIds.has(ids[0]!) || !eligibleIds.has(ids[1]!)) continue;
      const [personAId, personBId] = ids[0]! < ids[1]! ? [ids[0]!, ids[1]!] : [ids[1]!, ids[0]!];
      const key = pairKey(personAId, personBId);
      const existing = histories.get(key) ?? { personAId, personBId, meetings: 0, lastWeek: -1, ratingTotal: 0, crowdTotal: 0 };
      existing.meetings += 1;
      existing.lastWeek = Math.max(existing.lastWeek, week);
      existing.ratingTotal += match.criticalRatingStars;
      existing.crowdTotal += match.crowdResponse;
      histories.set(key, existing);
    }
  }
  return histories;
}

export function selectFreshSinglesPair(state: WorldState, event: WrestlingEvent, remaining: Person[]): [Person, Person] | null {
  if (remaining.length < 2) return null;
  const currentWeek = ppwDateToWeekIndex(event.date, state.ruleset.weeksPerYear);
  const histories = recentSinglesPairHistory(state, event, 16);
  const candidates: {
    a: Person;
    b: Person;
    recent: boolean;
    programmeWindow: boolean;
    unused: boolean;
    meetings: number;
    gap: number;
    star: number;
    key: string;
  }[] = [];

  for (let left = 0; left < remaining.length - 1; left += 1) {
    for (let right = left + 1; right < remaining.length; right += 1) {
      const a = remaining[left]!;
      const b = remaining[right]!;
      const key = pairKey(a.id, b.id);
      const history = histories.get(key);
      const gap = history ? currentWeek - history.lastWeek : 1_000_000;
      const meetings = history?.meetings ?? 0;
      candidates.push({
        a,
        b,
        recent: gap <= 2,
        programmeWindow: meetings > 0 && meetings < 4 && gap >= 3 && gap <= 10,
        unused: meetings === 0,
        meetings,
        gap,
        star: pushScore(a) + pushScore(b),
        key,
      });
    }
  }

  candidates.sort((left, right) => (
    Number(left.recent) - Number(right.recent)
    || Number(right.programmeWindow) - Number(left.programmeWindow)
    || Number(right.unused) - Number(left.unused)
    || left.meetings - right.meetings
    || right.gap - left.gap
    || right.star - left.star
    || left.key.localeCompare(right.key)
  ));
  const best = candidates[0];
  return best ? [best.a, best.b] : null;
}

export function selectNonTitleProgramme(
  state: WorldState,
  event: WrestlingEvent,
  remaining: Person[],
  rng: DeterministicRng,
): ProgrammeSelection | null {
  if (remaining.length < 2) return null;
  void rng;
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
