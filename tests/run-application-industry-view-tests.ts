declare const process: { exitCode?: number };

import {
  buildPlayerIndustryView,
  claimIndependentPromotionForPlayer,
  createWorldCommandState,
  createWorldOwnershipState,
  createWorldPlanningState,
  createWorldRuntimeState,
  joinPlayerToWorld,
  type ApplicationWorldAggregate,
} from "../packages/application/src/index.js";
import { DEFAULT_RULESET } from "../packages/config/src/default-ruleset.js";
import { activeContractsForPromotion, createWorld } from "../packages/sim-core/src/index.js";

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

function fixture(seed: number): { aggregate: ApplicationWorldAggregate; promotionId: string } {
  const state = createWorld(seed, DEFAULT_RULESET);
  const ownership = createWorldOwnershipState(state.world.id, 1);
  joinPlayerToWorld(ownership, "player-a", state.world.currentDate);
  const promotion = state.promotions.find((candidate) => (
    candidate.controllerType === "AI" && candidate.tier === "INDEPENDENT" && candidate.lifecycle === "ACTIVE"
  ));
  if (!promotion) throw new Error("industry fixture needs an Independent promotion");
  claimIndependentPromotionForPlayer(state, ownership, "player-a", promotion.id);
  return {
    aggregate: {
      state,
      ownership,
      commands: createWorldCommandState(state.world.id),
      runtime: createWorldRuntimeState(state.world.id),
      planning: createWorldPlanningState(state.world.id),
    },
    promotionId: promotion.id,
  };
}

test("industry view ranks and exposes public competitive identity for every promotion", () => {
  const { aggregate, promotionId } = fixture(73201);
  const view = buildPlayerIndustryView(aggregate, "player-a");
  ok(view.promotions.length === aggregate.state.promotions.length, "industry view omitted a promotion");
  const own = view.promotions.find((promotion) => promotion.promotionId === promotionId);
  ok(own?.isPlayerPromotion === true, "controlled promotion was not identified");
  const ranked = view.promotions.filter((promotion) => promotion.worldRank !== null);
  ok(ranked.every((promotion, index) => promotion.worldRank === index + 1), "industry ranks are not contiguous/in order");
  ok(view.promotions.every((promotion) => promotion.homeMarketName.length > 0), "promotion home market was not projected");
});

test("industry view exposes current roster names without rival contract terms or private finances", () => {
  const { aggregate, promotionId } = fixture(73202);
  const rival = aggregate.state.promotions.find((promotion) => promotion.id !== promotionId && promotion.lifecycle !== "CLOSED");
  ok(rival, "fixture has no rival promotion");
  rival!.cash = 987_654_321;
  rival!.debt = 876_543_219;
  rival!.weeklyMediaIncome = 765_432_198;
  rival!.weeklySponsorIncome = 654_321_987;
  rival!.weeklyFixedOverhead = 543_219_876;
  const rivalContract = activeContractsForPromotion(aggregate.state, rival!.id)[0];
  ok(rivalContract, "rival has no active contract");
  rivalContract!.weeklyGuarantee = 432_198_765;
  rivalContract!.appearanceFee = 321_987_654;
  rivalContract!.signingBonus = 219_876_543;

  const view = buildPlayerIndustryView(aggregate, "player-a");
  const rivalView = view.promotions.find((promotion) => promotion.promotionId === rival!.id);
  ok(rivalView, "rival promotion missing from industry view");
  const rivalPerson = aggregate.state.people.find((person) => person.id === rivalContract!.personId);
  ok(rivalPerson && rivalView!.featuredTalent.some((person) => person.personId === rivalPerson.id), "public rival roster identity was not surfaced");
  const serialized = JSON.stringify(rivalView);
  for (const sentinel of ["987654321", "876543219", "765432198", "654321987", "543219876", "432198765", "321987654", "219876543"]) {
    ok(!serialized.includes(sentinel), `private rival value ${sentinel} leaked into industry view`);
  }
  ok(!serialized.includes(rivalContract!.id), "rival contract ID leaked into industry view");
  ok(!serialized.includes("weeklyGuarantee"), "rival contract schema leaked into industry view");
  ok(!serialized.includes("aiProfile"), "AI internal strategy profile leaked into industry view");
});

test("industry view derives public championship and completed-show summaries", () => {
  const { aggregate } = fixture(73203);
  const promotion = aggregate.state.promotions.find((candidate) => candidate.lifecycle !== "CLOSED");
  ok(promotion, "fixture has no promotion");
  const contract = activeContractsForPromotion(aggregate.state, promotion!.id)[0];
  ok(contract, "promotion has no wrestler to hold test title");
  const venue = aggregate.state.venues.find((candidate) => candidate.marketId === promotion!.homeMarketId);
  ok(venue, "promotion has no home-market venue");
  aggregate.state.championships = aggregate.state.championships ?? [];
  aggregate.state.championshipReigns = aggregate.state.championshipReigns ?? [];
  aggregate.state.championships.push({
    id: "industry-title",
    worldId: aggregate.state.world.id,
    promotionId: promotion!.id,
    name: "Industry Test Championship",
    division: "SINGLES",
    status: "ACTIVE",
    prestige: 50,
    currentReignId: "industry-reign",
    createdDate: { ...aggregate.state.world.currentDate },
  });
  aggregate.state.championshipReigns.push({
    id: "industry-reign",
    worldId: aggregate.state.world.id,
    championshipId: "industry-title",
    holderType: "PERSON",
    holderId: contract!.personId,
    status: "ACTIVE",
    startDate: { ...aggregate.state.world.currentDate },
    endDate: null,
    wonMatchId: null,
    lostMatchId: null,
    defenses: 3,
    endReason: null,
  });
  aggregate.state.events.push({
    id: "industry-event",
    worldId: aggregate.state.world.id,
    promotionId: promotion!.id,
    marketId: promotion!.homeMarketId,
    venueId: venue!.id,
    date: { ...aggregate.state.world.currentDate },
    type: "MAJOR",
    status: "COMPLETED",
    ticketStrategy: "STANDARD",
    expectedDemand: 100,
    attendance: 94,
    ticketYield: 30,
    gateRevenue: 2_820,
    totalCost: 1_500,
    netResult: 1_320,
    eventImportance: 70,
    matchCount: 2,
    averageMatchRating: 4.1,
    bestMatchRating: 4.6,
    crowdResponse: 83,
  });

  const view = buildPlayerIndustryView(aggregate, "player-a");
  const publicPromotion = view.promotions.find((candidate) => candidate.promotionId === promotion!.id);
  ok(publicPromotion?.championships.some((title) => title.championshipId === "industry-title" && title.defenses === 3), "public championship summary missing");
  ok(publicPromotion?.recentShows.some((show) => show.eventId === "industry-event" && show.attendance === 94 && show.bestMatchRating === 4.6), "completed show summary missing");
  const serialized = JSON.stringify(publicPromotion);
  ok(!serialized.includes("2820"), "show gate revenue leaked into public industry profile");
  ok(!serialized.includes("1320"), "show net result leaked into public industry profile");
});

test("non-members cannot read Industry", () => {
  const { aggregate } = fixture(73204);
  let rejected = false;
  try {
    buildPlayerIndustryView(aggregate, "stranger");
  } catch (error) {
    rejected = error instanceof Error && error.message.includes("not an active member");
  }
  ok(rejected, "non-member could read industry view");
});

console.log(`\nApplication industry-view tests: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exitCode = 1;
