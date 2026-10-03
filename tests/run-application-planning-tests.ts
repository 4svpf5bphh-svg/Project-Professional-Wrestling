declare const process: { exitCode?: number };

import {
  claimIndependentPromotionCommand,
  createWorldCommandState,
  createWorldOwnershipState,
  createWorldPlanningState,
  createWorldRuntimeState,
  joinPlayerToWorld,
  promotionPlanningWorkspace,
  removeDetailedShowDraftCommand,
  upsertDetailedShowDraftCommand,
  type DetailedShowDraft,
} from "../packages/application/src/index.js";
import { DEFAULT_RULESET } from "../packages/config/src/default-ruleset.js";
import { createWorld } from "../packages/sim-core/src/index.js";

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

function addWeeks(date: { year: number; week: number; day: number }, weeks: number) {
  const absolute = ((date.year - 1) * DEFAULT_RULESET.weeksPerYear) + (date.week - 1) + weeks;
  return {
    year: Math.floor(absolute / DEFAULT_RULESET.weeksPerYear) + 1,
    week: (absolute % DEFAULT_RULESET.weeksPerYear) + 1,
    day: date.day,
  };
}

function fixture(seed: number) {
  const state = createWorld(seed, DEFAULT_RULESET);
  const ownership = createWorldOwnershipState(state.world.id, 2);
  const commands = createWorldCommandState(state.world.id);
  const runtime = createWorldRuntimeState(state.world.id);
  const planning = createWorldPlanningState(state.world.id);
  joinPlayerToWorld(ownership, "player-a", state.world.currentDate);
  joinPlayerToWorld(ownership, "player-b", state.world.currentDate);
  const promotion = state.promotions.find(
    (candidate) => candidate.tier === "INDEPENDENT" && candidate.lifecycle === "ACTIVE",
  )!;
  claimIndependentPromotionCommand(state, ownership, commands, runtime, {
    requestId: `claim-${seed}`,
    worldId: state.world.id,
    playerId: "player-a",
    commandType: "CLAIM_INDEPENDENT_PROMOTION",
    payload: { promotionId: promotion.id },
  });
  return { state, ownership, commands, runtime, planning, promotion };
}

function emptyDraft(f: ReturnType<typeof fixture>, draftId = "show-1"): DetailedShowDraft {
  return {
    draftId,
    promotionId: f.promotion.id,
    targetDate: { ...f.state.world.currentDate },
    marketId: null,
    venueId: null,
    ticketStrategy: null,
    participantIds: [],
    matches: [],
    championshipAssignments: [],
  };
}

function upsert(f: ReturnType<typeof fixture>, requestId: string, expectedPlanVersion: number, draft: DetailedShowDraft) {
  return upsertDetailedShowDraftCommand(f.state, f.ownership, f.planning, f.commands, f.runtime, {
    requestId,
    worldId: f.state.world.id,
    playerId: "player-a",
    commandType: "UPSERT_DETAILED_SHOW_DRAFT",
    payload: {
      promotionId: f.promotion.id,
      expectedPlanVersion,
      draft,
    },
  });
}

test("an incomplete future show can be saved as draft intent without mutating simulation state", () => {
  const f = fixture(15001);
  const eventsBefore = f.state.events.length;
  const matchesBefore = f.state.matches.length;
  const appearancesBefore = f.state.scheduledAppearances.length;
  const workspace = upsert(f, "draft-create", 0, emptyDraft(f));

  ok(workspace.version === 1, "new planning workspace did not advance to version one");
  ok(workspace.detailedShowDrafts.length === 1, "draft was not stored");
  ok(f.state.events.length === eventsBefore, "draft unexpectedly created a simulation event");
  ok(f.state.matches.length === matchesBefore, "draft unexpectedly created a simulation match");
  ok(f.state.scheduledAppearances.length === appearancesBefore, "draft unexpectedly reserved an appearance");
});

test("a draft can be edited in place with optimistic plan versioning", () => {
  const f = fixture(15002);
  upsert(f, "draft-create", 0, emptyDraft(f));
  const market = f.state.markets[0]!;
  const edited = { ...emptyDraft(f), marketId: market.id, ticketStrategy: "STANDARD" as const };
  const workspace = upsert(f, "draft-edit", 1, edited);

  ok(workspace.version === 2, "editing draft did not advance plan version");
  ok(workspace.detailedShowDrafts.length === 1, "editing draft duplicated it");
  ok(workspace.detailedShowDrafts[0]?.marketId === market.id, "edited market was not stored");
  ok(f.runtime.revision === 3, "claim plus two planning commits should produce revision three");
});

