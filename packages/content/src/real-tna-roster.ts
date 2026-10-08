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

export const TNA_ROSTER_SEED_REVIEWED_ON = "2026-10-07";

export const TNA_PRIMARY_ROSTER_NAMES = [
  "Nic Nemeth",
  "Ryan Nemeth",
  "Matt Hardy",
  "Jeff Hardy",
  "Mustafa Ali",
  "Moose",
  "AJ Francis",
  "Brian Myers",
  "Eddie Edwards",
  "Leon Slater",
  "KC Navarro",
  "Ricky Sosa",
  "Fabian Aichner",
  "Frankie Kazarian",
  "Cedric Alexander",
  "Elijah",
  "Rich Swann",
  "Jason Hotch",
  "Bear Bronson",
  "Joseph Sawyer",
  "The Home Town Man",
  "BDE",
  "Mr. Elegance",
  "Dutch",
  "Xia Brookside",
  "Indi Hartwell",
  "Jada Stone",
  "Elayna Black",
  "Alisha Edwards",
  "Allie",
  "Ash By Elegance",
  "Kiera Hogan",
  "M By Elegance",
  "Heather By Elegance",
  "Rosemary",
  "Tasha Steelz",
  "Mara Sadé",
  "Léi Yǐng Lee",
  "Jody Threat",
  "Zoey Serrano",
] as const;

const reviewedRosterNames = new Set([
  ...REAL_ACTIVE_MENS_ROSTER_NAMES,
  ...REAL_ACTIVE_WOMENS_ROSTER_NAMES,
]);

if (new Set(TNA_PRIMARY_ROSTER_NAMES).size !== TNA_PRIMARY_ROSTER_NAMES.length) {
  throw new Error("TNA roster seed contains duplicate identities");
}
for (const name of TNA_PRIMARY_ROSTER_NAMES) {
  if (!reviewedRosterNames.has(name)) {
    throw new Error(`TNA roster seed references unknown wrestler ${name}`);
  }
}

/**
 * TNA active-core seed.
 *
 * PPW uses flexible/non-exclusive starting deals here as a simulation default
 * so outside work and future inter-promotional agreements remain possible.
 * This is not a claim about private real-world contract language.
 */
export const tnaInitialRosterAssignmentSource: InitialRosterAssignmentSource = ({
  people,
  promotions,
}) => {
  const personByName = new Map(people.map((person) => [person.name, person]));
  const tna = promotions.find((promotion) => promotion.name === "TNA Wrestling");
  if (!tna) throw new Error("TNA roster seed requires TNA Wrestling");

  const assignments: InitialRosterAssignment[] = [];
  for (const name of TNA_PRIMARY_ROSTER_NAMES) {
    const person = personByName.get(name);
    if (!person) throw new Error(`TNA initial roster seed is missing ${name}`);
    assignments.push({
      personId: person.id,
      promotionId: tna.id,
      family: "LIMITED_NON_EXCLUSIVE",
      rosterAffiliations: [{
        promotionId: tna.id,
        role: "PRIMARY",
        basis: "CONTRACT",
      }],
    });
  }
  return assignments;
};
