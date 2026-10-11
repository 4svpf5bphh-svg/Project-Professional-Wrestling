/** PPW editorial identity review — wave 8, October 2026.
 * Exact-name AEW/ROH, TNA, NOAH and Mexican/women's lucha identity pass.
 * Where official move evidence is thin, moves are approximate in-game
 * presentations; NONE are marked verified. No edits to existing World saves.
 */
import type { PortableIdentityMove } from "../../domain/src/wrestler-identity.js";
export interface ReviewedRosterIdentityWave8 {
 name:string;gimmickArchetype:string;primaryStyle:string;
 secondaryStyle:string|null;signatureMoves:PortableIdentityMove[];
 finishingMoves:PortableIdentityMove[];
}
export const REVIEWED_REAL_ROSTER_IDENTITIES_WAVE8: readonly ReviewedRosterIdentityWave8[] = [
  {
    "name": "Aaron Solo",
    "gimmickArchetype": "OPPORTUNIST",
    "primaryStyle": "ALL_ROUNDER",
    "secondaryStyle": "TECHNICAL",
    "signatureMoves": [
      {
        "name": "Spinning Neckbreaker",
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
        "name": "Rolling Cutter",
        "category": "GRAPPLE",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "Adam Priest",
    "gimmickArchetype": "WRESTLING_MACHINE",
    "primaryStyle": "TECHNICAL",
    "secondaryStyle": "SUBMISSION",
    "signatureMoves": [
      {
        "name": "Wristlock Suplex",
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
        "name": "Crossface",
        "category": "SUBMISSION",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "Alec Price",
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
        "name": "Running Shooting Star Press",
        "category": "AERIAL",
        "source": "PPW_AUTHORED"
      }
    ],
    "finishingMoves": [
      {
        "name": "Suicide Dive DDT",
        "category": "GRAPPLE",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "Alex Reynolds",
    "gimmickArchetype": "OPPORTUNIST",
    "primaryStyle": "ALL_ROUNDER",
    "secondaryStyle": "TECHNICAL",
    "signatureMoves": [
      {
        "name": "Running Elbow",
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
        "name": "Rolling Neckbreaker",
        "category": "GRAPPLE",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "Angelo Parker",
    "gimmickArchetype": "SHOWMAN",
    "primaryStyle": "BRAWLER",
    "secondaryStyle": "ALL_ROUNDER",
    "signatureMoves": [
      {
        "name": "Snap Suplex",
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
        "name": "Diving DDT",
        "category": "GRAPPLE",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "Anthony Henry",
    "gimmickArchetype": "TECHNICAL_WIZARD",
    "primaryStyle": "TECHNICAL",
    "secondaryStyle": "STRONG_STYLE",
    "signatureMoves": [
      {
        "name": "Bridging German Suplex",
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
        "name": "Ankle Lock",
        "category": "SUBMISSION",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "Ariya Daivari",
    "gimmickArchetype": "WEALTHY_VILLAIN",
    "primaryStyle": "ALL_ROUNDER",
    "secondaryStyle": "TECHNICAL",
    "signatureMoves": [
      {
        "name": "Diving Splash",
        "category": "AERIAL",
        "source": "PPW_AUTHORED"
      },
      {
        "name": "Russian Leg Sweep",
        "category": "GRAPPLE",
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
    "name": "\"Big Boom!\" A.J.",
    "gimmickArchetype": "CELEBRITY",
    "primaryStyle": "POWERHOUSE",
    "secondaryStyle": "ALL_ROUNDER",
    "signatureMoves": [
      {
        "name": "Clothesline",
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
        "name": "Powerbomb",
        "category": "POWER",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "Bishop Kaun",
    "gimmickArchetype": "ENFORCER",
    "primaryStyle": "POWERHOUSE",
    "secondaryStyle": "STRONG_STYLE",
    "signatureMoves": [
      {
        "name": "Spinning Back Elbow",
        "category": "STRIKE",
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
        "name": "Powerbomb",
        "category": "POWER",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "Carlie Bravo",
    "gimmickArchetype": "STREET_FIGHTER",
    "primaryStyle": "ALL_ROUNDER",
    "secondaryStyle": "HIGH_FLYER",
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
        "name": "Springboard Cutter",
        "category": "GRAPPLE",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "Cole Karter",
    "gimmickArchetype": "SHOW_OFF",
    "primaryStyle": "ALL_ROUNDER",
    "secondaryStyle": "HIGH_FLYER",
    "signatureMoves": [
      {
        "name": "Springboard Dropkick",
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
        "name": "Diving Elbow Drop",
        "category": "AERIAL",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "Dezmond Xavier",
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
        "name": "Springboard Moonsault",
        "category": "AERIAL",
        "source": "PPW_AUTHORED"
      }
    ],
    "finishingMoves": [
      {
        "name": "Final Flash",
        "category": "AERIAL",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "El Clon",
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
        "name": "Diving Double Stomp",
        "category": "AERIAL",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "Griff Garrison",
    "gimmickArchetype": "SPORTING",
    "primaryStyle": "ALL_ROUNDER",
    "secondaryStyle": "POWERHOUSE",
    "signatureMoves": [
      {
        "name": "Dropkick",
        "category": "STRIKE",
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
        "name": "Spinebuster",
        "category": "POWER",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "Jacked Jameson",
    "gimmickArchetype": "ARROGANT_ACE",
    "primaryStyle": "POWERHOUSE",
    "secondaryStyle": "BRAWLER",
    "signatureMoves": [
      {
        "name": "Powerslam",
        "category": "POWER",
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
        "name": "Sit-out Slam",
        "category": "POWER",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "Jake Doyle",
    "gimmickArchetype": "ENFORCER",
    "primaryStyle": "POWERHOUSE",
    "secondaryStyle": "BRAWLER",
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
        "name": "Spinning Side Slam",
        "category": "POWER",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "Lee Johnson",
    "gimmickArchetype": "HIGH_FLYING_DAREDEVIL",
    "primaryStyle": "HIGH_FLYER",
    "secondaryStyle": "ALL_ROUNDER",
    "signatureMoves": [
      {
        "name": "Springboard Dropkick",
        "category": "STRIKE",
        "source": "PPW_AUTHORED"
      },
      {
        "name": "Standing Moonsault",
        "category": "AERIAL",
        "source": "PPW_AUTHORED"
      }
    ],
    "finishingMoves": [
      {
        "name": "Brainbuster",
        "category": "GRAPPLE",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "Mansoor",
    "gimmickArchetype": "SHOWMAN",
    "primaryStyle": "ALL_ROUNDER",
    "secondaryStyle": "HIGH_FLYER",
    "signatureMoves": [
      {
        "name": "Springboard Crossbody",
        "category": "AERIAL",
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
        "name": "Slingshot DDT",
        "category": "GRAPPLE",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "Matt Menard",
    "gimmickArchetype": "SHOWMAN",
    "primaryStyle": "BRAWLER",
    "secondaryStyle": "ALL_ROUNDER",
    "signatureMoves": [
      {
        "name": "Knife-edge Chop",
        "category": "STRIKE",
        "source": "PPW_AUTHORED"
      },
      {
        "name": "Corner Lariat",
        "category": "STRIKE",
        "source": "PPW_AUTHORED"
      }
    ],
    "finishingMoves": [
      {
        "name": "Piledriver",
        "category": "GRAPPLE",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "Mike Bennett",
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
        "name": "Spinebuster",
        "category": "POWER",
        "source": "PPW_AUTHORED"
      }
    ],
    "finishingMoves": [
      {
        "name": "Piledriver",
        "category": "GRAPPLE",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "Hyan",
    "gimmickArchetype": "WRESTLING_MACHINE",
    "primaryStyle": "TECHNICAL",
    "secondaryStyle": "STRONG_STYLE",
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
        "name": "Bridging Suplex",
        "category": "GRAPPLE",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "Maya World",
    "gimmickArchetype": "SPORTING",
    "primaryStyle": "ALL_ROUNDER",
    "secondaryStyle": "HIGH_FLYER",
    "signatureMoves": [
      {
        "name": "Standing Dropkick",
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
        "name": "Tornado DDT",
        "category": "GRAPPLE",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "Tay Melo",
    "gimmickArchetype": "MMA_CROSSOVER",
    "primaryStyle": "STRIKER",
    "secondaryStyle": "SUBMISSION",
    "signatureMoves": [
      {
        "name": "Judo Throw",
        "category": "GRAPPLE",
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
        "name": "Tay-KO",
        "category": "GRAPPLE",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "Jamie Hayter",
    "gimmickArchetype": "STRONG_STYLE_ACE",
    "primaryStyle": "STRONG_STYLE",
    "secondaryStyle": "BRAWLER",
    "signatureMoves": [
      {
        "name": "Backbreaker",
        "category": "POWER",
        "source": "PPW_AUTHORED"
      },
      {
        "name": "Sliding Lariat",
        "category": "STRIKE",
        "source": "PPW_AUTHORED"
      }
    ],
    "finishingMoves": [
      {
        "name": "Hayterade",
        "category": "STRIKE",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "Leila Grey",
    "gimmickArchetype": "SHOW_OFF",
    "primaryStyle": "ALL_ROUNDER",
    "secondaryStyle": "STRIKER",
    "signatureMoves": [
      {
        "name": "Dropkick",
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
        "name": "Running Knee",
        "category": "STRIKE",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "Madison Rayne",
    "gimmickArchetype": "VETERAN_MENTOR",
    "primaryStyle": "ALL_ROUNDER",
    "secondaryStyle": "TECHNICAL",
    "signatureMoves": [
      {
        "name": "Northern Lights Suplex",
        "category": "GRAPPLE",
        "source": "PPW_AUTHORED"
      },
      {
        "name": "Running Dropkick",
        "category": "STRIKE",
        "source": "PPW_AUTHORED"
      }
    ],
    "finishingMoves": [
      {
        "name": "Rayne Drop",
        "category": "GRAPPLE",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "Mercedes Moné",
    "gimmickArchetype": "SHOWMAN",
    "primaryStyle": "TECHNICAL",
    "secondaryStyle": "SUBMISSION",
    "signatureMoves": [
      {
        "name": "Statement Maker",
        "category": "SUBMISSION",
        "source": "PPW_AUTHORED"
      },
      {
        "name": "Meteora",
        "category": "STRIKE",
        "source": "PPW_AUTHORED"
      }
    ],
    "finishingMoves": [
      {
        "name": "Moné Maker",
        "category": "GRAPPLE",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "Persephone",
    "gimmickArchetype": "REBEL_LUCHADOR",
    "primaryStyle": "LUCHA",
    "secondaryStyle": "STRONG_STYLE",
    "signatureMoves": [
      {
        "name": "Diving Crossbody",
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
        "name": "Double Knee Strike",
        "category": "STRIKE",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "Zayda Steel",
    "gimmickArchetype": "SHOW_OFF",
    "primaryStyle": "HIGH_FLYER",
    "secondaryStyle": "ALL_ROUNDER",
    "signatureMoves": [
      {
        "name": "Springboard Crossbody",
        "category": "AERIAL",
        "source": "PPW_AUTHORED"
      },
      {
        "name": "Running Dropkick",
        "category": "STRIKE",
        "source": "PPW_AUTHORED"
      }
    ],
    "finishingMoves": [
      {
        "name": "Diving Neckbreaker",
        "category": "GRAPPLE",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "Lena Kross",
    "gimmickArchetype": "BEAST",
    "primaryStyle": "POWERHOUSE",
    "secondaryStyle": "STRIKER",
    "signatureMoves": [
      {
        "name": "Running Big Boot",
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
        "name": "Powerbomb",
        "category": "POWER",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "The Home Town Man",
    "gimmickArchetype": "FAN_FAVOURITE",
    "primaryStyle": "ALL_ROUNDER",
    "secondaryStyle": "BRAWLER",
    "signatureMoves": [
      {
        "name": "Running Clothesline",
        "category": "STRIKE",
        "source": "PPW_AUTHORED"
      },
      {
        "name": "Schoolboy Pin",
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
    "name": "Jason Hotch",
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
        "name": "450 Splash",
        "category": "AERIAL",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "John Skyler",
    "gimmickArchetype": "OPPORTUNIST",
    "primaryStyle": "ALL_ROUNDER",
    "secondaryStyle": "TECHNICAL",
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
        "name": "Spinning Neckbreaker",
        "category": "GRAPPLE",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "Mr. Elegance",
    "gimmickArchetype": "SHOW_OFF",
    "primaryStyle": "ALL_ROUNDER",
    "secondaryStyle": "STRIKER",
    "signatureMoves": [
      {
        "name": "Running Knee",
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
        "name": "Spinning DDT",
        "category": "GRAPPLE",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "Ricky Sosa",
    "gimmickArchetype": "HIGH_FLYING_DAREDEVIL",
    "primaryStyle": "HIGH_FLYER",
    "secondaryStyle": "BRAWLER",
    "signatureMoves": [
      {
        "name": "Suicide Dive",
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
        "name": "Diving Cutter",
        "category": "GRAPPLE",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "M By Elegance",
    "gimmickArchetype": "SHOW_OFF",
    "primaryStyle": "ALL_ROUNDER",
    "secondaryStyle": "STRIKER",
    "signatureMoves": [
      {
        "name": "Jumping Knee",
        "category": "STRIKE",
        "source": "PPW_AUTHORED"
      },
      {
        "name": "Spinning Neckbreaker",
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
    "name": "Zoey Serrano",
    "gimmickArchetype": "UNDERDOG",
    "primaryStyle": "HIGH_FLYER",
    "secondaryStyle": "ALL_ROUNDER",
    "signatureMoves": [
      {
        "name": "Dropkick",
        "category": "STRIKE",
        "source": "PPW_AUTHORED"
      },
      {
        "name": "Springboard Arm Drag",
        "category": "GRAPPLE",
        "source": "PPW_AUTHORED"
      }
    ],
    "finishingMoves": [
      {
        "name": "Tornado DDT",
        "category": "GRAPPLE",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "Mara Sadé",
    "gimmickArchetype": "HIGH_FLYING_DAREDEVIL",
    "primaryStyle": "HIGH_FLYER",
    "secondaryStyle": "STRIKER",
    "signatureMoves": [
      {
        "name": "Springboard Crossbody",
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
        "name": "Diving Double Stomp",
        "category": "AERIAL",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "Jada Stone",
    "gimmickArchetype": "HIGH_FLYING_DAREDEVIL",
    "primaryStyle": "HIGH_FLYER",
    "secondaryStyle": "LUCHA",
    "signatureMoves": [
      {
        "name": "Tornillo",
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
        "name": "Diving Moonsault",
        "category": "AERIAL",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "Atsushi Kotoge",
    "gimmickArchetype": "PRIZEFIGHTER",
    "primaryStyle": "STRONG_STYLE",
    "secondaryStyle": "STRIKER",
    "signatureMoves": [
      {
        "name": "Corner Dropkick",
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
        "name": "Kotoge Crash",
        "category": "GRAPPLE",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "Hi69",
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
        "name": "Missile Dropkick",
        "category": "STRIKE",
        "source": "PPW_AUTHORED"
      }
    ],
    "finishingMoves": [
      {
        "name": "Diving Foot Stomp",
        "category": "AERIAL",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "OZAWA",
    "gimmickArchetype": "ARROGANT_ACE",
    "primaryStyle": "HIGH_FLYER",
    "secondaryStyle": "STRONG_STYLE",
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
        "name": "Real Rebel",
        "category": "GRAPPLE",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "Shuhei Taniguchi",
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
        "name": "Spinning Back Elbow",
        "category": "STRIKE",
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
    "name": "La Parka",
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
        "name": "Tope Con Giro",
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
    "name": "Candela",
    "gimmickArchetype": "HIGH_FLYING_DAREDEVIL",
    "primaryStyle": "LUCHA",
    "secondaryStyle": "HIGH_FLYER",
    "signatureMoves": [
      {
        "name": "Tope Suicida",
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
        "name": "Diving Senton",
        "category": "AERIAL",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "Tabata",
    "gimmickArchetype": "MASKED_MYSTERY",
    "primaryStyle": "LUCHA",
    "secondaryStyle": "TECHNICAL",
    "signatureMoves": [
      {
        "name": "Tilt-A-Whirl Arm Drag",
        "category": "GRAPPLE",
        "source": "PPW_AUTHORED"
      },
      {
        "name": "La Magistral",
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
    "name": "Nexy",
    "gimmickArchetype": "SPORTING",
    "primaryStyle": "LUCHA",
    "secondaryStyle": "TECHNICAL",
    "signatureMoves": [
      {
        "name": "Arm Drag",
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
        "name": "Bridging Suplex",
        "category": "GRAPPLE",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "Valkyria",
    "gimmickArchetype": "MASKED_MYSTERY",
    "primaryStyle": "LUCHA",
    "secondaryStyle": "STRIKER",
    "signatureMoves": [
      {
        "name": "Tilt-A-Whirl Headscissors",
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
        "name": "Sunset Flip Powerbomb",
        "category": "POWER",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "Alexius",
    "gimmickArchetype": "HIGH_FLYING_DAREDEVIL",
    "primaryStyle": "LUCHA",
    "secondaryStyle": "HIGH_FLYER",
    "signatureMoves": [
      {
        "name": "Springboard Plancha",
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
        "name": "450 Splash",
        "category": "AERIAL",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "Feroz",
    "gimmickArchetype": "SPORTING",
    "primaryStyle": "LUCHA",
    "secondaryStyle": "TECHNICAL",
    "signatureMoves": [
      {
        "name": "Backbreaker",
        "category": "POWER",
        "source": "PPW_AUTHORED"
      },
      {
        "name": "La Casita",
        "category": "GRAPPLE",
        "source": "PPW_AUTHORED"
      }
    ],
    "finishingMoves": [
      {
        "name": "Fisherman's Suplex",
        "category": "GRAPPLE",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "Hécate",
    "gimmickArchetype": "GOTHIC_ICON",
    "primaryStyle": "LUCHA",
    "secondaryStyle": "STRIKER",
    "signatureMoves": [
      {
        "name": "Spinning Back Kick",
        "category": "STRIKE",
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
        "name": "Devil's Wings",
        "category": "GRAPPLE",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "Adelicious",
    "gimmickArchetype": "SHOW_OFF",
    "primaryStyle": "HIGH_FLYER",
    "secondaryStyle": "LUCHA",
    "signatureMoves": [
      {
        "name": "Springboard Cutter",
        "category": "GRAPPLE",
        "source": "PPW_AUTHORED"
      },
      {
        "name": "Standing Moonsault",
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
  }
];
