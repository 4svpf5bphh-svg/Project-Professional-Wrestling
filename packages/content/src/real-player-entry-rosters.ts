import type {
  InitialRosterAssignment,
  InitialRosterAssignmentContext,
} from "../../sim-core/src/initial-roster-assignments.js";

export const PLAYER_ENTRY_STARTING_ROSTER_SIZE = 18 as const;
export const PLAYER_ENTRY_STARTING_MEN = 12 as const;
export const PLAYER_ENTRY_STARTING_WOMEN = 6 as const;

function talentScore(
  person: InitialRosterAssignmentContext["people"][number],
): number {
  return (
    person.popularity * 1.25
    + person.recognition * 1.15
    + person.skills.presentation
    + person.skills.inRingQuality
    + person.skills.matchCraft
  );
}

function distributeDivision(
  context: InitialRosterAssignmentContext,
  reservedPersonIds: Set<string>,
  promotionIds: string[],
  division: "MEN" | "WOMEN",
  perPromotion: number,
): InitialRosterAssignment[] {
  const required = promotionIds.length * perPromotion;
  const candidates = context.people
    .filter((person) => !reservedPersonIds.has(person.id))
    .filter((person) => (person.division ?? "MEN") === division)
    .sort((left, right) => (
      talentScore(right) - talentScore(left)
      || left.id.localeCompare(right.id)
    ));

  if (candidates.length < required) {
    throw new Error(
      `real-world player-entry seed needs ${required} unassigned ${division.toLowerCase()} wrestlers; found ${candidates.length}`,
    );
  }

  const assignments: InitialRosterAssignment[] = [];
  for (let index = 0; index < required; index += 1) {
    const cycle = Math.floor(index / promotionIds.length);
    const offset = index % promotionIds.length;
    const promotionIndex = cycle % 2 === 0
      ? offset
      : promotionIds.length - 1 - offset;
    const promotionId = promotionIds[promotionIndex]!;
    const person = candidates[index]!;
    reservedPersonIds.add(person.id);
    assignments.push({
      personId: person.id,
      promotionId,
      rosterPromotionId: promotionId,
      family: "LIMITED_NON_EXCLUSIVE",
    });
  }
  return assignments;
}

/**
 * The five fictional player-entry companies need real, immediately bookable
 * rosters without contaminating the free market with WWE/other protected
 * talent. Seed them only after all reviewed real-promotion assignments are
 * reserved, then balance recognised available talent across the five companies.
 *
 * These are Indie-style limited-date/non-exclusive deals by design. The
 * wrestler remains part of the wider accessible ecosystem while giving a new
 * player enough people to book a legal and interesting opening slate.
 */
export function playerEntryInitialRosterAssignments(
  context: InitialRosterAssignmentContext,
  existingAssignments: InitialRosterAssignment[],
): InitialRosterAssignment[] {
  const promotions = context.promotions
    .filter((promotion) => promotion.playerTakeoverEligibility === "STANDARD")
    .sort((left, right) => left.id.localeCompare(right.id));
  if (promotions.length === 0) return [];

  const promotionIds = promotions.map((promotion) => promotion.id);
  const reservedPersonIds = new Set(existingAssignments.map((assignment) => assignment.personId));

  return [
    ...distributeDivision(
      context,
      reservedPersonIds,
      promotionIds,
      "MEN",
      PLAYER_ENTRY_STARTING_MEN,
    ),
    ...distributeDivision(
      context,
      reservedPersonIds,
      promotionIds,
      "WOMEN",
      PLAYER_ENTRY_STARTING_WOMEN,
    ),
  ];
}
