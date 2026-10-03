declare const process: { exitCode?: number };

import { DEFAULT_RULESET } from "../packages/config/src/default-ruleset.js";
import {
  claimIndependentPromotionForHuman,
  createWorld,
  humanControlledPromotions,
  planWorldEvents,
  shouldPromotionRunEvent,
} from "../packages/sim-core/src/index.js";

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

test("an active Independent promotion can become a human-controlled promotion", () => {
  const state = createWorld(10801, DEFAULT_RULESET);
  const promotion = state.promotions.find(
    (candidate) => candidate.tier === "INDEPENDENT" && candidate.lifecycle === "ACTIVE",
  )!;
  const originalContractIds = state.contracts
    .filter((contract) => contract.promotionId === promotion.id)
    .map((contract) => contract.id);

  const claimed = claimIndependentPromotionForHuman(state, promotion.id, { name: "Player Wrestling" });

  ok(claimed.controllerType === "HUMAN", "claimed promotion did not become human-controlled");
  ok(claimed.name === "Player Wrestling", "claimed promotion was not renamed");
  ok(humanControlledPromotions(state).length === 1, "World did not expose exactly one human promotion");
  ok(
    JSON.stringify(state.contracts.filter((contract) => contract.promotionId === promotion.id).map((contract) => contract.id))
      === JSON.stringify(originalContractIds),
    "claiming a promotion unexpectedly rewrote its roster contracts",
  );
  const ledgerEvent = state.ledger[state.ledger.length - 1]!;
  ok(ledgerEvent.type === "HUMAN_PROMOTION_CLAIMED", "human claim was not recorded in World history");
  ok(ledgerEvent.entityIds[0] === promotion.id, "human claim ledger event points at the wrong promotion");
});

test("sim-core enforces promotion eligibility but does not own multiplayer seat policy", () => {
  const state = createWorld(10802, DEFAULT_RULESET);
  const global = state.promotions.find((promotion) => promotion.tier === "GLOBAL")!;
  const indies = state.promotions.filter((promotion) => promotion.tier === "INDEPENDENT");

  let rejectedGlobal = false;
  try {
    claimIndependentPromotionForHuman(state, global.id);
  } catch {
    rejectedGlobal = true;
  }
  ok(rejectedGlobal, "a non-Independent promotion could be claimed");

  claimIndependentPromotionForHuman(state, indies[0]!.id);
  let rejectedDuplicate = false;
  try {
    claimIndependentPromotionForHuman(state, indies[0]!.id);
  } catch {
    rejectedDuplicate = true;
  }
  ok(rejectedDuplicate, "the same promotion could be claimed twice");

  claimIndependentPromotionForHuman(state, indies[1]!.id);
  ok(
    humanControlledPromotions(state).length === 2,
    "sim-core still imposed the temporary ALPHA-1A one-human World rule",
  );
});

test("AI event planning leaves human promotions unbooked", () => {
  const state = createWorld(10803, DEFAULT_RULESET);
  const promotion = state.promotions.find(
    (candidate) => candidate.tier === "INDEPENDENT" && shouldPromotionRunEvent(state, candidate),
  )!;
  claimIndependentPromotionForHuman(state, promotion.id);

  const expectedAiEvents = state.promotions.filter(
    (candidate) => candidate.controllerType === "AI" && shouldPromotionRunEvent(state, candidate),
  ).length;

  planWorldEvents(state);

  ok(
    !state.events.some((event) => event.promotionId === promotion.id),
    "human promotion was silently AI-booked",
  );
  ok(
    state.events.length === expectedAiEvents,
    `expected ${expectedAiEvents} AI-planned events, received ${state.events.length}`,
  );
  ok(
    !state.scheduledAppearances.some((appearance) => appearance.promotionId === promotion.id),
    "human promotion received AI-selected appearances",
  );
});

test("all-AI event planning remains deterministic and unchanged by the control boundary", () => {
  const stateA = createWorld(10804, DEFAULT_RULESET);
  const stateB = createWorld(10804, DEFAULT_RULESET);

  planWorldEvents(stateA);
  planWorldEvents(stateB);

  ok(
    JSON.stringify(stateA.events) === JSON.stringify(stateB.events),
    "all-AI event planning lost determinism",
  );
  ok(
    JSON.stringify(stateA.scheduledAppearances) === JSON.stringify(stateB.scheduledAppearances),
    "all-AI appearance planning lost determinism",
  );
  ok(
    stateA.events.length === stateA.promotions.filter((promotion) => shouldPromotionRunEvent(stateA, promotion)).length,
    "all-AI World no longer planned every due promotion",
  );
});

console.log(`\nHuman control tests: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exitCode = 1;
