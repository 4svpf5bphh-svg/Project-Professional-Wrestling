declare const process: { exitCode?: number };

import {
  buildPlayerShowHistory,
  buildPlayerWorldResultsView,
  claimIndependentPromotionForPlayer,
  createWorldCommandState,
  createWorldOwnershipState,
  createWorldPlanningState,
  createWorldRuntimeState,
  joinPlayerToWorld,
  setPostShowFollowUpCommand,
  eligiblePostShowProgrammeIds,
  normalizeWorldPlanningState,
  validateWorldPlanningStateShape,
  type ApplicationWorldAggregate,
} from "../packages/application/src/index.js";
import { DEFAULT_RULESET } from "../packages/config/src/default-ruleset.js";
import { createWorld, setWrestlerAlignment } from "../packages/sim-core/src/index.js";
import { setActualMatchFinish } from "../packages/sim-core/src/match-finishes.js";
import { showResultHighlights } from "../packages/web-adapter/src/results-highlights.js";

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

function twoPlayerFixture(seed: number): {
  aggregate: ApplicationWorldAggregate;
  promotionAId: string;
  promotionBId: string;
} {
  const state = createWorld(seed, DEFAULT_RULESET);
  const ownership = createWorldOwnershipState(state.world.id, 2);
  joinPlayerToWorld(ownership, "player-a", state.world.currentDate);
  joinPlayerToWorld(ownership, "player-b", state.world.currentDate);
  const promotions = state.promotions.filter((promotion) => (
    promotion.controllerType === "AI"
    && promotion.tier === "INDEPENDENT"
    && promotion.lifecycle === "ACTIVE"
  )).slice(0, 2);
  if (promotions.length < 2) throw new Error("results fixture needs two Independent promotions");
  claimIndependentPromotionForPlayer(state, ownership, "player-a", promotions[0]!.id);
  claimIndependentPromotionForPlayer(state, ownership, "player-b", promotions[1]!.id);

  const people = state.people.filter((person) => person.status === "ACTIVE").slice(0, 4);
  if (people.length < 4) throw new Error("results fixture needs four active wrestlers");
  const marketA = state.markets.find((market) => market.id === promotions[0]!.homeMarketId) ?? state.markets[0]!;
  const marketB = state.markets.find((market) => market.id === promotions[1]!.homeMarketId) ?? state.markets[1]!;
  const venueA = state.venues.find((venue) => venue.marketId === marketA.id) ?? state.venues[0]!;
  const venueB = state.venues.find((venue) => venue.marketId === marketB.id) ?? state.venues[1]!;
  const dateA = { year: 1, week: 2, day: 6 };
  const dateB = { year: 1, week: 2, day: 5 };

  state.events.push({
    id: "results-event-a",
    worldId: state.world.id,
    promotionId: promotions[0]!.id,
    marketId: marketA.id,
    venueId: venueA.id,
    date: dateA,
    type: "REGULAR",
    status: "COMPLETED",
    ticketStrategy: "STANDARD",
    expectedDemand: 400,
    attendance: 375,
    ticketYield: 28,
    gateRevenue: 10_500,
    totalCost: 8_000,
    netResult: 2_500,
    eventImportance: 45,
    matchCount: 1,
    averageMatchRating: 3.75,
    bestMatchRating: 3.75,
    crowdResponse: 71,
  });
  state.events.push({
    id: "results-event-b",
    worldId: state.world.id,
    promotionId: promotions[1]!.id,
    marketId: marketB.id,
    venueId: venueB.id,
    date: dateB,
    type: "REGULAR",
    status: "COMPLETED",
    ticketStrategy: "STANDARD",
    expectedDemand: 300,
    attendance: 290,
    ticketYield: 25,
    gateRevenue: 7_250,
    totalCost: 7_500,
    netResult: -250,
    eventImportance: 40,
    matchCount: 1,
    averageMatchRating: 3.1,
    bestMatchRating: 3.1,
    crowdResponse: 61,
  });

  state.matches.push({
    id: "results-match-a",
    worldId: state.world.id,
    eventId: "results-event-a",
    promotionId: promotions[0]!.id,
    order: 1,
    type: "SINGLES",
    status: "COMPLETED",
    intent: "COMPETITIVE",
    plannedLengthMinutes: 15,
    actualLengthMinutes: 14,
    intendedWinnerSide: "A",
    actualWinnerSide: "A",
    finishChangedDueToInjury: false,
    executionQuality: 77,
    criticalRatingStars: 3.75,
    crowdResponse: 72,
  });
  state.matches.push({
    id: "results-match-b",
    worldId: state.world.id,
    eventId: "results-event-b",
    promotionId: promotions[1]!.id,
    order: 1,
    type: "SINGLES",
    status: "COMPLETED",
    intent: "SHOWCASE",
    plannedLengthMinutes: 12,
    actualLengthMinutes: 11,
    intendedWinnerSide: "B",
    actualWinnerSide: "B",
    finishChangedDueToInjury: false,
    executionQuality: 69,
    criticalRatingStars: 3.1,
    crowdResponse: 61,
  });

  state.matchParticipants.push(
    { id: "results-participant-a1", worldId: state.world.id, matchId: "results-match-a", eventId: "results-event-a", personId: people[0]!.id, side: "A", won: true },
    { id: "results-participant-a2", worldId: state.world.id, matchId: "results-match-a", eventId: "results-event-a", personId: people[1]!.id, side: "B", won: false },
    { id: "results-participant-b1", worldId: state.world.id, matchId: "results-match-b", eventId: "results-event-b", personId: people[2]!.id, side: "A", won: false },
    { id: "results-participant-b2", worldId: state.world.id, matchId: "results-match-b", eventId: "results-event-b", personId: people[3]!.id, side: "B", won: true },
  );

  state.injuries.push({
    id: "results-injury-a",
    worldId: state.world.id,
    personId: people[1]!.id,
    matchId: "results-match-a",
    eventId: "results-event-a",
    date: dateA,
    severity: "MINOR",
    weeksOut: 2,
    weeksRemaining: 2,
    status: "ACTIVE",
  });
  state.championships ??= [];
  state.championshipContests ??= [];
  state.championships.push({
    id: "results-title-a",
    worldId: state.world.id,
    promotionId: promotions[0]!.id,
    name: "Independent Championship",
    division: "SINGLES",
    status: "ACTIVE",
    prestige: 50,
    currentReignId: null,
    createdDate: { year: 1, week: 1, day: 1 },
  });
  state.championshipContests.push({
    id: "results-contest-a",
    worldId: state.world.id,
    championshipId: "results-title-a",
    matchId: "results-match-a",
    eventId: "results-event-a",
    date: dateA,
    previousHolderId: people[1]!.id,
    winnerHolderId: people[0]!.id,
    titleChanged: true,
  });

  return {
    aggregate: {
      state,
      ownership,
      commands: createWorldCommandState(state.world.id),
      runtime: createWorldRuntimeState(state.world.id),
      planning: createWorldPlanningState(state.world.id),
    },
    promotionAId: promotions[0]!.id,
    promotionBId: promotions[1]!.id,
  };
}

