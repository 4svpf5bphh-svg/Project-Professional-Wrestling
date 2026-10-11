/**
 * PPW wrestler identity review wave 6 — 11 October 2026.
 * Exact-name editing pass prioritizing well-known male wrestlers and
 * obvious style/gimmick contradictions across multiple international regions.
 * Character/move candidates remain PPW_AUTHORED until individually sourced;
 * do not imply a verifiable real-life gimmick or signature for an obscure worker.
 * Not authoritative history, not wrestler consent, no auto-rebrand to saved Worlds.
 * Representative publisher examples for subsequent source validation:
 * https://www.wwe.com/superstars/shinsuke-nakamura
 * https://www.wwe.com/superstars/seth-rollins
 * https://www.wwe.com/superstars/roman-reigns
 */
import type { PortableIdentityMove } from "../../domain/src/wrestler-identity.js";
export interface ReviewedRosterIdentityWave6 {
 name: string; gimmickArchetype: string; primaryStyle: string; secondaryStyle: string | null;
 signatureMoves: PortableIdentityMove[]; finishingMoves: PortableIdentityMove[];
}
export const REVIEWED_REAL_ROSTER_IDENTITIES_WAVE6: readonly ReviewedRosterIdentityWave6[] = [
  {
    "name": "Bron Breakker",
    "gimmickArchetype": "BEAST",
    "primaryStyle": "POWERHOUSE",
    "secondaryStyle": "STRIKER",
    "signatureMoves": [
      {
        "name": "Military Press Powerslam",
        "category": "POWER",
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
        "name": "Spear",
        "category": "STRIKE",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "Chad Gable",
    "gimmickArchetype": "WRESTLING_MACHINE",
    "primaryStyle": "TECHNICAL",
    "secondaryStyle": "SUBMISSION",
    "signatureMoves": [
      {
        "name": "Chaos Theory",
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
        "name": "Ankle Lock",
        "category": "SUBMISSION",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "Charlie Dempsey",
    "gimmickArchetype": "WRESTLING_MACHINE",
    "primaryStyle": "SUBMISSION",
    "secondaryStyle": "TECHNICAL",
    "signatureMoves": [
      {
        "name": "Regal Stretch",
        "category": "SUBMISSION",
        "source": "PPW_AUTHORED"
      },
      {
        "name": "Bridging German Suplex",
        "category": "GRAPPLE",
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
    "name": "Cody Rhodes",
    "gimmickArchetype": "AMERICAN_NIGHTMARE",
    "primaryStyle": "ALL_ROUNDER",
    "secondaryStyle": "BRAWLER",
    "signatureMoves": [
      {
        "name": "Cody Cutter",
        "category": "GRAPPLE",
        "source": "PPW_AUTHORED"
      },
      {
        "name": "Disaster Kick",
        "category": "STRIKE",
        "source": "PPW_AUTHORED"
      }
    ],
    "finishingMoves": [
      {
        "name": "Cross Rhodes",
        "category": "GRAPPLE",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "Damian Priest",
    "gimmickArchetype": "DARK_ANTI_HERO",
    "primaryStyle": "POWERHOUSE",
    "secondaryStyle": "STRIKER",
    "signatureMoves": [
      {
        "name": "Razor's Edge",
        "category": "POWER",
        "source": "PPW_AUTHORED"
      },
      {
        "name": "South of Heaven",
        "category": "POWER",
        "source": "PPW_AUTHORED"
      }
    ],
    "finishingMoves": [
      {
        "name": "Reckoning",
        "category": "GRAPPLE",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "Dominik Mysterio",
    "gimmickArchetype": "OPPORTUNIST",
    "primaryStyle": "LUCHA",
    "secondaryStyle": "ALL_ROUNDER",
    "signatureMoves": [
      {
        "name": "619",
        "category": "STRIKE",
        "source": "PPW_AUTHORED"
      },
      {
        "name": "Slingshot Senton",
        "category": "AERIAL",
        "source": "PPW_AUTHORED"
      }
    ],
    "finishingMoves": [
      {
        "name": "Frog Splash",
        "category": "AERIAL",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "Drew McIntyre",
    "gimmickArchetype": "BRUISER",
    "primaryStyle": "POWERHOUSE",
    "secondaryStyle": "STRIKER",
    "signatureMoves": [
      {
        "name": "Future Shock DDT",
        "category": "GRAPPLE",
        "source": "PPW_AUTHORED"
      },
      {
        "name": "Glasgow Kiss",
        "category": "STRIKE",
        "source": "PPW_AUTHORED"
      }
    ],
    "finishingMoves": [
      {
        "name": "Claymore Kick",
        "category": "STRIKE",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "Ilja Dragunov",
    "gimmickArchetype": "STRONG_STYLE_ACE",
    "primaryStyle": "STRONG_STYLE",
    "secondaryStyle": "STRIKER",
    "signatureMoves": [
      {
        "name": "Constantine Special",
        "category": "AERIAL",
        "source": "PPW_AUTHORED"
      },
      {
        "name": "H-Bomb",
        "category": "STRIKE",
        "source": "PPW_AUTHORED"
      }
    ],
    "finishingMoves": [
      {
        "name": "Torpedo Moscow",
        "category": "STRIKE",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "JD McDonagh",
    "gimmickArchetype": "TECHNICAL_WIZARD",
    "primaryStyle": "TECHNICAL",
    "secondaryStyle": "STRIKER",
    "signatureMoves": [
      {
        "name": "Spanish Fly",
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
        "name": "Devlin Side",
        "category": "GRAPPLE",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "Kevin Owens",
    "gimmickArchetype": "PRIZEFIGHTER",
    "primaryStyle": "BRAWLER",
    "secondaryStyle": "ALL_ROUNDER",
    "signatureMoves": [
      {
        "name": "Cannonball",
        "category": "POWER",
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
        "name": "Stunner",
        "category": "GRAPPLE",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "Lexis King",
    "gimmickArchetype": "ARROGANT_ACE",
    "primaryStyle": "ALL_ROUNDER",
    "secondaryStyle": "BRAWLER",
    "signatureMoves": [
      {
        "name": "Superkick",
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
        "name": "Coronation",
        "category": "GRAPPLE",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "Oba Femi",
    "gimmickArchetype": "BEAST",
    "primaryStyle": "POWERHOUSE",
    "secondaryStyle": "BRAWLER",
    "signatureMoves": [
      {
        "name": "Running European Uppercut",
        "category": "STRIKE",
        "source": "PPW_AUTHORED"
      },
      {
        "name": "Military Press Slam",
        "category": "POWER",
        "source": "PPW_AUTHORED"
      }
    ],
    "finishingMoves": [
      {
        "name": "Fall from Grace",
        "category": "POWER",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "Randy Orton",
    "gimmickArchetype": "LEGEND_KILLER",
    "primaryStyle": "ALL_ROUNDER",
    "secondaryStyle": "STRIKER",
    "signatureMoves": [
      {
        "name": "Elevated DDT",
        "category": "GRAPPLE",
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
        "name": "RKO",
        "category": "GRAPPLE",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "Rey Mysterio",
    "gimmickArchetype": "LEGENDARY_LUCHADOR",
    "primaryStyle": "LUCHA",
    "secondaryStyle": "HIGH_FLYER",
    "signatureMoves": [
      {
        "name": "619",
        "category": "STRIKE",
        "source": "PPW_AUTHORED"
      },
      {
        "name": "Seated Senton",
        "category": "AERIAL",
        "source": "PPW_AUTHORED"
      }
    ],
    "finishingMoves": [
      {
        "name": "West Coast Pop",
        "category": "AERIAL",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "Roman Reigns",
    "gimmickArchetype": "TRIBAL_CHIEF",
    "primaryStyle": "POWERHOUSE",
    "secondaryStyle": "ALL_ROUNDER",
    "signatureMoves": [
      {
        "name": "Superman Punch",
        "category": "STRIKE",
        "source": "PPW_AUTHORED"
      },
      {
        "name": "Guillotine",
        "category": "SUBMISSION",
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
    "name": "Rusev",
    "gimmickArchetype": "BEAST",
    "primaryStyle": "POWERHOUSE",
    "secondaryStyle": "SUBMISSION",
    "signatureMoves": [
      {
        "name": "Samoan Drop",
        "category": "POWER",
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
        "name": "Accolade",
        "category": "SUBMISSION",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "Sami Zayn",
    "gimmickArchetype": "UNDERDOG",
    "primaryStyle": "ALL_ROUNDER",
    "secondaryStyle": "BRAWLER",
    "signatureMoves": [
      {
        "name": "Blue Thunder Bomb",
        "category": "POWER",
        "source": "PPW_AUTHORED"
      },
      {
        "name": "Exploder Suplex",
        "category": "GRAPPLE",
        "source": "PPW_AUTHORED"
      }
    ],
    "finishingMoves": [
      {
        "name": "Helluva Kick",
        "category": "STRIKE",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "Seth Rollins",
    "gimmickArchetype": "REVOLUTIONARY",
    "primaryStyle": "ALL_ROUNDER",
    "secondaryStyle": "HIGH_FLYER",
    "signatureMoves": [
      {
        "name": "Ripcord Knee",
        "category": "STRIKE",
        "source": "PPW_AUTHORED"
      },
      {
        "name": "Falcon Arrow",
        "category": "GRAPPLE",
        "source": "PPW_AUTHORED"
      }
    ],
    "finishingMoves": [
      {
        "name": "Stomp",
        "category": "STRIKE",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "Shawn Spears",
    "gimmickArchetype": "OPPORTUNIST",
    "primaryStyle": "ALL_ROUNDER",
    "secondaryStyle": "BRAWLER",
    "signatureMoves": [
      {
        "name": "Superkick",
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
        "name": "C4",
        "category": "GRAPPLE",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "Shinsuke Nakamura",
    "gimmickArchetype": "STRONG_STYLE_ACE",
    "primaryStyle": "STRONG_STYLE",
    "secondaryStyle": "STRIKER",
    "signatureMoves": [
      {
        "name": "Good Vibrations",
        "category": "STRIKE",
        "source": "PPW_AUTHORED"
      },
      {
        "name": "Inverted Exploder Suplex",
        "category": "GRAPPLE",
        "source": "PPW_AUTHORED"
      }
    ],
    "finishingMoves": [
      {
        "name": "Kinshasa",
        "category": "STRIKE",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "Ace Austin",
    "gimmickArchetype": "SHOWMAN",
    "primaryStyle": "HIGH_FLYER",
    "secondaryStyle": "STRIKER",
    "signatureMoves": [
      {
        "name": "Springboard Roundhouse",
        "category": "STRIKE",
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
        "name": "The Fold",
        "category": "GRAPPLE",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "Action Andretti",
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
        "name": "Tope Con Giro",
        "category": "AERIAL",
        "source": "PPW_AUTHORED"
      }
    ],
    "finishingMoves": [
      {
        "name": "Shooting Star Press",
        "category": "AERIAL",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "Andrade El Ídolo",
    "gimmickArchetype": "ARROGANT_ACE",
    "primaryStyle": "LUCHA",
    "secondaryStyle": "STRONG_STYLE",
    "signatureMoves": [
      {
        "name": "Running Double Knees",
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
        "name": "Hammerlock DDT",
        "category": "GRAPPLE",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "Austin Gunn",
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
        "name": "Hip Toss",
        "category": "GRAPPLE",
        "source": "PPW_AUTHORED"
      }
    ],
    "finishingMoves": [
      {
        "name": "Quick Draw",
        "category": "GRAPPLE",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "The Beast Mortos",
    "gimmickArchetype": "BEAST",
    "primaryStyle": "LUCHA",
    "secondaryStyle": "POWERHOUSE",
    "signatureMoves": [
      {
        "name": "Tornillo",
        "category": "AERIAL",
        "source": "PPW_AUTHORED"
      },
      {
        "name": "Pop-up Samoan Drop",
        "category": "POWER",
        "source": "PPW_AUTHORED"
      }
    ],
    "finishingMoves": [
      {
        "name": "Mortos Driver",
        "category": "GRAPPLE",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "Billy Gunn",
    "gimmickArchetype": "VETERAN_MENTOR",
    "primaryStyle": "POWERHOUSE",
    "secondaryStyle": "BRAWLER",
    "signatureMoves": [
      {
        "name": "Fameasser",
        "category": "STRIKE",
        "source": "PPW_AUTHORED"
      },
      {
        "name": "Side Slam",
        "category": "POWER",
        "source": "PPW_AUTHORED"
      }
    ],
    "finishingMoves": [
      {
        "name": "One and Only",
        "category": "GRAPPLE",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "Bryan Keith",
    "gimmickArchetype": "OUTLAW",
    "primaryStyle": "BRAWLER",
    "secondaryStyle": "STRONG_STYLE",
    "signatureMoves": [
      {
        "name": "Big Boot",
        "category": "STRIKE",
        "source": "PPW_AUTHORED"
      },
      {
        "name": "Exploder Suplex",
        "category": "GRAPPLE",
        "source": "PPW_AUTHORED"
      }
    ],
    "finishingMoves": [
      {
        "name": "Diamond Dust",
        "category": "GRAPPLE",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "Clark Connors",
    "gimmickArchetype": "REBEL",
    "primaryStyle": "STRONG_STYLE",
    "secondaryStyle": "BRAWLER",
    "signatureMoves": [
      {
        "name": "Spear",
        "category": "STRIKE",
        "source": "PPW_AUTHORED"
      },
      {
        "name": "Running Powerbomb",
        "category": "POWER",
        "source": "PPW_AUTHORED"
      }
    ],
    "finishingMoves": [
      {
        "name": "No Chaser",
        "category": "GRAPPLE",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "Dralístico",
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
    "name": "Evil Uno",
    "gimmickArchetype": "DARK_ANTI_HERO",
    "primaryStyle": "ALL_ROUNDER",
    "secondaryStyle": "BRAWLER",
    "signatureMoves": [
      {
        "name": "Running Senton",
        "category": "POWER",
        "source": "PPW_AUTHORED"
      },
      {
        "name": "Swinging Neckbreaker",
        "category": "GRAPPLE",
        "source": "PPW_AUTHORED"
      }
    ],
    "finishingMoves": [
      {
        "name": "Something Evil",
        "category": "GRAPPLE",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "James Drake",
    "gimmickArchetype": "TECHNICAL_WIZARD",
    "primaryStyle": "TECHNICAL",
    "secondaryStyle": "BRAWLER",
    "signatureMoves": [
      {
        "name": "Corner Dropkick",
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
        "name": "Ticket to Mayhem",
        "category": "GRAPPLE",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "Jordan Oliver",
    "gimmickArchetype": "HIGH_FLYING_DAREDEVIL",
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
        "name": "Clout Cutter",
        "category": "GRAPPLE",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "Josh Woods",
    "gimmickArchetype": "MMA_CROSSOVER",
    "primaryStyle": "SUBMISSION",
    "secondaryStyle": "POWERHOUSE",
    "signatureMoves": [
      {
        "name": "Gutwrench Suplex",
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
        "name": "Rolling German Suplex",
        "category": "GRAPPLE",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "Kip Sabian",
    "gimmickArchetype": "OPPORTUNIST",
    "primaryStyle": "ALL_ROUNDER",
    "secondaryStyle": "HIGH_FLYER",
    "signatureMoves": [
      {
        "name": "Superkick",
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
        "name": "Deathly Hallows",
        "category": "GRAPPLE",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "Komander",
    "gimmickArchetype": "HIGH_FLYING_DAREDEVIL",
    "primaryStyle": "LUCHA",
    "secondaryStyle": "HIGH_FLYER",
    "signatureMoves": [
      {
        "name": "Rope Walk Moonsault",
        "category": "AERIAL",
        "source": "PPW_AUTHORED"
      },
      {
        "name": "Tornillo",
        "category": "AERIAL",
        "source": "PPW_AUTHORED"
      }
    ],
    "finishingMoves": [
      {
        "name": "Cielito Lindo",
        "category": "AERIAL",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "Mark Davis",
    "gimmickArchetype": "BRUISER",
    "primaryStyle": "POWERHOUSE",
    "secondaryStyle": "STRONG_STYLE",
    "signatureMoves": [
      {
        "name": "Running Lariat",
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
        "name": "Sit-out Powerbomb",
        "category": "POWER",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "Mason Madden",
    "gimmickArchetype": "GIANT",
    "primaryStyle": "POWERHOUSE",
    "secondaryStyle": "BRAWLER",
    "signatureMoves": [
      {
        "name": "Running Big Boot",
        "category": "STRIKE",
        "source": "PPW_AUTHORED"
      },
      {
        "name": "Overhead Slam",
        "category": "POWER",
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
    "name": "Matt Sydal",
    "gimmickArchetype": "HIGH_FLYING_DAREDEVIL",
    "primaryStyle": "HIGH_FLYER",
    "secondaryStyle": "TECHNICAL",
    "signatureMoves": [
      {
        "name": "Standing Moonsault",
        "category": "AERIAL",
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
        "name": "Shooting Star Press",
        "category": "AERIAL",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "Max Caster",
    "gimmickArchetype": "SHOWMAN",
    "primaryStyle": "ALL_ROUNDER",
    "secondaryStyle": "BRAWLER",
    "signatureMoves": [
      {
        "name": "Mic Drop",
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
        "name": "Diving Elbow Drop",
        "category": "AERIAL",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "MVP",
    "gimmickArchetype": "VETERAN_MENTOR",
    "primaryStyle": "ALL_ROUNDER",
    "secondaryStyle": "BRAWLER",
    "signatureMoves": [
      {
        "name": "Ballin' Elbow",
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
        "name": "Playmaker",
        "category": "GRAPPLE",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "Myron Reed",
    "gimmickArchetype": "HIGH_FLYING_DAREDEVIL",
    "primaryStyle": "HIGH_FLYER",
    "secondaryStyle": "STRIKER",
    "signatureMoves": [
      {
        "name": "Springboard Stunner",
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
        "name": "Flame On",
        "category": "AERIAL",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "Aaron Wolf",
    "gimmickArchetype": "MMA_CROSSOVER",
    "primaryStyle": "POWERHOUSE",
    "secondaryStyle": "TECHNICAL",
    "signatureMoves": [
      {
        "name": "Judo Hip Toss",
        "category": "GRAPPLE",
        "source": "PPW_AUTHORED"
      },
      {
        "name": "Ura Nage",
        "category": "POWER",
        "source": "PPW_AUTHORED"
      }
    ],
    "finishingMoves": [
      {
        "name": "Olympic Slam",
        "category": "POWER",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "Atlantis Jr.",
    "gimmickArchetype": "FAMILY_DYNASTY",
    "primaryStyle": "LUCHA",
    "secondaryStyle": "HIGH_FLYER",
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
        "name": "Atlantida",
        "category": "SUBMISSION",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "The DKC",
    "gimmickArchetype": "STRONG_STYLE_ACE",
    "primaryStyle": "STRONG_STYLE",
    "secondaryStyle": "STRIKER",
    "signatureMoves": [
      {
        "name": "Karate Chop",
        "category": "STRIKE",
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
        "name": "Crucifix Pin",
        "category": "GRAPPLE",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "Don Fale",
    "gimmickArchetype": "GIANT",
    "primaryStyle": "POWERHOUSE",
    "secondaryStyle": "BRAWLER",
    "signatureMoves": [
      {
        "name": "Corner Splash",
        "category": "POWER",
        "source": "PPW_AUTHORED"
      },
      {
        "name": "Running Body Block",
        "category": "POWER",
        "source": "PPW_AUTHORED"
      }
    ],
    "finishingMoves": [
      {
        "name": "Bad Luck Fall",
        "category": "POWER",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "Drilla Moloney",
    "gimmickArchetype": "BRUISER",
    "primaryStyle": "STRONG_STYLE",
    "secondaryStyle": "BRAWLER",
    "signatureMoves": [
      {
        "name": "Gore",
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
        "name": "Drilla Killa",
        "category": "GRAPPLE",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "Fred Rosser",
    "gimmickArchetype": "FAN_FAVOURITE",
    "primaryStyle": "STRONG_STYLE",
    "secondaryStyle": "SUBMISSION",
    "signatureMoves": [
      {
        "name": "Gut Check",
        "category": "POWER",
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
        "name": "Crossface",
        "category": "SUBMISSION",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "Hartley Jackson",
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
        "name": "Lariat",
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
    "name": "OSKAR",
    "gimmickArchetype": "GIANT",
    "primaryStyle": "POWERHOUSE",
    "secondaryStyle": "STRONG_STYLE",
    "signatureMoves": [
      {
        "name": "Running Lariat",
        "category": "STRIKE",
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
        "name": "Chokeslam",
        "category": "POWER",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "Robbie X",
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
        "name": "Suicide Dive",
        "category": "AERIAL",
        "source": "PPW_AUTHORED"
      }
    ],
    "finishingMoves": [
      {
        "name": "X-Claimation",
        "category": "GRAPPLE",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "Royce Isaacs",
    "gimmickArchetype": "BRUISER",
    "primaryStyle": "POWERHOUSE",
    "secondaryStyle": "TECHNICAL",
    "signatureMoves": [
      {
        "name": "Running Uppercut",
        "category": "STRIKE",
        "source": "PPW_AUTHORED"
      },
      {
        "name": "Suplex",
        "category": "GRAPPLE",
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
    "name": "Shane Haste",
    "gimmickArchetype": "OUTLAW",
    "primaryStyle": "ALL_ROUNDER",
    "secondaryStyle": "STRONG_STYLE",
    "signatureMoves": [
      {
        "name": "Corner Cannonball",
        "category": "POWER",
        "source": "PPW_AUTHORED"
      },
      {
        "name": "Exploder Suplex",
        "category": "GRAPPLE",
        "source": "PPW_AUTHORED"
      }
    ],
    "finishingMoves": [
      {
        "name": "Bomb Valley Death",
        "category": "POWER",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "Templario",
    "gimmickArchetype": "MASKED_MYSTERY",
    "primaryStyle": "LUCHA",
    "secondaryStyle": "TECHNICAL",
    "signatureMoves": [
      {
        "name": "Springboard Moonsault",
        "category": "AERIAL",
        "source": "PPW_AUTHORED"
      },
      {
        "name": "Tope Con Giro",
        "category": "AERIAL",
        "source": "PPW_AUTHORED"
      }
    ],
    "finishingMoves": [
      {
        "name": "Templaria",
        "category": "SUBMISSION",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "Karl Anderson",
    "gimmickArchetype": "OPPORTUNIST",
    "primaryStyle": "ALL_ROUNDER",
    "secondaryStyle": "BRAWLER",
    "signatureMoves": [
      {
        "name": "Spinebuster",
        "category": "POWER",
        "source": "PPW_AUTHORED"
      },
      {
        "name": "Running Leg Lariat",
        "category": "STRIKE",
        "source": "PPW_AUTHORED"
      }
    ],
    "finishingMoves": [
      {
        "name": "Gun Stun",
        "category": "GRAPPLE",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "Masato Tanaka",
    "gimmickArchetype": "EXTREME_DAREDEVIL",
    "primaryStyle": "BRAWLER",
    "secondaryStyle": "STRONG_STYLE",
    "signatureMoves": [
      {
        "name": "Sliding D",
        "category": "STRIKE",
        "source": "PPW_AUTHORED"
      },
      {
        "name": "Diamond Dust",
        "category": "GRAPPLE",
        "source": "PPW_AUTHORED"
      }
    ],
    "finishingMoves": [
      {
        "name": "Roaring Elbow",
        "category": "STRIKE",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "Muhammad Yone",
    "gimmickArchetype": "SHOWMAN",
    "primaryStyle": "STRONG_STYLE",
    "secondaryStyle": "BRAWLER",
    "signatureMoves": [
      {
        "name": "Discus Lariat",
        "category": "STRIKE",
        "source": "PPW_AUTHORED"
      },
      {
        "name": "Corner Clothesline",
        "category": "STRIKE",
        "source": "PPW_AUTHORED"
      }
    ],
    "finishingMoves": [
      {
        "name": "Kinniku Buster",
        "category": "POWER",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "Shuji Kondo",
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
        "name": "Powerbomb",
        "category": "POWER",
        "source": "PPW_AUTHORED"
      }
    ],
    "finishingMoves": [
      {
        "name": "King Kong Lariat",
        "category": "STRIKE",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "Laredo Kid",
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
        "name": "Springboard Hurricanrana",
        "category": "GRAPPLE",
        "source": "PPW_AUTHORED"
      }
    ],
    "finishingMoves": [
      {
        "name": "Laredo Fly",
        "category": "GRAPPLE",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "Murder Clown",
    "gimmickArchetype": "MONSTER",
    "primaryStyle": "POWERHOUSE",
    "secondaryStyle": "BRAWLER",
    "signatureMoves": [
      {
        "name": "Corner Splash",
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
        "name": "Chokeslam",
        "category": "POWER",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "Octagón Jr.",
    "gimmickArchetype": "MASKED_AVENGER",
    "primaryStyle": "LUCHA",
    "secondaryStyle": "TECHNICAL",
    "signatureMoves": [
      {
        "name": "Arm Drag",
        "category": "GRAPPLE",
        "source": "PPW_AUTHORED"
      },
      {
        "name": "Ropewalk Dive",
        "category": "AERIAL",
        "source": "PPW_AUTHORED"
      }
    ],
    "finishingMoves": [
      {
        "name": "Octagon Stretch",
        "category": "SUBMISSION",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "Abismo Negro Jr.",
    "gimmickArchetype": "DARK_ANTI_HERO",
    "primaryStyle": "LUCHA",
    "secondaryStyle": "STRIKER",
    "signatureMoves": [
      {
        "name": "Running Knee",
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
        "name": "Abismo Driver",
        "category": "GRAPPLE",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "BDE",
    "gimmickArchetype": "HIGH_FLYING_DAREDEVIL",
    "primaryStyle": "HIGH_FLYER",
    "secondaryStyle": "ALL_ROUNDER",
    "signatureMoves": [
      {
        "name": "Handspring Back Elbow",
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
        "name": "Shooting Star Press",
        "category": "AERIAL",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "Bear Bronson",
    "gimmickArchetype": "BEAST",
    "primaryStyle": "POWERHOUSE",
    "secondaryStyle": "BRAWLER",
    "signatureMoves": [
      {
        "name": "Running Splash",
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
        "name": "Sit-out Powerbomb",
        "category": "POWER",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "Dutch",
    "gimmickArchetype": "MONSTER",
    "primaryStyle": "POWERHOUSE",
    "secondaryStyle": "BRAWLER",
    "signatureMoves": [
      {
        "name": "Running Back Elbow",
        "category": "STRIKE",
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
        "name": "Black Hole Slam",
        "category": "POWER",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "Elijah",
    "gimmickArchetype": "ROCK_STAR",
    "primaryStyle": "ALL_ROUNDER",
    "secondaryStyle": "BRAWLER",
    "signatureMoves": [
      {
        "name": "Jumping Knee",
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
        "name": "Drift Away",
        "category": "GRAPPLE",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "Fabian Aichner",
    "gimmickArchetype": "WRESTLING_MACHINE",
    "primaryStyle": "POWERHOUSE",
    "secondaryStyle": "TECHNICAL",
    "signatureMoves": [
      {
        "name": "Deadlift German Suplex",
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
        "name": "Sit-out Powerbomb",
        "category": "POWER",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "Frankie Kazarian",
    "gimmickArchetype": "VETERAN_MENTOR",
    "primaryStyle": "ALL_ROUNDER",
    "secondaryStyle": "TECHNICAL",
    "signatureMoves": [
      {
        "name": "Springboard Leg Drop",
        "category": "AERIAL",
        "source": "PPW_AUTHORED"
      },
      {
        "name": "Slingshot DDT",
        "category": "GRAPPLE",
        "source": "PPW_AUTHORED"
      }
    ],
    "finishingMoves": [
      {
        "name": "Fade to Black",
        "category": "GRAPPLE",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "KC Navarro",
    "gimmickArchetype": "SHOW_OFF",
    "primaryStyle": "HIGH_FLYER",
    "secondaryStyle": "STRIKER",
    "signatureMoves": [
      {
        "name": "Springboard Cutter",
        "category": "GRAPPLE",
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
        "name": "Diving DDT",
        "category": "GRAPPLE",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "Rich Swann",
    "gimmickArchetype": "HIGH_FLYING_DAREDEVIL",
    "primaryStyle": "HIGH_FLYER",
    "secondaryStyle": "STRIKER",
    "signatureMoves": [
      {
        "name": "Handspring Cutter",
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
        "name": "Phoenix Splash",
        "category": "AERIAL",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "Alan Angels",
    "gimmickArchetype": "UNDERDOG",
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
        "name": "Wing Snapper",
        "category": "GRAPPLE",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "Andrew Everett",
    "gimmickArchetype": "HIGH_FLYING_DAREDEVIL",
    "primaryStyle": "HIGH_FLYER",
    "secondaryStyle": "LUCHA",
    "signatureMoves": [
      {
        "name": "Shooting Star Press",
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
        "name": "630 Senton",
        "category": "AERIAL",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "Big Damo",
    "gimmickArchetype": "MONSTER",
    "primaryStyle": "POWERHOUSE",
    "secondaryStyle": "BRAWLER",
    "signatureMoves": [
      {
        "name": "Running Senton",
        "category": "POWER",
        "source": "PPW_AUTHORED"
      },
      {
        "name": "Corner Splash",
        "category": "POWER",
        "source": "PPW_AUTHORED"
      }
    ],
    "finishingMoves": [
      {
        "name": "Ulster Plantation",
        "category": "POWER",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "Donovan Dijak",
    "gimmickArchetype": "BEAST",
    "primaryStyle": "POWERHOUSE",
    "secondaryStyle": "STRIKER",
    "signatureMoves": [
      {
        "name": "Feast Your Eyes",
        "category": "STRIKE",
        "source": "PPW_AUTHORED"
      },
      {
        "name": "Spinning Big Boot",
        "category": "STRIKE",
        "source": "PPW_AUTHORED"
      }
    ],
    "finishingMoves": [
      {
        "name": "Time to Fly",
        "category": "POWER",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "Joe Coffey",
    "gimmickArchetype": "BRUISER",
    "primaryStyle": "POWERHOUSE",
    "secondaryStyle": "STRONG_STYLE",
    "signatureMoves": [
      {
        "name": "Glasgow Sendoff",
        "category": "POWER",
        "source": "PPW_AUTHORED"
      },
      {
        "name": "Disciple",
        "category": "GRAPPLE",
        "source": "PPW_AUTHORED"
      }
    ],
    "finishingMoves": [
      {
        "name": "All the Best for the Bells",
        "category": "STRIKE",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "Kerry Morton",
    "gimmickArchetype": "FAMILY_DYNASTY",
    "primaryStyle": "ALL_ROUNDER",
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
        "name": "Showstopper",
        "category": "GRAPPLE",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "Zack Gibson",
    "gimmickArchetype": "TECHNICAL_WIZARD",
    "primaryStyle": "SUBMISSION",
    "secondaryStyle": "BRAWLER",
    "signatureMoves": [
      {
        "name": "Hammerlock",
        "category": "SUBMISSION",
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
        "name": "Shankly Gates",
        "category": "SUBMISSION",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "Tomoaki Honma",
    "gimmickArchetype": "VETERAN_MENTOR",
    "primaryStyle": "STRONG_STYLE",
    "secondaryStyle": "BRAWLER",
    "signatureMoves": [
      {
        "name": "Diving Kokeshi",
        "category": "AERIAL",
        "source": "PPW_AUTHORED"
      },
      {
        "name": "Running Kokeshi",
        "category": "STRIKE",
        "source": "PPW_AUTHORED"
      }
    ],
    "finishingMoves": [
      {
        "name": "Kokeshi Otoshi",
        "category": "GRAPPLE",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "Yoshinobu Kanemaru",
    "gimmickArchetype": "OPPORTUNIST",
    "primaryStyle": "TECHNICAL",
    "secondaryStyle": "SUBMISSION",
    "signatureMoves": [
      {
        "name": "Whisky Mist",
        "category": "OTHER",
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
        "name": "Deep Impact",
        "category": "GRAPPLE",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "Yujiro Takahashi",
    "gimmickArchetype": "OPPORTUNIST",
    "primaryStyle": "BRAWLER",
    "secondaryStyle": "ALL_ROUNDER",
    "signatureMoves": [
      {
        "name": "Fisherman's Buster",
        "category": "GRAPPLE",
        "source": "PPW_AUTHORED"
      },
      {
        "name": "Running Lariat",
        "category": "STRIKE",
        "source": "PPW_AUTHORED"
      }
    ],
    "finishingMoves": [
      {
        "name": "Pimp Juice",
        "category": "GRAPPLE",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "Yoshiki Inamura",
    "gimmickArchetype": "PRIZEFIGHTER",
    "primaryStyle": "POWERHOUSE",
    "secondaryStyle": "STRONG_STYLE",
    "signatureMoves": [
      {
        "name": "Lariat",
        "category": "STRIKE",
        "source": "PPW_AUTHORED"
      },
      {
        "name": "Running Body Block",
        "category": "POWER",
        "source": "PPW_AUTHORED"
      }
    ],
    "finishingMoves": [
      {
        "name": "Muscle Buster",
        "category": "POWER",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "Kento Miyahara",
    "gimmickArchetype": "STRONG_STYLE_ACE",
    "primaryStyle": "STRONG_STYLE",
    "secondaryStyle": "TECHNICAL",
    "signatureMoves": [
      {
        "name": "Blackout Knee",
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
        "name": "Shutdown Suplex Hold",
        "category": "GRAPPLE",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "Atticus Cogar",
    "gimmickArchetype": "EXTREME_DAREDEVIL",
    "primaryStyle": "BRAWLER",
    "secondaryStyle": "STRIKER",
    "signatureMoves": [
      {
        "name": "Skewer Strike",
        "category": "OTHER",
        "source": "PPW_AUTHORED"
      },
      {
        "name": "Suplex",
        "category": "GRAPPLE",
        "source": "PPW_AUTHORED"
      }
    ],
    "finishingMoves": [
      {
        "name": "Brain Hemorrhage",
        "category": "GRAPPLE",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "Neón",
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
        "name": "Tornillo",
        "category": "AERIAL",
        "source": "PPW_AUTHORED"
      }
    ],
    "finishingMoves": [
      {
        "name": "Shooting Star Press",
        "category": "AERIAL",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "Soberano Jr.",
    "gimmickArchetype": "SHOWMAN",
    "primaryStyle": "LUCHA",
    "secondaryStyle": "HIGH_FLYER",
    "signatureMoves": [
      {
        "name": "Springboard Moonsault",
        "category": "AERIAL",
        "source": "PPW_AUTHORED"
      },
      {
        "name": "La Soberana",
        "category": "GRAPPLE",
        "source": "PPW_AUTHORED"
      }
    ],
    "finishingMoves": [
      {
        "name": "Tope Suicida",
        "category": "AERIAL",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "Esfinge",
    "gimmickArchetype": "MASKED_MYSTERY",
    "primaryStyle": "LUCHA",
    "secondaryStyle": "POWERHOUSE",
    "signatureMoves": [
      {
        "name": "Powerbomb",
        "category": "POWER",
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
        "name": "Cavernaria",
        "category": "SUBMISSION",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "Bárbaro Cavernario",
    "gimmickArchetype": "BEAST",
    "primaryStyle": "LUCHA",
    "secondaryStyle": "BRAWLER",
    "signatureMoves": [
      {
        "name": "Caveman Splash",
        "category": "AERIAL",
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
        "name": "La Cavernaria",
        "category": "SUBMISSION",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "Masaaki Mochizuki",
    "gimmickArchetype": "VETERAN_MENTOR",
    "primaryStyle": "STRONG_STYLE",
    "secondaryStyle": "STRIKER",
    "signatureMoves": [
      {
        "name": "Roundhouse Kick",
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
        "name": "Twister",
        "category": "STRIKE",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "Averno",
    "gimmickArchetype": "DARK_ANTI_HERO",
    "primaryStyle": "LUCHA",
    "secondaryStyle": "TECHNICAL",
    "signatureMoves": [
      {
        "name": "Devil's Wings",
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
        "name": "Averno Driver",
        "category": "GRAPPLE",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "Gran Guerrero",
    "gimmickArchetype": "ENFORCER",
    "primaryStyle": "POWERHOUSE",
    "secondaryStyle": "LUCHA",
    "signatureMoves": [
      {
        "name": "Running Powerslam",
        "category": "POWER",
        "source": "PPW_AUTHORED"
      },
      {
        "name": "Tope Con Giro",
        "category": "AERIAL",
        "source": "PPW_AUTHORED"
      }
    ],
    "finishingMoves": [
      {
        "name": "Gran Guerrero Special",
        "category": "GRAPPLE",
        "source": "PPW_AUTHORED"
      }
    ]
  }
];
