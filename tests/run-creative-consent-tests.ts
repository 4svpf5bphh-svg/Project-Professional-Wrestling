declare const process: { exitCode?: number };

import { DEFAULT_RULESET } from "../packages/config/src/default-ruleset.js";
import type { Contract, WorldState } from "../packages/domain/src/types.js";
import { createWorld } from "../packages/sim-core/src/index.js";
import {
  creativeBlockersForDraft,
  creativeConcernsForDraft,
  requestCreativeBookingConsent,
} from "../packages/application/src/creative-consent.js";
import {
  createWorldPlanningState,
  normalizeWorldPlanningState,
  removeDetailedShowDraft,
  validateWorldPlanningStateShape,
  type DetailedShowDraft,
  type WorldPlanningState,
} from "../packages/application/src/planning.js";

let passed = 0;
let failed = 0;
function test(name: string, run: () => void): void {
  try { run(); console.log("PASS", name); passed++; }
  catch (error) { console.error("FAIL", name, error); failed++; }
}
function ok(condition: unknown, reason: string): asserts condition {
  if (!condition) throw new Error(reason);
}
function rejects(run: () => void, reason: string): void {
  let threw = false;
  try { run(); } catch { threw = true; }
  ok(threw, reason);
}

function fixture(seed: number): {
  state: WorldState;
  planning: WorldPlanningState;
  draft: DetailedShowDraft;
  loser: Contract;
  winner: Contract;
} {
  const state = createWorld(seed, DEFAULT_RULESET);
  const promotion = state.promotions.find((entry) => (
    entry.lifecycle === "ACTIVE"
    && state.contracts.filter((contract) => contract.promotionId === entry.id && contract.status === "SIGNED").length >= 2
  ));
  ok(promotion, "need a promotion with at least two active wrestlers");
  const contracts = state.contracts
    .filter((entry) => entry.promotionId === promotion.id && entry.status === "SIGNED")
    .sort((a, b) => a.id.localeCompare(b.id));
  const [loser, winner] = contracts;
  ok(loser && winner, "missing opponent contracts");
  const draft: DetailedShowDraft = {
    draftId: "consent-show", promotionId: promotion.id, targetDate: { ...state.world.currentDate },
    marketId: null, venueId: null, ticketStrategy: null,
    participantIds: [loser.personId, winner.personId],
    matches: [{
      draftMatchId: "main-event", type: "SINGLES",
      sideAIds: [loser.personId], sideBIds: [winner.personId],
      intendedWinnerSide: "B", intent: "COMPETITIVE", plannedLengthMinutes: 18,
      plannedFinish: "CLEAN_PIN",
    }],
    championshipAssignments: [],
  };
  const planning = createWorldPlanningState(state.world.id);
  planning.workspaces.push({
    worldId: state.world.id, promotionId: promotion.id, version: 1,
    detailedShowDrafts: [draft],
  });
  return { state, planning, draft, loser, winner };
}

test("legacy contracts have no surprise creative veto", () => {
  const { state, planning, draft, loser } = fixture(90801);
  loser.creativeControl = undefined;
  ok(creativeConcernsForDraft(state, planning, draft).length === 0, "legacy deal raised creative objections");
  ok(creativeBlockersForDraft(state, planning, draft).length === 0, "legacy deal blocked a card");
  const oldPlanning = { worldId: planning.worldId, workspaces: planning.workspaces, showReservations: [] };
  const normalized = normalizeWorldPlanningState(oldPlanning);
  ok(normalized.creativeConsents?.length === 0, "old planning snapshot did not receive empty consent records");
});

test("protected clean and submission losses require consent, protected/flash finishes do not", () => {
  const { state, planning, draft, loser } = fixture(90802);
  loser.creativeControl = "PROTECTED_FINISHES";
  ok(creativeBlockersForDraft(state, planning, draft).length === 1, "clean loser should be protected");
  draft.matches[0]!.plannedFinish = "SUBMISSION";
  ok(creativeBlockersForDraft(state, planning, draft).length === 1, "submission loser should be protected");
  draft.matches[0]!.plannedFinish = "PROTECTED_FINISH";
  ok(creativeBlockersForDraft(state, planning, draft).length === 0, "protected finish should be bookable");
  draft.matches[0]!.plannedFinish = "FLASH_PIN";
  ok(creativeBlockersForDraft(state, planning, draft).length === 0, "flash finish should be bookable");
  draft.matches[0]!.intendedWinnerSide = "A";
  draft.matches[0]!.plannedFinish = "CLEAN_PIN";
  ok(creativeBlockersForDraft(state, planning, draft).length === 0, "the protected wrestler is now winning");
});

test("consultation warns but never vetoes", () => {
  const { state, planning, draft, loser } = fixture(90803);
  loser.creativeControl = "CONSULTATION";
  const concerns = creativeConcernsForDraft(state, planning, draft);
  ok(concerns.length === 1 && concerns[0]!.reason === "CONSULTATION_REQUESTED"
    && !concerns[0]!.requiresConsent, "consultation should be a non-blocking concern");
  ok(creativeBlockersForDraft(state, planning, draft).length === 0, "consultation blocked an authored finish");
  rejects(() => requestCreativeBookingConsent(state, planning, {
    promotionId: draft.promotionId, draftId: draft.draftId,
    draftMatchId: "main-event", personId: loser.personId, expectedPlanVersion: 1,
  }), "consultation should not create a fake mandatory waiver");
});

