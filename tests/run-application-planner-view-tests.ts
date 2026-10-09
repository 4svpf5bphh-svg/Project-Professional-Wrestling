declare const process: { exitCode?: number };

import {
  buildPlayerSixWeekPlannerView,
  buildPlayerWorldCalendarView,
  claimIndependentPromotionForPlayer,
  createWorldCommandState,
  createWorldOwnershipState,
  createWorldPlanningState,
  createWorldRuntimeState,
  joinPlayerToWorld,
  lockCurrentWeekShowCommitments,
  upsertDetailedShowDraft,
  type ApplicationWorldAggregate,
  type DetailedShowDraft,
} from "../packages/application/src/index.js";
import { DEFAULT_RULESET } from "../packages/config/src/default-ruleset.js";
import { addPpwWeeks, createWorld } from "../packages/sim-core/src/index.js";
import { plannerFocusedWeekKey } from "../apps/web/app/planner/planner-focus.js";

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
  if (promotions.length < 2) throw new Error("planner fixture needs two Independent promotions");
  claimIndependentPromotionForPlayer(state, ownership, "player-a", promotions[0]!.id);
  claimIndependentPromotionForPlayer(state, ownership, "player-b", promotions[1]!.id);

  const planning = createWorldPlanningState(state.world.id);
  const targetA = addPpwWeeks({ ...state.world.currentDate, day: 6 }, 2, state.ruleset.weeksPerYear);
  const targetB = addPpwWeeks({ ...state.world.currentDate, day: 5 }, 3, state.ruleset.weeksPerYear);
  const marketA = state.markets.find((market) => market.id === promotions[0]!.homeMarketId) ?? state.markets[0]!;
  const marketB = state.markets.find((market) => market.id === promotions[1]!.homeMarketId) ?? state.markets[1]!;
  const venueA = state.venues.find((venue) => venue.marketId === marketA.id) ?? state.venues[0]!;
  const venueB = state.venues.find((venue) => venue.marketId === marketB.id) ?? state.venues[1]!;
  const personAIds = state.contracts
    .filter((contract) => contract.promotionId === promotions[0]!.id && contract.status === "SIGNED")
    .map((contract) => contract.personId)
    .filter((personId, index, all) => all.indexOf(personId) === index)
    .slice(0, 2);
  const personB = state.contracts.find((contract) => contract.promotionId === promotions[1]!.id)?.personId;
  if (personAIds.length < 2 || !personB) throw new Error("planner fixture promotions need contracted talent");

  const draftA: DetailedShowDraft = {
    draftId: "planner-a-week-3",
    promotionId: promotions[0]!.id,
    targetDate: targetA,
    marketId: marketA.id,
    venueId: venueA.id,
    ticketStrategy: "STANDARD",
    participantIds: personAIds,
    matches: [{
      draftMatchId: "planner-a-match-1",
      type: "SINGLES",
      sideAIds: [personAIds[0]!],
      sideBIds: [personAIds[1]!],
      intendedWinnerSide: "A",
      intent: "COMPETITIVE",
      plannedLengthMinutes: 17,
    }],
    championshipAssignments: [],
    segments: [{
      draftSegmentId: "planner-a-segment-1",
      type: "CONFRONTATION",
      participantIds: [...personAIds],
      programmeId: null,
      plannedLengthMinutes: 6,
    }],
    runningOrder: [
      { kind: "SEGMENT", refId: "planner-a-segment-1" },
      { kind: "MATCH", refId: "planner-a-match-1" },
    ],
  };
  const draftB: DetailedShowDraft = {
    draftId: "planner-b-week-4",
    promotionId: promotions[1]!.id,
    targetDate: targetB,
    marketId: marketB.id,
    venueId: venueB.id,
    ticketStrategy: "PREMIUM",
    participantIds: [personB],
    matches: [],
    championshipAssignments: [],
  };
  upsertDetailedShowDraft(state, planning, promotions[0]!.id, 0, draftA);
  upsertDetailedShowDraft(state, planning, promotions[1]!.id, 0, draftB);

  return {
    aggregate: {
      state,
      ownership,
      commands: createWorldCommandState(state.world.id),
      runtime: createWorldRuntimeState(state.world.id),
      planning,
    },
    promotionAId: promotions[0]!.id,
    promotionBId: promotions[1]!.id,
  };
}

