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
import { hotSegmentHeadline, showResultHighlights, showOpeningHighlights } from "../packages/web-adapter/src/results-highlights.js";
import { reviewPlayerMatch, reviewPlayerSegment, reviewPlayerShow, reviewPlayerShowNarrative, reviewPlayerShowChapters, reviewPlayerShowFinalBell, reviewPlayerShowRunningOrder, reviewSegmentVisibleNames } from "../packages/web-adapter/src/results-review.js";
import type { PlayerShowMatchView, PlayerShowSegmentView, PlayerShowResultView } from "../packages/application/src/results-view.js";
import { discoverWorldResults, worldResultsWeekLabel, worldShowHasSpotlight } from "../packages/web-adapter/src/world-results-discovery.js";

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
  const opening = showOpeningHighlights(privateShow);
  ok(opening.length <= 2 && new Set(opening.map((moment) => moment.slotOrder)).size === opening.length,
    "player show opening repeated the same slot or crowded the iPhone");
  ok(opening[0]?.category === "CHAMPIONSHIP" && opening[0].slotOrder === owned[0]?.slotOrder,
    "cover-story curation discarded the genuinely most important moment");
  ok(JSON.stringify(showOpeningHighlights(structuredClone(privateShow))) === JSON.stringify(opening),
    "cover-story selection changed across reloads");

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

test("Results headline variety uses performed segment facts and conceals cryptic footage", () => {
  ok(hotSegmentHeadline("PROMO", "A Performer").includes("A Performer")
    && hotSegmentHeadline("PROMO", "A Performer") !== hotSegmentHeadline("ATTACK", "A Performer")
    && !hotSegmentHeadline("CONFRONTATION", "A Performer").includes("wins"),
    "hot-segment recap is repetitive or invents an outcome");
  const mystery = showResultHighlights({
    runningOrder: [{
      kind: "SEGMENT", order: 3,
      segment: {
        segmentId: "mystery-footage", type: "VIDEO_PACKAGE", videoReveal: "CRYPTIC",
        participants: [{ personId: "hidden-talent", name: "HIDDEN WRESTLER" }],
        outcomeBand: "HOT", crowdResponse: 84.5,
      },
    }],
  } as unknown as Parameters<typeof showResultHighlights>[0]);
  ok(mystery.length === 1 && mystery[0]?.category === "ANGLE"
    && mystery[0]?.headline.includes("video package")
    && mystery[0]?.detail.includes("84.5")
    && !JSON.stringify(mystery).includes("HIDDEN WRESTLER"),
    "cryptic video recap exposed the hidden name or invented an additional beat");
  const arrival = showResultHighlights({
    runningOrder: [{
      kind: "SEGMENT", order: 2,
      segment: {
        segmentId: "real-debut", type: "LIVE_APPEARANCE", liveAppearanceKind: "DEBUT",
        participants: [{ personId: "named-talent", name: "Debuting Wrestler" }],
        outcomeBand: "HOT", crowdResponse: 89,
      },
    }],
  } as unknown as Parameters<typeof showResultHighlights>[0]);
  ok(arrival.length === 1 && arrival[0]?.category === "ARRIVAL"
    && arrival[0]?.headline.includes("Debuting Wrestler"),
    "one true debut produced repetitive arrival and hot-angle headline cards");
});

test("public World timeline filters actual title changes, injuries, cheating and wrestler search", () => {
  const { aggregate } = twoPlayerFixture(72511);
  const original = buildPlayerWorldResultsView(aggregate, "player-a");
  const all = { promotionId: "ALL", spotlight: "ALL" as const, query: "" };
  ok(original.shows.length === 2 && discoverWorldResults(original.shows, all).length === 2,
    "world discovery changed the public source order or discarded completed shows");
  const first = original.shows.find((show) => show.eventId === "results-event-a")!;
  const second = original.shows.find((show) => show.eventId === "results-event-b")!;
  ok(discoverWorldResults(original.shows, { ...all, spotlight: "TITLE_CHANGES" })
    .map((show) => show.eventId).join("|") === first.eventId,
    "title spotlight searched only visible broadcast highlights or included unrelated matches");
  ok(discoverWorldResults(original.shows, { ...all, spotlight: "INJURIES" })
    .map((show) => show.eventId).join("|") === first.eventId,
    "injury spotlight lost a recorded bout consequence");
  ok(!worldShowHasSpotlight(second, "CONTROVERSY"),
    "ordinary completed match was mislabelled a controversial finish");
  const winner = first.matches[0]!.participants[0]!.name;
  ok(discoverWorldResults(original.shows, { ...all, query: winner.toUpperCase() })
    .map((show) => show.eventId).join("|") === first.eventId,
    "case-insensitive public wrestler search didn't match an actual participant");
  ok(discoverWorldResults(original.shows, { ...all, query: " Independent Championship " })
    .map((show) => show.eventId).join("|") === first.eventId,
    "public title name was absent from result search");
  ok(discoverWorldResults(original.shows, {
    ...all, promotionId: second.promotionId, spotlight: "TITLE_CHANGES",
  }).length === 0, "promotion and editorial spotlights were not intersected");
  ok(worldResultsWeekLabel(first) === "Year 1 · Week 2",
    "World timeline week grouping changed the canonical PPW date");
  const cheating = aggregate.state.matches.find((match) => match.id === "results-match-b")!;
  setActualMatchFinish(cheating, "FOREIGN_OBJECT");
  const updated = buildPlayerWorldResultsView(aggregate, "player-a");
  ok(discoverWorldResults(updated.shows, { ...all, spotlight: "CONTROVERSY" })
    .map((show) => show.eventId).join("|") === second.eventId,
    "a completed actual foreign-object finish was not discoverable");
  ok(discoverWorldResults(updated.shows, all).map((show) => show.eventId).join("|")
    === updated.shows.map((show) => show.eventId).join("|"),
    "discovery mutated World chronological order");
});

