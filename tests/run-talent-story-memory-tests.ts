declare const process: { exitCode?: number };

import { createWorldPlanningState, upsertDetailedShowDraft } from "../packages/application/src/planning.js";
import { recordResolvedShowSegments } from "../packages/application/src/programme-segments.js";
import { talentStoryMemoriesForPerson } from "../packages/application/src/talent-story-memories.js";
import { DEFAULT_RULESET } from "../packages/config/src/default-ruleset.js";
import type { WrestlingEvent } from "../packages/domain/src/types.js";
import { activeContractsForPromotion, createWorld } from "../packages/sim-core/src/index.js";

let passed = 0;
let failed = 0;
function test(name: string, fn: () => void): void {
  try {
    fn();
    console.log("PASS " + name);
    passed += 1;
  } catch (error) {
    console.error("FAIL " + name + ": " + (error instanceof Error ? error.message : String(error)));
    failed += 1;
  }
}
function ok(value: unknown, message: string): void {
  if (!value) throw new Error(message);
}

test("Talent story memory is created only from completed, resolved angles and preserves stable identity", () => {
  const state = createWorld(9198, DEFAULT_RULESET);
  const promotion = state.promotions.find((candidate) => candidate.tier === "INDEPENDENT" && candidate.lifecycle === "ACTIVE");
  if (!promotion) throw new Error("fixture needs an active independent promotion");
  const roster = [...new Set(activeContractsForPromotion(state, promotion.id).map((contract) => contract.personId))];
  ok(roster.length >= 4, "fixture needs a four-person roster");
  const [rep, departing, third, outsider] = roster;
  const stableId = "memory-stable";
  const date = { ...state.world.currentDate, day: 6 };
  state.stables = [{
    id: stableId, worldId: state.world.id, promotionId: promotion.id,
    name: "The Original Faction", status: "ACTIVE",
    formedDate: { ...state.world.currentDate }, disbandedDate: null,
  }];
  state.stableMemberships = [rep!, departing!, third!].map((personId, index) => ({
    id: "memory-membership-" + index, worldId: state.world.id, stableId,
    personId, joinedDate: { ...state.world.currentDate },
    leftDate: null, active: true,
  }));
  const planning = createWorldPlanningState(state.world.id);
  upsertDetailedShowDraft(state, planning, promotion.id, 0, {
    draftId: "story-memory-draft", promotionId: promotion.id,
    targetDate: date, marketId: null, venueId: null, ticketStrategy: null,
    participantIds: roster.slice(0, 4), matches: [], championshipAssignments: [],
    segments: [{
      draftSegmentId: "story-memory-exit", type: "STABLE_EXIT",
      participantIds: [departing!, rep!], programmeId: null, plannedLengthMinutes: 5,
      initiatorPersonId: rep, targetPersonId: departing,
      stableId, stableExitOutcome: "WALKED_OUT",
    }],
  });

  ok(talentStoryMemoriesForPerson(state, rep!).length === 0,
    "a merely drafted angle became a factual wrestler memory");

  const market = state.markets.find((candidate) => candidate.id === promotion.homeMarketId) ?? state.markets[0]!;
  const venue = state.venues.find((candidate) => candidate.marketId === market.id) ?? state.venues[0]!;
  const event: WrestlingEvent = {
    id: "story-memory-event", worldId: state.world.id, promotionId: promotion.id,
    marketId: market.id, venueId: venue.id, date, type: "REGULAR",
    status: "COMPLETED", ticketStrategy: "STANDARD", expectedDemand: 100,
    attendance: 100, ticketYield: 25, gateRevenue: 2500,
    totalCost: 2000, netResult: 500, eventImportance: 60, matchCount: 0,
    averageMatchRating: 0, bestMatchRating: 0, crowdResponse: 65,
  };
  state.events.push(event);
  const membershipBefore = JSON.stringify(state.stableMemberships);
  ok(recordResolvedShowSegments(state, planning) === 1, "completed stable exit was not recorded");

  const repMemory = talentStoryMemoriesForPerson(state, rep!);
  const departedMemory = talentStoryMemoriesForPerson(state, departing!);
  ok(repMemory.length === 1 && departedMemory.length === 1, "each participant must remember the angle once");
  ok(repMemory[0]!.role === "STABLE_REPRESENTATIVE" && departedMemory[0]!.role === "DEPARTING_MEMBER",
    "wrestler story roles were lost");
  ok(repMemory[0]!.counterpartPersonId === departing && departedMemory[0]!.counterpartPersonId === rep,
    "wrestler memories lost the opposing role");
  ok(repMemory[0]!.scriptedOutcome === "WALKED_OUT" && departedMemory[0]!.scriptedOutcome === "WALKED_OUT",
    "memories replaced the booker's scripted outcome");
  ok(repMemory[0]!.stableId === stableId && repMemory[0]!.stableName === "The Original Faction",
    "memories lost stable identity");
  ok(repMemory[0]!.crowdResponse !== null && repMemory[0]!.executionQuality !== null,
    "memory did not preserve simulated execution separately from the scripted beat");
  ok(talentStoryMemoriesForPerson(state, outsider!).length === 0, "outsider inherited another wrestler's memory");
  ok(JSON.stringify(state.stableMemberships) === membershipBefore, "memory creation mutated actual faction membership");
  state.stables[0]!.name = "Renamed Faction";
  ok(talentStoryMemoriesForPerson(state, rep!)[0]!.stableName === "The Original Faction",
    "historical memory incorrectly followed the current stable name");
  ok(recordResolvedShowSegments(state, planning) === 0, "World Lock replay recorded a second memory");
  ok(talentStoryMemoriesForPerson(state, rep!).length === 1, "World Lock retry duplicated talent memories");
});

test("Talent memories are bounded and do not mutate World simulation state", () => {
  const state = createWorld(9199, DEFAULT_RULESET);
  const wrestlerId = state.people[0]!.id;
  const before = JSON.stringify(state);
  ok(talentStoryMemoriesForPerson(state, wrestlerId).length === 0, "fresh world has scripted angle memories");
  ok(JSON.stringify(state) === before, "read-only memory lookup mutated the World");
  let rejected = false;
  try { talentStoryMemoriesForPerson(state, wrestlerId, 0); } catch { rejected = true; }
  ok(rejected, "unbounded/invalid memory limit was accepted");
});

console.log("\nTalent story-memory tests: " + passed + " passed, " + failed + " failed");
if (failed > 0) process.exitCode = 1;