test("approval survives exact retries but not rewritten finish or altered participants", () => {
  const { state, planning, draft, loser } = fixture(90804);
  loser.creativeControl = "PROTECTED_FINISHES";
  const person = state.people.find((entry) => entry.id === loser.personId)!;
  person.morale = 100; person.fatigue = 0;
  person.priorities.loyalty = 100; person.priorities.role = 0;
  const req = {
    promotionId: draft.promotionId, draftId: draft.draftId,
    draftMatchId: "main-event", personId: loser.personId, expectedPlanVersion: 1,
  };
  const winnerBefore = draft.matches[0]!.intendedWinnerSide;
  const finishBefore = draft.matches[0]!.plannedFinish;
  const first = requestCreativeBookingConsent(state, planning, req);
  ok(first.decision === "APPROVED", "favourable booking context should win agreement");
  ok(planning.creativeConsents?.length === 1, "consent did not persist in planning aggregate");
  const second = requestCreativeBookingConsent(state, planning, req);
  ok(JSON.stringify(first) === JSON.stringify(second) && planning.creativeConsents?.length === 1,
    "same request should be stable and not generate more approvals");
  ok(creativeBlockersForDraft(state, planning, draft).length === 0, "approved original script remained blocked");
  ok(draft.matches[0]!.intendedWinnerSide === winnerBefore && draft.matches[0]!.plannedFinish === finishBefore,
    "request mutated a wrestler's scripted loss or finish");

  draft.matches[0]!.plannedFinish = "SUBMISSION";
  ok(creativeBlockersForDraft(state, planning, draft).length === 1,
    "approval from clean pin silently applied to a submission");
  planning.workspaces[0]!.version = 2;
  rejects(() => requestCreativeBookingConsent(state, planning, req), "stale plan version was accepted");
  const amended = requestCreativeBookingConsent(state, planning, { ...req, expectedPlanVersion: 2 });
  ok(amended.bookingSignature !== first.bookingSignature, "changed finish reused the original signature");
  draft.matches[0]!.sideBIds = [loser.personId];
  ok(creativeBlockersForDraft(state, planning, draft).length === 1,
    "approval was reused after swapping the opposing match participant");
});

test("low-morale wrestler may refuse; retry cannot reroll, other show cannot reuse waiver", () => {
  const { state, planning, draft, loser } = fixture(90805);
  loser.creativeControl = "PROTECTED_FINISHES";
  const person = state.people.find((entry) => entry.id === loser.personId)!;
  person.morale = 0; person.fatigue = 100;
  person.priorities.role = 100; person.priorities.loyalty = 0;
  loser.roleExpectation = "MAIN_EVENT";
  const req = {
    promotionId: draft.promotionId, draftId: draft.draftId,
    draftMatchId: "main-event", personId: loser.personId, expectedPlanVersion: 1,
  };
  const declined = requestCreativeBookingConsent(state, planning, req);
  ok(declined.decision === "DECLINED" && creativeBlockersForDraft(state, planning, draft).length === 1,
    "a refusal did not remain a blocker");
  person.morale = 100;
  ok(requestCreativeBookingConsent(state, planning, req).decision === "DECLINED",
    "retry after state change rerolled the same booking's decision");
  draft.draftId = "another-show";
  planning.workspaces[0]!.detailedShowDrafts[0] = draft;
  ok(creativeBlockersForDraft(state, planning, draft).length === 1,
    "creative approval leaked to another show");
});

test("full approval covers winning assignments and deleting a draft revokes its approvals", () => {
  const { state, planning, draft, winner } = fixture(90806);
  winner.creativeControl = "FULL_APPROVAL";
  ok(creativeBlockersForDraft(state, planning, draft).length === 1,
    "full approval must cover the wrestler even when booked to win");
  const result = requestCreativeBookingConsent(state, planning, {
    promotionId: draft.promotionId, draftId: draft.draftId,
    draftMatchId: "main-event", personId: winner.personId, expectedPlanVersion: 1,
  });
  ok(result.contractId === winner.id, "wrong contract supplied full approval");
  validateWorldPlanningStateShape(state, planning);
  removeDetailedShowDraft(planning, draft.promotionId, 1, draft.draftId);
  ok(planning.creativeConsents?.length === 0, "deleted draft left a live waiver behind");
});

test("request rejects cross-promotion and invalid plan-version attempts without mutation", () => {
  const { state, planning, draft, loser } = fixture(90807);
  loser.creativeControl = "PROTECTED_FINISHES";
  rejects(() => requestCreativeBookingConsent(state, planning, {
    promotionId: "not-your-promotion", draftId: draft.draftId,
    draftMatchId: "main-event", personId: loser.personId, expectedPlanVersion: 1,
  }), "consent can be requested against another promotion");
  rejects(() => requestCreativeBookingConsent(state, planning, {
    promotionId: draft.promotionId, draftId: draft.draftId,
    draftMatchId: "main-event", personId: loser.personId, expectedPlanVersion: -1,
  }), "negative expected version was accepted");
  ok((planning.creativeConsents ?? []).length === 0, "rejected consent mutated state");
});

console.log(`Creative consent checks: ${passed} passed, ${failed} failed`);
if (failed) process.exitCode = 1;
