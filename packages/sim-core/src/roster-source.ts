import type { Market, Person, Ruleset, World } from "../../domain/src/types.js";
import type { DeterministicRng } from "./rng.js";

export interface WorldRosterSourceContext {
  world: World;
  ruleset: Ruleset;
  markets: readonly Market[];
  rng: DeterministicRng;
}

export type WorldRosterSource = (context: WorldRosterSourceContext) => Person[];

export function validateWorldRosterSourceResult(
  context: WorldRosterSourceContext,
  people: Person[],
): Person[] {
  if (people.length !== context.ruleset.wrestlers) {
    throw new Error(
      `roster source returned ${people.length} wrestlers; expected ${context.ruleset.wrestlers}`,
    );
  }

  const ids = new Set<string>();
  for (const person of people) {
    if (person.worldId !== context.world.id) {
      throw new Error(`roster source wrestler ${person.id} belongs to ${person.worldId}, expected ${context.world.id}`);
    }
    if (!person.id.trim()) throw new Error("roster source wrestler id must not be empty");
    if (ids.has(person.id)) throw new Error(`roster source produced duplicate wrestler id ${person.id}`);
    ids.add(person.id);
    if (!person.name.trim()) throw new Error(`roster source wrestler ${person.id} must have a display name`);
  }

  return people;
}
