import type { Person, Promotion, WorldState } from "../packages/domain/src/types.js";
import { REAL_WORLD_ALPHA_RULESET } from "../packages/config/src/real-world-ruleset.js";
import { calibratedRealActiveMixedRosterSource } from "../packages/content/src/real-active-mixed-roster.js";
import { realPromotionEcosystemSource } from "../packages/content/src/real-promotions.js";
import {
  REAL_WORLD_TAKEOVER_STARTUP_MEN,
  REAL_WORLD_TAKEOVER_STARTUP_ROSTER_SIZE,
  REAL_WORLD_TAKEOVER_STARTUP_WOMEN,
  realWorldInitialRosterAssignmentSource,
} from "../packages/content/src/real-aew-roh-cmll-rosters.js";
import {
  NXT_INITIAL_ROSTER_NAMES,
  WWE_INITIAL_ROSTER_NAMES,
} from "../packages/content/src/real-wwe-nxt-rosters.js";
import { seedRealActiveTagTeams } from "../packages/content/src/real-active-tag-teams.js";
import { seedRealWrestlerRelationships } from "../packages/content/src/real-wrestler-relationships.js";
import { realRosterValueBand } from "../packages/content/src/real-active-mens-calibration.js";
import { realWomensRosterValueBand } from "../packages/content/src/real-active-womens-calibration.js";
import {
  activeContractsForPerson,
  createWorld,
  currentRosterPersonIds,
  resolveWorldWeeks,
  targetRosterSize,
  validateWorldInvariants,
} from "../packages/sim-core/src/index.js";

type TalentPool = {
  total: number;
  free: number;
  flexible: number;
  locked: number;
  accessible: number;
  accessibleHeadliners: number;
  accessibleFeaturedOrBetter: number;
};

type PromotionAudit = {
  name: string;
  origin: string;
  tier: string;
  takeover: string;
  roster: number;
  men: number;
  women: number;
  target: number;
  delta: number;
  cash: number;
  debt: number;
  financialDistress: string;
  runwayWeeks: number | null;
};

function ok(value: unknown, message: string): void {
  if (!value) throw new Error(message);
}

function divisionOf(person: Person): "MEN" | "WOMEN" {
  return person.division ?? "MEN";
}

function valueBand(person: Person): "MEGASTAR" | "HEADLINER" | "FEATURED" | "REGULAR" | "PROSPECT" {
  return divisionOf(person) === "WOMEN"
    ? realWomensRosterValueBand(person.name)
    : realRosterValueBand(person.name);
}

function talentPool(state: WorldState, division?: "MEN" | "WOMEN"): TalentPool {
  const people = state.people.filter((person) => !division || divisionOf(person) === division);
  let free = 0;
  let flexible = 0;
  let locked = 0;
  let accessibleHeadliners = 0;
  let accessibleFeaturedOrBetter = 0;

  for (const person of people) {
    const contracts = activeContractsForPerson(state, person.id);
    const isLocked = contracts.some((contract) => contract.exclusivity === "EXCLUSIVE");
    if (contracts.length === 0) free += 1;
    else if (isLocked) locked += 1;
    else flexible += 1;

    if (!isLocked) {
      const band = valueBand(person);
      if (band === "MEGASTAR" || band === "HEADLINER") accessibleHeadliners += 1;
      if (band === "MEGASTAR" || band === "HEADLINER" || band === "FEATURED") {
        accessibleFeaturedOrBetter += 1;
      }
    }
  }

  return {
    total: people.length,
    free,
    flexible,
    locked,
    accessible: free + flexible,
    accessibleHeadliners,
    accessibleFeaturedOrBetter,
  };
}

function promotionAudit(state: WorldState): PromotionAudit[] {
  return state.promotions.map((promotion: Promotion) => {
    const rosterIds = currentRosterPersonIds(state, promotion.id);
    const rosterPeople = rosterIds
      .map((personId) => state.people.find((person) => person.id === personId))
      .filter((person): person is Person => person !== undefined);
    const roster = rosterPeople.length;
    const target = targetRosterSize(promotion);
    return {
      name: promotion.name,
      origin: promotion.identity?.origin ?? "LEGACY",
      tier: promotion.tier,
      takeover: promotion.playerTakeoverEligibility ?? "LEGACY",
      roster,
      men: rosterPeople.filter((person) => divisionOf(person) === "MEN").length,
      women: rosterPeople.filter((person) => divisionOf(person) === "WOMEN").length,
      target,
      delta: roster - target,
      cash: promotion.cash,
      debt: promotion.debt,
      financialDistress: promotion.financialDistress,
      runwayWeeks: promotion.runwayWeeks,
    };
  });
}

