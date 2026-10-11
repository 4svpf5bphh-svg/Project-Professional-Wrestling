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
  REAL_ACTIVE_WOMENS_CALIBRATION_VERSION,
  realWomensRosterValueBand,
} from "../packages/content/src/real-active-womens-calibration.js";
import {
  REAL_ACTIVE_MIXED_ROSTER_SIZE,
  calibratedRealActiveMixedRosterSource,
} from "../packages/content/src/real-active-mixed-roster.js";
import { marketWeeklyValue } from "../packages/sim-core/src/contracts.js";
import { VERIFIED_WOMENS_CHARACTER_WAVE_3 } from "../packages/content/src/real-wrestler-characters-women-wave-3.js";
import { CURATED_WRESTLER_CHARACTERS } from "../packages/content/src/real-wrestler-characters.js";
import { GIMMICK_CATALOG } from "../packages/application/src/gimmick-catalog.js";
import { authoredPersonaForPerson } from "../packages/sim-core/src/identity-generation.js";
import { FULL_REAL_ROSTER_IDENTITY_GUIDE, fullRealRosterIdentityFor } from "../packages/content/src/full-real-roster-identity-guide.js";
import { REVIEWED_REAL_ROSTER_IDENTITIES_WAVE4 } from "../packages/content/src/real-roster-editorial-audit-wave4.js";
import { REVIEWED_REAL_ROSTER_IDENTITIES_WAVE5 } from "../packages/content/src/real-roster-editorial-audit-wave5.js";
import { REVIEWED_REAL_ROSTER_IDENTITIES_WAVE6 } from "../packages/content/src/real-roster-editorial-audit-wave6.js";
import { REVIEWED_REAL_ROSTER_IDENTITIES_WAVE7 } from "../packages/content/src/real-roster-editorial-audit-wave7.js";
import { REVIEWED_REAL_ROSTER_IDENTITIES_WAVE8 } from "../packages/content/src/real-roster-editorial-audit-wave8.js";
import { REVIEWED_REAL_ROSTER_IDENTITIES_WAVE9 } from "../packages/content/src/real-roster-editorial-audit-wave9.js";
import {completeAlphaWrestlerIdentityCoverage} from "../packages/content/src/wrestler-identity-coverage.js";
import {
  createWorld,
  generatedFictionalRosterSource,
  replenishTalentPopulation,
  createPersistedWorldState,
  restorePersistedWorldState,
  validatePortableWrestlerIdentities,
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
    "Tetsuya Naito",
    "Kento Miyahara",
    "Mike Bailey",
    "Neón",
    "Soberano Jr.",
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
    "Sareee",
    "Mayu Iwatani",
    "Miyu Yamashita",
    "Billie Starkz",
    "Tessa Blanchard",
  ]) {
    ok(REAL_ACTIVE_WOMENS_ROSTER_NAMES.includes(expected), `women's roster is missing ${expected}`);
  }
});

