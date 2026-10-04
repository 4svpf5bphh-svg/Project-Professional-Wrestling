declare const process: { exitCode?: number };

import { DEFAULT_RULESET } from "../packages/config/src/default-ruleset.js";
import {
  createWorld,
  generatedFictionalRosterSource,
  type WorldRosterSource,
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

function expectThrow(fn: () => void, expected: string): void {
  let message = "";
  try {
    fn();
  } catch (error) {
    message = error instanceof Error ? error.message : String(error);
  }
  if (!message.includes(expected)) throw new Error(`expected error containing ${expected}, received ${message || "no error"}`);
}

test("default World genesis is identical to explicitly supplying the fictional roster source", () => {
  const implicit = createWorld(20261002, DEFAULT_RULESET, "Roster Source Regression");
  const explicit = createWorld(20261002, DEFAULT_RULESET, "Roster Source Regression", generatedFictionalRosterSource);
  ok(JSON.stringify(implicit) === JSON.stringify(explicit), "roster abstraction changed default deterministic genesis");
});

test("custom roster source can replace wrestler identity without changing stable person IDs", () => {
  const ruleset = { ...DEFAULT_RULESET, wrestlers: 24 };
  const baseline = createWorld(77101, ruleset, "Identity Baseline", generatedFictionalRosterSource);
  const realIdentitySource: WorldRosterSource = (context) => generatedFictionalRosterSource(context).map((person, index) => ({
    ...person,
    name: `Active Wrestler ${String(index + 1).padStart(3, "0")}`,
  }));
  const replaced = createWorld(77101, ruleset, "Identity Baseline", realIdentitySource);

  ok(replaced.people.length === 24, "custom roster source returned the wrong number of wrestlers");
  ok(replaced.people[0]?.name === "Active Wrestler 001", "custom identity did not flow into World state");
  ok(
    replaced.people.every((person, index) => person.id === baseline.people[index]?.id),
    "custom roster source changed stable person IDs",
  );
  ok(
    replaced.contracts.every((contract) => replaced.people.some((person) => person.id === contract.personId)),
    "genesis contracts no longer reference source-provided wrestlers",
  );
});

test("roster source rejects wrong counts and duplicate IDs before World genesis continues", () => {
  const ruleset = { ...DEFAULT_RULESET, wrestlers: 8 };
  const shortSource: WorldRosterSource = (context) => generatedFictionalRosterSource(context).slice(0, 7);
  expectThrow(
    () => createWorld(77102, ruleset, "Short Roster", shortSource),
    "roster source returned 7 wrestlers; expected 8",
  );

  const duplicateSource: WorldRosterSource = (context) => {
    const people = generatedFictionalRosterSource(context);
    people[1] = { ...people[1]!, id: people[0]!.id };
    return people;
  };
  expectThrow(
    () => createWorld(77103, ruleset, "Duplicate Roster", duplicateSource),
    "duplicate wrestler id",
  );
});

console.log(`\nRoster source tests: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exitCode = 1;