function buildWorld(seed: number): WorldState {
  const state = createWorld(
    seed,
    REAL_WORLD_ALPHA_RULESET,
    "PPW Real-World Ecosystem Audit",
    calibratedRealActiveMixedRosterSource,
    realPromotionEcosystemSource,
    realWorldInitialRosterAssignmentSource,
  );
  seedRealActiveTagTeams(state);
  seedRealWrestlerRelationships(state);
  return state;
}

function snapshot(state: WorldState) {
  const realPromotions = state.promotions.filter((promotion) => promotion.identity?.origin === "REAL_WORLD");
  const takeoverPromotions = state.promotions.filter(
    (promotion) => promotion.playerTakeoverEligibility === "STANDARD",
  );
  const activeUniqueContracted = new Set(
    state.people
      .filter((person) => activeContractsForPerson(state, person.id).length > 0)
      .map((person) => person.id),
  ).size;

  return {
    date: state.world.currentDate,
    wrestlers: state.people.length,
    activeUniqueContracted,
    freeAgents: state.people.length - activeUniqueContracted,
    contracts: state.contracts.filter((contract) => contract.status === "SIGNED").length,
    realPromotions: realPromotions.length,
    takeoverPromotions: takeoverPromotions.length,
    allTalent: talentPool(state),
    men: talentPool(state, "MEN"),
    women: talentPool(state, "WOMEN"),
    promotions: promotionAudit(state),
  };
}

const start = buildWorld(20261008);
const startErrors = validateWorldInvariants(start);
ok(startErrors.length === 0, startErrors.join("\n"));

const startSnapshot = snapshot(start);
const wwe = start.promotions.find((promotion) => promotion.name === "WWE");
const nxt = start.promotions.find((promotion) => promotion.name === "NXT");
const roh = start.promotions.find((promotion) => promotion.name === "ROH");
ok(wwe && nxt && roh, "audit World is missing WWE, NXT or ROH");
const peopleByName = new Map(start.people.map((person) => [person.name, person]));
const takeoverIds = new Set(
  start.promotions
    .filter((promotion) => promotion.playerTakeoverEligibility === "STANDARD")
    .map((promotion) => promotion.id),
);
for (const name of [...WWE_INITIAL_ROSTER_NAMES, ...NXT_INITIAL_ROSTER_NAMES]) {
  const person = peopleByName.get(name);
  ok(person, `protected WWE-system identity missing from World: ${name}`);
  const contracts = activeContractsForPerson(start, person!.id);
  ok(
    contracts.length === 1
      && contracts[0]!.promotionId === wwe!.id
      && contracts[0]!.exclusivity === "EXCLUSIVE",
    `WWE-system identity is not exclusively protected by WWE at Genesis: ${name}`,
  );
  for (const takeoverId of takeoverIds) {
    ok(
      !currentRosterPersonIds(start, takeoverId).includes(person!.id),
      `WWE-system identity leaked onto takeover roster at Genesis: ${name}`,
    );
  }
}
const wweRosterIds = new Set(currentRosterPersonIds(start, wwe!.id));
const nxtRosterIds = new Set(currentRosterPersonIds(start, nxt!.id));
for (const name of WWE_INITIAL_ROSTER_NAMES) {
  ok(wweRosterIds.has(peopleByName.get(name)!.id), `WWE roster affiliation missing ${name}`);
}
for (const name of NXT_INITIAL_ROSTER_NAMES) {
  ok(nxtRosterIds.has(peopleByName.get(name)!.id), `NXT roster affiliation missing ${name}`);
}
ok(nxtRosterIds.size > 0, "NXT explicit roster is empty at Genesis");
ok(currentRosterPersonIds(start, roh!.id).length > 0, "ROH explicit roster is empty at Genesis");