test("six-week planner returns the complete current plus five future week horizon", () => {
  const { aggregate, promotionAId } = twoPlayerFixture(73001);
  const view = buildPlayerSixWeekPlannerView(aggregate, "player-a");
  ok(view.player.promotionId === promotionAId, "planner projection returned the wrong controlled promotion");
  ok(view.promotion?.weeks.length === 6, "planner did not expose six PPW weeks");
  ok(view.promotion?.weeks[0]?.isCurrentWeek === true, "first planner week is not the current week");
  ok(view.promotion?.weeks[5]?.offset === 5, "planner did not expose the fifth future week");
  const dueWeeks = view.promotion?.weeks.filter((week) => week.showRequired) ?? [];
  ok(dueWeeks.length > 0, "planner did not expose any required show weeks");
  ok(dueWeeks.every((week) => week.showSeries !== null), "required planner week did not expose its promotion-owned show identity");
  ok(
    dueWeeks.every((week) => week.showSeries?.eventType === "REGULAR" || week.showSeries?.eventType === "MAJOR"),
    "planner show identity exposed an invalid event type",
  );
  const planned = view.promotion?.weeks[2]?.shows[0];
  ok(planned?.draftId === "planner-a-week-3", "player draft did not appear in its future week");
  ok(planned?.participants.length === 2, "planner did not expose selected wrestler names");
  ok(planned?.marketName !== null && planned?.venueName !== null, "planner did not expose selected logistics");
  ok(planned?.matches.length === 1, "planner did not expose the saved match");
  ok(planned?.matches[0]?.order === 1 && planned.matches[0].isMainEvent, "planner did not identify the final match as the main event");
  ok(planned?.matches[0]?.sideANames.length === 1 && planned.matches[0].sideBNames.length === 1, "planner running order lost match participant names");
  ok(planned?.segments.length === 1, "planner did not expose the saved segment");
  ok(planned?.segments[0]?.participantNames.length === 2, "planner segment lost participant names");
  ok(planned?.runningOrder.length === 2, "planner did not expose the complete running order");
  ok(planned?.runningOrder[0]?.kind === "SEGMENT" && planned.runningOrder[1]?.kind === "MATCH", "planner changed the interleaved running order");
  ok(planned?.plannedMatchMinutes === 17, "planner did not total booked match minutes");
  ok(planned?.plannedSegmentMinutes === 6, "planner did not total segment minutes");
  ok(planned?.plannedShowMinutes === 23, "planner did not total complete show minutes");
  ok(planned?.matchCount === 1 && planned.segmentCount === 1 && planned.slotCount === 2, "planner slot counts are incorrect");
});


test("planner deep-link parser ignores absent or invalid week parameters", () => {
  ok(plannerFocusedWeekKey(null, null) === null, "plain /planner was treated as a Year 0 / Week 0 deep link");
  ok(plannerFocusedWeekKey("2", "11") === "2:11", "valid planner deep link was not preserved");
  ok(plannerFocusedWeekKey("", "11") === null, "empty year parameter was accepted");
  ok(plannerFocusedWeekKey("2", "0") === null, "invalid zero week parameter was accepted");
});

test("six-week planner remains scoped to each player's controlled promotion", () => {
  const { aggregate, promotionAId, promotionBId } = twoPlayerFixture(73002);
  const playerA = buildPlayerSixWeekPlannerView(aggregate, "player-a");
  const playerB = buildPlayerSixWeekPlannerView(aggregate, "player-b");
  const aDraftIds = playerA.promotion?.weeks.flatMap((week) => week.shows.map((show) => show.draftId)) ?? [];
  const bDraftIds = playerB.promotion?.weeks.flatMap((week) => week.shows.map((show) => show.draftId)) ?? [];
  ok(playerA.player.promotionId === promotionAId && playerB.player.promotionId === promotionBId, "planner controls crossed promotions");
  ok(aDraftIds.includes("planner-a-week-3") && !aDraftIds.includes("planner-b-week-4"), "player A leaked player B planning");
  ok(bDraftIds.includes("planner-b-week-4") && !bDraftIds.includes("planner-a-week-3"), "player B leaked player A planning");
});

