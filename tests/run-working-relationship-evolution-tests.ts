declare const process: { exitCode?: number };
import { DEFAULT_RULESET } from "../packages/config/src/default-ruleset.js";
import type { Match, MatchParticipant, PpwDate, WorldState } from "../packages/domain/src/types.js";
import { createWorld, upsertWrestlerRelationship, wrestlerRelationshipBetween, resolveWorldWeek, deterministicWorldHash } from "../packages/sim-core/src/index.js";
import {
  evolveCompletedWorkingPartnerships, WORKING_PARTNERSHIP_LEDGER_TYPE,
  WORKING_PARTNERSHIP_STRAIN_LEDGER_TYPE,
} from "../packages/application/src/working-relationship-evolution.js";
import { workingConnectionsForWrestler } from "../packages/application/src/wrestler-working-connections.js";

let pass = 0; let fail = 0;
function test(name: string, run: () => void): void {
  try { run(); pass++; console.log("PASS " + name); }
  catch (error) { fail++; console.error("FAIL " + name + ": " + String(error)); }
}
function ok(condition: unknown, message: string): void {
  if (!condition) throw new Error(message);
}
function world(seed: number): { state: WorldState; ids: string[]; promotionId: string } {
  const state = createWorld(seed, DEFAULT_RULESET);
  state.world.currentDate = { year: 1, week: 3, day: 1 };
  // Choose an unseeded pair so new-relationship coverage is stable for real-roster changes.
  let ids: string[] = [];
  pair: for (const a of state.people) {
    for (const b of state.people) {
      if (a.id === b.id || wrestlerRelationshipBetween(state, a.id, b.id)) continue;
      ids = [a.id, b.id, ...state.people.filter(p => p.id !== a.id && p.id !== b.id)
        .slice(0, 2).map(p => p.id)];
      break pair;
    }
  }
  const promotionId = state.promotions[0]!.id;
  ok(ids.length === 4, "not enough wrestlers");
  return { state, ids, promotionId };
}
function addMatch(
  state: WorldState, ids: string[], promotionId: string, week: number,
  id: string, opts: { status?: "COMPLETED" | "SCHEDULED"; quality?: number; type?: "TAG" | "SINGLES"; missing?: boolean; date?: PpwDate } = {},
): void {
  const date = opts.date ?? { year: 1, week, day: 6 };
  const eventId = "event-" + id;
  const promotion = state.promotions.find(p => p.id === promotionId)!;
  const venue = state.venues.find(v => v.marketId === promotion.homeMarketId)!;
  state.events.push({
    id: eventId, worldId: state.world.id, promotionId,
    marketId: promotion.homeMarketId, venueId: venue.id,
    date, type: "REGULAR", status: opts.status ?? "COMPLETED",
    ticketStrategy: "STANDARD", expectedDemand: 100, attendance: 100,
    ticketYield: 25, gateRevenue: 2500, totalCost: 1800, netResult: 700,
    eventImportance: 50, matchCount: 1, averageMatchRating: 3.5,
    bestMatchRating: 3.5, crowdResponse: 75,
  });
  const match: Match = {
    id, worldId: state.world.id, eventId, promotionId,
    order: 1, type: opts.type ?? "TAG", status: opts.status ?? "COMPLETED",
    intent: "COMPETITIVE", plannedLengthMinutes: 15, actualLengthMinutes: 16,
    intendedWinnerSide: "B", actualWinnerSide: "B",
    finishChangedDueToInjury: false, executionQuality: opts.quality ?? 80,
    criticalRatingStars: 3.5, crowdResponse: 75,
  };
  state.matches.push(match);
  const people = opts.type === "SINGLES" ? ids.slice(0, 2) : ids.slice(0, opts.missing ? 3 : 4);
  const participants: MatchParticipant[] = people.map((personId, i) => ({
    id: id + "-participant-" + i, worldId: state.world.id, matchId: id, eventId,
    personId, side: opts.type === "SINGLES" ? (i ? "B" : "A") : (i < 2 ? "A" : "B"),
    won: false,
  }));
  state.matchParticipants.push(...participants);
}