test("cancelled live arrivals appear only in the owner's private Results, not as performed segments", () => {
  const { aggregate, promotionAId, promotionBId } = twoPlayerFixture(72011);
  const subject = aggregate.state.matchParticipants.find((person) => person.eventId === "results-event-a")!.personId;
  const info = aggregate.state.people.find((person) => person.id === subject)!;
  const event = aggregate.state.events.find((entry) => entry.id === "results-event-a")!;
  const cancelled = {
    id: "cancelled-arrival-ledger-1",
    worldId: aggregate.state.world.id,
    date: { ...event.date },
    order: 1701,
    type: "PLANNED_LIVE_ARRIVAL_CANCELLED_AT_LOCK",
    significanceAtTime: "NOTABLE" as const,
    historicalSignificance: "NOTABLE" as const,
    entityIds: [promotionAId, event.id, subject],
    payload: {
      eventId: event.id,
      promotionId: promotionAId,
      sourceDraftId: "booked-show",
      draftSegmentId: "cancelled-debut",
      personId: subject,
      liveAppearanceKind: "DEBUT",
      reason: "COMPLETED_HISTORY_CHANGED",
    },
  };
  aggregate.state.ledger.push(cancelled, {
    ...cancelled,
    id: "cancelled-arrival-ledger-duplicate",
    order: 1702,
  });
  const own = buildPlayerShowHistory(aggregate, "player-a").shows[0]!;
  ok(own.cancelledArrivals.length === 1, "one cancellation produced duplicate Results warnings");
  ok(own.cancelledArrivals[0]!.wrestlerName === info.name, "warning lost the wrestler's name");
  ok(own.cancelledArrivals[0]!.authoredKind === "DEBUT", "warning changed the original scripted kind");
  ok(own.cancelledArrivals[0]!.reason === "COMPLETED_HISTORY_CHANGED", "warning lost the factual reason");
  ok(own.segmentCount === 0 && own.segments.length === 0,
    "a cancelled arrival was incorrectly counted as an on-screen segment");
  ok(own.matches.length === 1, "cancelling one introduction lost the real match result");
  const rival = buildPlayerShowHistory(aggregate, "player-b").shows[0]!;
  ok(rival.eventId === "results-event-b", "results leaked another promotion's show");
  ok(rival.cancelledArrivals.length === 0, "private cancellation leaked into rival promotion Results");

  aggregate.state.ledger.push({
    ...cancelled, id: "cancelled-arrival-wrong-promotion",
    order: 1703,
    payload: { ...cancelled.payload, promotionId: promotionBId, draftSegmentId: "private-rival-cancellation" },
  });
  ok(buildPlayerShowHistory(aggregate, "player-a").shows[0]!.cancelledArrivals.length === 1,
    "another promotion's cancellation marker was imported into this promoter's private history");
});

test("private Results explain a pre-empted return without inventing a public performance", () => {
  const { aggregate, promotionAId } = twoPlayerFixture(72012);
  const event = aggregate.state.events.find((entry) => entry.id === "results-event-a")!;
  const subject = aggregate.state.matchParticipants.find((person) => person.eventId === event.id)!.personId;
  aggregate.state.ledger.push({
    id: "cancelled-return-ledger",
    worldId: aggregate.state.world.id,
    date: { ...event.date },
    order: 1801,
    type: "PLANNED_LIVE_ARRIVAL_CANCELLED_AT_LOCK",
    significanceAtTime: "NOTABLE",
    historicalSignificance: "NOTABLE",
    entityIds: [promotionAId, event.id, subject],
    payload: {
      eventId: event.id, promotionId: promotionAId,
      sourceDraftId: "booked-return",
      draftSegmentId: "cancelled-return",
      personId: subject, liveAppearanceKind: "RETURN",
      reason: "EARLIER_COMMITTED_APPEARANCE",
    },
  });
  const note = buildPlayerShowHistory(aggregate, "player-a").shows[0]!.cancelledArrivals[0]!;
  ok(note.authoredKind === "RETURN", "return was silently reclassified as an introduction");
  ok(note.reason === "EARLIER_COMMITTED_APPEARANCE", "return lost its chronology explanation");
});

test("actual finishes come only from frozen authoritative data, including cheating", () => {
  const { aggregate } = twoPlayerFixture(72115);
  const match = aggregate.state.matches.find((candidate) => candidate.id === "results-match-a")!;
  let privateMatch = buildPlayerShowHistory(aggregate, "player-a").shows[0]!.matches[0]!;
  ok(privateMatch.actualFinish === null, "legacy result invented an unrecorded pinfall");
  setActualMatchFinish(match, "FOREIGN_OBJECT");
  privateMatch = buildPlayerShowHistory(aggregate, "player-a").shows[0]!.matches[0]!;
  const publicMatch = buildPlayerWorldResultsView(aggregate, "player-b").shows
    .find((show) => show.eventId === "results-event-a")!.matches[0]!;
  ok(privateMatch.actualFinish === "FOREIGN_OBJECT" && publicMatch.actualFinish === "FOREIGN_OBJECT",
    "foreign-object finish did not project identically into private and public results");
  ok(showResultHighlights(buildPlayerShowHistory(aggregate, "player-a").shows[0]!)
    .some((moment) => moment.headline.includes("Foreign object")),
    "performed dirty finish did not appear in replay");
  setActualMatchFinish(match, "DISQUALIFICATION");
  privateMatch = buildPlayerShowHistory(aggregate, "player-a").shows[0]!.matches[0]!;
  ok(privateMatch.actualFinish === "DISQUALIFICATION", "disqualification wasn't reflected in completed results");
  ok(showResultHighlights(buildPlayerShowHistory(aggregate, "player-a").shows[0]!)
    .some((moment) => moment.headline.includes("Disqualification")),
    "recorded DQ was omitted from factual highlights");
});