test("planner market context exposes home territory, player presence and strongest local rivals", () => {
  const { aggregate, promotionAId, promotionBId } = twoPlayerFixture(73005);
  const promotionA = aggregate.state.promotions.find((promotion) => promotion.id === promotionAId)!;
  const promotionB = aggregate.state.promotions.find((promotion) => promotion.id === promotionBId)!;
  const awayMarketId = promotionB.homeMarketId;
  ok(awayMarketId !== promotionA.homeMarketId, "market context fixture needs different home markets");

  for (const entry of aggregate.state.promotionMarketStates.filter((candidate) => candidate.marketId === awayMarketId)) {
    entry.awareness = 8;
    entry.liveStrength = 8;
    entry.loyalty = 8;
  }
  const own = aggregate.state.promotionMarketStates.find((entry) => entry.promotionId === promotionAId && entry.marketId === awayMarketId)!;
  own.awareness = 18;
  own.liveStrength = 14;
  own.loyalty = 10;
  const rival = aggregate.state.promotionMarketStates.find((entry) => entry.promotionId === promotionBId && entry.marketId === awayMarketId)!;
  rival.awareness = 90;
  rival.liveStrength = 92;
  rival.loyalty = 88;

  const view = buildPlayerSixWeekPlannerView(aggregate, "player-a");
  const away = view.promotion?.markets.find((market) => market.marketId === awayMarketId);
  ok(away && !away.isHomeMarket, "rival home market was not identified as an away market");
  ok(away?.yourAwareness === 18 && away.yourLiveStrength === 14 && away.yourLoyalty === 10, "player local market state was not exposed accurately");
  ok(away?.yourPresence === "LIGHT", "weak player presence did not resolve to the expected broad band");
  ok(away?.homePromotions.some((promotion) => promotion.promotionId === promotionBId), "resident rival promotion was not identified");
  ok(away?.strongestRivals[0]?.promotionId === promotionBId, "strongest local rival was not ranked first");
  ok(away?.strongestRivals[0]?.isHomePromotion === true, "resident rival was not marked as home-based");
  ok(away?.strongestRivals[0]?.presence === "STRONG", "dominant rival presence did not resolve to the expected broad band");
  ok(
    away?.venues.every((venue) => Number.isFinite(venue.prestige) && Number.isFinite(venue.productionSuitability)),
    "planner venue options did not expose existing prestige and production suitability",
  );

  const home = view.promotion?.markets.find((market) => market.marketId === promotionA.homeMarketId);
  ok(home?.isHomeMarket === true, "controlled promotion home market lost its home flag");
});

test("six-week planner crosses PPW year boundaries correctly", () => {
  const { aggregate } = twoPlayerFixture(73003);
  aggregate.state.world.currentDate = { year: 1, week: 50, day: 1 };
  const view = buildPlayerSixWeekPlannerView(aggregate, "player-a");
  ok(view.promotion?.weeks[0]?.year === 1 && view.promotion.weeks[0]?.week === 50, "planner lost current week at year end");
  ok(view.promotion?.weeks[3]?.year === 2 && view.promotion.weeks[3]?.week === 1, "planner did not roll into the next PPW year");
});



