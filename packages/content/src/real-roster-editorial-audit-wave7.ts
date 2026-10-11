/** PPW editorial identity review — wave 7, October 2026.
 * Covers EVERY remaining WWE/NXT seed guide cohort approximation by exact name,
 * including women's wrestlers whose verified data still takes precedence.
 * All moves tagged PPW_AUTHORED (not sourced facts) pending per-move evidence.
 * For unfamiliar/limited public documentation, generic but style-coherent move
 * terms are deliberate PPW-fictional candidates, not alleged real signatures.
 * No runtime edits of saved identities, no wrestler contract claims.
 * Reference examples for later move-by-move provenance checks:
 * https://www.wwe.com/superstars/penta
 * https://www.wwe.com/superstars/bianca-belair
 * https://www.wwe.com/superstars/roman-reigns
 */
import type { PortableIdentityMove } from "../../domain/src/wrestler-identity.js";
export interface ReviewedRosterIdentityWave7 {
  name: string; gimmickArchetype: string; primaryStyle: string;
  secondaryStyle: string | null; signatureMoves: PortableIdentityMove[];
  finishingMoves: PortableIdentityMove[];
}
export const REVIEWED_REAL_ROSTER_IDENTITIES_WAVE7: readonly ReviewedRosterIdentityWave7[] = [
  {
    "name": "Aaron Rourke",
    "gimmickArchetype": "TOUGH_GUY",
    "primaryStyle": "BRAWLER",
    "secondaryStyle": "POWERHOUSE",
    "signatureMoves": [
      {
        "name": "Shoulder Block",
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
        "name": "Spinebuster",
        "category": "POWER",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "Angel",
    "gimmickArchetype": "SHOW_OFF",
    "primaryStyle": "LUCHA",
    "secondaryStyle": "ALL_ROUNDER",
    "signatureMoves": [
      {
        "name": "Springboard Dropkick",
        "category": "STRIKE",
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
        "name": "Wing Clipper",
        "category": "GRAPPLE",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "Berto",
    "gimmickArchetype": "HIGH_FLYING_DAREDEVIL",
    "primaryStyle": "LUCHA",
    "secondaryStyle": "HIGH_FLYER",
    "signatureMoves": [
      {
        "name": "Springboard Crossbody",
        "category": "AERIAL",
        "source": "PPW_AUTHORED"
      },
      {
        "name": "Tilt-A-Whirl Backbreaker",
        "category": "POWER",
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
    "name": "Blake Howard",
    "gimmickArchetype": "SPORTING",
    "primaryStyle": "ALL_ROUNDER",
    "secondaryStyle": "HIGH_FLYER",
    "signatureMoves": [
      {
        "name": "Springboard Arm Drag",
        "category": "GRAPPLE",
        "source": "PPW_AUTHORED"
      },
      {
        "name": "Running Uppercut",
        "category": "STRIKE",
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
    "name": "Brad Baylor",
    "gimmickArchetype": "STREET_FIGHTER",
    "primaryStyle": "BRAWLER",
    "secondaryStyle": "STRIKER",
    "signatureMoves": [
      {
        "name": "Running Knee",
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
        "name": "Powerslam",
        "category": "POWER",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "Bravo Americano",
    "gimmickArchetype": "COMEDY",
    "primaryStyle": "LUCHA",
    "secondaryStyle": "POWERHOUSE",
    "signatureMoves": [
      {
        "name": "Airplane Spin",
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
        "name": "Diving Headbutt",
        "category": "AERIAL",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "Bronco Nima",
    "gimmickArchetype": "ENFORCER",
    "primaryStyle": "POWERHOUSE",
    "secondaryStyle": "BRAWLER",
    "signatureMoves": [
      {
        "name": "Running Splash",
        "category": "POWER",
        "source": "PPW_AUTHORED"
      },
      {
        "name": "Shoulder Tackle",
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
    "name": "Channing \"Stacks\" Lorenzo",
    "gimmickArchetype": "OPPORTUNIST",
    "primaryStyle": "BRAWLER",
    "secondaryStyle": "ALL_ROUNDER",
    "signatureMoves": [
      {
        "name": "Running Clothesline",
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
        "name": "Spinning Neckbreaker",
        "category": "GRAPPLE",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "Cruz Montana",
    "gimmickArchetype": "PRIZEFIGHTER",
    "primaryStyle": "BRAWLER",
    "secondaryStyle": "STRIKER",
    "signatureMoves": [
      {
        "name": "European Uppercut",
        "category": "STRIKE",
        "source": "PPW_AUTHORED"
      },
      {
        "name": "Corner Elbow",
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
    "name": "Cutler James",
    "gimmickArchetype": "WRESTLING_MACHINE",
    "primaryStyle": "TECHNICAL",
    "secondaryStyle": "POWERHOUSE",
    "signatureMoves": [
      {
        "name": "Gutwrench Suplex",
        "category": "GRAPPLE",
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
        "name": "Bridging German Suplex",
        "category": "GRAPPLE",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "Dion Lennox",
    "gimmickArchetype": "ENFORCER",
    "primaryStyle": "POWERHOUSE",
    "secondaryStyle": "BRAWLER",
    "signatureMoves": [
      {
        "name": "Running Powerslam",
        "category": "POWER",
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
        "name": "Uranage",
        "category": "POWER",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "Dorian Van Dux",
    "gimmickArchetype": "ARROGANT_ACE",
    "primaryStyle": "TECHNICAL",
    "secondaryStyle": "ALL_ROUNDER",
    "signatureMoves": [
      {
        "name": "Arm Drag",
        "category": "GRAPPLE",
        "source": "PPW_AUTHORED"
      },
      {
        "name": "Northern Lights Suplex",
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
    "name": "EK Prosper",
    "gimmickArchetype": "SPORTING",
    "primaryStyle": "TECHNICAL",
    "secondaryStyle": "STRIKER",
    "signatureMoves": [
      {
        "name": "Arm Drag",
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
        "name": "Fisherman's Suplex",
        "category": "GRAPPLE",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "El Grande Americano",
    "gimmickArchetype": "MASKED_MYSTERY",
    "primaryStyle": "LUCHA",
    "secondaryStyle": "TECHNICAL",
    "signatureMoves": [
      {
        "name": "German Suplex",
        "category": "GRAPPLE",
        "source": "PPW_AUTHORED"
      },
      {
        "name": "Rolling Ankle Takedown",
        "category": "GRAPPLE",
        "source": "PPW_AUTHORED"
      }
    ],
    "finishingMoves": [
      {
        "name": "Diving Headbutt",
        "category": "AERIAL",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "Elio LeFleur",
    "gimmickArchetype": "FAN_FAVOURITE",
    "primaryStyle": "HIGH_FLYER",
    "secondaryStyle": "ALL_ROUNDER",
    "signatureMoves": [
      {
        "name": "Springboard Crossbody",
        "category": "AERIAL",
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
        "name": "Top Rope Splash",
        "category": "AERIAL",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "Erik",
    "gimmickArchetype": "ENFORCER",
    "primaryStyle": "POWERHOUSE",
    "secondaryStyle": "BRAWLER",
    "signatureMoves": [
      {
        "name": "Running Knee",
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
    "name": "Hank Walker",
    "gimmickArchetype": "TOUGH_GUY",
    "primaryStyle": "BRAWLER",
    "secondaryStyle": "POWERHOUSE",
    "signatureMoves": [
      {
        "name": "Shoulder Block",
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
        "name": "Sit-out Spinebuster",
        "category": "POWER",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "Jackson Drake",
    "gimmickArchetype": "ARROGANT_ACE",
    "primaryStyle": "STRIKER",
    "secondaryStyle": "ALL_ROUNDER",
    "signatureMoves": [
      {
        "name": "Pump Kick",
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
        "name": "Spinning Neckbreaker",
        "category": "GRAPPLE",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "Jasper Troy",
    "gimmickArchetype": "GIANT",
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
        "name": "Powerbomb",
        "category": "POWER",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "Joaquin Wilde",
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
        "name": "Springboard Dropkick",
        "category": "STRIKE",
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
    "name": "Josh Briggs",
    "gimmickArchetype": "BRUISER",
    "primaryStyle": "POWERHOUSE",
    "secondaryStyle": "BRAWLER",
    "signatureMoves": [
      {
        "name": "Big Boot",
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
        "name": "Chokeslam",
        "category": "POWER",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "Kam Hendrix",
    "gimmickArchetype": "ENFORCER",
    "primaryStyle": "POWERHOUSE",
    "secondaryStyle": "STRIKER",
    "signatureMoves": [
      {
        "name": "Spinebuster",
        "category": "POWER",
        "source": "PPW_AUTHORED"
      },
      {
        "name": "Running Forearm",
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
    "name": "Keanu Carver",
    "gimmickArchetype": "MONSTER",
    "primaryStyle": "POWERHOUSE",
    "secondaryStyle": "BRAWLER",
    "signatureMoves": [
      {
        "name": "Shoulder Tackle",
        "category": "STRIKE",
        "source": "PPW_AUTHORED"
      },
      {
        "name": "Running Splash",
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
    "name": "Lucien Price",
    "gimmickArchetype": "STREET_FIGHTER",
    "primaryStyle": "BRAWLER",
    "secondaryStyle": "POWERHOUSE",
    "signatureMoves": [
      {
        "name": "Double Axe Handle",
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
        "name": "Sit-out Slam",
        "category": "POWER",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "Mark Nash",
    "gimmickArchetype": "SPORTING",
    "primaryStyle": "TECHNICAL",
    "secondaryStyle": "BRAWLER",
    "signatureMoves": [
      {
        "name": "European Uppercut",
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
        "name": "Bridging Northern Lights Suplex",
        "category": "GRAPPLE",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "Mason Rook",
    "gimmickArchetype": "FAN_FAVOURITE",
    "primaryStyle": "ALL_ROUNDER",
    "secondaryStyle": "STRIKER",
    "signatureMoves": [
      {
        "name": "Standing Dropkick",
        "category": "STRIKE",
        "source": "PPW_AUTHORED"
      },
      {
        "name": "Running Bulldog",
        "category": "GRAPPLE",
        "source": "PPW_AUTHORED"
      }
    ],
    "finishingMoves": [
      {
        "name": "Jumping Knee",
        "category": "STRIKE",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "Niko Vance",
    "gimmickArchetype": "DARK_ANTI_HERO",
    "primaryStyle": "POWERHOUSE",
    "secondaryStyle": "BRAWLER",
    "signatureMoves": [
      {
        "name": "Running Lariat",
        "category": "STRIKE",
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
        "name": "Dominator",
        "category": "POWER",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "Osiris Griffin",
    "gimmickArchetype": "ENFORCER",
    "primaryStyle": "POWERHOUSE",
    "secondaryStyle": "STRIKER",
    "signatureMoves": [
      {
        "name": "Spinebuster",
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
        "name": "Powerbomb",
        "category": "POWER",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "Penta",
    "gimmickArchetype": "REBEL_LUCHADOR",
    "primaryStyle": "LUCHA",
    "secondaryStyle": "STRIKER",
    "signatureMoves": [
      {
        "name": "The Sacrifice",
        "category": "SUBMISSION",
        "source": "PPW_AUTHORED"
      },
      {
        "name": "Sling Blade",
        "category": "GRAPPLE",
        "source": "PPW_AUTHORED"
      }
    ],
    "finishingMoves": [
      {
        "name": "Mexican Destroyer",
        "category": "GRAPPLE",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "Rayo Americano",
    "gimmickArchetype": "MASKED_MYSTERY",
    "primaryStyle": "TECHNICAL",
    "secondaryStyle": "LUCHA",
    "signatureMoves": [
      {
        "name": "Finger Manipulation",
        "category": "SUBMISSION",
        "source": "PPW_AUTHORED"
      },
      {
        "name": "Step-up Enzuigiri",
        "category": "STRIKE",
        "source": "PPW_AUTHORED"
      }
    ],
    "finishingMoves": [
      {
        "name": "Bitter End",
        "category": "GRAPPLE",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "Ricky Smokes",
    "gimmickArchetype": "ARROGANT_ACE",
    "primaryStyle": "ALL_ROUNDER",
    "secondaryStyle": "BRAWLER",
    "signatureMoves": [
      {
        "name": "Running Clothesline",
        "category": "STRIKE",
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
        "name": "Neckbreaker",
        "category": "GRAPPLE",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "Romeo Moreno",
    "gimmickArchetype": "SPORTING",
    "primaryStyle": "STRIKER",
    "secondaryStyle": "ALL_ROUNDER",
    "signatureMoves": [
      {
        "name": "Roundhouse Kick",
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
        "name": "Running Knee",
        "category": "STRIKE",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "Royce Keys",
    "gimmickArchetype": "POWERHOUSE",
    "primaryStyle": "POWERHOUSE",
    "secondaryStyle": "BRAWLER",
    "signatureMoves": [
      {
        "name": "Spinebuster",
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
        "name": "Town Business",
        "category": "POWER",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "Saquon Shugars",
    "gimmickArchetype": "STREET_FIGHTER",
    "primaryStyle": "BRAWLER",
    "secondaryStyle": "STRIKER",
    "signatureMoves": [
      {
        "name": "Running Knee",
        "category": "STRIKE",
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
        "name": "Neckbreaker",
        "category": "GRAPPLE",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "Sean Legacy",
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
        "name": "Shooting Star Press",
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
    "name": "Shiloh Hill",
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
        "name": "Corner Splash",
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
    "name": "Talla Tonga",
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
        "name": "Running Splash",
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
    "name": "Tank Ledger",
    "gimmickArchetype": "BRUISER",
    "primaryStyle": "BRAWLER",
    "secondaryStyle": "POWERHOUSE",
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
        "name": "Spinebuster",
        "category": "POWER",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "Tate Wilder",
    "gimmickArchetype": "SPORTING",
    "primaryStyle": "TECHNICAL",
    "secondaryStyle": "ALL_ROUNDER",
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
    "name": "Tavion Heights",
    "gimmickArchetype": "WRESTLING_MACHINE",
    "primaryStyle": "TECHNICAL",
    "secondaryStyle": "POWERHOUSE",
    "signatureMoves": [
      {
        "name": "Belly-to-Belly Throw",
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
        "name": "Olympic Slam",
        "category": "POWER",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "Tristan Angels",
    "gimmickArchetype": "SHOW_OFF",
    "primaryStyle": "HIGH_FLYER",
    "secondaryStyle": "STRIKER",
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
        "name": "Tornado DDT",
        "category": "GRAPPLE",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "AJ Lee",
    "gimmickArchetype": "CULT_FAVOURITE",
    "primaryStyle": "SUBMISSION",
    "secondaryStyle": "ALL_ROUNDER",
    "signatureMoves": [
      {
        "name": "Shining Wizard",
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
        "name": "Black Widow",
        "category": "SUBMISSION",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "Alexa Bliss",
    "gimmickArchetype": "DARK_ANTI_HERO",
    "primaryStyle": "ALL_ROUNDER",
    "secondaryStyle": "STRIKER",
    "signatureMoves": [
      {
        "name": "Insult to Injury",
        "category": "AERIAL",
        "source": "PPW_AUTHORED"
      },
      {
        "name": "Sister Abigail",
        "category": "GRAPPLE",
        "source": "PPW_AUTHORED"
      }
    ],
    "finishingMoves": [
      {
        "name": "Twisted Bliss",
        "category": "AERIAL",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "Arianna Grace",
    "gimmickArchetype": "SHOWMAN",
    "primaryStyle": "ALL_ROUNDER",
    "secondaryStyle": "TECHNICAL",
    "signatureMoves": [
      {
        "name": "Arm Drag",
        "category": "GRAPPLE",
        "source": "PPW_AUTHORED"
      },
      {
        "name": "Running Bulldog",
        "category": "GRAPPLE",
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
    "name": "Asuka",
    "gimmickArchetype": "STRONG_STYLE_ACE",
    "primaryStyle": "STRIKER",
    "secondaryStyle": "SUBMISSION",
    "signatureMoves": [
      {
        "name": "Hip Attack",
        "category": "STRIKE",
        "source": "PPW_AUTHORED"
      },
      {
        "name": "Spinning Backfist",
        "category": "STRIKE",
        "source": "PPW_AUTHORED"
      }
    ],
    "finishingMoves": [
      {
        "name": "Asuka Lock",
        "category": "SUBMISSION",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "Bayley",
    "gimmickArchetype": "FAN_FAVOURITE",
    "primaryStyle": "ALL_ROUNDER",
    "secondaryStyle": "TECHNICAL",
    "signatureMoves": [
      {
        "name": "Bayley-to-Belly",
        "category": "POWER",
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
        "name": "Rose Plant",
        "category": "GRAPPLE",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "Becky Lynch",
    "gimmickArchetype": "REBEL",
    "primaryStyle": "ALL_ROUNDER",
    "secondaryStyle": "SUBMISSION",
    "signatureMoves": [
      {
        "name": "Manhandle Slam",
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
        "name": "Dis-arm-her",
        "category": "SUBMISSION",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "Bianca Belair",
    "gimmickArchetype": "POWERHOUSE",
    "primaryStyle": "POWERHOUSE",
    "secondaryStyle": "HIGH_FLYER",
    "signatureMoves": [
      {
        "name": "Handspring Moonsault",
        "category": "AERIAL",
        "source": "PPW_AUTHORED"
      },
      {
        "name": "Delayed Vertical Suplex",
        "category": "GRAPPLE",
        "source": "PPW_AUTHORED"
      }
    ],
    "finishingMoves": [
      {
        "name": "KOD",
        "category": "POWER",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "Charlotte Flair",
    "gimmickArchetype": "QUEEN",
    "primaryStyle": "TECHNICAL",
    "secondaryStyle": "SUBMISSION",
    "signatureMoves": [
      {
        "name": "Natural Selection",
        "category": "GRAPPLE",
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
        "name": "Figure-Eight Leglock",
        "category": "SUBMISSION",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "Chelsea Green",
    "gimmickArchetype": "COMEDY",
    "primaryStyle": "ALL_ROUNDER",
    "secondaryStyle": "STRIKER",
    "signatureMoves": [
      {
        "name": "Unprettier",
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
        "name": "Rough Ryder",
        "category": "GRAPPLE",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "Giulia",
    "gimmickArchetype": "STRONG_STYLE_ACE",
    "primaryStyle": "STRONG_STYLE",
    "secondaryStyle": "TECHNICAL",
    "signatureMoves": [
      {
        "name": "Northern Lights Bomb",
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
        "name": "Glorious Driver",
        "category": "GRAPPLE",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "IYO SKY",
    "gimmickArchetype": "HIGH_FLYING_DAREDEVIL",
    "primaryStyle": "HIGH_FLYER",
    "secondaryStyle": "TECHNICAL",
    "signatureMoves": [
      {
        "name": "Missile Dropkick",
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
        "name": "Over the Moonsault",
        "category": "AERIAL",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "Jade Cargill",
    "gimmickArchetype": "BEAST",
    "primaryStyle": "POWERHOUSE",
    "secondaryStyle": "STRIKER",
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
        "name": "Jaded",
        "category": "GRAPPLE",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "Kairi Sane",
    "gimmickArchetype": "HIGH_FLYING_DAREDEVIL",
    "primaryStyle": "HIGH_FLYER",
    "secondaryStyle": "STRIKER",
    "signatureMoves": [
      {
        "name": "Sliding D",
        "category": "STRIKE",
        "source": "PPW_AUTHORED"
      },
      {
        "name": "Interceptor",
        "category": "STRIKE",
        "source": "PPW_AUTHORED"
      }
    ],
    "finishingMoves": [
      {
        "name": "Insane Elbow",
        "category": "AERIAL",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "Liv Morgan",
    "gimmickArchetype": "OPPORTUNIST",
    "primaryStyle": "ALL_ROUNDER",
    "secondaryStyle": "STRIKER",
    "signatureMoves": [
      {
        "name": "Codebreaker",
        "category": "STRIKE",
        "source": "PPW_AUTHORED"
      },
      {
        "name": "201 Facebreaker",
        "category": "GRAPPLE",
        "source": "PPW_AUTHORED"
      }
    ],
    "finishingMoves": [
      {
        "name": "Oblivion",
        "category": "GRAPPLE",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "Nia Jax",
    "gimmickArchetype": "MONSTER",
    "primaryStyle": "POWERHOUSE",
    "secondaryStyle": "BRAWLER",
    "signatureMoves": [
      {
        "name": "Samoan Drop",
        "category": "POWER",
        "source": "PPW_AUTHORED"
      },
      {
        "name": "Leg Drop",
        "category": "POWER",
        "source": "PPW_AUTHORED"
      }
    ],
    "finishingMoves": [
      {
        "name": "Annihilator",
        "category": "POWER",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "Rhea Ripley",
    "gimmickArchetype": "DARK_ANTI_HERO",
    "primaryStyle": "POWERHOUSE",
    "secondaryStyle": "STRIKER",
    "signatureMoves": [
      {
        "name": "Prism Trap",
        "category": "SUBMISSION",
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
        "name": "Riptide",
        "category": "POWER",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "Roxanne Perez",
    "gimmickArchetype": "ARROGANT_ACE",
    "primaryStyle": "ALL_ROUNDER",
    "secondaryStyle": "TECHNICAL",
    "signatureMoves": [
      {
        "name": "Russian Leg Sweep",
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
        "name": "Pop Rox",
        "category": "GRAPPLE",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "Sol Ruca",
    "gimmickArchetype": "HIGH_FLYING_DAREDEVIL",
    "primaryStyle": "HIGH_FLYER",
    "secondaryStyle": "ALL_ROUNDER",
    "signatureMoves": [
      {
        "name": "Springboard Moonsault",
        "category": "AERIAL",
        "source": "PPW_AUTHORED"
      },
      {
        "name": "Handspring Back Elbow",
        "category": "STRIKE",
        "source": "PPW_AUTHORED"
      }
    ],
    "finishingMoves": [
      {
        "name": "Sol Snatcher",
        "category": "GRAPPLE",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "Stephanie Vaquer",
    "gimmickArchetype": "DARK_ANTI_HERO",
    "primaryStyle": "TECHNICAL",
    "secondaryStyle": "STRIKER",
    "signatureMoves": [
      {
        "name": "Devil's Kiss",
        "category": "GRAPPLE",
        "source": "PPW_AUTHORED"
      },
      {
        "name": "Dragon Screw",
        "category": "GRAPPLE",
        "source": "PPW_AUTHORED"
      }
    ],
    "finishingMoves": [
      {
        "name": "SVB",
        "category": "GRAPPLE",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "Tiffany Stratton",
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
        "name": "Standing Moonsault",
        "category": "AERIAL",
        "source": "PPW_AUTHORED"
      }
    ],
    "finishingMoves": [
      {
        "name": "Prettiest Moonsault Ever",
        "category": "AERIAL",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "Zelina",
    "gimmickArchetype": "REBEL_LUCHADOR",
    "primaryStyle": "LUCHA",
    "secondaryStyle": "HIGH_FLYER",
    "signatureMoves": [
      {
        "name": "Code Red",
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
        "name": "Moonsault",
        "category": "AERIAL",
        "source": "PPW_AUTHORED"
      }
    ]
  }
];
