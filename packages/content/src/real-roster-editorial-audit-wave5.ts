/**
 * PPW editorial identity audit wave 5 — 11 October 2026.
 * A women's-division, luchadora, specialist and cross-promotion quality pass.
 * Exact-seed-name rows; no vague surname-composed finishing moves.
 *
 * Distinctive repertoire is PPW_AUTHORED editorial approximation unless
 * a sourced character catalogue independently verifies it. Signatures and
 * finishers are gameplay editorial roles; some performers use multiple eras
 * or variants, so this is NOT a claim of official chronology/canon.
 * Example references supporting selection of representative directions:
 * https://wwr-stardom.com/en/fighters/koguma/
 * https://wwr-stardom.com/en/report/20260929-3/
 * https://www.allelitewrestling.com/womens-roster/toni-storm
 * https://www.wwe.com/superstars/toni-storm
 * A move in this guide is *not* tagged VERIFIED merely because one of
 * these examples was reviewed; exact-pair verification belongs separately.
 */
import type { PortableIdentityMove } from "../../domain/src/wrestler-identity.js";
export interface ReviewedRosterIdentityWave5 {
  name: string;
  gimmickArchetype: string;
  primaryStyle: string;
  secondaryStyle: string | null;
  signatureMoves: PortableIdentityMove[];
  finishingMoves: PortableIdentityMove[];
}
export const REVIEWED_REAL_ROSTER_IDENTITIES_WAVE5: readonly ReviewedRosterIdentityWave5[] = [
  {
    "name": "Angelo Dawkins",
    "gimmickArchetype": "SHOWMAN",
    "primaryStyle": "ALL_ROUNDER",
    "secondaryStyle": "POWERHOUSE",
    "signatureMoves": [
      {
        "name": "Spinning Splash",
        "category": "AERIAL",
        "source": "PPW_AUTHORED"
      },
      {
        "name": "Running Shoulder Tackle",
        "category": "STRIKE",
        "source": "PPW_AUTHORED"
      }
    ],
    "finishingMoves": [
      {
        "name": "Sky High",
        "category": "POWER",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "Big Cass",
    "gimmickArchetype": "GIANT",
    "primaryStyle": "POWERHOUSE",
    "secondaryStyle": "BRAWLER",
    "signatureMoves": [
      {
        "name": "Big Boot",
        "category": "STRIKE",
        "source": "PPW_AUTHORED"
      },
      {
        "name": "Fallaway Slam",
        "category": "POWER",
        "source": "PPW_AUTHORED"
      }
    ],
    "finishingMoves": [
      {
        "name": "East River Crossing",
        "category": "POWER",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "Brutus Creed",
    "gimmickArchetype": "WRESTLING_MACHINE",
    "primaryStyle": "POWERHOUSE",
    "secondaryStyle": "TECHNICAL",
    "signatureMoves": [
      {
        "name": "Standing Moonsault",
        "category": "AERIAL",
        "source": "PPW_AUTHORED"
      },
      {
        "name": "Gutwrench Suplex",
        "category": "GRAPPLE",
        "source": "PPW_AUTHORED"
      }
    ],
    "finishingMoves": [
      {
        "name": "Brutus Ball",
        "category": "POWER",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "Cruz Del Toro",
    "gimmickArchetype": "HIGH_FLYING_DAREDEVIL",
    "primaryStyle": "LUCHA",
    "secondaryStyle": "HIGH_FLYER",
    "signatureMoves": [
      {
        "name": "Springboard Hurricanrana",
        "category": "GRAPPLE",
        "source": "PPW_AUTHORED"
      },
      {
        "name": "Suicide Dive",
        "category": "AERIAL",
        "source": "PPW_AUTHORED"
      }
    ],
    "finishingMoves": [
      {
        "name": "Phoenix Splash",
        "category": "AERIAL",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "Elton Prince",
    "gimmickArchetype": "SHOW_OFF",
    "primaryStyle": "ALL_ROUNDER",
    "secondaryStyle": "STRIKER",
    "signatureMoves": [
      {
        "name": "Spinning Heel Kick",
        "category": "STRIKE",
        "source": "PPW_AUTHORED"
      },
      {
        "name": "Diving Elbow Drop",
        "category": "AERIAL",
        "source": "PPW_AUTHORED"
      }
    ],
    "finishingMoves": [
      {
        "name": "Spilt Milk",
        "category": "GRAPPLE",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "Julius Creed",
    "gimmickArchetype": "WRESTLING_MACHINE",
    "primaryStyle": "POWERHOUSE",
    "secondaryStyle": "TECHNICAL",
    "signatureMoves": [
      {
        "name": "Standing Shooting Star Press",
        "category": "AERIAL",
        "source": "PPW_AUTHORED"
      },
      {
        "name": "Overhead Belly-to-Belly Suplex",
        "category": "GRAPPLE",
        "source": "PPW_AUTHORED"
      }
    ],
    "finishingMoves": [
      {
        "name": "Sliding Lariat",
        "category": "STRIKE",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "Kit Wilson",
    "gimmickArchetype": "SHOW_OFF",
    "primaryStyle": "ALL_ROUNDER",
    "secondaryStyle": "STRIKER",
    "signatureMoves": [
      {
        "name": "Spinning Neckbreaker",
        "category": "GRAPPLE",
        "source": "PPW_AUTHORED"
      },
      {
        "name": "Double Axe Handle",
        "category": "AERIAL",
        "source": "PPW_AUTHORED"
      }
    ],
    "finishingMoves": [
      {
        "name": "Spilt Milk",
        "category": "GRAPPLE",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "Myles Borne",
    "gimmickArchetype": "SPORTING",
    "primaryStyle": "TECHNICAL",
    "secondaryStyle": "BRAWLER",
    "signatureMoves": [
      {
        "name": "German Suplex",
        "category": "GRAPPLE",
        "source": "PPW_AUTHORED"
      },
      {
        "name": "Olympic Slam",
        "category": "POWER",
        "source": "PPW_AUTHORED"
      }
    ],
    "finishingMoves": [
      {
        "name": "Borne Again",
        "category": "GRAPPLE",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "Blake Monroe",
    "gimmickArchetype": "SHOW_OFF",
    "primaryStyle": "ALL_ROUNDER",
    "secondaryStyle": "STRIKER",
    "signatureMoves": [
      {
        "name": "DDT",
        "category": "GRAPPLE",
        "source": "PPW_AUTHORED"
      },
      {
        "name": "Running Knee",
        "category": "STRIKE",
        "source": "PPW_AUTHORED"
      }
    ],
    "finishingMoves": [
      {
        "name": "Glitter Bomb",
        "category": "GRAPPLE",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "B-Fab",
    "gimmickArchetype": "SHOWMAN",
    "primaryStyle": "ALL_ROUNDER",
    "secondaryStyle": "BRAWLER",
    "signatureMoves": [
      {
        "name": "Big Boot",
        "category": "STRIKE",
        "source": "PPW_AUTHORED"
      },
      {
        "name": "Running Clothesline",
        "category": "STRIKE",
        "source": "PPW_AUTHORED"
      }
    ],
    "finishingMoves": [
      {
        "name": "Neckbreaker",
        "category": "GRAPPLE",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "Brie Bella",
    "gimmickArchetype": "FAN_FAVOURITE",
    "primaryStyle": "ALL_ROUNDER",
    "secondaryStyle": "STRIKER",
    "signatureMoves": [
      {
        "name": "Running Knee",
        "category": "STRIKE",
        "source": "PPW_AUTHORED"
      },
      {
        "name": "Diving Missile Dropkick",
        "category": "STRIKE",
        "source": "PPW_AUTHORED"
      }
    ],
    "finishingMoves": [
      {
        "name": "Bella Buster",
        "category": "GRAPPLE",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "Candice LeRae",
    "gimmickArchetype": "UNDERDOG",
    "primaryStyle": "HIGH_FLYER",
    "secondaryStyle": "TECHNICAL",
    "signatureMoves": [
      {
        "name": "Suicide Dive",
        "category": "AERIAL",
        "source": "PPW_AUTHORED"
      },
      {
        "name": "Lionsault",
        "category": "AERIAL",
        "source": "PPW_AUTHORED"
      }
    ],
    "finishingMoves": [
      {
        "name": "Wicked Stepsister",
        "category": "GRAPPLE",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "Fallon Henley",
    "gimmickArchetype": "OUTLAW",
    "primaryStyle": "ALL_ROUNDER",
    "secondaryStyle": "BRAWLER",
    "signatureMoves": [
      {
        "name": "Sliding Lariat",
        "category": "STRIKE",
        "source": "PPW_AUTHORED"
      },
      {
        "name": "Diving Crossbody",
        "category": "AERIAL",
        "source": "PPW_AUTHORED"
      }
    ],
    "finishingMoves": [
      {
        "name": "Shining Wizard",
        "category": "STRIKE",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "Ivy Nile",
    "gimmickArchetype": "MMA_CROSSOVER",
    "primaryStyle": "SUBMISSION",
    "secondaryStyle": "POWERHOUSE",
    "signatureMoves": [
      {
        "name": "Dragon Sleeper",
        "category": "SUBMISSION",
        "source": "PPW_AUTHORED"
      },
      {
        "name": "Vertical Suplex",
        "category": "GRAPPLE",
        "source": "PPW_AUTHORED"
      }
    ],
    "finishingMoves": [
      {
        "name": "Diamond Chain Lock",
        "category": "SUBMISSION",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "Jacy Jayne",
    "gimmickArchetype": "REBEL",
    "primaryStyle": "STRIKER",
    "secondaryStyle": "ALL_ROUNDER",
    "signatureMoves": [
      {
        "name": "Cannonball",
        "category": "POWER",
        "source": "PPW_AUTHORED"
      },
      {
        "name": "Back Elbow",
        "category": "STRIKE",
        "source": "PPW_AUTHORED"
      }
    ],
    "finishingMoves": [
      {
        "name": "Rolling Encore",
        "category": "STRIKE",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "Kelani Jordan",
    "gimmickArchetype": "HIGH_FLYING_DAREDEVIL",
    "primaryStyle": "HIGH_FLYER",
    "secondaryStyle": "TECHNICAL",
    "signatureMoves": [
      {
        "name": "Handspring Back Elbow",
        "category": "STRIKE",
        "source": "PPW_AUTHORED"
      },
      {
        "name": "Springboard Moonsault",
        "category": "AERIAL",
        "source": "PPW_AUTHORED"
      }
    ],
    "finishingMoves": [
      {
        "name": "Split-Legged Moonsault",
        "category": "AERIAL",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "Kendal Grey",
    "gimmickArchetype": "WRESTLING_MACHINE",
    "primaryStyle": "TECHNICAL",
    "secondaryStyle": "SUBMISSION",
    "signatureMoves": [
      {
        "name": "Amateur Takedown",
        "category": "GRAPPLE",
        "source": "PPW_AUTHORED"
      },
      {
        "name": "Gutwrench Suplex",
        "category": "GRAPPLE",
        "source": "PPW_AUTHORED"
      }
    ],
    "finishingMoves": [
      {
        "name": "Ankle Lock",
        "category": "SUBMISSION",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "Kiana James",
    "gimmickArchetype": "ARROGANT_ACE",
    "primaryStyle": "ALL_ROUNDER",
    "secondaryStyle": "POWERHOUSE",
    "signatureMoves": [
      {
        "name": "Powerbomb",
        "category": "POWER",
        "source": "PPW_AUTHORED"
      },
      {
        "name": "Spinebuster",
        "category": "POWER",
        "source": "PPW_AUTHORED"
      }
    ],
    "finishingMoves": [
      {
        "name": "401K",
        "category": "GRAPPLE",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "Lyra Valkyria",
    "gimmickArchetype": "FAN_FAVOURITE",
    "primaryStyle": "HIGH_FLYER",
    "secondaryStyle": "STRIKER",
    "signatureMoves": [
      {
        "name": "Tornado DDT",
        "category": "GRAPPLE",
        "source": "PPW_AUTHORED"
      },
      {
        "name": "Enzuigiri",
        "category": "STRIKE",
        "source": "PPW_AUTHORED"
      }
    ],
    "finishingMoves": [
      {
        "name": "Nightwish",
        "category": "GRAPPLE",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "Maxxine Dupri",
    "gimmickArchetype": "SHOWMAN",
    "primaryStyle": "ALL_ROUNDER",
    "secondaryStyle": "TECHNICAL",
    "signatureMoves": [
      {
        "name": "Spinning Heel Kick",
        "category": "STRIKE",
        "source": "PPW_AUTHORED"
      },
      {
        "name": "Diving Crossbody",
        "category": "AERIAL",
        "source": "PPW_AUTHORED"
      }
    ],
    "finishingMoves": [
      {
        "name": "Reverse Caterpillar Elbow",
        "category": "STRIKE",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "Nattie",
    "gimmickArchetype": "VETERAN_MENTOR",
    "primaryStyle": "TECHNICAL",
    "secondaryStyle": "SUBMISSION",
    "signatureMoves": [
      {
        "name": "Discus Clothesline",
        "category": "STRIKE",
        "source": "PPW_AUTHORED"
      },
      {
        "name": "Sharpshooter",
        "category": "SUBMISSION",
        "source": "PPW_AUTHORED"
      }
    ],
    "finishingMoves": [
      {
        "name": "Nattie by Nature",
        "category": "GRAPPLE",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "Nikki Bella",
    "gimmickArchetype": "SHOW_OFF",
    "primaryStyle": "ALL_ROUNDER",
    "secondaryStyle": "POWERHOUSE",
    "signatureMoves": [
      {
        "name": "Spinebuster",
        "category": "POWER",
        "source": "PPW_AUTHORED"
      },
      {
        "name": "Diving Elbow",
        "category": "AERIAL",
        "source": "PPW_AUTHORED"
      }
    ],
    "finishingMoves": [
      {
        "name": "Rack Attack",
        "category": "POWER",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "Nikkita Lyons",
    "gimmickArchetype": "SHOWMAN",
    "primaryStyle": "STRIKER",
    "secondaryStyle": "POWERHOUSE",
    "signatureMoves": [
      {
        "name": "Roundhouse Kick",
        "category": "STRIKE",
        "source": "PPW_AUTHORED"
      },
      {
        "name": "Spinning Back Kick",
        "category": "STRIKE",
        "source": "PPW_AUTHORED"
      }
    ],
    "finishingMoves": [
      {
        "name": "Split-Legged Leg Drop",
        "category": "AERIAL",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "Paige",
    "gimmickArchetype": "DARK_ANTI_HERO",
    "primaryStyle": "TECHNICAL",
    "secondaryStyle": "BRAWLER",
    "signatureMoves": [
      {
        "name": "Superkick",
        "category": "STRIKE",
        "source": "PPW_AUTHORED"
      },
      {
        "name": "PTO",
        "category": "SUBMISSION",
        "source": "PPW_AUTHORED"
      }
    ],
    "finishingMoves": [
      {
        "name": "Ram-Paige",
        "category": "GRAPPLE",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "Raquel Rodriguez",
    "gimmickArchetype": "POWERHOUSE",
    "primaryStyle": "POWERHOUSE",
    "secondaryStyle": "ALL_ROUNDER",
    "signatureMoves": [
      {
        "name": "Fallaway Slam",
        "category": "POWER",
        "source": "PPW_AUTHORED"
      },
      {
        "name": "Big Boot",
        "category": "STRIKE",
        "source": "PPW_AUTHORED"
      }
    ],
    "finishingMoves": [
      {
        "name": "Tejana Bomb",
        "category": "POWER",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "Thea Hail",
    "gimmickArchetype": "UNDERDOG",
    "primaryStyle": "SUBMISSION",
    "secondaryStyle": "ALL_ROUNDER",
    "signatureMoves": [
      {
        "name": "Suicide Dive",
        "category": "AERIAL",
        "source": "PPW_AUTHORED"
      },
      {
        "name": "Arm Drag",
        "category": "GRAPPLE",
        "source": "PPW_AUTHORED"
      }
    ],
    "finishingMoves": [
      {
        "name": "Kimura Lock",
        "category": "SUBMISSION",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "Wren Sinclair",
    "gimmickArchetype": "TECHNICAL_WIZARD",
    "primaryStyle": "TECHNICAL",
    "secondaryStyle": "SUBMISSION",
    "signatureMoves": [
      {
        "name": "Wrist Lock",
        "category": "SUBMISSION",
        "source": "PPW_AUTHORED"
      },
      {
        "name": "European Uppercut",
        "category": "STRIKE",
        "source": "PPW_AUTHORED"
      }
    ],
    "finishingMoves": [
      {
        "name": "Cattle Mutilation",
        "category": "SUBMISSION",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "Zaria",
    "gimmickArchetype": "BEAST",
    "primaryStyle": "POWERHOUSE",
    "secondaryStyle": "STRIKER",
    "signatureMoves": [
      {
        "name": "Bicycle Kick",
        "category": "STRIKE",
        "source": "PPW_AUTHORED"
      },
      {
        "name": "Chokeslam",
        "category": "POWER",
        "source": "PPW_AUTHORED"
      }
    ],
    "finishingMoves": [
      {
        "name": "F5",
        "category": "POWER",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "Adam Cole",
    "gimmickArchetype": "ARROGANT_ACE",
    "primaryStyle": "ALL_ROUNDER",
    "secondaryStyle": "STRIKER",
    "signatureMoves": [
      {
        "name": "Panama Sunrise",
        "category": "GRAPPLE",
        "source": "PPW_AUTHORED"
      },
      {
        "name": "Ushigoroshi",
        "category": "GRAPPLE",
        "source": "PPW_AUTHORED"
      }
    ],
    "finishingMoves": [
      {
        "name": "The Boom",
        "category": "STRIKE",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "Adam Copeland",
    "gimmickArchetype": "DARK_ANTI_HERO",
    "primaryStyle": "ALL_ROUNDER",
    "secondaryStyle": "BRAWLER",
    "signatureMoves": [
      {
        "name": "Edgecution",
        "category": "GRAPPLE",
        "source": "PPW_AUTHORED"
      },
      {
        "name": "Edge-O-Matic",
        "category": "GRAPPLE",
        "source": "PPW_AUTHORED"
      }
    ],
    "finishingMoves": [
      {
        "name": "Spear",
        "category": "STRIKE",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "Anthony Ogogo",
    "gimmickArchetype": "MMA_CROSSOVER",
    "primaryStyle": "STRIKER",
    "secondaryStyle": "BRAWLER",
    "signatureMoves": [
      {
        "name": "Body Blow",
        "category": "STRIKE",
        "source": "PPW_AUTHORED"
      },
      {
        "name": "Uppercut",
        "category": "STRIKE",
        "source": "PPW_AUTHORED"
      }
    ],
    "finishingMoves": [
      {
        "name": "Knockout Punch",
        "category": "STRIKE",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "Chris Sabin",
    "gimmickArchetype": "TECHNICAL_WIZARD",
    "primaryStyle": "ALL_ROUNDER",
    "secondaryStyle": "HIGH_FLYER",
    "signatureMoves": [
      {
        "name": "Cradle Shock",
        "category": "GRAPPLE",
        "source": "PPW_AUTHORED"
      },
      {
        "name": "Springboard Dropkick",
        "category": "STRIKE",
        "source": "PPW_AUTHORED"
      }
    ],
    "finishingMoves": [
      {
        "name": "Future Shock",
        "category": "GRAPPLE",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "Christian Cage",
    "gimmickArchetype": "OPPORTUNIST",
    "primaryStyle": "ALL_ROUNDER",
    "secondaryStyle": "BRAWLER",
    "signatureMoves": [
      {
        "name": "Diving Headbutt",
        "category": "AERIAL",
        "source": "PPW_AUTHORED"
      },
      {
        "name": "Frog Splash",
        "category": "AERIAL",
        "source": "PPW_AUTHORED"
      }
    ],
    "finishingMoves": [
      {
        "name": "Killswitch",
        "category": "GRAPPLE",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "Colten Gunn",
    "gimmickArchetype": "SHOW_OFF",
    "primaryStyle": "ALL_ROUNDER",
    "secondaryStyle": "BRAWLER",
    "signatureMoves": [
      {
        "name": "Dropkick",
        "category": "STRIKE",
        "source": "PPW_AUTHORED"
      },
      {
        "name": "Neckbreaker",
        "category": "GRAPPLE",
        "source": "PPW_AUTHORED"
      }
    ],
    "finishingMoves": [
      {
        "name": "Colt 45",
        "category": "GRAPPLE",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "Darius Martin",
    "gimmickArchetype": "HIGH_FLYING_DAREDEVIL",
    "primaryStyle": "HIGH_FLYER",
    "secondaryStyle": "ALL_ROUNDER",
    "signatureMoves": [
      {
        "name": "Springboard Crossbody",
        "category": "AERIAL",
        "source": "PPW_AUTHORED"
      },
      {
        "name": "Diving Moonsault",
        "category": "AERIAL",
        "source": "PPW_AUTHORED"
      }
    ],
    "finishingMoves": [
      {
        "name": "Diving Bulldog",
        "category": "GRAPPLE",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "Jay White",
    "gimmickArchetype": "OPPORTUNIST",
    "primaryStyle": "TECHNICAL",
    "secondaryStyle": "STRIKER",
    "signatureMoves": [
      {
        "name": "Uranage",
        "category": "POWER",
        "source": "PPW_AUTHORED"
      },
      {
        "name": "Snap Saito Suplex",
        "category": "GRAPPLE",
        "source": "PPW_AUTHORED"
      }
    ],
    "finishingMoves": [
      {
        "name": "Blade Runner",
        "category": "GRAPPLE",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "John Silver",
    "gimmickArchetype": "BRUISER",
    "primaryStyle": "POWERHOUSE",
    "secondaryStyle": "BRAWLER",
    "signatureMoves": [
      {
        "name": "Spin Doctor",
        "category": "GRAPPLE",
        "source": "PPW_AUTHORED"
      },
      {
        "name": "German Suplex",
        "category": "GRAPPLE",
        "source": "PPW_AUTHORED"
      }
    ],
    "finishingMoves": [
      {
        "name": "Running Lariat",
        "category": "STRIKE",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "Kazuchika Okada",
    "gimmickArchetype": "ARROGANT_ACE",
    "primaryStyle": "ALL_ROUNDER",
    "secondaryStyle": "STRONG_STYLE",
    "signatureMoves": [
      {
        "name": "Dropkick",
        "category": "STRIKE",
        "source": "PPW_AUTHORED"
      },
      {
        "name": "Tombstone Piledriver",
        "category": "GRAPPLE",
        "source": "PPW_AUTHORED"
      }
    ],
    "finishingMoves": [
      {
        "name": "Rainmaker",
        "category": "STRIKE",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "Kenny Omega",
    "gimmickArchetype": "STRONG_STYLE_ACE",
    "primaryStyle": "ALL_ROUNDER",
    "secondaryStyle": "STRIKER",
    "signatureMoves": [
      {
        "name": "V-Trigger",
        "category": "STRIKE",
        "source": "PPW_AUTHORED"
      },
      {
        "name": "Snap Dragon Suplex",
        "category": "GRAPPLE",
        "source": "PPW_AUTHORED"
      }
    ],
    "finishingMoves": [
      {
        "name": "One Winged Angel",
        "category": "GRAPPLE",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "Kevin Knight",
    "gimmickArchetype": "HIGH_FLYING_DAREDEVIL",
    "primaryStyle": "HIGH_FLYER",
    "secondaryStyle": "ALL_ROUNDER",
    "signatureMoves": [
      {
        "name": "Springboard Crossbody",
        "category": "AERIAL",
        "source": "PPW_AUTHORED"
      },
      {
        "name": "Dropkick",
        "category": "STRIKE",
        "source": "PPW_AUTHORED"
      }
    ],
    "finishingMoves": [
      {
        "name": "UFO Splash",
        "category": "AERIAL",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "Konosuke Takeshita",
    "gimmickArchetype": "STRONG_STYLE_ACE",
    "primaryStyle": "ALL_ROUNDER",
    "secondaryStyle": "STRIKER",
    "signatureMoves": [
      {
        "name": "Blue Thunder Bomb",
        "category": "POWER",
        "source": "PPW_AUTHORED"
      },
      {
        "name": "German Suplex",
        "category": "GRAPPLE",
        "source": "PPW_AUTHORED"
      }
    ],
    "finishingMoves": [
      {
        "name": "Raging Fire",
        "category": "GRAPPLE",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "Lee Moriarty",
    "gimmickArchetype": "TECHNICAL_WIZARD",
    "primaryStyle": "SUBMISSION",
    "secondaryStyle": "ALL_ROUNDER",
    "signatureMoves": [
      {
        "name": "Hammerlock",
        "category": "SUBMISSION",
        "source": "PPW_AUTHORED"
      },
      {
        "name": "Armbar",
        "category": "SUBMISSION",
        "source": "PPW_AUTHORED"
      }
    ],
    "finishingMoves": [
      {
        "name": "Border City Stretch",
        "category": "SUBMISSION",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "Lio Rush",
    "gimmickArchetype": "HIGH_FLYING_DAREDEVIL",
    "primaryStyle": "HIGH_FLYER",
    "secondaryStyle": "STRIKER",
    "signatureMoves": [
      {
        "name": "Handspring Back Elbow",
        "category": "STRIKE",
        "source": "PPW_AUTHORED"
      },
      {
        "name": "Suicide Dive",
        "category": "AERIAL",
        "source": "PPW_AUTHORED"
      }
    ],
    "finishingMoves": [
      {
        "name": "Final Hour",
        "category": "AERIAL",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "Marq Quen",
    "gimmickArchetype": "HIGH_FLYING_DAREDEVIL",
    "primaryStyle": "HIGH_FLYER",
    "secondaryStyle": "ALL_ROUNDER",
    "signatureMoves": [
      {
        "name": "Shooting Star Press",
        "category": "AERIAL",
        "source": "PPW_AUTHORED"
      },
      {
        "name": "Springboard Cutter",
        "category": "GRAPPLE",
        "source": "PPW_AUTHORED"
      }
    ],
    "finishingMoves": [
      {
        "name": "450 Splash",
        "category": "AERIAL",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "Matthew Jackson",
    "gimmickArchetype": "SHOW_OFF",
    "primaryStyle": "HIGH_FLYER",
    "secondaryStyle": "STRIKER",
    "signatureMoves": [
      {
        "name": "Superkick",
        "category": "STRIKE",
        "source": "PPW_AUTHORED"
      },
      {
        "name": "Springboard Moonsault",
        "category": "AERIAL",
        "source": "PPW_AUTHORED"
      }
    ],
    "finishingMoves": [
      {
        "name": "More Bang For Your Buck",
        "category": "AERIAL",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "MJF",
    "gimmickArchetype": "ARROGANT_ACE",
    "primaryStyle": "TECHNICAL",
    "secondaryStyle": "BRAWLER",
    "signatureMoves": [
      {
        "name": "Kangaroo Kick",
        "category": "STRIKE",
        "source": "PPW_AUTHORED"
      },
      {
        "name": "Heat Seeker",
        "category": "GRAPPLE",
        "source": "PPW_AUTHORED"
      }
    ],
    "finishingMoves": [
      {
        "name": "Salt of the Earth",
        "category": "SUBMISSION",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "Alex Windsor",
    "gimmickArchetype": "BRUISER",
    "primaryStyle": "STRONG_STYLE",
    "secondaryStyle": "TECHNICAL",
    "signatureMoves": [
      {
        "name": "German Suplex",
        "category": "GRAPPLE",
        "source": "PPW_AUTHORED"
      },
      {
        "name": "Running Knee",
        "category": "STRIKE",
        "source": "PPW_AUTHORED"
      }
    ],
    "finishingMoves": [
      {
        "name": "Sharpshooter",
        "category": "SUBMISSION",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "Anna Jay",
    "gimmickArchetype": "REBEL",
    "primaryStyle": "ALL_ROUNDER",
    "secondaryStyle": "STRIKER",
    "signatureMoves": [
      {
        "name": "Backstabber",
        "category": "GRAPPLE",
        "source": "PPW_AUTHORED"
      },
      {
        "name": "Diving Crossbody",
        "category": "AERIAL",
        "source": "PPW_AUTHORED"
      }
    ],
    "finishingMoves": [
      {
        "name": "Queen Slayer",
        "category": "SUBMISSION",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "Athena",
    "gimmickArchetype": "DARK_ANTI_HERO",
    "primaryStyle": "HIGH_FLYER",
    "secondaryStyle": "STRIKER",
    "signatureMoves": [
      {
        "name": "Superkick",
        "category": "STRIKE",
        "source": "PPW_AUTHORED"
      },
      {
        "name": "Spinning Forearm",
        "category": "STRIKE",
        "source": "PPW_AUTHORED"
      }
    ],
    "finishingMoves": [
      {
        "name": "O-Face",
        "category": "AERIAL",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "Dani Luna",
    "gimmickArchetype": "POWERHOUSE",
    "primaryStyle": "POWERHOUSE",
    "secondaryStyle": "ALL_ROUNDER",
    "signatureMoves": [
      {
        "name": "German Suplex",
        "category": "GRAPPLE",
        "source": "PPW_AUTHORED"
      },
      {
        "name": "Lariat",
        "category": "STRIKE",
        "source": "PPW_AUTHORED"
      }
    ],
    "finishingMoves": [
      {
        "name": "Luna Landing",
        "category": "POWER",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "Diamante",
    "gimmickArchetype": "STREET_FIGHTER",
    "primaryStyle": "BRAWLER",
    "secondaryStyle": "STRIKER",
    "signatureMoves": [
      {
        "name": "German Suplex",
        "category": "GRAPPLE",
        "source": "PPW_AUTHORED"
      },
      {
        "name": "Dropkick",
        "category": "STRIKE",
        "source": "PPW_AUTHORED"
      }
    ],
    "finishingMoves": [
      {
        "name": "Crossbody Block",
        "category": "AERIAL",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "Emi Sakura",
    "gimmickArchetype": "VETERAN_MENTOR",
    "primaryStyle": "ALL_ROUNDER",
    "secondaryStyle": "POWERHOUSE",
    "signatureMoves": [
      {
        "name": "Chops",
        "category": "STRIKE",
        "source": "PPW_AUTHORED"
      },
      {
        "name": "Corner Crossbody",
        "category": "POWER",
        "source": "PPW_AUTHORED"
      }
    ],
    "finishingMoves": [
      {
        "name": "Queen's Gambit",
        "category": "GRAPPLE",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "Harley Cameron",
    "gimmickArchetype": "SHOWMAN",
    "primaryStyle": "ALL_ROUNDER",
    "secondaryStyle": "STRIKER",
    "signatureMoves": [
      {
        "name": "Backbreaker",
        "category": "POWER",
        "source": "PPW_AUTHORED"
      },
      {
        "name": "Pump Kick",
        "category": "STRIKE",
        "source": "PPW_AUTHORED"
      }
    ],
    "finishingMoves": [
      {
        "name": "Swinging Neckbreaker",
        "category": "GRAPPLE",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "Kamille",
    "gimmickArchetype": "BEAST",
    "primaryStyle": "POWERHOUSE",
    "secondaryStyle": "BRAWLER",
    "signatureMoves": [
      {
        "name": "Big Boot",
        "category": "STRIKE",
        "source": "PPW_AUTHORED"
      },
      {
        "name": "Spinebuster",
        "category": "POWER",
        "source": "PPW_AUTHORED"
      }
    ],
    "finishingMoves": [
      {
        "name": "Dominion",
        "category": "POWER",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "Kris Statlander",
    "gimmickArchetype": "POWERHOUSE",
    "primaryStyle": "ALL_ROUNDER",
    "secondaryStyle": "POWERHOUSE",
    "signatureMoves": [
      {
        "name": "Delayed Vertical Suplex",
        "category": "GRAPPLE",
        "source": "PPW_AUTHORED"
      },
      {
        "name": "Spinning Lariat",
        "category": "STRIKE",
        "source": "PPW_AUTHORED"
      }
    ],
    "finishingMoves": [
      {
        "name": "Night Fever",
        "category": "GRAPPLE",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "Marina Shafir",
    "gimmickArchetype": "MMA_CROSSOVER",
    "primaryStyle": "SUBMISSION",
    "secondaryStyle": "STRIKER",
    "signatureMoves": [
      {
        "name": "Judo Throw",
        "category": "GRAPPLE",
        "source": "PPW_AUTHORED"
      },
      {
        "name": "Roundhouse Kick",
        "category": "STRIKE",
        "source": "PPW_AUTHORED"
      }
    ],
    "finishingMoves": [
      {
        "name": "Mother's Milk",
        "category": "SUBMISSION",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "Megan Bayne",
    "gimmickArchetype": "BEAST",
    "primaryStyle": "POWERHOUSE",
    "secondaryStyle": "BRAWLER",
    "signatureMoves": [
      {
        "name": "Powerbomb",
        "category": "POWER",
        "source": "PPW_AUTHORED"
      },
      {
        "name": "Big Boot",
        "category": "STRIKE",
        "source": "PPW_AUTHORED"
      }
    ],
    "finishingMoves": [
      {
        "name": "Fate's Descent",
        "category": "POWER",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "Penelope Ford",
    "gimmickArchetype": "SHOW_OFF",
    "primaryStyle": "HIGH_FLYER",
    "secondaryStyle": "ALL_ROUNDER",
    "signatureMoves": [
      {
        "name": "Handspring Back Elbow",
        "category": "STRIKE",
        "source": "PPW_AUTHORED"
      },
      {
        "name": "Diving Crossbody",
        "category": "AERIAL",
        "source": "PPW_AUTHORED"
      }
    ],
    "finishingMoves": [
      {
        "name": "Muta Lock",
        "category": "SUBMISSION",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "Queen Aminata",
    "gimmickArchetype": "PRIZEFIGHTER",
    "primaryStyle": "STRIKER",
    "secondaryStyle": "BRAWLER",
    "signatureMoves": [
      {
        "name": "Running Hip Attack",
        "category": "STRIKE",
        "source": "PPW_AUTHORED"
      },
      {
        "name": "Headbutt",
        "category": "STRIKE",
        "source": "PPW_AUTHORED"
      }
    ],
    "finishingMoves": [
      {
        "name": "Air Raid Crash",
        "category": "GRAPPLE",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "Red Velvet",
    "gimmickArchetype": "HIGH_FLYING_DAREDEVIL",
    "primaryStyle": "HIGH_FLYER",
    "secondaryStyle": "STRIKER",
    "signatureMoves": [
      {
        "name": "Standing Moonsault",
        "category": "AERIAL",
        "source": "PPW_AUTHORED"
      },
      {
        "name": "Diving Crossbody",
        "category": "AERIAL",
        "source": "PPW_AUTHORED"
      }
    ],
    "finishingMoves": [
      {
        "name": "Final Slice",
        "category": "GRAPPLE",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "Ruby Soho",
    "gimmickArchetype": "REBEL",
    "primaryStyle": "BRAWLER",
    "secondaryStyle": "ALL_ROUNDER",
    "signatureMoves": [
      {
        "name": "Enzuigiri",
        "category": "STRIKE",
        "source": "PPW_AUTHORED"
      },
      {
        "name": "Suicide Dive",
        "category": "AERIAL",
        "source": "PPW_AUTHORED"
      }
    ],
    "finishingMoves": [
      {
        "name": "Destination Unknown",
        "category": "STRIKE",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "Toni Storm",
    "gimmickArchetype": "SHOWMAN",
    "primaryStyle": "ALL_ROUNDER",
    "secondaryStyle": "STRONG_STYLE",
    "signatureMoves": [
      {
        "name": "Hip Attack",
        "category": "STRIKE",
        "source": "PPW_AUTHORED"
      },
      {
        "name": "German Suplex",
        "category": "GRAPPLE",
        "source": "PPW_AUTHORED"
      }
    ],
    "finishingMoves": [
      {
        "name": "Storm Zero",
        "category": "GRAPPLE",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "Willow Nightingale",
    "gimmickArchetype": "FAN_FAVOURITE",
    "primaryStyle": "POWERHOUSE",
    "secondaryStyle": "ALL_ROUNDER",
    "signatureMoves": [
      {
        "name": "Pounce",
        "category": "STRIKE",
        "source": "PPW_AUTHORED"
      },
      {
        "name": "Spinebuster",
        "category": "POWER",
        "source": "PPW_AUTHORED"
      }
    ],
    "finishingMoves": [
      {
        "name": "Babe With The Powerbomb",
        "category": "POWER",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "Bad Dude Tito",
    "gimmickArchetype": "BRUISER",
    "primaryStyle": "POWERHOUSE",
    "secondaryStyle": "STRONG_STYLE",
    "signatureMoves": [
      {
        "name": "Lariat",
        "category": "STRIKE",
        "source": "PPW_AUTHORED"
      },
      {
        "name": "Samoan Drop",
        "category": "POWER",
        "source": "PPW_AUTHORED"
      }
    ],
    "finishingMoves": [
      {
        "name": "Blue Thunder Bomb",
        "category": "POWER",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "Callum Newman",
    "gimmickArchetype": "STRONG_STYLE_ACE",
    "primaryStyle": "HIGH_FLYER",
    "secondaryStyle": "STRIKER",
    "signatureMoves": [
      {
        "name": "Running Knee",
        "category": "STRIKE",
        "source": "PPW_AUTHORED"
      },
      {
        "name": "Springboard Dropkick",
        "category": "STRIKE",
        "source": "PPW_AUTHORED"
      }
    ],
    "finishingMoves": [
      {
        "name": "Prince's Curse",
        "category": "GRAPPLE",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "DOUKI",
    "gimmickArchetype": "REBEL_LUCHADOR",
    "primaryStyle": "HIGH_FLYER",
    "secondaryStyle": "SUBMISSION",
    "signatureMoves": [
      {
        "name": "Springboard Plancha",
        "category": "AERIAL",
        "source": "PPW_AUTHORED"
      },
      {
        "name": "Suplex de la Luna",
        "category": "GRAPPLE",
        "source": "PPW_AUTHORED"
      }
    ],
    "finishingMoves": [
      {
        "name": "Douki Chokey",
        "category": "SUBMISSION",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "Francesco Akira",
    "gimmickArchetype": "HIGH_FLYING_DAREDEVIL",
    "primaryStyle": "HIGH_FLYER",
    "secondaryStyle": "STRIKER",
    "signatureMoves": [
      {
        "name": "Diving Crossbody",
        "category": "AERIAL",
        "source": "PPW_AUTHORED"
      },
      {
        "name": "Springboard Kick",
        "category": "STRIKE",
        "source": "PPW_AUTHORED"
      }
    ],
    "finishingMoves": [
      {
        "name": "Fireball",
        "category": "STRIKE",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "Kosei Fujita",
    "gimmickArchetype": "STRONG_STYLE_ACE",
    "primaryStyle": "TECHNICAL",
    "secondaryStyle": "STRIKER",
    "signatureMoves": [
      {
        "name": "Bridging German Suplex",
        "category": "GRAPPLE",
        "source": "PPW_AUTHORED"
      },
      {
        "name": "Forearm Smash",
        "category": "STRIKE",
        "source": "PPW_AUTHORED"
      }
    ],
    "finishingMoves": [
      {
        "name": "Abandon Hope",
        "category": "GRAPPLE",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "Master Wato",
    "gimmickArchetype": "REBEL_LUCHADOR",
    "primaryStyle": "HIGH_FLYER",
    "secondaryStyle": "TECHNICAL",
    "signatureMoves": [
      {
        "name": "Recientemente",
        "category": "GRAPPLE",
        "source": "PPW_AUTHORED"
      },
      {
        "name": "Spinning Heel Kick",
        "category": "STRIKE",
        "source": "PPW_AUTHORED"
      }
    ],
    "finishingMoves": [
      {
        "name": "Tenzan Tombstone Driver",
        "category": "GRAPPLE",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "Mikey Nicholls",
    "gimmickArchetype": "BRUISER",
    "primaryStyle": "STRONG_STYLE",
    "secondaryStyle": "POWERHOUSE",
    "signatureMoves": [
      {
        "name": "Powerbomb",
        "category": "POWER",
        "source": "PPW_AUTHORED"
      },
      {
        "name": "Lariat",
        "category": "STRIKE",
        "source": "PPW_AUTHORED"
      }
    ],
    "finishingMoves": [
      {
        "name": "Mikey Bomb",
        "category": "POWER",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "Ryohei Oiwa",
    "gimmickArchetype": "SPORTING",
    "primaryStyle": "STRONG_STYLE",
    "secondaryStyle": "TECHNICAL",
    "signatureMoves": [
      {
        "name": "German Suplex",
        "category": "GRAPPLE",
        "source": "PPW_AUTHORED"
      },
      {
        "name": "Dropkick",
        "category": "STRIKE",
        "source": "PPW_AUTHORED"
      }
    ],
    "finishingMoves": [
      {
        "name": "The Grip",
        "category": "SUBMISSION",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "Ami Sohrei",
    "gimmickArchetype": "POWERHOUSE",
    "primaryStyle": "POWERHOUSE",
    "secondaryStyle": "STRONG_STYLE",
    "signatureMoves": [
      {
        "name": "Spinning Backfist",
        "category": "STRIKE",
        "source": "PPW_AUTHORED"
      },
      {
        "name": "Slam",
        "category": "POWER",
        "source": "PPW_AUTHORED"
      }
    ],
    "finishingMoves": [
      {
        "name": "Blue Thunder Bomb",
        "category": "POWER",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "Bozilla",
    "gimmickArchetype": "BEAST",
    "primaryStyle": "POWERHOUSE",
    "secondaryStyle": "BRAWLER",
    "signatureMoves": [
      {
        "name": "Powerbomb",
        "category": "POWER",
        "source": "PPW_AUTHORED"
      },
      {
        "name": "Chokeslam",
        "category": "POWER",
        "source": "PPW_AUTHORED"
      }
    ],
    "finishingMoves": [
      {
        "name": "German Suplex",
        "category": "GRAPPLE",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "Hanan",
    "gimmickArchetype": "FAN_FAVOURITE",
    "primaryStyle": "ALL_ROUNDER",
    "secondaryStyle": "TECHNICAL",
    "signatureMoves": [
      {
        "name": "Dropkick",
        "category": "STRIKE",
        "source": "PPW_AUTHORED"
      },
      {
        "name": "Back Suplex",
        "category": "GRAPPLE",
        "source": "PPW_AUTHORED"
      }
    ],
    "finishingMoves": [
      {
        "name": "Belly-to-Belly Suplex",
        "category": "GRAPPLE",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "Hazuki",
    "gimmickArchetype": "STRONG_STYLE_ACE",
    "primaryStyle": "HIGH_FLYER",
    "secondaryStyle": "STRIKER",
    "signatureMoves": [
      {
        "name": "Face Wash",
        "category": "STRIKE",
        "source": "PPW_AUTHORED"
      },
      {
        "name": "Suicide Dive",
        "category": "AERIAL",
        "source": "PPW_AUTHORED"
      }
    ],
    "finishingMoves": [
      {
        "name": "Hazukistral",
        "category": "GRAPPLE",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "Koguma",
    "gimmickArchetype": "COMEDY",
    "primaryStyle": "HIGH_FLYER",
    "secondaryStyle": "TECHNICAL",
    "signatureMoves": [
      {
        "name": "German Suplex Hold",
        "category": "GRAPPLE",
        "source": "PPW_AUTHORED"
      },
      {
        "name": "Diving Body Press",
        "category": "AERIAL",
        "source": "PPW_AUTHORED"
      }
    ],
    "finishingMoves": [
      {
        "name": "Koguma Yoshitanic",
        "category": "GRAPPLE",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "Maika",
    "gimmickArchetype": "POWERHOUSE",
    "primaryStyle": "POWERHOUSE",
    "secondaryStyle": "STRONG_STYLE",
    "signatureMoves": [
      {
        "name": "Lariat",
        "category": "STRIKE",
        "source": "PPW_AUTHORED"
      },
      {
        "name": "Saito Suplex",
        "category": "GRAPPLE",
        "source": "PPW_AUTHORED"
      }
    ],
    "finishingMoves": [
      {
        "name": "Michinoku Driver II",
        "category": "GRAPPLE",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "Momo Kohgo",
    "gimmickArchetype": "UNDERDOG",
    "primaryStyle": "HIGH_FLYER",
    "secondaryStyle": "TECHNICAL",
    "signatureMoves": [
      {
        "name": "Dropkick",
        "category": "STRIKE",
        "source": "PPW_AUTHORED"
      },
      {
        "name": "Diving Crossbody",
        "category": "AERIAL",
        "source": "PPW_AUTHORED"
      }
    ],
    "finishingMoves": [
      {
        "name": "Momo Clutch",
        "category": "GRAPPLE",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "Ranna Yagami",
    "gimmickArchetype": "MMA_CROSSOVER",
    "primaryStyle": "STRIKER",
    "secondaryStyle": "SUBMISSION",
    "signatureMoves": [
      {
        "name": "Soccer Kick",
        "category": "STRIKE",
        "source": "PPW_AUTHORED"
      },
      {
        "name": "Armbar",
        "category": "SUBMISSION",
        "source": "PPW_AUTHORED"
      }
    ],
    "finishingMoves": [
      {
        "name": "Zero Fighter Kick",
        "category": "STRIKE",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "Saori Anou",
    "gimmickArchetype": "SHOWMAN",
    "primaryStyle": "TECHNICAL",
    "secondaryStyle": "ALL_ROUNDER",
    "signatureMoves": [
      {
        "name": "German Suplex",
        "category": "GRAPPLE",
        "source": "PPW_AUTHORED"
      },
      {
        "name": "Diving Crossbody",
        "category": "AERIAL",
        "source": "PPW_AUTHORED"
      }
    ],
    "finishingMoves": [
      {
        "name": "Pottering",
        "category": "GRAPPLE",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "Saya Iida",
    "gimmickArchetype": "POWERHOUSE",
    "primaryStyle": "POWERHOUSE",
    "secondaryStyle": "TECHNICAL",
    "signatureMoves": [
      {
        "name": "Shoulder Tackle",
        "category": "STRIKE",
        "source": "PPW_AUTHORED"
      },
      {
        "name": "Knee Strike",
        "category": "STRIKE",
        "source": "PPW_AUTHORED"
      }
    ],
    "finishingMoves": [
      {
        "name": "Northern Lights Suplex",
        "category": "GRAPPLE",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "Suzu Suzuki",
    "gimmickArchetype": "REBEL",
    "primaryStyle": "STRONG_STYLE",
    "secondaryStyle": "BRAWLER",
    "signatureMoves": [
      {
        "name": "German Suplex",
        "category": "GRAPPLE",
        "source": "PPW_AUTHORED"
      },
      {
        "name": "Suicide Dive",
        "category": "AERIAL",
        "source": "PPW_AUTHORED"
      }
    ],
    "finishingMoves": [
      {
        "name": "Tequila Shot",
        "category": "GRAPPLE",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "Yuna Mizumori",
    "gimmickArchetype": "FAN_FAVOURITE",
    "primaryStyle": "POWERHOUSE",
    "secondaryStyle": "ALL_ROUNDER",
    "signatureMoves": [
      {
        "name": "Running Splash",
        "category": "POWER",
        "source": "PPW_AUTHORED"
      },
      {
        "name": "Spinning Lariat",
        "category": "STRIKE",
        "source": "PPW_AUTHORED"
      }
    ],
    "finishingMoves": [
      {
        "name": "Diving Body Press",
        "category": "AERIAL",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "Alisha Edwards",
    "gimmickArchetype": "OPPORTUNIST",
    "primaryStyle": "ALL_ROUNDER",
    "secondaryStyle": "BRAWLER",
    "signatureMoves": [
      {
        "name": "Running Clothesline",
        "category": "STRIKE",
        "source": "PPW_AUTHORED"
      },
      {
        "name": "Snap Suplex",
        "category": "GRAPPLE",
        "source": "PPW_AUTHORED"
      }
    ],
    "finishingMoves": [
      {
        "name": "DDT",
        "category": "GRAPPLE",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "Allie",
    "gimmickArchetype": "GOTHIC_ICON",
    "primaryStyle": "ALL_ROUNDER",
    "secondaryStyle": "BRAWLER",
    "signatureMoves": [
      {
        "name": "Superkick",
        "category": "STRIKE",
        "source": "PPW_AUTHORED"
      },
      {
        "name": "Flying Crossbody",
        "category": "AERIAL",
        "source": "PPW_AUTHORED"
      }
    ],
    "finishingMoves": [
      {
        "name": "Bunny Destroyer",
        "category": "GRAPPLE",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "Ash By Elegance",
    "gimmickArchetype": "SHOW_OFF",
    "primaryStyle": "ALL_ROUNDER",
    "secondaryStyle": "STRIKER",
    "signatureMoves": [
      {
        "name": "Knee Strike",
        "category": "STRIKE",
        "source": "PPW_AUTHORED"
      },
      {
        "name": "Running Neckbreaker",
        "category": "GRAPPLE",
        "source": "PPW_AUTHORED"
      }
    ],
    "finishingMoves": [
      {
        "name": "Rarified Air",
        "category": "AERIAL",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "Elayna Black",
    "gimmickArchetype": "GOTHIC_ICON",
    "primaryStyle": "TECHNICAL",
    "secondaryStyle": "SUBMISSION",
    "signatureMoves": [
      {
        "name": "Crossface",
        "category": "SUBMISSION",
        "source": "PPW_AUTHORED"
      },
      {
        "name": "Front Kick",
        "category": "STRIKE",
        "source": "PPW_AUTHORED"
      }
    ],
    "finishingMoves": [
      {
        "name": "Blackout",
        "category": "GRAPPLE",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "Heather By Elegance",
    "gimmickArchetype": "SHOW_OFF",
    "primaryStyle": "ALL_ROUNDER",
    "secondaryStyle": "STRIKER",
    "signatureMoves": [
      {
        "name": "Diving Crossbody",
        "category": "AERIAL",
        "source": "PPW_AUTHORED"
      },
      {
        "name": "Neckbreaker",
        "category": "GRAPPLE",
        "source": "PPW_AUTHORED"
      }
    ],
    "finishingMoves": [
      {
        "name": "Spinning Heel Kick",
        "category": "STRIKE",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "Kiera Hogan",
    "gimmickArchetype": "STREET_FIGHTER",
    "primaryStyle": "STRIKER",
    "secondaryStyle": "ALL_ROUNDER",
    "signatureMoves": [
      {
        "name": "Leg Drop",
        "category": "AERIAL",
        "source": "PPW_AUTHORED"
      },
      {
        "name": "Spinning Heel Kick",
        "category": "STRIKE",
        "source": "PPW_AUTHORED"
      }
    ],
    "finishingMoves": [
      {
        "name": "Face The Music",
        "category": "STRIKE",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "Tasha Steelz",
    "gimmickArchetype": "ARROGANT_ACE",
    "primaryStyle": "HIGH_FLYER",
    "secondaryStyle": "STRIKER",
    "signatureMoves": [
      {
        "name": "Suicide Dive",
        "category": "AERIAL",
        "source": "PPW_AUTHORED"
      },
      {
        "name": "Springboard Cutter",
        "category": "GRAPPLE",
        "source": "PPW_AUTHORED"
      }
    ],
    "finishingMoves": [
      {
        "name": "Black Out",
        "category": "GRAPPLE",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "Léi Yǐng Lee",
    "gimmickArchetype": "MMA_CROSSOVER",
    "primaryStyle": "STRIKER",
    "secondaryStyle": "TECHNICAL",
    "signatureMoves": [
      {
        "name": "Roundhouse Kick",
        "category": "STRIKE",
        "source": "PPW_AUTHORED"
      },
      {
        "name": "Running Knee",
        "category": "STRIKE",
        "source": "PPW_AUTHORED"
      }
    ],
    "finishingMoves": [
      {
        "name": "Dragon Kick",
        "category": "STRIKE",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "AMAKUSA",
    "gimmickArchetype": "MASKED_MYSTERY",
    "primaryStyle": "HIGH_FLYER",
    "secondaryStyle": "TECHNICAL",
    "signatureMoves": [
      {
        "name": "Diving Crossbody",
        "category": "AERIAL",
        "source": "PPW_AUTHORED"
      },
      {
        "name": "Superkick",
        "category": "STRIKE",
        "source": "PPW_AUTHORED"
      }
    ],
    "finishingMoves": [
      {
        "name": "Firebird Splash",
        "category": "AERIAL",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "BUSHI",
    "gimmickArchetype": "MASKED_MYSTERY",
    "primaryStyle": "LUCHA",
    "secondaryStyle": "HIGH_FLYER",
    "signatureMoves": [
      {
        "name": "Suicide Dive",
        "category": "AERIAL",
        "source": "PPW_AUTHORED"
      },
      {
        "name": "Missile Dropkick",
        "category": "STRIKE",
        "source": "PPW_AUTHORED"
      }
    ],
    "finishingMoves": [
      {
        "name": "MX",
        "category": "AERIAL",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "Doc Gallows",
    "gimmickArchetype": "GIANT",
    "primaryStyle": "POWERHOUSE",
    "secondaryStyle": "BRAWLER",
    "signatureMoves": [
      {
        "name": "Big Boot",
        "category": "STRIKE",
        "source": "PPW_AUTHORED"
      },
      {
        "name": "Chokeslam",
        "category": "POWER",
        "source": "PPW_AUTHORED"
      }
    ],
    "finishingMoves": [
      {
        "name": "Gallows Pole",
        "category": "GRAPPLE",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "Flip Gordon",
    "gimmickArchetype": "HIGH_FLYING_DAREDEVIL",
    "primaryStyle": "HIGH_FLYER",
    "secondaryStyle": "LUCHA",
    "signatureMoves": [
      {
        "name": "Springboard Moonsault",
        "category": "AERIAL",
        "source": "PPW_AUTHORED"
      },
      {
        "name": "Shooting Star Press",
        "category": "AERIAL",
        "source": "PPW_AUTHORED"
      }
    ],
    "finishingMoves": [
      {
        "name": "Star Spangled Stunner",
        "category": "GRAPPLE",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "La Parkita",
    "gimmickArchetype": "COMEDY",
    "primaryStyle": "LUCHA",
    "secondaryStyle": "HIGH_FLYER",
    "signatureMoves": [
      {
        "name": "Tilt-A-Whirl Headscissors",
        "category": "GRAPPLE",
        "source": "PPW_AUTHORED"
      },
      {
        "name": "Springboard Crossbody",
        "category": "AERIAL",
        "source": "PPW_AUTHORED"
      }
    ],
    "finishingMoves": [
      {
        "name": "Small Package",
        "category": "GRAPPLE",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "Pagano",
    "gimmickArchetype": "EXTREME_DAREDEVIL",
    "primaryStyle": "BRAWLER",
    "secondaryStyle": "LUCHA",
    "signatureMoves": [
      {
        "name": "Chair Assisted Dive",
        "category": "AERIAL",
        "source": "PPW_AUTHORED"
      },
      {
        "name": "Suicide Dive",
        "category": "AERIAL",
        "source": "PPW_AUTHORED"
      }
    ],
    "finishingMoves": [
      {
        "name": "Death Valley Driver",
        "category": "POWER",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "Super Crazy",
    "gimmickArchetype": "EXTREME_DAREDEVIL",
    "primaryStyle": "LUCHA",
    "secondaryStyle": "HIGH_FLYER",
    "signatureMoves": [
      {
        "name": "Asai Moonsault",
        "category": "AERIAL",
        "source": "PPW_AUTHORED"
      },
      {
        "name": "Top Rope Hurricanrana",
        "category": "GRAPPLE",
        "source": "PPW_AUTHORED"
      }
    ],
    "finishingMoves": [
      {
        "name": "Triple Moonsault",
        "category": "AERIAL",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "Titán",
    "gimmickArchetype": "HIGH_FLYING_DAREDEVIL",
    "primaryStyle": "LUCHA",
    "secondaryStyle": "HIGH_FLYER",
    "signatureMoves": [
      {
        "name": "Tope Con Giro",
        "category": "AERIAL",
        "source": "PPW_AUTHORED"
      },
      {
        "name": "Springboard Headscissors",
        "category": "GRAPPLE",
        "source": "PPW_AUTHORED"
      }
    ],
    "finishingMoves": [
      {
        "name": "Diving Double Stomp",
        "category": "AERIAL",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "Volador Jr.",
    "gimmickArchetype": "REBEL_LUCHADOR",
    "primaryStyle": "LUCHA",
    "secondaryStyle": "HIGH_FLYER",
    "signatureMoves": [
      {
        "name": "Tope Suicida",
        "category": "AERIAL",
        "source": "PPW_AUTHORED"
      },
      {
        "name": "Springboard Moonsault",
        "category": "AERIAL",
        "source": "PPW_AUTHORED"
      }
    ],
    "finishingMoves": [
      {
        "name": "Spanish Fly",
        "category": "GRAPPLE",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "Austin Aries",
    "gimmickArchetype": "ARROGANT_ACE",
    "primaryStyle": "ALL_ROUNDER",
    "secondaryStyle": "SUBMISSION",
    "signatureMoves": [
      {
        "name": "Discus Fivearm",
        "category": "STRIKE",
        "source": "PPW_AUTHORED"
      },
      {
        "name": "Brainbuster",
        "category": "GRAPPLE",
        "source": "PPW_AUTHORED"
      }
    ],
    "finishingMoves": [
      {
        "name": "Last Chancery",
        "category": "SUBMISSION",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "Axel Tischer",
    "gimmickArchetype": "STRONG_STYLE_ACE",
    "primaryStyle": "STRONG_STYLE",
    "secondaryStyle": "TECHNICAL",
    "signatureMoves": [
      {
        "name": "German Suplex",
        "category": "GRAPPLE",
        "source": "PPW_AUTHORED"
      },
      {
        "name": "Knee Strike",
        "category": "STRIKE",
        "source": "PPW_AUTHORED"
      }
    ],
    "finishingMoves": [
      {
        "name": "Sit-out Powerbomb",
        "category": "POWER",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "Cara Noir",
    "gimmickArchetype": "GOTHIC_ICON",
    "primaryStyle": "TECHNICAL",
    "secondaryStyle": "STRIKER",
    "signatureMoves": [
      {
        "name": "Spinning Heel Kick",
        "category": "STRIKE",
        "source": "PPW_AUTHORED"
      },
      {
        "name": "European Uppercut",
        "category": "STRIKE",
        "source": "PPW_AUTHORED"
      }
    ],
    "finishingMoves": [
      {
        "name": "Black Swan",
        "category": "GRAPPLE",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "Killer Kross",
    "gimmickArchetype": "DARK_ANTI_HERO",
    "primaryStyle": "POWERHOUSE",
    "secondaryStyle": "SUBMISSION",
    "signatureMoves": [
      {
        "name": "Saito Suplex",
        "category": "GRAPPLE",
        "source": "PPW_AUTHORED"
      },
      {
        "name": "Do Svidaniya",
        "category": "STRIKE",
        "source": "PPW_AUTHORED"
      }
    ],
    "finishingMoves": [
      {
        "name": "Kross Jacket",
        "category": "SUBMISSION",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "Mark Haskins",
    "gimmickArchetype": "TECHNICAL_WIZARD",
    "primaryStyle": "SUBMISSION",
    "secondaryStyle": "STRIKER",
    "signatureMoves": [
      {
        "name": "Superkick",
        "category": "STRIKE",
        "source": "PPW_AUTHORED"
      },
      {
        "name": "Shooting Star Press",
        "category": "AERIAL",
        "source": "PPW_AUTHORED"
      }
    ],
    "finishingMoves": [
      {
        "name": "Sharpshooter",
        "category": "SUBMISSION",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "Michael Nakazawa",
    "gimmickArchetype": "COMEDY",
    "primaryStyle": "ALL_ROUNDER",
    "secondaryStyle": "BRAWLER",
    "signatureMoves": [
      {
        "name": "Diving Crossbody",
        "category": "AERIAL",
        "source": "PPW_AUTHORED"
      },
      {
        "name": "Back Suplex",
        "category": "GRAPPLE",
        "source": "PPW_AUTHORED"
      }
    ],
    "finishingMoves": [
      {
        "name": "Diving Elbow Drop",
        "category": "AERIAL",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "Nigel McGuinness",
    "gimmickArchetype": "VETERAN_MENTOR",
    "primaryStyle": "STRONG_STYLE",
    "secondaryStyle": "TECHNICAL",
    "signatureMoves": [
      {
        "name": "Tower of London",
        "category": "GRAPPLE",
        "source": "PPW_AUTHORED"
      },
      {
        "name": "Jawbreaker Lariat",
        "category": "STRIKE",
        "source": "PPW_AUTHORED"
      }
    ],
    "finishingMoves": [
      {
        "name": "London Dungeon",
        "category": "SUBMISSION",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "Ortiz",
    "gimmickArchetype": "STREET_FIGHTER",
    "primaryStyle": "BRAWLER",
    "secondaryStyle": "ALL_ROUNDER",
    "signatureMoves": [
      {
        "name": "Running Cannonball",
        "category": "POWER",
        "source": "PPW_AUTHORED"
      },
      {
        "name": "German Suplex",
        "category": "GRAPPLE",
        "source": "PPW_AUTHORED"
      }
    ],
    "finishingMoves": [
      {
        "name": "Sit-out Powerbomb",
        "category": "POWER",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "Shoko Nakajima",
    "gimmickArchetype": "HIGH_FLYING_DAREDEVIL",
    "primaryStyle": "HIGH_FLYER",
    "secondaryStyle": "LUCHA",
    "signatureMoves": [
      {
        "name": "Suicide Dive",
        "category": "AERIAL",
        "source": "PPW_AUTHORED"
      },
      {
        "name": "Springboard Moonsault",
        "category": "AERIAL",
        "source": "PPW_AUTHORED"
      }
    ],
    "finishingMoves": [
      {
        "name": "Northern Lights Suplex",
        "category": "GRAPPLE",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "Steve Maclin",
    "gimmickArchetype": "PRIZEFIGHTER",
    "primaryStyle": "BRAWLER",
    "secondaryStyle": "STRONG_STYLE",
    "signatureMoves": [
      {
        "name": "Suicide Dive",
        "category": "AERIAL",
        "source": "PPW_AUTHORED"
      },
      {
        "name": "Running Knee",
        "category": "STRIKE",
        "source": "PPW_AUTHORED"
      }
    ],
    "finishingMoves": [
      {
        "name": "KIA",
        "category": "GRAPPLE",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "Tyler Breeze",
    "gimmickArchetype": "SHOW_OFF",
    "primaryStyle": "ALL_ROUNDER",
    "secondaryStyle": "STRIKER",
    "signatureMoves": [
      {
        "name": "Beauty Shot",
        "category": "STRIKE",
        "source": "PPW_AUTHORED"
      },
      {
        "name": "Supermodel Kick",
        "category": "STRIKE",
        "source": "PPW_AUTHORED"
      }
    ],
    "finishingMoves": [
      {
        "name": "Unprettier",
        "category": "GRAPPLE",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "YOH",
    "gimmickArchetype": "HIGH_FLYING_DAREDEVIL",
    "primaryStyle": "HIGH_FLYER",
    "secondaryStyle": "TECHNICAL",
    "signatureMoves": [
      {
        "name": "Dropkick",
        "category": "STRIKE",
        "source": "PPW_AUTHORED"
      },
      {
        "name": "Springboard Crossbody",
        "category": "AERIAL",
        "source": "PPW_AUTHORED"
      }
    ],
    "finishingMoves": [
      {
        "name": "Direct Drive",
        "category": "GRAPPLE",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "YOSHI-HASHI",
    "gimmickArchetype": "UNDERDOG",
    "primaryStyle": "STRONG_STYLE",
    "secondaryStyle": "ALL_ROUNDER",
    "signatureMoves": [
      {
        "name": "Head Hunter",
        "category": "STRIKE",
        "source": "PPW_AUTHORED"
      },
      {
        "name": "Lariat",
        "category": "STRIKE",
        "source": "PPW_AUTHORED"
      }
    ],
    "finishingMoves": [
      {
        "name": "Karma",
        "category": "GRAPPLE",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "Yuki Ueno",
    "gimmickArchetype": "SHOWMAN",
    "primaryStyle": "HIGH_FLYER",
    "secondaryStyle": "ALL_ROUNDER",
    "signatureMoves": [
      {
        "name": "Diving Moonsault",
        "category": "AERIAL",
        "source": "PPW_AUTHORED"
      },
      {
        "name": "Dropkick",
        "category": "STRIKE",
        "source": "PPW_AUTHORED"
      }
    ],
    "finishingMoves": [
      {
        "name": "WR",
        "category": "GRAPPLE",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "Olympia",
    "gimmickArchetype": "POWERHOUSE",
    "primaryStyle": "POWERHOUSE",
    "secondaryStyle": "BRAWLER",
    "signatureMoves": [
      {
        "name": "Overhead Suplex",
        "category": "GRAPPLE",
        "source": "PPW_AUTHORED"
      },
      {
        "name": "Spinning Slam",
        "category": "POWER",
        "source": "PPW_AUTHORED"
      }
    ],
    "finishingMoves": [
      {
        "name": "Powerbomb",
        "category": "POWER",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "Zeuxis",
    "gimmickArchetype": "DARK_ANTI_HERO",
    "primaryStyle": "LUCHA",
    "secondaryStyle": "STRIKER",
    "signatureMoves": [
      {
        "name": "Spinning Back Kick",
        "category": "STRIKE",
        "source": "PPW_AUTHORED"
      },
      {
        "name": "Rope Assisted Arm Drag",
        "category": "GRAPPLE",
        "source": "PPW_AUTHORED"
      }
    ],
    "finishingMoves": [
      {
        "name": "La Rueca",
        "category": "SUBMISSION",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "Dark Silueta",
    "gimmickArchetype": "DARK_ANTI_HERO",
    "primaryStyle": "LUCHA",
    "secondaryStyle": "STRIKER",
    "signatureMoves": [
      {
        "name": "Tope Suicida",
        "category": "AERIAL",
        "source": "PPW_AUTHORED"
      },
      {
        "name": "Spinning Heel Kick",
        "category": "STRIKE",
        "source": "PPW_AUTHORED"
      }
    ],
    "finishingMoves": [
      {
        "name": "Backbreaker",
        "category": "POWER",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "Reyna Isis",
    "gimmickArchetype": "SHOW_OFF",
    "primaryStyle": "LUCHA",
    "secondaryStyle": "ALL_ROUNDER",
    "signatureMoves": [
      {
        "name": "Diving Hurricanrana",
        "category": "GRAPPLE",
        "source": "PPW_AUTHORED"
      },
      {
        "name": "Spinning Kick",
        "category": "STRIKE",
        "source": "PPW_AUTHORED"
      }
    ],
    "finishingMoves": [
      {
        "name": "Bridging Suplex",
        "category": "GRAPPLE",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "Keyra",
    "gimmickArchetype": "REBEL",
    "primaryStyle": "LUCHA",
    "secondaryStyle": "HIGH_FLYER",
    "signatureMoves": [
      {
        "name": "Springboard Cutter",
        "category": "GRAPPLE",
        "source": "PPW_AUTHORED"
      },
      {
        "name": "Suicide Dive",
        "category": "AERIAL",
        "source": "PPW_AUTHORED"
      }
    ],
    "finishingMoves": [
      {
        "name": "Diving Double Stomp",
        "category": "AERIAL",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "Hera",
    "gimmickArchetype": "FAMILY_DYNASTY",
    "primaryStyle": "LUCHA",
    "secondaryStyle": "TECHNICAL",
    "signatureMoves": [
      {
        "name": "La Magistral",
        "category": "GRAPPLE",
        "source": "PPW_AUTHORED"
      },
      {
        "name": "Arm Drag",
        "category": "GRAPPLE",
        "source": "PPW_AUTHORED"
      }
    ],
    "finishingMoves": [
      {
        "name": "La Casita",
        "category": "GRAPPLE",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "Sanely",
    "gimmickArchetype": "MASKED_MYSTERY",
    "primaryStyle": "LUCHA",
    "secondaryStyle": "TECHNICAL",
    "signatureMoves": [
      {
        "name": "Tilt-A-Whirl Backbreaker",
        "category": "POWER",
        "source": "PPW_AUTHORED"
      },
      {
        "name": "Tope Suicida",
        "category": "AERIAL",
        "source": "PPW_AUTHORED"
      }
    ],
    "finishingMoves": [
      {
        "name": "La Casita",
        "category": "GRAPPLE",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "Princesa Sugehit",
    "gimmickArchetype": "VETERAN_MENTOR",
    "primaryStyle": "LUCHA",
    "secondaryStyle": "TECHNICAL",
    "signatureMoves": [
      {
        "name": "La Magistral",
        "category": "GRAPPLE",
        "source": "PPW_AUTHORED"
      },
      {
        "name": "Standing Dropkick",
        "category": "STRIKE",
        "source": "PPW_AUTHORED"
      }
    ],
    "finishingMoves": [
      {
        "name": "Fujiwara Armbar",
        "category": "SUBMISSION",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "Metálica",
    "gimmickArchetype": "MASKED_MYSTERY",
    "primaryStyle": "LUCHA",
    "secondaryStyle": "HIGH_FLYER",
    "signatureMoves": [
      {
        "name": "Springboard Crossbody",
        "category": "AERIAL",
        "source": "PPW_AUTHORED"
      },
      {
        "name": "Spinning Headscissors",
        "category": "GRAPPLE",
        "source": "PPW_AUTHORED"
      }
    ],
    "finishingMoves": [
      {
        "name": "Diving Splash",
        "category": "AERIAL",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "Lluvia",
    "gimmickArchetype": "FAMILY_DYNASTY",
    "primaryStyle": "LUCHA",
    "secondaryStyle": "HIGH_FLYER",
    "signatureMoves": [
      {
        "name": "La Casita",
        "category": "GRAPPLE",
        "source": "PPW_AUTHORED"
      },
      {
        "name": "Springboard Plancha",
        "category": "AERIAL",
        "source": "PPW_AUTHORED"
      }
    ],
    "finishingMoves": [
      {
        "name": "Moonsault",
        "category": "AERIAL",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "India Sioux",
    "gimmickArchetype": "FAMILY_DYNASTY",
    "primaryStyle": "LUCHA",
    "secondaryStyle": "TECHNICAL",
    "signatureMoves": [
      {
        "name": "La Magistral",
        "category": "GRAPPLE",
        "source": "PPW_AUTHORED"
      },
      {
        "name": "Arm Drag",
        "category": "GRAPPLE",
        "source": "PPW_AUTHORED"
      }
    ],
    "finishingMoves": [
      {
        "name": "Diving Crossbody",
        "category": "AERIAL",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "La Catalina",
    "gimmickArchetype": "SHOWMAN",
    "primaryStyle": "LUCHA",
    "secondaryStyle": "ALL_ROUNDER",
    "signatureMoves": [
      {
        "name": "Springboard Crossbody",
        "category": "AERIAL",
        "source": "PPW_AUTHORED"
      },
      {
        "name": "Corner Dropkick",
        "category": "STRIKE",
        "source": "PPW_AUTHORED"
      }
    ],
    "finishingMoves": [
      {
        "name": "Moonsault",
        "category": "AERIAL",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "Lady Shani",
    "gimmickArchetype": "MASKED_AVENGER",
    "primaryStyle": "LUCHA",
    "secondaryStyle": "STRIKER",
    "signatureMoves": [
      {
        "name": "Roundhouse Kick",
        "category": "STRIKE",
        "source": "PPW_AUTHORED"
      },
      {
        "name": "Tilt-A-Whirl Arm Drag",
        "category": "GRAPPLE",
        "source": "PPW_AUTHORED"
      }
    ],
    "finishingMoves": [
      {
        "name": "Running Knee",
        "category": "STRIKE",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "Flammer",
    "gimmickArchetype": "DARK_ANTI_HERO",
    "primaryStyle": "LUCHA",
    "secondaryStyle": "BRAWLER",
    "signatureMoves": [
      {
        "name": "Tope Suicida",
        "category": "AERIAL",
        "source": "PPW_AUTHORED"
      },
      {
        "name": "Backbreaker",
        "category": "POWER",
        "source": "PPW_AUTHORED"
      }
    ],
    "finishingMoves": [
      {
        "name": "Powerbomb",
        "category": "POWER",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "La Hiedra",
    "gimmickArchetype": "DARK_ANTI_HERO",
    "primaryStyle": "LUCHA",
    "secondaryStyle": "HIGH_FLYER",
    "signatureMoves": [
      {
        "name": "Spinning Back Kick",
        "category": "STRIKE",
        "source": "PPW_AUTHORED"
      },
      {
        "name": "Springboard Crossbody",
        "category": "AERIAL",
        "source": "PPW_AUTHORED"
      }
    ],
    "finishingMoves": [
      {
        "name": "Sunset Flip Powerbomb",
        "category": "POWER",
        "source": "PPW_AUTHORED"
      }
    ]
  }
];