test("cheating identity is factual, side-checked and suppressed if the finish changes", () => {
  const { aggregate } = twoPlayerFixture(72130);
  const match = aggregate.state.matches.find((candidate) => candidate.id === "results-match-a")!;
  const eligible = aggregate.state.matchParticipants.find((person) =>
    person.matchId === match.id && person.side === "A")!;
  const ineligible = aggregate.state.matchParticipants.find((person) =>
    person.matchId === match.id && person.side === "B")!;
  match.finishCheaterPersonId = eligible.personId;
  setActualMatchFinish(match, "FOREIGN_OBJECT");
  const owner = buildPlayerShowHistory(aggregate, "player-a").shows[0]!.matches[0]!;
  const world = buildPlayerWorldResultsView(aggregate, "player-b").shows
    .find((show) => show.eventId === "results-event-a")!.matches[0]!;
  ok(owner.finishCheater?.personId === eligible.personId && world.finishCheater?.personId === eligible.personId,
    "actual cheating wrestler did not match in private and public results");
  const moments = showResultHighlights(buildPlayerShowHistory(aggregate, "player-a").shows[0]!);
  ok(moments.some((moment) => moment.detail.includes(owner.finishCheater!.name)),
    "broadcast did not name the recorded cheating wrestler");
  match.finishCheaterPersonId = ineligible.personId;
  ok(buildPlayerShowHistory(aggregate, "player-a").shows[0]!.matches[0]!.finishCheater === null,
    "an opposite-side wrestler was falsely blamed for cheating");
  match.finishCheaterPersonId = eligible.personId;
  setActualMatchFinish(match, "INJURY_STOPPAGE");
  ok(buildPlayerShowHistory(aggregate, "player-a").shows[0]!.matches[0]!.finishCheater === null,
    "a changed injury stoppage retained its cancelled cheating narrative");
  ok(buildPlayerWorldResultsView(aggregate, "player-b").shows
    .find((show) => show.eventId === "results-event-a")!.matches[0]!.finishCheater === null,
    "public results leaked the unperformed cheating identity");
});

test("completed-show highlight reel is truthful in owner and World Results and never guesses a winner", () => {
  const { aggregate } = twoPlayerFixture(72111);
  const privateShow = buildPlayerShowHistory(aggregate, "player-a").shows[0]!;
  const publicShow = buildPlayerWorldResultsView(aggregate, "player-b").shows.find(
    (show) => show.eventId === privateShow.eventId)!;
  const owned = showResultHighlights(privateShow);
  const publicMoments = showResultHighlights(publicShow);
  ok(owned.length === 3 && owned[0]?.category === "CHAMPIONSHIP"
    && owned[1]?.category === "INJURY" && owned[2]?.category === "MAIN_EVENT",
    "show replay did not rank real title, injury and best match consequences");
  ok(owned[0]?.headline.includes("Independent Championship") && owned[0]?.detail.includes("wins"),
    "title-change replay lost the actual championship result");
  ok(owned[1]?.detail.includes("2 PPW weeks out"),
    "replay misstated the actual injury duration");
  ok(owned[2]?.detail.includes("3.8") && owned[2]?.detail.includes("victorious"),
    "highest-rated match replay lost the winner or displayed stars incorrectly");
  ok(owned.map((item) => item.id).join("|") === publicMoments.map((item) => item.id).join("|"),
    "public recap disagreed with private factual performed results");
  ok(showResultHighlights(privateShow, 1).length === 1
    && showResultHighlights(privateShow, 0).length === 0,
    "highlight reel exceeded the requested visible count");
  const matchSlot = privateShow.runningOrder.find((slot) => slot.kind === "MATCH")!;
  if (matchSlot.kind !== "MATCH") throw new Error("missing completed match");
  const noWinner = showResultHighlights({
    runningOrder: [{
      ...matchSlot,
      match: {
        ...matchSlot.match,
        titleOutcomes: [],
        injuries: [],
        winnerNames: [],
        criticalRatingStars: 2.25,
      },
    }],
  });
  ok(noWinner.length === 1 && noWinner[0]?.category === "MAIN_EVENT"
    && noWinner[0]?.detail.includes("No winner recorded")
    && !noWinner[0]?.detail.includes("victorious"),
    "presentation fabricated a winner for a finished match without winner evidence");
});

test("only a performed debut can headline the reel, never an unperformed arrival", () => {
  const { aggregate, promotionAId } = twoPlayerFixture(72112);
  const event = aggregate.state.events.find((item) => item.id === "results-event-a")!;
  const person = aggregate.state.matchParticipants.find((item) => item.eventId === event.id)!.personId;
  const expected = aggregate.state.people.find((item) => item.id === person)!.name;
  aggregate.state.ledger.push({
    id: "actual-live-debut-for-highlights",
    worldId: aggregate.state.world.id,
    date: { ...event.date }, order: 9951, type: "SHOW_SEGMENT_COMPLETED",
    significanceAtTime: "NOTABLE", historicalSignificance: "NOTABLE",
    entityIds: [event.id, promotionAId, person],
    payload: {
      eventId: event.id, promotionId: promotionAId,
      sourceDraftId: "performed-debut-draft",
      draftSegmentId: "performed-debut",
      slotOrder: 1, segmentType: "LIVE_APPEARANCE",
      participantIds: person, programmeId: null,
      liveAppearanceKind: "DEBUT", liveAppearanceObjective: "ESTABLISH_STAR",
      plannedLengthMinutes: 5,
    },
  });
  let privateShow = buildPlayerShowHistory(aggregate, "player-a").shows[0]!;
  let highlights = showResultHighlights(privateShow);
  ok(highlights.some((moment) => moment.category === "ARRIVAL"
    && moment.headline.includes(expected) && moment.headline.includes("Promotion debut")),
    "completed live debut was not celebrated with its actual wrestler");
  ok(showResultHighlights(buildPlayerWorldResultsView(aggregate, "player-b").shows.find(
    (show) => show.eventId === event.id)!).some((moment) => moment.category === "ARRIVAL"),
    "public World Results omitted a genuinely performed debut");

  aggregate.state.ledger = aggregate.state.ledger.filter((entry) =>
    entry.id !== "actual-live-debut-for-highlights");
  aggregate.state.ledger.push({
    id: "unperformed-arrival-only",
    worldId: aggregate.state.world.id, date: { ...event.date },
    order: 9952, type: "PLANNED_LIVE_ARRIVAL_CANCELLED_AT_LOCK",
    significanceAtTime: "NOTABLE", historicalSignificance: "NOTABLE",
    entityIds: [event.id, promotionAId, person],
    payload: {
      eventId: event.id, promotionId: promotionAId,
      sourceDraftId: "performed-debut-draft", draftSegmentId: "performed-debut",
      personId: person, liveAppearanceKind: "DEBUT",
      reason: "COMPLETED_HISTORY_CHANGED",
    },
  });
  privateShow = buildPlayerShowHistory(aggregate, "player-a").shows[0]!;
  highlights = showResultHighlights(privateShow);
  ok(privateShow.cancelledArrivals.length === 1 && !highlights.some(
    (moment) => moment.category === "ARRIVAL"),
    "broadcast falsely presented an unperformed debut as a real show highlight");
});