test("Repeated real tag work gradually builds professional trust once, preserving all other feelings", () => {
  const { state, ids, promotionId } = world(94121);
  const [a, b] = ids;
  const base = upsertWrestlerRelationship(state, {
    personAId: a!, personBId: b!, professionalTrust: 55,
    affinity: -35, rivalryHeat: 92, familiarity: 20, tags: ["FORMER_PARTNERS"],
  });
  addMatch(state, ids, promotionId, 2, "early-team");
  ok(evolveCompletedWorkingPartnerships(state) === 0,
    "old match without current completed work triggered growth");
  addMatch(state, ids, promotionId, 3, "now-team");
  const measured = workingConnectionsForWrestler(state, a!).find(entry => entry.personId === b);
  ok(measured?.recentTagMatchesTogether === 2,
    "read-side match provenance disagrees: " + JSON.stringify(measured));
  ok(evolveCompletedWorkingPartnerships(state) === 2,
    "both legitimate tag teams should progress, exactly once each; audit records="
      + state.ledger.filter(entry => entry.type === WORKING_PARTNERSHIP_LEDGER_TYPE).length);
  ok(base.professionalTrust === 55.8 && base.familiarity === 22,
    "bounded professional trust or familiarity growth incorrect");
  ok(base.affinity === -35 && base.rivalryHeat === 92
    && JSON.stringify(base.tags) === JSON.stringify(["FORMER_PARTNERS"]),
    "scripted feud/background tags or personal affinity were rewritten");
  const entry = state.ledger.filter(item => item.type === WORKING_PARTNERSHIP_LEDGER_TYPE
    && item.entityIds.includes(a!) && item.entityIds.includes(b!));
  ok(entry.length === 1 && entry[0]!.payload.trustDelta === 0.8
    && entry[0]!.payload.sourceMatchId === "now-team",
    "auditable match provenance or exact applied delta was not persisted");
  const before = JSON.stringify(state);
  ok(evolveCompletedWorkingPartnerships(state) === 0 && JSON.stringify(state) === before,
    "repeating World resolution stacked interpersonal growth");
  const saved: WorldState = structuredClone(state);
  ok(evolveCompletedWorkingPartnerships(saved) === 0
    && wrestlerRelationshipBetween(saved, a!, b!)?.professionalTrust === 55.8,
    "restored World double-counted already persisted collaboration");
  const view = workingConnectionsForWrestler(saved, a!).find(item => item.personId === b);
  ok(view?.relationship?.professionalTrust === 55.8
    && view.recentTagMatchesTogether === 2,
    "working history failed to reflect the actual authority state");
});

test("Cooldown, multiple promotions, and the trust ceiling are World-wide", () => {
  const { state, ids, promotionId } = world(94122);
  const [a, b] = ids;
  const otherPromotionId = state.promotions.find(p => p.id !== promotionId)!.id;
  const record = upsertWrestlerRelationship(state, {
    personAId: a!, personBId: b!, professionalTrust: 74.8,
    familiarity: 96, affinity: 7, rivalryHeat: 80,
  });
  addMatch(state, ids, promotionId, 2, "p2");
  addMatch(state, ids, promotionId, 3, "p3");
  ok(evolveCompletedWorkingPartnerships(state) === 2, "both tag sides must receive earned initial progress");
  ok(record.professionalTrust === 75 && record.familiarity === 98,
    "trust must saturate at 75 and preserve the difference from chemistry");
  state.world.currentDate = { year: 1, week: 4, day: 1 };
  addMatch(state, ids, otherPromotionId, 4, "elsewhere");
  ok(evolveCompletedWorkingPartnerships(state) === 0,
    "other promotion circumvented the global eight-week cooldown");
  state.world.currentDate = { year: 1, week: 11, day: 1 };
  addMatch(state, ids, promotionId, 11, "p11");
  ok(evolveCompletedWorkingPartnerships(state) === 2,
    "genuine later collaboration should be eligible for both pairs after eight weeks");
  ok(record.professionalTrust === 75 && record.familiarity === 100,
    "high trust must not drop to the soft ceiling and familiarity should saturate");
  state.world.currentDate = { year: 1, week: 19, day: 1 };
  addMatch(state, ids, promotionId, 19, "p19");
  ok(evolveCompletedWorkingPartnerships(state) === 1,
    "only the opposing pair should still progress once the first pair has fully saturated");
  ok(state.ledger.filter(item => item.type === WORKING_PARTNERSHIP_LEDGER_TYPE
    && item.entityIds.includes(a!) && item.entityIds.includes(b!)).length === 2,
    "fully saturated pair generated extra events after reaching both ceilings");
});

