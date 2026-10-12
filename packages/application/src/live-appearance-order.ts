import type { Id } from "../../domain/src/types.js";

/** A booked debut or return must be the first live sighting on its own show. */
export function validateArrivalRunningOrder(
  order: readonly { kind: "MATCH" | "SEGMENT"; refId: string }[],
  matches: readonly { draftMatchId: string; sideAIds: readonly Id[]; sideBIds: readonly Id[] }[],
  segments: readonly { draftSegmentId: string; type?: string; participantIds: readonly Id[];
    liveAppearanceKind?: string | null }[],
): void {
  const matchById = new Map(matches.map((match) => [match.draftMatchId, match]));
  const segmentById = new Map(segments.map((segment) => [segment.draftSegmentId, segment]));
  const alreadySeen = new Set<Id>();
  for (const slot of order) {
    if (slot.kind === "MATCH") {
      const match = matchById.get(slot.refId);
      if (match) for (const id of [...match.sideAIds, ...match.sideBIds]) if (id) alreadySeen.add(id);
      continue;
    }
    const segment = segmentById.get(slot.refId);
    if (!segment) continue;
    if (segment.type === "VIDEO_PACKAGE") continue;
    if (segment.type === "LIVE_APPEARANCE"
      && (segment.liveAppearanceKind === "DEBUT" || segment.liveAppearanceKind === "RETURN")
      && segment.participantIds[0] && alreadySeen.has(segment.participantIds[0])) {
      throw new Error("debut or return must be the wrestler's first in-person moment in this show's running order");
    }
    for (const personId of segment.participantIds) if (personId) alreadySeen.add(personId);
  }
}
