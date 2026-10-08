import {
  REAL_PROMOTION_TEMPLATES,
  realPromotionEcosystemSource,
} from "../packages/content/src/real-promotions.js";
import {
  REAL_ACTIVE_TAG_TEAM_TEMPLATES,
  REAL_ACTIVE_TAG_TEAMS_REVIEWED_ON,
  seedRealActiveTagTeams,
} from "../packages/content/src/real-active-tag-teams.js";
import {
  calibratedRealActiveMensRosterSource,
  realRosterValueBand,
} from "../packages/content/src/real-active-mens-calibration.js";
import { calibratedRealActiveMixedRosterSource } from "../packages/content/src/real-active-mixed-roster.js";
import {
  AEW_CMLL_DUAL_CONTRACT_SEEDS,
  AEW_PRIMARY_ROSTER_NAMES,
  AEW_FLEXIBLE_PRIMARY_ROSTER_NAMES,
  CMLL_PRIMARY_ROSTER_NAMES,
  AEW_ROH_CMLL_ROSTER_SEED_REVIEWED_ON,
  AEW_ROH_SECONDARY_ROSTER_NAMES,
  ROH_PRIMARY_ROSTER_NAMES,
  realWorldInitialRosterAssignmentSource,
} from "../packages/content/src/real-aew-roh-cmll-rosters.js";
import {
  NXT_INITIAL_ROSTER_NAMES,
  WWE_INITIAL_ROSTER_NAMES,
  WWE_NXT_ROSTER_SEED_REVIEWED_ON,
  wweNxtInitialRosterAssignmentSource,
} from "../packages/content/src/real-wwe-nxt-rosters.js";
import {
  TNA_PRIMARY_ROSTER_NAMES,
  TNA_ROSTER_SEED_REVIEWED_ON,
} from "../packages/content/src/real-tna-roster.js";
import {
  NJPW_PRIMARY_ROSTER_NAMES,
  NJPW_STARDOM_ROSTER_SEED_REVIEWED_ON,
  STARDOM_PRIMARY_ROSTER_NAMES,
} from "../packages/content/src/real-njpw-stardom-rosters.js";
declare const process: { exitCode?: number };

