import {
  REAL_ACTIVE_MENS_ROSTER_NAMES,
} from "./real-active-mens-roster.js";
import {
  REAL_ACTIVE_WOMENS_ROSTER_NAMES,
} from "./real-active-womens-roster.js";
import type {
  InitialRosterAssignment,
  InitialRosterAssignmentSource,
} from "../../sim-core/src/initial-roster-assignments.js";

export const WWE_NXT_ROSTER_SEED_REVIEWED_ON = "2026-10-07";

export const WWE_INITIAL_ROSTER_NAMES = [
  "Roman Reigns",
  "Cody Rhodes",
  "Seth Rollins",
  "CM Punk",
  "Rhea Ripley",
  "Liv Morgan",
  "Chelsea Green",
  "Chad Gable",
  "Baron Corbin",
  "Raquel Rodriguez",
  "Tiffany Stratton",
  "Damian Priest",
  "Jey Uso",
  "Jimmy Uso",
  "Gunther",
  "LA Knight",
  "Bron Breakker",
  "Austin Theory",
] as const;

export const NXT_INITIAL_ROSTER_NAMES = [
  "Tony D'Angelo",
  "Kendal Grey",
  "Myles Borne",
  "Tavion Heights",
  "Zaria",
  "Kelani Jordan",
  "Thea Hail",
  "Grayson Waller",
  "Jackson Drake",
  "Brutus Creed",
  "Julius Creed",
  "EK Prosper",
  "Lexis King",
  "Wren Sinclair",
  "Arianna Grace",
  "Sean Legacy",
  "Jaida Parker",
  "Nikkita Lyons",
] as const;

const reviewedRosterNames = new Set([
  ...REAL_ACTIVE_MENS_ROSTER_NAMES,
  ...REAL_ACTIVE_WOMENS_ROSTER_NAMES,
]);

for (const name of [...WWE_INITIAL_ROSTER_NAMES, ...NXT_INITIAL_ROSTER_NAMES]) {
  if (!reviewedRosterNames.has(name)) {
    throw new Error(`WWE/NXT initial roster seed references unknown wrestler ${name}`);
  }
}

const allSeedNames = [...WWE_INITIAL_ROSTER_NAMES, ...NXT_INITIAL_ROSTER_NAMES];
if (new Set(allSeedNames).size !== allSeedNames.length) {
  throw new Error("WWE/NXT initial roster seed assigns a wrestler to both starting brands");
}

/**
 * Reviewed WWE/NXT assignment seed, expanded in deliberately small batches.
 *
 * WWE is the employment-rights owner for both groups. NXT wrestlers receive
 * an NXT roster affiliation while their exclusive contract remains with WWE.
 * The lists are intentionally incomplete until the assignment pipeline has
 * passed simulation validation.
 */
export const wweNxtInitialRosterAssignmentSource: InitialRosterAssignmentSource = ({
  people,
  promotions,
}) => {
  const personByName = new Map(people.map((person) => [person.name, person]));
  const wwe = promotions.find((promotion) => promotion.name === "WWE");
  const nxt = promotions.find((promotion) => promotion.name === "NXT");
  if (!wwe || !nxt) throw new Error("WWE/NXT initial roster seed requires WWE and NXT promotions");

  const assignments: InitialRosterAssignment[] = [];
  for (const name of WWE_INITIAL_ROSTER_NAMES) {
    const person = personByName.get(name);
    if (!person) throw new Error(`WWE initial roster seed is missing ${name}`);
    assignments.push({
      personId: person.id,
      promotionId: wwe.id,
      rosterPromotionId: wwe.id,
      family: "EXCLUSIVE",
    });
  }
  for (const name of NXT_INITIAL_ROSTER_NAMES) {
    const person = personByName.get(name);
    if (!person) throw new Error(`NXT initial roster seed is missing ${name}`);
    assignments.push({
      personId: person.id,
      promotionId: wwe.id,
      rosterPromotionId: nxt.id,
      family: "EXCLUSIVE",
    });
  }
  return assignments;
};
