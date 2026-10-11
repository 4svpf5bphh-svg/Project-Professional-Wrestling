/** PPW wrestler identity review wave nine — October 2026.
 * Individually keyed editorial review for the final 96 real-roster cohort
 * approximations (Japan, including joshi/young lions, and world indies).
 *
 * NOT 96 verified wrestling biographies: where source material is sparse,
 * these use researched tradition/style and distinctive plausible *in-game*
 * moves. Move entries remain PPW_AUTHORED, not VERIFIED, and never represent
 * a player agreement, real psychological judgement or saved-World rebrand.
 * New fictional prospects continue using the complete simulated generator.
 */
import type { PortableIdentityMove } from "../../domain/src/wrestler-identity.js";
export interface ReviewedRosterIdentityWave9 {
 name:string;gimmickArchetype:string;primaryStyle:string;secondaryStyle:string|null;
 signatureMoves:PortableIdentityMove[];finishingMoves:PortableIdentityMove[];
}
export const REVIEWED_REAL_ROSTER_IDENTITIES_WAVE9: readonly ReviewedRosterIdentityWave9[] = [
  {
    "name": "Daiki Nagai",
    "gimmickArchetype": "YOUNG_LION",
    "primaryStyle": "TECHNICAL",
    "secondaryStyle": "STRONG_STYLE",
    "signatureMoves": [
      {
        "name": "Dropkick",
        "category": "STRIKE",
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
        "name": "Boston Crab",
        "category": "SUBMISSION",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "Jakob Austin Young",
    "gimmickArchetype": "SPORTING",
    "primaryStyle": "ALL_ROUNDER",
    "secondaryStyle": "HIGH_FLYER",
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
        "name": "Bridging German Suplex",
        "category": "GRAPPLE",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "Jorel Nelson",
    "gimmickArchetype": "BRUISER",
    "primaryStyle": "STRONG_STYLE",
    "secondaryStyle": "POWERHOUSE",
    "signatureMoves": [
      {
        "name": "Running Lariat",
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
        "name": "Powerbomb",
        "category": "POWER",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "Katsuya Murashima",
    "gimmickArchetype": "YOUNG_LION",
    "primaryStyle": "TECHNICAL",
    "secondaryStyle": "SUBMISSION",
    "signatureMoves": [
      {
        "name": "Arm Drag",
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
        "name": "Boston Crab",
        "category": "SUBMISSION",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "Masatora Yasuda",
    "gimmickArchetype": "YOUNG_LION",
    "primaryStyle": "TECHNICAL",
    "secondaryStyle": "STRONG_STYLE",
    "signatureMoves": [
      {
        "name": "European Uppercut",
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
        "name": "Bridging Suplex",
        "category": "GRAPPLE",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "Matt Vandagriff",
    "gimmickArchetype": "HIGH_FLYING_DAREDEVIL",
    "primaryStyle": "HIGH_FLYER",
    "secondaryStyle": "STRIKER",
    "signatureMoves": [
      {
        "name": "Springboard Moonsault",
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
        "name": "Shooting Star Press",
        "category": "AERIAL",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "Shoma Kato",
    "gimmickArchetype": "YOUNG_LION",
    "primaryStyle": "TECHNICAL",
    "secondaryStyle": "SUBMISSION",
    "signatureMoves": [
      {
        "name": "Wristlock",
        "category": "SUBMISSION",
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
        "name": "Boston Crab",
        "category": "SUBMISSION",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "Taisei Nakahara",
    "gimmickArchetype": "YOUNG_LION",
    "primaryStyle": "STRONG_STYLE",
    "secondaryStyle": "TECHNICAL",
    "signatureMoves": [
      {
        "name": "Forearm Smash",
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
        "name": "Fisherman's Suplex",
        "category": "GRAPPLE",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "Tatsuya Matsumoto",
    "gimmickArchetype": "YOUNG_LION",
    "primaryStyle": "TECHNICAL",
    "secondaryStyle": "STRONG_STYLE",
    "signatureMoves": [
      {
        "name": "Back Elbow",
        "category": "STRIKE",
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
        "name": "Bridging German Suplex",
        "category": "GRAPPLE",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "Hina",
    "gimmickArchetype": "FAMILY_DYNASTY",
    "primaryStyle": "TECHNICAL",
    "secondaryStyle": "POWERHOUSE",
    "signatureMoves": [
      {
        "name": "Dropkick",
        "category": "STRIKE",
        "source": "PPW_AUTHORED"
      },
      {
        "name": "Judo Throw",
        "category": "GRAPPLE",
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
    "name": "Lady C",
    "gimmickArchetype": "GIANT",
    "primaryStyle": "POWERHOUSE",
    "secondaryStyle": "STRIKER",
    "signatureMoves": [
      {
        "name": "Big Boot",
        "category": "STRIKE",
        "source": "PPW_AUTHORED"
      },
      {
        "name": "Overhead Chop",
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
    "name": "Tomoka Inaba",
    "gimmickArchetype": "MMA_CROSSOVER",
    "primaryStyle": "STRIKER",
    "secondaryStyle": "SUBMISSION",
    "signatureMoves": [
      {
        "name": "Roundhouse Kick",
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
        "name": "Spinning Back Kick",
        "category": "STRIKE",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "Kiyoka Kotatsu",
    "gimmickArchetype": "SPORTING",
    "primaryStyle": "TECHNICAL",
    "secondaryStyle": "HIGH_FLYER",
    "signatureMoves": [
      {
        "name": "Dropkick",
        "category": "STRIKE",
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
    "name": "Miyu Amasaki",
    "gimmickArchetype": "SHOW_OFF",
    "primaryStyle": "HIGH_FLYER",
    "secondaryStyle": "TECHNICAL",
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
        "name": "Northern Lights Suplex",
        "category": "GRAPPLE",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "Ema Maishima",
    "gimmickArchetype": "YOUNG_LION",
    "primaryStyle": "ALL_ROUNDER",
    "secondaryStyle": "STRIKER",
    "signatureMoves": [
      {
        "name": "Snap Suplex",
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
        "name": "Running Knee",
        "category": "STRIKE",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "Azusa Inaba",
    "gimmickArchetype": "MMA_CROSSOVER",
    "primaryStyle": "STRIKER",
    "secondaryStyle": "SUBMISSION",
    "signatureMoves": [
      {
        "name": "Roundhouse Kick",
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
        "name": "Armbar",
        "category": "SUBMISSION",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "Itsuki Aoki",
    "gimmickArchetype": "STRONG_STYLE_ACE",
    "primaryStyle": "STRONG_STYLE",
    "secondaryStyle": "STRIKER",
    "signatureMoves": [
      {
        "name": "Lariat",
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
        "name": "German Suplex",
        "category": "GRAPPLE",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "Rian",
    "gimmickArchetype": "UNDERDOG",
    "primaryStyle": "HIGH_FLYER",
    "secondaryStyle": "TECHNICAL",
    "signatureMoves": [
      {
        "name": "Diving Crossbody",
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
        "name": "Small Package",
        "category": "GRAPPLE",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "Kikyo Furusawa",
    "gimmickArchetype": "YOUNG_LION",
    "primaryStyle": "TECHNICAL",
    "secondaryStyle": "ALL_ROUNDER",
    "signatureMoves": [
      {
        "name": "Arm Drag",
        "category": "GRAPPLE",
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
        "name": "Missile Dropkick",
        "category": "STRIKE",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "Yuria Hime",
    "gimmickArchetype": "CELEBRITY",
    "primaryStyle": "ALL_ROUNDER",
    "secondaryStyle": "HIGH_FLYER",
    "signatureMoves": [
      {
        "name": "Spinning Heel Kick",
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
        "name": "Diving Crossbody",
        "category": "AERIAL",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "Aya Sakura",
    "gimmickArchetype": "UNDERDOG",
    "primaryStyle": "ALL_ROUNDER",
    "secondaryStyle": "TECHNICAL",
    "signatureMoves": [
      {
        "name": "Running Dropkick",
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
        "name": "Bridging Pin",
        "category": "GRAPPLE",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "Sayaka Kurei",
    "gimmickArchetype": "HIGH_FLYING_DAREDEVIL",
    "primaryStyle": "HIGH_FLYER",
    "secondaryStyle": "TECHNICAL",
    "signatureMoves": [
      {
        "name": "Tornado DDT",
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
        "name": "Moonsault",
        "category": "AERIAL",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "Anne Kanaya",
    "gimmickArchetype": "SPORTING",
    "primaryStyle": "TECHNICAL",
    "secondaryStyle": "SUBMISSION",
    "signatureMoves": [
      {
        "name": "Armbar",
        "category": "SUBMISSION",
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
        "name": "Fisherman's Suplex",
        "category": "GRAPPLE",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "HANAKO",
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
        "name": "Body Slam",
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
    "name": "Waka Tsukiyama",
    "gimmickArchetype": "UNDERDOG",
    "primaryStyle": "ALL_ROUNDER",
    "secondaryStyle": "TECHNICAL",
    "signatureMoves": [
      {
        "name": "Dropkick",
        "category": "STRIKE",
        "source": "PPW_AUTHORED"
      },
      {
        "name": "Bridging Suplex",
        "category": "GRAPPLE",
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
    "name": "Fuwa-chan",
    "gimmickArchetype": "CELEBRITY",
    "primaryStyle": "ALL_ROUNDER",
    "secondaryStyle": "BRAWLER",
    "signatureMoves": [
      {
        "name": "Dropkick",
        "category": "STRIKE",
        "source": "PPW_AUTHORED"
      },
      {
        "name": "Rolling Senton",
        "category": "POWER",
        "source": "PPW_AUTHORED"
      }
    ],
    "finishingMoves": [
      {
        "name": "Flying Crossbody",
        "category": "AERIAL",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "Akari",
    "gimmickArchetype": "SPORTING",
    "primaryStyle": "STRIKER",
    "secondaryStyle": "HIGH_FLYER",
    "signatureMoves": [
      {
        "name": "Running Knee",
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
        "name": "Diving Foot Stomp",
        "category": "AERIAL",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "Matoi Hamabe",
    "gimmickArchetype": "UNDERDOG",
    "primaryStyle": "HIGH_FLYER",
    "secondaryStyle": "ALL_ROUNDER",
    "signatureMoves": [
      {
        "name": "Arm Drag",
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
        "name": "Tornado DDT",
        "category": "GRAPPLE",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "Tetsu Akira",
    "gimmickArchetype": "YOUNG_LION",
    "primaryStyle": "STRONG_STYLE",
    "secondaryStyle": "TECHNICAL",
    "signatureMoves": [
      {
        "name": "Forearm Smash",
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
        "name": "Boston Crab",
        "category": "SUBMISSION",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "Jesús Rodríguez",
    "gimmickArchetype": "SHOWMAN",
    "primaryStyle": "ALL_ROUNDER",
    "secondaryStyle": "BRAWLER",
    "signatureMoves": [
      {
        "name": "Spinning Neckbreaker",
        "category": "GRAPPLE",
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
        "name": "Diving Elbow Drop",
        "category": "AERIAL",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "Mark Coffey",
    "gimmickArchetype": "BRUISER",
    "primaryStyle": "BRAWLER",
    "secondaryStyle": "STRONG_STYLE",
    "signatureMoves": [
      {
        "name": "Discus Lariat",
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
        "name": "German Suplex",
        "category": "GRAPPLE",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "Colin Delaney",
    "gimmickArchetype": "UNDERDOG",
    "primaryStyle": "ALL_ROUNDER",
    "secondaryStyle": "TECHNICAL",
    "signatureMoves": [
      {
        "name": "Small Package",
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
        "name": "Diving Crossbody",
        "category": "AERIAL",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "Gurv Sihra",
    "gimmickArchetype": "SHOWMAN",
    "primaryStyle": "HIGH_FLYER",
    "secondaryStyle": "ALL_ROUNDER",
    "signatureMoves": [
      {
        "name": "Springboard Crossbody",
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
        "name": "Diving Double Stomp",
        "category": "AERIAL",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "Harv Sihra",
    "gimmickArchetype": "SHOWMAN",
    "primaryStyle": "ALL_ROUNDER",
    "secondaryStyle": "HIGH_FLYER",
    "signatureMoves": [
      {
        "name": "Enzuigiri",
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
        "name": "Tornado DDT",
        "category": "GRAPPLE",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "Joseph Sawyer",
    "gimmickArchetype": "SPORTING",
    "primaryStyle": "ALL_ROUNDER",
    "secondaryStyle": "STRIKER",
    "signatureMoves": [
      {
        "name": "Running Uppercut",
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
        "name": "Jumping Knee",
        "category": "STRIKE",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "AJ Cazana",
    "gimmickArchetype": "FAMILY_DYNASTY",
    "primaryStyle": "POWERHOUSE",
    "secondaryStyle": "BRAWLER",
    "signatureMoves": [
      {
        "name": "Lariat",
        "category": "STRIKE",
        "source": "PPW_AUTHORED"
      },
      {
        "name": "Body Slam",
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
    "name": "Alex Taylor",
    "gimmickArchetype": "SPORTING",
    "primaryStyle": "TECHNICAL",
    "secondaryStyle": "STRIKER",
    "signatureMoves": [
      {
        "name": "German Suplex",
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
        "name": "Fisherman's Suplex",
        "category": "GRAPPLE",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "Aron Stevens",
    "gimmickArchetype": "COMEDY",
    "primaryStyle": "ALL_ROUNDER",
    "secondaryStyle": "BRAWLER",
    "signatureMoves": [
      {
        "name": "Diving Elbow Drop",
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
        "name": "Neckbreaker",
        "category": "GRAPPLE",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "Bryan Idol",
    "gimmickArchetype": "SPORTING",
    "primaryStyle": "ALL_ROUNDER",
    "secondaryStyle": "STRONG_STYLE",
    "signatureMoves": [
      {
        "name": "Running Lariat",
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
        "name": "Spinning Neckbreaker",
        "category": "GRAPPLE",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "Carson Bartholomew Drake",
    "gimmickArchetype": "SHOWMAN",
    "primaryStyle": "ALL_ROUNDER",
    "secondaryStyle": "BRAWLER",
    "signatureMoves": [
      {
        "name": "Running Clothesline",
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
        "name": "Diving Elbow Drop",
        "category": "AERIAL",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "Preston Vance",
    "gimmickArchetype": "BEAST",
    "primaryStyle": "POWERHOUSE",
    "secondaryStyle": "BRAWLER",
    "signatureMoves": [
      {
        "name": "Running Lariat",
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
        "name": "Full Nelson",
        "category": "SUBMISSION",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "Turbo Floyd",
    "gimmickArchetype": "SHOWMAN",
    "primaryStyle": "POWERHOUSE",
    "secondaryStyle": "ALL_ROUNDER",
    "signatureMoves": [
      {
        "name": "Military Press",
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
        "name": "Powerslam",
        "category": "POWER",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "Joe Cazana",
    "gimmickArchetype": "FAMILY_DYNASTY",
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
        "name": "Chokeslam",
        "category": "POWER",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "Kratos",
    "gimmickArchetype": "MONSTER",
    "primaryStyle": "POWERHOUSE",
    "secondaryStyle": "STRONG_STYLE",
    "signatureMoves": [
      {
        "name": "Lariat",
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
        "name": "Powerbomb",
        "category": "POWER",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "Mike Knox",
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
        "name": "Knox Out",
        "category": "POWER",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "Mike Mondo",
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
        "name": "Standing Dropkick",
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
    "name": "Odinson",
    "gimmickArchetype": "BEAST",
    "primaryStyle": "POWERHOUSE",
    "secondaryStyle": "STRONG_STYLE",
    "signatureMoves": [
      {
        "name": "Powerslam",
        "category": "POWER",
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
        "name": "Sit-out Powerbomb",
        "category": "POWER",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "Luke Jacobs",
    "gimmickArchetype": "STRONG_STYLE_ACE",
    "primaryStyle": "STRONG_STYLE",
    "secondaryStyle": "STRIKER",
    "signatureMoves": [
      {
        "name": "Forearm Smash",
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
        "name": "Running Lariat",
        "category": "STRIKE",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "Sha Samuels",
    "gimmickArchetype": "TOUGH_GUY",
    "primaryStyle": "BRAWLER",
    "secondaryStyle": "STRONG_STYLE",
    "signatureMoves": [
      {
        "name": "Knife-edge Chop",
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
        "name": "Spinning Neckbreaker",
        "category": "GRAPPLE",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "Zak Knight",
    "gimmickArchetype": "REBEL",
    "primaryStyle": "BRAWLER",
    "secondaryStyle": "ALL_ROUNDER",
    "signatureMoves": [
      {
        "name": "Running Knee",
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
        "name": "Powerbomb",
        "category": "POWER",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "Leyton Buzzard",
    "gimmickArchetype": "HIGH_FLYING_DAREDEVIL",
    "primaryStyle": "HIGH_FLYER",
    "secondaryStyle": "TECHNICAL",
    "signatureMoves": [
      {
        "name": "Springboard Moonsault",
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
        "name": "Tornado DDT",
        "category": "GRAPPLE",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "Tommy End",
    "gimmickArchetype": "DARK_ANTI_HERO",
    "primaryStyle": "STRIKER",
    "secondaryStyle": "STRONG_STYLE",
    "signatureMoves": [
      {
        "name": "Knee Strike",
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
        "name": "Black Mass",
        "category": "STRIKE",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "Uriah Connors",
    "gimmickArchetype": "SECOND_GENERATION",
    "primaryStyle": "ALL_ROUNDER",
    "secondaryStyle": "TECHNICAL",
    "signatureMoves": [
      {
        "name": "Dropkick",
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
        "name": "German Suplex",
        "category": "GRAPPLE",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "Braxton Cole",
    "gimmickArchetype": "SPORTING",
    "primaryStyle": "ALL_ROUNDER",
    "secondaryStyle": "STRIKER",
    "signatureMoves": [
      {
        "name": "Dropkick",
        "category": "STRIKE",
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
        "name": "Sit-out Slam",
        "category": "POWER",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "Harley Riggins",
    "gimmickArchetype": "SPORTING",
    "primaryStyle": "ALL_ROUNDER",
    "secondaryStyle": "HIGH_FLYER",
    "signatureMoves": [
      {
        "name": "Springboard Crossbody",
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
        "name": "Neckbreaker",
        "category": "GRAPPLE",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "Jax Presley",
    "gimmickArchetype": "SHOW_OFF",
    "primaryStyle": "HIGH_FLYER",
    "secondaryStyle": "ALL_ROUNDER",
    "signatureMoves": [
      {
        "name": "Spinning Heel Kick",
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
        "name": "Diving DDT",
        "category": "GRAPPLE",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "Nick Comoroto",
    "gimmickArchetype": "MONSTER",
    "primaryStyle": "POWERHOUSE",
    "secondaryStyle": "BRAWLER",
    "signatureMoves": [
      {
        "name": "Fallaway Slam",
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
    "name": "Shido Ash",
    "gimmickArchetype": "SPORTING",
    "primaryStyle": "STRIKER",
    "secondaryStyle": "TECHNICAL",
    "signatureMoves": [
      {
        "name": "Pump Kick",
        "category": "STRIKE",
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
        "name": "Bridging Suplex",
        "category": "GRAPPLE",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "Cappuccino Jones",
    "gimmickArchetype": "COMEDY",
    "primaryStyle": "ALL_ROUNDER",
    "secondaryStyle": "STRIKER",
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
        "name": "Diving Elbow Drop",
        "category": "AERIAL",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "Chazz \"Starboy\" Hall",
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
        "name": "Dropkick",
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
    "name": "CJ Valor",
    "gimmickArchetype": "PRIZEFIGHTER",
    "primaryStyle": "BRAWLER",
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
        "name": "Spinebuster",
        "category": "POWER",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "Elijah Holyfield",
    "gimmickArchetype": "PRIZEFIGHTER",
    "primaryStyle": "STRIKER",
    "secondaryStyle": "POWERHOUSE",
    "signatureMoves": [
      {
        "name": "Jab Combination",
        "category": "STRIKE",
        "source": "PPW_AUTHORED"
      },
      {
        "name": "Body Blow",
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
    "name": "Harlem Lewis",
    "gimmickArchetype": "TOUGH_GUY",
    "primaryStyle": "BRAWLER",
    "secondaryStyle": "ALL_ROUNDER",
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
        "name": "Sit-out Powerbomb",
        "category": "POWER",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "Yushin Hatazawa",
    "gimmickArchetype": "YOUNG_LION",
    "primaryStyle": "TECHNICAL",
    "secondaryStyle": "STRONG_STYLE",
    "signatureMoves": [
      {
        "name": "Dropkick",
        "category": "STRIKE",
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
        "name": "Boston Crab",
        "category": "SUBMISSION",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "Yuto-Ice",
    "gimmickArchetype": "OUTLAW",
    "primaryStyle": "STRONG_STYLE",
    "secondaryStyle": "BRAWLER",
    "signatureMoves": [
      {
        "name": "Running Knee",
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
        "name": "German Suplex",
        "category": "GRAPPLE",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "Zane Jay",
    "gimmickArchetype": "SPORTING",
    "primaryStyle": "HIGH_FLYER",
    "secondaryStyle": "TECHNICAL",
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
        "name": "Tornado DDT",
        "category": "GRAPPLE",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "Silas Mason",
    "gimmickArchetype": "COWBOY",
    "primaryStyle": "POWERHOUSE",
    "secondaryStyle": "BRAWLER",
    "signatureMoves": [
      {
        "name": "Powerslam",
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
        "name": "Lariat",
        "category": "STRIKE",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "Man Like DeReiss",
    "gimmickArchetype": "SHOWMAN",
    "primaryStyle": "HIGH_FLYER",
    "secondaryStyle": "STRIKER",
    "signatureMoves": [
      {
        "name": "Springboard Crossbody",
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
        "name": "450 Splash",
        "category": "AERIAL",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "Charles Mason",
    "gimmickArchetype": "DARK_ANTI_HERO",
    "primaryStyle": "BRAWLER",
    "secondaryStyle": "TECHNICAL",
    "signatureMoves": [
      {
        "name": "Chokeslam",
        "category": "POWER",
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
        "name": "Diving Knee Drop",
        "category": "AERIAL",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "Madoka Kikuta",
    "gimmickArchetype": "STRONG_STYLE_ACE",
    "primaryStyle": "STRONG_STYLE",
    "secondaryStyle": "BRAWLER",
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
        "name": "Running Elbow",
        "category": "STRIKE",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "KZY",
    "gimmickArchetype": "SHOWMAN",
    "primaryStyle": "HIGH_FLYER",
    "secondaryStyle": "ALL_ROUNDER",
    "signatureMoves": [
      {
        "name": "Running Forearm",
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
        "name": "Diving Moonsault",
        "category": "AERIAL",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "Ryoya Tanaka",
    "gimmickArchetype": "YOUNG_LION",
    "primaryStyle": "TECHNICAL",
    "secondaryStyle": "STRONG_STYLE",
    "signatureMoves": [
      {
        "name": "Running Dropkick",
        "category": "STRIKE",
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
        "name": "Bridging Suplex",
        "category": "GRAPPLE",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "Elijah Blum",
    "gimmickArchetype": "YOUNG_LION",
    "primaryStyle": "TECHNICAL",
    "secondaryStyle": "STRONG_STYLE",
    "signatureMoves": [
      {
        "name": "Hip Toss",
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
        "name": "Boston Crab",
        "category": "SUBMISSION",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "Stuka Jr.",
    "gimmickArchetype": "MASKED_AVENGER",
    "primaryStyle": "LUCHA",
    "secondaryStyle": "HIGH_FLYER",
    "signatureMoves": [
      {
        "name": "Tope Con Giro",
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
        "name": "Diving Torpedo Splash",
        "category": "AERIAL",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "Xelhua",
    "gimmickArchetype": "MASKED_MYSTERY",
    "primaryStyle": "LUCHA",
    "secondaryStyle": "TECHNICAL",
    "signatureMoves": [
      {
        "name": "La Magistral",
        "category": "GRAPPLE",
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
        "name": "Bridging Suplex",
        "category": "GRAPPLE",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "Nina Samuels",
    "gimmickArchetype": "ARROGANT_ACE",
    "primaryStyle": "ALL_ROUNDER",
    "secondaryStyle": "STRIKER",
    "signatureMoves": [
      {
        "name": "Running Uppercut",
        "category": "STRIKE",
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
        "name": "Spinning Neckbreaker",
        "category": "GRAPPLE",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "Rhio",
    "gimmickArchetype": "BRUISER",
    "primaryStyle": "STRONG_STYLE",
    "secondaryStyle": "BRAWLER",
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
        "name": "Powerslam",
        "category": "POWER",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "Kenzie Paige",
    "gimmickArchetype": "ARROGANT_ACE",
    "primaryStyle": "ALL_ROUNDER",
    "secondaryStyle": "BRAWLER",
    "signatureMoves": [
      {
        "name": "Running Knee",
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
        "name": "DDT",
        "category": "GRAPPLE",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "Takumi Iroha",
    "gimmickArchetype": "STRONG_STYLE_ACE",
    "primaryStyle": "STRONG_STYLE",
    "secondaryStyle": "STRIKER",
    "signatureMoves": [
      {
        "name": "Roundhouse Kick",
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
        "name": "Running Knee",
        "category": "STRIKE",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "Suzume",
    "gimmickArchetype": "HIGH_FLYING_DAREDEVIL",
    "primaryStyle": "HIGH_FLYER",
    "secondaryStyle": "TECHNICAL",
    "signatureMoves": [
      {
        "name": "Springboard Dropkick",
        "category": "STRIKE",
        "source": "PPW_AUTHORED"
      },
      {
        "name": "Running Crossbody",
        "category": "AERIAL",
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
    "name": "Miku Aono",
    "gimmickArchetype": "STRONG_STYLE_ACE",
    "primaryStyle": "STRONG_STYLE",
    "secondaryStyle": "STRIKER",
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
        "name": "Running Knee",
        "category": "STRIKE",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "Natalia Markova",
    "gimmickArchetype": "SHOW_OFF",
    "primaryStyle": "HIGH_FLYER",
    "secondaryStyle": "ALL_ROUNDER",
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
        "name": "Moonsault",
        "category": "AERIAL",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "Janai Kai",
    "gimmickArchetype": "MMA_CROSSOVER",
    "primaryStyle": "STRIKER",
    "secondaryStyle": "SUBMISSION",
    "signatureMoves": [
      {
        "name": "Roundhouse Kick",
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
        "name": "Spinning Heel Kick",
        "category": "STRIKE",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "Tiffany Nieves",
    "gimmickArchetype": "HIGH_FLYING_DAREDEVIL",
    "primaryStyle": "HIGH_FLYER",
    "secondaryStyle": "ALL_ROUNDER",
    "signatureMoves": [
      {
        "name": "Standing Moonsault",
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
        "name": "Diving Foot Stomp",
        "category": "AERIAL",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "Gisele Shaw",
    "gimmickArchetype": "SHOW_OFF",
    "primaryStyle": "ALL_ROUNDER",
    "secondaryStyle": "STRIKER",
    "signatureMoves": [
      {
        "name": "Spinning Back Kick",
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
        "name": "Neckbreaker",
        "category": "GRAPPLE",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "Chihiro Hashimoto",
    "gimmickArchetype": "WRESTLING_MACHINE",
    "primaryStyle": "POWERHOUSE",
    "secondaryStyle": "TECHNICAL",
    "signatureMoves": [
      {
        "name": "German Suplex",
        "category": "GRAPPLE",
        "source": "PPW_AUTHORED"
      },
      {
        "name": "Overhead Belly-to-Belly Throw",
        "category": "GRAPPLE",
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
    "name": "Lana Austin",
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
        "name": "Spinebuster",
        "category": "POWER",
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
    "name": "Mika Iwata",
    "gimmickArchetype": "STRONG_STYLE_ACE",
    "primaryStyle": "STRONG_STYLE",
    "secondaryStyle": "STRIKER",
    "signatureMoves": [
      {
        "name": "Roundhouse Kick",
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
        "name": "Buzzsaw Kick",
        "category": "STRIKE",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "Tessa Blanchard",
    "gimmickArchetype": "ARROGANT_ACE",
    "primaryStyle": "ALL_ROUNDER",
    "secondaryStyle": "TECHNICAL",
    "signatureMoves": [
      {
        "name": "Magnum",
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
        "name": "Buzzsaw DDT",
        "category": "GRAPPLE",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "Yuki Arai",
    "gimmickArchetype": "CELEBRITY",
    "primaryStyle": "HIGH_FLYER",
    "secondaryStyle": "ALL_ROUNDER",
    "signatureMoves": [
      {
        "name": "Running Dropkick",
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
        "name": "Finally",
        "category": "STRIKE",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "Kaho Matsushita",
    "gimmickArchetype": "SPORTING",
    "primaryStyle": "HIGH_FLYER",
    "secondaryStyle": "TECHNICAL",
    "signatureMoves": [
      {
        "name": "Standing Dropkick",
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
        "name": "Bridging Pin",
        "category": "GRAPPLE",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "Hikari Minami",
    "gimmickArchetype": "SPORTING",
    "primaryStyle": "TECHNICAL",
    "secondaryStyle": "HIGH_FLYER",
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
        "name": "Diving Crossbody",
        "category": "AERIAL",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "MIRAI",
    "gimmickArchetype": "STRONG_STYLE_ACE",
    "primaryStyle": "POWERHOUSE",
    "secondaryStyle": "STRONG_STYLE",
    "signatureMoves": [
      {
        "name": "Lariat",
        "category": "STRIKE",
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
        "name": "Mirai Lariat",
        "category": "STRIKE",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "Steph De Lander",
    "gimmickArchetype": "SHOWMAN",
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
        "name": "Chokeslam",
        "category": "POWER",
        "source": "PPW_AUTHORED"
      }
    ]
  },
  {
    "name": "Lady Frost",
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
        "name": "Standing Moonsault",
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
    "name": "Alexxis Falcon",
    "gimmickArchetype": "SPORTING",
    "primaryStyle": "TECHNICAL",
    "secondaryStyle": "HIGH_FLYER",
    "signatureMoves": [
      {
        "name": "Arm Drag",
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
        "name": "Diving Crossbody",
        "category": "AERIAL",
        "source": "PPW_AUTHORED"
      }
    ]
  }
];
