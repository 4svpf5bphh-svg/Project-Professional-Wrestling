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

function tagSidePairCounts(state: ReturnType<typeof createWorld>): Map<string, number> {
  const tagMatchIds = new Set(state.matches.filter((match) => match.status === "COMPLETED" && match.type === "TAG").map((match) => match.id));
  const membersByMatchSide = new Map<string, string[]>();
  for (const participant of state.matchParticipants) {
    if (!tagMatchIds.has(participant.matchId)) continue;
    const key = `${participant.matchId}:${participant.side}`;
    const members = membersByMatchSide.get(key) ?? [];
    members.push(participant.personId);
    membersByMatchSide.set(key, members);
  }
  const pairCounts = new Map<string, number>();
  for (const members of membersByMatchSide.values()) {
    if (members.length !== 2) continue;
    const key = pairKey(members[0]!, members[1]!);
    pairCounts.set(key, (pairCounts.get(key) ?? 0) + 1);
  }
  return pairCounts;
}

test("tag booking reuses pairings instead of constantly reshuffling partners", () => {
  const state = createWorld(9001, DEFAULT_RULESET);
  resolveWorldWeeks(state, 520);
  const pairCounts = tagSidePairCounts(state);
  const totalSides = [...pairCounts.values()].reduce((sum, count) => sum + count, 0);
  const repeatedSides = [...pairCounts.values()].filter((count) => count >= 3).reduce((sum, count) => sum + count, 0);
  const repeatShare = totalSides === 0 ? 0 : repeatedSides / totalSides;
  const uniqueShare = totalSides === 0 ? 1 : pairCounts.size / totalSides;
  ok(totalSides > 1000, `too few tag sides to validate continuity: ${totalSides}`);
  ok(repeatShare >= 0.55, `only ${(repeatShare * 100).toFixed(1)}% of tag sides used pairings seen at least three times`);
  ok(uniqueShare <= 0.25, `pair churn remains too high: ${(uniqueShare * 100).toFixed(1)}% unique pairings per tag-side appearance`);
  console.log(`  booking diagnostics: ${pairCounts.size} unique pairings across ${totalSides} tag sides; ${(repeatShare * 100).toFixed(1)}% repeated 3+ times`);
});

test("a decade supports meaningful tag divisions without consuming the whole wrestler population", () => {
  const state = createWorld(9002, DEFAULT_RULESET);
  resolveWorldWeeks(state, 520);
  const activeTeams = state.teams?.filter((team) => team.status === "ACTIVE") ?? [];
  const activeWrestlers = state.people.filter((person) => person.status === "ACTIVE").length;
  ok(activeTeams.length >= state.promotions.length * 2, `only ${activeTeams.length} active teams exist across ${state.promotions.length} promotions`);
  ok(activeTeams.length * 2 <= activeWrestlers * 0.5, `${activeTeams.length} active teams consume too much of the ${activeWrestlers}-wrestler population`);
});

console.log(`\nBooking tests: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exitCode = 1;