test("No friendship from scripted defeats, singles opponents, low-quality or incomplete tag shows", () => {
  const { state, ids, promotionId } = world(94123);
  const [a, b] = ids;
  addMatch(state, ids, promotionId, 2, "weak", { quality: 25 });
  addMatch(state, ids, promotionId, 3, "current", { quality: 80 });
  ok(evolveCompletedWorkingPartnerships(state) === 0,
    "poor-quality team outing was treated as established working success");
  state.world.currentDate = { year: 1, week: 4, day: 1 };
  addMatch(state, ids, promotionId, 4, "missing", { missing: true });
  ok(evolveCompletedWorkingPartnerships(state) === 0,
    "three-person invalid tag match manufactured a partnership");
  state.world.currentDate = { year: 1, week: 5, day: 1 };
  addMatch(state, ids, promotionId, 5, "opposition", { type: "SINGLES" });
  ok(evolveCompletedWorkingPartnerships(state) === 0,
    "booked singles opposition was misread as personal collaboration");
  state.world.currentDate = { year: 1, week: 6, day: 1 };
  addMatch(state, ids, promotionId, 6, "scheduled", { status: "SCHEDULED" });
  ok(evolveCompletedWorkingPartnerships(state) === 0,
    "uncompleted matches influenced persistent relationships");
  ok(wrestlerRelationshipBetween(state, a!, b!) === null
    && state.ledger.every(item => item.type !== WORKING_PARTNERSHIP_LEDGER_TYPE),
    "unverified matches wrote feelings or invented historical evidence");
});

test("Newly verified work creates a neutral, portable pair, never a forced alliance", () => {
  const { state, ids, promotionId } = world(94124);
  const [a, b] = ids;
  ok(wrestlerRelationshipBetween(state, a!, b!) === null,
    "fixture unexpectedly contains a seeded personal relationship");
  addMatch(state, ids, promotionId, 2, "new-first");
  addMatch(state, ids, promotionId, 3, "new-second");
  ok(evolveCompletedWorkingPartnerships(state) === 2, "both new tag-side pairs should be created");
  const relation = wrestlerRelationshipBetween(state, a!, b!);
  if (!relation) throw new Error("new pair missing after World development");
  ok(relation.professionalTrust === 50.8 && relation.familiarity === 2,
    "new pair must begin neutral and earn only a tiny working relationship increment");
  ok(relation.tags.length === 0 && relation.affinity === 0 && relation.rivalryHeat === 0,
    "completed tag matches falsely created a friendship, alliance or feud");
});


test("Repeated poor collaboration strains only established in-ring confidence, not scripted alliances", () => {
  const { state, ids, promotionId } = world(94125);
  const [a, b] = ids;
  const person = state.people.find(p => p.id === a)!;
  const moraleBefore = person.morale;
  const relationship = upsertWrestlerRelationship(state, {
    personAId: a!, personBId: b!, professionalTrust: 66,
    familiarity: 30, affinity: -22, rivalryHeat: 94, tags: ["ALLY"],
  });
  addMatch(state, ids, promotionId, 1, "poor-first", { quality: 33 });
  addMatch(state, ids, promotionId, 2, "poor-second", { quality: 31 });
  ok(evolveCompletedWorkingPartnerships(state) === 0,
    "two weak shows cannot create a working grievance");
  addMatch(state, ids, promotionId, 3, "poor-third", { quality: 34 });
  ok(evolveCompletedWorkingPartnerships(state) === 1,
    "three independent poor tag shows should affect one established pair");
  ok(relationship.professionalTrust === 65.4
    && relationship.familiarity === 30 && relationship.affinity === -22
    && relationship.rivalryHeat === 94 && relationship.tags.join() === "ALLY",
    "working confidence must not manufacture personal hostility or erase history");
  ok(person.morale === moraleBefore, "poor collaboration changed global morale");
  const records = state.ledger.filter(entry => entry.type === WORKING_PARTNERSHIP_STRAIN_LEDGER_TYPE);
  ok(records.length === 1 && records[0]!.payload.sourceMatchId === "poor-third"
    && records[0]!.payload.verifiedShows === 3 && records[0]!.payload.trustDelta === -0.6,
    "strained confidence lacks immutable factual provenance or exact effect");
  const before = JSON.stringify(state);
  ok(evolveCompletedWorkingPartnerships(state) === 0 && JSON.stringify(state) === before,
    "World Lock replay stacked strain or rewrote results");
  const restored: WorldState = structuredClone(state);
  const history = workingConnectionsForWrestler(restored, a!).find(e => e.personId === b);
  ok(history?.lastDevelopment?.kind === "STRAIN" && history.lastDevelopment.trustDelta === -0.6,
    "working-connections profile did not explain poor collaboration without personal claims");
  ok(evolveCompletedWorkingPartnerships(restored) === 0,
    "restoring persistent World state repeated relationship penalty");
});

