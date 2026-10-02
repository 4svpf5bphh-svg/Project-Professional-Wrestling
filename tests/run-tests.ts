declare const process: { exitCode?: number };

import { DEFAULT_RULESET } from "../packages/config/src/default-ruleset.js";
import { advanceWeeks, createWorld, deterministicWorldHash, validateWorldInvariants } from "../packages/sim-core/src/index.js";

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

function equal<T>(actual: T, expected: T, message?: string): void {
  if (actual !== expected) throw new Error(message ?? `expected ${String(expected)}, received ${String(actual)}`);
}

function ok(value: unknown, message: string): void {
  if (!value) throw new Error(message);
}

test("same seed creates identical World", () => {
  const a = createWorld(42, DEFAULT_RULESET);
  const b = createWorld(42, DEFAULT_RULESET);
  equal(deterministicWorldHash(a), deterministicWorldHash(b));
});

test("different seeds create different Worlds", () => {
  const a = createWorld(42, DEFAULT_RULESET);
  const b = createWorld(43, DEFAULT_RULESET);
  ok(deterministicWorldHash(a) !== deterministicWorldHash(b), "different seeds produced identical snapshot hashes");
});

test("default Genesis creates expected entity counts", () => {
  const state = createWorld(101, DEFAULT_RULESET);
  equal(state.markets.length, 20);
  equal(state.promotions.length, 9);
  equal(state.people.length, 400);
});

test("Genesis leaves meaningful free-agent supply", () => {
  const state = createWorld(101, DEFAULT_RULESET);
  const freeAgents = state.people.filter((p) => p.contractedPromotionId === null).length;
  equal(freeAgents, 128);
  ok(freeAgents / state.people.length >= 0.25, "labour market is too tightly contracted at Genesis");
});

test("one Global promotion exists in default Genesis", () => {
  const state = createWorld(101, DEFAULT_RULESET);
  equal(state.promotions.filter((p) => p.tier === "GLOBAL").length, 1);
});

test("World advances across 52-week PPW Years", () => {
  const state = createWorld(7, DEFAULT_RULESET);
  advanceWeeks(state.world, state.ruleset.weeksPerYear, 52);
  equal(state.world.currentDate.year, 2);
  equal(state.world.currentDate.week, 1);
  advanceWeeks(state.world, state.ruleset.weeksPerYear, 468);
  equal(state.world.currentDate.year, 11);
  equal(state.world.currentDate.week, 1);
});

test("Genesis satisfies core invariants", () => {
  const state = createWorld(999, DEFAULT_RULESET);
  const errors = validateWorldInvariants(state);
  equal(errors.length, 0, errors.join("\n"));
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exitCode = 1;
