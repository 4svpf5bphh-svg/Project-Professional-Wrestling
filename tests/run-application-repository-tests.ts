declare const process: { exitCode?: number };

import {
  claimIndependentPromotionCommand,
  createWorldCommandState,
  createWorldOwnershipState,
  createWorldPlanningState,
  createWorldRuntimeState,
  joinPlayerToWorld,
  lockPersistedWorldForResolution,
  resolvePersistedWorldWeek,
  upsertDetailedShowDraftCommand,
  type ApplicationWorldAggregate,
} from "../packages/application/src/index.js";
import { DEFAULT_RULESET } from "../packages/config/src/default-ruleset.js";
import { InMemoryApplicationWorldRepository } from "../packages/persistence/src/index.js";
import { createWorld } from "../packages/sim-core/src/index.js";

let passed = 0;
let failed = 0;

function ok(value: unknown, message: string): void {
  if (!value) throw new Error(message);
}

function fixture(seed: number): ApplicationWorldAggregate {
  const state = createWorld(seed, DEFAULT_RULESET);
  return {
    state,
    ownership: createWorldOwnershipState(state.world.id, 1),
    commands: createWorldCommandState(state.world.id),
    runtime: createWorldRuntimeState(state.world.id),
    planning: createWorldPlanningState(state.world.id),
  };
}

const pending: Promise<void>[] = [];
function asyncTest(name: string, fn: () => Promise<void>): void {
  const promise = fn().then(() => {
    passed += 1;
    console.log(`PASS ${name}`);
  }).catch((error) => {
    failed += 1;
    console.error(`FAIL ${name}`);
    console.error(error instanceof Error ? error.message : String(error));
  });
  pending.push(promise);
}

asyncTest("repository load returns a detached persisted aggregate", async () => {
  const repo = new InMemoryApplicationWorldRepository();
  const aggregate = fixture(13001);
  await repo.initialize(aggregate);
  const loaded = await repo.load(aggregate.state.world.id);
  loaded.runtime.revision = 99;
  loaded.state.promotions[0]!.name = "Detached Mutation";
  loaded.planning.workspaces.push({
    worldId: aggregate.state.world.id,
    promotionId: aggregate.state.promotions[0]!.id,
    version: 0,
    detailedShowDrafts: [],
  });
  const reloaded = await repo.load(aggregate.state.world.id);
  ok(reloaded.runtime.revision === 0, "detached runtime mutation leaked into repository state");
  ok(reloaded.state.promotions[0]!.name !== "Detached Mutation", "detached World mutation leaked into repository state");
  ok(reloaded.planning.workspaces.length === 0, "detached planning mutation leaked into repository state");
});

asyncTest("successful transaction atomically persists World ownership receipt and revision", async () => {
  const repo = new InMemoryApplicationWorldRepository();
  const aggregate = fixture(13002);
  joinPlayerToWorld(aggregate.ownership, "player-a", aggregate.state.world.currentDate);
  await repo.initialize(aggregate);
  const promotion = aggregate.state.promotions.find((candidate) => candidate.tier === "INDEPENDENT" && candidate.lifecycle === "ACTIVE")!;

  await repo.transact(aggregate.state.world.id, 0, (working) => {
    claimIndependentPromotionCommand(working.state, working.ownership, working.commands, working.runtime, {
      requestId: "repo-claim",
      worldId: working.state.world.id,
      playerId: "player-a",
      commandType: "CLAIM_INDEPENDENT_PROMOTION",
      payload: { promotionId: promotion.id },
    });
  });

  const loaded = await repo.load(aggregate.state.world.id);
  ok(loaded.runtime.revision === 1, "committed command revision was not persisted");
  ok(loaded.ownership.promotionControls.length === 1, "promotion ownership was not persisted");
  ok(loaded.commands.receipts.length === 1, "command receipt was not persisted");
  ok(loaded.state.promotions.find((candidate) => candidate.id === promotion.id)?.controllerType === "HUMAN", "World mutation was not persisted");
});

asyncTest("failed transaction rolls back partial application and simulation mutations", async () => {
  const repo = new InMemoryApplicationWorldRepository();
  const aggregate = fixture(13003);
  joinPlayerToWorld(aggregate.ownership, "player-a", aggregate.state.world.currentDate);
  await repo.initialize(aggregate);
  const promotion = aggregate.state.promotions.find((candidate) => candidate.tier === "INDEPENDENT" && candidate.lifecycle === "ACTIVE")!;

  let rejected = false;
  try {
    await repo.transact(aggregate.state.world.id, 0, (working) => {
      claimIndependentPromotionCommand(working.state, working.ownership, working.commands, working.runtime, {
        requestId: "rollback-claim",
        worldId: working.state.world.id,
        playerId: "player-a",
        commandType: "CLAIM_INDEPENDENT_PROMOTION",
        payload: { promotionId: promotion.id },
      });
      throw new Error("simulated persistence failure");
    });
  } catch {
    rejected = true;
  }
  ok(rejected, "failing transaction unexpectedly committed");
  const loaded = await repo.load(aggregate.state.world.id);
  ok(loaded.runtime.revision === 0, "failed transaction advanced revision");
  ok(loaded.ownership.promotionControls.length === 0, "failed transaction persisted ownership");
  ok(loaded.commands.receipts.length === 0, "failed transaction persisted receipt");
  ok(loaded.state.promotions.find((candidate) => candidate.id === promotion.id)?.controllerType === "AI", "failed transaction persisted World mutation");
});