test("show history exposes match-level consequences for the controlled promotion", () => {
  const { aggregate, promotionAId } = twoPlayerFixture(72001);
  const view = buildPlayerShowHistory(aggregate, "player-a");
  ok(view.player.promotionId === promotionAId, "results projection returned the wrong controlled promotion");
  ok(view.shows.length === 1, "results projection did not return exactly the controlled promotion show");
  const show = view.shows[0]!;
  ok(show.eventId === "results-event-a", "results projection returned the rival event");
  ok(show.matches.length === 1, "show detail did not expose the completed match");
  ok(show.matches[0]!.winnerNames.length === 1, "match result did not expose a winner");
  ok(show.injuryCount === 1 && show.matches[0]!.injuries.length === 1, "show result did not expose injury consequences");
  ok(show.titleChangeCount === 1 && show.matches[0]!.titleOutcomes[0]?.titleChanged, "show result did not expose the title change");
  ok(show.crowdStory === null, "legacy show without frozen flow evidence invented a crowd diagnosis");
  ok(show.matches[0]!.crowdFlowFactors.length === 0, "legacy match without frozen flow evidence invented crowd factors");
});

test("show history merges frozen segments with matches in the original slot order", () => {
  const { aggregate } = twoPlayerFixture(72005);
  const event = aggregate.state.events.find((candidate) => candidate.id === "results-event-a")!;
  const people = aggregate.state.matchParticipants
    .filter((participant) => participant.eventId === event.id)
    .map((participant) => participant.personId);
  aggregate.state.ledger.push({
    id: "results-segment-ledger",
    worldId: aggregate.state.world.id,
    date: { ...event.date },
    order: 900,
    type: "SHOW_SEGMENT_COMPLETED",
    significanceAtTime: "ROUTINE",
    historicalSignificance: "ROUTINE",
    entityIds: [event.id, event.promotionId, people[0]!],
    payload: {
      eventId: event.id,
      promotionId: event.promotionId,
      sourceDraftId: "results-draft",
      draftSegmentId: "results-segment",
      slotOrder: 1,
      segmentType: "INTERVIEW",
      participantIds: people[0]!,
      programmeId: null,
      plannedLengthMinutes: 5,
    },
  });

  const show = buildPlayerShowHistory(aggregate, "player-a").shows[0]!;
  ok(show.segmentCount === 1 && show.segments.length === 1, "resolved segment was not projected");
  ok(show.runningOrder.length === 2, "complete show order did not contain match and segment");
  ok(show.runningOrder[0]?.kind === "SEGMENT" && show.runningOrder[1]?.kind === "MATCH", "segment slot order was not preserved");
  ok(show.segments[0]?.participants[0]?.personId === people[0], "segment participant was not projected");
  ok(show.segments[0]?.plannedLengthMinutes === 5, "private Results lost segment duration");
});

test("show Results display only the originally performed frozen promo message", () => {
  const { aggregate, promotionAId } = twoPlayerFixture(72013);
  const event = aggregate.state.events.find((entry) => entry.id === "results-event-a")!;
  const speaker = aggregate.state.matchParticipants.find((entry) => entry.eventId === event.id)!.personId;
  aggregate.state.ledger.push({
    id: "frozen-promo-purpose",
    worldId: aggregate.state.world.id,
    date: { ...event.date },
    order: 1750,
    type: "SHOW_SEGMENT_COMPLETED",
    significanceAtTime: "ROUTINE",
    historicalSignificance: "ROUTINE",
    entityIds: [event.id, promotionAId, speaker],
    payload: {
      eventId: event.id,
      promotionId: promotionAId,
      sourceDraftId: "promoter-show",
      draftSegmentId: "authored-promo",
      slotOrder: 1,
      segmentType: "PROMO",
      promoPurpose: "ISSUE_WARNING",
      participantIds: speaker,
      programmeId: null,
      plannedLengthMinutes: 5,
    },
  });
  const projected = buildPlayerShowHistory(aggregate, "player-a").shows[0]!;
  ok(projected.segments[0]?.promoPurpose === "ISSUE_WARNING",
    "Results lost the player's originally scripted promo message");
  ok(projected.segments[0]?.type === "PROMO",
    "Results converted a promo message into another kind of segment");
  ok(buildPlayerShowHistory(aggregate, "player-b").shows[0]!.segments.length === 0,
    "another promotion's show appeared in private Results");
});

test("an interview's authored question and answer are frozen as a real show segment", () => {
  const { aggregate, promotionAId } = twoPlayerFixture(72014);
  const event = aggregate.state.events.find((item) => item.id === "results-event-a")!;
  const subject = aggregate.state.matchParticipants.find((item) => item.eventId === event.id)!.personId;
  aggregate.state.ledger.push({
    id: "frozen-interview-ledger",
    worldId: aggregate.state.world.id,
    date: { ...event.date },
    order: 1751,
    type: "SHOW_SEGMENT_COMPLETED",
    significanceAtTime: "ROUTINE",
    historicalSignificance: "ROUTINE",
    entityIds: [event.id, promotionAId, subject],
    payload: {
      eventId: event.id,
      promotionId: promotionAId,
      sourceDraftId: "authored-interview-show",
      draftSegmentId: "guest-answer",
      slotOrder: 1,
      segmentType: "INTERVIEW",
      interviewFormat: "IN_RING",
      interviewTopic: "RIVALRY_PRESSURE",
      interviewResponse: "DEFIANT",
      participantIds: subject,
      programmeId: null,
      plannedLengthMinutes: 5,
    },
  });
  const personal = buildPlayerShowHistory(aggregate, "player-a").shows[0]!;
  const interview = personal.segments[0]!;
  ok(interview.type === "INTERVIEW" && interview.interviewFormat === "IN_RING"
    && interview.interviewTopic === "RIVALRY_PRESSURE" && interview.interviewResponse === "DEFIANT",
    "private Results changed the scripted interview on screen");
  ok(interview.participants.length === 1 && interview.participants[0]!.personId === subject,
    "private Results fabricated an additional booked guest or interviewer");
  const world = buildPlayerWorldResultsView(aggregate, "player-b");
  const publicInterview = world.shows.find((item) => item.eventId === event.id)?.segments[0];
  ok(publicInterview?.interviewResponse === "DEFIANT"
    && publicInterview.interviewTopic === "RIVALRY_PRESSURE"
    && publicInterview.interviewFormat === "IN_RING",
    "public Results did not preserve the actual performed scripted interview");
  ok(buildPlayerShowHistory(aggregate, "player-b").shows[0]!.segments.length === 0,
    "another promoter's private Results included the interview from a rival show");
});

