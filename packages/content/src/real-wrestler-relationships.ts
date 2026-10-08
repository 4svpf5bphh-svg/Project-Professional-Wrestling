import type {
  WorldState,
  WrestlerRelationshipTag,
} from "../../domain/src/types.js";
import {
  upsertWrestlerRelationship,
  wrestlerRelationshipBetween,
} from "../../sim-core/src/relationships.js";
import {
  REAL_ACTIVE_MENS_ROSTER_NAMES,
} from "./real-active-mens-roster.js";
import {
  REAL_ACTIVE_WOMENS_ROSTER_NAMES,
} from "./real-active-womens-roster.js";

export const REAL_WRESTLER_RELATIONSHIPS_REVIEWED_ON = "2026-10-08";

export interface RealWrestlerRelationshipTemplate {
  wrestlers: readonly [string, string];
  affinity: number;
  professionalTrust: number;
  rivalryHeat: number;
  familiarity: number;
  tags: readonly WrestlerRelationshipTag[];
}

/**
 * PPW game-world starting relationships informed by public wrestling history:
 * family ties, established partnerships/alliances and on-screen rivalry history.
 *
 * These values are simulation state, not claims about private real-life
 * friendships, animosity or personal feelings between the people involved.
 * MENTOR is intentionally not seeded yet because the current relationship tag
 * is symmetric and cannot identify which wrestler is the mentor.
 */
export const REAL_WRESTLER_RELATIONSHIP_TEMPLATES: readonly RealWrestlerRelationshipTemplate[] = [
  {
    wrestlers: ["Cody Rhodes", "Dustin Rhodes"],
    affinity: 62,
    professionalTrust: 86,
    rivalryHeat: 38,
    familiarity: 100,
    tags: ["FAMILY", "FORMER_PARTNERS"],
  },
  {
    wrestlers: ["Rey Mysterio", "Dominik Mysterio"],
    affinity: 25,
    professionalTrust: 68,
    rivalryHeat: 92,
    familiarity: 100,
    tags: ["FAMILY"],
  },
  {
    wrestlers: ["Jey Uso", "Jimmy Uso"],
    affinity: 66,
    professionalTrust: 88,
    rivalryHeat: 55,
    familiarity: 100,
    tags: ["FAMILY", "FORMER_PARTNERS"],
  },
  {
    wrestlers: ["Roman Reigns", "Jey Uso"],
    affinity: 35,
    professionalTrust: 78,
    rivalryHeat: 78,
    familiarity: 96,
    tags: ["FAMILY"],
  },
  {
    wrestlers: ["Kevin Owens", "Sami Zayn"],
    affinity: 52,
    professionalTrust: 84,
    rivalryHeat: 92,
    familiarity: 100,
    tags: ["ALLY", "FORMER_PARTNERS"],
  },
  {
    wrestlers: ["Johnny Gargano", "Tommaso Ciampa"],
    affinity: 40,
    professionalTrust: 82,
    rivalryHeat: 94,
    familiarity: 98,
    tags: ["FORMER_PARTNERS"],
  },
  {
    wrestlers: ["\"Hangman\" Adam Page", "Kenny Omega"],
    affinity: 36,
    professionalTrust: 78,
    rivalryHeat: 82,
    familiarity: 96,
    tags: ["FORMER_PARTNERS"],
  },
  {
    wrestlers: ["MJF", "Adam Cole"],
    affinity: 18,
    professionalTrust: 55,
    rivalryHeat: 92,
    familiarity: 88,
    tags: ["FORMER_PARTNERS"],
  },
  {
    wrestlers: ["Kenny Omega", "Kota Ibushi"],
    affinity: 72,
    professionalTrust: 88,
    rivalryHeat: 32,
    familiarity: 98,
    tags: ["ALLY", "FORMER_PARTNERS"],
  },
  {
    wrestlers: ["Finn Bálor", "Damian Priest"],
    affinity: 28,
    professionalTrust: 72,
    rivalryHeat: 82,
    familiarity: 92,
    tags: ["FORMER_PARTNERS"],
  },
  {
    wrestlers: ["Bayley", "Mercedes Moné"],
    affinity: 68,
    professionalTrust: 90,
    rivalryHeat: 82,
    familiarity: 100,
    tags: ["ALLY", "FORMER_PARTNERS"],
  },
  {
    wrestlers: ["Becky Lynch", "Charlotte Flair"],
    affinity: 34,
    professionalTrust: 82,
    rivalryHeat: 90,
    familiarity: 98,
    tags: [],
  },
  {
    wrestlers: ["Rhea Ripley", "Liv Morgan"],
    affinity: 18,
    professionalTrust: 72,
    rivalryHeat: 94,
    familiarity: 90,
    tags: [],
  },
  {
    wrestlers: ["Rhea Ripley", "Damian Priest"],
    affinity: 72,
    professionalTrust: 86,
    rivalryHeat: 18,
    familiarity: 92,
    tags: ["ALLY"],
  },
  {
    wrestlers: ["Athena", "Billie Starkz"],
    affinity: 48,
    professionalTrust: 80,
    rivalryHeat: 58,
    familiarity: 90,
    tags: ["ALLY"],
  },
  {
    wrestlers: ["Claudio Castagnoli", "Wheeler Yuta"],
    affinity: 52,
    professionalTrust: 84,
    rivalryHeat: 30,
    familiarity: 88,
    tags: ["ALLY"],
  },
  {
    wrestlers: ["Jon Moxley", "Wheeler Yuta"],
    affinity: 46,
    professionalTrust: 82,
    rivalryHeat: 38,
    familiarity: 88,
    tags: ["ALLY"],
  },
  {
    wrestlers: ["Zack Sabre Jr.", "Kosei Fujita"],
    affinity: 64,
    professionalTrust: 88,
    rivalryHeat: 14,
    familiarity: 88,
    tags: ["ALLY"],
  },
  {
    wrestlers: ["Syuri", "Ami Sohrei"],
    affinity: 62,
    professionalTrust: 86,
    rivalryHeat: 18,
    familiarity: 88,
    tags: ["ALLY"],
  },
  {
    wrestlers: ["Saya Kamitani", "Momo Watanabe"],
    affinity: 30,
    professionalTrust: 76,
    rivalryHeat: 78,
    familiarity: 90,
    tags: ["ALLY"],
  },
] as const;

