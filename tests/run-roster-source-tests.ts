declare const process: { exitCode?: number };

import { DEFAULT_RULESET } from "../packages/config/src/default-ruleset.js";
import { REAL_WORLD_ALPHA_RULESET } from "../packages/config/src/real-world-ruleset.js";
import {
  REAL_ACTIVE_MENS_CALIBRATION_VERSION,
  calibratedRealActiveMensRosterSource,
  realRosterValueBand,
} from "../packages/content/src/real-active-mens-calibration.js";
import {
  REAL_ACTIVE_MENS_ROSTER_NAMES,
  realActiveMensRosterSource,
} from "../packages/content/src/real-active-mens-roster.js";
import {
  REAL_ACTIVE_WOMENS_ROSTER_NAMES,
  REAL_ACTIVE_WOMENS_ROSTER_REVIEWED_ON,
} from "../packages/content/src/real-active-womens-roster.js";
import {
  REAL_ACTIVE_MIXED_ROSTER_SIZE,
  calibratedRealActiveMixedRosterSource,
} from "../packages/content/src/real-active-mixed-roster.js";
import { marketWeeklyValue } from "../packages/sim-core/src/contracts.js";
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

function requirePerson(state: ReturnType<typeof createWorld>, name: string) {
  const person = state.people.find((candidate) => candidate.name === name);
  if (!person) throw new Error(`missing expected wrestler ${name}`);
  return person;
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

test("real active men's identity pool preserves the deployed 400 while supporting future expansion", () => {
  ok(REAL_ACTIVE_MENS_ROSTER_NAMES.length >= DEFAULT_RULESET.wrestlers, "real roster no longer covers the 400-person Alpha ruleset");
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
    "Yota Tsuji",
    "Tomohiro Ishii",
    "Yuya Uemura",
  ]) {
    ok(REAL_ACTIVE_MENS_ROSTER_NAMES.includes(expected), `real roster is missing ${expected}`);
  }

  for (const excluded of ["PAC", "Bryan Danielson", "Hiroshi Tanahashi", "Big E", "Mick Foley"]) {
    ok(!REAL_ACTIVE_MENS_ROSTER_NAMES.includes(excluded), `non-active/legend identity ${excluded} leaked into the starting roster`);
  }
});

test("reviewed women's identity pool is unique, substantial and separate from the men's pool", () => {
  ok(REAL_ACTIVE_WOMENS_ROSTER_REVIEWED_ON === "2026-10-08", "women's roster review date is stale");
  ok(REAL_ACTIVE_WOMENS_ROSTER_NAMES.length >= 150, "women's identity pool is too small for a living global World");
  const women = new Set(REAL_ACTIVE_WOMENS_ROSTER_NAMES.map((name) => name.toLocaleLowerCase("en")));
  ok(women.size === REAL_ACTIVE_WOMENS_ROSTER_NAMES.length, "women's identity pool contains duplicate names");
  for (const man of REAL_ACTIVE_MENS_ROSTER_NAMES) {
    ok(!women.has(man.toLocaleLowerCase("en")), `identity appears in both men's and women's pools: ${man}`);
  }
  for (const expected of [
    "Rhea Ripley",
    "IYO SKY",
    "Mercedes Moné",
    "Toni Storm",
    "Athena",
    "Xia Brookside",
    "Persephone",
    "Saya Kamitani",
    "Starlight Kid",
    "Matoi Hamabe",
    "Tetsu Akira",
  ]) {
    ok(REAL_ACTIVE_WOMENS_ROSTER_NAMES.includes(expected), `women's roster is missing ${expected}`);
  }
});

test("expanded mixed roster source creates explicit men's and women's divisions without duplicate identities", () => {
  ok(REAL_WORLD_ALPHA_RULESET.wrestlers === REAL_ACTIVE_MIXED_ROSTER_SIZE, "future real-world ruleset drifted from the reviewed mixed roster");
  ok(REAL_WORLD_ALPHA_RULESET.promotions === 13, "future real-world ruleset lost reserved player takeover slots");
  const ruleset = { ...DEFAULT_RULESET, wrestlers: REAL_ACTIVE_MIXED_ROSTER_SIZE };
  const state = createWorld(77107, ruleset, "Mixed Identity Pool", calibratedRealActiveMixedRosterSource);
  const men = state.people.filter((person) => (person.division ?? "MEN") === "MEN");
  const women = state.people.filter((person) => person.division === "WOMEN");
  ok(state.people.length === REAL_ACTIVE_MIXED_ROSTER_SIZE, "mixed source created the wrong wrestler count");
  ok(men.length === REAL_ACTIVE_MENS_ROSTER_NAMES.length, "mixed source changed the men's pool size");
  ok(women.length === REAL_ACTIVE_WOMENS_ROSTER_NAMES.length, "mixed source changed the women's pool size");
  ok(new Set(state.people.map((person) => person.name.toLocaleLowerCase("en"))).size === state.people.length, "mixed source contains duplicate identities");
  ok(women.some((person) => person.name === "Rhea Ripley"), "Rhea Ripley was not tagged in the women's division");
  ok(men.some((person) => person.name === "Roman Reigns"), "Roman Reigns disappeared from the men's division");
});