test("actual celebrations preserve their scripted ending in private and public Results", () => {
  const { aggregate, promotionAId } = twoPlayerFixture(72015);
  const event = aggregate.state.events.find((item) => item.id === "results-event-a")!;
  const wrestler = aggregate.state.matchParticipants.find((item) => item.eventId === event.id)!.personId;
  aggregate.state.ledger.push({
    id: "frozen-self-coronation",
    worldId: aggregate.state.world.id,
    date: { ...event.date },
    order: 1752,
    type: "SHOW_SEGMENT_COMPLETED",
    significanceAtTime: "ROUTINE",
    historicalSignificance: "ROUTINE",
    entityIds: [event.id, promotionAId, wrestler],
    payload: {
      eventId: event.id,
      promotionId: promotionAId,
      sourceDraftId: "ceremony-show",
      draftSegmentId: "boastful-ceremony",
      slotOrder: 1,
      segmentType: "CELEBRATION",
      celebrationOccasion: "SELF_CORONATION",
      celebrationEnding: "WALK_OFF",
      participantIds: wrestler,
      programmeId: null,
      plannedLengthMinutes: 5,
    },
  });
  const personal = buildPlayerShowHistory(aggregate, "player-a").shows[0]!;
  ok(personal.segments[0]?.celebrationOccasion === "SELF_CORONATION"
    && personal.segments[0]?.celebrationEnding === "WALK_OFF",
    "private Results changed the original kayfabe ceremony or ending");
  const publicView = buildPlayerWorldResultsView(aggregate, "player-b");
  const publicSegment = publicView.shows.find((show) => show.eventId === event.id)?.segments[0];
  ok(publicSegment?.celebrationOccasion === "SELF_CORONATION"
    && publicSegment?.celebrationEnding === "WALK_OFF",
    "the actual on-screen ceremony was lost in World Results");
  ok(buildPlayerShowHistory(aggregate, "player-b").shows[0]!.segments.length === 0,
    "another promoter's private show included a rival celebration");
});

test("a resolved confrontation appears with its exact scripted ending in private and public Results", () => {
  const { aggregate, promotionAId } = twoPlayerFixture(72016);
  const event = aggregate.state.events.find((entry) => entry.id === "results-event-a")!;
  const firstTwo = aggregate.state.matchParticipants
    .filter((entry) => entry.eventId === event.id).slice(0, 2);
  const instigator = firstTwo[1]!.personId;
  const target = firstTwo[0]!.personId;
  aggregate.state.ledger.push({
    id: "resolved-faceoff-ledger",
    worldId: aggregate.state.world.id,
    date: { ...event.date },
    order: 1753,
    type: "SHOW_SEGMENT_COMPLETED",
    significanceAtTime: "ROUTINE",
    historicalSignificance: "ROUTINE",
    entityIds: [event.id, promotionAId, instigator, target],
    payload: {
      eventId: event.id,
      promotionId: promotionAId,
      sourceDraftId: "faceoff-draft",
      draftSegmentId: "faceoff-on-screen",
      slotOrder: 1,
      segmentType: "CONFRONTATION",
      participantIds: [instigator, target].join(","),
      initiatorPersonId: instigator,
      targetPersonId: target,
      confrontationEnding: "INITIATOR_BACKS_DOWN",
      programmeId: null,
      plannedLengthMinutes: 5,
    },
  });
  const owner = buildPlayerShowHistory(aggregate, "player-a").shows[0]!;
  ok(owner.segments[0]?.confrontationEnding === "INITIATOR_BACKS_DOWN"
    && owner.segments[0]?.initiatorPersonId === instigator
    && owner.segments[0]?.targetPersonId === target,
    "owner's Results rewrote the scripted confrontation");
  const publicEvent = buildPlayerWorldResultsView(aggregate, "player-b").shows
    .find((show) => show.eventId === event.id);
  ok(publicEvent?.segments[0]?.confrontationEnding === "INITIATOR_BACKS_DOWN",
    "public World Results lost the performed ending");
  ok(buildPlayerShowHistory(aggregate, "player-b").shows[0]!.segments.length === 0,
    "another promoter's private Results leaked this face-off");
});