test("No low-execution penalty for unfamiliar partners or for pairs with a strong recent match", () => {
  const { state, ids, promotionId } = world(94126);
  const [a, b] = ids;
  addMatch(state, ids, promotionId, 1, "new-low1", { quality: 25 });
  addMatch(state, ids, promotionId, 2, "new-low2", { quality: 20 });
  addMatch(state, ids, promotionId, 3, "new-low3", { quality: 35 });
  ok(evolveCompletedWorkingPartnerships(state) === 0,
    "three weak shows by a new duo must not invent friction");
  ok(wrestlerRelationshipBetween(state, a!, b!) === null,
    "unestablished colleagues got an invented negative relationship");
  const known = upsertWrestlerRelationship(state, {
    personAId: a!, personBId: b!, familiarity: 44, professionalTrust: 70,
  });
  // Any adequate match in the 12-week observation interval blocks the
  // assumption that the partnership is consistently underperforming.
  addMatch(state, ids, promotionId, 3, "new-strong", { quality: 82 });
  ok(evolveCompletedWorkingPartnerships(state) === 0
    && known.professionalTrust === 70,
    "a proven adequate performance was ignored when determining strain");
});

test("World-wide strain cooldown and confidence floor cannot be evaded through another promotion", () => {
  const { state, ids, promotionId } = world(94127);
  const [a, b] = ids;
  const promotionB = state.promotions.find(p => p.id !== promotionId)!.id;
  const relation = upsertWrestlerRelationship(state, {
    personAId: a!, personBId: b!, familiarity: 70, professionalTrust: 35.2,
  });
  addMatch(state, ids, promotionId, 1, "strain-floor1", { quality: 18 });
  addMatch(state, ids, promotionId, 2, "strain-floor2", { quality: 22 });
  addMatch(state, ids, promotionId, 3, "strain-floor3", { quality: 27 });
  ok(evolveCompletedWorkingPartnerships(state) === 1 && relation.professionalTrust === 35,
    "first strain should stop at the floor with an actual -0.2 applied");
  state.world.currentDate = { year: 1, week: 4, day: 1 };
  addMatch(state, ids, promotionB, 4, "strain-rival-promotion", { quality: 26 });
  ok(evolveCompletedWorkingPartnerships(state) === 0,
    "second promotion bypassed world-wide cooldown or confidence floor");
  const strainEntries = state.ledger.filter(e => e.type === WORKING_PARTNERSHIP_STRAIN_LEDGER_TYPE
    && e.entityIds.includes(a!) && e.entityIds.includes(b!));
  ok(strainEntries.length === 1 && strainEntries[0]!.payload.trustDelta === -0.2,
    "floor cap or cross-promotion provenance was not recorded faithfully");
});


test("Headless World resolution applies the identical authoritative working-pair pass", () => {
  const f = world(94128);
  const { state, ids, promotionId } = f;
  const [a, b] = ids;
  const pair = upsertWrestlerRelationship(state, {
    personAId: a!, personBId: b!, professionalTrust: 56,
    familiarity: 22, affinity: -15, rivalryHeat: 80, tags: ["FORMER_PARTNERS"],
  });
  addMatch(state, ids, promotionId, 2, "canonical-previous", { quality: 82 });
  addMatch(state, ids, promotionId, 3, "canonical-current", { quality: 82 });
  const replay = structuredClone(state);
  let priorDuringHook = 0;
  resolveWorldWeek(state, {
    afterShowFlow: draft => {
      priorDuringHook = wrestlerRelationshipBetween(draft, a!, b!)?.professionalTrust ?? 0;
    },
  });
  ok(priorDuringHook === 56, "interpersonal trust was mutated in a presentation-only hook");
  ok(pair.professionalTrust === 56.8 && pair.familiarity === 24,
    "headless World week omitted the partnership evidence pass");
  const recorded = state.ledger.filter(entry => entry.type === WORKING_PARTNERSHIP_LEDGER_TYPE
    && entry.entityIds.includes(a!) && entry.entityIds.includes(b!));
  ok(recorded.length === 1 && recorded[0]!.payload.sourceMatchId === "canonical-current",
    "canonical World did not record a source-linked shared relationship change");
  resolveWorldWeek(replay);
  ok(deterministicWorldHash(state) === deterministicWorldHash(replay),
    "headless and persisted-hook World resolution diverged in authoritative state");
  ok(pair.affinity === -15 && pair.rivalryHeat === 80
    && JSON.stringify(pair.tags) === JSON.stringify(["FORMER_PARTNERS"]),
    "headless progression reinterpreted a kayfabe rivalry as personal hostility");
});

console.log("\nWorking relationship evolution tests: " + pass + " passed, " + fail + " failed");
if (fail > 0) process.exitCode = 1;
