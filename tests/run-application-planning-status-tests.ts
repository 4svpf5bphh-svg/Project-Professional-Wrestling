declare const process: { exitCode?: number };

import {
  claimIndependentPromotionCommand,
  closeCurrentWeekReservationsAtLock,
  createWorldCommandState,
  createWorldOwnershipState,
  createWorldPlanningState,
  createWorldRuntimeState,
  joinPlayerToWorld,
  lockWorldForResolution,
  materializeCurrentWeekReservations,
  playerShowPlanningStatus,
  removeDetailedShowDraftCommand,
  reserveDetailedShowDraftCommand,
  upsertDetailedShowDraftCommand,
  type DetailedShowDraft,
} from "../packages/application/src/index.js";
import { DEFAULT_RULESET } from "../packages/config/src/default-ruleset.js";
import { comparePpwDates } from "../packages/sim-core/src/clock.js";
import { createWorld } from "../packages/sim-core/src/index.js";

let passed = 0;
let failed = 0;

function ok(value: unknown, message: string): void {
  if (!value) throw new Error(message);
}

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

function throws(fn: () => void, messageFragment: string): void {
  let message = "";
  try {
    fn();
  } catch (error) {
    message = error instanceof Error ? error.message : String(error);
  }
  ok(message.includes(messageFragment), `expected error containing '${messageFragment}', received '${message}'`);
}

function fixture(seed: number) {
  const state = createWorld(seed, DEFAULT_RULESET);
  const ownership = createWorldOwnershipState(state.world.id, 1);
  const commands = createWorldCommandState(state.world.id);
  const runtime = createWorldRuntimeState(state.world.id);
  const planning = createWorldPlanningState(state.world.id);
  const playerId = "player-a";
  joinPlayerToWorld(ownership, playerId, state.world.currentDate);
  const promotion = state.promotions.find(
    (candidate) => candidate.tier === "INDEPENDENT" && candidate.lifecycle === "ACTIVE",
  )!;
  claimIndependentPromotionCommand(state, ownership, commands, runtime, {
    requestId: `claim-${seed}`,
    worldId: state.world.id,
    playerId,
    commandType: "CLAIM_INDEPENDENT_PROMOTION",
    payload: { promotionId: promotion.id },
  });
  return { state, ownership, commands, runtime, planning, promotionId: promotion.id, playerId };
}

function contractCovers(f: ReturnType<typeof fixture>, contract: (typeof f.state.contracts)[number]): boolean {
  const date = f.state.world.currentDate;
  return contract.status === "SIGNED"
    && comparePpwDates(date, contract.startDate, f.state.ruleset.weeksPerYear) >= 0
    && comparePpwDates(date, contract.endDate, f.state.ruleset.weeksPerYear) <= 0
    && contract.datesUsed < contract.dateEntitlement;
}

function reservableRoster(f: ReturnType<typeof fixture>): string[] {
  const required = f.state.ruleset.minEventParticipants % 2 === 0
    ? f.state.ruleset.minEventParticipants
    : f.state.ruleset.minEventParticipants + 1;
  const ids: string[] = [];
  for (const contract of f.state.contracts) {
    if (contract.promotionId !== f.promotionId || !contractCovers(f, contract)) continue;
    const person = f.state.people.find((candidate) => candidate.id === contract.personId);
    if (!person || person.status !== "ACTIVE" || ids.includes(person.id)) continue;
    ids.push(person.id);
    if (ids.length >= required) break;
  }
  if (ids.length < required) throw new Error("fixture lacks reservable human roster");
  return ids;
}

function baseDraft(f: ReturnType<typeof fixture>, draftId = "status-show"): DetailedShowDraft {
  const promotion = f.state.promotions.find((candidate) => candidate.id === f.promotionId)!;
  const market = f.state.markets.find((candidate) => candidate.id === promotion.homeMarketId)!;
  const venue = f.state.venues.find((candidate) => candidate.marketId === market.id)!;
  return {
    draftId,
    promotionId: f.promotionId,
    targetDate: { ...f.state.world.currentDate, day: 5 },
    marketId: market.id,
    venueId: venue.id,
    ticketStrategy: "STANDARD",
    participantIds: reservableRoster(f),
    matches: [],
    championshipAssignments: [],
  };
}

