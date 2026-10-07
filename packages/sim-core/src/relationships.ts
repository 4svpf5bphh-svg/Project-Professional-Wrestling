import type {
  Id,
  WorldState,
  WrestlerRelationship,
  WrestlerRelationshipTag,
} from "../../domain/src/types.js";

export interface UpsertWrestlerRelationshipInput {
  personAId: Id;
  personBId: Id;
  affinity?: number;
  professionalTrust?: number;
  rivalryHeat?: number;
  familiarity?: number;
  tags?: WrestlerRelationshipTag[];
}

function canonicalPair(personAId: Id, personBId: Id): [Id, Id] {
  if (personAId === personBId) throw new Error("a wrestler cannot have a relationship with themselves");
  return personAId < personBId ? [personAId, personBId] : [personBId, personAId];
}

function relationshipId(personAId: Id, personBId: Id): Id {
  return `wrestler-relationship:${personAId}:${personBId}`;
}

function bounded(value: number | undefined, fallback: number, min: number, max: number, label: string): number {
  if (value === undefined) return fallback;
  if (!Number.isFinite(value) || value < min || value > max) {
    throw new Error(`${label} must be between ${min} and ${max}`);
  }
  return value;
}

function normalizedTags(tags: WrestlerRelationshipTag[] | undefined, existing: WrestlerRelationshipTag[]): WrestlerRelationshipTag[] {
  if (tags === undefined) return [...existing];
  return [...new Set(tags)].sort();
}

export function wrestlerRelationshipBetween(
  state: WorldState,
  leftPersonId: Id,
  rightPersonId: Id,
): WrestlerRelationship | null {
  const [personAId, personBId] = canonicalPair(leftPersonId, rightPersonId);
  return (state.wrestlerRelationships ?? []).find(
    (relationship) => relationship.personAId === personAId && relationship.personBId === personBId,
  ) ?? null;
}

export function upsertWrestlerRelationship(
  state: WorldState,
  input: UpsertWrestlerRelationshipInput,
): WrestlerRelationship {
  const [personAId, personBId] = canonicalPair(input.personAId, input.personBId);
  const personIds = new Set(state.people.map((person) => person.id));
  if (!personIds.has(personAId) || !personIds.has(personBId)) {
    throw new Error("wrestler relationship references a missing wrestler");
  }

  state.wrestlerRelationships ??= [];
  const existing = wrestlerRelationshipBetween(state, personAId, personBId);
  if (existing) {
    existing.affinity = bounded(input.affinity, existing.affinity, -100, 100, "relationship affinity");
    existing.professionalTrust = bounded(
      input.professionalTrust,
      existing.professionalTrust,
      -100,
      100,
      "relationship professional trust",
    );
    existing.rivalryHeat = bounded(input.rivalryHeat, existing.rivalryHeat, 0, 100, "relationship rivalry heat");
    existing.familiarity = bounded(input.familiarity, existing.familiarity, 0, 100, "relationship familiarity");
    existing.tags = normalizedTags(input.tags, existing.tags);
    return existing;
  }

  const relationship: WrestlerRelationship = {
    id: relationshipId(personAId, personBId),
    worldId: state.world.id,
    personAId,
    personBId,
    affinity: bounded(input.affinity, 0, -100, 100, "relationship affinity"),
    professionalTrust: bounded(input.professionalTrust, 0, -100, 100, "relationship professional trust"),
    rivalryHeat: bounded(input.rivalryHeat, 0, 0, 100, "relationship rivalry heat"),
    familiarity: bounded(input.familiarity, 0, 0, 100, "relationship familiarity"),
    tags: normalizedTags(input.tags, []),
  };
  state.wrestlerRelationships.push(relationship);
  return relationship;
}
