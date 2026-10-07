import type {
  ContractFamily,
  Id,
  Person,
  Promotion,
  Ruleset,
  World,
  WorldState,
  WrestlerPromotionAffiliationBasis,
  WrestlerPromotionAffiliationRole,
} from "../../domain/src/types.js";

export interface InitialRosterAffiliation {
  promotionId: Id;
  role: WrestlerPromotionAffiliationRole;
  basis: WrestlerPromotionAffiliationBasis;
}

export interface InitialRosterAssignment {
  personId: Id;
  promotionId: Id;
  rosterPromotionId?: Id;
  rosterAffiliations?: InitialRosterAffiliation[];
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
  const affiliationKeys = new Set<string>();
  const primaryPromotionByPerson = new Map<Id, Id>();

  for (const assignment of assignments) {
    if (!people.has(assignment.personId)) {
      throw new Error(`initial roster assignment references missing wrestler ${assignment.personId}`);
    }
    if (!promotions.has(assignment.promotionId)) {
      throw new Error(`initial roster assignment references missing promotion ${assignment.promotionId}`);
    }
    if (assignment.rosterPromotionId !== undefined && !promotions.has(assignment.rosterPromotionId)) {
      throw new Error(`initial roster assignment references missing roster promotion ${assignment.rosterPromotionId}`);
    }
    if (assignment.family !== "EXCLUSIVE" && assignment.family !== "LIMITED_NON_EXCLUSIVE") {
      throw new Error("initial roster assignment uses unsupported contract family");
    }
    const affiliations: InitialRosterAffiliation[] = assignment.rosterAffiliations
      ?? (assignment.rosterPromotionId === undefined ? [] : [{
        promotionId: assignment.rosterPromotionId,
        role: "PRIMARY",
        basis: assignment.rosterPromotionId === assignment.promotionId ? "CONTRACT" : "PARENT_COMPANY",
      }]);
    for (const affiliation of affiliations) {
      if (!promotions.has(affiliation.promotionId)) {
        throw new Error(`initial roster assignment references missing roster promotion ${affiliation.promotionId}`);
      }
      const affiliationKey = `${assignment.personId}:${affiliation.promotionId}`;
      if (affiliationKeys.has(affiliationKey)) throw new Error(`duplicate initial roster affiliation ${affiliationKey}`);
      affiliationKeys.add(affiliationKey);
      if (affiliation.role === "PRIMARY") {
        const existingPrimary = primaryPromotionByPerson.get(assignment.personId);
        if (existingPrimary !== undefined && existingPrimary !== affiliation.promotionId) {
          throw new Error(`initial roster assignment gives ${assignment.personId} multiple primary rosters`);
        }
        primaryPromotionByPerson.set(assignment.personId, affiliation.promotionId);
      }
      if (affiliation.basis === "CONTRACT" && affiliation.promotionId !== assignment.promotionId) {
        throw new Error("contract-backed roster affiliation must match its employment contract");
      }
      if (affiliation.basis === "PARENT_COMPANY") {
        const rosterPromotion = state.promotions.find((promotion) => promotion.id === affiliation.promotionId)!;
        if (rosterPromotion.identity?.parentPromotionId !== assignment.promotionId) {
          throw new Error("parent-company roster affiliation must belong to a child promotion");
        }
      }
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
