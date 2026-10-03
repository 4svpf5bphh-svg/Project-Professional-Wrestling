declare const process: { exitCode?: number };

import {
  activePromotionControlForPlayer,
  claimIndependentPromotionForPlayer,
  createWorldOwnershipState,
  joinPlayerToWorld,
  playerControlsPromotion,
} from "../packages/application/src/index.js";
import { DEFAULT_RULESET } from "../packages/config/src/default-ruleset.js";
import { createWorld, humanControlledPromotions } from "../packages/sim-core/src/index.js";

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

function firstIndependents(seed: number, count = 2) {
  const state = createWorld(seed, DEFAULT_RULESET);
  const promotions = state.promotions.filter(
    (promotion) => promotion.tier === "INDEPENDENT" && promotion.lifecycle === "ACTIVE",
  );
  if (promotions.length < count) throw new Error(`seed ${seed} did not create ${count} active Independents`);
  return { state, promotions };
}

test("a World member can claim one eligible promotion through application ownership", () => {
  const { state, promotions } = firstIndependents(11801, 1);
  const ownership = createWorldOwnershipState(state.world.id, 1);
  joinPlayerToWorld(ownership, "player-one", state.world.currentDate);

  const promotion = claimIndependentPromotionForPlayer(
    state,
    ownership,
    "player-one",
    promotions[0]!.id,
    { name: "Player One Wrestling" },
  );

  ok(promotion.controllerType === "HUMAN", "simulation promotion did not become human-controlled");
  ok(playerControlsPromotion(ownership, "player-one", promotion.id), "application ownership did not authorize the player");
  const control = activePromotionControlForPlayer(ownership, "player-one");
  ok(control?.promotionId === promotion.id, "active control points at the wrong promotion");
  ok(control?.worldId === state.world.id, "active control points at the wrong World");
  ok(!JSON.stringify(state).includes("player-one"), "player account identity leaked into deterministic WorldState");
});

test("claiming requires active World membership", () => {
  const { state, promotions } = firstIndependents(11802, 1);
  const ownership = createWorldOwnershipState(state.world.id, 1);

  let rejected = false;
  try {
    claimIndependentPromotionForPlayer(state, ownership, "outsider", promotions[0]!.id);
  } catch {
    rejected = true;
  }
  ok(rejected, "a non-member could claim a promotion");
  ok(humanControlledPromotions(state).length === 0, "failed authorization mutated simulation control");
});

test("ALPHA-1A seat capacity blocks a second human without hard-coding sim-core", () => {
  const { state, promotions } = firstIndependents(11803, 2);
  const ownership = createWorldOwnershipState(state.world.id, 1);
  joinPlayerToWorld(ownership, "player-one", state.world.currentDate);
  joinPlayerToWorld(ownership, "player-two", state.world.currentDate);

  claimIndependentPromotionForPlayer(state, ownership, "player-one", promotions[0]!.id);

  let rejected = false;
  try {
    claimIndependentPromotionForPlayer(state, ownership, "player-two", promotions[1]!.id);
  } catch {
    rejected = true;
  }
  ok(rejected, "ALPHA-1A human seat limit allowed a second active controller");
  ok(humanControlledPromotions(state).length === 1, "seat rejection still mutated simulation control");
});

test("one player cannot control two promotions even when the World has spare seats", () => {
  const { state, promotions } = firstIndependents(11804, 2);
  const ownership = createWorldOwnershipState(state.world.id, 2);
  joinPlayerToWorld(ownership, "player-one", state.world.currentDate);

  claimIndependentPromotionForPlayer(state, ownership, "player-one", promotions[0]!.id);

  let rejected = false;
  try {
    claimIndependentPromotionForPlayer(state, ownership, "player-one", promotions[1]!.id);
  } catch {
    rejected = true;
  }
  ok(rejected, "one player acquired two active promotion controls");
  ok(humanControlledPromotions(state).length === 1, "one-player rule rejection mutated a second promotion");
});

test("raising World capacity to two allows two different human players without a sim rewrite", () => {
  const { state, promotions } = firstIndependents(11805, 2);
  const ownership = createWorldOwnershipState(state.world.id, 2);
  joinPlayerToWorld(ownership, "player-one", state.world.currentDate);
  joinPlayerToWorld(ownership, "player-two", state.world.currentDate);

  claimIndependentPromotionForPlayer(state, ownership, "player-one", promotions[0]!.id);
  claimIndependentPromotionForPlayer(state, ownership, "player-two", promotions[1]!.id);

  ok(humanControlledPromotions(state).length === 2, "two-seat World did not produce two human simulation promotions");
  ok(playerControlsPromotion(ownership, "player-one", promotions[0]!.id), "player one lost its promotion control");
  ok(playerControlsPromotion(ownership, "player-two", promotions[1]!.id), "player two did not receive its promotion control");
});

test("ownership records cannot be applied to a different World", () => {
  const { state: stateA } = firstIndependents(11806, 1);
  const { state: stateB, promotions: promotionsB } = firstIndependents(11807, 1);
  const ownership = createWorldOwnershipState(stateA.world.id, 1);
  joinPlayerToWorld(ownership, "player-one", stateA.world.currentDate);

  let rejected = false;
  try {
    claimIndependentPromotionForPlayer(stateB, ownership, "player-one", promotionsB[0]!.id);
  } catch {
    rejected = true;
  }
  ok(rejected, "ownership registry from one World authorized mutation in another World");
  ok(humanControlledPromotions(stateB).length === 0, "World mismatch rejection mutated simulation state");
});

console.log(`\nApplication ownership tests: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exitCode = 1;
