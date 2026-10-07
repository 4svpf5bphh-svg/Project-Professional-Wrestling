import type {
  ContractFamily,
  Id,
  Person,
  Promotion,
  Ruleset,
  World,
  WorldState,
} from "../../domain/src/types.js";

export interface InitialRosterAssignment {
  personId: Id;
  promotionId: Id;
  family: Extract<ContractFamily, "EXCLUSIVE" | "LIMITED_NON_EXCLUSIVE">;
}

export interface InitialRosterAssignmentContext {
  world: World;
  ruleset: Ruleset;
  people: readonly Person[];
  promotions: readonly Promotion[];
}

export type InitialRosterAssignmentSource = (
  context: InitialRosterAssignmentContext,
) => InitialRosterAssignment[];

export const emptyInitialRosterAssignmentSource: InitialRosterAssignmentSource = () => [];

export function validateInitialRosterAssignments(
  state: WorldState,
  assignments: InitialRosterAssignment[],
): InitialRosterAssignment[] {
  const people = new Set(state.people.map((person) => person.id));
  const promotions = new Set(state.promotions.map((promotion) => promotion.id));
  const exactKeys = new Set<string>();
  const byPerson = new Map<Id, InitialRosterAssignment[]>();

  for (const assignment of assignments) {
    if (!people.has(assignment.personId)) {
      throw new Error(`initial roster assignment references missing wrestler ${assignment.personId}`);
    }
    if (!promotions.has(assignment.promotionId)) {
      throw new Error(`initial roster assignment references missing promotion ${assignment.promotionId}`);
    }
    if (assignment.family !== "EXCLUSIVE" && assignment.family !== "LIMITED_NON_EXCLUSIVE") {
      throw new Error("initial roster assignment uses unsupported contract family");
    }
    const key = `${assignment.personId}:${assignment.promotionId}`;
    if (exactKeys.has(key)) throw new Error(`duplicate initial roster assignment ${key}`);
    exactKeys.add(key);
    const list = byPerson.get(assignment.personId) ?? [];
    list.push(assignment);
    byPerson.set(assignment.personId, list);
  }

  for (const [personId, personAssignments] of byPerson) {
    const exclusive = personAssignments.filter((assignment) => assignment.family === "EXCLUSIVE");
    if (exclusive.length > 1 || (exclusive.length === 1 && personAssignments.length > 1)) {
      throw new Error(`initial roster assignment gives ${personId} overlapping exclusive employment`);
    }
  }

  return assignments;
}
