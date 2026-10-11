declare const process: { exitCode?: number };

import { DEFAULT_RULESET } from "../packages/config/src/default-ruleset.js";
import { createWorld, createProgramme } from "../packages/sim-core/src/index.js";
import type { Contract, WorldState } from "../packages/domain/src/types.js";
import {
  createWorldPlanningState,
  normalizeWorldPlanningState,
  validateWorldPlanningStateShape,
  type DetailedMatchDraft,
  type WorldPlanningState,
} from "../packages/application/src/planning.js";
import {
  requestStandingProgrammeCreativeAgreement,
  standingProgrammeAgreementCoversMatch,
} from "../packages/application/src/programme-creative-standing.js";
import {
  createWorldCommandState,
  requestStandingProgrammeCreativeAgreementCommand,
} from "../packages/application/src/commands.js";
import {
  createWorldOwnershipState, joinPlayerToWorld, claimIndependentPromotionForPlayer,
} from "../packages/application/src/ownership.js";
import { createWorldRuntimeState, lockWorldForResolution } from "../packages/application/src/runtime.js";

let passed = 0;
let failed = 0;
function test(name: string, run: () => void): void {
  try { run(); passed++; console.log("PASS", name); }
  catch (error) { failed++; console.error("FAIL", name, error); }
}
function ok(value: unknown, reason: string): asserts value {
  if (!value) throw new Error(reason);
}
function rejects(fn: () => unknown, reason: string): void {
  let failed = false;
  try { fn(); } catch { failed = true; }
  ok(failed, reason);
}
function fixture(seed: number) {
  const state = createWorld(seed, DEFAULT_RULESET);
  const promotion = state.promotions.find((p) => p.lifecycle === "ACTIVE" && p.tier === "INDEPENDENT"
    && state.contracts.filter((c) => c.promotionId === p.id && c.status === "SIGNED").length >= 2);
  ok(promotion, "fixture needs an independent promotion with two contracted performers");
  const contracts = state.contracts.filter((c) => c.promotionId === promotion.id && c.status === "SIGNED")
    .sort((a, b) => a.id.localeCompare(b.id));
  const lead = contracts[0]!;
  const rival = contracts.find((c) => c.personId !== lead.personId)!;
  lead.creativeControl = "FULL_APPROVAL";
  const person = state.people.find((p) => p.id === lead.personId)!;
  person.morale = 100; person.fatigue = 0; person.priorities.loyalty = 100; person.priorities.role = 0;
  const programme = createProgramme(state, {
    promotionId: promotion.id,
    sideA: [{ kind: "PERSON", entityId: lead.personId }],
    sideB: [{ kind: "PERSON", entityId: rival.personId }],
  });
  const planning = createWorldPlanningState(state.world.id);
  const match: DetailedMatchDraft = {
    draftMatchId: "programme-match", type: "SINGLES",
    sideAIds: [lead.personId], sideBIds: [rival.personId],
    intendedWinnerSide: "A", intent: "COMPETITIVE", plannedLengthMinutes: 16, plannedFinish: "CLEAN_PIN",
  };
  return { state, planning, programme, lead, rival, match, promotion };
}

test("one explicit Programme agreement covers routine assignment and protected losses, not clean losses", () => {
  const f = fixture(91701);
  const terms = {
    promotionId: f.promotion.id, programmeId: f.programme.id, personId: f.lead.personId,
    matchType: "SINGLES" as const, permittedOutcome: "WIN_OR_PROTECTED_LOSS" as const, termWeeks: 3,
  };
  const result = requestStandingProgrammeCreativeAgreement(f.state, f.planning, terms);
  ok(result.approved, "willing full-control wrestler should accept narrow arc");
  const covers = (match: DetailedMatchDraft) => standingProgrammeAgreementCoversMatch(f.state, f.planning, {
    programmeId: f.programme.id, promotionId: f.promotion.id,
    personId: f.lead.personId, targetDate: f.state.world.currentDate, match,
  });
  ok(covers(f.match), "winning match was not covered by a standing agreement");
  ok(covers({ ...f.match, intendedWinnerSide: "B", plannedFinish: "PROTECTED_FINISH" }),
    "agreed protected loss wrongly needed repeat permission");
  ok(!covers({ ...f.match, intendedWinnerSide: "B", plannedFinish: "SUBMISSION" }),
    "standing Programme agreement waived an unapproved submission loss");
  ok(!covers({ ...f.match, intendedWinnerSide: "B", plannedFinish: "CLEAN_PIN" }),
    "standing Programme agreement silently waived a clean pin");
  ok(!covers({ ...f.match, sideBIds: ["outside-opponent"] }),
    "standing agreement allowed an outside Programme opponent");
  ok(!covers({ ...f.match, interfererPersonId: "third-party" }),
    "standing agreement bypassed a third-party angle");
  ok(!covers({ ...f.match, type: "TAG" }),
    "standing agreement applied to a different match type");
  ok(!standingProgrammeAgreementCoversMatch(f.state, f.planning, {
    programmeId: f.programme.id, promotionId: f.promotion.id, personId: f.lead.personId,
    targetDate: { year: 1, week: 5, day: 1 }, match: f.match,
  }), "expired standing agreement kept granting consent");
  ok(standingProgrammeAgreementCoversMatch(f.state, f.planning, {
    programmeId: f.programme.id, promotionId: f.promotion.id, personId: f.lead.personId,
    targetDate: { year: 1, week: 3, day: 7 }, match: f.match,
  }), "third agreed PPW week should include its final Sunday");
  ok(!standingProgrammeAgreementCoversMatch(f.state, f.planning, {
    programmeId: f.programme.id, promotionId: f.promotion.id, personId: f.lead.personId,
    targetDate: { year: 1, week: 4, day: 1 }, match: f.match,
  }), "agreement improperly covers Monday after the third PPW week");
  validateWorldPlanningStateShape(f.state, f.planning);
});