function completeSinglesCard(draft: DetailedShowDraft): DetailedShowDraft {
  return {
    ...draft,
    matches: Array.from({ length: draft.participantIds.length / 2 }, (_, matchIndex) => {
      const index = matchIndex * 2;
      return {
        draftMatchId: `status-match-${matchIndex + 1}`,
        type: "SINGLES" as const,
        sideAIds: [draft.participantIds[index]!],
        sideBIds: [draft.participantIds[index + 1]!],
        intendedWinnerSide: "A" as const,
        intent: "COMPETITIVE" as const,
        plannedLengthMinutes: 12,
      };
    }),
  };
}

function saveDraft(f: ReturnType<typeof fixture>, draft: DetailedShowDraft, expectedPlanVersion = 0, suffix = "save") {
  return upsertDetailedShowDraftCommand(f.state, f.ownership, f.planning, f.commands, f.runtime, {
    requestId: `${suffix}-${draft.draftId}-${expectedPlanVersion}`,
    worldId: f.state.world.id,
    playerId: f.playerId,
    commandType: "UPSERT_DETAILED_SHOW_DRAFT",
    payload: { promotionId: f.promotionId, expectedPlanVersion, draft },
  });
}

function reserveDraft(f: ReturnType<typeof fixture>, draftId: string, expectedPlanVersion = 1, suffix = "reserve") {
  return reserveDetailedShowDraftCommand(f.state, f.ownership, f.planning, f.commands, f.runtime, {
    requestId: `${suffix}-${draftId}-${expectedPlanVersion}`,
    worldId: f.state.world.id,
    playerId: f.playerId,
    commandType: "RESERVE_DETAILED_SHOW_DRAFT",
    payload: { promotionId: f.promotionId, expectedPlanVersion, draftId },
  });
}

test("draft status exposes only pre-commit planning actions", () => {
  const f = fixture(17101);
  const draft = baseDraft(f);
  saveDraft(f, draft);
  const status = playerShowPlanningStatus(f.state, f.planning, f.runtime, f.promotionId, draft.draftId);
  ok(status.state === "DRAFT", "unreserved plan did not expose DRAFT status");
  ok(status.availableActions.join(",") === "EDIT_DRAFT,DELETE_DRAFT,RESERVE", "draft actions are incorrect");
  ok(status.readiness === "SHOW_REQUIRED", "current-week draft should still require a committed show");
});

test("reserved status permits edits but requires explicit refresh for changed intent", () => {
  const f = fixture(17102);
  const draft = baseDraft(f);
  saveDraft(f, draft);
  reserveDraft(f, draft.draftId);
  const reserved = playerShowPlanningStatus(f.state, f.planning, f.runtime, f.promotionId, draft.draftId);
  ok(reserved.state === "RESERVED", "reservation did not expose RESERVED status");
  ok(reserved.availableActions.includes("REFRESH_RESERVATION"), "reserved plan cannot refresh its commitment");
  ok(!reserved.availableActions.includes("DELETE_DRAFT"), "reserved plan incorrectly permits direct deletion");

  saveDraft(f, { ...draft, ticketStrategy: "PREMIUM" }, 1, "edit");
  const edited = playerShowPlanningStatus(f.state, f.planning, f.runtime, f.promotionId, draft.draftId);
  ok(edited.workspaceChangedSinceReservation, "editing reserved intent did not expose refresh requirement");
  ok(edited.state === "RESERVED", "editing intent silently changed reservation state");
});

