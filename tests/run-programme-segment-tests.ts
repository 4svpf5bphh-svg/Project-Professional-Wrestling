declare const process: { exitCode?: number };

import { createWorldPlanningState, upsertDetailedShowDraft } from "../packages/application/src/planning.js";
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
