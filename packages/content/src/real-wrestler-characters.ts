import { VERIFIED_WRESTLER_CHARACTER_WAVE_2 } from "./real-wrestler-characters-wave-2.js";
import { VERIFIED_WOMENS_CHARACTER_WAVE_3 } from "./real-wrestler-characters-women-wave-3.js";
import { VERIFIED_JAPAN_JOSHI_CHARACTER_WAVE_8 } from "./real-wrestler-characters-japan-wave-8.js";

/**
 * Auditable, incomplete first slice of real-world wrestler character identities.
 * Sources: official WWE superstar profiles and AEW roster profiles.
 * Move classification into one "signature" vs one "finisher" is PPW metadata.
 * No fake move names are generated when the source has only one recognised move.
 * Exact names match PPW roster seeds; do not use regex/fuzzy name guessing.
 *
 * Historical gimmick aliases and multi-move sets are the NEXT catalog wave.
 */
export const CURATED_WRESTLER_CHARACTERS = [
  {
    "name": "Roman Reigns",
    "gimmickArchetype": "TRIBAL_CHIEF",
    "primaryStyle": "POWERHOUSE",
    "secondaryStyle": null,
    "signatureMove": {
      "name": "Superman Punch",
      "category": "STRIKE"
    },
    "finishingMove": {
      "name": "Spear",
      "category": "STRIKE"
    },
    "sourceUrl": "https://www.wwe.com/superstars/roman-reigns"
  },
  {
    "name": "Cody Rhodes",
    "gimmickArchetype": "AMERICAN_NIGHTMARE",
    "primaryStyle": "ALL_ROUNDER",
    "secondaryStyle": null,
    "signatureMove": {
      "name": "Cody Cutter",
      "category": "GRAPPLE"
    },
    "finishingMove": {
      "name": "Cross Rhodes",
      "category": "GRAPPLE"
    },
    "sourceUrl": "https://www.wwe.com/superstars/cody-rhodes"
  },
  {
    "name": "Randy Orton",
    "gimmickArchetype": "LEGEND_KILLER",
    "primaryStyle": "ALL_ROUNDER",
    "secondaryStyle": null,
    "signatureMove": null,
    "finishingMove": {
      "name": "RKO",
      "category": "GRAPPLE"
    },
    "sourceUrl": "https://www.wwe.com/superstars/randy-orton"
  },
  {
    "name": "Rey Mysterio",
    "gimmickArchetype": "LEGENDARY_LUCHADOR",
    "primaryStyle": "LUCHA",
    "secondaryStyle": "HIGH_FLYER",
    "signatureMove": {
      "name": "619",
      "category": "STRIKE"
    },
    "finishingMove": {
      "name": "West Coast Pop",
      "category": "AERIAL"
    },
    "sourceUrl": "https://www.wwe.com/superstars/reymysterio"
  },
  {
    "name": "Dominik Mysterio",
    "gimmickArchetype": "REBEL_LUCHADOR",
    "primaryStyle": "LUCHA",
    "secondaryStyle": null,
    "signatureMove": {
      "name": "619",
      "category": "STRIKE"
    },
    "finishingMove": {
      "name": "Frog Splash",
      "category": "AERIAL"
    },
    "sourceUrl": "https://www.wwe.com/superstars/dirty-dominik-mysterio"
  },
  {
    "name": "Rhea Ripley",
    "gimmickArchetype": "POWERHOUSE",
    "primaryStyle": "POWERHOUSE",
    "secondaryStyle": null,
    "signatureMove": {
      "name": "Prism Trap",
      "category": "SUBMISSION"
    },
    "finishingMove": {
      "name": "Riptide",
      "category": "POWER"
    },
    "sourceUrl": "https://www.wwe.com/superstars/rhea-ripley"
  },
  {
    "name": "Becky Lynch",
    "gimmickArchetype": "REBEL",
    "primaryStyle": "ALL_ROUNDER",
    "secondaryStyle": null,
    "signatureMove": {
      "name": "Manhandle Slam",
      "category": "POWER"
    },
    "finishingMove": {
      "name": "Dis-arm-her",
      "category": "SUBMISSION"
    },
    "sourceUrl": "https://www.wwe.com/superstars/becky-lynch"
  },
  {
    "name": "Charlotte Flair",
    "gimmickArchetype": "QUEEN",
    "primaryStyle": "TECHNICAL",
    "secondaryStyle": null,
    "signatureMove": {
      "name": "Natural Selection",
      "category": "GRAPPLE"
    },
    "finishingMove": {
      "name": "Figure-Eight Leglock",
      "category": "SUBMISSION"
    },
    "sourceUrl": "https://www.wwe.com/superstars/charlotte-flair"
  },
  {
    "name": "Drew McIntyre",
    "gimmickArchetype": "TOUGH_GUY",
    "primaryStyle": "POWERHOUSE",
    "secondaryStyle": null,
    "signatureMove": {
      "name": "Glasgow Kiss",
      "category": "STRIKE"
    },
    "finishingMove": {
      "name": "Claymore",
      "category": "STRIKE"
    },
    "sourceUrl": "https://www.wwe.com/superstars/drew-mcintyre"
  },
  {
    "name": "Seth Rollins",
    "gimmickArchetype": "REVOLUTIONARY",
    "primaryStyle": "ALL_ROUNDER",
    "secondaryStyle": null,
    "signatureMove": null,
    "finishingMove": {
      "name": "Stomp",
      "category": "STRIKE"
    },
    "sourceUrl": "https://www.wwe.com/superstars/seth-rollins"
  },
  {
    "name": "Finn Bálor",
    "gimmickArchetype": "DARK_ANTI_HERO",
    "primaryStyle": "HIGH_FLYER",
    "secondaryStyle": null,
    "signatureMove": {
      "name": "1916",
      "category": "GRAPPLE"
    },
    "finishingMove": {
      "name": "Coup de Grâce",
      "category": "AERIAL"
    },
    "sourceUrl": "https://www.wwe.com/superstars/finn-balor"
  },
  {
    "name": "Damian Priest",
    "gimmickArchetype": "DARK_ANTI_HERO",
    "primaryStyle": "POWERHOUSE",
    "secondaryStyle": null,
    "signatureMove": {
      "name": "Broken Arrow",
      "category": "POWER"
    },
    "finishingMove": {
      "name": "South of Heaven",
      "category": "POWER"
    },
    "sourceUrl": "https://www.wwe.com/superstars/damian-priest"
  },
  {
    "name": "Bianca Belair",
    "gimmickArchetype": "FAN_FAVOURITE",
    "primaryStyle": "POWERHOUSE",
    "secondaryStyle": null,
    "signatureMove": null,
    "finishingMove": {
      "name": "K.O.D.",
      "category": "POWER"
    },
    "sourceUrl": "https://www.wwe.com/superstars/bianca-belair"
  },
  {
    "name": "The Miz",
    "gimmickArchetype": "REALITY_STAR",
    "primaryStyle": "ALL_ROUNDER",
    "secondaryStyle": null,
    "signatureMove": {
      "name": "It Kicks",
      "category": "STRIKE"
    },
    "finishingMove": {
      "name": "Skull-Crushing Finale",
      "category": "GRAPPLE"
    },
    "sourceUrl": "https://www.wwe.com/superstars/the-miz"
  },
  {
    "name": "Kenny Omega",
    "gimmickArchetype": "BEST_BOUT_MACHINE",
    "primaryStyle": "ALL_ROUNDER",
    "secondaryStyle": "STRIKER",
    "signatureMove": {
      "name": "V-Trigger",
      "category": "STRIKE"
    },
    "finishingMove": {
      "name": "One Winged Angel",
      "category": "POWER"
    },
    "sourceUrl": "https://www.allelitewrestling.com/mens-roster/kenny-omega"
  },
  {
    "name": "Will Ospreay",
    "gimmickArchetype": "HIGH_FLYING_DAREDEVIL",
    "primaryStyle": "HIGH_FLYER",
    "secondaryStyle": "STRIKER",
    "signatureMove": {
      "name": "Oscutter",
      "category": "GRAPPLE"
    },
    "finishingMove": {
      "name": "Hidden Blade",
      "category": "STRIKE"
    },
    "sourceUrl": "https://www.allelitewrestling.com/mens-roster/will-ospreay"
  },
  {
    "name": "MJF",
    "gimmickArchetype": "ARROGANT_ACE",
    "primaryStyle": "ALL_ROUNDER",
    "secondaryStyle": null,
    "signatureMove": {
      "name": "Heat Seeker",
      "category": "GRAPPLE"
    },
    "finishingMove": {
      "name": "Salt of the Earth",
      "category": "SUBMISSION"
    },
    "sourceUrl": "https://www.allelitewrestling.com/mens-roster/mjf"
  },
  {
    "name": "Jon Moxley",
    "gimmickArchetype": "STREET_FIGHTER",
    "primaryStyle": "BRAWLER",
    "secondaryStyle": null,
    "signatureMove": {
      "name": "Bulldog Choke",
      "category": "SUBMISSION"
    },
    "finishingMove": {
      "name": "Paradigm Shift",
      "category": "GRAPPLE"
    },
    "sourceUrl": "https://www.allelitewrestling.com/mens-roster/jon-moxley"
  },
  {
    "name": "Darby Allin",
    "gimmickArchetype": "EXTREME_DAREDEVIL",
    "primaryStyle": "HIGH_FLYER",
    "secondaryStyle": null,
    "signatureMove": null,
    "finishingMove": {
      "name": "Coffin Drop",
      "category": "AERIAL"
    },
    "sourceUrl": "https://www.allelitewrestling.com/mens-roster/darby-allin"
  },
  {
    "name": "Orange Cassidy",
    "gimmickArchetype": "LAID_BACK_SLACKER",
    "primaryStyle": "ALL_ROUNDER",
    "secondaryStyle": null,
    "signatureMove": {
      "name": "Beach Break",
      "category": "GRAPPLE"
    },
    "finishingMove": {
      "name": "Orange Punch",
      "category": "STRIKE"
    },
    "sourceUrl": "https://www.allelitewrestling.com/mens-roster/orange-cassidy"
  },
  {
    "name": "Samoa Joe",
    "gimmickArchetype": "SUBMISSION_SPECIALIST",
    "primaryStyle": "BRAWLER",
    "secondaryStyle": "SUBMISSION",
    "signatureMove": {
      "name": "Muscle Buster",
      "category": "POWER"
    },
    "finishingMove": {
      "name": "Coquina Clutch",
      "category": "SUBMISSION"
    },
    "sourceUrl": "https://www.allelitewrestling.com/mens-roster/samoa-joe"
  },
  {
    "name": "Kazuchika Okada",
    "gimmickArchetype": "ARROGANT_ACE",
    "primaryStyle": "STRONG_STYLE",
    "secondaryStyle": null,
    "signatureMove": {
      "name": "Tombstone Piledriver",
      "category": "GRAPPLE"
    },
    "finishingMove": {
      "name": "Rainmaker",
      "category": "STRIKE"
    },
    "sourceUrl": "https://www.allelitewrestling.com/mens-roster/kazuchika-okada"
  },
  {
    "name": "Toni Storm",
    "gimmickArchetype": "HOLLYWOOD_STAR",
    "primaryStyle": "ALL_ROUNDER",
    "secondaryStyle": null,
    "signatureMove": {
      "name": "Hip Attack",
      "category": "STRIKE"
    },
    "finishingMove": {
      "name": "Storm Zero",
      "category": "GRAPPLE"
    },
    "sourceUrl": "https://www.allelitewrestling.com/womens-roster/toni-storm"
  },
  {
    "name": "Gunther",
    "gimmickArchetype": "RING_GENERAL",
    "primaryStyle": "TECHNICAL",
    "secondaryStyle": "STRONG_STYLE",
    "signatureMove": {
      "name": "Sleeper Hold",
      "category": "SUBMISSION"
    },
    "finishingMove": {
      "name": "Powerbomb",
      "category": "POWER"
    },
    "sourceUrl": "https://www.wwe.com/superstars/gunther"
  },
  {
    "name": "CM Punk",
    "gimmickArchetype": "REBEL",
    "primaryStyle": "ALL_ROUNDER",
    "secondaryStyle": null,
    "signatureMove": {
      "name": "Anaconda Vice",
      "category": "SUBMISSION"
    },
    "finishingMove": {
      "name": "GTS",
      "category": "STRIKE"
    },
    "sourceUrl": "https://www.wwe.com/superstars/cm-punk"
  },
  {
    "name": "\"Hangman\" Adam Page",
    "gimmickArchetype": "COWBOY",
    "primaryStyle": "ALL_ROUNDER",
    "secondaryStyle": null,
    "signatureMove": {
      "name": "Dead Eye",
      "category": "POWER"
    },
    "finishingMove": {
      "name": "Buckshot Lariat",
      "category": "STRIKE"
    },
    "sourceUrl": "https://www.allelitewrestling.com/mens-roster/hangman-adam-page"
  },
  {
    "name": "Swerve Strickland",
    "gimmickArchetype": "ANTI_HERO",
    "primaryStyle": "ALL_ROUNDER",
    "secondaryStyle": null,
    "signatureMove": {
      "name": "House Call",
      "category": "STRIKE"
    },
    "finishingMove": {
      "name": "Swerve Stomp",
      "category": "AERIAL"
    },
    "sourceUrl": "https://www.allelitewrestling.com/mens-roster/swerve-strickland"
  },
  {
    "name": "Shinsuke Nakamura",
    "gimmickArchetype": "STRONG_STYLE_ACE",
    "primaryStyle": "STRONG_STYLE",
    "secondaryStyle": null,
    "signatureMove": null,
    "finishingMove": {
      "name": "Kinshasa",
      "category": "STRIKE"
    },
    "sourceUrl": "https://www.wwe.com/superstars/shinsuke-nakamura"
  },
  ...VERIFIED_WRESTLER_CHARACTER_WAVE_2,
  ...VERIFIED_WOMENS_CHARACTER_WAVE_3,
  ...VERIFIED_JAPAN_JOSHI_CHARACTER_WAVE_8
] as const;
export type CuratedWrestlerCharacter = (typeof CURATED_WRESTLER_CHARACTERS)[number];
export function curatedCharacterFor(name:string):CuratedWrestlerCharacter|null {
  return CURATED_WRESTLER_CHARACTERS.find(x=>x.name.trim().toLocaleLowerCase("en-GB")
    ===name.trim().toLocaleLowerCase("en-GB"))??null;
}
