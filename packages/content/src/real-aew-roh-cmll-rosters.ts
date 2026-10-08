import {
  REAL_ACTIVE_MENS_ROSTER_NAMES,
} from "./real-active-mens-roster.js";
import {
  REAL_ACTIVE_WOMENS_ROSTER_NAMES,
} from "./real-active-womens-roster.js";
import {
  wweNxtInitialRosterAssignmentSource,
} from "./real-wwe-nxt-rosters.js";
import {
  tnaInitialRosterAssignmentSource,
} from "./real-tna-roster.js";
import {
  njpwStardomInitialRosterAssignmentSource,
} from "./real-njpw-stardom-rosters.js";
import type {
  InitialRosterAssignment,
  InitialRosterAssignmentContext,
  InitialRosterAssignmentSource,
} from "../../sim-core/src/initial-roster-assignments.js";

export const AEW_ROH_CMLL_ROSTER_SEED_REVIEWED_ON = "2026-10-07";

export const AEW_PRIMARY_ROSTER_NAMES = [
  "\"Hangman\" Adam Page",
  "MJF",
  "Jon Moxley",
  "Kenny Omega",
  "Will Ospreay",
  "Swerve Strickland",
  "Darby Allin",
  "Kazuchika Okada",
  "Konosuke Takeshita",
  "Kyle Fletcher",
  "Jay White",
  "Orange Cassidy",
  "Daniel Garcia",
  "Ricochet",
  "Brody King",
  "Kevin Knight",
  "Andrade El Ídolo",
  "Chris Jericho",
  "Christian Cage",
  "Adam Copeland",
  "Matthew Jackson",
  "Nicholas Jackson",
  "Dax Harwood",
  "Cash Wheeler",
  "Wheeler Yuta",
  "Mercedes Moné",
  "Kris Statlander",
  "Willow Nightingale",
  "Jamie Hayter",
  "Hikaru Shida",
  "Toni Storm",
  "Marina Shafir",
  "Serena Deeb",
  "Yuka Sakazaki",
  "Mike Bailey",
] as const;

export const ROH_PRIMARY_ROSTER_NAMES = [
  "Bandido",
  "Athena",
  "Red Velvet",
  "Deonna Purrazzo",
  "Lee Moriarty",
  "Mark Briscoe",
  "Mina Shirakawa",
  "Shane Taylor",
  "AR Fox",
  "Diamante",
  "Mansoor",
  "Mason Madden",
  "Sammy Guevara",
  "The Beast Mortos",
  "Brian Cage",
  "Komander",
  "Mike Bennett",
  "Tony Nese",
  "Carlie Bravo",
  "Billie Starkz",
  "Trish Adora",
  "Steph De Lander",
  "Nigel McGuinness",
] as const;

export const AEW_ROH_SECONDARY_ROSTER_NAMES = [
  "Marina Shafir",
] as const;

export const AEW_FLEXIBLE_PRIMARY_ROSTER_NAMES = [
  "Konosuke Takeshita",
  "Kevin Knight",
  "Andrade El Ídolo",
  "Mike Bailey",
] as const;

export const CMLL_PRIMARY_ROSTER_NAMES = [
  "Templario",
  "Volador Jr.",
  "Soberano Jr.",
  "Neón",
  "Esfinge",
  "Bárbaro Cavernario",
  "Averno",
  "Stuka Jr.",
  "Gran Guerrero",
  "Xelhua",
  "La Catalina",
  "Zeuxis",
  "Flammer",
  "Olympia",
  "Tessa Blanchard",
] as const;

export const AEW_CMLL_DUAL_CONTRACT_SEEDS = [
  { name: "Claudio Castagnoli", primary: "AEW", rohSecondary: false },
  { name: "Místico", primary: "CMLL", rohSecondary: true },
  { name: "Máscara Dorada", primary: "CMLL", rohSecondary: true },
  { name: "Hechicero", primary: "CMLL", rohSecondary: false },
  { name: "Persephone", primary: "AEW", rohSecondary: false },
  { name: "Thunder Rosa", primary: "AEW", rohSecondary: false },
] as const;

const reviewedRosterNames = new Set([
  ...REAL_ACTIVE_MENS_ROSTER_NAMES,
  ...REAL_ACTIVE_WOMENS_ROSTER_NAMES,
]);

const primaryNames = [
  ...AEW_PRIMARY_ROSTER_NAMES,
  ...ROH_PRIMARY_ROSTER_NAMES,
  ...CMLL_PRIMARY_ROSTER_NAMES,
  ...AEW_CMLL_DUAL_CONTRACT_SEEDS.map((seed) => seed.name),
];