test("public World Results never expose a cryptic video subject via participants or searchable names", () => {
  const { aggregate, promotionBId } = twoPlayerFixture(72512);
  const event = aggregate.state.events.find((item) => item.id === "results-event-b")!;
  const involved = new Set(aggregate.state.matchParticipants.map((participant) => participant.personId));
  const hidden = aggregate.state.people.find((person) => !involved.has(person.id) && person.name.length > 2)!;
  ok(Boolean(hidden), "cryptic fixture needs an unrelated wrestler");
  aggregate.state.ledger.push({
    id: "secret-clip-public-privacy",
    worldId: aggregate.state.world.id,
    date: { ...event.date }, order: 9701, type: "SHOW_SEGMENT_COMPLETED",
    significanceAtTime: "ROUTINE", historicalSignificance: "ROUTINE",
    entityIds: [event.id, promotionBId, hidden.id],
    payload: {
      eventId: event.id, promotionId: promotionBId,
      sourceDraftId: "cryptic-clip-card", draftSegmentId: "cryptic-clip",
      slotOrder: 2, segmentType: "VIDEO_PACKAGE",
      participantIds: hidden.id, programmeId: null, plannedLengthMinutes: 3,
      videoSubjectPersonId: hidden.id, videoReveal: "CRYPTIC",
      videoKind: "DEBUT_TEASER",
    },
  });
  const world = buildPlayerWorldResultsView(aggregate, "player-a");
  const show = world.shows.find((item) => item.eventId === event.id)!;
  const clip = show.segments.find((segment) => segment.type === "VIDEO_PACKAGE");
  ok(Boolean(clip), "performed cryptic video wasn't included in public results");
  ok(clip!.participants.length === 0 && clip!.videoSubjectName === null,
    "cryptic reveal leaked a hidden wrestler through the public projection");
  ok(!JSON.stringify(show.runningOrder).includes(hidden.name),
    "public card detail exposed cryptic video subject despite concealed reveal");
  ok(discoverWorldResults(world.shows, {
    promotionId: "ALL", spotlight: "ALL", query: hidden.name,
  }).length === 0, "World search allowed secret wrestler name to reveal the mystery clip");

  aggregate.state.ledger.push({
    id: "visible-debut-for-timeline-filter",
    worldId: aggregate.state.world.id,
    date: { ...event.date }, order: 9702, type: "SHOW_SEGMENT_COMPLETED",
    significanceAtTime: "NOTABLE", historicalSignificance: "NOTABLE",
    entityIds: [event.id, promotionBId, hidden.id],
    payload: {
      eventId: event.id, promotionId: promotionBId,
      sourceDraftId: "visible-arrival", draftSegmentId: "visible-arrival",
      slotOrder: 3, segmentType: "LIVE_APPEARANCE",
      participantIds: hidden.id, programmeId: null, plannedLengthMinutes: 5,
      liveAppearanceKind: "DEBUT", liveAppearanceObjective: "ESTABLISH_STAR",
    },
  });
  const revealed = buildPlayerWorldResultsView(aggregate, "player-a");
  const arrivalShows = discoverWorldResults(revealed.shows, {
    promotionId: "ALL", spotlight: "ARRIVALS", query: "",
  });
  ok(arrivalShows.length === 1 && arrivalShows[0]?.eventId === event.id,
    "a performed public debut wasn't discoverable");
  ok(discoverWorldResults(revealed.shows, {
    promotionId: "ALL", spotlight: "ALL", query: hidden.name,
  }).some((item) => item.eventId === event.id),
    "a subsequently performed public debut remained unnecessarily concealed");
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


test("editorial match reviews are deterministic, factual and read-only", () => {
  const match = {
    matchId: "editorial-foreign-object",
    intent: "TECHNICAL",
    winnerNames: ["Megan Bayne"],
    criticalRatingStars: 3.6,
    crowdResponse: 76,
    actualFinish: "FOREIGN_OBJECT",
    finishCheater: { personId: "bayne", name: "Megan Bayne" },
    interference: null,
    titleOutcomes: [],
    injuries: [],
  } as unknown as PlayerShowMatchView;
  const original = JSON.stringify(match);
  const first = reviewPlayerMatch(match);
  ok(first.headline.length > 10 && first.recap.includes("Megan Bayne"), "match recap lacked an identifiable wrestler");
  ok(first.recap.includes("foreign object") && first.recap.includes("referee"), "dirty match finish was invented or lost");
  ok(!first.recap.includes("injur") && !first.recap.includes("title changed"),
    "editorial match recap invented an injury or title change");
  ok(JSON.stringify(reviewPlayerMatch(structuredClone(match))) === JSON.stringify(first),
    "same resolved match produced different text after reload");
  ok(JSON.stringify(match) === original, "read-only editorial renderer mutated the simulated match");
  const stopped = reviewPlayerMatch({
    ...match, actualFinish: "INJURY_STOPPAGE", finishCheater: null, injuries: [
      { injuryId: "inj", personId: "bayne", personName: "Megan Bayne", severity: "MINOR", weeksOut: 1 },
    ],
  } as PlayerShowMatchView);
  ok(stopped.recap.includes("stopped") && !stopped.recap.includes("foreign object"),
    "injury stoppage was falsely described as planned cheating");
  const unknown = reviewPlayerMatch({ ...match, actualFinish: null, finishCheater: null } as PlayerShowMatchView);
  ok(unknown.recap.includes("wasn't recorded") && !unknown.recap.includes("pinfall"),
    "historic unknown finish was made up");
});

test("editorial segment recaps respect scripted endings and cryptic reveal privacy", () => {
  const seed = {
    segmentId: "cryptic-clip",
    type: "VIDEO_PACKAGE",
    participants: [],
    videoSubjectName: "Secret Superstar",
    videoReveal: "CRYPTIC",
    videoKind: "DEBUT_TEASER",
    outcomeBand: "HOT",
    crowdResponse: 82,
  } as unknown as PlayerShowSegmentView;
  const cryptic = reviewPlayerSegment(seed);
  ok(!JSON.stringify(cryptic).includes("Secret Superstar"),
    "cryptic video spoiled its secret identity");
  const revealed = reviewPlayerSegment({ ...seed, videoReveal: "NAMED" } as PlayerShowSegmentView);
  ok(revealed.recap.includes("Secret Superstar"), "named video hid its officially revealed wrestler");
  const rescue = {
    segmentId: "rescue-stopped",
    type: "RESCUE",
    participants: [
      { personId: "a", name: "Attacker" },
      { personId: "b", name: "Victim" },
      { personId: "r", name: "Rescuer" },
    ],
    attackerPersonId: "a", victimPersonId: "b", rescuerPersonId: "r",
    rescueOutcome: "RESCUE_OVERWHELMED",
    outcomeBand: "POOR",
    crowdResponse: 24,
  } as unknown as PlayerShowSegmentView;
  const unsuccessful = reviewPlayerSegment(rescue);
  ok(unsuccessful.recap.includes("rescue failed") && unsuccessful.tone === "ROUGH",
    "editorial recap turned a failed rescue into a scripted success");
  ok(!unsuccessful.recap.includes("rescuer drove off"),
    "editorial recap invented a successful rescue outcome");
  const earlier = JSON.stringify(rescue);
  ok(JSON.stringify(reviewPlayerSegment(rescue)) === JSON.stringify(unsuccessful)
    && JSON.stringify(rescue) === earlier, "segment editorial changed between reloads or mutated the ledger projection");
});


test("player show review headlines track actual crowd, wrestling quality and consequences", () => {
  const base = {
    eventId: "editorial-show-1",
    averageMatchRating: 4.25, crowdResponse: 87,
    titleChangeCount: 1, injuryCount: 0, matchCount: 3, segmentCount: 2,
  };
  const copy = structuredClone(base);
  const hit = reviewPlayerShow(base);
  ok(hit.tone === "GREAT", "strong show did not receive a strong editorial verdict");
  ok(hit.recap.includes("championship") && !hit.recap.includes("injur"),
    "title-changing show review missed actual gold or invented an injury");
  ok(JSON.stringify(reviewPlayerShow(structuredClone(base))) === JSON.stringify(hit),
    "a resolved show review changed between reloads");
  ok(JSON.stringify(base) === JSON.stringify(copy), "read-only show review mutated its source");
  const disaster = reviewPlayerShow({
    ...base, crowdResponse: 24, averageMatchRating: 1.7,
    titleChangeCount: 0, injuryCount: 0,
  });
  ok(disaster.tone === "ROUGH", "a poor show got an undeserved glowing review");
  ok(!disaster.recap.includes("championship") && !disaster.recap.includes("injur"),
    "poor-show recap invented an unrecorded title change or injury");
  const ordinary = reviewPlayerShow({
    ...base, crowdResponse: 69, averageMatchRating: 3.1,
    titleChangeCount: 0, injuryCount: 0,
  });
  ok(ordinary.tone === "GOOD", "good-but-unexceptional card received wrong verdict");
});


test("player recap separates quality from crowd approval and describes retained titles", () => {
  const base = {
    matchId: "editorial-reaction-gap", intent: "TECHNICAL",
    winnerNames: ["Technical Ace"], criticalRatingStars: 4.6,
    crowdResponse: 36, actualFinish: "CLEAN_PIN",
    finishCheater: null, interference: null, injuries: [],
    titleOutcomes: [{ titleChanged: false, championshipName: "World Championship", winnerHolderName: "Technical Ace" }],
  } as unknown as PlayerShowMatchView;
  const coldCrowd = reviewPlayerMatch(base);
  ok(coldCrowd.tone === "GREAT" && /crowd|room/i.test(coldCrowd.verdict),
    "strong wrestling / cold crowd wasn't recognised as a mixed reaction");
  ok(coldCrowd.recap.includes("retained the World Championship"),
    "existing champion lost the retention context in the recap");
  const weakMatchHotCrowd = reviewPlayerMatch({
    ...base, crowdResponse: 88, criticalRatingStars: 1.7, titleOutcomes: [],
  });
  ok(weakMatchHotCrowd.tone === "ROUGH" && /fans|audience/i.test(weakMatchHotCrowd.verdict),
    "weak wrestling with hot crowd got an unrealistic critical verdict");
  const missedBrief = reviewPlayerMatch({
    ...base, crowdResponse: 66, criticalRatingStars: 2.4,
    styleResult: { delivery: "MISSED" },
  } as unknown as PlayerShowMatchView);
  ok(missedBrief.recap.includes("ambitious approach never quite came together")
    && /ambition|delivery/.test(missedBrief.verdict),
    "style mismatch did not affect the report despite being in the result");
});

test("angle reviews use wrestling-language appropriate to segments and preserve unknown history", () => {
  const promo = {
    segmentId: "editorial-flat-promo", type: "PROMO",
    participants: [{ personId: "speaker", name: "The Speaker" }],
    promoPurpose: "AIR_GRIEVANCE", crowdResponse: 24,
    outcomeBand: "POOR",
  } as unknown as PlayerShowSegmentView;
  const flat = reviewPlayerSegment(promo);
  ok(flat.tone === "ROUGH" && /promo|audience|microphone|crowd|room/i.test(flat.verdict)
    && !/bout|mat work|between the ropes/i.test(flat.verdict),
    "a poor promo was reviewed like a wrestling match");
  const hot = reviewPlayerSegment({ ...promo, outcomeBand: "HOT", crowdResponse: 91 });
  ok(hot.tone === "GREAT" && !/bout|mat work|between the ropes/i.test(hot.verdict),
    "a great promo got an irrelevant match verdict");
  const oldInvite = reviewPlayerSegment({
    ...promo, type: "STABLE_INVITATION", stableInvitationOutcome: null,
    initiatorPersonId: "speaker", targetPersonId: "unknown",
    outcomeBand: null, crowdResponse: null,
  });
  ok(oldInvite.recap.includes("not recorded") && !oldInvite.recap.includes("refused"),
    "unknown historic invitation outcome was incorrectly rendered as a refusal");
  ok(oldInvite.verdict.includes("doesn't tell us"),
    "historical null crowd result was judged rather than disclosed as unknown");
  const oldChallenge = reviewPlayerSegment({
    ...promo, type: "CHALLENGE", challengeResponse: null,
    initiatorPersonId: "speaker", targetPersonId: "unknown",
  });
  ok(oldChallenge.recap.includes("no answer was recorded"),
    "historic challenge without an authored response became an implied refusal");
  const variants = new Set(Array.from({ length: 40 }, (_, i) => (
    reviewPlayerSegment({ ...promo, segmentId: "review-promo-" + i, outcomeBand: "POOR" }).verdict
  )));
  ok(variants.size >= 3, "editorial feedback was identical across many separate show angles");
});


test("specific booked angle details appear in recaps without inventing a result", () => {
  const roster = [
    { personId: "hero", name: "The Hero" },
    { personId: "heel", name: "The Heel" },
  ];
  const assault = {
    segmentId: "after-bell-attack",
    type: "POST_MATCH_ASSAULT", participants: roster,
    attackerPersonId: "heel", victimPersonId: "hero",
    attackPresentation: "BLINDSIDE", postMatchAssaultEnding: "OFFICIALS_SEPARATE",
    crowdResponse: 78, outcomeBand: "HOT",
  } as unknown as PlayerShowSegmentView;
  const recap = reviewPlayerSegment(assault);
  ok(recap.recap.includes("After the bell:") && recap.recap.includes("The Heel blindsided The Hero"),
    "after-match blindsiding lost the authored attack presentation");
  ok(recap.recap.includes("Officials separated"),
    "after-match assault forgot the specific closing beat");
  const celebration = reviewPlayerSegment({
    ...assault, type: "CELEBRATION",
    celebrationOccasion: "SELF_CORONATION", celebrationEnding: "POSE",
  });
  ok(celebration.recap.includes("All bravado, no official title change"),
    "scripted self-coronation was treated like a real championship win");
  ok(celebration.recap.includes("struck a pose"),
    "booked celebration ending was omitted");
  const interview = reviewPlayerSegment({
    ...assault, type: "INTERVIEW",
    interviewTopic: "RIVALRY_PRESSURE", interviewResponse: "DEFIANT",
  });
  ok(interview.recap.includes("pressure of their rivalry") && interview.recap.includes("answered defiantly"),
    "interview context or scripted answer was omitted");
  ok(!interview.recap.includes("blindsided"), "interview inherited unrelated attack text");
});


test("player show chapter breaks trace actual running order without invented moments", () => {
  function match(order: number, props: Record<string, unknown> = {}) {
    return { kind: "MATCH" as const, order, match: {
      matchId: "chapter-match-" + order, order,
      type: "SINGLES", criticalRatingStars: 3, winnerNames: ["Winner " + order],
      actualFinish: "CLEAN_PIN", titleOutcomes: [], injuries: [], ...props,
    } as unknown as PlayerShowMatchView };
  }
  function segment(order: number, props: Record<string, unknown> = {}) {
    return { kind: "SEGMENT" as const, order, segment: {
      segmentId: "chapter-segment-" + order, type: "PROMO",
      participants: [], videoReveal: null, ...props,
    } as unknown as PlayerShowSegmentView };
  }
  const show = { eventId: "chapters-eight", runningOrder: [
    match(1),
    match(2, { titleOutcomes: [{ titleChanged: true,
      championshipName: "World Title", winnerHolderName: "New Champion" }] }),
    match(3, { injuries: [{ injuryId: "broken", personName: "Injured Star", weeksOut: 3 }] }),
    segment(4, { type: "TURN", participants: [{ personId: "turner", name: "Turner" }],
      turnPersonId: "turner", turnTargetAlignment: "HEEL" }),
    match(5),
    match(6, { actualFinish: "FOREIGN_OBJECT" }),
    segment(7, { type: "VIDEO_PACKAGE", videoReveal: "CRYPTIC", videoSubjectName: "Secret Identity" }),
    match(8),
  ] } as unknown as Pick<PlayerShowResultView, "eventId" | "runningOrder">;
  const baseline = JSON.stringify(show);
  const chapters = reviewPlayerShowChapters(show);
  ok(chapters.length === 3 && chapters.map((c) => c.startOrder).join(",") === "1,3,6",
    "chapter breaks did not follow actual 8-slot running order");
  ok(chapters[0]!.recap.includes("New Champion") && chapters[0]!.recap.includes("World Title"),
    "title change did not lead its own chapter");
  ok(chapters[1]!.recap.includes("Injured Star"),
    "an actual injury did not shape the middle chapter");
  ok(chapters[2]!.recap.includes("foreign object"),
    "actual dirty finish was ignored for the final stretch");
  ok(!JSON.stringify(chapters).includes("Secret Identity"),
    "a cryptic video subject leaked into the editorial chapter recap");
  ok(JSON.stringify(reviewPlayerShowChapters(structuredClone(show))) === JSON.stringify(chapters),
    "chapters varied between reloads");
  ok(JSON.stringify(show) === baseline, "chapter narration changed the completed-show source");
  ok(reviewPlayerShowChapters({ eventId: "tiny", runningOrder: show.runningOrder.slice(0, 3) }).length === 0,
    "short shows received artificial multi-act padding");
  const twoPart = reviewPlayerShowChapters({ eventId: "medium", runningOrder: show.runningOrder.slice(0, 5) });
  ok(twoPart.length === 2 && twoPart[0]!.startOrder === 1 && twoPart[1]!.startOrder === 3,
    "medium-size shows did not get sensible opening and closing chapters");
});



test("final bell chooses an earned standout and poor performance without fabricating fallout", () => {
  function bout(order: number, rating: number, details: Record<string, unknown> = {}) {
    return { kind: "MATCH" as const, order, match: {
      matchId: "final-match-" + order, order,
      criticalRatingStars: rating, winnerNames: ["Winner " + order],
      participants: [{ personId: "a" + order, name: "Winner " + order, side: "A" },
        { personId: "b" + order, name: "Opponent " + order, side: "B" }],
      titleOutcomes: [], injuries: [], ...details,
    } as unknown as PlayerShowMatchView };
  }
  const show = {
    eventId: "final-event", crowdResponse: 74, averageMatchRating: 3.0,
    runningOrder: [
      bout(1, 1.8),
      bout(2, 4.7, { titleOutcomes: [{
        titleChanged: false, championshipName: "World Title", winnerHolderName: "Winner 2",
      }] }),
      bout(3, 3.1),
    ],
  } as Pick<PlayerShowResultView, "eventId" | "runningOrder" | "crowdResponse" | "averageMatchRating">;
  const original = JSON.stringify(show);
  const finale = reviewPlayerShowFinalBell(show);
  ok(finale.standout?.slotOrder === 2 && finale.standout.detail.includes("★ 4.7"),
    "final review didn't spotlight actual highest-rated match");
  ok(finale.disappointment?.slotOrder === 1
    && finale.disappointment.detail.includes("★ 1.8"),
    "final review failed to call out an actual poor match");
  ok(finale.consequence === null, "retaining a championship created an invented title change");
  ok(JSON.stringify(reviewPlayerShowFinalBell(structuredClone(show))) === JSON.stringify(finale),
    "final bell review changed across reloads");
  ok(JSON.stringify(show) === original, "the review mutated immutable completed results");
  const goodCard = reviewPlayerShowFinalBell({
    ...show, runningOrder: [bout(1, 3.1), bout(2, 4.4)],
  });
  ok(goodCard.disappointment === null,
    "a good card was given a fabricated disappointing match");
});

test("final bell respects real title changes, injuries, scripted turns and historical blank cards", () => {
  function bout(order: number, titleChanged: boolean, injured = false) {
    return { kind: "MATCH" as const, order, match: {
      matchId: "fallout-match-" + order, criticalRatingStars: 3.4,
      winnerNames: ["Champion"], participants: [],
      titleOutcomes: [{ titleChanged, championshipName: "World Title", winnerHolderName: "Champion" }],
      injuries: injured ? [{ injuryId: "inj", personName: "Injured Wrestler", weeksOut: 2 }] : [],
    } as unknown as PlayerShowMatchView };
  }
  const angle = {
    kind: "SEGMENT" as const, order: 3, segment: {
      segmentId: "turn-angle", type: "TURN",
      participants: [{ personId: "bad", name: "The Betrayer" }],
      turnPersonId: "bad", turnTargetAlignment: "HEEL", outcomeBand: "HOT", crowdResponse: 81,
    } as unknown as PlayerShowSegmentView,
  };
  const seed = {
    eventId: "fallout-event", crowdResponse: 70, averageMatchRating: 3.4,
    runningOrder: [bout(1, true, true), bout(2, false), angle],
  };
  const result = reviewPlayerShowFinalBell(seed);
  ok(result.consequence?.headline === "We have a new champion!"
    && result.consequence.detail.includes("World Title"), "real title change did not lead fallouts");
  const injury = reviewPlayerShowFinalBell({ ...seed, runningOrder: [bout(1, false, true), angle] });
  ok(injury.consequence?.headline.includes("Injured Wrestler")
    && injury.consequence.detail.includes("2 PPW weeks"), "injury fallout was not faithfully reported");
  const turned = reviewPlayerShowFinalBell({ ...seed, runningOrder: [bout(1, false), angle] });
  ok(turned.consequence?.headline.includes("The Betrayer")
    && turned.consequence.detail.includes("heel"), "recorded heel turn was lost");
  const old = reviewPlayerShowFinalBell({
    ...seed, runningOrder: [{ kind: "SEGMENT" as const, order: 1, segment: {
      segmentId: "cryptic-old", type: "VIDEO_PACKAGE",
      participants: [], videoReveal: "CRYPTIC", videoSubjectName: "Hidden Name",
      crowdResponse: null, outcomeBand: null,
    } as unknown as PlayerShowSegmentView }],
  });
  ok(old.standout === null && old.disappointment === null && old.consequence === null,
    "incomplete historical card produced fictional positives, negatives or consequences");
  ok(!JSON.stringify(old).includes("Hidden Name"), "cryptic talent was leaked by final bell");
});



test("complete-show copy desk avoids repeated verdicts without rewriting match or angle facts", () => {
  const runningOrder = Array.from({ length: 12 }, (_, index) => {
    const order = index + 1;
    if (order % 3 === 0) {
      return { kind: "MATCH" as const, order, match: {
        matchId: "long-card-match-" + order,
        type: "SINGLES", intent: "TECHNICAL", criticalRatingStars: 3.5,
        crowdResponse: 67, winnerNames: ["Winner " + order], actualFinish: "CLEAN_PIN",
        titleOutcomes: [], injuries: [], interference: null, styleResult: null,
      } as unknown as PlayerShowMatchView };
    }
    return { kind: "SEGMENT" as const, order, segment: {
      segmentId: "long-card-angle-" + order,
      type: "PROMO", participants: [{ personId: "speaker-" + order, name: "Speaker " + order }],
      promoPurpose: "BOAST", outcomeBand: "HOT", crowdResponse: 87,
    } as unknown as PlayerShowSegmentView };
  });
  const show = { eventId: "long-card-review", runningOrder };
  const before = JSON.stringify(show);
  const first = reviewPlayerShowRunningOrder(show);
  ok(first.length === runningOrder.length, "whole-card editor lost a recorded running-order slot");
  for (let i = 0; i < first.length; i += 1) {
    const current = first[i]!;
    ok(current.order === i + 1 && current.kind === runningOrder[i]!.kind,
      "whole-card editor reordered or changed a performed segment");
    const recent = first.slice(Math.max(0, i - 4), i).map((entry) => entry.review.verdict);
    ok(!recent.includes(current.review.verdict),
      "whole-card review repeated a stock verdict within four consecutive slots");
    ok(current.review.recap === (current.kind === "MATCH"
      ? reviewPlayerMatch((runningOrder[i] as Extract<typeof runningOrder[number], { kind: "MATCH" }>).match).recap
      : reviewPlayerSegment((runningOrder[i] as Extract<typeof runningOrder[number], { kind: "SEGMENT" }>).segment).recap),
      "copy edit overwrote a factual booked match or angle recap");
  }
  ok(JSON.stringify(show) === before, "editorial variation mutated immutable show history");
  ok(JSON.stringify(reviewPlayerShowRunningOrder(structuredClone(show))) === JSON.stringify(first),
    "complete-show reviews were inconsistent across sessions");
});


test("player match prose does not expose booking diagnostics as wrestling commentary", () => {
  const styles = ["TECHNICAL", "HIGH_RISK", "EPIC", "STORY", "PROTECTIVE", "DOMINANT", "SHOWCASE", "COMPETITIVE"] as const;
  const prohibited = /\bbooked (?:to|like)\b|\bbooking sheet\b|\bplanned style\b|\bstyle shortfall\b|\bcapability score\b|\bprogramme-linked\b|\bsimulation\b/i;
  for (const intent of styles) {
    for (let index = 0; index < 12; index += 1) {
      const review = reviewPlayerMatch({
        matchId: "kayfabe-" + intent + "-" + index, intent,
        winnerNames: ["The Winner"], criticalRatingStars: 3.4,
        crowdResponse: 65, actualFinish: "CLEAN_PIN",
        finishCheater: null, titleOutcomes: [], injuries: [], interference: null, styleResult: null,
      } as unknown as PlayerShowMatchView);
      ok(!prohibited.test(review.recap), "wrestling review exposed booking internals for " + intent);
    }
  }
  const stoppage = reviewPlayerMatch({
    matchId: "kayfabe-injury", intent: "STORY", winnerNames: [],
    criticalRatingStars: 2.4, crowdResponse: 47,
    actualFinish: "INJURY_STOPPAGE", titleOutcomes: [], injuries: [],
    interference: null, styleResult: null,
  } as unknown as PlayerShowMatchView);
  ok(stoppage.recap.includes("stopped the match after an injury")
    && !stoppage.recap.includes("planned finish"),
    "injury stoppage narration exposed the abandoned booking instruction");
});


test("player event copy connects real match trends with recorded major moments", () => {
  function bout(order: number, rating: number, more: Record<string, unknown> = {}) {
    return { kind: "MATCH" as const, order, match: {
      matchId: "event-bout-" + order, order,
      type: "SINGLES", intent: "COMPETITIVE",
      winnerNames: ["Winner " + order], criticalRatingStars: rating,
      participants: [{ personId: "w" + order, name: "Winner " + order, side: "A" }],
      titleOutcomes: [], injuries: [], ...more,
    } as unknown as PlayerShowMatchView };
  }
  function angle(order: number, more: Record<string, unknown> = {}) {
    return { kind: "SEGMENT" as const, order, segment: {
      segmentId: "event-angle-" + order,
      type: "PROMO", participants: [{ personId: "speaker", name: "The Speaker" }],
      outcomeBand: "MIXED", crowdResponse: 65,
      ...more,
    } as unknown as PlayerShowSegmentView };
  }
  const seed = {
    eventId: "opening-story", crowdResponse: 76, averageMatchRating: 3.3,
    titleChangeCount: 0, injuryCount: 0, matchCount: 4, segmentCount: 1,
    runningOrder: [bout(1, 2.1), angle(2), bout(3, 3.0), bout(4, 3.8), bout(5, 4.4)],
  };
  const saved = JSON.stringify(seed);
  const lateSurge = reviewPlayerShowNarrative(seed);
  ok(lateSurge.recap.includes("Winner 5"), "best recorded bout did not shape the show narrative");
  ok(/improved|closing stretch/.test(lateSurge.recap),
    "clearly improving card was not treated as a full-show arc");
  ok(JSON.stringify(reviewPlayerShowNarrative(structuredClone(seed))) === JSON.stringify(lateSurge),
    "full-show storytelling changed between historical reloads");
  ok(JSON.stringify(seed) === saved, "player-show narrative changed immutable recorded data");
  const fading = reviewPlayerShowNarrative({
    ...seed, runningOrder: [bout(1, 4.7), bout(2, 3.5), bout(3, 2.2)],
  });
  ok(/early matches|started stronger/.test(fading.recap),
    "falling match ratings were misreported as a late show recovery");
  const crowned = reviewPlayerShowNarrative({
    ...seed, titleChangeCount: 1, injuryCount: 1,
    runningOrder: [
      bout(1, 3.2, { injuries: [{ injuryId: "i", personName: "Injured Star", weeksOut: 2 }] }),
      bout(2, 3.8, { titleOutcomes: [{
        titleChanged: true, championshipName: "World Championship",
        winnerHolderName: "New Champion",
      }] }),
      angle(3, { type: "VIDEO_PACKAGE", videoReveal: "CRYPTIC",
        participants: [{ personId: "secret", name: "Secret Name" }],
        videoSubjectName: "Secret Name" }),
    ],
  });
  ok(crowned.headline.includes("New Champion") && crowned.recap.includes("World Championship"),
    "real title change did not become a headline");
  ok(crowned.recap.includes("injury"), "recorded injury disappeared under title coverage");
  ok(!JSON.stringify(crowned).includes("Secret Name"),
    "cryptic video identity leaked into the show front page");
  const noWrestling = reviewPlayerShowNarrative({
    ...seed, matchCount: 0, segmentCount: 1,
    runningOrder: [angle(1, { type: "VIDEO_PACKAGE", videoReveal: "CRYPTIC",
      participants: [{ personId: "secret", name: "Secret Name" }],
      videoSubjectName: "Secret Name", outcomeBand: "HOT", crowdResponse: 89 })],
  });
  ok(!JSON.stringify(noWrestling).includes("Secret Name"),
    "angle-only cryptic show revealed a private wrestler");
  ok(!/match of the night|won a highly rated contest/i.test(noWrestling.recap),
    "angle-only show invented wrestling matches");
  ok(noWrestling.headline === "The angles do the talking",
    "an angle-only show was given a misleading match-centric cover story");
  ok(crowned.recap.split("An injury").length === 2,
    "title-and-injury show repeated the same medical fallout twice");
});



test("archived turns with no alignment cannot become fictional headline or fallout", () => {
  const orphanTurn = {
    kind: "SEGMENT" as const, order: 1, segment: {
      segmentId: "archived-no-alignment",
      type: "TURN", participants: [{ personId: "star", name: "The Star" }],
      turnPersonId: "star", turnTargetAlignment: undefined,
      outcomeBand: null, crowdResponse: null,
    } as unknown as PlayerShowSegmentView,
  };
  const show = {
    eventId: "archived-turn-no-value", runningOrder: [orphanTurn],
    crowdResponse: 50, averageMatchRating: 0,
    titleChangeCount: 0, injuryCount: 0, matchCount: 0, segmentCount: 1,
  };
  const opening = reviewPlayerShowNarrative(show);
  ok(!opening.headline.includes("The Star") && !opening.recap.includes("turned"),
    "unresolved old turn became a front-page heel/face change");
  const end = reviewPlayerShowFinalBell(show);
  ok(end.consequence === null && end.lastWord.includes("angles"),
    "an incomplete historic turn became real fallout or generated a match-only signoff");
});


test("cryptic results participant strip conceals the unrevealed wrestler", () => {
  const base = {
    type: "VIDEO_PACKAGE" as const, videoReveal: "CRYPTIC" as const,
    participants: [{ personId: "secret", name: "The Mystery Wrestler" }],
    videoSubjectName: "The Mystery Wrestler",
  };
  const before = JSON.stringify(base);
  const secret = reviewSegmentVisibleNames(base);
  ok(secret.length === 1 && secret[0] === "Mystery footage",
    "the public Results participant strip exposed a cryptic teaser's wrestler");
  const revealed = reviewSegmentVisibleNames({ ...base, videoReveal: "NAMED" });
  ok(revealed.includes("The Mystery Wrestler"),
    "a deliberately named video failed to show its subject");
  const old = reviewSegmentVisibleNames({ ...base, videoReveal: null });
  ok(old.length === 1 && old[0] === "Mystery footage",
    "archived unlabelled video exposed a subject that was never publicly identified");
  const archived = {
    type: "VIDEO_PACKAGE" as const, order: 1, segment: {
      segmentId: "archival-video-unknown-reveal", type: "VIDEO_PACKAGE",
      videoReveal: null, videoSubjectName: "The Mystery Wrestler",
      participants: [{ personId: "secret", name: "The Mystery Wrestler" }],
      outcomeBand: "HOT", crowdResponse: 84,
    } as unknown as PlayerShowSegmentView,
  };
  const archivedShow = {
    eventId: "archival-video-show", runningOrder: [archived],
    crowdResponse: 74, averageMatchRating: 0,
    titleChangeCount: 0, injuryCount: 0, matchCount: 0, segmentCount: 1,
  };
  ok(!JSON.stringify(reviewPlayerShowNarrative(archivedShow)).includes("The Mystery Wrestler"),
    "archived video subject leaked into show narrative");
  ok(!JSON.stringify(reviewPlayerSegment(archived.segment)).includes("The Mystery Wrestler"),
    "archived video subject leaked into angle recap");
  ok(!JSON.stringify(showResultHighlights(archivedShow)).includes("The Mystery Wrestler"),
    "archived video subject leaked into event headlines");
  const promo = reviewSegmentVisibleNames({
    ...base, type: "PROMO", videoReveal: null,
  });
  ok(promo.includes("The Mystery Wrestler"), "ordinary angle participants were unnecessarily hidden");
  ok(JSON.stringify(base) === before,
    "display-only participant filtering modified the saved authored angle");
});
console.log(`\nApplication results-view tests: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exitCode = 1;