test("shared World calendar exposes public show identities without leaking rival private planning", () => {
  const { aggregate, promotionAId, promotionBId } = twoPlayerFixture(73006);
  const view = buildPlayerWorldCalendarView(aggregate, "player-a", 6);

  ok(view.horizonWeeks === 6, "World calendar did not preserve its requested horizon");
  ok(view.occurrences.some((entry) => entry.promotionId === promotionAId && entry.isPlayerPromotion), "World calendar lost the player's own promotion");
  ok(view.occurrences.some((entry) => entry.promotionId === promotionBId && !entry.isPlayerPromotion), "World calendar did not expose another human promotion's public show identity");

  const rivalOccurrence = view.occurrences.find((entry) => entry.promotionId === promotionBId);
  ok(rivalOccurrence !== undefined, "fixture has no rival occurrence in the shared calendar");
  ok(rivalOccurrence?.eventId === null && rivalOccurrence.marketId === null && rivalOccurrence.venueId === null, "rival private planner logistics leaked into the public calendar");

  const ownOccurrence = view.occurrences.find((entry) => entry.promotionId === promotionAId);
  if (!ownOccurrence) throw new Error("fixture has no own occurrence in the shared calendar");
  const market = aggregate.state.markets.find((candidate) => candidate.id === aggregate.state.promotions.find((candidate) => candidate.id === promotionAId)!.homeMarketId)!;
  const venue = aggregate.state.venues.find((candidate) => candidate.marketId === market.id)!;
  const eventId = "calendar-public-event";
  aggregate.state.events.push({
    id: eventId,
    worldId: aggregate.state.world.id,
    promotionId: promotionAId,
    showSeriesId: ownOccurrence.showSeriesId,
    showOccurrenceId: ownOccurrence.occurrenceId,
    marketId: market.id,
    venueId: venue.id,
    date: { year: ownOccurrence.year, week: ownOccurrence.week, day: 6 },
    type: ownOccurrence.eventType,
    status: "SCHEDULED",
    ticketStrategy: "STANDARD",
    expectedDemand: 1000,
    attendance: 0,
    ticketYield: 20,
    gateRevenue: 0,
    totalCost: 0,
    netResult: 0,
    eventImportance: ownOccurrence.eventImportance,
    matchCount: 0,
    averageMatchRating: 0,
    bestMatchRating: 0,
    crowdResponse: 0,
  });

  const refreshed = buildPlayerWorldCalendarView(aggregate, "player-a", 6);
  const publicBooked = refreshed.occurrences.find((entry) => entry.occurrenceId === ownOccurrence.occurrenceId);
  ok(publicBooked?.eventId === eventId && publicBooked.status === "SCHEDULED", "canonical scheduled event did not appear on the World calendar");
  ok(publicBooked?.day === 6 && publicBooked.marketName === market.name && publicBooked.venueName === venue.name, "public booked occurrence did not expose its announced date/location");
});


test("World calendar disables current-week planning and calendar edits after commitment lock", () => {
  const { aggregate, promotionAId } = twoPlayerFixture(73007);
  const before = buildPlayerWorldCalendarView(aggregate, "player-a", 6);
  const currentOwn = before.occurrences.find((entry) => (
    entry.promotionId === promotionAId
    && entry.year === aggregate.state.world.currentDate.year
    && entry.week === aggregate.state.world.currentDate.week
  ));
  ok(before.player.canEdit, "calendar unexpectedly started read-only before commitment lock");
  ok(currentOwn?.canPlanNow === true, "current own occurrence was not plannable before commitment lock");

  lockCurrentWeekShowCommitments(aggregate.runtime, aggregate.state, "2026-10-09");
  const locked = buildPlayerWorldCalendarView(aggregate, "player-a", 6);
  const lockedCurrent = locked.occurrences.find((entry) => entry.occurrenceId === currentOwn?.occurrenceId);
  ok(locked.player.canEdit === false, "calendar remained editable after commitment lock");
  ok(lockedCurrent?.canPlanNow === false, "current-week occurrence remained plannable after commitment lock");
});

test("non-members cannot read a World planning horizon", () => {
  const { aggregate } = twoPlayerFixture(73004);
  let rejected = false;
  try {
    buildPlayerSixWeekPlannerView(aggregate, "stranger");
  } catch (error) {
    rejected = error instanceof Error && error.message.includes("not an active member");
  }
  ok(rejected, "non-member could read the six-week planner");
});

console.log(`\nApplication six-week planner tests: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exitCode = 1;