import { DEFAULT_RULESET } from "../packages/config/src/default-ruleset.js";
import { REAL_WORLD_ALPHA_RULESET } from "../packages/config/src/real-world-ruleset.js";
import {
  activeContractsForPerson,
  activeContractsForPromotion,
  addPpwWeeks,
  advanceWeeks,
  buildOneOffTerms,
  expireContracts,
  canAcceptContractTerms,
  createInjury,
  createSignedContract,
  createWorld,
  currentRosterPersonIds,
  defaultPromotionContractPolicy,
  deterministicWorldHash,
  determineFinancialDistress,
  DeterministicRng,
  buildContractTerms,
  generatedFictionalPromotionSource,
  generatedFictionalRosterSource,
  type InitialRosterAssignmentSource,
  type WorldPromotionSource,
  upsertWrestlerRelationship,
  wrestlerRelationshipBetween,
  recoverWrestlersForNewWeek,
  resolveWorldWeek,
  resolveWorldWeeks,
  serviceCapacityDatesPerWeek,
  targetRosterSize,
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

test("custom promotion sources plug into Genesis without bypassing validation", () => {
  const source: WorldPromotionSource = (context) => generatedFictionalPromotionSource(context)
    .map((promotion, index) => ({
      ...promotion,
      name: `Promotion Source ${index + 1}`,
      identity: {
        origin: "REAL_WORLD",
        canonicalName: `Promotion Source ${index + 1}`,
        parentPromotionId: null,
      },
    }));
  const state = createWorld(
    104,
    DEFAULT_RULESET,
    "Promotion Source Test",
    generatedFictionalRosterSource,
    source,
  );
  equal(state.promotions[0]!.name, "Promotion Source 1");
  equal(state.promotions[0]!.identity?.origin, "REAL_WORLD");
  equal(state.promotions.length, DEFAULT_RULESET.promotions);
});

test("promotion source validation rejects malformed ecosystems", () => {
  const tooShort: WorldPromotionSource = (context) => generatedFictionalPromotionSource(context).slice(1);
  let rejected = false;
  try {
    createWorld(
      105,
      DEFAULT_RULESET,
      "Broken Promotion Source",
      generatedFictionalRosterSource,
      tooShort,
    );
  } catch (error) {
    rejected = error instanceof Error && error.message.includes("promotion source returned");
  }
  ok(rejected, "promotion source with the wrong company count was accepted");
});

test("real promotion catalog preserves parent links and keeps real companies takeover-locked", () => {
  const state = createWorld(
    106,
    REAL_WORLD_ALPHA_RULESET,
    "Real Promotion Catalog",
    generatedFictionalRosterSource,
    realPromotionEcosystemSource,
  );
  equal(state.promotions.length, REAL_WORLD_ALPHA_RULESET.promotions);

  const realPromotions = state.promotions.filter((promotion) => promotion.identity?.origin === "REAL_WORLD");
  const takeoverPromotions = state.promotions.filter((promotion) => promotion.playerTakeoverEligibility === "STANDARD");
  equal(realPromotions.length, REAL_PROMOTION_TEMPLATES.length);
  equal(takeoverPromotions.length, 5);
  ok(realPromotions.every((promotion) => promotion.playerTakeoverEligibility === "LOCKED"), "real promotion source exposed a standard player takeover");
  ok(takeoverPromotions.every((promotion) => promotion.identity?.origin === "FICTIONAL"), "real promotion became a takeover slot");
  ok(takeoverPromotions.every((promotion) => promotion.tier === "INDEPENDENT"), "player takeover slot is not Independent");

  const wwe = state.promotions.find((promotion) => promotion.name === "WWE")!;
  const nxt = state.promotions.find((promotion) => promotion.name === "NXT")!;
  const aew = state.promotions.find((promotion) => promotion.name === "AEW")!;
  const roh = state.promotions.find((promotion) => promotion.name === "ROH")!;
  const stardom = state.promotions.find((promotion) => promotion.name === "STARDOM")!;
  ok(!state.promotions.some((promotion) => promotion.name === "AAA"), "AAA remained a real World promotion");
  ok(!state.promotions.some((promotion) => promotion.name === "Pro Wrestling NOAH"), "NOAH remained a real World promotion");
  equal(nxt.identity?.parentPromotionId, wwe.id);
  equal(roh.identity?.parentPromotionId, aew.id);
  ok(stardom.identity?.origin === "REAL_WORLD", "STARDOM was not created as a real promotion");
  ok(stardom.playerTakeoverEligibility === "LOCKED", "STARDOM was exposed as a player takeover");
  ok(wwe.contractPolicy!.exclusiveContractChance > aew.contractPolicy!.exclusiveContractChance, "WWE and AEW contract cultures were not differentiated");
});

test("wrestler relationships are canonical, multi-axis and distinct from match chemistry", () => {
  const state = createWorld(107, DEFAULT_RULESET);
  const [left, right] = state.people.slice(0, 2);
  const chemistryBefore = state.workingChemistry.length;

  const created = upsertWrestlerRelationship(state, {
    personAId: right!.id,
    personBId: left!.id,
    affinity: 72,
    professionalTrust: 88,
    rivalryHeat: 35,
    familiarity: 91,
    tags: ["TAG_PARTNERS", "ALLY", "TAG_PARTNERS"],
  });

  ok(created.personAId < created.personBId, "relationship pair was not canonicalized");
  equal(created.tags.join(","), "ALLY,TAG_PARTNERS");
  equal(state.workingChemistry.length, chemistryBefore);

  const updated = upsertWrestlerRelationship(state, {
    personAId: left!.id,
    personBId: right!.id,
    affinity: 45,
    rivalryHeat: 80,
  });
  equal(updated.id, created.id);
  equal(updated.affinity, 45);
  equal(updated.professionalTrust, 88);
  equal(updated.rivalryHeat, 80);
  equal(state.wrestlerRelationships?.length, 1);
  equal(wrestlerRelationshipBetween(state, right!.id, left!.id)?.id, created.id);
});

test("wrestler relationship foundation rejects self-links and impossible values", () => {
  const state = createWorld(108, DEFAULT_RULESET);
  const [left, right] = state.people.slice(0, 2);
  let selfRejected = false;
  try {
    upsertWrestlerRelationship(state, { personAId: left!.id, personBId: left!.id });
  } catch {
    selfRejected = true;
  }
  ok(selfRejected, "self relationship was accepted");

  let rangeRejected = false;
  try {
    upsertWrestlerRelationship(state, {
      personAId: left!.id,
      personBId: right!.id,
      rivalryHeat: 101,
    });
  } catch {
    rangeRejected = true;
  }
  ok(rangeRejected, "out-of-range rivalry heat was accepted");
});

test("reviewed real tag teams seed as ordinary Team entities with partner relationships", () => {
  const state = createWorld(
    109,
    DEFAULT_RULESET,
    "Established Team Seed",
    calibratedRealActiveMensRosterSource,
  );
  const teamsBefore = state.teams?.length ?? 0;
  const seededIds = seedRealActiveTagTeams(state);

  equal(REAL_ACTIVE_TAG_TEAMS_REVIEWED_ON, "2026-10-07");
  equal(seededIds.length, REAL_ACTIVE_TAG_TEAM_TEMPLATES.length);
  equal((state.teams?.length ?? 0) - teamsBefore, REAL_ACTIVE_TAG_TEAM_TEMPLATES.length);

  for (const template of REAL_ACTIVE_TAG_TEAM_TEMPLATES) {
    const team = state.teams?.find((candidate) => candidate.name === template.name);
    ok(team, `missing seeded team ${template.name}`);
    const members = (state.teamMemberships ?? [])
      .filter((membership) => membership.teamId === team!.id && membership.active)
      .map((membership) => state.people.find((person) => person.id === membership.personId)?.name)
      .sort();
    equal(members.join("|"), [...template.members].sort().join("|"));

    const [leftName, rightName] = template.members;
    const left = state.people.find((person) => person.name === leftName)!;
    const right = state.people.find((person) => person.name === rightName)!;
    const relationship = wrestlerRelationshipBetween(state, left.id, right.id);
    ok(relationship, `missing partner relationship for ${template.name}`);
    ok(relationship!.tags.includes("TAG_PARTNERS"), `${template.name} relationship lacks TAG_PARTNERS`);
    ok(relationship!.professionalTrust >= 70, `${template.name} seeded too little professional trust`);
    ok(relationship!.familiarity >= 80, `${template.name} seeded too little familiarity`);
    equal(state.workingChemistry.length, 0);
  }

  const ledgerCount = state.ledger.filter((entry) => entry.type === "TAG_TEAM_PRESENT_AT_GENESIS").length;
  equal(ledgerCount, REAL_ACTIVE_TAG_TEAM_TEMPLATES.length);
});

test("real tag-team seeding is idempotent and does not duplicate teams or genesis history", () => {
  const state = createWorld(
    110,
    DEFAULT_RULESET,
    "Established Team Idempotency",
    calibratedRealActiveMensRosterSource,
  );
  seedRealActiveTagTeams(state);
  const teamCount = state.teams?.length ?? 0;
  const ledgerCount = state.ledger.filter((entry) => entry.type === "TAG_TEAM_PRESENT_AT_GENESIS").length;
  seedRealActiveTagTeams(state);
  equal(state.teams?.length ?? 0, teamCount);
  equal(state.ledger.filter((entry) => entry.type === "TAG_TEAM_PRESENT_AT_GENESIS").length, ledgerCount);
});

test("initial roster assignment source pins wrestlers to promotions without changing default Genesis", () => {
  const baseline = createWorld(111, DEFAULT_RULESET);
  const explicitEmpty = createWorld(
    111,
    DEFAULT_RULESET,
    "PPW Test World",
    generatedFictionalRosterSource,
    generatedFictionalPromotionSource,
    () => [],
  );
  equal(deterministicWorldHash(explicitEmpty), deterministicWorldHash(baseline));

  const source: InitialRosterAssignmentSource = ({ people, promotions }) => [
    {
      personId: people[0]!.id,
      promotionId: promotions[0]!.id,
      family: "EXCLUSIVE",
    },
  ];
  const pinned = createWorld(
    112,
    DEFAULT_RULESET,
    "Pinned Genesis",
    generatedFictionalRosterSource,
    generatedFictionalPromotionSource,
    source,
  );
  const person = pinned.people[0]!;
  const contracts = activeContractsForPerson(pinned, person.id);
  equal(contracts.length, 1);
  equal(contracts[0]!.promotionId, pinned.promotions[0]!.id);
  equal(contracts[0]!.family, "EXCLUSIVE");
  equal(contracts[0]!.exclusivity, "EXCLUSIVE");
});

test("explicit child roster can use a parent-company exclusive contract without merging parent and child rosters", () => {
  const source: InitialRosterAssignmentSource = ({ people, promotions }) => {
    const parent = promotions[0]!;
    const child = promotions[4]!;
    child.identity = { origin: "FICTIONAL", canonicalName: child.name, parentPromotionId: parent.id };
    child.rosterMode = "EXPLICIT";
    parent.rosterMode = "EXPLICIT";
    return [
      { personId: people[0]!.id, promotionId: parent.id, rosterPromotionId: parent.id, family: "EXCLUSIVE" },
      { personId: people[1]!.id, promotionId: parent.id, rosterPromotionId: child.id, family: "EXCLUSIVE" },
    ];
  };

  const state = createWorld(
    113,
    DEFAULT_RULESET,
    "Parent Child Roster",
    generatedFictionalRosterSource,
    generatedFictionalPromotionSource,
    source,
  );
  const parent = state.promotions[0]!;
  const child = state.promotions[4]!;
  const parentRoster = currentRosterPersonIds(state, parent.id);
  const childRoster = currentRosterPersonIds(state, child.id);

  equal(parentRoster.includes(state.people[0]!.id), true);
  equal(parentRoster.includes(state.people[1]!.id), false);
  equal(childRoster.includes(state.people[1]!.id), true);
  equal(activeContractsForPerson(state, state.people[1]!.id)[0]!.promotionId, parent.id);
});

test("multi-promotion roster affiliations support primary and secondary contracted rosters", () => {
  const source: InitialRosterAssignmentSource = ({ people, promotions }) => [
    {
      personId: people[0]!.id,
      promotionId: promotions[1]!.id,
      family: "LIMITED_NON_EXCLUSIVE",
      rosterAffiliations: [{
        promotionId: promotions[1]!.id,
        role: "PRIMARY",
        basis: "CONTRACT",
      }],
    },
    {
      personId: people[0]!.id,
      promotionId: promotions[2]!.id,
      family: "LIMITED_NON_EXCLUSIVE",
      rosterAffiliations: [{
        promotionId: promotions[2]!.id,
        role: "SECONDARY",
        basis: "CONTRACT",
      }],
    },
  ];
  const state = createWorld(
    114,
    DEFAULT_RULESET,
    "Multi Affiliation Genesis",
    generatedFictionalRosterSource,
    generatedFictionalPromotionSource,
    source,
  );
  state.promotions[1]!.rosterMode = "EXPLICIT";
  state.promotions[2]!.rosterMode = "EXPLICIT";
  const person = state.people[0]!;
  equal(activeContractsForPerson(state, person.id).length, 2);
  equal(state.wrestlerPromotionAffiliations?.filter((affiliation) => affiliation.personId === person.id).length, 2);
  equal(currentRosterPersonIds(state, state.promotions[1]!.id).includes(person.id), true);
  equal(currentRosterPersonIds(state, state.promotions[2]!.id).includes(person.id), true);
});

test("explicit rosters include future direct signings but respect existing explicit placement", () => {
  const state = createWorld(120, DEFAULT_RULESET);
  const promotion = state.promotions[1]!;
  promotion.rosterMode = "EXPLICIT";
  const person = state.people.find((candidate) => activeContractsForPerson(state, candidate.id).length === 0)!;
  const terms = buildContractTerms(state, promotion, person, new DeterministicRng(120), state.world.currentDate, "EXCLUSIVE");
  createSignedContract(state, person, promotion, { ...terms, signingBonus: 0 }, null, false);
  equal(currentRosterPersonIds(state, promotion.id).includes(person.id), true);

  const other = state.promotions[2]!;
  other.rosterMode = "EXPLICIT";
  state.wrestlerPromotionAffiliations ??= [];
  state.wrestlerPromotionAffiliations.push({
    worldId: state.world.id,
    personId: person.id,
    promotionId: other.id,
    role: "PRIMARY",
    basis: "CONTRACT",
  });
  equal(currentRosterPersonIds(state, promotion.id).includes(person.id), false);
});

test("parent-company roster affiliation grants child-brand access without a second contract", () => {
  const source: InitialRosterAssignmentSource = ({ people, promotions }) => {
    const parent = promotions[0]!;
    const child = promotions[4]!;
    child.identity = { origin: "FICTIONAL", canonicalName: child.name, parentPromotionId: parent.id };
    child.rosterMode = "EXPLICIT";
    return [{
      personId: people[0]!.id,
      promotionId: parent.id,
      family: "EXCLUSIVE",
      rosterAffiliations: [{
        promotionId: child.id,
        role: "PRIMARY",
        basis: "PARENT_COMPANY",
      }],
    }];
  };
  const state = createWorld(
    119,
    DEFAULT_RULESET,
    "Parent Affiliation Genesis",
    generatedFictionalRosterSource,
    generatedFictionalPromotionSource,
    source,
  );
  const person = state.people[0]!;
  const child = state.promotions[4]!;
  equal(activeContractsForPerson(state, person.id).length, 1);
  equal(currentRosterPersonIds(state, child.id).includes(person.id), true);
});

test("initial roster assignments support deliberate non-exclusive dual employment but reject exclusive overlap", () => {
  const dualSource: InitialRosterAssignmentSource = ({ people, promotions }) => [
    { personId: people[0]!.id, promotionId: promotions[1]!.id, family: "LIMITED_NON_EXCLUSIVE" },
    { personId: people[0]!.id, promotionId: promotions[2]!.id, family: "LIMITED_NON_EXCLUSIVE" },
  ];
  const dual = createWorld(
    115,
    DEFAULT_RULESET,
    "Dual Genesis",
    generatedFictionalRosterSource,
    generatedFictionalPromotionSource,
    dualSource,
  );
  equal(activeContractsForPerson(dual, dual.people[0]!.id).length, 2);

  const brokenSource: InitialRosterAssignmentSource = ({ people, promotions }) => [
    { personId: people[0]!.id, promotionId: promotions[0]!.id, family: "EXCLUSIVE" },
    { personId: people[0]!.id, promotionId: promotions[1]!.id, family: "LIMITED_NON_EXCLUSIVE" },
  ];
  let rejected = false;
  try {
    createWorld(
      116,
      DEFAULT_RULESET,
      "Broken Genesis",
      generatedFictionalRosterSource,
      generatedFictionalPromotionSource,
      brokenSource,
    );
  } catch (error) {
    rejected = String(error).includes("overlapping exclusive employment");
  }
  ok(rejected, "exclusive initial employment overlapped another promotion");
});

test("first reviewed WWE/NXT seed separates WWE employment rights from NXT roster affiliation", () => {
  const state = createWorld(
    117,
    REAL_WORLD_ALPHA_RULESET,
    "WWE NXT Seed",
    calibratedRealActiveMixedRosterSource,
    realPromotionEcosystemSource,
    wweNxtInitialRosterAssignmentSource,
  );
  equal(WWE_NXT_ROSTER_SEED_REVIEWED_ON, "2026-10-07");

  const wwe = state.promotions.find((promotion) => promotion.name === "WWE")!;
  const nxt = state.promotions.find((promotion) => promotion.name === "NXT")!;
  equal(wwe.rosterMode, "EXPLICIT");
  equal(nxt.rosterMode, "EXPLICIT");
  equal(nxt.identity?.parentPromotionId, wwe.id);

  const wweRosterNames = currentRosterPersonIds(state, wwe.id)
    .map((personId) => state.people.find((person) => person.id === personId)!.name);
  const nxtRosterNames = currentRosterPersonIds(state, nxt.id)
    .map((personId) => state.people.find((person) => person.id === personId)!.name);

  equal(wweRosterNames.length, WWE_INITIAL_ROSTER_NAMES.length);
  equal(nxtRosterNames.length, NXT_INITIAL_ROSTER_NAMES.length);
  for (const name of WWE_INITIAL_ROSTER_NAMES) ok(wweRosterNames.includes(name), `WWE seed missing ${name}`);
  for (const name of NXT_INITIAL_ROSTER_NAMES) ok(nxtRosterNames.includes(name), `NXT seed missing ${name}`);
  ok(!wweRosterNames.includes("Myles Borne"), "NXT wrestler leaked into WWE main roster");
  ok(!nxtRosterNames.includes("Roman Reigns"), "WWE main-roster wrestler leaked into NXT");
  equal(activeContractsForPromotion(state, wwe.id).length, WWE_INITIAL_ROSTER_NAMES.length + NXT_INITIAL_ROSTER_NAMES.length);
  equal(activeContractsForPromotion(state, nxt.id).length, 0);
  const contractedPeople = new Set(
    state.contracts
      .filter((contract) => contract.status === "SIGNED")
      .map((contract) => contract.personId),
  ).size;
  ok(
    contractedPeople >= WWE_INITIAL_ROSTER_NAMES.length + NXT_INITIAL_ROSTER_NAMES.length,
    "WWE/NXT seed lost explicitly assigned contracted wrestlers",
  );
  ok(
    state.people.length - contractedPeople >= Math.floor(state.people.length * 0.2),
    "partial real-world roster staging exhausted the free-agent market",
  );

  const roman = state.people.find((person) => person.name === "Roman Reigns")!;
  const myles = state.people.find((person) => person.name === "Myles Borne")!;
  const romanContracts = activeContractsForPerson(state, roman.id);
  const mylesContracts = activeContractsForPerson(state, myles.id);
  equal(romanContracts.length, 1);
  equal(mylesContracts.length, 1);
  equal(romanContracts[0]!.promotionId, wwe.id);
  equal(mylesContracts[0]!.promotionId, wwe.id);
  equal(romanContracts[0]!.exclusivity, "EXCLUSIVE");
  equal(mylesContracts[0]!.exclusivity, "EXCLUSIVE");
  equal(roman.rosterPromotionId, wwe.id);
  equal(myles.rosterPromotionId, nxt.id);
  ok(!state.contracts.some((contract) => contract.personId === myles.id && contract.promotionId === nxt.id), "Myles Borne received a fake standalone NXT employment contract");
});

test("reviewed WWE/NXT seed survives early World simulation without rogue NXT employment", () => {
  const state = createWorld(
    118,
    REAL_WORLD_ALPHA_RULESET,
    "WWE NXT Early Sim",
    calibratedRealActiveMixedRosterSource,
    realPromotionEcosystemSource,
    wweNxtInitialRosterAssignmentSource,
  );
  const nxt = state.promotions.find((promotion) => promotion.name === "NXT")!;
  resolveWorldWeeks(state, 8);
  const invariantErrors = validateWorldInvariants(state);
  equal(invariantErrors.length, 0, invariantErrors.join("\n"));
  ok(
    !activeContractsForPromotion(state, nxt.id).some((contract) => contract.status === "SIGNED"),
    "NXT created standalone employment contracts during early simulation",
  );
});

test("reviewed AEW/ROH/CMLL seed models parent rosters and confirmed dual contracts", () => {
  const state = createWorld(
    121,
    REAL_WORLD_ALPHA_RULESET,
    "AEW ROH CMLL Seed",
    calibratedRealActiveMixedRosterSource,
    realPromotionEcosystemSource,
    realWorldInitialRosterAssignmentSource,
  );
  equal(AEW_ROH_CMLL_ROSTER_SEED_REVIEWED_ON, "2026-10-07");

  const aew = state.promotions.find((promotion) => promotion.name === "AEW")!;
  const roh = state.promotions.find((promotion) => promotion.name === "ROH")!;
  const cmll = state.promotions.find((promotion) => promotion.name === "CMLL")!;
  equal(aew.rosterMode, "EXPLICIT");
  equal(roh.rosterMode, "EXPLICIT");
  equal(cmll.rosterMode, "EXPLICIT");
  equal(roh.identity?.parentPromotionId, aew.id);

  const rosterNames = (promotionId: string) => currentRosterPersonIds(state, promotionId)
    .map((personId) => state.people.find((person) => person.id === personId)!.name);
  const aewNames = rosterNames(aew.id);
  const rohNames = rosterNames(roh.id);
  const cmllNames = rosterNames(cmll.id);

  for (const name of AEW_PRIMARY_ROSTER_NAMES) ok(aewNames.includes(name), `AEW seed missing ${name}`);
  for (const name of ROH_PRIMARY_ROSTER_NAMES) ok(rohNames.includes(name), `ROH seed missing ${name}`);
  for (const name of CMLL_PRIMARY_ROSTER_NAMES) ok(cmllNames.includes(name), `CMLL seed missing ${name}`);
  for (const name of AEW_ROH_SECONDARY_ROSTER_NAMES) ok(rohNames.includes(name), `ROH secondary seed missing ${name}`);
  for (const seed of AEW_CMLL_DUAL_CONTRACT_SEEDS) {
    ok(aewNames.includes(seed.name), `AEW dual-contract roster missing ${seed.name}`);
    ok(cmllNames.includes(seed.name), `CMLL dual-contract roster missing ${seed.name}`);
    if (seed.rohSecondary) ok(rohNames.includes(seed.name), `ROH secondary dual-contract roster missing ${seed.name}`);
  }

  const claudio = state.people.find((person) => person.name === "Claudio Castagnoli")!;
  const claudioContracts = activeContractsForPerson(state, claudio.id);
  equal(claudioContracts.length, 2);
  equal(new Set(claudioContracts.map((contract) => contract.promotionId)).size, 2);
  ok(claudioContracts.every((contract) => contract.family === "LIMITED_NON_EXCLUSIVE"), "Claudio dual contracts were not flexible");
  equal(
    state.wrestlerPromotionAffiliations?.filter((affiliation) => affiliation.personId === claudio.id).length,
    2,
  );

  const mistico = state.people.find((person) => person.name === "Místico")!;
  const misticoAffiliations = state.wrestlerPromotionAffiliations?.filter(
    (affiliation) => affiliation.personId === mistico.id,
  ) ?? [];
  equal(activeContractsForPerson(state, mistico.id).length, 2);
  equal(misticoAffiliations.length, 3);
  equal(misticoAffiliations.filter((affiliation) => affiliation.role === "PRIMARY").length, 1);
  ok(misticoAffiliations.some((affiliation) => affiliation.promotionId === roh.id && affiliation.basis === "PARENT_COMPANY"), "Místico lacks ROH parent-company affiliation");

  const athena = state.people.find((person) => person.name === "Athena")!;
  equal(activeContractsForPerson(state, athena.id).length, 1);
  equal(activeContractsForPerson(state, athena.id)[0]!.promotionId, aew.id);
  ok(rohNames.includes("Athena"), "Athena is missing from ROH");
  ok(!aewNames.includes("Athena"), "ROH-primary Athena leaked into the AEW main roster");

  for (const name of AEW_FLEXIBLE_PRIMARY_ROSTER_NAMES) {
    const person = state.people.find((candidate) => candidate.name === name)!;
    const contract = activeContractsForPerson(state, person.id).find((candidate) => candidate.promotionId === aew.id);
    ok(contract, `missing AEW contract for flexible roster member ${name}`);
    equal(contract!.family, "LIMITED_NON_EXCLUSIVE");
  }

  const marina = state.people.find((person) => person.name === "Marina Shafir")!;
  equal(activeContractsForPerson(state, marina.id).length, 1);
  ok(aewNames.includes("Marina Shafir") && rohNames.includes("Marina Shafir"), "Marina Shafir did not receive AEW primary + ROH secondary access");

  const errors = validateWorldInvariants(state);
  equal(errors.length, 0, errors.join("\n"));
});

test("combined real-world roster seed survives early simulation with multi-roster affiliations intact", () => {
  const state = createWorld(
    122,
    REAL_WORLD_ALPHA_RULESET,
    "Real World Multi Roster Early Sim",
    calibratedRealActiveMixedRosterSource,
    realPromotionEcosystemSource,
    realWorldInitialRosterAssignmentSource,
  );
  resolveWorldWeeks(state, 4);
  const errors = validateWorldInvariants(state);
  equal(errors.length, 0, errors.join("\n"));

  const claudio = state.people.find((person) => person.name === "Claudio Castagnoli")!;
  const aew = state.promotions.find((promotion) => promotion.name === "AEW")!;
  const cmll = state.promotions.find((promotion) => promotion.name === "CMLL")!;
  ok(currentRosterPersonIds(state, aew.id).includes(claudio.id), "Claudio fell off AEW roster during early sim");
  ok(currentRosterPersonIds(state, cmll.id).includes(claudio.id), "Claudio fell off CMLL roster during early sim");
});

test("reviewed TNA seed creates an explicit flexible active-core roster", () => {
  const state = createWorld(
    123,
    REAL_WORLD_ALPHA_RULESET,
    "TNA Seed",
    calibratedRealActiveMixedRosterSource,
    realPromotionEcosystemSource,
    realWorldInitialRosterAssignmentSource,
  );
  equal(TNA_ROSTER_SEED_REVIEWED_ON, "2026-10-07");

  const tna = state.promotions.find((promotion) => promotion.name === "TNA Wrestling")!;
  const nxt = state.promotions.find((promotion) => promotion.name === "NXT")!;
  equal(tna.rosterMode, "EXPLICIT");

  const tnaRosterNames = currentRosterPersonIds(state, tna.id)
    .map((personId) => state.people.find((person) => person.id === personId)!.name);
  equal(tnaRosterNames.length, TNA_PRIMARY_ROSTER_NAMES.length);
  for (const name of TNA_PRIMARY_ROSTER_NAMES) {
    ok(tnaRosterNames.includes(name), `TNA seed missing ${name}`);
  }

  const steveMaclin = state.people.find((candidate) => candidate.name === "Steve Maclin")!;
  ok(!currentRosterPersonIds(state, tna.id).includes(steveMaclin.id), "released Steve Maclin was incorrectly restored to TNA");

  for (const name of ["Nic Nemeth", "Xia Brookside", "Tasha Steelz", "Zoey Serrano"]) {
    const person = state.people.find((candidate) => candidate.name === name)!;
    const contracts = activeContractsForPerson(state, person.id);
    equal(contracts.length, 1);
    equal(contracts[0]!.promotionId, tna.id);
    equal(contracts[0]!.family, "LIMITED_NON_EXCLUSIVE");
    equal(person.rosterPromotionId, tna.id);
    ok(!currentRosterPersonIds(state, nxt.id).includes(person.id), `${name} leaked into NXT roster from crossover activity`);
  }

  const errors = validateWorldInvariants(state);
  equal(errors.length, 0, errors.join("\n"));
});

test("combined TNA roster survives early simulation without losing explicit membership", () => {
  const state = createWorld(
    124,
    REAL_WORLD_ALPHA_RULESET,
    "TNA Early Sim",
    calibratedRealActiveMixedRosterSource,
    realPromotionEcosystemSource,
    realWorldInitialRosterAssignmentSource,
  );
  const tna = state.promotions.find((promotion) => promotion.name === "TNA Wrestling")!;
  resolveWorldWeeks(state, 4);
  const errors = validateWorldInvariants(state);
  equal(errors.length, 0, errors.join("\n"));
  const rosterNames = currentRosterPersonIds(state, tna.id)
    .map((personId) => state.people.find((person) => person.id === personId)!.name);
  for (const name of ["Matt Hardy", "Jeff Hardy", "Moose", "Xia Brookside", "Jody Threat"]) {
    ok(rosterNames.includes(name), `TNA early sim lost ${name}`);
  }
});

test("reviewed NJPW and STARDOM seeds create explicit current active-core rosters", () => {
  const state = createWorld(
    125,
    REAL_WORLD_ALPHA_RULESET,
    "NJPW STARDOM Seed",
    calibratedRealActiveMixedRosterSource,
    realPromotionEcosystemSource,
    realWorldInitialRosterAssignmentSource,
  );
  equal(NJPW_STARDOM_ROSTER_SEED_REVIEWED_ON, "2026-10-08");

  const njpw = state.promotions.find((promotion) => promotion.name === "NJPW")!;
  const stardom = state.promotions.find((promotion) => promotion.name === "STARDOM")!;
  const aew = state.promotions.find((promotion) => promotion.name === "AEW")!;
  equal(njpw.rosterMode, "EXPLICIT");
  equal(stardom.rosterMode, "EXPLICIT");

  const rosterNames = (promotionId: string) => currentRosterPersonIds(state, promotionId)
    .map((personId) => state.people.find((person) => person.id === personId)!.name);
  const njpwNames = rosterNames(njpw.id);
  const stardomNames = rosterNames(stardom.id);

  equal(njpwNames.length, NJPW_PRIMARY_ROSTER_NAMES.length);
  equal(stardomNames.length, STARDOM_PRIMARY_ROSTER_NAMES.length);
  for (const name of NJPW_PRIMARY_ROSTER_NAMES) ok(njpwNames.includes(name), `NJPW seed missing ${name}`);
  for (const name of STARDOM_PRIMARY_ROSTER_NAMES) ok(stardomNames.includes(name), `STARDOM seed missing ${name}`);

  for (const name of ["Yota Tsuji", "Zack Sabre Jr.", "Aaron Wolf", "Tomohiro Ishii"]) {
    const person = state.people.find((candidate) => candidate.name === name)!;
    const contracts = activeContractsForPerson(state, person.id);
    equal(contracts.length, 1);
    equal(contracts[0]!.promotionId, njpw.id);
    equal(contracts[0]!.family, "LIMITED_NON_EXCLUSIVE");
  }
  for (const name of ["Starlight Kid", "Saya Kamitani", "Maki Itoh", "Matoi Hamabe"]) {
    const person = state.people.find((candidate) => candidate.name === name)!;
    const contracts = activeContractsForPerson(state, person.id);
    equal(contracts.length, 1);
    equal(contracts[0]!.promotionId, stardom.id);
    equal(contracts[0]!.family, "LIMITED_NON_EXCLUSIVE");
    equal(person.division, "WOMEN");
  }

  for (const guest of ["Jon Moxley", "Konosuke Takeshita", "Will Ospreay", "Mercedes Moné", "Kevin Knight"]) {
    const person = state.people.find((candidate) => candidate.name === guest)!;
    ok(!njpwNames.includes(guest), `${guest} was incorrectly reassigned to NJPW from outside-company activity`);
    ok(currentRosterPersonIds(state, aew.id).includes(person.id), `${guest} lost existing AEW affiliation`);
  }

  const yota = state.people.find((candidate) => candidate.name === "Yota Tsuji")!;
  equal(realRosterValueBand(yota.name), "HEADLINER");
  const errors = validateWorldInvariants(state);
  equal(errors.length, 0, errors.join("\n"));
});

test("combined NJPW and STARDOM rosters survive early simulation", () => {
  const state = createWorld(
    126,
    REAL_WORLD_ALPHA_RULESET,
    "Japan Early Sim",
    calibratedRealActiveMixedRosterSource,
    realPromotionEcosystemSource,
    realWorldInitialRosterAssignmentSource,
  );
  const njpw = state.promotions.find((promotion) => promotion.name === "NJPW")!;
  const stardom = state.promotions.find((promotion) => promotion.name === "STARDOM")!;
  resolveWorldWeeks(state, 4);
  const errors = validateWorldInvariants(state);
  equal(errors.length, 0, errors.join("\n"));
  const njpwNames = currentRosterPersonIds(state, njpw.id)
    .map((personId) => state.people.find((person) => person.id === personId)!.name);
  const stardomNames = currentRosterPersonIds(state, stardom.id)
    .map((personId) => state.people.find((person) => person.id === personId)!.name);
  for (const name of ["Yota Tsuji", "Shota Umino", "El Desperado", "Yuya Uemura"]) {
    ok(njpwNames.includes(name), `NJPW early sim lost ${name}`);
  }
  for (const name of ["Starlight Kid", "AZM", "Saya Kamitani", "Maki Itoh"]) {
    ok(stardomNames.includes(name), `STARDOM early sim lost ${name}`);
  }
});

test("Genesis creates formal contracts while preserving free-agent supply", () => {
  const state = createWorld(101, DEFAULT_RULESET);
  const contractedPeople = state.people.filter((person) => activeContractsForPerson(state, person.id).length > 0);
  equal(contractedPeople.length, 272);
  equal(state.contracts.length, 272);
  equal(state.people.length - contractedPeople.length, 128);
  ok((state.people.length - contractedPeople.length) / state.people.length >= 0.25, "labour market is too tightly contracted at Genesis");
});

test("Genesis roster distribution respects tier-scale targets instead of hoarding", () => {
  const state = createWorld(20261002, DEFAULT_RULESET);
  for (const promotion of state.promotions) {
    const size = currentRosterPersonIds(state, promotion.id).length;
    ok(Math.abs(size - targetRosterSize(promotion)) <= 1, `${promotion.tier} ${promotion.id} roster ${size} is too far from target ${targetRosterSize(promotion)}`);
  }
});

test("one Global promotion exists in default Genesis", () => {
  const state = createWorld(101, DEFAULT_RULESET);
  equal(state.promotions.filter((p) => p.tier === "GLOBAL").length, 1);
});

test("Genesis promotions carry persistent identity and contract culture", () => {
  const state = createWorld(102, DEFAULT_RULESET);
  for (const promotion of state.promotions) {
    equal(promotion.identity?.origin, "FICTIONAL");
    equal(promotion.identity?.canonicalName, promotion.name);
    equal(promotion.identity?.parentPromotionId, null);
    const policy = promotion.contractPolicy;
    ok(policy, `${promotion.id} is missing contract policy`);
    ok(policy!.exclusiveContractChance >= 0 && policy!.exclusiveContractChance <= 100, `${promotion.id} has invalid exclusive chance`);
  }
  equal(defaultPromotionContractPolicy("GLOBAL").exclusiveContractChance, 72);
  equal(defaultPromotionContractPolicy("INDEPENDENT").outsideBookingPolicy, "PERMITTED");
});

test("promotion contract culture overrides tier when generating terms", () => {
  const state = createWorld(103, DEFAULT_RULESET);
  const promotion = state.promotions.find((candidate) => candidate.tier === "GLOBAL")!;
  const person = state.people.find((candidate) => activeContractsForPerson(state, candidate.id).length === 0)!;

  promotion.contractPolicy = {
    exclusiveContractChance: 0,
    starExclusiveBonus: 0,
    outsideBookingPolicy: "PERMITTED",
  };
  const flexible = buildContractTerms(state, promotion, person, new DeterministicRng(1));
  equal(flexible.family, "LIMITED_NON_EXCLUSIVE");

  promotion.contractPolicy = {
    exclusiveContractChance: 100,
    starExclusiveBonus: 0,
    outsideBookingPolicy: "PROHIBITED",
  };
  const lockdown = buildContractTerms(state, promotion, person, new DeterministicRng(1));
  equal(lockdown.family, "EXCLUSIVE");
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

test("weekly finance settlement records contract guarantees instead of static roster payroll", () => {
  const state = createWorld(55, DEFAULT_RULESET);
  resolveWorldWeek(state);
  const guarantees = state.financialTransactions.filter((transaction) => transaction.category === "CONTRACT_GUARANTEE");
  const activeGuarantees = state.contracts.filter((contract) => contract.status === "SIGNED" && contract.weeklyGuarantee > 0);
  equal(guarantees.length, activeGuarantees.length);
  ok(!state.financialTransactions.some((transaction) => (transaction.category as string) === "TALENT_COMMITMENT"), "legacy talent commitment transaction survived contract migration");
});

test("weekly finance transactions reconcile exactly to promotion cash movement including contract bonuses", () => {
  const state = createWorld(56, DEFAULT_RULESET);
  const before = new Map(state.promotions.map((promotion) => [promotion.id, promotion.cash]));
  resolveWorldWeek(state);
  for (const promotion of state.promotions) {
    const transactionNet = state.financialTransactions
      .filter((transaction) => transaction.promotionId === promotion.id)
      .reduce((sum, transaction) => sum + transaction.amount, 0);
    equal(promotion.cash, before.get(promotion.id)! + transactionNet);
    equal(promotion.lastWeeklyNet, transactionNet);
  }
});

test("financial transaction IDs remain unique across weeks", () => {
  const state = createWorld(57, DEFAULT_RULESET);
  resolveWorldWeeks(state, 3);
  const ids = state.financialTransactions.map((transaction) => transaction.id);
  equal(new Set(ids).size, ids.length);
});

test("financial distress thresholds respond to runway", () => {
  equal(determineFinancialDistress(1_000_000, 1), "HEALTHY");
  equal(determineFinancialDistress(1_000_000, -40_000), "HEALTHY");
  equal(determineFinancialDistress(500_000, -40_000), "WATCH");
  equal(determineFinancialDistress(200_000, -40_000), "DISTRESSED");
  equal(determineFinancialDistress(50_000, -40_000), "CRISIS");
  equal(determineFinancialDistress(0, -1), "CRISIS");
});

test("service capacity allows compatible outside work and blocks impossible overload", () => {
  const state = createWorld(600, DEFAULT_RULESET);
  const person = state.people.find((candidate) => candidate.careerStage === "PRIME")!;
  const promotion = state.promotions.find((candidate) => candidate.tier === "INDEPENDENT")!;
  const rng = new DeterministicRng(99);
  const oneOff = buildOneOffTerms(state, promotion, person, rng);
  ok(serviceCapacityDatesPerWeek(person) >= 1, "prime wrestler should be physically capable of a one-off date");
  const firstCheck = canAcceptContractTerms(state, person, oneOff);
  if (activeContractsForPerson(state, person.id).some((contract) => contract.exclusivity === "EXCLUSIVE")) {
    ok(!firstCheck.ok, "exclusive wrestler incorrectly accepted outside work");
  } else {
    ok(firstCheck.ok || firstCheck.reason === "service capacity exceeded", "unexpected contract rejection reason");
  }
});

test("one-off contracts exist as a real one-date contract family and expire cleanly", () => {
  const state = createWorld(602, DEFAULT_RULESET);
  const person = state.people.find((candidate) => activeContractsForPerson(state, candidate.id).length === 0)!;
  const promotion = state.promotions.find((candidate) => candidate.tier === "INDEPENDENT")!;
  const terms = buildOneOffTerms(state, promotion, person, new DeterministicRng(101));
  const contract = createSignedContract(state, person, promotion, terms, null, false);
  equal(contract.family, "ONE_OFF");
  equal(contract.dateEntitlement, 1);
  equal(activeContractsForPerson(state, person.id).some((candidate) => candidate.id === contract.id), true);
  advanceWeeks(state.world, state.ruleset.weeksPerYear, 1);
  expireContracts(state);
  equal(contract.status, "EXPIRED");
});

test("exclusive contracts cannot overlap other signed contracts", () => {
  const state = createWorld(601, DEFAULT_RULESET);
  const person = state.people.find((candidate) => activeContractsForPerson(state, candidate.id).length === 0)!;
  const promotionA = state.promotions[0]!;
  const promotionB = state.promotions[1]!;
  const exclusive = {
    family: "EXCLUSIVE" as const,
    exclusivity: "EXCLUSIVE" as const,
    roleExpectation: "FEATURED" as const,
    startDate: { ...state.world.currentDate },
    endDate: addPpwWeeks(state.world.currentDate, 25, state.ruleset.weeksPerYear),
    dateEntitlement: 16,
    weeklyGuarantee: 50_000,
    appearanceFee: 0,
    signingBonus: 0,
  };
  createSignedContract(state, person, promotionA, exclusive, null, false);
  const check = canAcceptContractTerms(state, person, { ...exclusive, weeklyGuarantee: 60_000 });
  ok(!check.ok, "overlapping exclusive contract was accepted");
  ok(check.reason?.includes("exclusive") ?? false, "exclusive rejection did not explain the conflict");
  equal(activeContractsForPromotion(state, promotionB.id).filter((contract) => contract.personId === person.id).length, 0);
});

test("contract market creates offers, expiries and roster movement over time", () => {
  const state = createWorld(777, DEFAULT_RULESET);
  const initialContractIds = new Set(state.contracts.map((contract) => contract.id));
  resolveWorldWeeks(state, 80);
  ok(state.contractOffers.length > 0, "AI contract market generated no offers");
  ok(state.contractOffers.some((offer) => offer.status === "ACCEPTED"), "no contract offer was accepted");
  ok(state.contracts.some((contract) => !initialContractIds.has(contract.id)), "no new contracts were signed");
  ok(state.contracts.some((contract) => contract.status === "EXPIRED"), "no contracts expired");
});

test("non-exclusive careers can span multiple promotions", () => {
  const state = createWorld(778, DEFAULT_RULESET);
  resolveWorldWeeks(state, 160);
  const multi = state.people.filter((person) => new Set(activeContractsForPerson(state, person.id).map((contract) => contract.promotionId)).size > 1);
  ok(multi.length > 0, "no wrestler developed a multi-promotion non-exclusive career");
});

test("resolved Worlds remain deterministic", () => {
  const a = createWorld(1234, DEFAULT_RULESET);
  const b = createWorld(1234, DEFAULT_RULESET);
  resolveWorldWeeks(a, 104);
  resolveWorldWeeks(b, 104);
  equal(deterministicWorldHash(a), deterministicWorldHash(b));
});

test("Genesis and 520 resolved weeks satisfy core invariants", () => {
  const state = createWorld(999, DEFAULT_RULESET);
  resolveWorldWeeks(state, 520);
  const errors = validateWorldInvariants(state);
  equal(errors.length, 0, errors.join("\n"));
});



test("Genesis creates venue bands and promotion-market state for every promotion/market pair", () => {
  const state = createWorld(404, DEFAULT_RULESET);
  equal(state.venues.length, state.markets.length * 3);
  equal(state.promotionMarketStates.length, state.promotions.length * state.markets.length);
  for (const market of state.markets) {
    equal(state.venues.filter((venue) => venue.marketId === market.id).length, 3);
  }
});

test("event cadence produces weekly top-tier shows and less frequent smaller-promotion shows", () => {
  const state = createWorld(405, DEFAULT_RULESET);
  resolveWorldWeeks(state, 2);
  const weekOne = state.events.filter((event) => event.date.year === 1 && event.date.week === 1);
  const weekTwo = state.events.filter((event) => event.date.year === 1 && event.date.week === 2);
  equal(weekOne.length, 9);
  equal(weekTwo.length, 3);
  ok(weekTwo.every((event) => {
    const promotion = state.promotions.find((candidate) => candidate.id === event.promotionId)!;
    return promotion.tier === "GLOBAL" || promotion.tier === "NATIONAL";
  }), "a slower-cadence promotion incorrectly ran in week two");
});

test("completed events respect venue capacity and create gate/venue/production transactions", () => {
  const state = createWorld(406, DEFAULT_RULESET);
  resolveWorldWeek(state);
  const completed = state.events.filter((event) => event.status === "COMPLETED");
  ok(completed.length > 0, "no events completed");
  for (const event of completed) {
    const venue = state.venues.find((candidate) => candidate.id === event.venueId)!;
    ok(event.attendance <= venue.capacity, `${event.id} exceeded venue capacity`);
    ok(event.gateRevenue >= 0, `${event.id} has negative gate`);
    equal(event.netResult, event.gateRevenue - event.totalCost);
    ok(state.financialTransactions.some((transaction) => transaction.category === "GATE_REVENUE" && transaction.source === event.id), `${event.id} missing gate transaction`);
    ok(state.financialTransactions.some((transaction) => transaction.category === "VENUE_COST" && transaction.source === event.id), `${event.id} missing venue transaction`);
    ok(state.financialTransactions.some((transaction) => transaction.category === "PRODUCTION_COST" && transaction.source === event.id), `${event.id} missing production transaction`);
  }
});

test("completed appearances consume purchased contract dates exactly once", () => {
  const state = createWorld(407, DEFAULT_RULESET);
  resolveWorldWeek(state);
  const completed = state.scheduledAppearances.filter((appearance) => appearance.status === "COMPLETED");
  ok(completed.length > 0, "no contracted appearances completed");
  const totalDatesUsed = state.contracts.reduce((sum, contract) => sum + contract.datesUsed, 0);
  equal(totalDatesUsed, completed.length);
  for (const appearance of completed) {
    const contract = state.contracts.find((candidate) => candidate.id === appearance.contractId)!;
    if (contract.appearanceFee > 0) {
      ok(state.financialTransactions.some((transaction) => transaction.category === "APPEARANCE_FEE" && transaction.source === appearance.id), `${appearance.id} missing appearance fee`);
    }
  }
});

test("live gate economy can generate both profitable and loss-making events", () => {
  const state = createWorld(20261002, DEFAULT_RULESET);
  resolveWorldWeeks(state, 52);
  const completed = state.events.filter((event) => event.status === "COMPLETED");
  ok(completed.some((event) => event.netResult > 0), "no live event ever made money");
  ok(completed.some((event) => event.netResult < 0), "all live events made money; venue/price risk is absent");
  const indieIds = new Set(state.promotions.filter((promotion) => promotion.tier === "INDEPENDENT").map((promotion) => promotion.id));
  ok(completed.some((event) => indieIds.has(event.promotionId) && event.netResult > 0), "Independent promotions never produced a profitable live event");
});

test("scheduled appearances never exceed same-day booking or weekly Service Capacity", () => {
  const state = createWorld(408, DEFAULT_RULESET);
  resolveWorldWeeks(state, 104);
  const errors = validateWorldInvariants(state).filter((error) => error.includes("double-booked") || error.includes("service capacity"));
  equal(errors.length, 0, errors.join("\n"));
});


test("completed events build real match cards and each used wrestler appears once", () => {
  const state = createWorld(501, DEFAULT_RULESET);
  resolveWorldWeek(state);
  const completedEvents = state.events.filter((event) => event.status === "COMPLETED");
  ok(completedEvents.length > 0, "no events completed");
  for (const event of completedEvents) {
    const matches = state.matches.filter((match) => match.eventId === event.id && match.status === "COMPLETED");
    equal(matches.length, event.matchCount);
    ok(matches.length >= 3, `${event.id} did not produce a viable wrestling card`);
    const matchIds = new Set(matches.map((match) => match.id));
    const participants = state.matchParticipants.filter((participant) => matchIds.has(participant.matchId));
    const participantCounts = new Map<string, number>();
    for (const participant of participants) participantCounts.set(participant.personId, (participantCounts.get(participant.personId) ?? 0) + 1);
    ok([...participantCounts.values()].every((count) => count === 1), `${event.id} booked a wrestler in multiple matches`);
    const completedAppearanceIds = new Set(state.scheduledAppearances.filter((appearance) => appearance.eventId === event.id && appearance.status === "COMPLETED").map((appearance) => appearance.personId));
    equal(participantCounts.size, completedAppearanceIds.size);
    for (const personId of participantCounts.keys()) ok(completedAppearanceIds.has(personId), `${personId} wrestled without a completed appearance`);
  }
});

test("singles and tag matches both emerge from AI cards", () => {
  const state = createWorld(502, DEFAULT_RULESET);
  resolveWorldWeeks(state, 26);
  ok(state.matches.some((match) => match.status === "COMPLETED" && match.type === "SINGLES"), "no singles matches were produced");
  ok(state.matches.some((match) => match.status === "COMPLETED" && match.type === "TAG"), "no tag matches were produced");
});

test("match execution exposes bounded star ratings and separate crowd response", () => {
  const state = createWorld(503, DEFAULT_RULESET);
  resolveWorldWeeks(state, 8);
  const completed = state.matches.filter((match) => match.status === "COMPLETED");
  ok(completed.length > 0, "no matches completed");
  for (const match of completed) {
    ok(match.criticalRatingStars >= 0.5 && match.criticalRatingStars <= 5, `${match.id} has invalid star rating`);
    ok(match.crowdResponse >= 0 && match.crowdResponse <= 100, `${match.id} has invalid crowd response`);
    ok(match.executionQuality >= 0 && match.executionQuality <= 100, `${match.id} has invalid execution quality`);
  }
  ok(completed.some((match) => Math.abs(match.crowdResponse - match.executionQuality) >= 5), "crowd response is effectively duplicating execution quality");
});

test("wrestling creates fatigue and wear while weekly recovery reduces fatigue", () => {
  const state = createWorld(504, DEFAULT_RULESET);
  resolveWorldWeek(state);
  const participantId = state.matchParticipants.find((participant) => {
    const match = state.matches.find((candidate) => candidate.id === participant.matchId);
    return match?.status === "COMPLETED";
  })!.personId;
  const person = state.people.find((candidate) => candidate.id === participantId)!;
  ok(person.fatigue > 0, "completed match added no fatigue");
  ok(person.wear > 0, "completed match added no wear");
  const beforeRecovery = person.fatigue;
  recoverWrestlersForNewWeek(state);
  ok(person.fatigue < beforeRecovery, "weekly recovery did not reduce fatigue");
});

test("injuries remove wrestlers temporarily and recover on the career clock", () => {
  const state = createWorld(505, DEFAULT_RULESET);
  resolveWorldWeek(state);
  const match = state.matches.find((candidate) => candidate.status === "COMPLETED")!;
  const participant = state.matchParticipants.find((candidate) => candidate.matchId === match.id)!;
  const person = state.people.find((candidate) => candidate.id === participant.personId)!;
  if (person.status === "INJURED") {
    const active = state.injuries.find((injury) => injury.personId === person.id && injury.status === "ACTIVE")!;
    active.status = "RECOVERED";
    active.weeksRemaining = 0;
    person.status = "ACTIVE";
  }
  createInjury(state, person, match, "MINOR", 1);
  equal(person.status, "INJURED");
  ok(state.injuries.some((injury) => injury.personId === person.id && injury.status === "ACTIVE"), "forced injury was not recorded");
  recoverWrestlersForNewWeek(state);
  equal(person.status, "ACTIVE");
  ok(state.injuries.some((injury) => injury.personId === person.id && injury.status === "RECOVERED"), "injury did not recover");
});

test("working chemistry is persistent and familiarity grows through matches", () => {
  const state = createWorld(506, DEFAULT_RULESET);
  resolveWorldWeeks(state, 12);
  ok(state.workingChemistry.length > 0, "no chemistry records were discovered");
  ok(state.workingChemistry.some((record) => record.matchesTogether > 0 && record.familiarity > 0), "chemistry familiarity never grew");
  const keys = state.workingChemistry.map((record) => `${record.personAId}:${record.personBId}:${record.context}`);
  equal(new Set(keys).size, keys.length);
});

test("long Worlds produce injuries without turning the entire population unavailable", () => {
  const state = createWorld(507, DEFAULT_RULESET);
  resolveWorldWeeks(state, 260);
  ok(state.injuries.length > 0, "five-year World produced no injuries");
  ok(state.injuries.some((injury) => injury.status === "RECOVERED"), "no wrestler ever recovered from injury");
  ok(state.people.filter((person) => person.status === "INJURED").length < state.people.length * 0.2, "injury system disabled too much of the population");
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exitCode = 1;
