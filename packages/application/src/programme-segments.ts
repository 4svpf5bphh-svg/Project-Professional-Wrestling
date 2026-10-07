import type { Id, WorldState } from "../../domain/src/types.js";
import type { Programme } from "../../domain/src/programmes.js";
import {
  programmeActivities,
  recordProgrammeActivity,
} from "../../sim-core/src/programmes.js";
import type { DetailedProgrammeSegmentDraft, DetailedShowSegmentDraft, WorldPlanningState } from "./planning.js";

function sameWeek(left: { year: number; week: number }, right: { year: number; week: number }): boolean {
  return left.year === right.year && left.week === right.week;
}

function sameDate(
  left: { year: number; week: number; day: number },
  right: { year: number; week: number; day: number },
): boolean {
  return sameWeek(left, right) && left.day === right.day;
}

function activityEntityIds(
  state: WorldState,
  programme: Programme,
  segment: Pick<DetailedProgrammeSegmentDraft | DetailedShowSegmentDraft, "participantIds">,
): Id[] {
  const selectedPeople = new Set(segment.participantIds);
  const result = new Set<Id>();
  for (const ref of [...programme.sideA, ...programme.sideB]) {
    if (ref.kind === "PERSON") {
      if (selectedPeople.has(ref.entityId)) result.add(ref.entityId);
      continue;
    }
    const hasSelectedMember = (state.teamMemberships ?? []).some((membership) => (
      membership.teamId === ref.entityId
      && membership.active
      && selectedPeople.has(membership.personId)
    ));
    if (hasSelectedMember) result.add(ref.entityId);
  }
  return [...result].sort();
}

/**
 * Converts planned Programme segments into factual activity only after their show has resolved.
 * One segment per Programme per show keeps retries naturally idempotent.
 */
export function recordResolvedProgrammeSegments(
  state: WorldState,
  planning: WorldPlanningState,
): number {
  if (planning.worldId !== state.world.id) throw new Error("planning state does not belong to this World");
  let recorded = 0;

  for (const workspace of planning.workspaces) {
    for (const draft of workspace.detailedShowDrafts) {
      if (!sameWeek(draft.targetDate, state.world.currentDate)) continue;
      const segments: DetailedProgrammeSegmentDraft[] = [
        ...(draft.programmeSegments ?? []),
        ...(draft.segments ?? [])
          .filter((segment): segment is DetailedShowSegmentDraft & { programmeId: Id } => segment.programmeId !== null)
          .map((segment) => ({
            draftSegmentId: segment.draftSegmentId,
            programmeId: segment.programmeId,
            participantIds: [...segment.participantIds],
          })),
      ];
      if (segments.length === 0) continue;
      const event = state.events.find((candidate) => (
        candidate.promotionId === draft.promotionId
        && candidate.status === "COMPLETED"
        && sameDate(candidate.date, draft.targetDate)
      ));
      if (!event) continue;

      for (const segment of segments) {
        const programme = (state.programmes ?? []).find((candidate) => (
          candidate.id === segment.programmeId
          && candidate.promotionId === draft.promotionId
          && candidate.status === "ACTIVE"
        ));
        if (!programme) continue;
        const alreadyRecorded = programmeActivities(state, programme.id).some((activity) => (
          activity.kind === "SEGMENT" && activity.eventId === event.id
        ));
        if (alreadyRecorded) continue;
        const participantEntityIds = activityEntityIds(state, programme, segment);
        if (participantEntityIds.length === 0) continue;

        recordProgrammeActivity(state, {
          programmeId: programme.id,
          kind: "SEGMENT",
          date: event.date,
          participantEntityIds,
          eventId: event.id,
        });
        recorded += 1;
      }
    }
  }

  return recorded;
}
