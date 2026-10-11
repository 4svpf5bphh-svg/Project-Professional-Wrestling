/**
 * PPW editorial review — wave 4, 11 October 2026.
 * Corrects conspicuous archetype/style mismatches and replaces synthetic
 * surname-based moves with distinctive wrestling repertoire where known.
 *
 * All moves here deliberately remain PPW_AUTHORED (editorial candidates),
 * NOT independently verified facts. The separately sourced real-wrestler
 * catalogue still takes precedence during new-World creation. This file does
 * not rewrite identities in existing Worlds or grant new in-game abilities.
 *
 * Reference checks for representative repertoire:
 * - Joe Hendry: https://www.wwe.com/superstars/joe-hendry
 * - Dax Harwood: https://www.cagematch.net/?id=2&nr=12068
 * - Orange Cassidy: https://www.allelitewrestling.com/post/aew-dynamite-results-for-october-12-2022
 * - Cedric Alexander: https://tnawrestling.com/news/tna-thursday-night-impact-on-amc-results-july-16-2026
 * - Swerve Strickland: https://shopaew.com/en-uk/products/swerve-strickland-house-call
 * Remaining entries are provisional: move spellings, era alignment and
 * independent provenance still need a roster-wide editorial audit.
 */
import type { PortableIdentityMove } from "../../domain/src/wrestler-identity.js";
export interface ReviewedRosterIdentity {
  name: string;
  gimmickArchetype: string;
  primaryStyle: string;
  secondaryStyle: string | null;
  signatureMoves: PortableIdentityMove[];
  finishingMoves: PortableIdentityMove[];
}
export const REVIEWED_REAL_ROSTER_IDENTITIES_WAVE4: readonly ReviewedRosterIdentity[] = [
  {
    "name": "CM Punk",
    "gimmickArchetype": "REBEL",
    "primaryStyle": "STRIKER",
    "secondaryStyle": "TECHNICAL",
    "signatureMoves": [
      {
        "name": "Running High Knee",
        "category": "STRIKE",
        "source": "PPW_AUTHORED"
      },
      {
        "name": "Anaconda Vise",
        "category": "SUBMISSION",
        "source": "PPW_AUTHORED"
      }
    ],
    "finishingMoves": [
      {
        "name": "Go to Sleep",
        "category": "STRIKE",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "Finn Bálor",
    "gimmickArchetype": "DARK_ANTI_HERO",
    "primaryStyle": "HIGH_FLYER",
    "secondaryStyle": "STRIKER",
    "signatureMoves": [
      {
        "name": "Sling Blade",
        "category": "GRAPPLE",
        "source": "PPW_AUTHORED"
      },
      {
        "name": "Shotgun Dropkick",
        "category": "STRIKE",
        "source": "PPW_AUTHORED"
      }
    ],
    "finishingMoves": [
      {
        "name": "Coup de Grâce",
        "category": "AERIAL",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "Gunther",
    "gimmickArchetype": "RING_GENERAL",
    "primaryStyle": "STRONG_STYLE",
    "secondaryStyle": "POWERHOUSE",
    "signatureMoves": [
      {
        "name": "Knife-edge Chop",
        "category": "STRIKE",
        "source": "PPW_AUTHORED"
      },
      {
        "name": "Sleeper Hold",
        "category": "SUBMISSION",
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
    "name": "Ivar",
    "gimmickArchetype": "BRUISER",
    "primaryStyle": "POWERHOUSE",
    "secondaryStyle": "HIGH_FLYER",
    "signatureMoves": [
      {
        "name": "Cartwheel Lariat",
        "category": "STRIKE",
        "source": "PPW_AUTHORED"
      },
      {
        "name": "Diving Splash",
        "category": "AERIAL",
        "source": "PPW_AUTHORED"
      }
    ],
    "finishingMoves": [
      {
        "name": "Doomsault",
        "category": "AERIAL",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "Joe Hendry",
    "gimmickArchetype": "SHOWMAN",
    "primaryStyle": "POWERHOUSE",
    "secondaryStyle": "ALL_ROUNDER",
    "signatureMoves": [
      {
        "name": "Fallaway Slam",
        "category": "POWER",
        "source": "PPW_AUTHORED"
      },
      {
        "name": "Olympic Slam",
        "category": "GRAPPLE",
        "source": "PPW_AUTHORED"
      }
    ],
    "finishingMoves": [
      {
        "name": "Standing Ovation",
        "category": "GRAPPLE",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "LA Knight",
    "gimmickArchetype": "SHOWMAN",
    "primaryStyle": "ALL_ROUNDER",
    "secondaryStyle": "BRAWLER",
    "signatureMoves": [
      {
        "name": "Jumping Elbow Drop",
        "category": "AERIAL",
        "source": "PPW_AUTHORED"
      },
      {
        "name": "Powerslam",
        "category": "POWER",
        "source": "PPW_AUTHORED"
      }
    ],
    "finishingMoves": [
      {
        "name": "BFT",
        "category": "GRAPPLE",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "Montez Ford",
    "gimmickArchetype": "HIGH_FLYING_DAREDEVIL",
    "primaryStyle": "HIGH_FLYER",
    "secondaryStyle": "ALL_ROUNDER",
    "signatureMoves": [
      {
        "name": "Diving Crossbody",
        "category": "AERIAL",
        "source": "PPW_AUTHORED"
      },
      {
        "name": "Spinning Enzuigiri",
        "category": "STRIKE",
        "source": "PPW_AUTHORED"
      }
    ],
    "finishingMoves": [
      {
        "name": "From the Heavens",
        "category": "AERIAL",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "The Miz",
    "gimmickArchetype": "ARROGANT_ACE",
    "primaryStyle": "ALL_ROUNDER",
    "secondaryStyle": "TECHNICAL",
    "signatureMoves": [
      {
        "name": "Awesome Clothesline",
        "category": "STRIKE",
        "source": "PPW_AUTHORED"
      },
      {
        "name": "Diving Double Axe Handle",
        "category": "AERIAL",
        "source": "PPW_AUTHORED"
      }
    ],
    "finishingMoves": [
      {
        "name": "Skull-Crushing Finale",
        "category": "GRAPPLE",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "Noam Dar",
    "gimmickArchetype": "TECHNICAL_WIZARD",
    "primaryStyle": "TECHNICAL",
    "secondaryStyle": "STRIKER",
    "signatureMoves": [
      {
        "name": "Nova Roller",
        "category": "STRIKE",
        "source": "PPW_AUTHORED"
      },
      {
        "name": "Kneebar",
        "category": "SUBMISSION",
        "source": "PPW_AUTHORED"
      }
    ],
    "finishingMoves": [
      {
        "name": "Champagne Superkneebar",
        "category": "SUBMISSION",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "Baron Corbin",
    "gimmickArchetype": "TOUGH_GUY",
    "primaryStyle": "POWERHOUSE",
    "secondaryStyle": "BRAWLER",
    "signatureMoves": [
      {
        "name": "Deep Six",
        "category": "POWER",
        "source": "PPW_AUTHORED"
      },
      {
        "name": "Chokeslam Backbreaker",
        "category": "POWER",
        "source": "PPW_AUTHORED"
      }
    ],
    "finishingMoves": [
      {
        "name": "End of Days",
        "category": "GRAPPLE",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "Alex Shelley",
    "gimmickArchetype": "TECHNICAL_WIZARD",
    "primaryStyle": "TECHNICAL",
    "secondaryStyle": "SUBMISSION",
    "signatureMoves": [
      {
        "name": "Sliced Bread",
        "category": "GRAPPLE",
        "source": "PPW_AUTHORED"
      },
      {
        "name": "Border City Stretch",
        "category": "SUBMISSION",
        "source": "PPW_AUTHORED"
      }
    ],
    "finishingMoves": [
      {
        "name": "Shellshock",
        "category": "GRAPPLE",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "Angélico",
    "gimmickArchetype": "TECHNICAL_WIZARD",
    "primaryStyle": "SUBMISSION",
    "secondaryStyle": "LUCHA",
    "signatureMoves": [
      {
        "name": "Lucha Arm Drag",
        "category": "GRAPPLE",
        "source": "PPW_AUTHORED"
      },
      {
        "name": "Rolling Kneebar",
        "category": "SUBMISSION",
        "source": "PPW_AUTHORED"
      }
    ],
    "finishingMoves": [
      {
        "name": "Navarro Death Roll",
        "category": "SUBMISSION",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "AR Fox",
    "gimmickArchetype": "HIGH_FLYING_DAREDEVIL",
    "primaryStyle": "HIGH_FLYER",
    "secondaryStyle": "LUCHA",
    "signatureMoves": [
      {
        "name": "Lo Mein Pain",
        "category": "AERIAL",
        "source": "PPW_AUTHORED"
      },
      {
        "name": "450 Splash",
        "category": "AERIAL",
        "source": "PPW_AUTHORED"
      }
    ],
    "finishingMoves": [
      {
        "name": "Foxcatcher",
        "category": "GRAPPLE",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "Anthony Bowens",
    "gimmickArchetype": "SHOWMAN",
    "primaryStyle": "ALL_ROUNDER",
    "secondaryStyle": "POWERHOUSE",
    "signatureMoves": [
      {
        "name": "Scissor Me Timbers",
        "category": "GRAPPLE",
        "source": "PPW_AUTHORED"
      },
      {
        "name": "Rolling Elbow",
        "category": "STRIKE",
        "source": "PPW_AUTHORED"
      }
    ],
    "finishingMoves": [
      {
        "name": "Arrival",
        "category": "GRAPPLE",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "Blake Christian",
    "gimmickArchetype": "HIGH_FLYING_DAREDEVIL",
    "primaryStyle": "HIGH_FLYER",
    "secondaryStyle": "STRIKER",
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
        "name": "450 Splash",
        "category": "AERIAL",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "Brandon Cutler",
    "gimmickArchetype": "COMEDY",
    "primaryStyle": "ALL_ROUNDER",
    "secondaryStyle": "HIGH_FLYER",
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
        "name": "Leaping Elbow Drop",
        "category": "AERIAL",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "Chris Jericho",
    "gimmickArchetype": "ROCK_STAR",
    "primaryStyle": "ALL_ROUNDER",
    "secondaryStyle": "TECHNICAL",
    "signatureMoves": [
      {
        "name": "Codebreaker",
        "category": "STRIKE",
        "source": "PPW_AUTHORED"
      },
      {
        "name": "Walls of Jericho",
        "category": "SUBMISSION",
        "source": "PPW_AUTHORED"
      }
    ],
    "finishingMoves": [
      {
        "name": "Judas Effect",
        "category": "STRIKE",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "Colt Cabana",
    "gimmickArchetype": "COMEDY",
    "primaryStyle": "ALL_ROUNDER",
    "secondaryStyle": "BRAWLER",
    "signatureMoves": [
      {
        "name": "Flying Apple",
        "category": "STRIKE",
        "source": "PPW_AUTHORED"
      },
      {
        "name": "Bionic Elbow",
        "category": "STRIKE",
        "source": "PPW_AUTHORED"
      }
    ],
    "finishingMoves": [
      {
        "name": "Chicago Skyline",
        "category": "GRAPPLE",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "Cash Wheeler",
    "gimmickArchetype": "RING_GENERAL",
    "primaryStyle": "ALL_ROUNDER",
    "secondaryStyle": "BRAWLER",
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
        "name": "Gory Bomb",
        "category": "POWER",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "Dax Harwood",
    "gimmickArchetype": "RING_GENERAL",
    "primaryStyle": "ALL_ROUNDER",
    "secondaryStyle": "BRAWLER",
    "signatureMoves": [
      {
        "name": "DDT",
        "category": "GRAPPLE",
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
        "name": "Sheer Drop Brainbuster",
        "category": "GRAPPLE",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "Dante Martin",
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
        "name": "Double Springboard Crossbody",
        "category": "AERIAL",
        "source": "PPW_AUTHORED"
      }
    ],
    "finishingMoves": [
      {
        "name": "Nosedive",
        "category": "AERIAL",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "Darby Allin",
    "gimmickArchetype": "EXTREME_DAREDEVIL",
    "primaryStyle": "HIGH_FLYER",
    "secondaryStyle": "BRAWLER",
    "signatureMoves": [
      {
        "name": "Suicide Dive",
        "category": "AERIAL",
        "source": "PPW_AUTHORED"
      },
      {
        "name": "Last Supper",
        "category": "GRAPPLE",
        "source": "PPW_AUTHORED"
      }
    ],
    "finishingMoves": [
      {
        "name": "Coffin Drop",
        "category": "AERIAL",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "\"Hangman\" Adam Page",
    "gimmickArchetype": "OUTLAW",
    "primaryStyle": "ALL_ROUNDER",
    "secondaryStyle": "BRAWLER",
    "signatureMoves": [
      {
        "name": "Dead Eye",
        "category": "GRAPPLE",
        "source": "PPW_AUTHORED"
      },
      {
        "name": "Moonsault",
        "category": "AERIAL",
        "source": "PPW_AUTHORED"
      }
    ],
    "finishingMoves": [
      {
        "name": "Buckshot Lariat",
        "category": "STRIKE",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "Hologram",
    "gimmickArchetype": "MASKED_MYSTERY",
    "primaryStyle": "LUCHA",
    "secondaryStyle": "HIGH_FLYER",
    "signatureMoves": [
      {
        "name": "Tornillo",
        "category": "AERIAL",
        "source": "PPW_AUTHORED"
      },
      {
        "name": "Springboard Rana",
        "category": "GRAPPLE",
        "source": "PPW_AUTHORED"
      }
    ],
    "finishingMoves": [
      {
        "name": "Portal Bomb",
        "category": "POWER",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "Isiah Kassidy",
    "gimmickArchetype": "HIGH_FLYING_DAREDEVIL",
    "primaryStyle": "HIGH_FLYER",
    "secondaryStyle": "ALL_ROUNDER",
    "signatureMoves": [
      {
        "name": "Springboard Cutter",
        "category": "GRAPPLE",
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
        "name": "Swanton Bomb",
        "category": "AERIAL",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "JD Drake",
    "gimmickArchetype": "BRUISER",
    "primaryStyle": "BRAWLER",
    "secondaryStyle": "POWERHOUSE",
    "signatureMoves": [
      {
        "name": "Knife-edge Chop",
        "category": "STRIKE",
        "source": "PPW_AUTHORED"
      },
      {
        "name": "Moonsault",
        "category": "AERIAL",
        "source": "PPW_AUTHORED"
      }
    ],
    "finishingMoves": [
      {
        "name": "Cannonball Splash",
        "category": "POWER",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "Jeff Jarrett",
    "gimmickArchetype": "OPPORTUNIST",
    "primaryStyle": "BRAWLER",
    "secondaryStyle": "ALL_ROUNDER",
    "signatureMoves": [
      {
        "name": "Russian Leg Sweep",
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
        "name": "The Stroke",
        "category": "GRAPPLE",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "Johnny TV",
    "gimmickArchetype": "SHOWMAN",
    "primaryStyle": "HIGH_FLYER",
    "secondaryStyle": "ALL_ROUNDER",
    "signatureMoves": [
      {
        "name": "Moonlight Drive",
        "category": "GRAPPLE",
        "source": "PPW_AUTHORED"
      },
      {
        "name": "Standing Shooting Star Press",
        "category": "AERIAL",
        "source": "PPW_AUTHORED"
      }
    ],
    "finishingMoves": [
      {
        "name": "Starship Pain",
        "category": "AERIAL",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "Josh Alexander",
    "gimmickArchetype": "WRESTLING_MACHINE",
    "primaryStyle": "TECHNICAL",
    "secondaryStyle": "SUBMISSION",
    "signatureMoves": [
      {
        "name": "Powerbomb Backbreaker",
        "category": "POWER",
        "source": "PPW_AUTHORED"
      },
      {
        "name": "Ankle Lock",
        "category": "SUBMISSION",
        "source": "PPW_AUTHORED"
      }
    ],
    "finishingMoves": [
      {
        "name": "C4 Spike",
        "category": "GRAPPLE",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "Jon Moxley",
    "gimmickArchetype": "REBEL",
    "primaryStyle": "BRAWLER",
    "secondaryStyle": "STRONG_STYLE",
    "signatureMoves": [
      {
        "name": "King Kong Lariat",
        "category": "STRIKE",
        "source": "PPW_AUTHORED"
      },
      {
        "name": "Bulldog Choke",
        "category": "SUBMISSION",
        "source": "PPW_AUTHORED"
      }
    ],
    "finishingMoves": [
      {
        "name": "Death Rider",
        "category": "GRAPPLE",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "Orange Cassidy",
    "gimmickArchetype": "ECCENTRIC",
    "primaryStyle": "ALL_ROUNDER",
    "secondaryStyle": "TECHNICAL",
    "signatureMoves": [
      {
        "name": "Stundog Millionaire",
        "category": "GRAPPLE",
        "source": "PPW_AUTHORED"
      },
      {
        "name": "Beach Break",
        "category": "GRAPPLE",
        "source": "PPW_AUTHORED"
      }
    ],
    "finishingMoves": [
      {
        "name": "Orange Punch",
        "category": "STRIKE",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "Swerve Strickland",
    "gimmickArchetype": "DARK_ANTI_HERO",
    "primaryStyle": "ALL_ROUNDER",
    "secondaryStyle": "STRIKER",
    "signatureMoves": [
      {
        "name": "House Call",
        "category": "STRIKE",
        "source": "PPW_AUTHORED"
      },
      {
        "name": "JML Driver",
        "category": "GRAPPLE",
        "source": "PPW_AUTHORED"
      }
    ],
    "finishingMoves": [
      {
        "name": "Swerve Stomp",
        "category": "AERIAL",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "Will Ospreay",
    "gimmickArchetype": "HIGH_FLYING_DAREDEVIL",
    "primaryStyle": "HIGH_FLYER",
    "secondaryStyle": "STRONG_STYLE",
    "signatureMoves": [
      {
        "name": "Oscutter",
        "category": "GRAPPLE",
        "source": "PPW_AUTHORED"
      },
      {
        "name": "Storm Breaker",
        "category": "GRAPPLE",
        "source": "PPW_AUTHORED"
      }
    ],
    "finishingMoves": [
      {
        "name": "Hidden Blade",
        "category": "STRIKE",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "Samoa Joe",
    "gimmickArchetype": "PRIZEFIGHTER",
    "primaryStyle": "STRONG_STYLE",
    "secondaryStyle": "SUBMISSION",
    "signatureMoves": [
      {
        "name": "Uranage",
        "category": "POWER",
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
        "name": "Coquina Clutch",
        "category": "SUBMISSION",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "Jack Perry",
    "gimmickArchetype": "OPPORTUNIST",
    "primaryStyle": "ALL_ROUNDER",
    "secondaryStyle": "STRIKER",
    "signatureMoves": [
      {
        "name": "Snare Trap",
        "category": "SUBMISSION",
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
        "name": "Running Knee",
        "category": "STRIKE",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "Alex Zayne",
    "gimmickArchetype": "HIGH_FLYING_DAREDEVIL",
    "primaryStyle": "HIGH_FLYER",
    "secondaryStyle": "STRIKER",
    "signatureMoves": [
      {
        "name": "Taco Driver",
        "category": "GRAPPLE",
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
        "name": "Cinnamon Twist",
        "category": "AERIAL",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "Boltin Oleg",
    "gimmickArchetype": "WRESTLING_MACHINE",
    "primaryStyle": "POWERHOUSE",
    "secondaryStyle": "TECHNICAL",
    "signatureMoves": [
      {
        "name": "Gutwrench Suplex",
        "category": "GRAPPLE",
        "source": "PPW_AUTHORED"
      },
      {
        "name": "Olympic Throw",
        "category": "GRAPPLE",
        "source": "PPW_AUTHORED"
      }
    ],
    "finishingMoves": [
      {
        "name": "Kamaze",
        "category": "POWER",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "Chase Owens",
    "gimmickArchetype": "OPPORTUNIST",
    "primaryStyle": "ALL_ROUNDER",
    "secondaryStyle": "STRONG_STYLE",
    "signatureMoves": [
      {
        "name": "C-Trigger",
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
        "name": "Package Piledriver",
        "category": "GRAPPLE",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "Dick Togo",
    "gimmickArchetype": "OPPORTUNIST",
    "primaryStyle": "TECHNICAL",
    "secondaryStyle": "BRAWLER",
    "signatureMoves": [
      {
        "name": "Senton",
        "category": "AERIAL",
        "source": "PPW_AUTHORED"
      },
      {
        "name": "Crossface",
        "category": "SUBMISSION",
        "source": "PPW_AUTHORED"
      }
    ],
    "finishingMoves": [
      {
        "name": "Pedigree",
        "category": "GRAPPLE",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "Gedo",
    "gimmickArchetype": "OPPORTUNIST",
    "primaryStyle": "BRAWLER",
    "secondaryStyle": "TECHNICAL",
    "signatureMoves": [
      {
        "name": "Jawbreaker",
        "category": "GRAPPLE",
        "source": "PPW_AUTHORED"
      },
      {
        "name": "Low Blow",
        "category": "STRIKE",
        "source": "PPW_AUTHORED"
      }
    ],
    "finishingMoves": [
      {
        "name": "Gedo Clutch",
        "category": "GRAPPLE",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "Jado",
    "gimmickArchetype": "VETERAN_MENTOR",
    "primaryStyle": "BRAWLER",
    "secondaryStyle": "POWERHOUSE",
    "signatureMoves": [
      {
        "name": "Kendo Stick Strike",
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
        "name": "Green Killer",
        "category": "SUBMISSION",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "Robbie Eagles",
    "gimmickArchetype": "HIGH_FLYING_DAREDEVIL",
    "primaryStyle": "HIGH_FLYER",
    "secondaryStyle": "SUBMISSION",
    "signatureMoves": [
      {
        "name": "Turbo Backpack",
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
        "name": "Ron Miller Special",
        "category": "SUBMISSION",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "Rocky Romero",
    "gimmickArchetype": "VETERAN_MENTOR",
    "primaryStyle": "ALL_ROUNDER",
    "secondaryStyle": "STRIKER",
    "signatureMoves": [
      {
        "name": "Forever Clotheslines",
        "category": "STRIKE",
        "source": "PPW_AUTHORED"
      },
      {
        "name": "Shiranui",
        "category": "GRAPPLE",
        "source": "PPW_AUTHORED"
      }
    ],
    "finishingMoves": [
      {
        "name": "Diablo Armbar",
        "category": "SUBMISSION",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "Ryusuke Taguchi",
    "gimmickArchetype": "COMEDY",
    "primaryStyle": "ALL_ROUNDER",
    "secondaryStyle": "TECHNICAL",
    "signatureMoves": [
      {
        "name": "Hip Attack",
        "category": "STRIKE",
        "source": "PPW_AUTHORED"
      },
      {
        "name": "Three Amigos",
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
    "name": "Shota Umino",
    "gimmickArchetype": "FAN_FAVOURITE",
    "primaryStyle": "STRONG_STYLE",
    "secondaryStyle": "ALL_ROUNDER",
    "signatureMoves": [
      {
        "name": "Running European Uppercut",
        "category": "STRIKE",
        "source": "PPW_AUTHORED"
      },
      {
        "name": "Swinging DDT",
        "category": "GRAPPLE",
        "source": "PPW_AUTHORED"
      }
    ],
    "finishingMoves": [
      {
        "name": "Death Rider",
        "category": "GRAPPLE",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "Taiji Ishimori",
    "gimmickArchetype": "HIGH_FLYING_DAREDEVIL",
    "primaryStyle": "HIGH_FLYER",
    "secondaryStyle": "SUBMISSION",
    "signatureMoves": [
      {
        "name": "Sliding German Suplex",
        "category": "GRAPPLE",
        "source": "PPW_AUTHORED"
      },
      {
        "name": "La Mistica",
        "category": "GRAPPLE",
        "source": "PPW_AUTHORED"
      }
    ],
    "finishingMoves": [
      {
        "name": "Bloody Cross",
        "category": "GRAPPLE",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "TAKA Michinoku",
    "gimmickArchetype": "VETERAN_MENTOR",
    "primaryStyle": "TECHNICAL",
    "secondaryStyle": "STRIKER",
    "signatureMoves": [
      {
        "name": "Just Facelock",
        "category": "SUBMISSION",
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
        "name": "Michinoku Driver",
        "category": "GRAPPLE",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "Natsuko Tora",
    "gimmickArchetype": "DARK_ANTI_HERO",
    "primaryStyle": "BRAWLER",
    "secondaryStyle": "POWERHOUSE",
    "signatureMoves": [
      {
        "name": "Death Valley Driver",
        "category": "POWER",
        "source": "PPW_AUTHORED"
      },
      {
        "name": "Top Rope Splash",
        "category": "AERIAL",
        "source": "PPW_AUTHORED"
      }
    ],
    "finishingMoves": [
      {
        "name": "Swanton Bomb",
        "category": "AERIAL",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "Rina",
    "gimmickArchetype": "BRUISER",
    "primaryStyle": "BRAWLER",
    "secondaryStyle": "STRIKER",
    "signatureMoves": [
      {
        "name": "STO",
        "category": "GRAPPLE",
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
        "name": "Sleeper Hold",
        "category": "SUBMISSION",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "Ruaka",
    "gimmickArchetype": "POWERHOUSE",
    "primaryStyle": "POWERHOUSE",
    "secondaryStyle": "BRAWLER",
    "signatureMoves": [
      {
        "name": "Shoulder Block",
        "category": "STRIKE",
        "source": "PPW_AUTHORED"
      },
      {
        "name": "Cannonball",
        "category": "POWER",
        "source": "PPW_AUTHORED"
      }
    ],
    "finishingMoves": [
      {
        "name": "Freezer Bomb",
        "category": "POWER",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "Kazuyuki Fujita",
    "gimmickArchetype": "MMA_CROSSOVER",
    "primaryStyle": "POWERHOUSE",
    "secondaryStyle": "SUBMISSION",
    "signatureMoves": [
      {
        "name": "Soccer Kick",
        "category": "STRIKE",
        "source": "PPW_AUTHORED"
      },
      {
        "name": "Rear Naked Choke",
        "category": "SUBMISSION",
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
    "name": "Saxon Huxley",
    "gimmickArchetype": "MONSTER",
    "primaryStyle": "POWERHOUSE",
    "secondaryStyle": "BRAWLER",
    "signatureMoves": [
      {
        "name": "Running Splash",
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
        "name": "Jackhammer",
        "category": "POWER",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "Mr. Iguana",
    "gimmickArchetype": "COMEDY",
    "primaryStyle": "LUCHA",
    "secondaryStyle": "HIGH_FLYER",
    "signatureMoves": [
      {
        "name": "Iguana Rana",
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
        "name": "Diving Hurricanrana",
        "category": "GRAPPLE",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "Psycho Clown",
    "gimmickArchetype": "MASKED_MYSTERY",
    "primaryStyle": "LUCHA",
    "secondaryStyle": "BRAWLER",
    "signatureMoves": [
      {
        "name": "Tope Suicida",
        "category": "AERIAL",
        "source": "PPW_AUTHORED"
      },
      {
        "name": "Powerbomb",
        "category": "POWER",
        "source": "PPW_AUTHORED"
      }
    ],
    "finishingMoves": [
      {
        "name": "Psycho Driver",
        "category": "GRAPPLE",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "Aero Star",
    "gimmickArchetype": "HIGH_FLYING_DAREDEVIL",
    "primaryStyle": "LUCHA",
    "secondaryStyle": "HIGH_FLYER",
    "signatureMoves": [
      {
        "name": "Springboard Corkscrew",
        "category": "AERIAL",
        "source": "PPW_AUTHORED"
      },
      {
        "name": "Plancha",
        "category": "AERIAL",
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
    "name": "AJ Francis",
    "gimmickArchetype": "MONSTER",
    "primaryStyle": "POWERHOUSE",
    "secondaryStyle": "BRAWLER",
    "signatureMoves": [
      {
        "name": "Running Splash",
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
        "name": "Fireman's Carry Slam",
        "category": "POWER",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "Brian Myers",
    "gimmickArchetype": "OPPORTUNIST",
    "primaryStyle": "ALL_ROUNDER",
    "secondaryStyle": "BRAWLER",
    "signatureMoves": [
      {
        "name": "Edge-O-Matic",
        "category": "GRAPPLE",
        "source": "PPW_AUTHORED"
      },
      {
        "name": "Elbow Drop",
        "category": "AERIAL",
        "source": "PPW_AUTHORED"
      }
    ],
    "finishingMoves": [
      {
        "name": "Roster Cut",
        "category": "STRIKE",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "Cedric Alexander",
    "gimmickArchetype": "HIGH_FLYING_DAREDEVIL",
    "primaryStyle": "ALL_ROUNDER",
    "secondaryStyle": "HIGH_FLYER",
    "signatureMoves": [
      {
        "name": "Neuralyzer",
        "category": "STRIKE",
        "source": "PPW_AUTHORED"
      },
      {
        "name": "Michinoku Driver",
        "category": "GRAPPLE",
        "source": "PPW_AUTHORED"
      }
    ],
    "finishingMoves": [
      {
        "name": "Lumbar Check",
        "category": "GRAPPLE",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "Chris Bey",
    "gimmickArchetype": "SHOWMAN",
    "primaryStyle": "HIGH_FLYER",
    "secondaryStyle": "ALL_ROUNDER",
    "signatureMoves": [
      {
        "name": "Springboard Cutter",
        "category": "GRAPPLE",
        "source": "PPW_AUTHORED"
      },
      {
        "name": "Diving Double Stomp",
        "category": "AERIAL",
        "source": "PPW_AUTHORED"
      }
    ],
    "finishingMoves": [
      {
        "name": "Art of Finesse",
        "category": "GRAPPLE",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "Eddie Edwards",
    "gimmickArchetype": "BRUISER",
    "primaryStyle": "STRONG_STYLE",
    "secondaryStyle": "BRAWLER",
    "signatureMoves": [
      {
        "name": "Blue Thunder Bomb",
        "category": "POWER",
        "source": "PPW_AUTHORED"
      },
      {
        "name": "Die Hard Flowsion",
        "category": "GRAPPLE",
        "source": "PPW_AUTHORED"
      }
    ],
    "finishingMoves": [
      {
        "name": "Boston Knee Party",
        "category": "STRIKE",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "Ryan Nemeth",
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
        "name": "Dolphin Dive",
        "category": "AERIAL",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "Xia Brookside",
    "gimmickArchetype": "UNDERDOG",
    "primaryStyle": "TECHNICAL",
    "secondaryStyle": "ALL_ROUNDER",
    "signatureMoves": [
      {
        "name": "Hurricanrana",
        "category": "GRAPPLE",
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
        "name": "Brookside Bomb",
        "category": "GRAPPLE",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "Indi Hartwell",
    "gimmickArchetype": "FAN_FAVOURITE",
    "primaryStyle": "ALL_ROUNDER",
    "secondaryStyle": "BRAWLER",
    "signatureMoves": [
      {
        "name": "Spinebuster",
        "category": "POWER",
        "source": "PPW_AUTHORED"
      },
      {
        "name": "Running Boot",
        "category": "STRIKE",
        "source": "PPW_AUTHORED"
      }
    ],
    "finishingMoves": [
      {
        "name": "Springboard Elbow Drop",
        "category": "AERIAL",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "Jody Threat",
    "gimmickArchetype": "BRUISER",
    "primaryStyle": "BRAWLER",
    "secondaryStyle": "POWERHOUSE",
    "signatureMoves": [
      {
        "name": "Lariat",
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
        "name": "F-Bomb",
        "category": "POWER",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "Alex Hammerstone",
    "gimmickArchetype": "POWERHOUSE",
    "primaryStyle": "POWERHOUSE",
    "secondaryStyle": "ALL_ROUNDER",
    "signatureMoves": [
      {
        "name": "Bicycle Kick",
        "category": "STRIKE",
        "source": "PPW_AUTHORED"
      },
      {
        "name": "Powerbomb",
        "category": "POWER",
        "source": "PPW_AUTHORED"
      }
    ],
    "finishingMoves": [
      {
        "name": "Nightmare Pendulum",
        "category": "GRAPPLE",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "Josh Barnett",
    "gimmickArchetype": "MMA_CROSSOVER",
    "primaryStyle": "SUBMISSION",
    "secondaryStyle": "TECHNICAL",
    "signatureMoves": [
      {
        "name": "Fujiwara Armbar",
        "category": "SUBMISSION",
        "source": "PPW_AUTHORED"
      },
      {
        "name": "Double Wristlock",
        "category": "SUBMISSION",
        "source": "PPW_AUTHORED"
      }
    ],
    "finishingMoves": [
      {
        "name": "Cross Heel Hold",
        "category": "SUBMISSION",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "Matt Riddle",
    "gimmickArchetype": "MMA_CROSSOVER",
    "primaryStyle": "SUBMISSION",
    "secondaryStyle": "STRIKER",
    "signatureMoves": [
      {
        "name": "Floating Bro",
        "category": "AERIAL",
        "source": "PPW_AUTHORED"
      },
      {
        "name": "Bro Mission",
        "category": "SUBMISSION",
        "source": "PPW_AUTHORED"
      }
    ],
    "finishingMoves": [
      {
        "name": "Bro Derek",
        "category": "GRAPPLE",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "Tom Lawlor",
    "gimmickArchetype": "MMA_CROSSOVER",
    "primaryStyle": "SUBMISSION",
    "secondaryStyle": "STRIKER",
    "signatureMoves": [
      {
        "name": "Rear Naked Choke",
        "category": "SUBMISSION",
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
        "name": "Filthy Bomb",
        "category": "POWER",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "Joey Janela",
    "gimmickArchetype": "EXTREME_DAREDEVIL",
    "primaryStyle": "BRAWLER",
    "secondaryStyle": "HIGH_FLYER",
    "signatureMoves": [
      {
        "name": "Death Valley Driver",
        "category": "POWER",
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
        "name": "Package Piledriver",
        "category": "GRAPPLE",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "Michael Oku",
    "gimmickArchetype": "UNDERDOG",
    "primaryStyle": "HIGH_FLYER",
    "secondaryStyle": "TECHNICAL",
    "signatureMoves": [
      {
        "name": "Frog Splash",
        "category": "AERIAL",
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
        "name": "Half Crab",
        "category": "SUBMISSION",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "Mark Andrews",
    "gimmickArchetype": "HIGH_FLYING_DAREDEVIL",
    "primaryStyle": "HIGH_FLYER",
    "secondaryStyle": "ALL_ROUNDER",
    "signatureMoves": [
      {
        "name": "Stundog Millionaire",
        "category": "GRAPPLE",
        "source": "PPW_AUTHORED"
      },
      {
        "name": "Tornado DDT",
        "category": "GRAPPLE",
        "source": "PPW_AUTHORED"
      }
    ],
    "finishingMoves": [
      {
        "name": "Fall to Pieces",
        "category": "AERIAL",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "Flash Morgan Webster",
    "gimmickArchetype": "HIGH_FLYING_DAREDEVIL",
    "primaryStyle": "HIGH_FLYER",
    "secondaryStyle": "ALL_ROUNDER",
    "signatureMoves": [
      {
        "name": "Tope Suicida",
        "category": "AERIAL",
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
        "name": "Eton Rifle",
        "category": "GRAPPLE",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "Satnam Singh",
    "gimmickArchetype": "GIANT",
    "primaryStyle": "POWERHOUSE",
    "secondaryStyle": "BRAWLER",
    "signatureMoves": [
      {
        "name": "Overhead Chop",
        "category": "STRIKE",
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
        "name": "Chokeslam",
        "category": "POWER",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "Shane Taylor",
    "gimmickArchetype": "PRIZEFIGHTER",
    "primaryStyle": "BRAWLER",
    "secondaryStyle": "POWERHOUSE",
    "signatureMoves": [
      {
        "name": "Headbutt",
        "category": "STRIKE",
        "source": "PPW_AUTHORED"
      },
      {
        "name": "Uranage",
        "category": "POWER",
        "source": "PPW_AUTHORED"
      }
    ],
    "finishingMoves": [
      {
        "name": "Package Piledriver",
        "category": "GRAPPLE",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "Ricky Morton",
    "gimmickArchetype": "VETERAN_MENTOR",
    "primaryStyle": "ALL_ROUNDER",
    "secondaryStyle": "HIGH_FLYER",
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
        "name": "Victory Roll",
        "category": "GRAPPLE",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "Nicholas Jackson",
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
        "name": "450 Splash",
        "category": "AERIAL",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "Keith Lee",
    "gimmickArchetype": "POWERHOUSE",
    "primaryStyle": "POWERHOUSE",
    "secondaryStyle": "ALL_ROUNDER",
    "signatureMoves": [
      {
        "name": "Pounce",
        "category": "STRIKE",
        "source": "PPW_AUTHORED"
      },
      {
        "name": "Spirit Bomb",
        "category": "POWER",
        "source": "PPW_AUTHORED"
      }
    ],
    "finishingMoves": [
      {
        "name": "Big Bang Catastrophe",
        "category": "POWER",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "Tony Nese",
    "gimmickArchetype": "ARROGANT_ACE",
    "primaryStyle": "TECHNICAL",
    "secondaryStyle": "STRIKER",
    "signatureMoves": [
      {
        "name": "Running Knee",
        "category": "STRIKE",
        "source": "PPW_AUTHORED"
      },
      {
        "name": "Pump Handle Slam",
        "category": "POWER",
        "source": "PPW_AUTHORED"
      }
    ],
    "finishingMoves": [
      {
        "name": "Running Nese",
        "category": "STRIKE",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "Toa Liona",
    "gimmickArchetype": "BEAST",
    "primaryStyle": "POWERHOUSE",
    "secondaryStyle": "BRAWLER",
    "signatureMoves": [
      {
        "name": "Samoan Drop",
        "category": "POWER",
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
        "name": "Pop-up Samoan Drop",
        "category": "POWER",
        "source": "PPW_AUTHORED"
      }
    ]
  }
];
