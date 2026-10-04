declare const process: { exitCode?: number };

import { DEFAULT_RULESET } from "../packages/config/src/default-ruleset.js";
import {
  REAL_ACTIVE_MENS_ROSTER_NAMES,
  realActiveMensRosterSource,
} from "../packages/content/src/real-active-mens-roster.js";
import {
  createWorld,
  generatedFictionalRosterSource,
  type WorldRosterSource,
} from "../packages/sim-core/src/index.js";
import { createAlphaWorldAggregate } from "../packages/web-adapter/src/alpha-service.js";

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

function personWithoutName(person: ReturnType<typeof createWorld>["people"][number]): unknown {
  const { name: _name, ...rest } = person;
  return rest;
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

test("real active men's identity pool contains exactly 400 unique starting wrestlers", () => {
  ok(REAL_ACTIVE_MENS_ROSTER_NAMES.length === DEFAULT_RULESET.wrestlers, "real roster does not match the 400-person Alpha ruleset");
  ok(
    new Set(REAL_ACTIVE_MENS_ROSTER_NAMES.map((name) => name.toLocaleLowerCase("en"))).size === REAL_ACTIVE_MENS_ROSTER_NAMES.length,
    "real roster contains duplicate display identities",
  );

  for (const expected of [
    "Cody Rhodes",
    "Will Ospreay",
    "Kenny Omega",
    "Zack Sabre Jr.",
    "Moose",
    "Místico",
    "Hijo del Vikingo",
    "KENTA",
    "Matt Riddle",
    "Jack Cartwheel",
    "Michael Oku",
  ]) {
    ok(REAL_ACTIVE_MENS_ROSTER_NAMES.includes(expected), `real roster is missing ${expected}`);
  }

  for (const excluded of ["PAC", "Bryan Danielson", "Hiroshi Tanahashi", "Big E", "Mick Foley"]) {
    ok(!REAL_ACTIVE_MENS_ROSTER_NAMES.includes(excluded), `non-active/legend identity ${excluded} leaked into the starting roster`);
  }
});

test("real identity overlay preserves deterministic wrestler attributes and genesis contracts", () => {
  const seed = 77104;
  const fictional = createWorld(seed, DEFAULT_RULESET, "Identity Overlay", generatedFictionalRosterSource);
  const real = createWorld(seed, DEFAULT_RULESET, "Identity Overlay", realActiveMensRosterSource);

  ok(real.people.length === fictional.people.length, "real identity overlay changed wrestler count");
  ok(real.people[0]?.name !== fictional.people[0]?.name, "real identity overlay did not replace display names");
  ok(
    JSON.stringify(real.people.map(personWithoutName)) === JSON.stringify(fictional.people.map(personWithoutName)),
    "real identity overlay changed deterministic wrestler attributes or stable IDs",
  );
  ok(
    JSON.stringify(real.contracts) === JSON.stringify(fictional.contracts),
    "real identity overlay changed genesis contract allocation or economics",
  );
});

test("player-facing Alpha World genesis uses the real active roster source", () => {
  const aggregate = createAlphaWorldAggregate({ seed: 77105, playerId: "real-roster-player" });
  const names = new Set(aggregate.state.people.map((person) => person.name));
  ok(aggregate.state.people.length === 400, "Alpha World did not create the 400-person real roster");
  ok(names.size === 400, "Alpha World real roster contains duplicate identities");
  ok(names.has("Cody Rhodes"), "Alpha World did not use the real roster source");
  ok(names.has("Swerve Strickland"), "Alpha World is missing a real active roster identity");
  ok(!names.has("PAC"), "Alpha World included a deliberately excluded non-active identity");
});

console.log(`\nRoster source tests: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exitCode = 1;