test("Results preserve a failed rescue and post-match fightback instead of inventing a successful save or match reversal", () => {
  const { aggregate, promotionAId } = twoPlayerFixture(72017);
  const event = aggregate.state.events.find((entry) => entry.id === "results-event-a")!;
  const people = aggregate.state.matchParticipants
    .filter((person) => person.eventId === event.id).map((person) => person.personId);
  const [attacker, victim] = people;
  const rescuer = aggregate.state.people.find((person) => person.id !== attacker && person.id !== victim)!.id;
  const match = aggregate.state.matches.find((entry) => entry.eventId === event.id)!;
  const originalWinner = match.actualWinnerSide;
  const originalInjuries = aggregate.state.injuries.length;
  for (const [i, segmentType] of (["RESCUE", "POST_MATCH_ASSAULT"] as const).entries()) {
    aggregate.state.ledger.push({
      id: `authored-aftermath-${i}`, worldId: aggregate.state.world.id,
      date: { ...event.date }, order: 1790 + i,
      type: "SHOW_SEGMENT_COMPLETED",
      significanceAtTime: "ROUTINE", historicalSignificance: "ROUTINE",
      entityIds: [event.id, promotionAId, attacker!, victim!, rescuer],
      payload: {
        eventId: event.id, promotionId: promotionAId,
        sourceDraftId: "authored-aftermath-show",
        draftSegmentId: `aftermath-${i}`,
        slotOrder: i + 1, segmentType,
        participantIds: (segmentType === "RESCUE" ? [attacker!, victim!, rescuer] : [attacker!, victim!]).join(","),
        attackerPersonId: attacker!, victimPersonId: victim!,
        rescuerPersonId: segmentType === "RESCUE" ? rescuer : null,
        rescueOutcome: segmentType === "RESCUE" ? "RESCUE_OVERWHELMED" : null,
        sourceDraftMatchId: segmentType === "POST_MATCH_ASSAULT" ? "results-match-script" : null,
        sourceMatchId: segmentType === "POST_MATCH_ASSAULT" ? match.id : null,
        victimMatchOutcome: segmentType === "POST_MATCH_ASSAULT" ? "LOST" : null,
        attackPresentation: segmentType === "POST_MATCH_ASSAULT" ? "BEATDOWN" : null,
        attackObjective: segmentType === "POST_MATCH_ASSAULT" ? "BUILD_SYMPATHY" : null,
        postMatchAssaultEnding: segmentType === "POST_MATCH_ASSAULT" ? "VICTIM_FIGHTS_BACK" : null,
        programmeId: null, plannedLengthMinutes: 5,
      },
    });
  }
  const owner = buildPlayerShowHistory(aggregate, "player-a").shows[0]!;
  const failed = owner.segments.find((entry) => entry.type === "RESCUE")!;
  const retaliation = owner.segments.find((entry) => entry.type === "POST_MATCH_ASSAULT")!;
  ok(failed.rescueOutcome === "RESCUE_OVERWHELMED",
    "private Results invented a successful save instead of showing the booked failure");
  ok(retaliation.postMatchAssaultEnding === "VICTIM_FIGHTS_BACK"
    && retaliation.attackPresentation === "BEATDOWN"
    && retaliation.attackObjective === "BUILD_SYMPATHY"
    && retaliation.sourceMatchId === match.id,
    "private Results lost the actual scripted aftermath or source match");
  const publicShow = buildPlayerWorldResultsView(aggregate, "player-b").shows
    .find((entry) => entry.eventId === event.id)!;
  ok(publicShow.segments.find((entry) => entry.type === "RESCUE")?.rescueOutcome === "RESCUE_OVERWHELMED",
    "public Results turned an attempted rescue into a successful one");
  ok(publicShow.segments.find((entry) => entry.type === "POST_MATCH_ASSAULT")?.postMatchAssaultEnding === "VICTIM_FIGHTS_BACK",
    "public Results lost the performed post-match ending");
  ok(match.actualWinnerSide === originalWinner && aggregate.state.injuries.length === originalInjuries,
    "an on-screen aftermath rewrote match results or fabricated injuries");
  ok(buildPlayerShowHistory(aggregate, "player-b").shows[0]!.segments.length === 0,
    "rivalry-private show report leaked to another promotion");
});

test("show history keeps positive alignment clarity separate from negative volatility", () => {
  const { aggregate } = twoPlayerFixture(72006);
  const event = aggregate.state.events.find((candidate) => candidate.id === "results-event-a")!;
  const match = aggregate.state.matches.find((candidate) => candidate.eventId === event.id)!;
  aggregate.state.ledger.push({
    id: "results-alignment-factor-ledger",
    worldId: aggregate.state.world.id,
    date: { ...event.date },
    order: 901,
    type: "MATCH_COMPLETED",
    significanceAtTime: "ROUTINE",
    historicalSignificance: "ROUTINE",
    entityIds: [match.id, event.id, event.promotionId],
    payload: {
      showFlowAlignmentModifier: 1.1,
      showFlowAlignmentReason: "ALIGNMENT_VOLATILITY",
      showFlowAlignmentBaseModifier: 2.2,
      showFlowAlignmentBaseReason: "FACE_HEEL_CLARITY",
      showFlowAlignmentVolatilityModifier: -1.1,
      showFlowAlignmentVolatilityReason: "ALIGNMENT_VOLATILITY",
    },
  });

  const show = buildPlayerShowHistory(aggregate, "player-a").shows[0]!;
  const factors = show.matches[0]!.crowdFlowFactors.filter((factor) => factor.scope === "ALIGNMENT");
  ok(factors.some((factor) => factor.reason === "FACE_HEEL_CLARITY" && factor.impact === 2.2), "positive alignment clarity was not exposed");
  ok(factors.some((factor) => factor.reason === "ALIGNMENT_VOLATILITY" && factor.impact === -1.1), "negative alignment volatility was not exposed");
  ok(!factors.some((factor) => factor.reason === "ALIGNMENT_VOLATILITY" && factor.impact > 0), "confusion was displayed as a positive crowd factor");
});

test("show history exposes frozen dimensional style evidence without recomputing it", () => {
  const { aggregate } = twoPlayerFixture(72007);
  const event = aggregate.state.events.find((candidate) => candidate.id === "results-event-a")!;
  const match = aggregate.state.matches.find((candidate) => candidate.eventId === event.id)!;
  aggregate.state.ledger.push({
    id: "results-style-evidence-ledger",
    worldId: aggregate.state.world.id,
    date: { ...event.date },
    order: 902,
    type: "MATCH_COMPLETED",
    significanceAtTime: "ROUTINE",
    historicalSignificance: "ROUTINE",
    entityIds: [match.id, event.id, event.promotionId],
    payload: {
      styleResolver: "DIMENSIONAL",
      stylePhysicalLoad: 78.4,
      styleCreativeLoad: 66.2,
      styleTotalLoad: 74.1,
      styleLoadBand: "DEMANDING",
      styleCapability: 73.5,
      styleShortfall: 8.4,
      styleRealizedUpside: 5.2,
      styleDifficultyPenalty: 3.1,
    },
  });
  match.executionQuality = 84;

  const projected = buildPlayerShowHistory(aggregate, "player-a").shows[0]!.matches[0]!;
  ok(projected.styleResult?.loadBand === "DEMANDING", "style result lost frozen load band");
  ok(projected.styleResult?.physicalLoad === 78.4, "style result recomputed or changed frozen physical load");
  ok(projected.styleResult?.capability === 73.5, "style result lost frozen capability");
  ok(projected.styleResult?.delivery === "NAILED", "style result did not classify strong delivered style");
});

test("show history remains scoped to each player's controlled promotion", () => {
  const { aggregate, promotionAId, promotionBId } = twoPlayerFixture(72002);
  const playerA = buildPlayerShowHistory(aggregate, "player-a");
  const playerB = buildPlayerShowHistory(aggregate, "player-b");
  ok(playerA.shows.every((show) => aggregate.state.events.find((event) => event.id === show.eventId)?.promotionId === promotionAId), "player A received rival show history");
  ok(playerB.shows.every((show) => aggregate.state.events.find((event) => event.id === show.eventId)?.promotionId === promotionBId), "player B received rival show history");
  ok(!playerA.shows.some((show) => show.eventId === "results-event-b"), "player A leaked player B's show");
  ok(!playerB.shows.some((show) => show.eventId === "results-event-a"), "player B leaked player A's show");
});