if (new Set(primaryNames).size !== primaryNames.length) {
  throw new Error("AEW/ROH/CMLL roster seed contains duplicate primary identities");
}
for (const name of primaryNames) {
  if (!reviewedRosterNames.has(name)) {
    throw new Error(`AEW/ROH/CMLL roster seed references unknown wrestler ${name}`);
  }
}
for (const name of AEW_ROH_SECONDARY_ROSTER_NAMES) {
  if (!AEW_PRIMARY_ROSTER_NAMES.includes(name)) {
    throw new Error(`ROH secondary wrestler ${name} is not in the AEW primary seed`);
  }
}

function requirePromotion(
  context: InitialRosterAssignmentContext,
  name: string,
) {
  const promotion = context.promotions.find((candidate) => candidate.name === name);
  if (!promotion) throw new Error(`real roster seed requires promotion ${name}`);
  return promotion;
}

export const aewRohCmllInitialRosterAssignmentSource: InitialRosterAssignmentSource = (context) => {
  const personByName = new Map(context.people.map((person) => [person.name, person]));
  const aew = requirePromotion(context, "AEW");
  const roh = requirePromotion(context, "ROH");
  const cmll = requirePromotion(context, "CMLL");
  const assignments: InitialRosterAssignment[] = [];

  for (const name of AEW_PRIMARY_ROSTER_NAMES) {
    const person = personByName.get(name);
    if (!person) throw new Error(`AEW initial roster seed is missing ${name}`);
    const rohSecondary = AEW_ROH_SECONDARY_ROSTER_NAMES.includes(name as typeof AEW_ROH_SECONDARY_ROSTER_NAMES[number]);
    assignments.push({
      personId: person.id,
      promotionId: aew.id,
      family: AEW_FLEXIBLE_PRIMARY_ROSTER_NAMES.includes(
        name as typeof AEW_FLEXIBLE_PRIMARY_ROSTER_NAMES[number],
      ) ? "LIMITED_NON_EXCLUSIVE" : "EXCLUSIVE",
      rosterAffiliations: [
        { promotionId: aew.id, role: "PRIMARY", basis: "CONTRACT" },
        ...(rohSecondary
          ? [{ promotionId: roh.id, role: "SECONDARY" as const, basis: "PARENT_COMPANY" as const }]
          : []),
      ],
    });
  }

  for (const name of ROH_PRIMARY_ROSTER_NAMES) {
    const person = personByName.get(name);
    if (!person) throw new Error(`ROH initial roster seed is missing ${name}`);
    assignments.push({
      personId: person.id,
      promotionId: aew.id,
      family: "EXCLUSIVE",
      rosterAffiliations: [{
        promotionId: roh.id,
        role: "PRIMARY",
        basis: "PARENT_COMPANY",
      }],
    });
  }

  for (const name of CMLL_PRIMARY_ROSTER_NAMES) {
    const person = personByName.get(name);
    if (!person) throw new Error(`CMLL initial roster seed is missing ${name}`);
    assignments.push({
      personId: person.id,
      promotionId: cmll.id,
      family: "LIMITED_NON_EXCLUSIVE",
      rosterAffiliations: [{
        promotionId: cmll.id,
        role: "PRIMARY",
        basis: "CONTRACT",
      }],
    });
  }

  for (const seed of AEW_CMLL_DUAL_CONTRACT_SEEDS) {
    const person = personByName.get(seed.name);
    if (!person) throw new Error(`AEW/CMLL dual-contract seed is missing ${seed.name}`);
    const aewIsPrimary = seed.primary === "AEW";
    assignments.push({
      personId: person.id,
      promotionId: aew.id,
      family: "LIMITED_NON_EXCLUSIVE",
      rosterAffiliations: [
        {
          promotionId: aew.id,
          role: aewIsPrimary ? "PRIMARY" : "SECONDARY",
          basis: "CONTRACT",
        },
        ...(seed.rohSecondary
          ? [{ promotionId: roh.id, role: "SECONDARY" as const, basis: "PARENT_COMPANY" as const }]
          : []),
      ],
    });
    assignments.push({
      personId: person.id,
      promotionId: cmll.id,
      family: "LIMITED_NON_EXCLUSIVE",
      rosterAffiliations: [{
        promotionId: cmll.id,
        role: aewIsPrimary ? "SECONDARY" : "PRIMARY",
        basis: "CONTRACT",
      }],
    });
  }

  return assignments;
};

export const realWorldInitialRosterAssignmentSource: InitialRosterAssignmentSource = (context) => [
  ...wweNxtInitialRosterAssignmentSource(context),
  ...aewRohCmllInitialRosterAssignmentSource(context),
  ...tnaInitialRosterAssignmentSource(context),
  ...njpwStardomInitialRosterAssignmentSource(context),
];
