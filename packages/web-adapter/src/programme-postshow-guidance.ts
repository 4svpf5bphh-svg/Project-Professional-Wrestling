import type { Id, PpwDate } from "../../domain/src/types.js";
import type { ProgrammeActivity } from "../../domain/src/programmes.js";
import type { PostShowFollowUp, PostShowFollowUpChoice } from "../../application/src/planning.js";

export interface ProgrammePostShowDirection {
  choice: PostShowFollowUpChoice;
  sourceMatchId: Id;
  selectedYear: number;
  selectedWeek: number;
  /** A later performed Programme beat exists; the note is background, not a fresh instruction. */
  laterBeatRecorded: boolean;
}

function ordinal(date: PpwDate, weeksPerYear: number): number {
  return ((date.year - 1) * weeksPerYear + (date.week - 1)) * 7 + date.day;
}

/** Read-only projection. Never reserves, chooses a segment or mutates Programme heat.
 * "Later beat" means only that something else happened, NOT that a plan was fulfilled. */
export function programmePostShowDirection(
  notes: readonly PostShowFollowUp[] | undefined,
  activities: readonly ProgrammeActivity[] | undefined,
  promotionId: Id,
  programmeId: Id,
  weeksPerYear: number,
): ProgrammePostShowDirection | null {
  const candidates = (notes ?? [])
    .filter((note) => note.promotionId === promotionId && note.programmeId === programmeId)
    .sort((a, b) =>
      ordinal(b.chosenAt, weeksPerYear) - ordinal(a.chosenAt, weeksPerYear)
      || b.matchId.localeCompare(a.matchId));
  const note = candidates[0];
  if (!note) return null;
  const lastChosen = ordinal(note.chosenAt, weeksPerYear);
  const laterBeatRecorded = (activities ?? []).some((activity) =>
    activity.promotionId === promotionId && activity.programmeId === programmeId
    && (activity.kind === "MATCH" || activity.kind === "SEGMENT")
    && ordinal(activity.date, weeksPerYear) > lastChosen);
  return {
    choice: note.choice, sourceMatchId: note.matchId,
    selectedYear: note.chosenAt.year, selectedWeek: note.chosenAt.week,
    laterBeatRecorded,
  };
}

export function postShowDirectionHint(direction: ProgrammePostShowDirection, slot: "MATCH" | "SEGMENT"): string {
  if (direction.laterBeatRecorded) {
    return "Earlier post-show direction. A newer Programme beat has already happened; review the rivalry before continuing.";
  }
  if (direction.choice === "LET_STAND") {
    return "You chose to let that result stand. No new match or segment is required; booking another beat is your choice.";
  }
  if (direction.choice === "PURSUE_REMATCH") {
    return slot === "MATCH"
      ? "Rematch direction saved. Check the original opponents, dates and consent; you still choose the winner and finish."
      : "Rematch direction saved. A challenge or confrontation could set up the return bout; acceptance never books it automatically.";
  }
  return slot === "MATCH"
    ? "Retaliation direction saved. A direct match is optional; you still author its result and any aftermath."
    : "Retaliation direction saved. An attack, confrontation or promo can continue the issue; choose the participants and scripted outcome.";
}
