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
import { VERIFIED_JAPAN_JOSHI_CHARACTER_WAVE_8 } from "../packages/content/src/real-wrestler-characters-japan-wave-8.js";
import { CURATED_WRESTLER_CHARACTERS } from "../packages/content/src/real-wrestler-characters.js";
import { GIMMICK_CATALOG } from "../packages/application/src/gimmick-catalog.js";
import { FULL_REAL_ROSTER_IDENTITY_GUIDE, fullRealRosterIdentityFor } from "../packages/content/src/full-real-roster-identity-guide.js";
import { WESTERN_REVIEW_WAVE_5 } from "../packages/content/src/identity-review-western-wave-5.js";
import { JAPAN_LUCHA_REVIEW_WAVE_6 } from "../packages/content/src/identity-review-japan-lucha-wave-6.js";
import { INDEPENDENT_REVIEW_WAVE_7 } from "../packages/content/src/identity-review-indie-wave-7.js";
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
  const knownGimmicks=new Set(GIMMICK_CATALOG.map(entry=>entry.id));
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
  ok(guide.filter(x=>x.editorialBasis==="REVIEWED").length===446
    &&guide.filter(x=>x.editorialBasis==="COHORT").length===59
    &&guide.filter(x=>x.editorialBasis==="TARGETED").length===138,
    "the remaining 446 wrestlers have not all been individually audited");
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
  ok(fullRealRosterIdentityFor("Danhausen")?.signatureMoves[0]?.name==="Pump Kick",
    "guide lookup leaked mutable roster data");
  ok(fullRealRosterIdentityFor("Invented Future Prospect")===null,
    "future generated wrestlers must use deterministic generation, not a random real profile");
});

