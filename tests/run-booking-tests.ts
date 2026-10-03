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

function participantsBySide(state: ReturnType<typeof createWorld>, matchId: string): { A: string[]; B: string[] } {
  const result: { A: string[]; B: string[] } = { A: [], B: [] };
  for (const participant of state.matchParticipants) {
    if (participant.matchId !== matchId) continue;
    result[participant.side].push(participant.personId);
  }
  result.A.sort();
  result.B.sort();
  return result;
}

function historicalTeamPairs(state: ReturnType<typeof createWorld>): Set<string> {
  const membersByTeam = new Map<string, string[]>();
  for (const membership of state.teamMemberships ?? []) {
    const members = membersByTeam.get(membership.teamId) ?? [];
    if (!members.includes(membership.personId)) members.push(membership.personId);
    membersByTeam.set(membership.teamId, members);
  }
  const pairs = new Set<string>();
  for (const members of membersByTeam.values()) {
    if (members.length === 2) pairs.add(pairKey(members[0]!, members[1]!));
  }
  return pairs;
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

test("major singles title matches are treated as top-card matches", () => {
  const state = createWorld(9003, DEFAULT_RULESET);
  resolveWorldWeeks(state, 520);
  const championships = new Map((state.championships ?? []).map((championship) => [championship.id, championship]));
  const events = new Map(state.events.map((event) => [event.id, event]));
  const matches = new Map(state.matches.map((match) => [match.id, match]));
  const majorSingles = (state.championshipContests ?? []).filter((contest) => {
    const championship = championships.get(contest.championshipId);
    const event = events.get(contest.eventId);
    return championship?.division === "SINGLES" && event?.type === "MAJOR";
  });
  const topCard = majorSingles.filter((contest) => {
    const event = events.get(contest.eventId)!;
    const match = matches.get(contest.matchId)!;
    return match.order >= Math.max(1, event.matchCount - 1);
  });
  const share = majorSingles.length === 0 ? 0 : topCard.length / majorSingles.length;
  ok(majorSingles.length > 40, `too few major singles title matches to validate placement: ${majorSingles.length}`);
  ok(share >= 0.8, `only ${(share * 100).toFixed(1)}% of major singles title matches were in the top two card positions`);
  console.log(`  title placement: ${topCard.length}/${majorSingles.length} major singles title matches in top two positions`);
});

test("tag title challengers are usually established teams rather than improvised pairings", () => {
  const state = createWorld(9004, DEFAULT_RULESET);
  resolveWorldWeeks(state, 520);
  const championships = new Map((state.championships ?? []).map((championship) => [championship.id, championship]));
  const knownPairs = historicalTeamPairs(state);
  let eligible = 0;
  let established = 0;
  for (const contest of state.championshipContests ?? []) {
    const championship = championships.get(contest.championshipId);
    if (championship?.division !== "TAG" || !contest.previousHolderId) continue;
    const holderMembers = (state.teamMemberships ?? [])
      .filter((membership) => membership.teamId === contest.previousHolderId)
      .map((membership) => membership.personId)
      .filter((id, index, all) => all.indexOf(id) === index)
      .sort();
    if (holderMembers.length !== 2) continue;
    const sides = participantsBySide(state, contest.matchId);
    const holderKey = pairKey(holderMembers[0]!, holderMembers[1]!);
    const challenger = pairKey(...((pairKey(sides.A[0]!, sides.A[1]!) === holderKey ? sides.B : sides.A) as [string, string]));
    eligible += 1;
    if (knownPairs.has(challenger)) established += 1;
  }
  const share = eligible === 0 ? 0 : established / eligible;
  ok(eligible > 40, `too few defended tag title contests to validate challengers: ${eligible}`);
  ok(share >= 0.75, `only ${(share * 100).toFixed(1)}% of tag title challengers were established historical teams`);
  console.log(`  tag challengers: ${established}/${eligible} (${(share * 100).toFixed(1)}%) were established teams`);
});

test("singles champions do not endlessly recycle the same failed challenger", () => {
  const state = createWorld(9005, DEFAULT_RULESET);
  resolveWorldWeeks(state, 520);
  const championships = new Map((state.championships ?? []).map((championship) => [championship.id, championship]));
  const contestsByTitle = new Map<string, typeof state.championshipContests>();
  for (const contest of state.championshipContests ?? []) {
    if (championships.get(contest.championshipId)?.division !== "SINGLES" || !contest.previousHolderId) continue;
    const list = contestsByTitle.get(contest.championshipId) ?? [];
    list.push(contest);
    contestsByTitle.set(contest.championshipId, list);
  }
  let comparable = 0;
  let immediateRepeats = 0;
  let longestRepeatStreak = 1;
  for (const contests of contestsByTitle.values()) {
    let previousChampion: string | null = null;
    let previousChallenger: string | null = null;
    let streak = 1;
    for (const contest of contests ?? []) {
      const sides = participantsBySide(state, contest.matchId);
      const challenger = sides.A.includes(contest.previousHolderId!) ? sides.B[0] : sides.A[0];
      if (!challenger) continue;
      if (previousChampion === contest.previousHolderId) {
        comparable += 1;
        if (previousChallenger === challenger) {
          immediateRepeats += 1;
          streak += 1;
          longestRepeatStreak = Math.max(longestRepeatStreak, streak);
        } else {
          streak = 1;
        }
      } else {
        streak = 1;
      }
      previousChampion = contest.titleChanged ? null : contest.previousHolderId;
      previousChallenger = contest.titleChanged ? null : challenger;
    }
  }
  const repeatShare = comparable === 0 ? 0 : immediateRepeats / comparable;
  ok(comparable > 80, `too few comparable singles defenses to validate challenger rotation: ${comparable}`);
  ok(repeatShare <= 0.35, `${(repeatShare * 100).toFixed(1)}% of consecutive defenses repeated the same challenger`);
  ok(longestRepeatStreak <= 3, `same challenger repeated for ${longestRepeatStreak} consecutive defenses`);
  console.log(`  singles challenger rotation: ${(repeatShare * 100).toFixed(1)}% immediate repeats; max streak ${longestRepeatStreak}`);
});

console.log(`\nBooking tests: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exitCode = 1;
