declare const process: { exitCode?: number };

import {
  buildPlayerTeamHistoryView,
  claimIndependentPromotionForPlayer,
  createWorldCommandState,
  createWorldOwnershipState,
  createWorldPlanningState,
  createWorldRuntimeState,
  joinPlayerToWorld,
  type ApplicationWorldAggregate,
} from "../packages/application/src/index.js";
import { DEFAULT_RULESET } from "../packages/config/src/default-ruleset.js";
import { createWorld } from "../packages/sim-core/src/index.js";

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
  if (!promotion) throw new Error("team-history fixture needs an Independent promotion");
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

function addHistoricalTeam(aggregate: ApplicationWorldAggregate, promotionId: string): void {
  const [first, second, former] = aggregate.state.people;
  if (!first || !second || !former) throw new Error("team-history fixture needs three wrestlers");
  aggregate.state.teams = aggregate.state.teams ?? [];
  aggregate.state.teamMemberships = aggregate.state.teamMemberships ?? [];
  aggregate.state.championships = aggregate.state.championships ?? [];
  aggregate.state.championshipReigns = aggregate.state.championshipReigns ?? [];

  aggregate.state.teams.push({
    id: "team-history-test",
    worldId: aggregate.state.world.id,
    name: "Night Shift",
    status: "ACTIVE",
    formedDate: { year: 1, week: 3, day: 1 },
    disbandedDate: null,
  });
  aggregate.state.teamMemberships.push(
    {
      id: "team-history-member-a",
      worldId: aggregate.state.world.id,
      teamId: "team-history-test",
      personId: first.id,
      joinedDate: { year: 1, week: 3, day: 1 },
      leftDate: null,
      active: true,
    },
    {
      id: "team-history-member-b",
      worldId: aggregate.state.world.id,
      teamId: "team-history-test",
      personId: second.id,
      joinedDate: { year: 1, week: 5, day: 1 },
      leftDate: null,
      active: true,
    },
    {
      id: "team-history-member-former",
      worldId: aggregate.state.world.id,
      teamId: "team-history-test",
      personId: former.id,
      joinedDate: { year: 1, week: 3, day: 1 },
      leftDate: { year: 1, week: 4, day: 1 },
      active: false,
    },
  );
  aggregate.state.championships.push({
    id: "team-history-title",
    worldId: aggregate.state.world.id,
    promotionId,
    name: "Test Tag Championship",
    division: "TAG",
    status: "ACTIVE",
    prestige: 63,
    currentReignId: "team-history-reign-current",
    createdDate: { year: 1, week: 2, day: 1 },
  });
  aggregate.state.championshipReigns.push(
    {
      id: "team-history-reign-old",
      worldId: aggregate.state.world.id,
      championshipId: "team-history-title",
      holderType: "TEAM",
      holderId: "team-history-test",
      status: "ENDED",
      startDate: { year: 1, week: 6, day: 1 },
      endDate: { year: 1, week: 9, day: 1 },
      wonMatchId: null,
      lostMatchId: null,
      defenses: 2,
      endReason: "LOST",
    },
    {
      id: "team-history-reign-current",
      worldId: aggregate.state.world.id,
      championshipId: "team-history-title",
      holderType: "TEAM",
      holderId: "team-history-test",
      status: "ACTIVE",
      startDate: { year: 1, week: 12, day: 1 },
      endDate: null,
      wonMatchId: null,
      lostMatchId: null,
      defenses: 4,
      endReason: null,
    },
  );
}

test("team history exposes identity, membership timeline and tag-title lineage", () => {
  const { aggregate, promotionId } = fixture(73301);
  addHistoricalTeam(aggregate, promotionId);

  const view = buildPlayerTeamHistoryView(aggregate, "player-a");
  const team = view.teams.find((entry) => entry.teamId === "team-history-test");
  ok(team, "historical team missing from team-history view");
  ok(team!.status === "ACTIVE", "team status was not projected");
  ok(team!.currentMembers.length === 2, "current team membership is wrong");
  ok(team!.memberHistory.length === 3, "membership history omitted a wrestler");
  ok(team!.memberHistory.some((member) => !member.active && member.leftDate !== null), "departed member history missing");
  ok(team!.championshipReigns.length === 2, "tag-title lineage omitted a reign");
  ok(team!.championshipReigns[0]?.isCurrent === true, "current tag-title reign was not ordered first");
  ok(team!.totalTitleReigns === 2, "team title-reign total is wrong");
  ok(team!.totalDefenses === 6, "team defense total is wrong");
});

test("team history does not leak private wrestler or contract-shaped data", () => {
  const { aggregate, promotionId } = fixture(73302);
  addHistoricalTeam(aggregate, promotionId);
  const first = aggregate.state.people[0];
  if (!first) throw new Error("privacy fixture missing wrestler");
  first.morale = 987_654_321;
  first.fatigue = 876_543_219;
  first.wear = 765_432_198;

  const serialized = JSON.stringify(buildPlayerTeamHistoryView(aggregate, "player-a"));
  for (const sentinel of ["987654321", "876543219", "765432198"]) {
    ok(!serialized.includes(sentinel), `private wrestler value ${sentinel} leaked into team history`);
  }
  for (const field of ["morale", "fatigue", "wear", "weeklyGuarantee", "appearanceFee", "signingBonus", "priorities"]) {
    ok(!serialized.includes(`\"${field}\"`), `private field ${field} leaked into team history`);
  }
});

test("non-members cannot read team history", () => {
  const { aggregate } = fixture(73303);
  let rejected = false;
  try {
    buildPlayerTeamHistoryView(aggregate, "stranger");
  } catch (error) {
    rejected = error instanceof Error && error.message.includes("not an active member");
  }
  ok(rejected, "non-member could read team history");
});

console.log(`\nApplication team-history tests: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exitCode = 1;
