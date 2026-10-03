declare const process: { exitCode?: number };

import { DEFAULT_RULESET } from "../packages/config/src/default-ruleset.js";
import {
  activeTeamMemberIds,
  createWorld,
  ensureWorldChampionships,
  maintainChampionshipsForWeek,
  resolveWorldWeeks,
  summarizeWorld,
} from "../packages/sim-core/src/index.js";

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

function equal<T>(actual: T, expected: T, message?: string): void {
  if (actual !== expected) throw new Error(message ?? `expected ${String(expected)}, received ${String(actual)}`);
}

function ok(value: unknown, message: string): void {
  if (!value) throw new Error(message);
}

test("each operating promotion receives singles and tag championships", () => {
  const state = createWorld(8001, DEFAULT_RULESET);
  ensureWorldChampionships(state);
  equal(state.championships?.length, state.promotions.length * 2);
  for (const promotion of state.promotions) {
    const titles = state.championships?.filter((championship) => championship.promotionId === promotion.id) ?? [];
    equal(titles.filter((championship) => championship.division === "SINGLES").length, 1);
    equal(titles.filter((championship) => championship.division === "TAG").length, 1);
  }
});

test("major events create real championship lineages", () => {
  const state = createWorld(8002, DEFAULT_RULESET);
  resolveWorldWeeks(state, 26);
  const singles = state.championships?.filter((championship) => championship.division === "SINGLES") ?? [];
  ok(singles.length === state.promotions.length, "singles championships were not created for each promotion");
  ok(singles.filter((championship) => championship.currentReignId !== null).length >= Math.floor(state.promotions.length * 0.75), "too few singles championships crowned a first champion");
  ok((state.championshipContests?.length ?? 0) > 0, "no championship contests were recorded");
  ok((state.championshipReigns?.length ?? 0) > 0, "no championship reigns were recorded");
});

test("championship contests always link to completed promotion-compatible matches", () => {
  const state = createWorld(8003, DEFAULT_RULESET);
  resolveWorldWeeks(state, 104);
  for (const contest of state.championshipContests ?? []) {
    const championship = state.championships?.find((candidate) => candidate.id === contest.championshipId);
    const match = state.matches.find((candidate) => candidate.id === contest.matchId);
    const event = state.events.find((candidate) => candidate.id === contest.eventId);
    ok(Boolean(championship), `${contest.id} references missing championship`);
    ok(Boolean(match), `${contest.id} references missing match`);
    ok(Boolean(event), `${contest.id} references missing event`);
    equal(match?.status, "COMPLETED", `${contest.id} used a non-completed match`);
    equal(match?.promotionId, championship?.promotionId, `${contest.id} crosses promotion ownership`);
    equal(event?.promotionId, championship?.promotionId, `${contest.id} event crosses promotion ownership`);
    if (championship?.division === "SINGLES") equal(match?.type, "SINGLES", `${contest.id} singles title used non-singles match`);
    if (championship?.division === "TAG") equal(match?.type, "TAG", `${contest.id} tag title used non-tag match`);
  }
});

test("persistent tag teams have exact active two-person membership", () => {
  const state = createWorld(8004, DEFAULT_RULESET);
  resolveWorldWeeks(state, 104);
  const activeTeams = state.teams?.filter((team) => team.status === "ACTIVE") ?? [];
  ok(activeTeams.length > 0, "no persistent tag teams emerged");
  for (const team of activeTeams) {
    const members = activeTeamMemberIds(state, team.id);
    equal(members.length, 2, `${team.id} does not have exactly two active members`);
    equal(new Set(members).size, 2, `${team.id} repeats the same wrestler`);
  }
});

test("title defenses and changes emerge rather than only inaugural champions", () => {
  const state = createWorld(8005, DEFAULT_RULESET);
  resolveWorldWeeks(state, 260);
  const contests = state.championshipContests ?? [];
  const defenses = contests.filter((contest) => contest.previousHolderId !== null && !contest.titleChanged);
  const changes = contests.filter((contest) => contest.previousHolderId !== null && contest.titleChanged);
  ok(defenses.length > 0, "no successful championship defenses emerged in five PPW Years");
  ok(changes.length > 0, "no championship changes emerged in five PPW Years");
});

test("active championship current reign pointers remain internally consistent", () => {
  const state = createWorld(8006, DEFAULT_RULESET);
  resolveWorldWeeks(state, 260);
  maintainChampionshipsForWeek(state);
  for (const championship of state.championships ?? []) {
    if (!championship.currentReignId) continue;
    const reign = state.championshipReigns?.find((candidate) => candidate.id === championship.currentReignId);
    ok(Boolean(reign), `${championship.id} points to missing reign`);
    equal(reign?.status, "ACTIVE", `${championship.id} points to ended reign`);
    equal(reign?.championshipId, championship.id, `${championship.id} points to another title's reign`);
  }
});

test("competition state participates in deterministic summaries", () => {
  const a = createWorld(8007, DEFAULT_RULESET);
  const b = createWorld(8007, DEFAULT_RULESET);
  resolveWorldWeeks(a, 104);
  resolveWorldWeeks(b, 104);
  const summaryA = summarizeWorld(a);
  const summaryB = summarizeWorld(b);
  equal(summaryA.deterministicHash, summaryB.deterministicHash);
  equal(summaryA.championshipContests, summaryB.championshipContests);
  equal(summaryA.teams, summaryB.teams);
});

console.log(`\nCompetition tests: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exitCode = 1;
