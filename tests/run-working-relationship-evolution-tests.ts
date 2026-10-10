declare const process: { exitCode?: number };
import { DEFAULT_RULESET } from "../packages/config/src/default-ruleset.js";
import type { Match, MatchParticipant, PpwDate, WorldState } from "../packages/domain/src/types.js";
import { createWorld, upsertWrestlerRelationship, wrestlerRelationshipBetween } from "../packages/sim-core/src/index.js";
import { evolveCompletedWorkingPartnerships, WORKING_PARTNERSHIP_LEDGER_TYPE } from "../packages/application/src/working-relationship-evolution.js";
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
  ok(evolveCompletedWorkingPartnerships(state) === 1, "two verified tag shows should qualify exactly once");
  ok(base.professionalTrust === 55.8 && base.familiarity === 22,
    "bounded professional trust or familiarity growth incorrect");
  ok(base.affinity === -35 && base.rivalryHeat === 92
    && JSON.stringify(base.tags) === JSON.stringify(["FORMER_PARTNERS"]),
    "scripted feud/background tags or personal affinity were rewritten");
  const entry = state.ledger.filter(item => item.type === WORKING_PARTNERSHIP_LEDGER_TYPE);
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
  ok(evolveCompletedWorkingPartnerships(state) === 1, "initial progress not applied");
  ok(record.professionalTrust === 75 && record.familiarity === 98,
    "trust must saturate at 75 and preserve the difference from chemistry");
  state.world.currentDate = { year: 1, week: 4, day: 1 };
  addMatch(state, ids, otherPromotionId, 4, "elsewhere");
  ok(evolveCompletedWorkingPartnerships(state) === 0,
    "other promotion circumvented the global eight-week cooldown");
  state.world.currentDate = { year: 1, week: 11, day: 1 };
  addMatch(state, ids, promotionId, 11, "p11");
  ok(evolveCompletedWorkingPartnerships(state) === 1,
    "genuine later collaboration should be eligible after eight weeks");
  ok(record.professionalTrust === 75 && record.familiarity === 100,
    "high trust must not drop to the soft ceiling and familiarity should saturate");
  state.world.currentDate = { year: 1, week: 19, day: 1 };
  addMatch(state, ids, promotionId, 19, "p19");
  ok(evolveCompletedWorkingPartnerships(state) === 0,
    "fully saturated pair must not produce gratuitous growth events");
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
  ok(evolveCompletedWorkingPartnerships(state) === 1, "new pair was not created");
  const relation = wrestlerRelationshipBetween(state, a!, b!);
  if (!relation) throw new Error("new pair missing after World development");
  ok(relation.professionalTrust === 50.8 && relation.familiarity === 2,
    "new pair must begin neutral and earn only a tiny working relationship increment");
  ok(relation.tags.length === 0 && relation.affinity === 0 && relation.rivalryHeat === 0,
    "completed tag matches falsely created a friendship, alliance or feud");
});

console.log("\nWorking relationship evolution tests: " + pass + " passed, " + fail + " failed");
if (fail > 0) process.exitCode = 1;
