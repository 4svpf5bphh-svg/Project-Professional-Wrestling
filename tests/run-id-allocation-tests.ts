declare const process: { exitCode?: number };

import { DEFAULT_RULESET } from "../packages/config/src/default-ruleset.js";
import {
  LedgerWriter,
  createPersistedWorldState,
  createWorld,
  formatEntityId,
  recordFinancialTransaction,
  resolveWorldWeeks,
  restorePersistedWorldState,
  snapshotEntityIdCounters,
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

function expectReject(fn: () => void, fragment: string): void {
  let message = "";
  try {
    fn();
  } catch (error) {
    message = error instanceof Error ? error.message : String(error);
  }
  ok(message.includes(fragment), `expected rejection containing "${fragment}", got "${message}"`);
}

test("Genesis registers counters that match every already-created ID family", () => {
  const state = createWorld(23001, DEFAULT_RULESET);
  const counters = snapshotEntityIdCounters(state);
  ok(counters.market === state.markets.length, "market counter does not match Genesis IDs");
  ok(counters.venue === state.venues.length, "venue counter does not match Genesis IDs");
  ok(counters.promotion === state.promotions.length, "promotion counter does not match Genesis IDs");
  ok(counters.person === state.people.length, "person counter does not match Genesis IDs");
  ok(counters.contract === state.contracts.length, "contract counter does not match Genesis IDs");
  ok(counters.ledger === state.ledger.length, "Ledger counter does not match Genesis IDs");
});

test("persisted counters survive pruned hot history and prevent ID reuse", () => {
  const state = createWorld(23002, DEFAULT_RULESET);
  resolveWorldWeeks(state, 8);
  const snapshot = createPersistedWorldState(state);
  const financeCounter = snapshot.entityIdCounters.financialTransaction;
  const ledgerCounter = snapshot.entityIdCounters.ledger;
  ok(financeCounter > 20 && ledgerCounter > 20, "fixture did not create enough historical IDs");

  snapshot.financialTransactions = snapshot.financialTransactions.slice(-3);
  snapshot.ledger = snapshot.ledger.slice(-3);
  const restored = restorePersistedWorldState(snapshot);
  const promotion = restored.promotions[0]!;
  const transaction = recordFinancialTransaction(restored, promotion, "MEDIA_INCOME", 0, "id-counter-test");
  ok(
    transaction.id === formatEntityId("financialTransaction", financeCounter + 1),
    `pruned finance history reused an old ID: ${transaction.id}`,
  );

  const ledgerEntry = new LedgerWriter(restored.world.id, restored.ledger).append({
    date: restored.world.currentDate,
    type: "ID_COUNTER_TEST",
  });
  ok(ledgerEntry.order === ledgerCounter + 1, "pruned Ledger history reset global Ledger order");
  ok(ledgerEntry.id === formatEntityId("ledger", ledgerCounter + 1), "pruned Ledger history reused an old ID");
});

test("schema v2 migration derives counters from the highest existing IDs", () => {
  const state = createWorld(23003, DEFAULT_RULESET);
  resolveWorldWeeks(state, 5);
  const current = createPersistedWorldState(state);
  const expected = current.entityIdCounters;
  const { entityIdCounters: _discardCounters, stateSchemaVersion: _discardVersion, ...body } = current;
  const legacyV2 = { ...body, stateSchemaVersion: 2 as const };
  const restored = restorePersistedWorldState(legacyV2);
  const migrated = snapshotEntityIdCounters(restored);
  ok(JSON.stringify(migrated) === JSON.stringify(expected), "schema v2 migration derived different entity counters");
});

test("current schema rejects a counter that falls behind a loaded entity ID", () => {
  const state = createWorld(23004, DEFAULT_RULESET);
  const snapshot = createPersistedWorldState(state);
  snapshot.entityIdCounters.contract = 0;
  expectReject(() => restorePersistedWorldState(snapshot), "counter contract is behind loaded World state");
});

console.log(`\nID allocation tests: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exitCode = 1;