asyncTest("stale expected revision is rejected before transaction mutation", async () => {
  const repo = new InMemoryApplicationWorldRepository();
  const aggregate = fixture(13004);
  await repo.initialize(aggregate);
  await repo.transact(aggregate.state.world.id, 0, (working) => {
    working.runtime.revision = 1;
  });

  let rejected = false;
  try {
    await repo.transact(aggregate.state.world.id, 0, () => {
      throw new Error("should never execute");
    });
  } catch (error) {
    rejected = String(error).includes("stale World revision");
  }
  ok(rejected, "stale revision was not rejected");
});

asyncTest("planning state is persisted atomically with its receipt and World revision", async () => {
  const repo = new InMemoryApplicationWorldRepository();
  const aggregate = fixture(13005);
  joinPlayerToWorld(aggregate.ownership, "player-a", aggregate.state.world.currentDate);
  const promotion = aggregate.state.promotions.find((candidate) => candidate.tier === "INDEPENDENT" && candidate.lifecycle === "ACTIVE")!;
  claimIndependentPromotionCommand(aggregate.state, aggregate.ownership, aggregate.commands, aggregate.runtime, {
    requestId: "planning-claim",
    worldId: aggregate.state.world.id,
    playerId: "player-a",
    commandType: "CLAIM_INDEPENDENT_PROMOTION",
    payload: { promotionId: promotion.id },
  });
  await repo.initialize(aggregate);

  await repo.transact(aggregate.state.world.id, 1, (working) => {
    upsertDetailedShowDraftCommand(working.state, working.ownership, working.planning, working.commands, working.runtime, {
      requestId: "persist-draft",
      worldId: working.state.world.id,
      playerId: "player-a",
      commandType: "UPSERT_DETAILED_SHOW_DRAFT",
      payload: {
        promotionId: promotion.id,
        expectedPlanVersion: 0,
        draft: {
          draftId: "week-plan",
          promotionId: promotion.id,
          targetDate: { ...working.state.world.currentDate },
          marketId: null,
          venueId: null,
          ticketStrategy: null,
          participantIds: [],
          matches: [],
          championshipAssignments: [],
        },
      },
    });
  });

  const loaded = await repo.load(aggregate.state.world.id);
  ok(loaded.runtime.revision === 2, "planning transaction did not persist World revision");
  ok(loaded.planning.workspaces[0]?.version === 1, "planning workspace was not persisted");
  ok(loaded.planning.workspaces[0]?.detailedShowDrafts[0]?.draftId === "week-plan", "planning draft was not persisted");
  ok(loaded.commands.receipts.some((receipt) => receipt.requestId === "persist-draft"), "planning receipt was not persisted");
});

asyncTest("weekly lock and resolution are separately durable and failed resolution rolls back", async () => {
  const repo = new InMemoryApplicationWorldRepository();
  const aggregate = fixture(13006);
  await repo.initialize(aggregate);
  const worldId = aggregate.state.world.id;
  const beforeDate = { ...aggregate.state.world.currentDate };

  await lockPersistedWorldForResolution(repo, worldId, 0);
  const locked = await repo.load(worldId);
  ok(locked.runtime.phase === "LOCKING", "weekly lock was not durably committed");
  ok(locked.runtime.revision === 0, "lock alone should not revise gameplay state");

  let rejected = false;
  try {
    await repo.transact(worldId, 0, (working) => {
      working.runtime.phase = "RESOLVING";
      working.state.world.currentDate.week += 1;
      throw new Error("simulated worker crash");
    });
  } catch {
    rejected = true;
  }
  ok(rejected, "simulated worker crash unexpectedly committed");
  const afterCrash = await repo.load(worldId);
  ok(afterCrash.runtime.phase === "LOCKING", "worker crash did not roll back to durable lock state");
  ok(afterCrash.state.world.currentDate.week === beforeDate.week, "worker crash partially advanced World date");

  await resolvePersistedWorldWeek(repo, worldId, 0);
  const resolved = await repo.load(worldId);
  ok(resolved.runtime.phase === "OPEN", "successful resolution did not reopen World");
  ok(resolved.runtime.revision === 1, "successful weekly resolution did not advance revision once");
  ok(resolved.runtime.lastResolvedPpwDate?.week === beforeDate.week, "resolved week was not recorded");
});

await Promise.all(pending);
console.log(`\nApplication repository tests: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exitCode = 1;
