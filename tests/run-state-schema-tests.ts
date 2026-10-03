declare const process: { exitCode?: number };

import { DEFAULT_RULESET } from "../packages/config/src/default-ruleset.js";
import {
  CURRENT_WORLD_STATE_SCHEMA_VERSION,
  createPersistedWorldState,
  createWorld,
  deterministicWorldHash,
  resolveWorldWeeks,
  restorePersistedWorldState,
  validateWorldInvariants,
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

test("persisted World state has an explicit schema version and materializes lazy collections", () => {
  const state = createWorld(22001, DEFAULT_RULESET);
  ok(state.promotionStandings === undefined, "fixture unexpectedly initialized promotion standings");
  ok(state.teams === undefined, "fixture unexpectedly initialized teams");

  const snapshot = createPersistedWorldState(state);

  ok(snapshot.stateSchemaVersion === CURRENT_WORLD_STATE_SCHEMA_VERSION, "snapshot schema version is missing or incorrect");
  ok(Array.isArray(snapshot.promotionStandings), "promotion standings were not materialized");
  ok(Array.isArray(snapshot.promotionTalentTrust), "talent trust was not materialized");
  ok(Array.isArray(snapshot.promotionSurvivalStates), "survival state was not materialized");
  ok(Array.isArray(snapshot.teams), "teams were not materialized");
  ok(Array.isArray(snapshot.teamMemberships), "team memberships were not materialized");
  ok(Array.isArray(snapshot.championships), "championships were not materialized");
  ok(Array.isArray(snapshot.championshipReigns), "championship reigns were not materialized");
  ok(Array.isArray(snapshot.championshipContests), "championship contests were not materialized");
  ok(state.promotionStandings === undefined, "serializing mutated the live promotion standings collection");
  ok(state.teams === undefined, "serializing mutated the live teams collection");
});

test("JSON persistence round-trip preserves the deterministic World and future resolution", () => {
  const original = createWorld(22002, DEFAULT_RULESET);
  resolveWorldWeeks(original, 26);

  const beforeHash = deterministicWorldHash(original);
  const json = JSON.stringify(createPersistedWorldState(original));
  const restored = restorePersistedWorldState(JSON.parse(json));

  ok(deterministicWorldHash(restored) === beforeHash, "restored World hash differs immediately after persistence round-trip");
  ok(validateWorldInvariants(restored).length === 0, "restored World violates invariants");

  resolveWorldWeeks(original, 26);
  resolveWorldWeeks(restored, 26);
  ok(deterministicWorldHash(restored) === deterministicWorldHash(original), "restored World diverged during future deterministic resolution");
});

test("restored World state is detached from the persisted snapshot object", () => {
  const state = createWorld(22003, DEFAULT_RULESET);
  const snapshot = createPersistedWorldState(state);
  const originalCash = snapshot.promotions[0]!.cash;
  const restored = restorePersistedWorldState(snapshot);

  restored.promotions[0]!.cash += 12345;
  ok(snapshot.promotions[0]!.cash === originalCash, "mutating restored state also mutated persisted snapshot data");
});

test("unsupported persistence schema versions are rejected before restore", () => {
  const snapshot = createPersistedWorldState(createWorld(22004, DEFAULT_RULESET));
  const unsupported = { ...snapshot, stateSchemaVersion: 999 };
  expectReject(() => restorePersistedWorldState(unsupported), "unsupported World state schema version");
});

test("missing mandatory persisted collections and ruleset mismatches are rejected", () => {
  const snapshot = createPersistedWorldState(createWorld(22005, DEFAULT_RULESET));
  const missingMatches = { ...snapshot, matches: undefined };
  expectReject(() => restorePersistedWorldState(missingMatches), "field matches must be an array");

  const mismatch = structuredClone(snapshot);
  mismatch.world.rulesetVersion = "different-ruleset";
  expectReject(() => restorePersistedWorldState(mismatch), "persisted World ruleset mismatch");
});

console.log(`\nState schema tests: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exitCode = 1;
