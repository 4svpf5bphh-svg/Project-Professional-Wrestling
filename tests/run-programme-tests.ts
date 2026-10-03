declare const process: { exitCode?: number };

import { DEFAULT_RULESET } from "../packages/config/src/default-ruleset.js";
import { createWorld, resolveWorldWeeks } from "../packages/sim-core/src/index.js";

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void): void {
  try {
    fn();
    passed += 1;
    console.log(`PASS ${name}`);
  } catch (error) {
    failed += 1;
    console.error(`FAIL ${name}`);
    console.error(error instanceof Error ? error.message : String(error));
  }
}

function ok(value: unknown, message: string): void {
  if (!value) throw new Error(message);
}

function pairKey(a: string, b: string): string {
  return a < b ? `${a}:${b}` : `${b}:${a}`;
}

function weekIndex(date: { year: number; week: number }): number {
  return (date.year - 1) * DEFAULT_RULESET.weeksPerYear + (date.week - 1);
}

function pushScore(person: ReturnType<typeof createWorld>["people"][number]): number {
  return person.momentum * 0.4 + person.popularity * 0.3 + person.recognition * 0.2 + person.skills.presentation * 0.1;
}

test("non-title singles programmes recur with spacing instead of immediate endless rematches", () => {
  const state = createWorld(9101, DEFAULT_RULESET);
  resolveWorldWeeks(state, 520);
  const titleMatchIds = new Set((state.championshipContests ?? []).map((contest) => contest.matchId));
  const eventWeek = new Map(state.events.map((event) => [event.id, weekIndex(event.date)]));
  const participantsByMatch = new Map<string, string[]>();
  for (const participant of state.matchParticipants) {
    const members = participantsByMatch.get(participant.matchId) ?? [];
    members.push(participant.personId);
    participantsByMatch.set(participant.matchId, members);
  }
  const weeksByPair = new Map<string, number[]>();
  for (const match of state.matches) {
    if (match.status !== "COMPLETED" || match.type !== "SINGLES" || titleMatchIds.has(match.id)) continue;
    const members = participantsByMatch.get(match.id) ?? [];
    if (members.length !== 2) continue;
    const key = pairKey(members[0]!, members[1]!);
    const weeks = weeksByPair.get(key) ?? [];
    weeks.push(eventWeek.get(match.eventId) ?? 0);
    weeksByPair.set(key, weeks);
  }
  let repeatGaps = 0;
  let spacedGaps = 0;
  let immediateGaps = 0;
  let maxMeetingsIn16Weeks = 0;
  for (const weeks of weeksByPair.values()) {
    weeks.sort((a, b) => a - b);
    for (let i = 1; i < weeks.length; i += 1) {
      const gap = weeks[i]! - weeks[i - 1]!;
      repeatGaps += 1;
      if (gap >= 2 && gap <= 10) spacedGaps += 1;
      if (gap <= 1) immediateGaps += 1;
    }
    for (let start = 0; start < weeks.length; start += 1) {
      let end = start;
      while (end + 1 < weeks.length && weeks[end + 1]! - weeks[start]! <= 16) end += 1;
      maxMeetingsIn16Weeks = Math.max(maxMeetingsIn16Weeks, end - start + 1);
    }
  }
  const spacedShare = repeatGaps === 0 ? 0 : spacedGaps / repeatGaps;
  const immediateShare = repeatGaps === 0 ? 1 : immediateGaps / repeatGaps;
  ok(repeatGaps > 500, `too few repeated non-title singles pairings to validate programmes: ${repeatGaps}`);
  ok(spacedShare >= 0.45, `only ${(spacedShare * 100).toFixed(1)}% of repeat meetings landed in the 2-10 week programme window`);
  ok(immediateShare <= 0.2, `${(immediateShare * 100).toFixed(1)}% of repeat meetings were immediate rematches`);
  ok(maxMeetingsIn16Weeks <= 8, `one non-title pairing met ${maxMeetingsIn16Weeks} times inside 16 weeks`);
  console.log(`  programme spacing: ${(spacedShare * 100).toFixed(1)}% 2-10 week gaps; ${(immediateShare * 100).toFixed(1)}% immediate; max ${maxMeetingsIn16Weeks} meetings/16 weeks`);
});

test("higher-push wrestlers are consistently booked above lower-push matches", () => {
  const state = createWorld(9102, DEFAULT_RULESET);
  resolveWorldWeeks(state, 520);
  const people = new Map(state.people.map((person) => [person.id, person]));
  const currentWeek = weekIndex(state.world.currentDate);
  const recentEventIds = new Set(state.events.filter((event) => event.status === "COMPLETED" && currentWeek - weekIndex(event.date) <= 26 && event.matchCount >= 4).map((event) => event.id));
  const participantsByMatch = new Map<string, string[]>();
  for (const participant of state.matchParticipants) {
    if (!recentEventIds.has(participant.eventId)) continue;
    const members = participantsByMatch.get(participant.matchId) ?? [];
    members.push(participant.personId);
    participantsByMatch.set(participant.matchId, members);
  }
  let upperTotal = 0;
  let upperCount = 0;
  let lowerTotal = 0;
  let lowerCount = 0;
  for (const event of state.events) {
    if (!recentEventIds.has(event.id)) continue;
    const matches = state.matches.filter((match) => match.eventId === event.id && match.status === "COMPLETED").sort((a, b) => a.order - b.order);
    const split = Math.ceil(matches.length / 2);
    for (let i = 0; i < matches.length; i += 1) {
      const ids = participantsByMatch.get(matches[i]!.id) ?? [];
      const scores = ids.map((id) => people.get(id)).filter((person): person is NonNullable<typeof person> => Boolean(person)).map(pushScore);
      if (!scores.length) continue;
      const average = scores.reduce((sum, score) => sum + score, 0) / scores.length;
      if (i >= split) {
        upperTotal += average;
        upperCount += 1;
      } else {
        lowerTotal += average;
        lowerCount += 1;
      }
    }
  }
  const upperAverage = upperCount ? upperTotal / upperCount : 0;
  const lowerAverage = lowerCount ? lowerTotal / lowerCount : 0;
  ok(upperCount > 100 && lowerCount > 100, `too few recent card positions to validate push ordering: ${upperCount}/${lowerCount}`);
  ok(upperAverage >= lowerAverage + 2.5, `upper-card push average ${upperAverage.toFixed(1)} is not meaningfully above lower-card ${lowerAverage.toFixed(1)}`);
  console.log(`  card push: upper ${upperAverage.toFixed(1)} vs lower ${lowerAverage.toFixed(1)}`);
});

console.log(`\nProgramme tests: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exitCode = 1;
