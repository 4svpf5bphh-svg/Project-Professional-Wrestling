declare const process: { exitCode?: number };

import { DEFAULT_RULESET } from "../packages/config/src/default-ruleset.js";
import type {
  Match,
  MatchIntent,
  MatchStyleProfile,
  WrestlingEvent,
  WorldState,
} from "../packages/domain/src/types.js";
import {
  applyCurrentWeekShowFlow,
  changePromotionWrestlerAlignment,
  createWorld,
  evaluateShowFlow,
  setPromotionWrestlerAlignment,
  setWrestlerAlignment,
  setActualMatchFinish,
  wrestlerAlignment,
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

function fixture(seed: number): {
  state: WorldState;
  event: WrestlingEvent;
  promotionId: string;
  personIds: string[];
} {
  const state = createWorld(seed, DEFAULT_RULESET);
  const promotion = state.promotions[0]!;
  const market = state.markets.find((candidate) => candidate.id === promotion.homeMarketId) ?? state.markets[0]!;
  const venue = state.venues.find((candidate) => candidate.marketId === market.id) ?? state.venues[0]!;
  const event: WrestlingEvent = {
    id: `show-flow-event-${seed}`,
    worldId: state.world.id,
    promotionId: promotion.id,
    marketId: market.id,
    venueId: venue.id,
    date: { ...state.world.currentDate, day: 6 },
    type: "REGULAR",
    status: "COMPLETED",
    ticketStrategy: "STANDARD",
    expectedDemand: 1000,
    attendance: 900,
    ticketYield: 40,
    gateRevenue: 36000,
    totalCost: 25000,
    netResult: 11000,
    eventImportance: 58,
    matchCount: 0,
    averageMatchRating: 3,
    bestMatchRating: 3,
    crowdResponse: 70,
  };
  return {
    state,
    event,
    promotionId: promotion.id,
    personIds: state.people.slice(0, 8).map((person) => person.id),
  };
}

function completedMatch(
  state: WorldState,
  event: WrestlingEvent,
  id: string,
  order: number,
  intent: MatchIntent,
  crowdResponse = 70,
): Match {
  return {
    id,
    worldId: state.world.id,
    eventId: event.id,
    promotionId: event.promotionId,
    order,
    type: "SINGLES",
    status: "COMPLETED",
    intent,
    plannedLengthMinutes: 15,
    actualLengthMinutes: 15,
    intendedWinnerSide: "A",
    actualWinnerSide: "A",
    finishChangedDueToInjury: false,
    executionQuality: 70,
    criticalRatingStars: 3.25,
    crowdResponse,
  };
}

function attachSinglesParticipants(
  state: WorldState,
  event: WrestlingEvent,
  match: Match,
  personAId: string,
  personBId: string,
): void {
  state.matchParticipants.push(
    {
      id: `${match.id}:a`,
      worldId: state.world.id,
      matchId: match.id,
      eventId: event.id,
      personId: personAId,
      side: "A",
      won: true,
    },
    {
      id: `${match.id}:b`,
      worldId: state.world.id,
      matchId: match.id,
      eventId: event.id,
      personId: personBId,
      side: "B",
      won: false,
    },
  );
}

function addMatchLedger(state: WorldState, event: WrestlingEvent, match: Match, order: number): void {
  state.ledger.push({
    id: `${match.id}:ledger`,
    worldId: state.world.id,
    date: { ...event.date },
    order,
    type: "MATCH_COMPLETED",
    significanceAtTime: "ROUTINE",
    historicalSignificance: "ROUTINE",
    entityIds: [match.id, event.id],
    payload: { crowd: match.crowdResponse },
  });
}

test("a card that builds toward intensity outperforms one that burns hot then finishes flat", () => {
  const { state, event, personIds } = fixture(84101);
  const story = completedMatch(state, event, "flow-story", 1, "STORY");
  const highRisk = completedMatch(state, event, "flow-risk", 2, "HIGH_RISK");
  const epic = completedMatch(state, event, "flow-epic", 3, "EPIC");
  attachSinglesParticipants(state, event, story, personIds[0]!, personIds[1]!);
  attachSinglesParticipants(state, event, highRisk, personIds[2]!, personIds[3]!);
  attachSinglesParticipants(state, event, epic, personIds[4]!, personIds[5]!);
  for (const personId of personIds.slice(0, 6)) {
    const person = state.people.find((candidate) => candidate.id === personId)!;
    setWrestlerAlignment(person, "TWEENER");
  }

  const wellBuilt = evaluateShowFlow(state, event, [story, highRisk, epic]);
  const burnedThenFlat = evaluateShowFlow(state, event, [
    { ...story, order: 3 },
    { ...highRisk, order: 2 },
    { ...epic, order: 1 },
  ]);
  ok(
    wellBuilt.crowdResponse > burnedThenFlat.crowdResponse + 0.5,
    `well-built flow ${wellBuilt.crowdResponse} should beat burned/flat flow ${burnedThenFlat.crowdResponse}`,
  );
  ok(wellBuilt.matches.at(-1)?.pacingReason === "BACK_TO_BACK_INTENSITY", "high-intensity closer did not retain its dominant fatigue signal");
  ok(burnedThenFlat.matches.at(-1)?.pacingReason === "FLAT_CLOSER", "flat closer did not retain an explainable pacing reason");
});

test("styled show flow uses six-dimensional similarity instead of legacy Intent repetition", () => {
  const { state, event, personIds } = fixture(84108);
  const sharedStyle: MatchStyleProfile = {
    competitiveness: 70,
    technical: 72,
    story: 55,
    intensity: 62,
    risk: 28,
    epic: 58,
  };
  const first = { ...completedMatch(state, event, "style-repeat-a", 1, "COMPETITIVE", 70), style: { ...sharedStyle } };
  const second = { ...completedMatch(state, event, "style-repeat-b", 2, "EPIC", 70), style: { ...sharedStyle } };
  attachSinglesParticipants(state, event, first, personIds[0]!, personIds[1]!);
  attachSinglesParticipants(state, event, second, personIds[2]!, personIds[3]!);
  for (const personId of personIds.slice(0, 4)) {
    setWrestlerAlignment(state.people.find((person) => person.id === personId)!, "TWEENER");
  }

  const evaluation = evaluateShowFlow(state, event, [first, second]);
  ok(evaluation.matches[1]?.pacingReason === "REPEATED_STYLE", "near-identical explicit styles were not recognised as repetition");
  ok(evaluation.matches[1]?.pacingModifier < 0, "repeated explicit style did not cost crowd flow");

  const changed = {
    ...second,
    style: {
      competitiveness: 45,
      technical: 35,
      story: 82,
      intensity: 35,
      risk: 10,
      epic: 32,
    },
  };
  const varied = evaluateShowFlow(state, event, [first, changed]);
  ok(varied.matches[1]?.pacingReason !== "REPEATED_STYLE", "meaningfully different style was still treated as repetition");
});

test("styled intensity ignores the legacy Intent label while legacy repetition remains unchanged", () => {
  const { state, event, personIds } = fixture(84109);
  const style: MatchStyleProfile = {
    competitiveness: 65,
    technical: 60,
    story: 50,
    intensity: 80,
    risk: 50,
    epic: 75,
  };
  const styledCompetitive = { ...completedMatch(state, event, "style-intent-a", 1, "COMPETITIVE", 70), style: { ...style } };
  const styledProtective = { ...completedMatch(state, event, "style-intent-b", 1, "PROTECTIVE", 70), style: { ...style } };
  attachSinglesParticipants(state, event, styledCompetitive, personIds[0]!, personIds[1]!);
  attachSinglesParticipants(state, event, styledProtective, personIds[2]!, personIds[3]!);
  for (const personId of personIds.slice(0, 4)) {
    setWrestlerAlignment(state.people.find((person) => person.id === personId)!, "TWEENER");
  }
  const competitiveFlow = evaluateShowFlow(state, event, [styledCompetitive]);
  const protectiveFlow = evaluateShowFlow(state, event, [styledProtective]);
  ok(
    competitiveFlow.matches[0]?.pacingModifier === protectiveFlow.matches[0]?.pacingModifier,
    "legacy Intent still changed pacing for an explicit style",
  );
  ok(
    competitiveFlow.matches[0]?.pacingReason === protectiveFlow.matches[0]?.pacingReason,
    "legacy Intent still changed pacing explanation for an explicit style",
  );

  const legacyA = completedMatch(state, event, "legacy-repeat-a", 1, "COMPETITIVE", 70);
  const legacyB = completedMatch(state, event, "legacy-repeat-b", 2, "COMPETITIVE", 70);
  attachSinglesParticipants(state, event, legacyA, personIds[4]!, personIds[5]!);
  attachSinglesParticipants(state, event, legacyB, personIds[6]!, personIds[7]!);
  const legacyFlow = evaluateShowFlow(state, event, [legacyA, legacyB]);
  ok(legacyFlow.matches[1]?.pacingReason === "REPEATED_INTENT", "legacy repeated Intent behaviour changed");
});

test("face versus heel clarity adds a modest emotional hook without becoming match quality", () => {
  const { state, event, personIds } = fixture(84102);
  const match = completedMatch(state, event, "alignment-hook", 1, "COMPETITIVE", 68);
  attachSinglesParticipants(state, event, match, personIds[0]!, personIds[1]!);
  const a = state.people.find((person) => person.id === personIds[0])!;
  const b = state.people.find((person) => person.id === personIds[1])!;
  setWrestlerAlignment(a, "FACE");
  setWrestlerAlignment(b, "HEEL");
  const clear = evaluateShowFlow(state, event, [match]);
  setWrestlerAlignment(b, "FACE");
  const sameSide = evaluateShowFlow(state, event, [match]);

  ok(clear.crowdResponse > sameSide.crowdResponse + 1.5, "face/heel clarity did not create the intended modest crowd edge");
  ok(clear.matches[0]?.alignmentReason === "FACE_HEEL_CLARITY", "alignment edge did not retain its reason");
  ok(sameSide.matches[0]?.alignmentReason === "SAME_ALIGNMENT", "same-side matchup did not retain its reason");
  ok(match.crowdResponse === 68, "show-flow evaluation rewrote the underlying match crowd response");
});

test("promotion-specific alignment drives crowd-flow interpretation", () => {
  const { state, event, promotionId, personIds } = fixture(84105);
  const match = completedMatch(state, event, "promotion-alignment-hook", 1, "COMPETITIVE", 68);
  attachSinglesParticipants(state, event, match, personIds[0]!, personIds[1]!);
  const a = state.people.find((person) => person.id === personIds[0])!;
  const b = state.people.find((person) => person.id === personIds[1])!;
  setWrestlerAlignment(a, "HEEL");
  setWrestlerAlignment(b, "HEEL");

  const baseline = evaluateShowFlow(state, event, [match]);
  ok(baseline.matches[0]?.alignmentReason === "SAME_ALIGNMENT", "baseline alignment setup was not same-side");

  setPromotionWrestlerAlignment(state, promotionId, a.id, "FACE");
  const promoted = evaluateShowFlow(state, event, [match]);
  ok(promoted.matches[0]?.alignmentReason === "FACE_HEEL_CLARITY", "promotion alignment override did not reach show flow");
  ok(promoted.crowdResponse > baseline.crowdResponse + 1.5, "promotion alignment override did not change crowd interpretation");
  ok(
    wrestlerAlignment(a, state.world.seed) === "HEEL" && wrestlerAlignment(b, state.world.seed) === "HEEL",
    "promotion alignment override rewrote global wrestler alignment",
  );
});

test("unexplained or repeated alignment changes reduce future crowd confidence", () => {
  const { state, event, promotionId, personIds } = fixture(84106);
  const match = completedMatch(state, event, "alignment-volatility-hook", 1, "COMPETITIVE", 68);
  attachSinglesParticipants(state, event, match, personIds[0]!, personIds[1]!);
  const a = state.people.find((person) => person.id === personIds[0])!;
  const b = state.people.find((person) => person.id === personIds[1])!;
  setPromotionWrestlerAlignment(state, promotionId, a.id, "FACE");
  setPromotionWrestlerAlignment(state, promotionId, b.id, "HEEL");
  const stable = evaluateShowFlow(state, event, [match]);

  changePromotionWrestlerAlignment(state, promotionId, a.id, "TWEENER", { method: "OFFSCREEN_SWITCH" });
  setPromotionWrestlerAlignment(state, promotionId, a.id, "FACE");
  const confused = evaluateShowFlow(state, event, [match]);

  ok(stable.matches[0]?.alignmentReason === "FACE_HEEL_CLARITY", "stable fixture did not begin with clear alignment");
  ok(confused.matches[0]?.alignmentReason === "ALIGNMENT_VOLATILITY", "unexplained switch did not surface crowd confusion");
  ok((confused.matches[0]?.alignmentBaseModifier ?? 0) > 0, "clear alignment base was lost when volatility existed");
  ok((confused.matches[0]?.alignmentVolatilityModifier ?? 0) < 0, "alignment volatility was not preserved as a negative component");
  ok(
    Math.abs(
      (confused.matches[0]?.alignmentBaseModifier ?? 0)
      + (confused.matches[0]?.alignmentVolatilityModifier ?? 0)
      - (confused.matches[0]?.alignmentModifier ?? 0)
    ) < 0.01,
    "split alignment components no longer equal the net modifier",
  );
  ok(confused.crowdResponse < stable.crowdResponse - 0.5, "alignment volatility did not reduce crowd response");
});

test("resolved segment crowd contributes to the overall show without rewriting match crowd", () => {
  const { state, event, personIds } = fixture(84107);
  const match = completedMatch(state, event, "segment-flow-hook", 1, "COMPETITIVE", 60);
  attachSinglesParticipants(state, event, match, personIds[0]!, personIds[1]!);
  const withoutSegment = evaluateShowFlow(state, event, [match]);

  state.ledger.push({
    id: "segment-flow-ledger",
    worldId: state.world.id,
    date: { ...event.date },
    order: 999,
    type: "SHOW_SEGMENT_COMPLETED",
    significanceAtTime: "ROUTINE",
    historicalSignificance: "ROUTINE",
    entityIds: [event.id, event.promotionId, personIds[0]!],
    payload: {
      eventId: event.id,
      promotionId: event.promotionId,
      sourceDraftId: "segment-flow-draft",
      draftSegmentId: "segment-flow-segment",
      slotOrder: 2,
      segmentType: "PROMO",
      participantIds: personIds[0]!,
      programmeId: null,
      plannedLengthMinutes: 5,
      turnPersonId: null,
      turnTargetAlignment: null,
      segmentExecutionQuality: 92,
      segmentCrowdResponse: 92,
      segmentImpact: 90,
      segmentOutcomeBand: "HOT",
      segmentProgrammeModifier: 0,
      segmentFatigueModifier: 0,
      segmentMoraleModifier: 0,
      segmentAlignmentVolatilityModifier: 0,
    },
  });
  const withSegment = evaluateShowFlow(state, event, [match]);

  ok(withSegment.matches[0]?.adjustedCrowdResponse === withoutSegment.matches[0]?.adjustedCrowdResponse, "segment outcome rewrote the match's own crowd score");
  ok(withSegment.crowdResponse > withoutSegment.crowdResponse + 5, "hot segment did not lift the overall show crowd response");
});

test("hot fresh Programmes help while repetition can exhaust the same story", () => {
  const { state, event, promotionId, personIds } = fixture(84103);
  const match = completedMatch(state, event, "programme-hook", 1, "STORY", 70);
  attachSinglesParticipants(state, event, match, personIds[0]!, personIds[1]!);
  for (const personId of personIds.slice(0, 2)) {
    const person = state.people.find((candidate) => candidate.id === personId)!;
    setWrestlerAlignment(person, "TWEENER");
  }
  state.programmes ??= [];
  state.programmeActivities ??= [];
  state.programmes.push({
    id: "show-flow-programme",
    worldId: state.world.id,
    promotionId,
    status: "ACTIVE",
    sideA: [{ kind: "PERSON", entityId: personIds[0]! }],
    sideB: [{ kind: "PERSON", entityId: personIds[1]! }],
    championshipId: null,
    startedDate: { ...state.world.currentDate },
    endedDate: null,
    heat: 85,
    repetition: 5,
    activityCount: 3,
    matchCount: 2,
    segmentCount: 1,
    sideAWins: 1,
    sideBWins: 1,
    draws: 0,
    lastActivityDate: { ...state.world.currentDate },
  });
  state.programmeActivities.push({
    id: "show-flow-programme-activity",
    worldId: state.world.id,
    promotionId,
    programmeId: "show-flow-programme",
    date: { ...event.date },
    kind: "MATCH",
    participantEntityIds: [personIds[0]!, personIds[1]!],
    eventId: event.id,
    matchId: match.id,
    winnerSide: "A",
  });

  const fresh = evaluateShowFlow(state, event, [match]);
  state.programmes[0]!.repetition = 95;
  const exhausted = evaluateShowFlow(state, event, [match]);
  ok(fresh.crowdResponse > exhausted.crowdResponse + 2.5, "Programme repetition did not meaningfully offset hot-story investment");
  ok(fresh.matches[0]?.programmeReason === "HOT_PROGRAMME", "fresh hot Programme did not retain its crowd reason");
  ok(exhausted.matches[0]?.programmeReason === "PROGRAMME_REPETITION", "overexposed Programme did not retain its crowd reason");
});

test("weekly show-flow freezes exact historical evidence and remains retry-safe", () => {
  const { state, event, personIds } = fixture(84104);
  const first = completedMatch(state, event, "apply-flow-a", 1, "STORY", 62);
  const second = completedMatch(state, event, "apply-flow-b", 2, "EPIC", 78);
  attachSinglesParticipants(state, event, first, personIds[0]!, personIds[1]!);
  attachSinglesParticipants(state, event, second, personIds[2]!, personIds[3]!);
  setWrestlerAlignment(state.people.find((person) => person.id === personIds[0])!, "FACE");
  setWrestlerAlignment(state.people.find((person) => person.id === personIds[1])!, "HEEL");
  setWrestlerAlignment(state.people.find((person) => person.id === personIds[2])!, "FACE");
  setWrestlerAlignment(state.people.find((person) => person.id === personIds[3])!, "HEEL");
  state.events.push(event);
  state.matches.push(first, second);
  event.matchCount = 2;
  event.crowdResponse = 70;
  addMatchLedger(state, event, first, 997);
  addMatchLedger(state, event, second, 998);
  state.ledger.push({
    id: "show-flow-ledger",
    worldId: state.world.id,
    date: { ...event.date },
    order: 999,
    type: "EVENT_COMPLETED",
    significanceAtTime: "ROUTINE",
    historicalSignificance: "ROUTINE",
    entityIds: [event.id, event.promotionId],
    payload: { crowdResponse: 70 },
  });
  const beforeMatches = JSON.stringify(state.matches);

  ok(applyCurrentWeekShowFlow(state) === 1, "current show was not evaluated");
  const firstCrowd = event.crowdResponse;
  const eventLedger = state.ledger.find((entry) => entry.id === "show-flow-ledger")!;
  const secondMatchLedger = state.ledger.find((entry) => entry.id === `${second.id}:ledger`)!;
  ok(eventLedger.payload.showFlowFrozen === true, "event ledger did not freeze show-flow history");
  ok(typeof eventLedger.payload.showFlowBaseCrowdResponse === "number", "event ledger did not retain the pre-flow crowd baseline");
  ok(eventLedger.payload.showFlowAdjustment !== undefined, "event ledger did not retain show-flow adjustment");
  ok(secondMatchLedger.payload.showFlowPacingReason === "BIG_CLOSER", "match ledger did not retain pacing reason");
  ok(secondMatchLedger.payload.showFlowAdjustedCrowd !== undefined, "match ledger did not retain adjusted crowd evidence");

  setWrestlerAlignment(state.people.find((person) => person.id === personIds[2])!, "HEEL");
  event.crowdResponse = 1;
  ok(applyCurrentWeekShowFlow(state) === 1, "frozen retry did not recognise the same show");
  ok(event.crowdResponse === firstCrowd, "frozen show-flow retry reinterpreted historical crowd context");
  ok(JSON.stringify(state.matches) === beforeMatches, "show-flow application mutated resolved match facts");
});


test("a heel cheating a babyface creates useful crowd heat without rewriting match quality", () => {
  const { state, event, personIds } = fixture(84221);
  const match = completedMatch(state, event, "heel-dirty-finish", 1, "STORY", 63);
  attachSinglesParticipants(state, event, match, personIds[0]!, personIds[1]!);
  setWrestlerAlignment(state.people.find((person) => person.id === personIds[0])!, "HEEL");
  setWrestlerAlignment(state.people.find((person) => person.id === personIds[1])!, "FACE");
  match.finishCheaterPersonId = personIds[0]!;
  setActualMatchFinish(match, "FOREIGN_OBJECT");
  const dirty = evaluateShowFlow(state, event, [match]);
  ok(dirty.matches[0]?.finishModifier === 1.8, "fresh heel foreign-object win was not good heat");
  ok(dirty.matches[0]?.finishReason === "HEEL_CHEATING_HEAT", "heel crowd context was not explained");
  const quality = match.criticalRatingStars;
  const base = match.crowdResponse;
  setActualMatchFinish(match, "INJURY_STOPPAGE");
  const stopped = evaluateShowFlow(state, event, [match]);
  ok(stopped.matches[0]?.finishModifier === 0 && stopped.matches[0]?.finishReason === null,
    "an injury stoppage retained nonexistent cheating heat");
  ok(dirty.crowdResponse > stopped.crowdResponse, "heel cheating had no crowd-flow effect");
  ok(match.criticalRatingStars === quality && match.crowdResponse === base,
    "show-flow reaction overwrote the underlying performance and crowd score");
});

test("babyface cheating hurts the response even if the booked side wins", () => {
  const { state, event, personIds } = fixture(84222);
  const match = completedMatch(state, event, "face-dirty-win", 1, "STORY");
  attachSinglesParticipants(state, event, match, personIds[0]!, personIds[1]!);
  setWrestlerAlignment(state.people.find((person) => person.id === personIds[0])!, "FACE");
  setWrestlerAlignment(state.people.find((person) => person.id === personIds[1])!, "HEEL");
  match.finishCheaterPersonId = personIds[0]!;
  setActualMatchFinish(match, "FOREIGN_OBJECT");
  const dirty = evaluateShowFlow(state, event, [match]);
  ok(dirty.matches[0]?.finishModifier === -1.3, "babyface cheating created an unearned crowd bonus");
  ok(dirty.matches[0]?.finishReason === "FACE_CHEATING_BACKLASH", "face confusion was not explained");
  match.finishCheaterPersonId = personIds[1]!;
  ok(evaluateShowFlow(state, event, [match]).matches[0]?.finishModifier === 0,
    "wrong-side wrestler generated an invented crowd response");
});

test("repeating the identical dirty finish against the same opponent only erodes its extra lift", () => {
  const { state, event, personIds } = fixture(84223);
  event.date = { year: 1, week: 4, day: 6 };
  const current = completedMatch(state, event, "repeat-current", 1, "STORY", 67);
  attachSinglesParticipants(state, event, current, personIds[0]!, personIds[1]!);
  setWrestlerAlignment(state.people.find((person) => person.id === personIds[0])!, "HEEL");
  setWrestlerAlignment(state.people.find((person) => person.id === personIds[1])!, "FACE");
  current.finishCheaterPersonId = personIds[0]!;
  setActualMatchFinish(current, "FOREIGN_OBJECT");
  const fresh = evaluateShowFlow(state, event, [current]);
  for (let prior = 0; prior < 2; prior += 1) {
    const oldEvent = { ...event, id: `repeat-prior-event-${prior}`, date: { year: 1, week: prior + 2, day: 6 } };
    const match = completedMatch(state, oldEvent, `repeat-prior-${prior}`, 1, "STORY", 67);
    match.finishCheaterPersonId = personIds[0]!;
    setActualMatchFinish(match, "FOREIGN_OBJECT");
    state.events.push(oldEvent);
    state.matches.push(match);
    attachSinglesParticipants(state, oldEvent, match, personIds[0]!, personIds[1]!);
  }
  const familiar = evaluateShowFlow(state, event, [current]);
  ok(fresh.matches[0]?.finishModifier === 1.8, "fresh dirty finish lost its intended heel response");
  ok(familiar.matches[0]?.finishRepeatCount === 2, "same completed finish wasn't counted in history");
  ok(familiar.matches[0]?.finishModifier === 0 && familiar.matches[0]?.finishReason === "DIRTY_FINISH_FAMILIAR",
    "repeated cheating generated a second negative repetition penalty");
  ok(familiar.matches[0]?.programmeModifier === fresh.matches[0]?.programmeModifier,
    "finish repetition interfered with the separate Programme repetition system");
  ok(evaluateShowFlow(state, event, [current]).crowdResponse === familiar.crowdResponse,
    "recalculating finish response changed its outcome");
});

test("a DQ credits the losing cheater, not the innocent winner", () => {
  const { state, event, personIds } = fixture(84224);
  const match = completedMatch(state, event, "dq-caught", 1, "STORY");
  attachSinglesParticipants(state, event, match, personIds[0]!, personIds[1]!);
  setWrestlerAlignment(state.people.find((person) => person.id === personIds[0])!, "FACE");
  setWrestlerAlignment(state.people.find((person) => person.id === personIds[1])!, "HEEL");
  match.finishCheaterPersonId = personIds[1]!;
  setActualMatchFinish(match, "DISQUALIFICATION");
  ok(evaluateShowFlow(state, event, [match]).matches[0]?.finishModifier === 1.2,
    "the caught heel didn't generate a modest DQ story reaction");
  match.finishCheaterPersonId = personIds[0]!;
  ok(evaluateShowFlow(state, event, [match]).matches[0]?.finishModifier === 0,
    "the winner was incorrectly blamed for the DQ");
});

console.log(`\\nShow-flow tests: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exitCode = 1;
