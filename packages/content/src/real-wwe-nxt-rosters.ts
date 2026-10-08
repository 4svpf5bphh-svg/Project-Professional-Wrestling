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
  "Akira Tozawa",
  "Angelo Dawkins",
  "Austin Theory",
  "Big Cass",
  "Bravo Americano",
  "Bron Breakker",
  "Brutus Creed",
  "Chad Gable",
  "Cruz Del Toro",
  "Dominik Mysterio",
  "El Grande Americano",
  "Ethan Page",
  "Jacob Fatu",
  "JD McDonagh",
  "Je'Von Evans",
  "Jey Uso",
  "Jimmy Uso",
  "Joaquin Wilde",
  "Joe Hendry",
  "Julius Creed",
  "LA Knight",
  "Montez Ford",
  "Oba Femi",
  "Otis",
  "Penta",
  "Rayo Americano",
  "Rey Mysterio",
  "Roman Reigns",
  "Rusev",
  "Seth Rollins",
  "Angel",
  "Axiom",
  "Baron Corbin",
  "Berto",
  "Carmelo Hayes",
  "CM Punk",
  "Cody Rhodes",
  "Damian Priest",
  "Drew McIntyre",
  "Erik",
  "Finn Bálor",
  "Gunther",
  "Ilja Dragunov",
  "Ivar",
  "Johnny Gargano",
  "Kevin Owens",
  "Kit Wilson",
  "Matt Cardona",
  "The Miz",
  "Nathan Frazer",
  "R-Truth",
  "Randy Orton",
  "Rey Fenix",
  "Ricky Saints",
  "Royce Keys",
  "Sami Zayn",
  "Shinsuke Nakamura",
  "Solo Sikoa",
  "Talla Tonga",
  "Tama Tonga",
  "Trick Williams",
  "Danhausen",
  "Omos",
  "Asuka",
  "Bayley",
  "Becky Lynch",
  "Ivy Nile",
  "IYO SKY",
  "Liv Morgan",
  "Lyra Valkyria",
  "Maxxine Dupri",
  "Raquel Rodriguez",
  "Roxanne Perez",
  "Sol Ruca",
  "Stephanie Vaquer",
  "Alexa Bliss",
  "B-Fab",
  "Blake Monroe",
  "Candice LeRae",
  "Charlotte Flair",
  "Chelsea Green",
  "Fallon Henley",
  "Giulia",
  "Jacy Jayne",
  "Jade Cargill",
  "Jordynne Grace",
  "Kiana James",
  "Lash Legend",
  "Nia Jax",
  "Tiffany Stratton",
  "AJ Lee",
  "Nikki Bella",
  "Paige",
  "Bianca Belair",
  "Brie Bella",
  "Bronson Reed",
  "Dragon Lee",
  "Elio LeFleur",
  "Elton Prince",
  "Logan Paul",
  "Rhea Ripley",
] as const;

export const NXT_INITIAL_ROSTER_NAMES = [
  "Brad Baylor",
  "Bronco Nima",
  "Channing \"Stacks\" Lorenzo",
  "Charlie Dempsey",
  "Cruz Montana",
  "Cutler James",
  "Dion Lennox",
  "EK Prosper",
  "Grayson Waller",
  "Hank Walker",
  "Jackson Drake",
  "Jasper Troy",
  "Josh Briggs",
  "Kam Hendrix",
  "Keanu Carver",
  "Lexis King",
  "Lucien Price",
  "Mason Rook",
  "Myles Borne",
  "Niko Vance",
  "Noam Dar",
  "Osiris Griffin",
  "Ricky Smokes",
  "Romeo Moreno",
  "Saquon Shugars",
  "Sean Legacy",
  "Shawn Spears",
  "Shiloh Hill",
  "Tank Ledger",
  "Tate Wilder",
  "Tavion Heights",
  "Tony D'Angelo",
  "Tristan Angels",
  "Uriah Connors",
  "Arianna Grace",
  "Jaida Parker",
  "Kelani Jordan",
  "Kendal Grey",
  "Lola Vice",
  "Nattie",
  "Thea Hail",
  "Wren Sinclair",
  "Zaria",
  "Aaron Rourke",
  "Braxton Cole",
  "Cappuccino Jones",
  "Chazz \"Starboy\" Hall",
  "CJ Valor",
  "Dorian Van Dux",
  "Elijah Holyfield",
  "Harlem Lewis",
  "Harley Riggins",
  "Jax Presley",
  "Shido Ash",
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
 * Reviewed WWE-system employment assignment seed.
 *
 * WWE is the employment-rights owner for both groups. Main-roster/free-agent/PUP
 * identities receive a WWE roster affiliation. NXT and Evolve developmental
 * identities receive an NXT roster affiliation while their exclusive contract
 * remains with WWE. The lists deliberately protect every current WWE-system
 * identity present in the PPW roster pool from generic Genesis allocation.
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