test("one wrestler cannot reroll a refused or accepted Programme offer by altering terms", () => {
  const f = fixture(91702);
  const p = f.state.people.find((x) => x.id === f.lead.personId)!;
  p.morale = 0; p.fatigue = 100; p.priorities.loyalty = 0; p.priorities.role = 100;
  f.lead.roleExpectation = "MAIN_EVENT";
  const terms = {
    promotionId: f.promotion.id, programmeId: f.programme.id, personId: f.lead.personId,
    matchType: "SINGLES" as const, permittedOutcome: "WIN_ONLY" as const, termWeeks: 2,
  };
  const first = requestStandingProgrammeCreativeAgreement(f.state, f.planning, terms);
  ok(!first.approved, "unwilling full-control wrestler accepted too-easily");
  p.morale = 100;
  const same = requestStandingProgrammeCreativeAgreement(f.state, f.planning, terms);
  ok(JSON.stringify(first) === JSON.stringify(same), "same terms were rerolled after morale changed");
  rejects(() => requestStandingProgrammeCreativeAgreement(f.state, f.planning, {
    ...terms, permittedOutcome: "WIN_OR_PROTECTED_LOSS",
  }), "altering outcome scope allowed instant reroll");
  ok(f.planning.standingProgrammeCreativeAgreements?.length === 1,
    "negotiation retry duplicated Programme consent");
});

test("closed Programmes and weaker creative clauses never grant a standing waiver", () => {
  const f = fixture(91703);
  const terms = {
    promotionId: f.promotion.id, programmeId: f.programme.id, personId: f.lead.personId,
    matchType: "SINGLES" as const, permittedOutcome: "WIN_ONLY" as const, termWeeks: 2,
  };
  f.lead.creativeControl = "PROTECTED_FINISHES";
  rejects(() => requestStandingProgrammeCreativeAgreement(f.state, f.planning, terms),
    "protected-finish contract was incorrectly entitled to full match pre-approval");
  f.lead.creativeControl = "FULL_APPROVAL";
  requestStandingProgrammeCreativeAgreement(f.state, f.planning, terms);
  f.programme.status = "ENDED";
  ok(!standingProgrammeAgreementCoversMatch(f.state, f.planning, {
    programmeId: f.programme.id, promotionId: f.promotion.id,
    personId: f.lead.personId, targetDate: f.state.world.currentDate, match: f.match,
  }), "ended Programme kept granting a standing agreement");
  rejects(() => requestStandingProgrammeCreativeAgreement(f.state, f.planning, terms),
    "ended Programme accepted new creative negotiations");
  const legacy = normalizeWorldPlanningState({
    worldId: f.state.world.id, workspaces: [], showReservations: [],
  });
  ok(legacy.standingProgrammeCreativeAgreements?.length === 0,
    "old World snapshot failed to default standing agreements");
});

test("standing creative negotiations are owned, idempotent and blocked by World Lock", () => {
  const f = fixture(91704);
  const ownership = createWorldOwnershipState(f.state.world.id, 2);
  joinPlayerToWorld(ownership, "player-a", f.state.world.currentDate);
  joinPlayerToWorld(ownership, "player-b", f.state.world.currentDate);
  claimIndependentPromotionForPlayer(f.state, ownership, "player-a", f.promotion.id);
  const runtime = createWorldRuntimeState(f.state.world.id);
  const commands = createWorldCommandState(f.state.world.id);
  const payload = {
    promotionId: f.promotion.id, programmeId: f.programme.id, personId: f.lead.personId,
    matchType: "SINGLES" as const, permittedOutcome: "WIN_ONLY" as const, termWeeks: 2,
  };
  const request = {
    requestId: "programme-standing-91704",
    worldId: f.state.world.id, playerId: "player-a",
    commandType: "REQUEST_STANDING_PROGRAMME_CREATIVE_AGREEMENT" as const, payload,
  };
  rejects(() => requestStandingProgrammeCreativeAgreementCommand(f.state, ownership, f.planning, commands, runtime,
    { ...request, requestId: "wrong-player", playerId: "player-b" }),
    "other controller could negotiate a wrestler's Programme consent");
  const first = requestStandingProgrammeCreativeAgreementCommand(
    f.state, ownership, f.planning, commands, runtime, request,
  );
  const retry = requestStandingProgrammeCreativeAgreementCommand(
    f.state, ownership, f.planning, commands, runtime, request,
  );
  ok(JSON.stringify(first) === JSON.stringify(retry) && runtime.revision === 1
    && commands.receipts.length === 1,
    "idempotent Programme negotiation duplicated a World revision");
  lockWorldForResolution(runtime, f.state);
  rejects(() => requestStandingProgrammeCreativeAgreementCommand(f.state, ownership, f.planning, commands, runtime,
    { ...request, requestId: "after-world-lock" }), "creative agreement modified a locked World");
  ok(runtime.revision === 1, "locked or unauthorized consent changed World revision");
});

console.log(`Standing Programme creative tests: ${passed} passed, ${failed} failed`);
if (failed) process.exitCode = 1;