ok(startSnapshot.wrestlers === REAL_WORLD_ALPHA_RULESET.wrestlers, "audit World roster size drifted");
ok(startSnapshot.realPromotions === 8, "audit World no longer has eight real promotions");
ok(startSnapshot.takeoverPromotions === 5, "audit World no longer has five takeover promotions");
ok(startSnapshot.allTalent.accessible > 0, "audit World has no accessible talent");
ok(startSnapshot.men.accessible > 0 && startSnapshot.women.accessible > 0, "one division has no accessible talent");
const startTakeovers = startSnapshot.promotions.filter((promotion) => promotion.takeover === "STANDARD");
ok(
  startTakeovers.every((promotion) => promotion.roster === REAL_WORLD_TAKEOVER_STARTUP_ROSTER_SIZE),
  "a takeover promotion does not start with the intended seeded roster size",
);
ok(
  startTakeovers.every((promotion) => promotion.men === REAL_WORLD_TAKEOVER_STARTUP_MEN),
  "a takeover promotion does not start with the intended men's roster depth",
);
ok(
  startTakeovers.every((promotion) => promotion.women === REAL_WORLD_TAKEOVER_STARTUP_WOMEN),
  "a takeover promotion does not start with the intended women's roster depth",
);
// These floors describe the correctly protected real-world ecosystem. The
// earlier looser ownership model counted several WWE-contracted wrestlers as
// accessible/free and therefore overstated market supply.
ok(startSnapshot.allTalent.free >= 165, "Genesis free-agent pool is too small");
ok(startSnapshot.allTalent.accessible >= 400, "Genesis accessible talent pool is too small");
ok(startSnapshot.men.accessible >= 270, "Genesis accessible men's pool is too small");
ok(startSnapshot.women.accessible >= 125, "Genesis accessible women's pool is too small");
ok(startSnapshot.allTalent.accessibleHeadliners >= 35, "Genesis lacks accessible headline talent");
ok(startSnapshot.women.accessibleHeadliners >= 10, "Genesis lacks accessible women's headline talent");
ok(startSnapshot.allTalent.accessibleFeaturedOrBetter >= 135, "Genesis lacks accessible featured-or-better depth");

const week26 = buildWorld(20261008);
resolveWorldWeeks(week26, 26);
const week26Errors = validateWorldInvariants(week26);
ok(week26Errors.length === 0, week26Errors.join("\n"));
const week26Snapshot = snapshot(week26);
const week26Takeovers = week26Snapshot.promotions.filter((promotion) => promotion.takeover === "STANDARD");
ok(week26Snapshot.allTalent.free >= 165, "week-26 free-agent pool is too small");
ok(week26Snapshot.allTalent.accessible >= 350, "week-26 accessible talent pool is too small");
ok(week26Snapshot.men.accessible >= 230, "week-26 accessible men's pool is too small");
ok(week26Snapshot.women.accessible >= 100, "week-26 accessible women's pool is too small");
ok(week26Snapshot.allTalent.accessibleHeadliners >= 28, "week-26 accessible headline talent is too shallow");
ok(week26Snapshot.women.accessibleHeadliners >= 8, "week-26 accessible women's headline talent is too shallow");
ok(week26Snapshot.allTalent.accessibleFeaturedOrBetter >= 110, "week-26 featured-or-better talent is too shallow");
ok(
  week26Takeovers.every((promotion) => promotion.roster >= 18 && promotion.roster <= 32),
  "a takeover promotion becomes roster-starved or bloated by week 26",
);
const crisisTakeovers = week26Takeovers.filter((promotion) => promotion.financialDistress === "CRISIS");
ok(
  crisisTakeovers.length === 0,
  `takeover promotion reaches financial crisis inside the 26-week runway: ${JSON.stringify(crisisTakeovers)}`,
);
const crisisRealPromotions = week26Snapshot.promotions.filter(
  (promotion) => promotion.origin === "REAL_WORLD" && promotion.financialDistress === "CRISIS",
);
ok(
  crisisRealPromotions.length === 0,
  `real promotion reaches financial crisis inside the 26-week runway: ${JSON.stringify(crisisRealPromotions)}`,
);

console.log("REAL_WORLD_ECOSYSTEM_AUDIT_START");
console.log(JSON.stringify(startSnapshot, null, 2));
console.log("REAL_WORLD_ECOSYSTEM_AUDIT_WEEK_26");
console.log(JSON.stringify(week26Snapshot, null, 2));
console.log("PASS real-world ecosystem diagnostic");