const rosterNames = new Set([
  ...REAL_ACTIVE_MENS_ROSTER_NAMES,
  ...REAL_ACTIVE_WOMENS_ROSTER_NAMES,
]);
const pairKeys = new Set<string>();

for (const template of REAL_WRESTLER_RELATIONSHIP_TEMPLATES) {
  const [left, right] = template.wrestlers;
  if (!rosterNames.has(left) || !rosterNames.has(right)) {
    throw new Error(`real wrestler relationship references unknown wrestler: ${left} / ${right}`);
  }
  const pairKey = [left, right].sort().join("::");
  if (pairKeys.has(pairKey)) throw new Error(`duplicate real wrestler relationship pair ${pairKey}`);
  pairKeys.add(pairKey);
}

export function seedRealWrestlerRelationships(state: WorldState): number {
  const personByName = new Map(state.people.map((person) => [person.name, person]));
  let seeded = 0;

  for (const template of REAL_WRESTLER_RELATIONSHIP_TEMPLATES) {
    const [leftName, rightName] = template.wrestlers;
    const left = personByName.get(leftName);
    const right = personByName.get(rightName);
    if (!left || !right) {
      throw new Error(`real wrestler relationship cannot seed because a member is absent: ${leftName} / ${rightName}`);
    }

    const existing = wrestlerRelationshipBetween(state, left.id, right.id);
    const tags = [...new Set([
      ...(existing?.tags ?? []),
      ...template.tags,
    ])] as WrestlerRelationshipTag[];

    upsertWrestlerRelationship(state, {
      personAId: left.id,
      personBId: right.id,
      affinity: template.affinity,
      professionalTrust: Math.max(existing?.professionalTrust ?? -100, template.professionalTrust),
      rivalryHeat: Math.max(existing?.rivalryHeat ?? 0, template.rivalryHeat),
      familiarity: Math.max(existing?.familiarity ?? 0, template.familiarity),
      tags,
    });
    seeded += 1;
  }

  return seeded;
}