test("frozen crowd-flow evidence is projected without reinterpreting mutable World state", () => {
  const { aggregate, promotionAId } = twoPlayerFixture(72004);
  const event = aggregate.state.events.find((candidate) => candidate.id === "results-event-a")!;
  event.crowdResponse = 73;
  aggregate.state.ledger.push(
    {
      id: "results-match-a-ledger",
      worldId: aggregate.state.world.id,
      date: { ...event.date },
      order: 1001,
      type: "MATCH_COMPLETED",
      significanceAtTime: "ROUTINE",
      historicalSignificance: "ROUTINE",
      entityIds: ["results-match-a", "results-event-a"],
      payload: {
        showFlowAlignmentModifier: 2.2,
        showFlowAlignmentReason: "FACE_HEEL_CLARITY",
        showFlowProgrammeModifier: -1.4,
        showFlowProgrammeReason: "PROGRAMME_REPETITION",
        showFlowPacingModifier: 1.2,
        showFlowPacingReason: "BIG_CLOSER",
        showFlowAdjustedCrowd: 74,
        showFlowWeight: 1,
      },
    },
    {
      id: "results-event-a-ledger",
      worldId: aggregate.state.world.id,
      date: { ...event.date },
      order: 1002,
      type: "EVENT_COMPLETED",
      significanceAtTime: "ROUTINE",
      historicalSignificance: "ROUTINE",
      entityIds: ["results-event-a", promotionAId],
      payload: {
        crowdResponse: 73,
        showFlowBaseCrowdResponse: 71,
        showFlowAdjustment: 2,
        showFlowFrozen: true,
      },
    },
  );

  const before = buildPlayerShowHistory(aggregate, "player-a");
  const show = before.shows[0]!;
  ok(show.crowdStory !== null, "frozen crowd evidence did not produce a crowd story");
  ok(show.crowdStory!.baseCrowdResponse === 71, "crowd story did not use frozen baseline");
  ok(show.crowdStory!.finalCrowdResponse === 73 && show.crowdStory!.adjustment === 2, "crowd story did not use frozen final result");
  ok(show.crowdStory!.tone === "POSITIVE", "positive flow adjustment did not classify correctly");
  ok(show.crowdStory!.positiveDrivers.some((driver) => driver.reason === "FACE_HEEL_CLARITY"), "alignment driver was not explained");
  ok(show.crowdStory!.positiveDrivers.some((driver) => driver.reason === "BIG_CLOSER"), "pacing driver was not explained");
  ok(show.crowdStory!.negativeDrivers.some((driver) => driver.reason === "PROGRAMME_REPETITION"), "Programme repetition drag was not explained");
  ok(show.matches[0]!.crowdFlowFactors.length === 3, "material match crowd factors were not projected");

  const matchPeople = aggregate.state.matchParticipants
    .filter((participant) => participant.matchId === "results-match-a")
    .map((participant) => aggregate.state.people.find((person) => person.id === participant.personId)!)
    .filter(Boolean);
  for (const person of matchPeople) setWrestlerAlignment(person, "HEEL");
  aggregate.state.programmes ??= [];
  aggregate.state.programmes.push({
    id: "results-later-programme",
    worldId: aggregate.state.world.id,
    promotionId: promotionAId,
    status: "ACTIVE",
    sideA: [{ kind: "PERSON", entityId: matchPeople[0]!.id }],
    sideB: [{ kind: "PERSON", entityId: matchPeople[1]!.id }],
    championshipId: null,
    startedDate: { year: 1, week: 3, day: 1 },
    endedDate: null,
    heat: 5,
    repetition: 100,
    activityCount: 20,
    matchCount: 15,
    segmentCount: 5,
    sideAWins: 8,
    sideBWins: 7,
    draws: 0,
    lastActivityDate: { year: 1, week: 3, day: 1 },
  });

  const after = buildPlayerShowHistory(aggregate, "player-a");
  ok(
    JSON.stringify(after.shows[0]!.crowdStory) === JSON.stringify(show.crowdStory),
    "old show crowd story changed after present-day alignment or Programme state changed",
  );
});

test("frozen cheating reaction projects identically to owner and public results", () => {
  const { aggregate } = twoPlayerFixture(72271);
  const match = aggregate.state.matches.find((candidate) => candidate.id === "results-match-a")!;
  const event = aggregate.state.events.find((candidate) => candidate.id === match.eventId)!;
  const culprit = aggregate.state.matchParticipants.find((participant) =>
    participant.matchId === match.id && participant.side === "A")!.personId;
  match.finishCheaterPersonId = culprit;
  setActualMatchFinish(match, "FOREIGN_OBJECT");
  let own = buildPlayerShowHistory(aggregate, "player-a").shows[0]!.matches[0]!;
  ok(own.finishFallout === null, "legacy result invented finish heat without a frozen resolution");
  aggregate.state.ledger.push({
    id: "results-finish-heat-ledger", worldId: aggregate.state.world.id,
    date: { ...event.date }, order: 999, type: "MATCH_COMPLETED",
    significanceAtTime: "ROUTINE", historicalSignificance: "ROUTINE",
    entityIds: [match.id, event.id, culprit],
    payload: {
      actualFinish: "FOREIGN_OBJECT", finishCheaterPersonId: culprit,
      showFlowFinishModifier: 1.8, showFlowFinishReason: "HEEL_CHEATING_HEAT",
      showFlowFinishRepeatCount: 0, showFlowFinishProgrammeLinked: true,
    },
  });
  own = buildPlayerShowHistory(aggregate, "player-a").shows[0]!.matches[0]!;
  let rival = buildPlayerWorldResultsView(aggregate, "player-b").shows
    .find((show) => show.eventId === event.id)!.matches[0]!;
  ok(own.finishFallout?.reason === "HEEL_CHEATING_HEAT"
    && rival.finishFallout?.crowdAdjustment === 1.8
    && rival.finishFallout?.programmeLinked === true,
    "completed heel heat did not project equally into owner and public World results");
  ok(own.crowdFlowFactors.some((factor) =>
    factor.scope === "FINISH" && factor.impact === 1.8),
    "frozen heat was absent from owner crowd context");
  aggregate.state.ledger.at(-1)!.payload.showFlowFinishRepeatCount = 2;
  aggregate.state.ledger.at(-1)!.payload.showFlowFinishReason = "DIRTY_FINISH_FAMILIAR";
  aggregate.state.ledger.at(-1)!.payload.showFlowFinishModifier = 0;
  own = buildPlayerShowHistory(aggregate, "player-a").shows[0]!.matches[0]!;
  rival = buildPlayerWorldResultsView(aggregate, "player-b").shows
    .find((show) => show.eventId === event.id)!.matches[0]!;
  ok(own.finishFallout?.sameTrickRepeats === 2 && rival.finishFallout?.crowdAdjustment === 0,
    "familiar finish was misread as a new popularity penalty");
});

