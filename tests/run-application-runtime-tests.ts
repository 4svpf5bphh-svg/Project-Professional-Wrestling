declare const process: { exitCode?: number };

import {
  beginWorldResolution,
  claimIndependentPromotionCommand,
  createWorldCommandState,
  createWorldOwnershipState,
  createWorldRuntimeState,
  joinPlayerToWorld,
  lockWorldForResolution,
  resolveLockedWorldWeek,
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

function claimFixture(seed: number) {
  const state = createWorld(seed, DEFAULT_RULESET);
  const ownership = createWorldOwnershipState(state.world.id, 1);
  const commands = createWorldCommandState(state.world.id);
  const runtime = createWorldRuntimeState(state.world.id);
  joinPlayerToWorld(ownership, "player-a", state.world.currentDate);
  const promotion = state.promotions.find(
    (candidate) => candidate.tier === "INDEPENDENT" && candidate.lifecycle === "ACTIVE",
  )!;
  const envelope = {
    requestId: `claim-${seed}`,
    worldId: state.world.id,
    playerId: "player-a",
    commandType: "CLAIM_INDEPENDENT_PROMOTION" as const,
    payload: { promotionId: promotion.id },
  };
  return { state, ownership, commands, runtime, promotion, envelope };
}

test("World runtime starts open at revision zero", () => {
  const state = createWorld(13001, DEFAULT_RULESET);
  const runtime = createWorldRuntimeState(state.world.id);
  ok(runtime.phase === "OPEN", "new World runtime did not start OPEN");
  ok(runtime.revision === 0, "new World runtime did not start at revision zero");
  ok(runtime.lockedPpwDate === null, "new World runtime unexpectedly started locked");
  ok(runtime.lastResolvedPpwDate === null, "new World runtime unexpectedly had a resolved week");
});

test("new player mutations are rejected once the World enters locking", () => {
  const { state, ownership, commands, runtime, promotion, envelope } = claimFixture(13002);
  lockWorldForResolution(runtime, state);

  let rejected = false;
  try {
    claimIndependentPromotionCommand(state, ownership, commands, runtime, envelope);
  } catch {
    rejected = true;
  }

  ok(rejected, "new player command was accepted during LOCKING");
  ok(promotion.controllerType === "AI", "rejected locked command mutated the promotion");
  ok(commands.receipts.length === 0, "rejected locked command created a receipt");
  ok(runtime.revision === 0, "rejected locked command advanced revision");
});

test("an already committed idempotent retry still returns during the World lock", () => {
  const { state, ownership, commands, runtime, envelope } = claimFixture(13003);
  const first = claimIndependentPromotionCommand(state, ownership, commands, runtime, envelope);
  lockWorldForResolution(runtime, state);
  const second = claimIndependentPromotionCommand(state, ownership, commands, runtime, envelope);

  ok(first.id === second.id, "locked retry did not return the original committed result");
  ok(commands.receipts.length === 1, "locked retry duplicated its command receipt");
  ok(runtime.phase === "LOCKING", "idempotent retry changed the runtime phase");
  ok(runtime.revision === 1, "idempotent retry advanced the revision while locked");
});

test("runtime enforces the OPEN to LOCKING to RESOLVING transition order", () => {
  const state = createWorld(13004, DEFAULT_RULESET);
  const runtime = createWorldRuntimeState(state.world.id);

  let earlyBeginRejected = false;
  try {
    beginWorldResolution(runtime, state);
  } catch {
    earlyBeginRejected = true;
  }
  ok(earlyBeginRejected, "resolution could begin without first locking the World");

  let earlyResolveRejected = false;
  try {
    resolveLockedWorldWeek(runtime, state);
  } catch {
    earlyResolveRejected = true;
  }
  ok(earlyResolveRejected, "World could resolve directly from OPEN");

  lockWorldForResolution(runtime, state);
  let doubleLockRejected = false;
  try {
    lockWorldForResolution(runtime, state);
  } catch {
    doubleLockRejected = true;
  }
  ok(doubleLockRejected, "World could be locked twice");

  beginWorldResolution(runtime, state);
  ok(runtime.phase === "RESOLVING", "LOCKING did not transition to RESOLVING");
});

test("the locked worker resolves exactly one week then reopens the World", () => {
  const state = createWorld(13005, DEFAULT_RULESET);
  const runtime = createWorldRuntimeState(state.world.id);
  const lockedDate = { ...state.world.currentDate };

  lockWorldForResolution(runtime, state);
  beginWorldResolution(runtime, state);
  resolveLockedWorldWeek(runtime, state);

  ok(runtime.phase === "OPEN", "resolved World did not reopen");
  ok(runtime.lockedPpwDate === null, "resolved World retained its active lock date");
  ok(runtime.revision === 1, "weekly resolution did not advance the World revision exactly once");
  ok(
    runtime.lastResolvedPpwDate?.year === lockedDate.year
      && runtime.lastResolvedPpwDate?.week === lockedDate.week
      && runtime.lastResolvedPpwDate?.day === lockedDate.day,
    "runtime did not remember which PPW week was resolved",
  );
  ok(state.world.currentDate.week === 2, "worker did not advance exactly one Genesis week");
});

test("a changed World date between lock and resolution is rejected", () => {
  const state = createWorld(13006, DEFAULT_RULESET);
  const runtime = createWorldRuntimeState(state.world.id);
  lockWorldForResolution(runtime, state);
  state.world.currentDate = { ...state.world.currentDate, day: 2 };

  let rejected = false;
  try {
    beginWorldResolution(runtime, state);
  } catch {
    rejected = true;
  }

  ok(rejected, "runtime accepted a World whose PPW date changed after lock");
  ok(runtime.phase === "LOCKING", "rejected stale lock unexpectedly changed phase");
  ok(runtime.revision === 0, "rejected stale lock advanced revision");
});

test("runtime from another World cannot authorize a player mutation", () => {
  const { state, ownership, commands, promotion, envelope } = claimFixture(13007);
  const wrongRuntime = createWorldRuntimeState("world-other");

  let rejected = false;
  try {
    claimIndependentPromotionCommand(state, ownership, commands, wrongRuntime, envelope);
  } catch {
    rejected = true;
  }

  ok(rejected, "foreign World runtime authorized a player command");
  ok(promotion.controllerType === "AI", "foreign runtime command mutated the World");
  ok(commands.receipts.length === 0, "foreign runtime command created a receipt");
});

console.log(`\nApplication runtime tests: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exitCode = 1;