test("three individual review waves cover every previously generic non-curated wrestler",()=>{
  const wave=[...WESTERN_REVIEW_WAVE_5,...JAPAN_LUCHA_REVIEW_WAVE_6,...INDEPENDENT_REVIEW_WAVE_7];
  const all=FULL_REAL_ROSTER_IDENTITY_GUIDE;
  ok(WESTERN_REVIEW_WAVE_5.length===171
    &&JAPAN_LUCHA_REVIEW_WAVE_6.length===126
    &&INDEPENDENT_REVIEW_WAVE_7.length===149
    &&wave.length===446,
    "review batches were accidentally reduced");
  const keys=new Set<string>();
  for(const [name,gimmick,style,finisher] of wave){
    const k=name.toLocaleLowerCase("en-GB");
    ok(!keys.has(k),"duplicated wrestler review "+name);
    keys.add(k);
    const entry=fullRealRosterIdentityFor(name);
    ok(entry!==null&&entry.editorialBasis==="REVIEWED"
      &&entry.gimmickArchetype===gimmick
      &&entry.primaryStyle===style
      &&entry.finishingMoves[0]?.name===finisher
      &&entry.finishingMoves[0]?.source==="PPW_AUTHORED"
      &&entry.signatureMoves.length===2
      &&entry.signatureMoves.every(m=>m.source==="PPW_AUTHORED")
      &&entry.signatureMoves.every(m=>m.name!==entry.finishingMoves[0]?.name),
      "individual wrestler review did not override the old generated character: "+name);
  }
  ok(all.filter(x=>x.editorialBasis==="REVIEWED").length===446,
    "one of the 446 wrestler reviews did not reach the real World");
  ok(all.every(x=>x.editorialBasis!=="COHORT"
      ||CURATED_WRESTLER_CHARACTERS.some(c=>c.name===x.name)),
    "an unreviewed generic wrestler slipped through the identity completion gate");
  const dax=fullRealRosterIdentityFor("Dax Harwood")!;
  const dawkins=fullRealRosterIdentityFor("Angelo Dawkins")!;
  const wolf=fullRealRosterIdentityFor("Baron Corbin")!;
  const shota=fullRealRosterIdentityFor("Shota Umino")!;
  const azm=fullRealRosterIdentityFor("AZM")!;
  ok(dax.primaryStyle==="TECHNICAL" && dax.gimmickArchetype==="RING_GENERAL"
    &&dawkins.primaryStyle==="POWERHOUSE" &&dawkins.finishingMoves[0]?.name==="Sky High"
    &&wolf.gimmickArchetype==="LONE_WOLF"
    &&shota.finishingMoves[0]?.name==="Death Rider"
    &&azm.editorialBasis==="TARGETED",
    "known characters still have the previous inappropriate random defaults");
  const identityBefore=fullRealRosterIdentityFor("Ivar")!;
  identityBefore.signatureMoves[0]!.name="local UI mutation";
  ok(fullRealRosterIdentityFor("Ivar")?.signatureMoves[0]?.name!=="local UI mutation",
    "roster editorial reference leaked mutations across Worlds");
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
  const sabre=state.people.find(p=>p.name==="Zack Sabre Jr.")!;
  const sabreRecord=byPerson.get(sabre.id)!;
  ok(sabreRecord.active.gimmickId==="SUBMISSION_SPECIALIST"
    &&sabreRecord.active.finishingMoves[0]?.name==="Zack Driver",
    "notable non-curated wrestler still had a random gimmick or generic finisher");
  const asuka=state.people.find(p=>p.name==="Asuka")!;
  ok(byPerson.get(asuka.id)?.active.finishingMoves[0]?.name==="Asuka Lock"
    &&byPerson.get(asuka.id)?.active.finishingMoves[0]?.source==="VERIFIED",
    "less-verified guide overrode sourced moves");
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

test("all older name-targeted wrestlers lose mechanically invented signature labels",()=>{
  const targeted=FULL_REAL_ROSTER_IDENTITY_GUIDE.filter(x=>x.editorialBasis==="TARGETED");
  ok(targeted.length===138,"legacy targeted identity wave unexpectedly changed size");
  for(const person of targeted){
    const moves=person.signatureMoves;
    ok(moves.length===2
      &&moves[0]?.name!==moves[1]?.name
      &&moves.every(m=>m.name.length>=2&&m.source==="PPW_AUTHORED")
      &&moves.every(m=>m.name!==person.finishingMoves[0]?.name),
      "old targeted profile still has incomplete or duplicate move slots: "+person.name);
    const tag=person.name.replace(/["”“'.]/g,"")
      .replace(/\b(jr|the|dr|hijo|de|del|la|el)\b/gi,"")
      .trim().replace(/\s+/g," ").split(" ").filter(x=>x.length>1).at(-1)
      ?.toLocaleLowerCase("en-GB");
    const generic=/(Cutter|Spinebuster|Lariat|Bridge Suplex|Armbar|Roundhouse|Tornado Rana|Springboard Crossbody)$/i;
    ok(!moves.some(m=>tag&&m.name.split(" ")[0]?.toLocaleLowerCase("en-GB")===tag&&generic.test(m.name)),
      "mechanically constructed surname move survived targeted review: "+person.name);
  }
  ok(fullRealRosterIdentityFor("Danhausen")?.signatureMoves[0]?.name==="Pump Kick"
    &&fullRealRosterIdentityFor("Zack Sabre Jr.")?.signatureMoves[0]?.name
      ==="Orienteering with Napalm Death",
    "cleaning generic move slots lost an explicitly assigned signature manoeuvre");
});

test("NJPW and STARDOM publisher moves take priority over unverified editorial estimates",()=>{
  const wave=VERIFIED_JAPAN_JOSHI_CHARACTER_WAVE_8;
  const seen=new Set<string>();
  const all=new Set([...REAL_ACTIVE_MENS_ROSTER_NAMES,...REAL_ACTIVE_WOMENS_ROSTER_NAMES]);
  ok(wave.length===14,"publisher verification wave lost entries");
  for(const entry of wave){
    ok(!seen.has(entry.name)&&all.has(entry.name),
      "publisher curated an absent or duplicate worker "+entry.name);
    seen.add(entry.name);
    ok(entry.sourceUrl.startsWith("https://wwr-stardom.com/")
      ||entry.sourceUrl.startsWith("https://www.njpw1972.com/"),
      "source is not an official Japanese wrestling publisher for "+entry.name);
    ok(entry.finishingMoves.length>0
      &&entry.finishingMove.name===entry.finishingMoves[0]!.name
      &&entry.evidenceUrls.every(url=>url.startsWith("https://")),
      "publisher-backed finishers require direct evidence for "+entry.name);
  }
  const state=createAlphaWorldAggregate({seed:77311,playerId:"japan-source-identity"}).state;
  const persona=(name:string)=>{
    const person=state.people.find(p=>p.name===name);
    if(!person)throw Error("known wrestler absent "+name);
    const active=state.wrestlerIdentities?.find(id=>id.personId===person.id)?.active;
    if(!active)throw Error("authoritative persona absent "+name);
    return active;
  };
  const saya=persona("Saya Kamitani");
  ok(saya.provenance==="CURATED"&&saya.gimmickId==="QUEEN"
    &&saya.finishingMoves[0]?.name==="Star Crusher"
    &&saya.finishingMoves[0]?.source==="VERIFIED",
    "publisher 'Phenex Queen' profile did not supersede a dated approximation");
  const azm=persona("AZM");
  const kid=persona("Starlight Kid");
  ok(azm.finishingMoves[0]?.name==="AZM Sushi"
    &&kid.finishingMoves[0]?.name==="Star Suplex Hold"
    &&kid.signatureMoves.length>=2&&kid.signatureMoves.every(m=>m.source==="VERIFIED"),
    "published STARDOM specialties were replaced by editorial guesses");
  const yota=persona("Yota Tsuji");
  const elDesperado=persona("El Desperado");
  ok(yota.finishingMoves[0]?.name==="Gene Blaster"
    &&yota.signatureMoves.some(m=>m.name==="Marlowe Crash")
    &&elDesperado.finishingMoves[0]?.name==="Pinche Loco",
    "publisher-referenced NJPW moves were not seeded");
  const shota=persona("Shota Umino");
  ok(shota.finishingMoves[0]?.name==="Death Rider"
    &&shota.signatureMoves.length>=1
    &&shota.signatureMoves.every(m=>m.source==="PPW_AUTHORED"),
    "a verified single finisher was incorrectly expanded with fabricated verified signatures");
  const before=JSON.stringify(state.wrestlerIdentities);
  ok(completeAlphaWrestlerIdentityCoverage(state,"EXISTING_WORLD")===0
    &&JSON.stringify(state.wrestlerIdentities)===before,
    "subsequent NJPW/STARDOM source additions rewrote saved player careers");
});

test("Young Lion is reserved for NJPW trainees; other prospects have their own archetype",()=>{
  const allowedNJPW=new Set([
    "Daiki Nagai","Katsuya Murashima","Masatora Yasuda",
    "Shoma Kato","Taisei Nakahara","Tatsuya Matsumoto",
    "Yushin Hatazawa","Zane Jay",
  ]);
  const youngLions=FULL_REAL_ROSTER_IDENTITY_GUIDE.filter(x=>x.gimmickArchetype==="YOUNG_LION");
  const women=new Set(REAL_ACTIVE_WOMENS_ROSTER_NAMES);
  ok(youngLions.length===allowedNJPW.size
    &&youngLions.every(x=>allowedNJPW.has(x.name)&&!women.has(x.name)),
    "Young Lion incorrectly assigned outside the NJPW trainee system");
  const emerging=FULL_REAL_ROSTER_IDENTITY_GUIDE.filter(x=>x.gimmickArchetype==="RISING_PROSPECT");
  ok(emerging.length>=44
    &&emerging.some(x=>women.has(x.name))
    &&emerging.some(x=>!women.has(x.name)),
    "developing non-NJPW wrestlers were not given appropriate prospective personas");
});

console.log(`\nRoster source tests: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exitCode = 1;