test("post-show decision is owner-authored, persists into planning, and never books its own match", () => {
  const { aggregate, promotionAId } = twoPlayerFixture(72281);
  const state = aggregate.state;
  const match = state.matches.find((item) => item.id === "results-match-a")!;
  const event = state.events.find((item) => item.id === match.eventId)!;
  state.world.currentDate = { ...event.date };
  const participants = state.matchParticipants.filter((item) => item.matchId === match.id);
  setActualMatchFinish(match, "FOREIGN_OBJECT");
  match.finishCheaterPersonId = participants[0]!.personId;
  const programmeId = "post-show-active-programme";
  state.programmes ??= [];
  state.programmeActivities ??= [];
  state.programmes.push({
    id: programmeId, worldId: state.world.id, promotionId: promotionAId,
    status: "ACTIVE",
    sideA: [{ kind: "PERSON", entityId: participants[0]!.personId }],
    sideB: [{ kind: "PERSON", entityId: participants[1]!.personId }],
    championshipId: null, startedDate: { ...event.date }, endedDate: null,
    heat: 72, repetition: 0, activityCount: 1, matchCount: 1, segmentCount: 0,
    sideAWins: 1, sideBWins: 0, draws: 0, lastActivityDate: { ...event.date },
  });
  state.programmeActivities.push({
    id: "post-show-linked-match", worldId: state.world.id,
    promotionId: promotionAId, programmeId, date: { ...event.date },
    kind: "MATCH", participantEntityIds: participants.map((item) => item.personId),
    eventId: event.id, matchId: match.id, winnerSide: "A",
  });
  ok(eligiblePostShowProgrammeIds(state, promotionAId, event.id, match.id)[0] === programmeId,
    "real match/Programme history did not make follow-up eligible");
  ok(buildPlayerShowHistory(aggregate, "player-a").shows[0]!.matches[0]!.followUpProgrammeId === programmeId,
    "private Results omitted eligible Programme");
  const beforeMatches = JSON.stringify(state.matches);
  const beforeProgrammes = JSON.stringify(state.programmes);
  const revision = aggregate.runtime.revision;
  const envelope = {
    requestId: "post-show-rematch-1", worldId: state.world.id, playerId: "player-a",
    commandType: "SET_POST_SHOW_FOLLOW_UP" as const,
    payload: { promotionId: promotionAId, eventId: event.id, matchId: match.id,
      programmeId, choice: "PURSUE_REMATCH" as const },
  };
  const first = setPostShowFollowUpCommand(state, aggregate.ownership, aggregate.planning,
    aggregate.commands, aggregate.runtime, envelope);
  ok(first.choice === "PURSUE_REMATCH" && aggregate.runtime.revision === revision + 1,
    "choice was not committed once");
  const retry = setPostShowFollowUpCommand(state, aggregate.ownership, aggregate.planning,
    aggregate.commands, aggregate.runtime, envelope);
  ok(retry.matchId === first.matchId && aggregate.runtime.revision === revision + 1,
    "idempotent retry committed a duplicate");
  ok(buildPlayerShowHistory(aggregate, "player-a").shows[0]!.matches[0]!.followUpChoice === "PURSUE_REMATCH",
    "saved next beat did not return in private Results");
  ok(JSON.stringify(state.matches) === beforeMatches && JSON.stringify(state.programmes) === beforeProgrammes,
    "recording a follow-up changed match facts or Programme simulation");
  ok((aggregate.planning.postShowFollowUps ?? []).length === 1, "follow-up created duplicate notes");
  const planning = normalizeWorldPlanningState(aggregate.planning);
  validateWorldPlanningStateShape(state, planning);
  ok(planning.postShowFollowUps?.[0]?.choice === "PURSUE_REMATCH",
    "planning normalization lost follow-up from persisted snapshots");
  let rejected = false;
  try {
    setPostShowFollowUpCommand(state, aggregate.ownership, aggregate.planning,
      aggregate.commands, aggregate.runtime, {
        ...envelope, requestId: "post-show-unauthorized", playerId: "player-b",
      });
  } catch { rejected = true; }
  ok(rejected, "rival player could author another promotion's storyline");
  rejected = false;
  try {
    setPostShowFollowUpCommand(state, aggregate.ownership, aggregate.planning,
      aggregate.commands, aggregate.runtime, {
        ...envelope, requestId: "post-show-false-programme",
        payload: { ...envelope.payload, programmeId: "not-real" },
      });
  } catch { rejected = true; }
  ok(rejected, "user could attach a match to an invented Programme");
  setPostShowFollowUpCommand(state, aggregate.ownership, aggregate.planning,
    aggregate.commands, aggregate.runtime, {
      ...envelope, requestId: "post-show-let-stand",
      payload: { ...envelope.payload, choice: "LET_STAND" },
    });
  ok(aggregate.planning.postShowFollowUps?.length === 1
    && aggregate.planning.postShowFollowUps[0]?.choice === "LET_STAND",
    "revised decision did not update original match note");
});

test("post-show decisions cannot be inferred from opponents or unperformed cheating", () => {
  const { aggregate, promotionAId } = twoPlayerFixture(72282);
  const match = aggregate.state.matches.find((candidate) => candidate.id === "results-match-a")!;
  const event = aggregate.state.events.find((candidate) => candidate.id === match.eventId)!;
  setActualMatchFinish(match, "FOREIGN_OBJECT");
  aggregate.state.world.currentDate = { ...event.date };
  ok(eligiblePostShowProgrammeIds(aggregate.state, promotionAId, event.id, match.id).length === 0,
    "same opponents without explicit Programme match activity were treated as a rivalry");
  setActualMatchFinish(match, "INJURY_STOPPAGE");
  ok(eligiblePostShowProgrammeIds(aggregate.state, promotionAId, event.id, match.id).length === 0,
    "unperformed cheating produced an actionable follow-up");
});

test("non-members cannot read World show history", () => {
  const { aggregate } = twoPlayerFixture(72003);
  let rejected = false;
  try {
    buildPlayerShowHistory(aggregate, "stranger");
  } catch (error) {
    rejected = error instanceof Error && error.message.includes("not an active member");
  }
  ok(rejected, "non-member could read show history");
});

console.log(`\nApplication results-view tests: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exitCode = 1;
