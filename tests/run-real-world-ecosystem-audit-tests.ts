import type { Person, Promotion, WorldState } from "../packages/domain/src/types.js";
import { REAL_WORLD_ALPHA_RULESET } from "../packages/config/src/real-world-ruleset.js";
import { calibratedRealActiveMixedRosterSource } from "../packages/content/src/real-active-mixed-roster.js";
import { realPromotionEcosystemSource } from "../packages/content/src/real-promotions.js";
import { realWorldInitialRosterAssignmentSource } from "../packages/content/src/real-aew-roh-cmll-rosters.js";
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
  target: number;
  delta: number;
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
    const roster = currentRosterPersonIds(state, promotion.id).length;
    const target = targetRosterSize(promotion);
    return {
      name: promotion.name,
      origin: promotion.identity?.origin ?? "LEGACY",
      tier: promotion.tier,
      takeover: promotion.playerTakeoverEligibility ?? "LEGACY",
      roster,
      target,
      delta: roster - target,
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
ok(startSnapshot.wrestlers === REAL_WORLD_ALPHA_RULESET.wrestlers, "audit World roster size drifted");
ok(startSnapshot.realPromotions === 8, "audit World no longer has eight real promotions");
ok(startSnapshot.takeoverPromotions === 5, "audit World no longer has five takeover promotions");
ok(startSnapshot.allTalent.accessible > 0, "audit World has no accessible talent");
ok(startSnapshot.men.accessible > 0 && startSnapshot.women.accessible > 0, "one division has no accessible talent");
ok(
  startSnapshot.promotions
    .filter((promotion) => promotion.takeover === "STANDARD")
    .every((promotion) => promotion.roster > 0),
  "a takeover promotion starts with an empty roster",
);

const week26 = buildWorld(20261008);
resolveWorldWeeks(week26, 26);
const week26Errors = validateWorldInvariants(week26);
ok(week26Errors.length === 0, week26Errors.join("\n"));
const week26Snapshot = snapshot(week26);

console.log("REAL_WORLD_ECOSYSTEM_AUDIT_START");
console.log(JSON.stringify(startSnapshot, null, 2));
console.log("REAL_WORLD_ECOSYSTEM_AUDIT_WEEK_26");
console.log(JSON.stringify(week26Snapshot, null, 2));
console.log("PASS real-world ecosystem diagnostic");