test("a stale plan edit is rejected without changing revision or planning state", () => {
  const f = fixture(15003);
  upsert(f, "draft-create", 0, emptyDraft(f));
  const revisionBefore = f.runtime.revision;
  const receiptsBefore = f.commands.receipts.length;
  let rejected = false;
  try {
    upsert(f, "draft-stale", 0, { ...emptyDraft(f), ticketStrategy: "PREMIUM" });
  } catch (error) {
    rejected = String(error).includes("stale plan version");
  }
  ok(rejected, "stale planning edit was not rejected");
  ok(f.runtime.revision === revisionBefore, "stale planning edit advanced World revision");
  ok(f.commands.receipts.length === receiptsBefore, "stale planning edit created a command receipt");
  ok(promotionPlanningWorkspace(f.planning, f.promotion.id)?.version === 1, "stale planning edit mutated workspace version");
});

test("retrying the same planning command is idempotent", () => {
  const f = fixture(15004);
  const draft = emptyDraft(f);
  const first = upsert(f, "draft-retry", 0, draft);
  const revisionAfterFirst = f.runtime.revision;
  const receiptCount = f.commands.receipts.length;
  const second = upsert(f, "draft-retry", 0, draft);

  ok(first.version === second.version, "idempotent planning retry returned a different workspace version");
  ok(f.runtime.revision === revisionAfterFirst, "idempotent planning retry advanced World revision");
  ok(f.commands.receipts.length === receiptCount, "idempotent planning retry duplicated its receipt");
  ok(promotionPlanningWorkspace(f.planning, f.promotion.id)?.version === 1, "idempotent planning retry edited the workspace twice");
});

test("planning edits are authorized by promotion ownership", () => {
  const f = fixture(15005);
  let rejected = false;
  try {
    upsertDetailedShowDraftCommand(f.state, f.ownership, f.planning, f.commands, f.runtime, {
      requestId: "foreign-plan",
      worldId: f.state.world.id,
      playerId: "player-b",
      commandType: "UPSERT_DETAILED_SHOW_DRAFT",
      payload: { promotionId: f.promotion.id, expectedPlanVersion: 0, draft: emptyDraft(f) },
    });
  } catch {
    rejected = true;
  }
  ok(rejected, "non-owner edited another promotion planning workspace");
  ok(f.planning.workspaces.length === 0, "rejected foreign planning edit created a workspace");
});

test("detailed show drafts are limited to the six-week detailed planning horizon", () => {
  const f = fixture(15006);
  const tooFar = { ...emptyDraft(f), targetDate: addWeeks(f.state.world.currentDate, 6) };
  let rejected = false;
  try {
    upsert(f, "too-far", 0, tooFar);
  } catch {
    rejected = true;
  }
  ok(rejected, "draft beyond detailed planning horizon was accepted");
  ok(f.planning.workspaces.length === 0, "rejected horizon draft created planning state");
});

test("draft match IDs are stable planning identifiers and do not allocate simulation match IDs", () => {
  const f = fixture(15007);
  const people = f.state.people.filter((person) => person.status !== "RETIRED").slice(0, 2);
  const simulationMatchesBefore = f.state.matches.length;
  const draft: DetailedShowDraft = {
    ...emptyDraft(f),
    participantIds: people.map((person) => person.id),
    matches: [{
      draftMatchId: "main-event",
      type: "SINGLES",
      sideAIds: [people[0]!.id],
      sideBIds: [people[1]!.id],
      intendedWinnerSide: "A",
      intent: "COMPETITIVE",
      plannedLengthMinutes: 18,
    }],
  };
  const workspace = upsert(f, "draft-card", 0, draft);
  ok(workspace.detailedShowDrafts[0]?.matches[0]?.draftMatchId === "main-event", "draft match identifier was rewritten");
  ok(f.state.matches.length === simulationMatchesBefore, "draft match allocated a real simulation match");
});

test("removing a draft advances only the planning/application state", () => {
  const f = fixture(15008);
  upsert(f, "draft-create", 0, emptyDraft(f));
  const eventsBefore = f.state.events.length;
  const result = removeDetailedShowDraftCommand(f.state, f.ownership, f.planning, f.commands, f.runtime, {
    requestId: "draft-remove",
    worldId: f.state.world.id,
    playerId: "player-a",
    commandType: "REMOVE_DETAILED_SHOW_DRAFT",
    payload: { promotionId: f.promotion.id, expectedPlanVersion: 1, draftId: "show-1" },
  });
  ok(result.version === 2, "draft removal did not advance plan version");
  ok(result.detailedShowDrafts.length === 0, "draft removal left the draft behind");
  ok(f.state.events.length === eventsBefore, "draft removal mutated simulation events");
});

console.log(`\nApplication planning tests: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exitCode = 1;
