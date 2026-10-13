declare const process: { exitCode?: number };

import { createWorldPlanningState, upsertDetailedShowDraft } from "../packages/application/src/planning.js";
import { recentCompletedVictoryForCelebration } from "../packages/application/src/celebration-evidence.js";
import { buildPlayerWorldResultsView, createWorldOwnershipState, createWorldCommandState, createWorldRuntimeState, joinPlayerToWorld } from "../packages/application/src/index.js";
import {
  applyResolvedShowTurns,
  recordResolvedProgrammeSegments,
  recordResolvedShowSegments,
  resolvedShowSegmentsForEvent,
} from "../packages/application/src/programme-segments.js";
import { DEFAULT_RULESET } from "../packages/config/src/default-ruleset.js";
import type { WrestlingEvent } from "../packages/domain/src/types.js";
import {
  activeContractsForPromotion,
  createProgramme,
  createWorld,
  evaluateProgrammeSignals,
  programmeActivities,
  setPromotionWrestlerAlignment,
  wrestlerAlignmentForPromotion,
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

function ok(value: unknown, message: string): void {
  if (!value) throw new Error(message);
}

function fixture(seed: number) {
  const state = createWorld(seed, DEFAULT_RULESET);
  const promotion = state.promotions.find((candidate) => candidate.tier === "INDEPENDENT" && candidate.lifecycle === "ACTIVE");
  if (!promotion) throw new Error("Programme segment fixture needs an active Independent promotion");
  const rosterIds = [...new Set(activeContractsForPromotion(state, promotion.id).map((contract) => contract.personId))];
  ok(rosterIds.length >= 4, "Programme segment fixture needs four contracted wrestlers");
  const programme = createProgramme(state, {
    promotionId: promotion.id,
    sideA: [{ kind: "PERSON", entityId: rosterIds[0]! }],
    sideB: [{ kind: "PERSON", entityId: rosterIds[1]! }],
  });
  const planning = createWorldPlanningState(state.world.id);
  const targetDate = { ...state.world.currentDate, day: 6 };
  return { state, promotion, rosterIds, programme, planning, targetDate };
}

function completedEvent(setup: ReturnType<typeof fixture>, status: "SCHEDULED" | "COMPLETED" = "COMPLETED"): WrestlingEvent {
  const market = setup.state.markets.find((candidate) => candidate.id === setup.promotion.homeMarketId) ?? setup.state.markets[0]!;
  const venue = setup.state.venues.find((candidate) => candidate.marketId === market.id) ?? setup.state.venues[0]!;
  return {
    id: `programme-segment-event:${setup.state.world.seed}`,
    worldId: setup.state.world.id,
    promotionId: setup.promotion.id,
    marketId: market.id,
    venueId: venue.id,
    date: setup.targetDate,
    type: "REGULAR",
    status,
    ticketStrategy: "STANDARD",
    expectedDemand: 100,
    attendance: status === "COMPLETED" ? 100 : 0,
    ticketYield: 25,
    gateRevenue: status === "COMPLETED" ? 2500 : 0,
    totalCost: status === "COMPLETED" ? 2000 : 0,
    netResult: status === "COMPLETED" ? 500 : 0,
    eventImportance: 60,
    matchCount: 0,
    averageMatchRating: 0,
    bestMatchRating: 0,
    crowdResponse: status === "COMPLETED" ? 65 : 0,
  };
}

function addSegmentDraft(setup: ReturnType<typeof fixture>, participantIds = [setup.rosterIds[0]!, setup.rosterIds[1]!]): void {
  upsertDetailedShowDraft(setup.state, setup.planning, setup.promotion.id, 0, {
    draftId: "segment-show",
    promotionId: setup.promotion.id,
    targetDate: setup.targetDate,
    marketId: null,
    venueId: null,
    ticketStrategy: null,
    participantIds: setup.rosterIds.slice(0, 4),
    matches: [],
    championshipAssignments: [],
    programmeSegments: [{
      draftSegmentId: "segment-1",
      programmeId: setup.programme.id,
      participantIds,
    }],
  });
}

function throwsContaining(fn: () => void, expected: string): void {
  let message = "";
  try {
    fn();
  } catch (error) {
    message = error instanceof Error ? error.message : String(error);
  }
  ok(message.includes(expected), `expected error containing '${expected}', received '${message || "no error"}'`);
}

test("Programme segments are validated against the show roster and Programme participants", () => {
  const setup = fixture(9141);
  addSegmentDraft(setup);
  const stored = setup.planning.workspaces[0]?.detailedShowDrafts[0]?.programmeSegments?.[0];
  ok(stored?.programmeId === setup.programme.id, "valid Programme segment was not persisted in the draft");

  const invalid = fixture(9142);
  throwsContaining(
    () => addSegmentDraft(invalid, [invalid.rosterIds[0]!, invalid.rosterIds[2]!]),
    "does not belong to Programme",
  );
});

test("pre-recorded Video Package has a real subject but no live reservation, and resolves exactly once", () => {
  const setup = fixture(91501);
  const subject = setup.rosterIds[0]!;
  const draft = {
    draftId: "video-story-fixture",
    promotionId: setup.promotion.id,
    targetDate: setup.targetDate,
    marketId: null,
    venueId: null,
    ticketStrategy: null,
    participantIds: setup.rosterIds.slice(1, 3),
    matches: [],
    championshipAssignments: [],
    segments: [{
      draftSegmentId: "video-one",
      type: "VIDEO_PACKAGE" as const,
      participantIds: [],
      programmeId: setup.programme.id,
      plannedLengthMinutes: 3,
      videoSubjectPersonId: subject,
      videoKind: "DEBUT_TEASER" as const,
      videoObjective: "CREATE_INTRIGUE" as const,
      videoReveal: "CRYPTIC" as const,
    }],
    runningOrder: [{ kind: "SEGMENT" as const, refId: "video-one" }],
  };
  upsertDetailedShowDraft(setup.state, setup.planning, setup.promotion.id, 0, draft);
  const stored = setup.planning.workspaces[0]!.detailedShowDrafts[0]!;
  ok(stored.segments?.[0]?.participantIds.length === 0, "video recruited a live performer");
  ok(!stored.participantIds.includes(subject), "video added subject to the live reservations");
  ok(stored.segments?.[0]?.videoSubjectPersonId === subject, "video subject was not saved");
  setup.state.events.push(completedEvent(setup));
  ok(recordResolvedShowSegments(setup.state, setup.planning) === 1, "video did not create one show-story beat");
  ok(recordResolvedShowSegments(setup.state, setup.planning) === 0, "video duplicated on repeated resolution");
  const resolved = resolvedShowSegmentsForEvent(setup.state, setup.state.events.at(-1)!.id)[0];
  ok(resolved?.type === "VIDEO_PACKAGE", "resolved ledger did not retain Video Package type");
  ok(resolved?.videoKind === "DEBUT_TEASER" && resolved.videoReveal === "CRYPTIC",
    "video lost authored teaser and reveal detail");
  ok(resolved?.videoSubjectPersonId === subject && resolved.participantIds.length === 0,
    "video mutated subject into a real show participant");
  ok(resolved?.crowdResponse !== null && resolved?.outcomeBand !== null,
    "video audience reaction was not determined");
  const ownership = createWorldOwnershipState(setup.state.world.id, 1);
  joinPlayerToWorld(ownership, "video-observer", setup.state.world.currentDate);
  const result = buildPlayerWorldResultsView({
    state: setup.state,
    planning: setup.planning,
    ownership,
    commands: createWorldCommandState(setup.state.world.id),
    runtime: createWorldRuntimeState(setup.state.world.id),
  }, "video-observer");
  const publicVideo = result.shows.find((show) => show.eventId === setup.state.events.at(-1)!.id)?.segments[0];
  ok(publicVideo?.videoReveal === "CRYPTIC" && publicVideo.videoKind === "DEBUT_TEASER",
    "World show history failed to report the cryptic teaser");
  ok(publicVideo?.videoSubjectName === null && publicVideo.participants.length === 0,
    "cryptic public video exposed its hidden subject or invented an in-person appearance");
});

test("a signed-now wrestler cannot be promoted with a package after their contract ends", () => {
  const setup = fixture(91503);
  const subject = setup.rosterIds[0]!;
  const contract = activeContractsForPromotion(setup.state, setup.promotion.id)
    .find((entry) => entry.personId === subject);
  if (!contract) throw new Error("video fixture needs a signed contract");
  contract.endDate = { year: setup.state.world.currentDate.year, week: setup.state.world.currentDate.week, day: 1 };
  const futureDate = { year: setup.state.world.currentDate.year, week: setup.state.world.currentDate.week + 1, day: 6 };
  throwsContaining(() => upsertDetailedShowDraft(setup.state, setup.planning, setup.promotion.id, 0, {
    draftId: "video-after-contract",
    promotionId: setup.promotion.id,
    targetDate: futureDate,
    marketId: null,
    venueId: null,
    ticketStrategy: null,
    participantIds: setup.rosterIds.slice(1, 3),
    matches: [],
    championshipAssignments: [],
    segments: [{
      draftSegmentId: "video-future",
      type: "VIDEO_PACKAGE",
      participantIds: [],
      programmeId: null,
      plannedLengthMinutes: 3,
      videoSubjectPersonId: subject,
      videoKind: "DEBUT_TEASER",
      videoObjective: "CREATE_INTRIGUE",
      videoReveal: "CRYPTIC",
    }],
  }), "show date");
});

test("video package cannot use an unsigned subject or reserve wrestlers as prerecorded footage", () => {
  const setup = fixture(91502);
  const outsider = setup.state.people.find((person) => !setup.rosterIds.includes(person.id))!;
  const segment = {
    draftSegmentId: "video-invalid",
    type: "VIDEO_PACKAGE" as const,
    participantIds: [],
    programmeId: null,
    plannedLengthMinutes: 3,
    videoSubjectPersonId: outsider.id,
    videoKind: "RETURN_TEASER" as const,
    videoObjective: "BUILD_ANTICIPATION" as const,
    videoReveal: "NAMED" as const,
  };
  const base = {
    draftId: "video-invalid-fixture", promotionId: setup.promotion.id, targetDate: setup.targetDate,
    marketId: null, venueId: null, ticketStrategy: null,
    participantIds: setup.rosterIds.slice(0, 2), matches: [], championshipAssignments: [],
  };
  throwsContaining(() => upsertDetailedShowDraft(setup.state, setup.planning, setup.promotion.id, 0,
    { ...base, segments: [segment] }), "under contract on the show date");
  throwsContaining(() => upsertDetailedShowDraft(setup.state, setup.planning, setup.promotion.id, 0,
    { ...base, segments: [{ ...segment, videoSubjectPersonId: setup.rosterIds[0], participantIds: [setup.rosterIds[0]!] }] }),
    "cannot reserve live wrestlers");
});

test("a true debut is a reserved on-site wrestler and persists through settled show Results", () => {
  const setup = fixture(91601);
  const featured = setup.rosterIds[0]!;
  upsertDetailedShowDraft(setup.state, setup.planning, setup.promotion.id, 0, {
    draftId: "live-arrival-debut",
    promotionId: setup.promotion.id,
    targetDate: setup.targetDate,
    marketId: null, venueId: null, ticketStrategy: null,
    participantIds: setup.rosterIds.slice(0, 4),
    matches: [], championshipAssignments: [],
    segments: [{
      draftSegmentId: "arrives-in-person", type: "LIVE_APPEARANCE",
      participantIds: [featured], programmeId: null,
      plannedLengthMinutes: 5,
      liveAppearanceKind: "DEBUT",
      liveAppearanceObjective: "ESTABLISH_STAR",
    }],
    runningOrder: [{kind:"SEGMENT",refId:"arrives-in-person"}],
  });
  const draft = setup.planning.workspaces[0]!.detailedShowDrafts[0]!;
  ok(draft.segments?.[0]?.participantIds[0] === featured, "debut did not reserve a physical performer");
  setup.state.events.push(completedEvent(setup));
  ok(recordResolvedShowSegments(setup.state, setup.planning) === 1, "live debut failed to resolve");
  const result = resolvedShowSegmentsForEvent(setup.state, setup.state.events.at(-1)!.id)[0];
  ok(result?.liveAppearanceKind === "DEBUT" && result.liveAppearanceObjective === "ESTABLISH_STAR",
    "debut's authored storyline detail was lost at World resolution");
  ok(result.participantIds[0] === featured && result.videoSubjectPersonId === null,
    "in-person debut was incorrectly treated as a video-only package");
});
test("debut cannot appear after an earlier live angle on the same card", () => {
  const setup = fixture(91602), featured = setup.rosterIds[0]!;
  throwsContaining(() => upsertDetailedShowDraft(setup.state, setup.planning, setup.promotion.id, 0, {
    draftId: "bad-second-debut",
    promotionId: setup.promotion.id, targetDate: setup.targetDate,
    marketId: null, venueId: null, ticketStrategy: null,
    participantIds: setup.rosterIds.slice(0, 4), matches: [], championshipAssignments: [],
    segments: [
      {draftSegmentId:"opening-promo",type:"PROMO",participantIds:[featured],programmeId:null,plannedLengthMinutes:5},
      {draftSegmentId:"belated-debut",type:"LIVE_APPEARANCE",participantIds:[featured],programmeId:null,
       plannedLengthMinutes:5,liveAppearanceKind:"DEBUT",liveAppearanceObjective:"BUILD_EXCITEMENT"},
    ],
    runningOrder: [{kind:"SEGMENT",refId:"opening-promo"},{kind:"SEGMENT",refId:"belated-debut"}],
  }), "first on-screen appearance");
});
test("return requires meaningful previous live appearance, not a video package", () => {
  const setup = fixture(91603);
  throwsContaining(() => upsertDetailedShowDraft(setup.state, setup.planning, setup.promotion.id, 0, {
    draftId: "no-history-return",
    promotionId: setup.promotion.id, targetDate: setup.targetDate,
    marketId: null, venueId: null, ticketStrategy: null,
    participantIds: setup.rosterIds.slice(0, 4), matches: [], championshipAssignments: [],
    segments: [{draftSegmentId:"false-return",type:"LIVE_APPEARANCE",participantIds:[setup.rosterIds[0]!],
      programmeId:null,plannedLengthMinutes:5,liveAppearanceKind:"RETURN",liveAppearanceObjective:"BUILD_EXCITEMENT"}],
  }), "previous promotion appearance");
});

test("typed show segments can attach an active Programme and preserve running order", () => {
  const setup = fixture(9150);
  upsertDetailedShowDraft(setup.state, setup.planning, setup.promotion.id, 0, {
    draftId: "typed-segment-show",
    promotionId: setup.promotion.id,
    targetDate: setup.targetDate,
    marketId: null,
    venueId: null,
    ticketStrategy: null,
    participantIds: setup.rosterIds.slice(0, 4),
    matches: [],
    championshipAssignments: [],
    segments: [{
      draftSegmentId: "typed-segment-1",
      type: "CONFRONTATION",
      participantIds: [setup.rosterIds[0]!, setup.rosterIds[1]!],
      programmeId: setup.programme.id,
      plannedLengthMinutes: 7,
    }],
    runningOrder: [{ kind: "SEGMENT", refId: "typed-segment-1" }],
  });

  const stored = setup.planning.workspaces[0]!.detailedShowDrafts[0]!;
  ok(stored.segments?.[0]?.type === "CONFRONTATION", "typed segment did not persist its story beat");
  ok(stored.runningOrder?.[0]?.refId === "typed-segment-1", "typed segment running order was not persisted");

  setup.state.events.push(completedEvent(setup));
  const recorded = recordResolvedProgrammeSegments(setup.state, setup.planning);
  ok(recorded === 1, `typed Programme segment recorded ${recorded} factual beats`);
  const frozen = resolvedShowSegmentsForEvent(setup.state, setup.state.events[0]!.id);
  ok(frozen.length === 1 && frozen[0]?.type === "CONFRONTATION", "typed segment was not frozen into show history");
  ok(frozen[0]?.slotOrder === 1 && frozen[0]?.plannedLengthMinutes === 7, "typed segment lost its booked slot or duration");
  ok(frozen[0]?.executionQuality !== null && frozen[0]!.executionQuality! > 0, "typed segment did not resolve execution");
  ok(frozen[0]?.crowdResponse !== null && frozen[0]!.crowdResponse! > 0, "typed segment did not resolve crowd response");
  ok(frozen[0]?.outcomeBand !== null, "typed segment did not freeze an outcome band");
  ok(programmeActivities(setup.state, setup.programme.id)[0]?.kind === "SEGMENT", "typed segment did not feed Programme history");
});

for (const [kind, seed] of [["CHALLENGE", 9156], ["CONFRONTATION", 9157]] as const) {
  test(`${kind} preserves chosen initiator and target without guessing them from participant order`, () => {
    const setup = fixture(seed);
    const [first, second] = setup.rosterIds;
    const base = {
      draftId: `directed-${kind.toLowerCase()}`,
      promotionId: setup.promotion.id,
      targetDate: setup.targetDate,
      marketId: null,
      venueId: null,
      ticketStrategy: null,
      participantIds: setup.rosterIds.slice(0, 4),
      matches: [],
      championshipAssignments: [],
    };
    const directed = {
      draftSegmentId: "directed-1",
      type: kind,
      participantIds: [first!, second!],
      programmeId: setup.programme.id,
      plannedLengthMinutes: 5,
      initiatorPersonId: second!,
      targetPersonId: first!,
    };
    throwsContaining(() => upsertDetailedShowDraft(setup.state, setup.planning, setup.promotion.id, 0, {
      ...base, segments: [{ ...directed, targetPersonId: null }],
    }), "distinct initiator and target");
    throwsContaining(() => upsertDetailedShowDraft(setup.state, setup.planning, setup.promotion.id, 0, {
      ...base, segments: [{ ...directed, targetPersonId: second! }],
    }), "distinct initiator and target");
    upsertDetailedShowDraft(setup.state, setup.planning, setup.promotion.id, 0, { ...base, segments: [directed] });
    const stored = setup.planning.workspaces[0]!.detailedShowDrafts[0]!.segments![0]!;
    ok(stored.initiatorPersonId === second && stored.targetPersonId === first, "directed booking lost role direction");
    setup.state.events.push(completedEvent(setup));
    ok(recordResolvedShowSegments(setup.state, setup.planning) === 1, "directed segment did not resolve");
    const frozen = resolvedShowSegmentsForEvent(setup.state, setup.state.events[0]!.id)[0]!;
    ok(frozen.initiatorPersonId === second && frozen.targetPersonId === first, "ledger lost directed roles");
    ok(recordResolvedShowSegments(setup.state, setup.planning) === 0, "replay duplicated directed segment");
  });
}

test("RESCUE freezes the aggressor, victim and rescuer as distinct characters", () => {
  const setup = fixture(9167);
  const [aggressor, victim, rescuer] = setup.rosterIds;
  const base = {
    draftId: "rescue-show", promotionId: setup.promotion.id, targetDate: setup.targetDate,
    marketId: null, venueId: null, ticketStrategy: null,
    participantIds: setup.rosterIds.slice(0, 4), matches: [], championshipAssignments: [],
  };
  const segment = {
    draftSegmentId: "rescue-1", type: "RESCUE" as const,
    participantIds: [victim!, aggressor!, rescuer!],
    attackerPersonId: aggressor!, victimPersonId: victim!, rescuerPersonId: rescuer!,
    programmeId: null, plannedLengthMinutes: 5,
  };
  throwsContaining(() => upsertDetailedShowDraft(setup.state, setup.planning, setup.promotion.id, 0, {
    ...base, segments: [{ ...segment, participantIds: [aggressor!, victim!] }],
  }), "three distinct wrestlers");
  throwsContaining(() => upsertDetailedShowDraft(setup.state, setup.planning, setup.promotion.id, 0, {
    ...base, segments: [{ ...segment, rescuerPersonId: aggressor! }],
  }), "distinct rescuer");
  throwsContaining(() => upsertDetailedShowDraft(setup.state, setup.planning, setup.promotion.id, 0, {
    ...base, segments: [{ ...segment, rescuerPersonId: setup.rosterIds[3]! }],
  }), "distinct rescuer");
  setPromotionWrestlerAlignment(setup.state, setup.promotion.id, aggressor!, "HEEL");
  setPromotionWrestlerAlignment(setup.state, setup.promotion.id, victim!, "FACE");
  setPromotionWrestlerAlignment(setup.state, setup.promotion.id, rescuer!, "FACE");
  upsertDetailedShowDraft(setup.state, setup.planning, setup.promotion.id, 0, { ...base, segments: [segment] });
  const stored = setup.planning.workspaces[0]!.detailedShowDrafts[0]!.segments![0]!;
  ok(stored.attackerPersonId === aggressor && stored.victimPersonId === victim
    && stored.rescuerPersonId === rescuer, "rescuer roles were inferred from participant order");
  setup.state.events.push(completedEvent(setup));
  ok(recordResolvedShowSegments(setup.state, setup.planning) === 1, "rescue did not resolve");
  const frozen = resolvedShowSegmentsForEvent(setup.state, setup.state.events[0]!.id)[0]!;
  ok(frozen.type === "RESCUE" && frozen.attackerPersonId === aggressor
    && frozen.victimPersonId === victim && frozen.rescuerPersonId === rescuer,
    "rescue direction was not frozen in ledger");
  ok(frozen.crowdResponse !== null && frozen.outcomeBand !== null, "rescue missing crowd outcome");
  ok(Number.isFinite(frozen.angleFitModifier), "rescue fit was not deterministic");
  ok(recordResolvedShowSegments(setup.state, setup.planning) === 0, "rescue duplicated on retry");
});

test("outsider rescue can advance a two-wrestler Programme without joining it", () => {
  const setup = fixture(9169);
  const [aggressor, victim, rescuer] = setup.rosterIds;
  upsertDetailedShowDraft(setup.state, setup.planning, setup.promotion.id, 0, {
    draftId: "outsider-save", promotionId: setup.promotion.id, targetDate: setup.targetDate,
    marketId: null, venueId: null, ticketStrategy: null,
    participantIds: setup.rosterIds.slice(0, 4), matches: [], championshipAssignments: [],
    segments: [{ draftSegmentId: "outsider-save-1", type: "RESCUE",
      participantIds: [aggressor!, victim!, rescuer!],
      attackerPersonId: aggressor!, victimPersonId: victim!, rescuerPersonId: rescuer!,
      programmeId: setup.programme.id, plannedLengthMinutes: 5 }],
  });
  setup.state.events.push(completedEvent(setup));
  ok(recordResolvedShowSegments(setup.state, setup.planning) === 1, "outsider save never resolved");
  const frozen = resolvedShowSegmentsForEvent(setup.state, setup.state.events[0]!.id)[0]!;
  ok(frozen.rescuerPersonId === rescuer && frozen.programmeId === setup.programme.id,
    "outsider rescue lost programme attribution");
  ok(programmeActivities(setup.state, setup.programme.id).length === 1,
    "rescue did not contribute to existing Programme history");
  ok(setup.programme.sideA.length === 1 && setup.programme.sideB.length === 1,
    "outsider was silently enlisted into the Programme");
});

test("RESCUE crowd fit responds to a rescuer changing from face to heel", () => {
  const resolve = (rescuerAlignment: "HEEL" | "FACE") => {
    const setup = fixture(9168);
    const [aggressor, victim, rescuer] = setup.rosterIds;
    setPromotionWrestlerAlignment(setup.state, setup.promotion.id, aggressor!, "HEEL");
    setPromotionWrestlerAlignment(setup.state, setup.promotion.id, victim!, "FACE");
    setPromotionWrestlerAlignment(setup.state, setup.promotion.id, rescuer!, rescuerAlignment);
    upsertDetailedShowDraft(setup.state, setup.planning, setup.promotion.id, 0, {
      draftId: "rescue-fit", promotionId: setup.promotion.id, targetDate: setup.targetDate,
      marketId: null, venueId: null, ticketStrategy: null,
      participantIds: setup.rosterIds.slice(0, 4), matches: [], championshipAssignments: [],
      segments: [{ draftSegmentId: "save", type: "RESCUE",
        participantIds: [aggressor!, victim!, rescuer!],
        attackerPersonId: aggressor!, victimPersonId: victim!, rescuerPersonId: rescuer!,
        programmeId: null, plannedLengthMinutes: 6 }],
    });
    setup.state.events.push(completedEvent(setup));
    recordResolvedShowSegments(setup.state, setup.planning);
    return resolvedShowSegmentsForEvent(setup.state, setup.state.events[0]!.id)[0]!;
  };
  const face = resolve("FACE");
  const heel = resolve("HEEL");
  ok(face.angleFitModifier > heel.angleFitModifier, "rescue ignored character alignment");
  ok(face.crowdResponse! > heel.crowdResponse!, "a clearer save did not land better");
});

test("POST_MATCH_ASSAULT requires a completed match, immediate adjacency and the real match victim", () => {
  const setup = fixture(9170);
  const victim = setup.rosterIds[0]!;
  const division = setup.state.people.find((person) => person.id === victim)?.division ?? "MEN";
  const opponent = setup.rosterIds.slice(1).find((id) => (
    (setup.state.people.find((person) => person.id === id)?.division ?? "MEN") === division
  ));
  if (!opponent) throw new Error("post-match test needs two wrestlers in one division");
  const aggressor = setup.rosterIds.find((id) => id !== victim && id !== opponent)!;
  const source = { draftMatchId: "source-match", type: "SINGLES" as const,
    sideAIds: [victim], sideBIds: [opponent], intendedWinnerSide: "A" as const,
    intent: "COMPETITIVE" as const, plannedLengthMinutes: 12 };
  const assault = { draftSegmentId: "assault", type: "POST_MATCH_ASSAULT" as const,
    participantIds: [aggressor, victim], attackerPersonId: aggressor,
    victimPersonId: victim, sourceDraftMatchId: source.draftMatchId,
    programmeId: null, plannedLengthMinutes: 4 };
  const base = { draftId: "post-match-show", promotionId: setup.promotion.id,
    targetDate: setup.targetDate, marketId: null, venueId: null, ticketStrategy: null,
    participantIds: setup.rosterIds.slice(0, 4), matches: [source], segments: [assault],
    championshipAssignments: [],
    runningOrder: [
      { kind: "MATCH" as const, refId: source.draftMatchId },
      { kind: "SEGMENT" as const, refId: assault.draftSegmentId },
    ] };
  const outsideVictim = setup.rosterIds.find((id) => (
    id !== victim && id !== opponent && id !== aggressor
  ))!;
  throwsContaining(() => upsertDetailedShowDraft(setup.state, setup.planning, setup.promotion.id, 0, {
    ...base, segments: [{ ...assault, participantIds: [aggressor, outsideVictim], victimPersonId: outsideVictim }],
  }), "victim must compete");
  throwsContaining(() => upsertDetailedShowDraft(setup.state, setup.planning, setup.promotion.id, 0, {
    ...base, runningOrder: [base.runningOrder[1]!, base.runningOrder[0]!],
  }), "immediately follow");
  throwsContaining(() => upsertDetailedShowDraft(setup.state, setup.planning, setup.promotion.id, 0, {
    ...base, segments: [{ ...assault, sourceDraftMatchId: "not-booked" }],
  }), "reference a match");
  upsertDetailedShowDraft(setup.state, setup.planning, setup.promotion.id, 0, base);
  const event = completedEvent(setup);
  setup.state.events.push(event);
  ok(recordResolvedShowSegments(setup.state, setup.planning) === 0,
    "missing match cannot create a fictional assault");
  const id = "completed-assault-source";
  setup.state.matches.push({
    id, worldId: setup.state.world.id, eventId: event.id, promotionId: setup.promotion.id,
    order: 1, type: "SINGLES", status: "COMPLETED", intent: "COMPETITIVE",
    plannedLengthMinutes: 12, actualLengthMinutes: 12, intendedWinnerSide: "A",
    actualWinnerSide: "A", finishChangedDueToInjury: false,
    executionQuality: 65, criticalRatingStars: 3, crowdResponse: 60,
  });
  for (const [index, personId] of [victim, opponent].entries()) {
    setup.state.matchParticipants.push({
      id: `post-match-person:${index}`, worldId: setup.state.world.id, eventId: event.id, matchId: id,
      personId, side: index === 0 ? "A" : "B", won: index === 0,
    });
  }
  ok(recordResolvedShowSegments(setup.state, setup.planning) === 1,
    "completed source match did not produce assault history");
  const frozen = resolvedShowSegmentsForEvent(setup.state, event.id)[0]!;
  ok(frozen.sourceMatchId === id && frozen.sourceDraftMatchId === source.draftMatchId,
    "source match was not linked to the result");
  ok(frozen.victimMatchOutcome === "WON" && frozen.victimPersonId === victim,
    "frozen assault lost the victim's actual win");
  ok(recordResolvedShowSegments(setup.state, setup.planning) === 0,
    "replaying post-match assaults duplicated history");
  ok(setup.state.matches.find((match) => match.id === id)?.actualWinnerSide === "A",
    "assault altered a completed match finish");
});

for (const [outcome, seed] of [["RECONCILED", 9187], ["REBUFFED", 9188]] as const) {
  test(`STABLE_RECONCILIATION freezes scripted ${outcome} without restoring old membership`, () => {
    const setup = fixture(seed);
    const [representative, former, third, outsider] = setup.rosterIds;
    const stableId = "reunion-stable";
    setup.state.stables = [{
      id: stableId, worldId: setup.state.world.id, promotionId: setup.promotion.id,
      name: "Reunion History Stable", status: "ACTIVE",
      formedDate: { ...setup.state.world.currentDate }, disbandedDate: null,
    }];
    setup.state.stableMemberships = [representative!, former!, third!].map((personId, index) => ({
      id: `reunion-member-${index}`, worldId: setup.state.world.id, stableId,
      personId, joinedDate: { ...setup.state.world.currentDate },
      leftDate: index === 1 ? { ...setup.state.world.currentDate } : null,
      active: index !== 1,
    }));
    const base = {
      draftId: "reconciliation-show", promotionId: setup.promotion.id,
      targetDate: setup.targetDate, marketId: null, venueId: null,
      ticketStrategy: null, participantIds: setup.rosterIds.slice(0, 4),
      matches: [], championshipAssignments: [],
    };
    const angle = {
      draftSegmentId: "reunion-angle", type: "STABLE_RECONCILIATION" as const,
      participantIds: [former!, representative!],
      initiatorPersonId: representative!, targetPersonId: former!,
      stableId, stableReconciliationOutcome: outcome,
      programmeId: setup.programme.id, plannedLengthMinutes: 6,
    };
    throwsContaining(() => upsertDetailedShowDraft(setup.state, setup.planning, setup.promotion.id, 0, {
      ...base, segments: [{ ...angle, stableId: "not-a-stable" }],
    }), "requires an active stable");
    throwsContaining(() => upsertDetailedShowDraft(setup.state, setup.planning, setup.promotion.id, 0, {
      ...base, segments: [{ ...angle, stableReconciliationOutcome: "RANDOM" as typeof outcome }],
    }), "scripted outcome");
    throwsContaining(() => upsertDetailedShowDraft(setup.state, setup.planning, setup.promotion.id, 0, {
      ...base, segments: [{ ...angle, targetPersonId: third, participantIds: [representative!, third!] }],
    }), "former, not current");
    throwsContaining(() => upsertDetailedShowDraft(setup.state, setup.planning, setup.promotion.id, 0, {
      ...base, segments: [{ ...angle, targetPersonId: outsider, participantIds: [representative!, outsider!] }],
    }), "former, not current");
    upsertDetailedShowDraft(setup.state, setup.planning, setup.promotion.id, 0, {
      ...base, segments: [angle],
    });
    const before = JSON.stringify(setup.state.stableMemberships);
    setup.state.events.push(completedEvent(setup));
    ok(recordResolvedShowSegments(setup.state, setup.planning) === 1, "reconciliation not recorded");
    const frozen = resolvedShowSegmentsForEvent(setup.state, setup.state.events[0]!.id)[0]!;
    ok(frozen.stableReconciliationOutcome === outcome
      && frozen.stableId === stableId && frozen.stableName === "Reunion History Stable",
      "scripted reconciliation or stable identity changed");
    ok(frozen.initiatorPersonId === representative && frozen.targetPersonId === former,
      "representative and former member roles were lost");
    ok(frozen.crowdResponse !== null && frozen.executionQuality !== null,
      "reconciliation was not scored separately from its authored story");
    ok(JSON.stringify(setup.state.stableMemberships) === before,
      "scripted reconciliation changed actual stable membership");
    ok(recordResolvedShowSegments(setup.state, setup.planning) === 0,
      "replayed World Lock duplicated reconciliation");
  });
}

for (const [outcome, seed] of [["EXPELLED", 9185], ["WALKED_OUT", 9186]] as const) {
  test(`STABLE_EXIT preserves scripted ${outcome} without silently altering stable membership`, () => {
    const setup = fixture(seed);
    const [representative, departing, third] = setup.rosterIds;
    const stableId = "active-stable-exit";
    setup.state.stables = [{
      id: stableId, worldId: setup.state.world.id,
      promotionId: setup.promotion.id, name: "Exit Test Faction",
      status: "ACTIVE", formedDate: { ...setup.state.world.currentDate }, disbandedDate: null,
    }];
    setup.state.stableMemberships = [representative!, departing!, third!].map((personId, index) => ({
      id: `exit-member-${index}`, worldId: setup.state.world.id, stableId,
      personId, joinedDate: { ...setup.state.world.currentDate }, leftDate: null, active: true,
    }));
    const base = {
      draftId: "stable-exit-show", promotionId: setup.promotion.id,
      targetDate: setup.targetDate, marketId: null, venueId: null, ticketStrategy: null,
      participantIds: setup.rosterIds.slice(0, 4), matches: [], championshipAssignments: [],
    };
    const exit = {
      draftSegmentId: "stable-exit-angle", type: "STABLE_EXIT" as const,
      participantIds: [departing!, representative!],
      initiatorPersonId: representative!, targetPersonId: departing!,
      stableId, stableExitOutcome: outcome, programmeId: setup.programme.id,
      plannedLengthMinutes: 6,
    };
    throwsContaining(() => upsertDetailedShowDraft(setup.state, setup.planning, setup.promotion.id, 0, {
      ...base, segments: [{ ...exit, stableId: "no-such-stable" }],
    }), "requires an active stable");
    throwsContaining(() => upsertDetailedShowDraft(setup.state, setup.planning, setup.promotion.id, 0, {
      ...base, segments: [{ ...exit, stableExitOutcome: "RANDOM" as typeof outcome }],
    }), "scripted exit");
    throwsContaining(() => upsertDetailedShowDraft(setup.state, setup.planning, setup.promotion.id, 0, {
      ...base, segments: [{ ...exit, targetPersonId: setup.rosterIds[3], participantIds: [representative!, setup.rosterIds[3]!] }],
    }), "two current members");
    upsertDetailedShowDraft(setup.state, setup.planning, setup.promotion.id, 0, {
      ...base, segments: [exit],
    });
    const original = JSON.stringify(setup.state.stableMemberships);
    setup.state.events.push(completedEvent(setup));
    ok(recordResolvedShowSegments(setup.state, setup.planning) === 1, "stable exit not recorded");
    const resolved = resolvedShowSegmentsForEvent(setup.state, setup.state.events[0]!.id)[0]!;
    ok(resolved.stableId === stableId && resolved.stableName === "Exit Test Faction"
      && resolved.stableExitOutcome === outcome, "World history changed the scripted exit");
    ok(resolved.initiatorPersonId === representative && resolved.targetPersonId === departing,
      "World history changed the representative or departing wrestler");
    ok(resolved.crowdResponse !== null && resolved.executionQuality !== null,
      "on-screen exit did not receive simulated delivery and crowd response");
    ok(JSON.stringify(setup.state.stableMemberships) === original,
      "scripted stable exit silently changed World membership");
    ok(recordResolvedShowSegments(setup.state, setup.planning) === 0,
      "replaying World resolution duplicated the exit");
  });
}

for (const [response, seed] of [["ACCEPTED", 9183], ["REFUSED", 9184]] as const) {
  test(`STABLE_INVITATION records scripted ${response} without silently changing group membership`, () => {
    const setup = fixture(seed);
    const [representative, recruit, memberTwo, memberThree] = setup.rosterIds;
    setup.state.stables = [{
      id: "test-stable", worldId: setup.state.world.id,
      promotionId: setup.promotion.id, name: "Test faction",
      status: "ACTIVE", formedDate: { ...setup.state.world.currentDate }, disbandedDate: null,
    }];
    setup.state.stableMemberships = [representative!, memberTwo!, memberThree!].map((personId, index) => ({
      id: `test-stable-member-${index}`, worldId: setup.state.world.id,
      stableId: "test-stable", personId,
      joinedDate: { ...setup.state.world.currentDate }, leftDate: null, active: true,
    }));
    const base = {
      draftId: "invite-show", promotionId: setup.promotion.id,
      targetDate: setup.targetDate, marketId: null, venueId: null, ticketStrategy: null,
      participantIds: setup.rosterIds.slice(0, 4), matches: [], championshipAssignments: [],
    };
    const angle = {
      draftSegmentId: "invite-angle", type: "STABLE_INVITATION" as const,
      participantIds: [recruit!, representative!],
      initiatorPersonId: representative!, targetPersonId: recruit!,
      stableId: "test-stable", stableInvitationOutcome: response,
      programmeId: setup.programme.id, plannedLengthMinutes: 6,
    };
    // This is a distinct bookkeeping action: recruiting cannot invent group membership.
    throwsContaining(() => upsertDetailedShowDraft(setup.state, setup.planning, setup.promotion.id, 0, {
      ...base, segments: [{ ...angle, stableId: "missing-stable" }],
    }), "active stable");
    throwsContaining(() => upsertDetailedShowDraft(setup.state, setup.planning, setup.promotion.id, 0, {
      ...base, segments: [{ ...angle, initiatorPersonId: recruit, targetPersonId: representative }],
    }), "recruiter must be a current member");
    throwsContaining(() => upsertDetailedShowDraft(setup.state, setup.planning, setup.promotion.id, 0, {
      ...base, segments: [{ ...angle, stableInvitationOutcome: "RANDOM" as typeof response }],
    }), "scripted acceptance or refusal");
    upsertDetailedShowDraft(setup.state, setup.planning, setup.promotion.id, 0, {
      ...base, segments: [angle],
    });
    const membershipsBefore = JSON.stringify(setup.state.stableMemberships);
    setup.state.events.push(completedEvent(setup));
    ok(recordResolvedShowSegments(setup.state, setup.planning) === 1, "invitation not recorded");
    const resolved = resolvedShowSegmentsForEvent(setup.state, setup.state.events[0]!.id)[0]!;
    ok(resolved.stableId === "test-stable" && resolved.stableName === "Test faction"
      && resolved.stableInvitationOutcome === response, "scripted faction event lost name, identity or outcome");
    ok(resolved.initiatorPersonId === representative && resolved.targetPersonId === recruit,
      "recruiter and recruit roles changed");
    ok(resolved.crowdResponse !== null, "segment was not evaluated for crowd reception");
    ok(JSON.stringify(setup.state.stableMemberships) === membershipsBefore,
      "on-screen invitation silently changed stable membership");
    ok(recordResolvedShowSegments(setup.state, setup.planning) === 0, "invitation duplicated on replay");
  });
}

for (const [outcome, seed] of [
  ["VERBAL_EXCHANGE", 9179], ["INTERRUPTER_PREVAILS", 9180],
  ["SPEAKER_PREVAILS", 9181], ["BRAWL", 9182],
] as const) {
  test(`INTERRUPTION preserves scripted ${outcome} and named roles at World Lock`, () => {
    const setup = fixture(seed);
    const [speaker, interrupter] = setup.rosterIds;
    const base = {
      draftId: "interruption-draft", promotionId: setup.promotion.id,
      targetDate: setup.targetDate, marketId: null, venueId: null,
      ticketStrategy: null, participantIds: setup.rosterIds.slice(0, 4),
      matches: [], championshipAssignments: [],
    };
    const angle = {
      draftSegmentId: "interruption-1", type: "INTERRUPTION" as const,
      participantIds: [speaker!, interrupter!],
      initiatorPersonId: interrupter!, targetPersonId: speaker!,
      interruptionOutcome: outcome, programmeId: setup.programme.id,
      plannedLengthMinutes: 6,
    };
    throwsContaining(() => upsertDetailedShowDraft(setup.state, setup.planning, setup.promotion.id, 0, {
      ...base, segments: [{ ...angle, interruptionOutcome: "RANDOM" as typeof outcome }],
    }), "scripted outcome");
    throwsContaining(() => upsertDetailedShowDraft(setup.state, setup.planning, setup.promotion.id, 0, {
      ...base, segments: [{ ...angle, initiatorPersonId: speaker }],
    }), "distinct initiator and target");
    upsertDetailedShowDraft(setup.state, setup.planning, setup.promotion.id, 0, {
      ...base, segments: [angle],
    });
    const stored = setup.planning.workspaces[0]!.detailedShowDrafts[0]!.segments![0]!;
    ok(stored.interruptionOutcome === outcome, "draft lost chosen ending");
    setup.state.events.push(completedEvent(setup));
    ok(recordResolvedShowSegments(setup.state, setup.planning) === 1,
      "interruption was not recorded");
    const frozen = resolvedShowSegmentsForEvent(setup.state, setup.state.events[0]!.id)[0]!;
    ok(frozen.interruptionOutcome === outcome, "sim changed scripted interruption");
    ok(frozen.initiatorPersonId === interrupter && frozen.targetPersonId === speaker,
      "interrupter and speaker roles swapped");
    ok(frozen.executionQuality !== null && frozen.crowdResponse !== null,
      "interruption was not rated for execution and crowd response");
    ok(recordResolvedShowSegments(setup.state, setup.planning) === 0,
      "interruption produced duplicate history");
  });
}

for (const [response, seed] of [["ACCEPTED", 9175], ["REFUSED", 9176], ["LEFT_OPEN", 9177]] as const) {
  test(`CHALLENGE saves player-selected ${response} without overriding it`, () => {
    const setup = fixture(seed);
    const [first, second] = setup.rosterIds;
    const base = {
      draftId: "challenge-response", promotionId: setup.promotion.id, targetDate: setup.targetDate,
      marketId: null, venueId: null, ticketStrategy: null,
      participantIds: setup.rosterIds.slice(0, 4), matches: [], championshipAssignments: [],
    };
    const challenge = {
      draftSegmentId: "challenge-response-1", type: "CHALLENGE" as const,
      participantIds: [second!, first!], programmeId: null, plannedLengthMinutes: 5,
      initiatorPersonId: first!, targetPersonId: second!, challengeResponse: response,
    };
    upsertDetailedShowDraft(setup.state, setup.planning, setup.promotion.id, 0, {
      ...base, segments: [challenge],
    });
    ok(setup.planning.workspaces[0]!.detailedShowDrafts[0]!.segments?.[0]?.challengeResponse === response,
      "draft lost the authored response");
    setup.state.events.push(completedEvent(setup));
    ok(recordResolvedShowSegments(setup.state, setup.planning) === 1, "challenge not recorded");
    const resolved = resolvedShowSegmentsForEvent(setup.state, setup.state.events[0]!.id)[0]!;
    ok(resolved.challengeResponse === response, "challenge response changed during resolution");
    ok(resolved.initiatorPersonId === first && resolved.targetPersonId === second,
      "challenge roles were reordered");
    ok(resolved.crowdResponse !== null, "scripted challenge received no crowd score");
    ok(recordResolvedShowSegments(setup.state, setup.planning) === 0,
      "challenge history duplicated");
  });
}

for (const [signingOutcome, seed] of [
  ["SIGNED", 9171], ["REJECTED", 9172], ["WALKOUT", 9173], ["BRAWL", 9174],
] as const) {
  test(`CONTRACT_SIGNING freezes scripted ${signingOutcome} and authored roles without random outcomes`, () => {
    const setup = fixture(seed);
    const proposer = setup.rosterIds[0]!;
    const responder = setup.rosterIds[1]!;
    const angle = {
      draftSegmentId: "signing-1", type: "CONTRACT_SIGNING" as const,
      participantIds: [responder, proposer], initiatorPersonId: proposer,
      targetPersonId: responder, signingOutcome, programmeId: setup.programme.id,
      plannedLengthMinutes: 8,
    };
    const base = {
      draftId: "contract-signing-show", promotionId: setup.promotion.id,
      targetDate: setup.targetDate, marketId: null, venueId: null,
      ticketStrategy: null, participantIds: setup.rosterIds.slice(0, 4),
      matches: [], championshipAssignments: [],
    };
    throwsContaining(() => upsertDetailedShowDraft(setup.state, setup.planning, setup.promotion.id, 0, {
      ...base, segments: [{ ...angle, initiatorPersonId: responder, targetPersonId: responder }],
    }), "distinct initiator and target");
    throwsContaining(() => upsertDetailedShowDraft(setup.state, setup.planning, setup.promotion.id, 0, {
      ...base, segments: [{ ...angle, signingOutcome: "SURPRISE" as typeof signingOutcome }],
    }), "scripted outcome");
    upsertDetailedShowDraft(setup.state, setup.planning, setup.promotion.id, 0, {
      ...base, segments: [angle],
    });
    setup.state.events.push(completedEvent(setup));
    ok(recordResolvedShowSegments(setup.state, setup.planning) === 1, "signing was not recorded");
    const frozen = resolvedShowSegmentsForEvent(setup.state, setup.state.events[0]!.id)[0]!;
    ok(frozen.signingOutcome === signingOutcome,
      "simulation changed the player-authored signing");
    ok(frozen.initiatorPersonId === proposer && frozen.targetPersonId === responder,
      "signing roles were inferred from participant order");
    ok(frozen.crowdResponse !== null && frozen.executionQuality !== null,
      "signing was not evaluated for delivery");
    ok(recordResolvedShowSegments(setup.state, setup.planning) === 0,
      "signing repeated on World replay");
  });
}

test("ATTACK records explicit attacker and victim into immutable show history", () => {
  const setup = fixture(9158);
  const [attacker, victim] = setup.rosterIds;
  const base = {
    draftId: "attack-segment-show",
    promotionId: setup.promotion.id,
    targetDate: setup.targetDate,
    marketId: null,
    venueId: null,
    ticketStrategy: null,
    participantIds: setup.rosterIds.slice(0, 4),
    matches: [],
    championshipAssignments: [],
  };
  const attack = {
    draftSegmentId: "attack-1",
    type: "ATTACK" as const,
    participantIds: [attacker!, victim!],
    programmeId: setup.programme.id,
    plannedLengthMinutes: 5,
    attackerPersonId: attacker!,
    victimPersonId: victim!,
    attackPresentation: "BLINDSIDE" as const,
    attackObjective: "GENERATE_HEAT" as const,
  };
  setPromotionWrestlerAlignment(setup.state, setup.promotion.id, attacker!, "HEEL");
  setPromotionWrestlerAlignment(setup.state, setup.promotion.id, victim!, "FACE");
  throwsContaining(() => upsertDetailedShowDraft(setup.state, setup.planning, setup.promotion.id, 0, {
    ...base, segments: [{ ...attack, victimPersonId: attacker! }],
  }), "distinct attacker and victim");
  throwsContaining(() => upsertDetailedShowDraft(setup.state, setup.planning, setup.promotion.id, 0, {
    ...base,
    segments: [{ ...attack, attackPresentation: "TOTALLY_UNKNOWN" as typeof attack.attackPresentation }],
  }), "unsupported presentation or objective");
  upsertDetailedShowDraft(setup.state, setup.planning, setup.promotion.id, 0, {
    ...base, segments: [attack],
  });
  const saved = setup.planning.workspaces[0]!.detailedShowDrafts[0]!.segments![0]!;
  ok(saved.attackerPersonId === attacker && saved.victimPersonId === victim, "attack roles were not saved");
  ok(saved.attackPresentation === "BLINDSIDE" && saved.attackObjective === "GENERATE_HEAT", "attack format/objective lost before resolution");
  setup.state.events.push(completedEvent(setup));
  ok(recordResolvedShowSegments(setup.state, setup.planning) === 1, "attack did not resolve");
  const recorded = resolvedShowSegmentsForEvent(setup.state, setup.state.events[0]!.id)[0]!;
  ok(recorded.attackerPersonId === attacker && recorded.victimPersonId === victim, "attack direction was lost from the ledger");
  ok(recorded.attackPresentation === "BLINDSIDE" && recorded.attackObjective === "GENERATE_HEAT", "attack authored format/objective lost from ledger");
  ok(recorded.angleFitModifier > 0, "heel blindside of a babyface should generate some extra heat");
});

test("an established feud gives a pull-apart brawl a stronger reception than a cold one", () => {
  const run = (heat: number) => {
    const setup = fixture(9159);
    setup.programme.heat = heat;
    const [attacker, victim] = setup.rosterIds;
    upsertDetailedShowDraft(setup.state, setup.planning, setup.promotion.id, 0, {
      draftId: "brawl-show",
      promotionId: setup.promotion.id,
      targetDate: setup.targetDate,
      marketId: null,
      venueId: null,
      ticketStrategy: null,
      participantIds: setup.rosterIds.slice(0, 4),
      matches: [],
      championshipAssignments: [],
      segments: [{
        draftSegmentId: "brawl",
        type: "ATTACK",
        participantIds: [attacker!, victim!],
        attackerPersonId: attacker!,
        victimPersonId: victim!,
        attackPresentation: "PULL_APART_BRAWL",
        attackObjective: "ESCALATE_RIVALRY",
        programmeId: setup.programme.id,
        plannedLengthMinutes: 6,
      }],
    });
    setup.state.events.push(completedEvent(setup));
    recordResolvedShowSegments(setup.state, setup.planning);
    return resolvedShowSegmentsForEvent(setup.state, setup.state.events[0]!.id)[0]!;
  };
  const cold = run(20);
  const hot = run(85);
  ok(hot.angleFitModifier > cold.angleFitModifier, "brawl angle fit failed to acknowledge rivalry heat");
  ok(hot.crowdResponse! > cold.crowdResponse!, "hot rivalry failed to improve brawl response");
});

test("PROMO preserves a selected message without inventing a target or rewriting the scripted speech", () => {
  const setup = fixture(91601);
  const speaker = setup.rosterIds[2]!;
  upsertDetailedShowDraft(setup.state, setup.planning, setup.promotion.id, 0, {
    draftId: "scripted-promo",
    promotionId: setup.promotion.id,
    targetDate: setup.targetDate,
    marketId: null,
    venueId: null,
    ticketStrategy: null,
    participantIds: setup.rosterIds.slice(0, 4),
    matches: [],
    championshipAssignments: [],
    segments: [{
      draftSegmentId: "promo-speaker",
      type: "PROMO",
      promoPurpose: "RALLY_FANS",
      participantIds: [speaker],
      programmeId: null,
      plannedLengthMinutes: 6,
    }],
    runningOrder: [{ kind: "SEGMENT", refId: "promo-speaker" }],
  });
  setup.state.events.push(completedEvent(setup));
  ok(recordResolvedShowSegments(setup.state, setup.planning) === 1, "scripted promo did not resolve");
  const frozen = resolvedShowSegmentsForEvent(setup.state, setup.state.events[0]!.id)[0]!;
  ok(frozen.promoPurpose === "RALLY_FANS", "completed promo lost its authored message");
  ok(frozen.type === "PROMO" && frozen.participantIds[0] === speaker, "promo created an alternate event or performer");
  ok(frozen.targetPersonId === null && frozen.challengeResponse === null, "promo invented a challenge or rival response");
  ok(recordResolvedShowSegments(setup.state, setup.planning) === 0, "re-running segment resolution duplicated promo history");
  throwsContaining(() => upsertDetailedShowDraft(setup.state, setup.planning, setup.promotion.id, 1, {
    draftId: "invalid-promo",
    promotionId: setup.promotion.id,
    targetDate: setup.targetDate,
    marketId: null,
    venueId: null,
    ticketStrategy: null,
    participantIds: setup.rosterIds.slice(0, 4),
    matches: [],
    championshipAssignments: [],
    segments: [{
      draftSegmentId: "bad-purpose",
      type: "PROMO",
      promoPurpose: "INVENTED_OUTCOME" as "BOAST",
      participantIds: [speaker],
      programmeId: null,
      plannedLengthMinutes: 5,
    }],
  }), "promo purpose must be a supported");
});

test("promo repetition is modest, scoped to a completed same-message speech by the same talent and promotion", () => {
  function resolveWithHistory(prior: "NONE" | "MATCH" | "DIFFERENT_BEAT" | "OTHER_SPEAKER" | "OTHER_PROMOTION" | "OLD" | "DRAFT") {
    const setup = fixture(91602);
    setup.state.world.currentDate = { year: 1, week: 8, day: 1 };
    setup.targetDate = { year: 1, week: 8, day: 6 };
    const speaker = setup.rosterIds[2]!;
    if (prior !== "NONE" && prior !== "DRAFT") {
      const priorEntry = {
        id: "prior-performed-promo",
        worldId: setup.state.world.id,
        date: { year: 1, week: prior === "OLD" ? 1 : 7, day: 6 },
        order: 9750,
        type: "SHOW_SEGMENT_COMPLETED",
        significanceAtTime: "ROUTINE" as const,
        historicalSignificance: "ROUTINE" as const,
        entityIds: [setup.promotion.id, speaker],
        payload: {
          promotionId: prior === "OTHER_PROMOTION" ? "other-promotion" : setup.promotion.id,
          segmentType: "PROMO",
          promoPurpose: prior === "DIFFERENT_BEAT" ? "BOAST" : "RALLY_FANS",
          participantIds: prior === "OTHER_SPEAKER" ? setup.rosterIds[1]! : speaker,
        },
      };
      setup.state.ledger.push(priorEntry);
    }
    // A pending draft is never completed evidence and should not affect the World.
    upsertDetailedShowDraft(setup.state, setup.planning, setup.promotion.id, 0, {
      draftId: "tested-promo",
      promotionId: setup.promotion.id,
      targetDate: setup.targetDate,
      marketId: null,
      venueId: null,
      ticketStrategy: null,
      participantIds: setup.rosterIds.slice(0, 4),
      matches: [],
      championshipAssignments: [],
      segments: [{
        draftSegmentId: "tested-promo-beat",
        type: "PROMO",
        promoPurpose: "RALLY_FANS",
        participantIds: [speaker],
        programmeId: null,
        plannedLengthMinutes: 5,
      }],
    });
    setup.state.events.push(completedEvent(setup));
    recordResolvedShowSegments(setup.state, setup.planning);
    return resolvedShowSegmentsForEvent(setup.state, setup.state.events[0]!.id)[0]!;
  }
  const fresh = resolveWithHistory("NONE");
  const repeated = resolveWithHistory("MATCH");
  ok(repeated.angleFitModifier < fresh.angleFitModifier, "same-wrestler repeated message did not wear thin");
  ok(repeated.crowdResponse! < fresh.crowdResponse!, "repeated message did not affect audience reception");
  for (const other of ["DIFFERENT_BEAT", "OTHER_SPEAKER", "OTHER_PROMOTION", "OLD", "DRAFT"] as const) {
    const outcome = resolveWithHistory(other);
    ok(outcome.angleFitModifier === fresh.angleFitModifier,
      `${other} was incorrectly penalised as an identical performed promo`);
  }
});

test("INTERVIEW freezes the booked topic, format and scripted walkout without creating a confrontation", () => {
  const setup = fixture(91610);
  const subject = setup.rosterIds[2]!;
  upsertDetailedShowDraft(setup.state, setup.planning, setup.promotion.id, 0, {
    draftId: "interview-show",
    promotionId: setup.promotion.id,
    targetDate: setup.targetDate,
    marketId: null,
    venueId: null,
    ticketStrategy: null,
    participantIds: setup.rosterIds.slice(0, 4),
    matches: [],
    championshipAssignments: [],
    segments: [{
      draftSegmentId: "interview-guest",
      type: "INTERVIEW",
      participantIds: [subject],
      programmeId: null,
      plannedLengthMinutes: 6,
      interviewFormat: "SIT_DOWN",
      interviewTopic: "CAREER_STORY",
      interviewResponse: "WALKOUT",
    }],
    runningOrder: [{ kind: "SEGMENT", refId: "interview-guest" }],
  });
  setup.state.events.push(completedEvent(setup));
  ok(recordResolvedShowSegments(setup.state, setup.planning) === 1, "interview not completed");
  const frozen = resolvedShowSegmentsForEvent(setup.state, setup.state.events[0]!.id)[0]!;
  ok(frozen.type === "INTERVIEW" && frozen.interviewTopic === "CAREER_STORY", "interview lost its topic");
  ok(frozen.interviewFormat === "SIT_DOWN" && frozen.interviewResponse === "WALKOUT",
    "World Lock rewrote the promoter's interview format or answer");
  ok(frozen.participantIds.length === 1 && frozen.participantIds[0] === subject,
    "interview invented a second wrestler or neutral host as a booked talent");
  ok(frozen.targetPersonId === null && frozen.challengeResponse === null && frozen.attackerPersonId === null,
    "interview generated a feud confrontation, challenge or attack");
  ok(recordResolvedShowSegments(setup.state, setup.planning) === 0, "interview duplicated under retry");
});

test("INTERVIEW rejects unsupported and partially specified responses, without changing existing bookings", () => {
  const setup = fixture(91611);
  const draft = {
    draftId: "invalid-interview",
    promotionId: setup.promotion.id,
    targetDate: setup.targetDate,
    marketId: null,
    venueId: null,
    ticketStrategy: null,
    participantIds: setup.rosterIds.slice(0, 4),
    matches: [],
    championshipAssignments: [],
    segments: [{
      draftSegmentId: "interview-guest",
      type: "INTERVIEW" as const,
      participantIds: [setup.rosterIds[2]!],
      programmeId: null,
      plannedLengthMinutes: 5,
      interviewFormat: "BACKSTAGE" as const,
      interviewTopic: "RECENT_FORM" as const,
      interviewResponse: "CANDID" as const,
    }],
  };
  upsertDetailedShowDraft(setup.state, setup.planning, setup.promotion.id, 0, draft);
  throwsContaining(() => upsertDetailedShowDraft(setup.state, setup.planning, setup.promotion.id, 1, {
    ...draft,
    segments: [{ ...draft.segments[0]!, interviewResponse: "RANDOM_BRAWL" as "CANDID" }],
  }), "supported format, topic");
  throwsContaining(() => upsertDetailedShowDraft(setup.state, setup.planning, setup.promotion.id, 1, {
    ...draft,
    segments: [{ ...draft.segments[0]!, interviewResponse: null }],
  }), "interview requires all three");
  ok(setup.planning.workspaces[0]!.detailedShowDrafts[0]!.segments![0]!.interviewResponse === "CANDID",
    "invalid interview attempt altered the stored scripted outcome");
});

test("INTERVIEW repetition counts only same-wrestler same-question and answer in completed recent promotion history", () => {
  function outcomeWithHistory(kind: "NONE" | "REPEAT" | "NEW_ANSWER" | "NEW_TOPIC" | "OTHER_GUEST" | "OTHER_PROMOTION" | "OLD" | "UNRESOLVED") {
    const setup = fixture(91612);
    setup.state.world.currentDate = { year: 1, week: 8, day: 1 };
    setup.targetDate = { year: 1, week: 8, day: 6 };
    const subject = setup.rosterIds[2]!;
    if (kind !== "NONE" && kind !== "UNRESOLVED") {
      setup.state.ledger.push({
        id: "prior-frozen-interview",
        worldId: setup.state.world.id,
        date: { year: 1, week: kind === "OLD" ? 1 : 7, day: 6 },
        order: 11020,
        type: "SHOW_SEGMENT_COMPLETED",
        significanceAtTime: "ROUTINE",
        historicalSignificance: "ROUTINE",
        entityIds: [setup.promotion.id, subject],
        payload: {
          promotionId: kind === "OTHER_PROMOTION" ? "rival-promotion" : setup.promotion.id,
          segmentType: "INTERVIEW",
          interviewTopic: kind === "NEW_TOPIC" ? "RECENT_FORM" : "CAREER_STORY",
          interviewResponse: kind === "NEW_ANSWER" ? "WALKOUT" : "CANDID",
          participantIds: kind === "OTHER_GUEST" ? setup.rosterIds[1]! : subject,
        },
      });
    }
    upsertDetailedShowDraft(setup.state, setup.planning, setup.promotion.id, 0, {
      draftId: "tested-interview",
      promotionId: setup.promotion.id,
      targetDate: setup.targetDate,
      marketId: null,
      venueId: null,
      ticketStrategy: null,
      participantIds: setup.rosterIds.slice(0, 4),
      matches: [],
      championshipAssignments: [],
      segments: [{
        draftSegmentId: "tested-interview",
        type: "INTERVIEW",
        interviewFormat: "SIT_DOWN",
        interviewTopic: "CAREER_STORY",
        interviewResponse: "CANDID",
        participantIds: [subject],
        programmeId: null,
        plannedLengthMinutes: 5,
      }],
    });
    setup.state.events.push(completedEvent(setup));
    recordResolvedShowSegments(setup.state, setup.planning);
    return resolvedShowSegmentsForEvent(setup.state, setup.state.events[0]!.id)[0]!;
  }
  const fresh = outcomeWithHistory("NONE");
  const repeated = outcomeWithHistory("REPEAT");
  ok(repeated.angleFitModifier < fresh.angleFitModifier, "repeated interview had no audience fatigue");
  ok(repeated.crowdResponse! < fresh.crowdResponse!, "repeating an identical interview did not affect crowd reception");
  for (const variant of ["NEW_ANSWER", "NEW_TOPIC", "OTHER_GUEST", "OTHER_PROMOTION", "OLD", "UNRESOLVED"] as const) {
    const current = outcomeWithHistory(variant);
    ok(current.angleFitModifier === fresh.angleFitModifier,
      `${variant} falsely counted as a repeat of the same interview`);
  }
});

test("victory laps require a verified prior completed win, never a scheduled finish or a defeat", () => {
  const setup = fixture(91620);
  setup.state.world.currentDate = { year: 1, week: 8, day: 1 };
  setup.targetDate = { year: 1, week: 8, day: 6 };
  const winner = setup.rosterIds[0]!;
  const opponent = setup.rosterIds[1]!;
  const draft = {
    draftId: "truthful-celebration",
    promotionId: setup.promotion.id,
    targetDate: setup.targetDate,
    marketId: null, venueId: null, ticketStrategy: null,
    participantIds: setup.rosterIds.slice(0, 4),
    matches: [],
    championshipAssignments: [],
    segments: [{
      draftSegmentId: "victory-lap",
      type: "CELEBRATION" as const,
      participantIds: [winner],
      programmeId: null,
      plannedLengthMinutes: 5,
      celebrationOccasion: "VICTORY_LAP" as const,
      celebrationEnding: "POSE" as const,
    }],
  };
  throwsContaining(
    () => upsertDetailedShowDraft(setup.state, setup.planning, setup.promotion.id, 0, draft),
    "actual completed win",
  );
  const earlier = completedEvent(setup);
  earlier.id = "real-earlier-victory";
  earlier.date = { year: 1, week: 7, day: 6 };
  earlier.status = "SCHEDULED";
  setup.state.events.push(earlier);
  const matchId = "completed-match-claim";
  setup.state.matches.push({
    id: matchId, worldId: setup.state.world.id, eventId: earlier.id, promotionId: setup.promotion.id,
    order: 1, type: "SINGLES", status: "SCHEDULED", intent: "COMPETITIVE",
    plannedLengthMinutes: 12, actualLengthMinutes: 0, intendedWinnerSide: "A",
    actualWinnerSide: null, finishChangedDueToInjury: false,
    executionQuality: 0, criticalRatingStars: 0, crowdResponse: 0,
  });
  setup.state.matchParticipants.push({
    id: "victory-lap-winner", worldId: setup.state.world.id,
    eventId: earlier.id, matchId, personId: winner, side: "A", won: true,
  }, {
    id: "victory-lap-loser", worldId: setup.state.world.id,
    eventId: earlier.id, matchId, personId: opponent, side: "B", won: false,
  });
  ok(!recentCompletedVictoryForCelebration(setup.state, setup.promotion.id, [winner], setup.targetDate),
    "an unfinished match with planned winner was treated as a real achievement");
  const match = setup.state.matches.find((entry) => entry.id === matchId)!;
  match.status = "COMPLETED";
  match.actualWinnerSide = "A";
  ok(!recentCompletedVictoryForCelebration(setup.state, setup.promotion.id, [winner], setup.targetDate),
    "a completed match on a scheduled show became factual history");
  earlier.status = "COMPLETED";
  ok(recentCompletedVictoryForCelebration(setup.state, setup.promotion.id, [winner], setup.targetDate),
    "a genuinely completed win wasn't recognised");
  ok(!recentCompletedVictoryForCelebration(setup.state, setup.promotion.id, [opponent], setup.targetDate),
    "defeated wrestler could celebrate a nonexistent victory");
  ok(!recentCompletedVictoryForCelebration(setup.state, setup.promotion.id, [winner, opponent], setup.targetDate),
    "two wrestlers on opposite sides were misrepresented as joint victors");
  upsertDetailedShowDraft(setup.state, setup.planning, setup.promotion.id, 0, draft);
  ok(setup.planning.workspaces[0]?.detailedShowDrafts[0]?.segments?.[0]?.celebrationOccasion === "VICTORY_LAP",
    "validated factual celebration was not saved");
  throwsContaining(() => upsertDetailedShowDraft(setup.state, setup.planning, setup.promotion.id, 1, {
    ...draft, segments: [{ ...draft.segments[0]!, participantIds: [opponent] }],
  }), "actual completed win");
  ok(!recentCompletedVictoryForCelebration(setup.state, "different-promotion", [winner], setup.targetDate),
    "another promotion could claim this victory");
  ok(recentCompletedVictoryForCelebration(setup.state, setup.promotion.id, [winner],
    { year: 1, week: 13, day: 6 }), "the six-week boundary incorrectly excluded a real victory");
  ok(!recentCompletedVictoryForCelebration(setup.state, setup.promotion.id, [winner],
    { year: 1, week: 15, day: 6 }), "old wins were never allowed to age out");
});

test("scripted celebrations resolve exactly once, retain the original ending and never award a title", () => {
  const setup = fixture(91621);
  upsertDetailedShowDraft(setup.state, setup.planning, setup.promotion.id, 0, {
    draftId: "kayfabe-celebration",
    promotionId: setup.promotion.id,
    targetDate: setup.targetDate,
    marketId: null, venueId: null, ticketStrategy: null,
    participantIds: setup.rosterIds.slice(0, 4),
    matches: [], championshipAssignments: [],
    segments: [{
      draftSegmentId: "fake-crown",
      type: "CELEBRATION",
      participantIds: [setup.rosterIds[2]!],
      programmeId: null,
      plannedLengthMinutes: 5,
      celebrationOccasion: "SELF_CORONATION",
      celebrationEnding: "TAUNT_RIVALS",
    }],
  });
  const beforeReigns = setup.state.championshipReigns?.length ?? 0;
  setup.state.events.push(completedEvent(setup));
  ok(recordResolvedShowSegments(setup.state, setup.planning) === 1, "celebration didn't resolve");
  const resolved = resolvedShowSegmentsForEvent(setup.state, setup.state.events[0]!.id)[0]!;
  ok(resolved.celebrationOccasion === "SELF_CORONATION" && resolved.celebrationEnding === "TAUNT_RIVALS",
    "celebration changed the player's exact scripted story");
  ok(recordResolvedShowSegments(setup.state, setup.planning) === 0, "celebration repeated on retry");
  ok((setup.state.championshipReigns?.length ?? 0) === beforeReigns,
    "kayfabe self-coronation illegally created an actual championship reign");
  throwsContaining(() => upsertDetailedShowDraft(setup.state, setup.planning, setup.promotion.id, 1, {
    draftId: "invalid-celebration",
    promotionId: setup.promotion.id,
    targetDate: setup.targetDate,
    marketId: null, venueId: null, ticketStrategy: null,
    participantIds: setup.rosterIds.slice(0, 4),
    matches: [], championshipAssignments: [],
    segments: [{
      draftSegmentId: "bad-celebration",
      type: "CELEBRATION",
      participantIds: [setup.rosterIds[2]!],
      programmeId: null, plannedLengthMinutes: 5,
      celebrationOccasion: "WON_WORLD_TITLE" as "SELF_CORONATION",
      celebrationEnding: "POSE",
    }],
  }), "unsupported occasion");
});

test("completed celebrations repeat only when wrestler, occasion, ending and promotion all match", () => {
  function run(prior: "NONE" | "SAME" | "OTHER_ENDING" | "OTHER_OCCASION" | "OTHER_WRESTLER" | "OTHER_PROMOTION" | "OLD" | "UNRESOLVED") {
    const setup = fixture(91622);
    setup.state.world.currentDate = { year: 1, week: 8, day: 1 };
    setup.targetDate = { year: 1, week: 8, day: 6 };
    const featured = setup.rosterIds[2]!;
    if (prior !== "NONE" && prior !== "UNRESOLVED") {
      setup.state.ledger.push({
        id: "previous-celebration",
        worldId: setup.state.world.id,
        date: { year: 1, week: prior === "OLD" ? 1 : 7, day: 6 },
        order: 9811,
        type: "SHOW_SEGMENT_COMPLETED",
        significanceAtTime: "ROUTINE", historicalSignificance: "ROUTINE",
        entityIds: [setup.promotion.id, featured],
        payload: {
          promotionId: prior === "OTHER_PROMOTION" ? "different-promotion" : setup.promotion.id,
          segmentType: "CELEBRATION",
          celebrationOccasion: prior === "OTHER_OCCASION" ? "SELF_CORONATION" : "FAN_APPRECIATION",
          celebrationEnding: prior === "OTHER_ENDING" ? "WALK_OFF" : "SALUTE_CROWD",
          participantIds: prior === "OTHER_WRESTLER" ? setup.rosterIds[1]! : featured,
        },
      });
    }
    upsertDetailedShowDraft(setup.state, setup.planning, setup.promotion.id, 0, {
      draftId: "repeat-celebration", promotionId: setup.promotion.id, targetDate: setup.targetDate,
      marketId: null, venueId: null, ticketStrategy: null,
      participantIds: setup.rosterIds.slice(0, 4),
      matches: [], championshipAssignments: [],
      segments: [{
        draftSegmentId: "repeat-beat",
        type: "CELEBRATION", participantIds: [featured],
        programmeId: null, plannedLengthMinutes: 5,
        celebrationOccasion: "FAN_APPRECIATION", celebrationEnding: "SALUTE_CROWD",
      }],
    });
    setup.state.events.push(completedEvent(setup));
    recordResolvedShowSegments(setup.state, setup.planning);
    return resolvedShowSegmentsForEvent(setup.state, setup.state.events[0]!.id)[0]!;
  }
  const fresh = run("NONE");
  const same = run("SAME");
  ok(same.angleFitModifier < fresh.angleFitModifier && same.crowdResponse! < fresh.crowdResponse!,
    "identical previous completed celebration did not wear thin");
  for (const kind of ["OTHER_ENDING", "OTHER_OCCASION", "OTHER_WRESTLER", "OTHER_PROMOTION", "OLD", "UNRESOLVED"] as const) {
    ok(run(kind).angleFitModifier === fresh.angleFitModifier, `${kind} falsely treated as repetition`);
  }
});

test("standalone segments become factual show history without inventing Programme activity", () => {
  const setup = fixture(9151);
  upsertDetailedShowDraft(setup.state, setup.planning, setup.promotion.id, 0, {
    draftId: "standalone-segment-show",
    promotionId: setup.promotion.id,
    targetDate: setup.targetDate,
    marketId: null,
    venueId: null,
    ticketStrategy: null,
    participantIds: setup.rosterIds.slice(0, 4),
    matches: [],
    championshipAssignments: [],
    segments: [{
      draftSegmentId: "standalone-segment-1",
      type: "INTERVIEW",
      participantIds: [setup.rosterIds[2]!],
      programmeId: null,
      plannedLengthMinutes: 5,
    }],
    runningOrder: [{ kind: "SEGMENT", refId: "standalone-segment-1" }],
  });
  setup.state.events.push(completedEvent(setup));
  const recorded = recordResolvedShowSegments(setup.state, setup.planning);
  const frozen = resolvedShowSegmentsForEvent(setup.state, setup.state.events[0]!.id);
  ok(recorded === 1 && frozen.length === 1, "standalone segment was not frozen as completed show history");
  ok(frozen[0]?.participantIds[0] === setup.rosterIds[2], "standalone segment lost its wrestler");
  ok(frozen[0]?.interviewFormat === null && frozen[0]?.interviewTopic === null
    && frozen[0]?.interviewResponse === null,
    "historical generic interview was retroactively given an invented scripted answer");
  ok(programmeActivities(setup.state, setup.programme.id).length === 0, "standalone segment invented Programme activity");
});

test("segment fatigue is neutral at ordinary levels and only hurts genuinely tired wrestlers", () => {
  const rested = fixture(9155);
  const restedPersonId = rested.rosterIds[2]!;
  const restedPerson = rested.state.people.find((person) => person.id === restedPersonId)!;
  restedPerson.fatigue = 24;
  upsertDetailedShowDraft(rested.state, rested.planning, rested.promotion.id, 0, {
    draftId: "rested-segment-show",
    promotionId: rested.promotion.id,
    targetDate: rested.targetDate,
    marketId: null,
    venueId: null,
    ticketStrategy: null,
    participantIds: rested.rosterIds.slice(0, 4),
    matches: [],
    championshipAssignments: [],
    segments: [{
      draftSegmentId: "rested-segment",
      type: "INTERVIEW",
      participantIds: [restedPersonId],
      programmeId: null,
      plannedLengthMinutes: 5,
    }],
    runningOrder: [{ kind: "SEGMENT", refId: "rested-segment" }],
  });
  rested.state.events.push(completedEvent(rested));
  recordResolvedShowSegments(rested.state, rested.planning);
  const restedOutcome = resolvedShowSegmentsForEvent(rested.state, rested.state.events[0]!.id)[0]!;
  ok(restedOutcome.fatigueModifier === 0, "ordinary fatigue still produced a negative segment-delivery modifier");

  const tired = fixture(9156);
  const tiredPersonId = tired.rosterIds[2]!;
  const tiredPerson = tired.state.people.find((person) => person.id === tiredPersonId)!;
  tiredPerson.fatigue = 70;
  upsertDetailedShowDraft(tired.state, tired.planning, tired.promotion.id, 0, {
    draftId: "tired-segment-show",
    promotionId: tired.promotion.id,
    targetDate: tired.targetDate,
    marketId: null,
    venueId: null,
    ticketStrategy: null,
    participantIds: tired.rosterIds.slice(0, 4),
    matches: [],
    championshipAssignments: [],
    segments: [{
      draftSegmentId: "tired-segment",
      type: "INTERVIEW",
      participantIds: [tiredPersonId],
      programmeId: null,
      plannedLengthMinutes: 5,
    }],
    runningOrder: [{ kind: "SEGMENT", refId: "tired-segment" }],
  });
  tired.state.events.push(completedEvent(tired));
  recordResolvedShowSegments(tired.state, tired.planning);
  const tiredOutcome = resolvedShowSegmentsForEvent(tired.state, tired.state.events[0]!.id)[0]!;
  ok(tiredOutcome.fatigueModifier < 0, "high fatigue did not hurt segment delivery");
});


test("TURN segment freezes its intent and changes promotion alignment only after explicit application", () => {
  const setup = fixture(9152);
  const personId = setup.rosterIds[0]!;
  setPromotionWrestlerAlignment(setup.state, setup.promotion.id, personId, "HEEL");
  upsertDetailedShowDraft(setup.state, setup.planning, setup.promotion.id, 0, {
    draftId: "turn-segment-show",
    promotionId: setup.promotion.id,
    targetDate: setup.targetDate,
    marketId: null,
    venueId: null,
    ticketStrategy: null,
    participantIds: setup.rosterIds.slice(0, 4),
    matches: [],
    championshipAssignments: [],
    segments: [{
      draftSegmentId: "turn-segment-1",
      type: "TURN",
      participantIds: [personId],
      programmeId: null,
      plannedLengthMinutes: 5,
      turnPersonId: personId,
      turnTargetAlignment: "FACE",
    }],
    runningOrder: [{ kind: "SEGMENT", refId: "turn-segment-1" }],
  });
  setup.state.events.push(completedEvent(setup));

  ok(recordResolvedShowSegments(setup.state, setup.planning) === 1, "turn segment did not resolve into show history");
  const frozen = resolvedShowSegmentsForEvent(setup.state, setup.state.events[0]!.id)[0]!;
  ok(frozen.type === "TURN" && frozen.turnPersonId === personId && frozen.turnTargetAlignment === "FACE", "turn intent was not frozen");
  ok(wrestlerAlignmentForPromotion(setup.state, setup.promotion.id, personId) === "HEEL", "freezing the segment applied the turn too early");

  ok(applyResolvedShowTurns(setup.state) === 1, "resolved turn was not applied");
  ok(wrestlerAlignmentForPromotion(setup.state, setup.promotion.id, personId) === "FACE", "resolved turn did not change promotion alignment");
  ok(applyResolvedShowTurns(setup.state) === 0, "turn retry applied twice");
  const changeEntry = setup.state.ledger.find((entry) => (
    entry.type === "PROMOTION_ALIGNMENT_CHANGED"
    && entry.payload.method === "TURN"
    && entry.payload.sourceSegmentId === "turn-segment-1"
  ));
  ok(changeEntry, "turn did not retain historical alignment-change evidence");
  ok(changeEntry?.date.day === setup.targetDate.day, "turn alignment history was not dated to the show itself");
});

test("BETRAYAL turn requires a valid target and records both people without duplicate alignment changes", () => {
  const setup = fixture(9166);
  const turner = setup.rosterIds[0]!;
  const betrayed = setup.rosterIds[1]!;
  setPromotionWrestlerAlignment(setup.state, setup.promotion.id, turner, "FACE");
  const betrayedOriginalAlignment = wrestlerAlignmentForPromotion(setup.state, setup.promotion.id, betrayed);
  const base = {
    draftId: "betrayal-show", promotionId: setup.promotion.id, targetDate: setup.targetDate,
    marketId: null, venueId: null, ticketStrategy: null,
    participantIds: setup.rosterIds.slice(0, 4), matches: [], championshipAssignments: [],
  };
  const turn = {
    draftSegmentId: "betrayal-slot",
    type: "TURN" as const,
    participantIds: [turner, betrayed],
    programmeId: setup.programme.id,
    plannedLengthMinutes: 7,
    turnPersonId: turner,
    turnTargetAlignment: "HEEL" as const,
    turnPresentation: "BETRAYAL" as const,
    betrayedPersonId: betrayed,
  };
  throwsContaining(() => upsertDetailedShowDraft(setup.state, setup.planning, setup.promotion.id, 0, {
    ...base, segments: [{ ...turn, betrayedPersonId: turner }],
  }), "distinct betrayed wrestler");
  throwsContaining(() => upsertDetailedShowDraft(setup.state, setup.planning, setup.promotion.id, 0, {
    ...base, segments: [{ ...turn, betrayedPersonId: setup.rosterIds[2] }],
  }), "distinct betrayed wrestler");
  throwsContaining(() => upsertDetailedShowDraft(setup.state, setup.planning, setup.promotion.id, 0, {
    ...base, segments: [{ ...turn, betrayedPersonId: null }],
  }), "distinct betrayed wrestler");
  upsertDetailedShowDraft(setup.state, setup.planning, setup.promotion.id, 0, { ...base, segments: [turn] });
  const stored = setup.planning.workspaces[0]!.detailedShowDrafts[0]!.segments![0]!;
  ok(stored.turnPresentation === "BETRAYAL" && stored.betrayedPersonId === betrayed, "betrayal intent lost during drafting");
  setup.state.events.push(completedEvent(setup));
  ok(recordResolvedShowSegments(setup.state, setup.planning) === 1, "betrayal segment not recorded");
  const resolved = resolvedShowSegmentsForEvent(setup.state, setup.state.events[0]!.id)[0]!;
  ok(resolved.turnPersonId === turner && resolved.betrayedPersonId === betrayed, "ledger lost betrayal direction");
  ok(resolved.turnPresentation === "BETRAYAL", "ledger lost turn presentation");
  ok(wrestlerAlignmentForPromotion(setup.state, setup.promotion.id, turner) === "FACE", "betrayal changed alignment before applying");
  ok(applyResolvedShowTurns(setup.state) === 1, "betrayal did not trigger alignment change");
  ok(wrestlerAlignmentForPromotion(setup.state, setup.promotion.id, turner) === "HEEL", "betrayer did not turn heel");
  ok(applyResolvedShowTurns(setup.state) === 0, "betrayal applied twice");
  ok(wrestlerAlignmentForPromotion(setup.state, setup.promotion.id, betrayed) === betrayedOriginalAlignment,
    "betrayal must not turn the victim");
});

test("Programme segments remain planned until their show has completed", () => {
  const setup = fixture(9143);
  addSegmentDraft(setup);
  setup.state.events.push(completedEvent(setup, "SCHEDULED"));
  const recorded = recordResolvedProgrammeSegments(setup.state, setup.planning);
  ok(recorded === 0, `scheduled show recorded ${recorded} Programme segments before resolution`);
  ok(programmeActivities(setup.state, setup.programme.id).length === 0, "planned segment leaked into factual Programme history");
});

test("completed Programme segments become factual history once and contribute to Heat", () => {
  const setup = fixture(9144);
  addSegmentDraft(setup);
  setup.state.events.push(completedEvent(setup));

  const first = recordResolvedProgrammeSegments(setup.state, setup.planning);
  const second = recordResolvedProgrammeSegments(setup.state, setup.planning);
  const activities = programmeActivities(setup.state, setup.programme.id);
  const signals = evaluateProgrammeSignals(setup.state, setup.programme);

  ok(first === 1, `expected one completed Programme segment, recorded ${first}`);
  ok(second === 0, `retry recorded ${second} duplicate Programme segments`);
  ok(activities.length === 1 && activities[0]?.kind === "SEGMENT", "resolved segment was not stored as Programme activity");
  ok(activities[0]?.eventId === setup.state.events[0]?.id, "resolved segment did not retain its event link");
  ok(setup.programme.segmentCount === 1 && setup.programme.activityCount === 1, "Programme counters did not record the segment exactly once");
  const frozen = resolvedShowSegmentsForEvent(setup.state, setup.state.events[0]!.id)[0]!;
  ok(frozen.impact !== null, "resolved Programme segment did not freeze an impact score");
  ok(signals.averageRecentImpact === frozen.impact, "Programme Heat ignored the resolved segment quality");
  ok(signals.heat !== null && signals.heat > 30, `resolved segment did not establish meaningful Programme heat: ${signals.heat}`);
  ok(signals.repetition === 0, `first Programme segment should not create repetition, found ${signals.repetition}`);
});

console.log(`\nProgramme segment tests: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exitCode = 1;
