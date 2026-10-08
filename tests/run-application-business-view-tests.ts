declare const process: { exitCode?: number };

import {
  buildPlayerBusinessView,
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

async function test(name: string, fn: () => void | Promise<void>): Promise<void> {
  try {
    await fn();
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
  playerA: string;
  playerB: string;
  promotionA: string;
  promotionB: string;
} {
  const state = createWorld(seed, DEFAULT_RULESET);
  const choices = state.promotions.filter((promotion) => (
    promotion.controllerType === "AI"
    && promotion.tier === "INDEPENDENT"
    && promotion.lifecycle === "ACTIVE"
  )).slice(0, 2);
  if (choices.length < 2) throw new Error("business fixture needs two active Independent promotions");

  const ownership = createWorldOwnershipState(state.world.id, 2);
  const playerA = "business-player-a";
  const playerB = "business-player-b";
  joinPlayerToWorld(ownership, playerA, state.world.currentDate);
  joinPlayerToWorld(ownership, playerB, state.world.currentDate);
  claimIndependentPromotionForPlayer(state, ownership, playerA, choices[0]!.id);
  claimIndependentPromotionForPlayer(state, ownership, playerB, choices[1]!.id);

  return {
    aggregate: {
      state,
      ownership,
      commands: createWorldCommandState(state.world.id),
      runtime: createWorldRuntimeState(state.world.id),
      planning: createWorldPlanningState(state.world.id),
    },
    playerA,
    playerB,
    promotionA: choices[0]!.id,
    promotionB: choices[1]!.id,
  };
}

await test("Business projection scopes finance and standing to each controlled promotion", () => {
  const f = twoPlayerFixture(19501);
  f.aggregate.state.financialTransactions = [
    {
      id: "business-own-income",
      worldId: f.aggregate.state.world.id,
      promotionId: f.promotionA,
      date: { ...f.aggregate.state.world.currentDate },
      category: "MEDIA_INCOME",
      amount: 5_000,
      source: "business-test-own-income",
    },
    {
      id: "business-own-cost",
      worldId: f.aggregate.state.world.id,
      promotionId: f.promotionA,
      date: { ...f.aggregate.state.world.currentDate },
      category: "FIXED_OVERHEAD",
      amount: -2_000,
      source: "business-test-own-cost",
    },
    {
      id: "business-rival-secret",
      worldId: f.aggregate.state.world.id,
      promotionId: f.promotionB,
      date: { ...f.aggregate.state.world.currentDate },
      category: "SPONSOR_INCOME",
      amount: 999_999,
      source: "business-test-rival-secret",
    },
  ];

  const viewA = buildPlayerBusinessView(f.aggregate, f.playerA);
  const viewB = buildPlayerBusinessView(f.aggregate, f.playerB);
  ok(viewA.player.promotionId === f.promotionA, "player A business view resolved the wrong promotion");
  ok(viewB.player.promotionId === f.promotionB, "player B business view resolved the wrong promotion");
  ok(viewA.promotion?.promotionId === f.promotionA, "player A received the wrong business projection");
  ok(viewB.promotion?.promotionId === f.promotionB, "player B received the wrong business projection");
  ok(viewA.promotion?.recentTransactions.some((entry) => entry.transactionId === "business-own-income"), "player A lost an own transaction");
  ok(!viewA.promotion?.recentTransactions.some((entry) => entry.transactionId === "business-rival-secret"), "rival transaction leaked to player A");
  ok(viewB.promotion?.recentTransactions.length === 1, "player B did not receive exactly its own transaction history");
  ok(viewA.promotion?.rollingFourWeeks.income === 5_000, "player A rolling income included the wrong transactions");
  ok(viewA.promotion?.rollingFourWeeks.spending === 2_000, "player A rolling spending was wrong");
  ok(viewA.promotion?.rollingFourWeeks.net === 3_000, "player A rolling net was wrong");
  ok(viewB.promotion?.rollingFourWeeks.income === 999_999, "player B rolling income did not remain private to its promotion");

  const promotionA = f.aggregate.state.promotions.find((promotion) => promotion.id === f.promotionA)!;
  const expectedGuarantees = activeContractsForPromotion(f.aggregate.state, f.promotionA)
    .reduce((total, contract) => total + contract.weeklyGuarantee, 0);
  ok(viewA.promotion?.recurringWeekly.contractGuarantees === expectedGuarantees, "weekly contract guarantees did not match active contracts");
  ok(
    viewA.promotion?.recurringWeekly.marginBeforeEventCosts
      === promotionA.weeklyMediaIncome + promotionA.weeklySponsorIncome - promotionA.weeklyFixedOverhead - expectedGuarantees,
    "baseline operating margin was calculated incorrectly",
  );
});

await test("Business projection keeps the recent ledger concise without deleting financial history", () => {
  const f = twoPlayerFixture(19503);
  const date = { ...f.aggregate.state.world.currentDate };
  f.aggregate.state.financialTransactions = Array.from({ length: 12 }, (_, index) => ({
    id: `business-ledger-${index + 1}`,
    worldId: f.aggregate.state.world.id,
    promotionId: f.promotionA,
    date,
    category: index % 2 === 0 ? "MEDIA_INCOME" as const : "FIXED_OVERHEAD" as const,
    amount: index % 2 === 0 ? 1_000 + index : -(500 + index),
    source: "business-ledger-test",
  }));

  const view = buildPlayerBusinessView(f.aggregate, f.playerA);
  ok(f.aggregate.state.financialTransactions.length === 12, "business projection mutated the underlying financial ledger");
  ok(view.promotion?.recentTransactions.length === 8, "business view did not cap recent ledger detail at eight entries");
  ok(view.promotion?.rollingFourWeeks.byCategory.length === 2, "concise ledger cap changed the four-week category summary");
});

await test("Business projection rejects a non-member instead of exposing World finances", () => {
  const f = twoPlayerFixture(19502);
  let rejected = false;
  try {
    buildPlayerBusinessView(f.aggregate, "not-a-world-member");
  } catch {
    rejected = true;
  }
  ok(rejected, "non-member received a business projection");
});

console.log(`\nBusiness projection tests: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exitCode = 1;
