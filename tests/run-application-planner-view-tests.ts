declare const process: { exitCode?: number };

import {
  buildPlayerSixWeekPlannerView,
  claimIndependentPromotionForPlayer,
  createWorldCommandState,
  createWorldOwnershipState,
  createWorldPlanningState,
  createWorldRuntimeState,
  joinPlayerToWorld,
  upsertDetailedShowDraft,
  type ApplicationWorldAggregate,
  type DetailedShowDraft,
} from "../packages/application/src/index.js";
import { DEFAULT_RULESET } from "../packages/config/src/default-ruleset.js";
import { addPpwWeeks, createWorld } from "../packages/sim-core/src/index.js";

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
  const personA = state.contracts.find((contract) => contract.promotionId === promotions[0]!.id)?.personId;
  const personB = state.contracts.find((contract) => contract.promotionId === promotions[1]!.id)?.personId;
  if (!personA || !personB) throw new Error("planner fixture promotions need contracted talent");

  const draftA: DetailedShowDraft = {
    draftId: "planner-a-week-3",
    promotionId: promotions[0]!.id,
    targetDate: targetA,
    marketId: marketA.id,
    venueId: venueA.id,
    ticketStrategy: "STANDARD",
    participantIds: [personA],
    matches: [],
    championshipAssignments: [],
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
  const planned = view.promotion?.weeks[2]?.shows[0];
  ok(planned?.draftId === "planner-a-week-3", "player draft did not appear in its future week");
  ok(planned?.participants.length === 1, "planner did not expose selected wrestler names");
  ok(planned?.marketName !== null && planned?.venueName !== null, "planner did not expose selected logistics");
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

test("six-week planner crosses PPW year boundaries correctly", () => {
  const { aggregate } = twoPlayerFixture(73003);
  aggregate.state.world.currentDate = { year: 1, week: 50, day: 1 };
  const view = buildPlayerSixWeekPlannerView(aggregate, "player-a");
  ok(view.promotion?.weeks[0]?.year === 1 && view.promotion.weeks[0]?.week === 50, "planner lost current week at year end");
  ok(view.promotion?.weeks[3]?.year === 2 && view.promotion.weeks[3]?.week === 1, "planner did not roll into the next PPW year");
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