test("raw real identity overlay preserves deterministic wrestler attributes and genesis contracts", () => {
  const seed = 77104;
  const fictional = createWorld(seed, DEFAULT_RULESET, "Identity Overlay", generatedFictionalRosterSource);
  const real = createWorld(seed, DEFAULT_RULESET, "Identity Overlay", realActiveMensRosterSource);

  ok(real.people.length === fictional.people.length, "real identity overlay changed wrestler count");
  ok(real.people[0]?.name !== fictional.people[0]?.name, "real identity overlay did not replace display names");
  ok(
    JSON.stringify(real.people.map(personWithoutName)) === JSON.stringify(fictional.people.map(personWithoutName)),
    "raw real identity overlay changed deterministic wrestler attributes or stable IDs",
  );
  ok(
    JSON.stringify(real.contracts) === JSON.stringify(fictional.contracts),
    "raw real identity overlay changed genesis contract allocation or economics",
  );
});

test("calibrated real roster gives recognisable talent sensible broad game bands", () => {
  const seed = 77106;
  const raw = createWorld(seed, DEFAULT_RULESET, "Calibration Raw", realActiveMensRosterSource);
  const calibrated = createWorld(seed, DEFAULT_RULESET, "Calibration Raw", calibratedRealActiveMensRosterSource);

  ok(REAL_ACTIVE_MENS_CALIBRATION_VERSION.length > 0, "calibration version must be declared");
  ok(JSON.stringify(calibrated) === JSON.stringify(createWorld(seed, DEFAULT_RULESET, "Calibration Raw", calibratedRealActiveMensRosterSource)), "calibrated roster is not deterministic");

  const cody = requirePerson(calibrated, "Cody Rhodes");
  ok(realRosterValueBand(cody.name) === "MEGASTAR", "Cody Rhodes is not in the megastar band");
  ok(cody.popularity >= 90 && cody.recognition >= 91, "megastar fame calibration is too low");
  ok(cody.skills.presentation >= 87, "presentation ace calibration is too low");

  const ospreay = requirePerson(calibrated, "Will Ospreay");
  ok(ospreay.skills.inRingQuality >= 87 && ospreay.skills.matchCraft >= 85, "workrate ace calibration is too low");

  const zack = requirePerson(calibrated, "Zack Sabre Jr.");
  ok(zack.skills.inRingQuality >= 87 && zack.skills.matchCraft >= 85, "technical headliner calibration is too low");

  const prospect = requirePerson(calibrated, "Je'Von Evans");
  ok(realRosterValueBand(prospect.name) === "PROSPECT", "Je'Von Evans is not in the prospect value band");
  ok(prospect.careerStage === "PROSPECT", "prospect career-stage calibration did not apply");
  ok(prospect.biologicalAge <= 25.5 && prospect.developmentAptitude >= 72, "prospect age/development calibration is implausible");

  const veteran = requirePerson(calibrated, "Chris Jericho");
  ok(veteran.careerStage === "SPECIAL_ATTRACTION", "special-attraction career stage did not apply");
  ok(veteran.biologicalAge >= 43.5 && veteran.skills.stamina <= 75, "special-attraction age/service calibration is implausible");

  const rawCody = requirePerson(raw, "Cody Rhodes");
  ok(cody.id === rawCody.id && cody.homeMarketId === rawCody.homeMarketId, "calibration changed stable identity/location plumbing");
  ok(JSON.stringify(cody.priorities) === JSON.stringify(rawCody.priorities), "calibration invented different wrestler priorities");
  ok(cody.morale === rawCody.morale && cody.momentum === rawCody.momentum && cody.fatigue === rawCody.fatigue, "calibration changed behavioural/current-form state");
  ok(cody.skills.safety === rawCody.skills.safety, "calibration changed the synthetic safety dimension");

  const developmental = requirePerson(calibrated, "Braxton Cole");
  ok(marketWeeklyValue(cody) > marketWeeklyValue(developmental) * 1.6, "star/prospect contract value separation is too small");
});

test("player-facing Alpha World genesis uses the calibrated real active roster source", () => {
  const aggregate = createAlphaWorldAggregate({ seed: 77105, playerId: "real-roster-player" });
  const names = new Set(aggregate.state.people.map((person) => person.name));
  ok(aggregate.state.people.length === 400, "Alpha World did not create the 400-person real roster");
  ok(names.size === 400, "Alpha World real roster contains duplicate identities");
  ok(names.has("Cody Rhodes"), "Alpha World did not use the real roster source");
  ok(names.has("Swerve Strickland"), "Alpha World is missing a real active roster identity");
  ok(!names.has("PAC"), "Alpha World included a deliberately excluded non-active identity");

  const cody = aggregate.state.people.find((person) => person.name === "Cody Rhodes");
  const prospect = aggregate.state.people.find((person) => person.name === "Je'Von Evans");
  ok(cody?.popularity !== undefined && cody.popularity >= 90, "Alpha World did not apply megastar calibration");
  ok(prospect?.careerStage === "PROSPECT", "Alpha World did not apply prospect career calibration");
});

console.log(`\nRoster source tests: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exitCode = 1;