test("reserved draft cannot be deleted before its scarce-resource commitment is released", () => {
  const f = fixture(17103);
  const draft = baseDraft(f);
  saveDraft(f, draft);
  reserveDraft(f, draft.draftId);
  throws(() => removeDetailedShowDraftCommand(f.state, f.ownership, f.planning, f.commands, f.runtime, {
    requestId: "delete-reserved",
    worldId: f.state.world.id,
    playerId: f.playerId,
    commandType: "REMOVE_DETAILED_SHOW_DRAFT",
    payload: { promotionId: f.promotionId, expectedPlanVersion: 1, draftId: draft.draftId },
  }), "DELETE_DRAFT is not allowed");
  ok(f.planning.showReservations.length === 1, "failed delete orphaned or removed the reservation");
  ok(f.planning.workspaces[0]!.detailedShowDrafts.length === 1, "failed delete removed the source draft");
});

test("due broken reservation exposes AT_RISK and repair actions", () => {
  const f = fixture(17104);
  const draft = baseDraft(f);
  saveDraft(f, draft);
  reserveDraft(f, draft.draftId);
  const person = f.state.people.find((candidate) => candidate.id === draft.participantIds[0])!;
  person.status = "INJURED";
  const status = playerShowPlanningStatus(f.state, f.planning, f.runtime, f.promotionId, draft.draftId);
  ok(status.state === "AT_RISK", "broken due reservation did not expose AT_RISK status");
  ok(status.riskReasons.includes("WRESTLER_UNAVAILABLE"), "At Risk status omitted wrestler availability reason");
  ok(status.availableActions.includes("EDIT_DRAFT") && status.availableActions.includes("REFRESH_RESERVATION"), "At Risk plan lacks repair actions");
  ok(status.availableActions.includes("RELEASE_RESERVATION"), "At Risk plan cannot release the commitment");
});

test("materialized incomplete show leaves advance planning and exposes current card responsibility", () => {
  const f = fixture(17105);
  const draft = baseDraft(f);
  saveDraft(f, draft);
  reserveDraft(f, draft.draftId);
  materializeCurrentWeekReservations(f.state, f.planning);
  const status = playerShowPlanningStatus(f.state, f.planning, f.runtime, f.promotionId, draft.draftId);
  ok(status.state === "MATERIALIZED", "materialized incomplete show did not expose MATERIALIZED status");
  ok(status.readiness === "CARD_REQUIRED", "materialized incomplete show did not expose card responsibility");
  ok(status.availableActions.length === 0, "materialized show still exposes advance-planning mutations");
  throws(() => saveDraft(f, { ...draft, ticketStrategy: "PREMIUM" }, 1, "late-edit"), "EDIT_DRAFT is not allowed");
});

test("complete materialized card exposes READY_TO_LOCK", () => {
  const f = fixture(17106);
  const draft = completeSinglesCard(baseDraft(f));
  saveDraft(f, draft);
  reserveDraft(f, draft.draftId);
  materializeCurrentWeekReservations(f.state, f.planning);
  const status = playerShowPlanningStatus(f.state, f.planning, f.runtime, f.promotionId, draft.draftId);
  ok(status.state === "READY_TO_LOCK", "complete materialized show did not expose READY_TO_LOCK");
  ok(status.readiness === "READY_TO_LOCK", "complete materialized show readiness disagrees with state");
  ok(status.availableActions.length === 0, "ready show exposes irrelevant advance-planning actions");
});

test("unresolved due commitment becomes STAFF_OWNED once the World locks", () => {
  const f = fixture(17107);
  const draft = baseDraft(f);
  saveDraft(f, draft);
  reserveDraft(f, draft.draftId);
  const person = f.state.people.find((candidate) => candidate.id === draft.participantIds[0])!;
  person.status = "INJURED";
  const closure = closeCurrentWeekReservationsAtLock(f.state, f.planning);
  ok(closure.releasedAtRisk.length === 1, "At Risk reservation was not released at lock boundary");
  lockWorldForResolution(f.runtime, f.state);
  const status = playerShowPlanningStatus(f.state, f.planning, f.runtime, f.promotionId, draft.draftId);
  ok(status.state === "STAFF_OWNED", "locked unresolved plan did not expose STAFF_OWNED status");
  ok(status.readiness === "STAFF_OWNED", "staff ownership readiness is inconsistent");
  ok(status.availableActions.length === 0, "staff-owned plan still exposes player mutations");
});

console.log(`\nApplication planning status tests: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exitCode = 1;
