declare const process: { exitCode?: number };

import {
  buildPlayerChampionshipHistoryView,
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
  if (!promotion) throw new Error("championship-history fixture needs an Independent promotion");
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

test("championship history exposes ordered person and team lineage", () => {
  const { aggregate, promotionId } = fixture(73301);
  const people = aggregate.state.people.slice(0, 2);
  ok(people.length === 2, "fixture needs two wrestlers");
  aggregate.state.teams = aggregate.state.teams ?? [];
  aggregate.state.teams.push({
    id: "history-team",
    worldId: aggregate.state.world.id,
    name: "History Test Team",
    status: "ACTIVE",
    formedDate: { year: 1, week: 1, day: 1 },
    disbandedDate: null,
  });
  aggregate.state.championships = aggregate.state.championships ?? [];
  aggregate.state.championshipReigns = aggregate.state.championshipReigns ?? [];
  aggregate.state.championships.push({
    id: "history-title",
    worldId: aggregate.state.world.id,
    promotionId,
    name: "PPW History Championship",
    division: "TAG",
    status: "ACTIVE",
    prestige: 73,
    currentReignId: "history-reign-current",
    createdDate: { year: 1, week: 1, day: 1 },
  });
  aggregate.state.championshipReigns.push(
    {
      id: "history-reign-old",
      worldId: aggregate.state.world.id,
      championshipId: "history-title",
      holderType: "PERSON",
      holderId: people[0]!.id,
      status: "ENDED",
      startDate: { year: 1, week: 1, day: 1 },
      endDate: { year: 1, week: 2, day: 1 },
      wonMatchId: null,
      lostMatchId: null,
      defenses: 2,
      endReason: "LOST",
    },
    {
      id: "history-reign-current",
      worldId: aggregate.state.world.id,
      championshipId: "history-title",
      holderType: "TEAM",
      holderId: "history-team",
      status: "ACTIVE",
      startDate: { year: 1, week: 2, day: 1 },
      endDate: null,
      wonMatchId: null,
      lostMatchId: null,
      defenses: 4,
      endReason: null,
    },
  );

  const view = buildPlayerChampionshipHistoryView(aggregate, "player-a");
  const title = view.championships.find((candidate) => candidate.championshipId === "history-title");
  ok(title, "test championship missing from history view");
  ok(title!.currentHolderName === "History Test Team", "current team holder was not resolved");
  ok(title!.totalReigns === 2, "reign count was wrong");
  ok(title!.totalDefenses === 6, "defense total was wrong");
  ok(title!.lineage[0]?.reignId === "history-reign-current", "current reign was not first in lineage");
  ok(title!.lineage[0]?.isCurrent === true, "current reign was not marked current");
  ok(title!.lineage[1]?.holderName === people[0]!.name, "historical person holder was not resolved");
  ok(title!.lineage[1]?.endReason === "LOST", "historical end reason was not preserved");
});

test("championship history includes inactive titles without leaking rival private state", () => {
  const { aggregate, promotionId } = fixture(73302);
  const rival = aggregate.state.promotions.find((promotion) => (
    promotion.id !== promotionId && activeContractsForPromotion(aggregate.state, promotion.id).length > 0
  ));
  ok(rival, "fixture has no contracted rival promotion");
  const rivalContract = activeContractsForPromotion(aggregate.state, rival!.id)[0];
  ok(rivalContract, "rival contract missing");
  rival!.cash = 991_337_001;
  rival!.debt = 991_337_002;
  rivalContract!.weeklyGuarantee = 991_337_003;
  rivalContract!.appearanceFee = 991_337_004;

  aggregate.state.championships = aggregate.state.championships ?? [];
  aggregate.state.championshipReigns = aggregate.state.championshipReigns ?? [];
  aggregate.state.championships.push({
    id: "retired-history-title",
    worldId: aggregate.state.world.id,
    promotionId: rival!.id,
    name: "Retired History Championship",
    division: "SINGLES",
    status: "INACTIVE",
    prestige: 41,
    currentReignId: null,
    createdDate: { year: 1, week: 1, day: 1 },
  });
  aggregate.state.championshipReigns.push({
    id: "retired-history-reign",
    worldId: aggregate.state.world.id,
    championshipId: "retired-history-title",
    holderType: "PERSON",
    holderId: rivalContract!.personId,
    status: "ENDED",
    startDate: { year: 1, week: 1, day: 1 },
    endDate: { year: 1, week: 3, day: 1 },
    wonMatchId: null,
    lostMatchId: null,
    defenses: 1,
    endReason: "VACATED",
  });

  const view = buildPlayerChampionshipHistoryView(aggregate, "player-a");
  const retired = view.championships.find((candidate) => candidate.championshipId === "retired-history-title");
  ok(retired?.status === "INACTIVE", "inactive championship was omitted");
  ok(retired?.lineage.length === 1, "inactive title lineage was omitted");
  const serialized = JSON.stringify(view);
  for (const sentinel of ["991337001", "991337002", "991337003", "991337004"]) {
    ok(!serialized.includes(sentinel), `private rival value ${sentinel} leaked into championship history`);
  }
  ok(!serialized.includes(rivalContract!.id), "rival contract ID leaked into championship history");
  ok(!serialized.includes("weeklyGuarantee"), "rival contract schema leaked into championship history");
});

test("non-members cannot read championship history", () => {
  const { aggregate } = fixture(73303);
  let rejected = false;
  try {
    buildPlayerChampionshipHistoryView(aggregate, "stranger");
  } catch (error) {
    rejected = error instanceof Error && error.message.includes("not an active member");
  }
  ok(rejected, "non-member could read championship history");
});

console.log(`\nApplication championship-history tests: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exitCode = 1;
