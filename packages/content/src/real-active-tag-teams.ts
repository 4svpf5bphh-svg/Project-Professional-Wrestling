import type { WorldState, WrestlerRelationshipTag } from "../../domain/src/types.js";
import { seedEstablishedTagTeam } from "../../sim-core/src/team-seeding.js";
import { REAL_ACTIVE_MENS_ROSTER_NAMES } from "./real-active-mens-roster.js";

export const REAL_ACTIVE_TAG_TEAMS_REVIEWED_ON = "2026-10-07";

export type RealTagTeamPromotionKey = "WWE" | "AEW" | "TNA";

export interface RealActiveTagTeamTemplate {
  name: string;
  members: readonly [string, string];
  promotionKey: RealTagTeamPromotionKey;
  relationshipTags: readonly WrestlerRelationshipTag[];
}

/**
 * Small first seed, deliberately limited to teams confirmed in recent official
 * promotion material. Expand in reviewed batches rather than guessing.
 */
export const REAL_ACTIVE_TAG_TEAM_TEMPLATES: readonly RealActiveTagTeamTemplate[] = [
  {
    name: "The Young Bucks",
    members: ["Matthew Jackson", "Nicholas Jackson"],
    promotionKey: "AEW",
    relationshipTags: ["FAMILY"],
  },
  {
    name: "FTR",
    members: ["Cash Wheeler", "Dax Harwood"],
    promotionKey: "AEW",
    relationshipTags: [],
  },
  {
    name: "The Street Profits",
    members: ["Angelo Dawkins", "Montez Ford"],
    promotionKey: "WWE",
    relationshipTags: [],
  },
  {
    name: "The Creed Brothers",
    members: ["Brutus Creed", "Julius Creed"],
    promotionKey: "WWE",
    relationshipTags: ["FAMILY"],
  },
  {
    name: "The Hardys",
    members: ["Jeff Hardy", "Matt Hardy"],
    promotionKey: "TNA",
    relationshipTags: ["FAMILY"],
  },
  {
    name: "The Nemeths",
    members: ["Nic Nemeth", "Ryan Nemeth"],
    promotionKey: "TNA",
    relationshipTags: ["FAMILY"],
  },
] as const;

const rosterNames = new Set(REAL_ACTIVE_MENS_ROSTER_NAMES);
const teamNames = new Set<string>();
const pairKeys = new Set<string>();
for (const template of REAL_ACTIVE_TAG_TEAM_TEMPLATES) {
  const normalizedTeamName = template.name.toLocaleLowerCase("en");
  if (teamNames.has(normalizedTeamName)) throw new Error(`duplicate real tag-team name ${template.name}`);
  teamNames.add(normalizedTeamName);
  const [left, right] = template.members;
  if (!rosterNames.has(left) || !rosterNames.has(right)) {
    throw new Error(`real tag-team ${template.name} references a wrestler outside the reviewed men's roster`);
  }
  const pairKey = [left, right].sort().join("::");
  if (pairKeys.has(pairKey)) throw new Error(`duplicate real tag-team pair ${pairKey}`);
  pairKeys.add(pairKey);
}

export function seedRealActiveTagTeams(state: WorldState): string[] {
  const personByName = new Map(state.people.map((person) => [person.name, person]));
  const seeded: string[] = [];
  for (const template of REAL_ACTIVE_TAG_TEAM_TEMPLATES) {
    const [leftName, rightName] = template.members;
    const left = personByName.get(leftName);
    const right = personByName.get(rightName);
    if (!left || !right) {
      throw new Error(`real tag-team ${template.name} cannot seed because a member is absent from this World`);
    }
    const team = seedEstablishedTagTeam(state, {
      name: template.name,
      personAId: left.id,
      personBId: right.id,
      relationshipTags: [...template.relationshipTags],
      professionalTrust: 76,
      familiarity: 86,
    });
    seeded.push(team.id);
  }
  return seeded;
}