test("expanded mixed roster source creates explicit men's and women's divisions without duplicate identities", () => {
  ok(REAL_WORLD_ALPHA_RULESET.wrestlers === REAL_ACTIVE_MIXED_ROSTER_SIZE, "future real-world ruleset drifted from the reviewed mixed roster");
  ok(REAL_ACTIVE_MIXED_ROSTER_SIZE === 643, "popular-wrestler audit roster size changed unexpectedly");
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

test("calibrated mixed roster gives recognisable women sensible broad game bands", () => {
  const state = createWorld(
    77108,
    REAL_WORLD_ALPHA_RULESET,
    "Women's Calibration",
    calibratedRealActiveMixedRosterSource,
  );
  const repeat = createWorld(
    77108,
    REAL_WORLD_ALPHA_RULESET,
    "Women's Calibration",
    calibratedRealActiveMixedRosterSource,
  );
  ok(REAL_ACTIVE_WOMENS_CALIBRATION_VERSION.length > 0, "women's calibration version must be declared");
  ok(JSON.stringify(state.people) === JSON.stringify(repeat.people), "women's calibration is not deterministic");

  const mercedes = requirePerson(state, "Mercedes Moné");
  ok(realWomensRosterValueBand(mercedes.name) === "MEGASTAR", "Mercedes Moné is not in the megastar band");
  ok(mercedes.popularity >= 90 && mercedes.recognition >= 91, "women's megastar fame calibration is too low");
  ok(mercedes.skills.presentation >= 87, "Mercedes presentation calibration is too low");

  const rhea = requirePerson(state, "Rhea Ripley");
  ok(realWomensRosterValueBand(rhea.name) === "MEGASTAR", "Rhea Ripley is not in the megastar band");
  ok(rhea.skills.inRingQuality >= 87 && rhea.skills.matchCraft >= 85, "Rhea workrate calibration is too low");

  const saya = requirePerson(state, "Saya Kamitani");
  ok(realWomensRosterValueBand(saya.name) === "HEADLINER", "Saya Kamitani is not in the headliner band");
  ok(saya.skills.inRingQuality >= 87 && saya.skills.matchCraft >= 85, "Saya Kamitani workrate calibration is too low");

  const chelsea = requirePerson(state, "Chelsea Green");
  ok(realWomensRosterValueBand(chelsea.name) === "HEADLINER", "Chelsea Green is not in the headliner band");
  ok(chelsea.skills.presentation >= 87, "Chelsea Green presentation calibration is too low");

  const prospect = requirePerson(state, "Kendal Grey");
  ok(realWomensRosterValueBand(prospect.name) === "PROSPECT", "Kendal Grey is not in the prospect value band");
  ok(prospect.careerStage === "PROSPECT", "women's prospect career stage did not apply");
  ok(prospect.biologicalAge <= 25.5 && prospect.developmentAptitude >= 72, "women's prospect development calibration is implausible");

  const attraction = requirePerson(state, "AJ Lee");
  ok(attraction.careerStage === "SPECIAL_ATTRACTION", "AJ Lee special-attraction career stage did not apply");
  ok(attraction.skills.stamina <= 75, "women's special-attraction stamina cap did not apply");

  const regular = requirePerson(state, "Lady Shani");
  ok(marketWeeklyValue(mercedes) > marketWeeklyValue(regular) * 1.5, "women's star/regular contract value separation is too small");
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

test("player-facing Alpha World genesis uses the audited mixed real-world roster source", () => {
  const aggregate = createAlphaWorldAggregate({ seed: 77105, playerId: "real-roster-player" });
  const names = new Set(aggregate.state.people.map((person) => person.name));
  ok(
    aggregate.state.people.length === REAL_WORLD_ALPHA_RULESET.wrestlers,
    "Alpha World did not create the audited real-world roster",
  );
  ok(
    names.size === REAL_WORLD_ALPHA_RULESET.wrestlers,
    "Alpha World real-world roster contains duplicate identities",
  );
  ok(names.has("Cody Rhodes"), "Alpha World did not use the real roster source");
  ok(names.has("Swerve Strickland"), "Alpha World is missing a real active men's roster identity");
  ok(names.has("Rhea Ripley"), "Alpha World is missing a real active women's roster identity");
  ok(!names.has("PAC"), "Alpha World included a deliberately excluded non-active identity");

  const cody = aggregate.state.people.find((person) => person.name === "Cody Rhodes");
  const rhea = aggregate.state.people.find((person) => person.name === "Rhea Ripley");
  const prospect = aggregate.state.people.find((person) => person.name === "Je'Von Evans");
  ok(cody?.popularity !== undefined && cody.popularity >= 90, "Alpha World did not apply men's megastar calibration");
  ok(rhea?.popularity !== undefined && rhea.popularity >= 90, "Alpha World did not apply women's megastar calibration");
  ok(rhea?.division === "WOMEN", "Alpha World did not preserve women's division data");
  ok(prospect?.careerStage === "PROSPECT", "Alpha World did not apply prospect career calibration");
});


test("every real-roster wrestler starts with a complete labelled character and move set",()=>{
  const {state}=createAlphaWorldAggregate({seed:77201,playerId:"identity-coverage-check"});
  const personIds=new Set(state.people.map(person=>person.id));
  const records=state.wrestlerIdentities??[];
  ok(records.length===state.people.length
    &&new Set(records.map(record=>record.personId)).size===state.people.length
    &&records.every(record=>personIds.has(record.personId)),
    "Alpha's full real-world roster is missing portable identity records");
  for(const record of records){
    const active=record.active;
    ok(record.revision===1&&record.history.length===0
      &&active.personaName.trim().length>0
      &&active.gimmickId!=="AUTHENTIC"
      &&active.primaryStyle.length>0
      &&active.secondaryStyle!==active.primaryStyle
      &&active.signatureMoves.length>=1
      &&active.finishingMoves.length>=1
      &&[...active.signatureMoves,...active.finishingMoves].every(move=>move.name.length>0
        &&(move.source==="VERIFIED"||move.source==="PPW_AUTHORED")),
      "Alpha roster character coverage has incomplete or unattributed move data");
  }
  const roman=state.people.find(person=>person.name==="Roman Reigns")!;
  const romanIdentity=records.find(x=>x.personId===roman.id)!.active;
  ok(romanIdentity.gimmickId==="TRIBAL_CHIEF"
    &&romanIdentity.finishingMoves.some(move=>move.name==="Spear"&&move.source==="VERIFIED")
    &&romanIdentity.signatureMoves.some(move=>move.name==="Superman Punch"&&move.source==="VERIFIED"),
    "curated household-name character was replaced by an invented approximation");
  const snapshot=createPersistedWorldState(state);
  const restored=restorePersistedWorldState(JSON.parse(JSON.stringify(snapshot)));
  validatePortableWrestlerIdentities(restored);
  ok(restored.wrestlerIdentities?.length===records.length
    &&restored.wrestlerIdentities[0]!.active.signatureMoves.length>=1,
    "full initial identity roster was lost during database-format persistence");
  const before=JSON.stringify(restored.wrestlerIdentities);
  ok(completeAlphaWrestlerIdentityCoverage(restored)===0
    &&JSON.stringify(restored.wrestlerIdentities)===before,
    "checking coverage later silently repackaged existing wrestlers");
});

test("legacy identity backfill protects established characters and fills only empty records",()=>{
  const {state}=createAlphaWorldAggregate({seed:77202,playerId:"legacy-identity-check"});
  const protectedIdentity=structuredClone(state.wrestlerIdentities![0]!);
  protectedIdentity.active.personaName="Player Approved Name";
  protectedIdentity.active.provenance="NEGOTIATED";
  protectedIdentity.revision=2;
  state.wrestlerIdentities=[protectedIdentity];
  const count=completeAlphaWrestlerIdentityCoverage(state,"EXISTING_WORLD");
  ok(count===state.people.length-1
    &&state.wrestlerIdentities.length===state.people.length,
    "legacy identity migration omitted wrestlers or duplicated records");
  ok(state.wrestlerIdentities[0]!.revision===2
    &&state.wrestlerIdentities[0]!.active.personaName==="Player Approved Name",
    "legacy migration rewrote a wrestler's negotiated identity");
  ok(completeAlphaWrestlerIdentityCoverage(state,"EXISTING_WORLD")===0,
    "migrating identity records a second time created extra changes");
});

test("every regenerated prospect debuts with a fully populated persistent persona",()=>{
  const state=createWorld(77203,DEFAULT_RULESET);
  ok(state.wrestlerIdentities?.length===state.people.length,
    "new fictional Worlds did not seed complete wrestler identities");
  for(const person of state.people.slice(0,70))person.status="RETIRED";
  const before=state.people.length;
  const added=replenishTalentPopulation(state);
  ok(added>0&&state.people.length===before+added,
    "future prospect fixture did not generate replacement wrestlers");
  const newPeople=state.people.slice(-added);
  for(const person of newPeople){
    const identity=state.wrestlerIdentities?.find(x=>x.personId===person.id);
    ok(person.generatedTalent&&identity?.active.provenance==="GAME_AUTHORED"
      &&identity.active.gimmickId!=="AUTHENTIC"
      &&identity.active.primaryStyle.length>0
      &&identity.active.signatureMoves.length>=2
      &&identity.active.finishingMoves.length>=1
      &&identity.active.signatureMoves.every(m=>m.source==="PPW_AUTHORED")
      &&identity.active.finishingMoves.every(m=>m.source==="PPW_AUTHORED"),
      "new prospect entered the free market without a complete distinct identity");
  }
  const reloaded=restorePersistedWorldState(createPersistedWorldState(state));
  ok(newPeople.every(person=>reloaded.wrestlerIdentities?.some(x=>x.personId===person.id)),
    "prospect gimmicks disappeared after save/restore");
});

test("third curated identity wave improves 19 real women without missing move provenance",()=>{
  const names=new Set(REAL_ACTIVE_WOMENS_ROSTER_NAMES);
  const knownGimmicks=new Set<string>(GIMMICK_CATALOG.map(entry=>entry.id));
  const wave=VERIFIED_WOMENS_CHARACTER_WAVE_3;
  ok(wave.length===19,"women's curation wave is incomplete");
  ok(new Set(wave.map(entry=>entry.name)).size===wave.length
    &&new Set(CURATED_WRESTLER_CHARACTERS.map(entry=>entry.name)).size===CURATED_WRESTLER_CHARACTERS.length,
    "a wrestler has duplicate curation entries");
  for (const entry of wave) {
    ok(names.has(entry.name)&&knownGimmicks.has(entry.gimmickArchetype),
      "new women's curation lacks an existing wrestler or uses unknown gimmick "+entry.name);
    ok(entry.sourceUrl.startsWith("https://www.wwe.com/")
      ||entry.sourceUrl.startsWith("https://www.allelitewrestling.com/"),
      "unsupported publisher link in women's curation");
    ok(entry.evidenceUrls.every(url=>url.startsWith("https://www.wwe.com/")
      ||url.startsWith("https://www.allelitewrestling.com/")),
      "move evidence references a non-publisher domain");
    ok(entry.finishingMoves.length>0&&entry.finishingMove?.name===entry.finishingMoves[0]?.name,
      "new curated record lost its verified real-world finisher");
    ok(entry.signatureMove?.name===(entry.signatureMoves[0]?.name??undefined),
      "new curated record mismatches primary and full signature repertoire");
  }
});

test("new Alpha World uses researched women's gimmicks while protecting existing World personas",()=>{
  const state=createAlphaWorldAggregate({seed:77212,playerId:"womens-identity-audit"}).state;
  const persona=(name:string)=>{
    const person=state.people.find(x=>x.name===name);
    if(!person)throw Error("required seeded woman was missing: "+name);
    const identity=state.wrestlerIdentities?.find(x=>x.personId===person.id);
    if(!identity)throw Error("missing wrestler identity: "+name);
    return identity;
  };
  const asuka=persona("Asuka");
  const sky=persona("IYO SKY");
  const jade=persona("Jade Cargill");
  const mercedes=persona("Mercedes Moné");
  const stephanie=persona("Stephanie Vaquer");
  const tiffany=persona("Tiffany Stratton");
  const kris=persona("Kris Statlander");
  ok(asuka.active.gimmickId==="SUBMISSION_SPECIALIST"
    &&asuka.active.finishingMoves.some(m=>m.name==="Asuka Lock"&&m.source==="VERIFIED"),
    "Asuka retained an invented finishing move");
  ok(sky.active.gimmickId==="HIGH_FLYING_DAREDEVIL"
    &&sky.active.finishingMoves.some(m=>m.name==="Over The Moonsault"&&m.source==="VERIFIED"),
    "IYO SKY lost her recognised finisher");
  ok(jade.active.finishingMoves.some(m=>m.name==="Jaded"&&m.source==="VERIFIED")
    &&mercedes.active.finishingMoves.some(m=>m.name==="Statement Maker"&&m.source==="VERIFIED")
    &&mercedes.active.signatureMoves.some(m=>m.name==="Moné Maker"&&m.source==="VERIFIED"),
    "prominent women were still using generic finishers");
  ok(stephanie.active.signatureMoves.length===2
    &&stephanie.active.signatureMoves.every(m=>m.source==="VERIFIED"),
    "multiple published signatures were lost for Stephanie Vaquer");
  ok(tiffany.active.finishingMoves[0]?.name==="Prettiest Moonsault Ever"
    &&kris.active.finishingMoves[0]?.name==="Night Fever",
    "distinctive women's character moves were not seeded");
  const withoutDocumentedSignature=persona("Tiffany Stratton");
  ok(withoutDocumentedSignature.active.signatureMoves.length>=1
    &&withoutDocumentedSignature.active.signatureMoves[0]?.source==="PPW_AUTHORED",
    "unsourced signature move was falsely labelled as verified");
  const before=JSON.stringify(state.wrestlerIdentities);
  ok(completeAlphaWrestlerIdentityCoverage(state,"EXISTING_WORLD")===0
    &&JSON.stringify(state.wrestlerIdentities)===before,
    "new research rewrote an already persisted World identity");
  asuka.active.gimmickId="REBEL";
  asuka.active.provenance="NEGOTIATED";
  asuka.revision=2;
  const negotiated=JSON.stringify(asuka);
  ok(completeAlphaWrestlerIdentityCoverage(state,"EXISTING_WORLD")===0
    &&JSON.stringify(asuka)===negotiated,
    "curation overrode an explicit in-World gimmick change");
});

test("entire 643-person real-roster identity guide has individually keyed character packages",()=>{
  const all=[...REAL_ACTIVE_MENS_ROSTER_NAMES,...REAL_ACTIVE_WOMENS_ROSTER_NAMES];
  const names=new Set(all);
  const guide=FULL_REAL_ROSTER_IDENTITY_GUIDE;
  const gimmicks=new Set<string>(GIMMICK_CATALOG.map(x=>x.id));
  ok(all.length===643&&guide.length===all.length,
    "guide does not explicitly cover every existing real wrestler in the seed pool");
  ok(new Set(guide.map(entry=>entry.name)).size===643,
    "a wrestler is duplicated in the guide");
  const assigned=new Set<string>(),families=new Set<string>(),styles=new Set<string>();
  for(const entry of guide){
    ok(names.has(entry.name)&&!assigned.has(entry.name),"guide entry is orphaned or duplicated: "+entry.name);
    assigned.add(entry.name);
    styles.add(entry.primaryStyle);
    families.add(entry.gimmickArchetype);
    ok(gimmicks.has(entry.gimmickArchetype)&&entry.gimmickArchetype!=="AUTHENTIC",
      "guide has generic or unsupported gimmick: "+entry.name);
    ok(entry.primaryStyle.length>0&&entry.secondaryStyle!==entry.primaryStyle,
      "guide has invalid wrestling styles: "+entry.name);
    ok(entry.signatureMoves.length>=2&&entry.finishingMoves.length>=1
      &&[...entry.signatureMoves,...entry.finishingMoves].every(move=>
        move.name.length>=2&&move.name.length<=80&&move.source==="PPW_AUTHORED"),
      "guide contains empty or falsely verified move names: "+entry.name);
    ok(entry.signatureMoves[0]!.name!==entry.signatureMoves[1]!.name,
      "guide gave one wrestler duplicated signature moves: "+entry.name);
  }
  ok(families.size>=30&&styles.size===9,"roster-wide curation collapsed into too few archetypes");
  ok(guide.filter(x=>x.editorialBasis==="TARGETED").length>=130,
    "too few recognisable wrestlers received targeted character overrides");
  ok(guide.filter(x=>x.editorialBasis==="COHORT").length===0,
    "the obscure-wrestler approximation cohort is incomplete");
  const danhausen=fullRealRosterIdentityFor("Danhausen")!;
  const sabre=fullRealRosterIdentityFor("Zack Sabre Jr.")!;
  const maki=fullRealRosterIdentityFor("Maki Itoh")!;
  const hechi=fullRealRosterIdentityFor("Hechicero")!;
  ok(danhausen.gimmickArchetype==="ECCENTRIC"&&danhausen.finishingMoves[0]?.name==="Goodnighthausen"
    &&sabre.gimmickArchetype==="SUBMISSION_SPECIALIST"&&sabre.primaryStyle==="SUBMISSION"
    &&maki.gimmickArchetype==="CULT_FAVOURITE"
    &&hechi.primaryStyle==="LUCHA",
    "recognisable wrestler was assigned an unsuitable random default");
  danhausen.signatureMoves[0]!.name="mutated private lookup";
  ok(fullRealRosterIdentityFor("Danhausen")?.signatureMoves[0]?.name==="Very Nice Very Evil",
    "guide lookup leaked mutable roster data");
  ok(fullRealRosterIdentityFor("Invented Future Prospect")===null,
    "future generated wrestlers must use deterministic generation, not a random real profile");
});

test("all seeded real wrestlers use curated or roster-specific identities; existing agreements are protected",()=>{
  const state=createAlphaWorldAggregate({seed:77305,playerId:"complete-643-guide"}).state;
  const records=state.wrestlerIdentities??[];
  ok(records.length===643&&state.people.length===643,
    "fresh World missed real-roster character assignments");
  const byPerson=new Map(records.map(x=>[x.personId,x]));
  let verified=0,approx=0;
  for(const person of state.people){
    const record=byPerson.get(person.id)!;
    ok(record?.active.personaName===person.name,
      "person did not retain their own ring identity: "+person.name);
    const signatureNames=record.active.signatureMoves.map(m=>m.name.toLocaleLowerCase("en-GB"));
    const finisherNames=record.active.finishingMoves.map(m=>m.name.toLocaleLowerCase("en-GB"));
    ok(record.active.signatureMoves.length>=2 &&record.active.finishingMoves.length>=1,
      "new World wrestler lacks two named signatures and a finisher: "+person.name);
    ok(new Set(signatureNames).size===signatureNames.length &&
      new Set(finisherNames).size===finisherNames.length,
      "duplicate moves within a wrestler's seeded identity: "+person.name);
    ok([...record.active.signatureMoves,...record.active.finishingMoves].every(m=>
      m.name.trim().length>1 && (m.source==="VERIFIED"||m.source==="PPW_AUTHORED")),
      "new World wrestler has unlabelled or incomplete move provenance: "+person.name);
    if(record.active.provenance==="CURATED"){verified++;continue;}
    ok(record.active.provenance==="ROSTER_APPROXIMATION",
      "non-curated real wrestler did not get their own roster guide: "+person.name);
    const guide=fullRealRosterIdentityFor(person.name)!;
    ok(record.active.gimmickId===guide.gimmickArchetype
      &&record.active.primaryStyle===guide.primaryStyle
      &&record.active.finishingMoves[0]?.name===guide.finishingMoves[0]?.name
      &&record.active.finishingMoves[0]?.source==="PPW_AUTHORED",
      "seeded wrestler did not receive their exact-name authored gimmick and moves: "+person.name);
    approx++;
  }
  ok(verified===CURATED_WRESTLER_CHARACTERS.length&&approx===643-verified,
    "not all researched and approximated wrestlers were assigned correctly");
  ok(CURATED_WRESTLER_CHARACTERS.length===60,
    "published-source character catalogue unexpectedly lost previously sourced wrestlers");
  for(const curated of CURATED_WRESTLER_CHARACTERS){
    const person=state.people.find(p=>p.name===curated.name)!;
    const wrestler=byPerson.get(person.id)!;
    ok(wrestler.active.provenance==="CURATED",
      "publisher-sourced wrestler was displaced by an editorial approximation: "+curated.name);
    const publishedSignatures="signatureMoves" in curated
      ? curated.signatureMoves
      : curated.signatureMove?[curated.signatureMove]:[];
    const publishedFinishers="finishingMoves" in curated
      ? curated.finishingMoves
      : curated.finishingMove?[curated.finishingMove]:[];
    for(const published of publishedSignatures){
      ok(wrestler.active.signatureMoves.some(move=>
        move.name===published.name &&move.category===published.category
          &&move.source==="VERIFIED"),
        "source-backed signature move was discarded or mislabelled: "+curated.name);
    }
    for(const published of publishedFinishers){
      ok(wrestler.active.finishingMoves.some(move=>
        move.name===published.name &&move.category===published.category
          &&move.source==="VERIFIED"),
        "source-backed finishing move was discarded or mislabelled: "+curated.name);
    }
  }
  const sabre=state.people.find(p=>p.name==="Zack Sabre Jr.")!;
  const sabreRecord=byPerson.get(sabre.id)!;
  ok(sabreRecord.active.gimmickId==="SUBMISSION_SPECIALIST"
    &&sabreRecord.active.finishingMoves[0]?.name==="Zack Driver",
    "notable non-curated wrestler still had a random gimmick or generic finisher");
  const asuka=state.people.find(p=>p.name==="Asuka")!;
  ok(byPerson.get(asuka.id)?.active.finishingMoves[0]?.name==="Asuka Lock"
    &&byPerson.get(asuka.id)?.active.finishingMoves[0]?.source==="VERIFIED",
    "less-verified guide overrode sourced moves");
  const asukaIdentity=byPerson.get(asuka.id)!;
  ok(asukaIdentity.active.signatureMoves.length>=2 &&
    asukaIdentity.active.signatureMoves.every(m=>m.source==="PPW_AUTHORED"),
    "sourced Asuka finisher should be preserved while unknown signature slots remain PPW-authored");
  const roman=state.people.find(p=>p.name==="Roman Reigns")!;
  const romanIdentity=byPerson.get(roman.id)!;
  ok(romanIdentity.active.signatureMoves.length>=2
    &&romanIdentity.active.signatureMoves.some(m=>m.name==="Superman Punch"&&m.source==="VERIFIED")
    &&romanIdentity.active.signatureMoves.some(m=>m.source==="PPW_AUTHORED")
    &&romanIdentity.active.finishingMoves.some(m=>m.name==="Spear"&&m.source==="VERIFIED"),
    "curated world wrestler source priority or editorial signature backfill was lost");

  const before=JSON.stringify(state.wrestlerIdentities);
  ok(completeAlphaWrestlerIdentityCoverage(state,"EXISTING_WORLD")===0
    &&JSON.stringify(state.wrestlerIdentities)===before,
    "a new guide version silently overwrote in-game characters");
  sabreRecord.revision=2;
  sabreRecord.active.gimmickId="REBEL";
  sabreRecord.active.provenance="NEGOTIATED";
  const agreed=JSON.stringify(sabreRecord);
  ok(completeAlphaWrestlerIdentityCoverage(state,"EXISTING_WORLD")===0
    &&JSON.stringify(sabreRecord)===agreed,
    "player's negotiated character was overwritten by the editorial guide");
});


test("editorial wave four corrects 79 exact-name identities without claiming verified moves",()=>{
  const reviewed=REVIEWED_REAL_ROSTER_IDENTITIES_WAVE4;
  ok(reviewed.length===79 && new Set(reviewed.map(row=>row.name)).size===79,
    "wave-four review must retain 79 individually keyed identities");
  ok(FULL_REAL_ROSTER_IDENTITY_GUIDE.filter(row=>row.editorialBasis==="COHORT").length===0,
    "reviewed cohort count changed without an audit");
  for(const row of reviewed){
    const merged=fullRealRosterIdentityFor(row.name)!;
    ok(merged?.gimmickArchetype===row.gimmickArchetype
      &&merged.primaryStyle===row.primaryStyle
      &&merged.secondaryStyle===row.secondaryStyle
      &&merged.editorialBasis==="TARGETED", 
      "identity review failed to replace unsuitable archetype or style: "+row.name);
    ok(JSON.stringify(merged.signatureMoves)===JSON.stringify(row.signatureMoves)
      &&JSON.stringify(merged.finishingMoves)===JSON.stringify(row.finishingMoves),
      "reviewed move set was not applied: "+row.name);
    ok(row.signatureMoves.length===2 && row.finishingMoves.length>=1
      &&[...row.signatureMoves,...row.finishingMoves].every(move=>move.source==="PPW_AUTHORED"),
      "unsourced editorial move was falsely presented as verified: "+row.name);
    const found=fullRealRosterIdentityFor(row.name)!;
    found.signatureMoves[0]!.name="cross-World mutation";
    ok(fullRealRosterIdentityFor(row.name)!.signatureMoves[0]!.name!=="cross-World mutation",
      "editorial guide leaked shared mutable move records: "+row.name);
  }
  for(const [name,gimmick,style,finisher] of [
    ["Dax Harwood","RING_GENERAL","ALL_ROUNDER","Sheer Drop Brainbuster"],
    ["Joe Hendry","SHOWMAN","POWERHOUSE","Standing Ovation"],
    ["Orange Cassidy","ECCENTRIC","ALL_ROUNDER","Orange Punch"],
    ["Will Ospreay","HIGH_FLYING_DAREDEVIL","HIGH_FLYER","Hidden Blade"],
    ["Josh Barnett","MMA_CROSSOVER","SUBMISSION","Cross Heel Hold"],
    ["Cedric Alexander","HIGH_FLYING_DAREDEVIL","ALL_ROUNDER","Lumbar Check"],
  ]){
    const candidate=fullRealRosterIdentityFor(name)!;
    ok(candidate.gimmickArchetype===gimmick && candidate.primaryStyle===style
      &&candidate.finishingMoves[0]?.name===finisher,
      "recognisable wrestler retained an incorrect placeholder identity: "+name);
  }
});


test("editorial wave five preserves exact wrestler ownership and improves 129 women's lucha and specialist profiles",()=>{
  const reviewed=REVIEWED_REAL_ROSTER_IDENTITIES_WAVE5;
  const earlier=new Set(REVIEWED_REAL_ROSTER_IDENTITIES_WAVE4.map(row=>row.name));
  ok(reviewed.length===129 && new Set(reviewed.map(row=>row.name)).size===129,
    "wave-five rows missing or accidentally duplicated");
  ok(reviewed.every(row=>!earlier.has(row.name)),
    "review waves overlap or accidentally overwrite earlier curation");
  ok(FULL_REAL_ROSTER_IDENTITY_GUIDE.length===643 &&
    FULL_REAL_ROSTER_IDENTITY_GUIDE.filter(row=>row.editorialBasis==="TARGETED").length===643 &&
    FULL_REAL_ROSTER_IDENTITY_GUIDE.filter(row=>row.editorialBasis==="COHORT").length===0,
    "editorial audit coverage changed without review");
  const gimmicks=new Set<string>(GIMMICK_CATALOG.map(row=>row.id));
  for(const row of reviewed){
    const merged=fullRealRosterIdentityFor(row.name)!;
    ok(merged?.editorialBasis==="TARGETED" && merged.gimmickArchetype===row.gimmickArchetype
      && merged.primaryStyle===row.primaryStyle && merged.secondaryStyle===row.secondaryStyle,
      "wave-five wrestler did not retain intended persona and styles: "+row.name);
    ok(gimmicks.has(row.gimmickArchetype) && row.primaryStyle!==row.secondaryStyle,
      "invalid identity catalogue assignment: "+row.name);
    ok(JSON.stringify(merged.signatureMoves)===JSON.stringify(row.signatureMoves)
      && JSON.stringify(merged.finishingMoves)===JSON.stringify(row.finishingMoves),
      "wave-five move repertoire not wired into authoritative guide read: "+row.name);
    ok(row.signatureMoves.length===2 && row.finishingMoves.length===1 &&
      [...row.signatureMoves,...row.finishingMoves].every(move=>move.source==="PPW_AUTHORED"),
      "unsourced editorial move misrepresented as verified: "+row.name);
  }
  for(const [name,style,gimmick,finisher] of [
    ["Koguma","HIGH_FLYER","COMEDY","Koguma Yoshitanic"],
    ["Toni Storm","ALL_ROUNDER","SHOWMAN","Storm Zero"],
    ["Marina Shafir","SUBMISSION","MMA_CROSSOVER","Mother's Milk"],
    ["MJF","TECHNICAL","ARROGANT_ACE","Salt of the Earth"],
    ["Kazuchika Okada","ALL_ROUNDER","ARROGANT_ACE","Rainmaker"],
    ["Megan Bayne","POWERHOUSE","BEAST","Fate's Descent"],
    ["Elton Prince","ALL_ROUNDER","SHOW_OFF","Spilt Milk"],
    ["La Catalina","LUCHA","SHOWMAN","Moonsault"],
    ["Yuki Ueno","HIGH_FLYER","SHOWMAN","WR"],
  ]){
    const row=fullRealRosterIdentityFor(name)!;
    ok(row.primaryStyle===style && row.gimmickArchetype===gimmick
      && row.finishingMoves[0]?.name===finisher,
      "specific wrestling identity still inherited an unrelated random cohort: "+name);
  }
  const testWorld=createAlphaWorldAggregate({seed:77306,playerId:"wave5-world-check"}).state;
  const person=testWorld.people.find(p=>p.name==="Koguma")!;
  const live=(testWorld.wrestlerIdentities??[]).find(r=>r.personId===person.id)!;
  ok(live.active.gimmickId==="COMEDY" && live.active.finishingMoves[0]?.name==="Koguma Yoshitanic"
    && live.active.finishingMoves[0]?.source==="PPW_AUTHORED",
    "new World did not apply wave-five identity review");
  const before=JSON.stringify(live);
  ok(completeAlphaWrestlerIdentityCoverage(testWorld,"EXISTING_WORLD")===0
    && JSON.stringify(live)===before,
    "backfill silently replaced an already persisted world wrestler identity");
});


test("identity audit wave six replaces 89 conspicuously wrong profiles, without overriding negotiated careers",()=>{
  const batch=REVIEWED_REAL_ROSTER_IDENTITIES_WAVE6;
  const prior=new Set([...REVIEWED_REAL_ROSTER_IDENTITIES_WAVE4,...REVIEWED_REAL_ROSTER_IDENTITIES_WAVE5].map(x=>x.name));
  ok(batch.length===89 && new Set(batch.map(x=>x.name)).size===89,
    "wave-six roster-specific review rows missing or duplicated");
  ok(batch.every(x=>!prior.has(x.name)),
    "wave-six review overwrote prior wrestler review");
  ok(FULL_REAL_ROSTER_IDENTITY_GUIDE.length===643 &&
    FULL_REAL_ROSTER_IDENTITY_GUIDE.filter(x=>x.editorialBasis==="TARGETED").length===643 &&
    FULL_REAL_ROSTER_IDENTITY_GUIDE.filter(x=>x.editorialBasis==="COHORT").length===0,
    "audit-six coverage counts changed without review");
  const gimmicks=new Set<string>(GIMMICK_CATALOG.map(x=>x.id));
  for(const row of batch){
    const now=fullRealRosterIdentityFor(row.name)!;
    ok(now!==null && gimmicks.has(row.gimmickArchetype)
      && now.gimmickArchetype===row.gimmickArchetype
      && now.primaryStyle===row.primaryStyle
      && now.secondaryStyle===row.secondaryStyle
      && now.editorialBasis==="TARGETED",
      "wave-six exact wrestler gimmick/style missing: "+row.name);
    ok(JSON.stringify(now.signatureMoves)===JSON.stringify(row.signatureMoves)
      && JSON.stringify(now.finishingMoves)===JSON.stringify(row.finishingMoves),
      "wave-six wrestler's repertoire was not layered: "+row.name);
    ok(row.signatureMoves.length===2 && row.finishingMoves.length===1 &&
      row.primaryStyle!==row.secondaryStyle &&
      [...row.signatureMoves,...row.finishingMoves].every(m=>m.source==="PPW_AUTHORED"),
      "wave-six moves missing, duplicated styles or falsely sourced: "+row.name);
  }
  for(const [name,archetype,style,finish] of [
    ["Dominik Mysterio","OPPORTUNIST","LUCHA","Frog Splash"],
    ["Chad Gable","WRESTLING_MACHINE","TECHNICAL","Ankle Lock"],
    ["Roman Reigns","TRIBAL_CHIEF","POWERHOUSE","Spear"],
    ["Seth Rollins","REVOLUTIONARY","ALL_ROUNDER","Stomp"],
    ["Shinsuke Nakamura","STRONG_STYLE_ACE","STRONG_STYLE","Kinshasa"],
    ["Komander","HIGH_FLYING_DAREDEVIL","LUCHA","Cielito Lindo"],
    ["Kento Miyahara","STRONG_STYLE_ACE","STRONG_STYLE","Shutdown Suplex Hold"],
  ]){
    const guide=fullRealRosterIdentityFor(name)!;
    ok(guide.gimmickArchetype===archetype && guide.primaryStyle===style
      && guide.finishingMoves[0]?.name===finish,
      "recognisable wrestler retained generic cohort misclassification: "+name);
  }
  const state=createAlphaWorldAggregate({seed:77307,playerId:"audit-six-world"}).state;
  const kento=state.people.find(x=>x.name==="Kento Miyahara")!;
  const record=state.wrestlerIdentities!.find(x=>x.personId===kento.id)!;
  ok(record.active.gimmickId==="STRONG_STYLE_ACE"
    &&record.active.finishingMoves[0]?.name==="Shutdown Suplex Hold"
    &&record.active.finishingMoves[0]?.source==="PPW_AUTHORED",
    "new World failed to apply the exact-name Japanese wrestler review");
  const before=JSON.stringify(record);
  ok(completeAlphaWrestlerIdentityCoverage(state,"EXISTING_WORLD")===0
    &&JSON.stringify(record)===before,
    "existing wrestler identity was rewritten by later guide read");
});


test("WWE and NXT wave seven replaces all 62 outstanding cohort identities without altering saved wrestling careers",()=>{
  const batch=REVIEWED_REAL_ROSTER_IDENTITIES_WAVE7;
  const earlier=new Set([...REVIEWED_REAL_ROSTER_IDENTITIES_WAVE4,
    ...REVIEWED_REAL_ROSTER_IDENTITIES_WAVE5,
    ...REVIEWED_REAL_ROSTER_IDENTITIES_WAVE6].map(x=>x.name));
  const names=new Set(batch.map(x=>x.name));
  ok(batch.length===62 && names.size===62 && batch.every(x=>!earlier.has(x.name)),
    "WWE/NXT wave-seven audit missing, duplicated, or overlapping names");
  const gimmicks=new Set<string>(GIMMICK_CATALOG.map(x=>x.id));
  ok(FULL_REAL_ROSTER_IDENTITY_GUIDE.length===643
    &&FULL_REAL_ROSTER_IDENTITY_GUIDE.filter(x=>x.editorialBasis==="TARGETED").length===643
    &&FULL_REAL_ROSTER_IDENTITY_GUIDE.filter(x=>x.editorialBasis==="COHORT").length===0,
    "roster review counts are not 643 targeted and zero cohort");
  for(const row of batch){
    const guide=fullRealRosterIdentityFor(row.name)!;
    ok(guide?.editorialBasis==="TARGETED"
      &&gimmicks.has(row.gimmickArchetype)
      &&guide.gimmickArchetype===row.gimmickArchetype
      &&guide.primaryStyle===row.primaryStyle
      &&guide.secondaryStyle===row.secondaryStyle
      &&guide.cohort==="WWE_NXT",
      "WWE/NXT athlete received mismatched gimmick or wrestling styles: "+row.name);
    ok(JSON.stringify(guide.signatureMoves)===JSON.stringify(row.signatureMoves)
      &&JSON.stringify(guide.finishingMoves)===JSON.stringify(row.finishingMoves)
      &&row.signatureMoves.length===2 &&row.finishingMoves.length===1
      &&row.primaryStyle!==row.secondaryStyle
      &&[...row.signatureMoves,...row.finishingMoves].every(move=>move.source==="PPW_AUTHORED"),
      "WWE/NXT wrestler's moves incorrectly assigned or provenance promoted: "+row.name);
    const original=fullRealRosterIdentityFor(row.name)!;
    original.finishingMoves[0]!.name="shared-state corruption";
    ok(fullRealRosterIdentityFor(row.name)?.finishingMoves[0]?.name!=="shared-state corruption",
      "wrestler guide returned a mutable shared move for "+row.name);
  }
  for(const [name,archetype,style,finish] of [
    ["Penta","REBEL_LUCHADOR","LUCHA","Mexican Destroyer"],
    ["Nia Jax","MONSTER","POWERHOUSE","Annihilator"],
    ["Sol Ruca","HIGH_FLYING_DAREDEVIL","HIGH_FLYER","Sol Snatcher"],
    ["Rayo Americano","MASKED_MYSTERY","TECHNICAL","Bitter End"],
    ["Royce Keys","POWERHOUSE","POWERHOUSE","Town Business"],
    ["Channing \"Stacks\" Lorenzo","OPPORTUNIST","BRAWLER","Spinning Neckbreaker"],
  ]){
    const guide=fullRealRosterIdentityFor(name)!;
    ok(guide.gimmickArchetype===archetype
      &&guide.primaryStyle===style &&guide.finishingMoves[0]?.name===finish,
      "recognisable wrestler retained wrong generic gimmick/style/repertoire: "+name);
  }
  const state=createAlphaWorldAggregate({seed:77308,playerId:"wave7-bootstrap"}).state;
  const rookie=state.people.find(x=>x.name==="Bronco Nima")!;
  const identity=state.wrestlerIdentities!.find(x=>x.personId===rookie.id)!;
  ok(identity.active.gimmickId==="ENFORCER"
    &&identity.active.finishingMoves[0]?.name==="Sit-out Powerbomb"
    &&identity.active.finishingMoves[0]?.source==="PPW_AUTHORED",
    "new World failed to seed wave-seven exact roster identity");
  const prior=JSON.stringify(identity);
  ok(completeAlphaWrestlerIdentityCoverage(state,"EXISTING_WORLD")===0
    &&JSON.stringify(identity)===prior,
    "a guide update overwrote existing wrestler career");
});


test("identity audit wave eight completes AEW TNA NOAH and lucha cohort curation",()=>{
  const wave=REVIEWED_REAL_ROSTER_IDENTITIES_WAVE8;
  const priorNames=new Set([...REVIEWED_REAL_ROSTER_IDENTITIES_WAVE4,
    ...REVIEWED_REAL_ROSTER_IDENTITIES_WAVE5,
    ...REVIEWED_REAL_ROSTER_IDENTITIES_WAVE6,
    ...REVIEWED_REAL_ROSTER_IDENTITIES_WAVE7].map(x=>x.name));
  const cohortCounts=new Map<string,number>();
  const gimmicks=new Set<string>(GIMMICK_CATALOG.map(g=>g.id));
  ok(wave.length===52 && new Set(wave.map(x=>x.name)).size===52,
    "wave eight must include 52 unique wrestler identities");
  for(const row of wave){
    ok(!priorNames.has(row.name),"overlapping audit rows for "+row.name);
    const mapped=fullRealRosterIdentityFor(row.name)!;
    ok(mapped && mapped.editorialBasis==="TARGETED"
      &&mapped.gimmickArchetype===row.gimmickArchetype
      &&mapped.primaryStyle===row.primaryStyle
      &&mapped.secondaryStyle===row.secondaryStyle
      &&gimmicks.has(row.gimmickArchetype)
      &&row.primaryStyle!==row.secondaryStyle,
      "wave eight identity mismatched wrestler and styles: "+row.name);
    ok(JSON.stringify(mapped.signatureMoves)===JSON.stringify(row.signatureMoves)
      &&JSON.stringify(mapped.finishingMoves)===JSON.stringify(row.finishingMoves)
      &&row.signatureMoves.length===2 &&row.finishingMoves.length===1
      &&[...row.signatureMoves,...row.finishingMoves].every(m=>m.source==="PPW_AUTHORED"),
      "wave eight move classification or provenance invalid: "+row.name);
    cohortCounts.set(mapped.cohort,(cohortCounts.get(mapped.cohort)??0)+1);
  }
  for(const [cohort,count] of [
    ["AEW_ROH",30],["TNA",9],["JAPAN_LUCHA",5],["LUCHA",8]
  ]){
    ok(cohortCounts.get(String(cohort))===count,"incomplete wave-eight review for "+cohort);
  }
  ok(FULL_REAL_ROSTER_IDENTITY_GUIDE.length===643
    &&FULL_REAL_ROSTER_IDENTITY_GUIDE.filter(x=>x.editorialBasis==="COHORT").length===0
    &&FULL_REAL_ROSTER_IDENTITY_GUIDE.filter(x=>x.editorialBasis==="TARGETED").length===643,
    "roster audit counts after wave eight are wrong");
  for(const [name,gimmick,style,finish] of [
    ["Alec Price","HIGH_FLYING_DAREDEVIL","HIGH_FLYER","Suicide Dive DDT"],
    ["Tay Melo","MMA_CROSSOVER","STRIKER","Tay-KO"],
    ["OZAWA","ARROGANT_ACE","HIGH_FLYER","Real Rebel"],
    ["Mara Sadé","HIGH_FLYING_DAREDEVIL","HIGH_FLYER","Diving Double Stomp"],
    ["Candela","HIGH_FLYING_DAREDEVIL","LUCHA","Diving Senton"],
  ]){
    const row=fullRealRosterIdentityFor(name)!;
    ok(row.gimmickArchetype===gimmick&&row.primaryStyle===style
      &&row.finishingMoves[0]?.name===finish,
      "wrestler still has incoherent approximation: "+name);
  }
});


test("wave nine completes the 643-person real wrestler guide without converting approximations to verified claims",()=>{
  const earlier=[...REVIEWED_REAL_ROSTER_IDENTITIES_WAVE4,
    ...REVIEWED_REAL_ROSTER_IDENTITIES_WAVE5,
    ...REVIEWED_REAL_ROSTER_IDENTITIES_WAVE6,
    ...REVIEWED_REAL_ROSTER_IDENTITIES_WAVE7,
    ...REVIEWED_REAL_ROSTER_IDENTITIES_WAVE8];
  const batch=REVIEWED_REAL_ROSTER_IDENTITIES_WAVE9;
  const earlierNames=new Set(earlier.map(row=>row.name));
  const batchNames=new Set(batch.map(row=>row.name));
  const allNames=new Set([...earlierNames,...batchNames]);
  ok(earlier.length===411 && batch.length===96 && batchNames.size===96
    &&allNames.size===507 && batch.every(row=>!earlierNames.has(row.name)),
    "editorial audit wave nine is incomplete, duplicated or overlaps prior waves");
  ok(FULL_REAL_ROSTER_IDENTITY_GUIDE.length===643 &&
    FULL_REAL_ROSTER_IDENTITY_GUIDE.filter(x=>x.editorialBasis==="TARGETED").length===643 &&
    FULL_REAL_ROSTER_IDENTITY_GUIDE.filter(x=>x.editorialBasis==="COHORT").length===0,
    "not all 643 wrestlers have had their cohort approximations reviewed");
  const gimmicks=new Set<string>(GIMMICK_CATALOG.map(g=>g.id));
  const cohorts=new Map<string,number>();
  for(const row of batch){
    const guide=fullRealRosterIdentityFor(row.name)!;
    ok(guide!==null && gimmicks.has(row.gimmickArchetype)
      &&guide.editorialBasis==="TARGETED"
      &&guide.gimmickArchetype===row.gimmickArchetype
      &&guide.primaryStyle===row.primaryStyle
      &&guide.secondaryStyle===row.secondaryStyle
      &&row.primaryStyle!==row.secondaryStyle,
      "wave-nine exact-name wrestler did not receive reviewed style and gimmick: "+row.name);
    ok(JSON.stringify(guide.signatureMoves)===JSON.stringify(row.signatureMoves)
      &&JSON.stringify(guide.finishingMoves)===JSON.stringify(row.finishingMoves)
      &&row.signatureMoves.length>=2 &&row.finishingMoves.length>=1
      &&[...row.signatureMoves,...row.finishingMoves].every(m=>m.source==="PPW_AUTHORED"),
      "wave-nine wrestler's move names missing or falsely presented as verified: "+row.name);
    cohorts.set(guide.cohort,(cohorts.get(guide.cohort)??0)+1);
  }
  ok(cohorts.size===2 &&cohorts.get("JAPAN")===29 &&cohorts.get("INDIE")===67,
    "wave-nine worker assignments crossed cohorts or left people unreviewed");
  const world=createAlphaWorldAggregate({seed:77309,playerId:"wave9-alpha-bootstrap"}).state;
  const person=world.people.find(p=>p.name==="Daiki Nagai")!;
  const active=world.wrestlerIdentities?.find(x=>x.personId===person.id)!;
  ok(active?.active.gimmickId==="YOUNG_LION" &&
    active?.active.finishingMoves[0]?.name==="Boston Crab" &&
    active?.active.finishingMoves[0]?.source==="PPW_AUTHORED",
    "new World did not receive independent Japanese young-lion identity");
  const saved=JSON.stringify(world.wrestlerIdentities);
  ok(completeAlphaWrestlerIdentityCoverage(world,"EXISTING_WORLD")===0
    &&JSON.stringify(world.wrestlerIdentities)===saved,
    "wave nine rewrote wrestler-owned identities in an already saved World");
});

test("the entire exact-name real roster keeps complete stable move records",()=>{
  const entries=FULL_REAL_ROSTER_IDENTITY_GUIDE;
  const exact=new Set(entries.map(row=>row.name.toLocaleLowerCase("en-GB")));
  const gimmicks=new Set<string>(GIMMICK_CATALOG.map(x=>x.id));
  ok(exact.size===643 &&entries.length===643,
    "real wrestler roster lost or duplicated names");
  for(const row of entries){
    const moves=[...row.signatureMoves,...row.finishingMoves];
    ok(gimmicks.has(row.gimmickArchetype) &&row.gimmickArchetype!=="AUTHENTIC",
      "roster reverted to generic authentic presentation: "+row.name);
    ok(row.primaryStyle.length>0 &&row.primaryStyle!==row.secondaryStyle
      &&row.signatureMoves.length>=2 &&row.finishingMoves.length>=1,
      "wrestler does not have independently playable style and move records: "+row.name);
    ok(moves.every(m=>m.name.trim().length>1 &&
      (m.source==="VERIFIED"||m.source==="PPW_AUTHORED")),
      "unlabelled or empty move provenance: "+row.name);
    const first=fullRealRosterIdentityFor(row.name)!;
    first.signatureMoves[0]!.name="shared-reference mutation";
    ok(fullRealRosterIdentityFor(row.name)!.signatureMoves[0]!.name!=="shared-reference mutation",
      "guide returned another World's mutable wrestler move: "+row.name);
  }
});


test("future generated wrestlers begin with complete deterministic portable character repertoires",()=>{
  const fixture=createAlphaWorldAggregate({seed:88273,playerId:"future-prospect-coverage"}).state;
  const template=fixture.people[0]!;
  const prior=JSON.stringify(fixture.people);
  const gimmicks=new Set<string>(GIMMICK_CATALOG.map(x=>x.id));
  for(let n=0;n<96;n++){
    const prospect={...template,id:"future-prospect-"+n,name:"Generated Prospect "+n};
    const active=authoredPersonaForPerson(prospect);
    const again=authoredPersonaForPerson(prospect);
    ok(JSON.stringify(active)===JSON.stringify(again)
      &&active.personaName===prospect.name
      &&active.provenance==="GAME_AUTHORED",
      "future wrestler persona must be stable across retries: "+prospect.name);
    ok(gimmicks.has(active.gimmickId)
      &&active.primaryStyle!==active.secondaryStyle
      &&active.signatureMoves.length===2 &&active.finishingMoves.length===1,
      "future wrestler spawned without gimmick, styles and complete moves: "+prospect.name);
    const moves=[...active.signatureMoves,...active.finishingMoves];
    ok(new Set(moves.map(m=>m.name.trim().toLocaleLowerCase("en-GB"))).size===3
      &&moves.every(m=>m.name.trim().length>1 &&m.source==="PPW_AUTHORED"),
      "future generated wrestler has missing, duplicate or misleading move metadata: "+prospect.name);
  }
  ok(JSON.stringify(fixture.people)===prior,
    "generating prospect personas mutated the shared World people");
});

console.log(`\nRoster source tests: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exitCode = 1;
