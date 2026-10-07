import type { Person, WrestlerDivision } from "../../domain/src/types.js";

export function wrestlerDivision(person: Pick<Person, "division">): WrestlerDivision {
  return person.division ?? "MEN";
}

export function requireSameWrestlerDivision(
  people: readonly Pick<Person, "division">[],
  message = "matches cannot mix men's and women's divisions",
): WrestlerDivision {
  if (people.length === 0) throw new Error("division check requires at least one wrestler");
  const division = wrestlerDivision(people[0]!);
  if (!people.every((person) => wrestlerDivision(person) === division)) {
    throw new Error(message);
  }
  return division;
}
