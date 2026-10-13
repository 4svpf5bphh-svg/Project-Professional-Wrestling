import type { PlayerShowResultView } from "../../application/src/results-view.js";
import type { PlayerWorldResultShowView } from "../../application/src/world-results-view.js";

/** Presentation derived exclusively from actually resolved results. Never an
 * event feed, narrative model, score adjustment or private rival projection. */
export interface ShowResultHighlight {
  id: string;
  category: "CHAMPIONSHIP" | "ARRIVAL" | "INJURY" | "MAIN_EVENT" | "MATCH" | "ANGLE" | "FINISH";
  headline: string;
  detail: string;
  slotOrder: number;
}
type ShowSource = Pick<PlayerShowResultView, "runningOrder"> |
  Pick<PlayerWorldResultShowView, "runningOrder">;
type Candidate = ShowResultHighlight & { priority: number };

/** A brief headline follows the actual performed segment type. No generated
 * unrecorded action, no gambling on who wins a confrontation, no cryptic reveal. */
export function hotSegmentHeadline(type: string, subject: string): string {
  switch (type) {
    case "PROMO": return `${subject} has the crowd buzzing`;
    case "INTERVIEW": return `${subject} draws a huge reaction`;
    case "ATTACK":
    case "POST_MATCH_ASSAULT": return "A heated assault electrifies the crowd";
    case "RESCUE": return "The attempted rescue draws a huge reaction";
    case "CONFRONTATION": return "A confrontation brings the crowd alive";
    case "CHALLENGE": return "The challenge gets everyone talking";
    case "INTERRUPTION": return "An interruption jolts the building";
    case "VIDEO_PACKAGE": return "The video package sparks excitement";
    case "LIVE_APPEARANCE": return "A live appearance sends the crowd wild";
    case "CELEBRATION": return "The celebration brings the crowd to its feet";
    case "TURN": return "An alignment change draws a huge reaction";
    default: return "An on-screen moment makes an impact";
  }
}


export function showResultHighlights(show: ShowSource, limit = 3): ShowResultHighlight[] {
  const candidates: Candidate[] = [];
  let topMatch: Candidate | null = null;
  let topRating = -1;

  for (const slot of show.runningOrder) {
    if (slot.kind === "MATCH") {
      const match = slot.match;
      for (const title of match.titleOutcomes) {
        if (!title.titleChanged) continue;
        candidates.push({
          id: `title:${match.matchId}:${title.championshipId}`,
          category: "CHAMPIONSHIP", priority: 105, slotOrder: slot.order,
          headline: `${title.championshipName} changes hands`,
          detail: `${title.winnerHolderName} wins the championship`,
        });
      }
      for (const injury of match.injuries) {
        candidates.push({
          id: `injury:${injury.injuryId}`, category: "INJURY",
          priority: 88, slotOrder: slot.order,
          headline: `${injury.personName} injured`,
          detail: `${injury.severity.toLowerCase().replaceAll("_", " ")} · ${injury.weeksOut} PPW week${injury.weeksOut === 1 ? "" : "s"} out`,
        });
      }
      if (match.actualFinish === "DISQUALIFICATION" || match.actualFinish === "FOREIGN_OBJECT") {
        const disqualified = match.actualFinish === "DISQUALIFICATION";
        candidates.push({
          id: `finish:${match.matchId}`, category: "FINISH",
          priority: disqualified ? 91 : 90, slotOrder: slot.order,
          headline: disqualified ? "Disqualification decides the bout" : "Foreign object decides the bout",
          detail: `${match.winnerNames.length ? match.winnerNames.join(" & ") : "Winner not recorded"} · ${match.finishCheater?.name ? `${match.finishCheater.name} ${disqualified ? "caught cheating" : "used a foreign object"}` : disqualified ? "Opponents disqualified for cheating" : "Foreign object went unseen"}${match.finishFallout?.reason === "HEEL_CHEATING_HEAT" ? " · heel heat landed" : ""}`,
        });
      }
      const rating = Number.isFinite(match.criticalRatingStars) ? match.criticalRatingStars : 0;
      if (rating > topRating) {
        topRating = rating;
        topMatch = {
          id: `best:${match.matchId}`, category: match.isMainEvent ? "MAIN_EVENT" : "MATCH",
          priority: 78, slotOrder: slot.order,
          headline: match.isMainEvent ? "Main event delivers the top-rated match" : "Top-rated match",
          detail: `★ ${rating.toFixed(1)} · ${match.winnerNames.length ? `${match.winnerNames.join(" & ")} victorious` : "No winner recorded"}`,
        };
      }
    } else {
      const segment = slot.segment;
      const wrestler = segment.participants[0]?.name ?? "Featured wrestler";
      if (segment.type === "LIVE_APPEARANCE"
        && ["DEBUT", "RETURN", "SURPRISE_REVEAL"].includes(segment.liveAppearanceKind ?? "")) {
        const arrival = segment.liveAppearanceKind === "DEBUT" ? "Promotion debut"
          : segment.liveAppearanceKind === "RETURN" ? "Live return" : "Surprise arrival";
        candidates.push({
          id: `arrival:${segment.segmentId}`, category: "ARRIVAL",
          priority: segment.liveAppearanceKind === "DEBUT" ? 98 : 93,
          slotOrder: slot.order, headline: `${wrestler} · ${arrival}`,
          detail: "Performed live, as booked",
        });
      }
      if (segment.type === "TURN" && segment.turnTargetAlignment) {
        const turningWrestler = segment.participants.find((person) => person.personId === segment.turnPersonId)?.name ?? wrestler;
        candidates.push({
          id: `turn:${segment.segmentId}`, category: "ANGLE", priority: 84,
          slotOrder: slot.order, headline: `${turningWrestler} turns ${segment.turnTargetAlignment.toLowerCase()}`,
          detail: segment.turnPresentation === "BETRAYAL" ? "Betrayal on screen" : "Alignment change",
        });
      }
      // An actual debut or turn already has its own more informative moment.
      // The same slot should not also receive a generic "hot angle" headline.
      const alreadyFeatured = (segment.type === "LIVE_APPEARANCE"
        && ["DEBUT", "RETURN", "SURPRISE_REVEAL"].includes(segment.liveAppearanceKind ?? ""))
        || (segment.type === "TURN" && Boolean(segment.turnTargetAlignment));
      if (segment.outcomeBand === "HOT" && !alreadyFeatured) {
        candidates.push({
          id: `hot:${segment.segmentId}`, category: "ANGLE", priority: 64,
          slotOrder: slot.order,
          headline: hotSegmentHeadline(segment.type, segment.type === "VIDEO_PACKAGE" && segment.videoReveal === "CRYPTIC" ? "Mystery footage" : wrestler),
          detail: `${segment.type === "VIDEO_PACKAGE" && segment.videoReveal === "CRYPTIC" ? "Mystery footage" : wrestler} · crowd ${segment.crowdResponse === null ? "not recorded" : segment.crowdResponse.toFixed(1)}`,
        });
      }
    }
  }
  if (topMatch) candidates.push(topMatch);
  // A single match may have several independently factual consequences (e.g.
  // a title change, an injury and the night's best rating). Preserve them
  // instead of hiding the consequence because they jump to the same bout.
  return candidates
    .sort((a, b) =>
      b.priority - a.priority || a.slotOrder - b.slotOrder || a.id.localeCompare(b.id))
    .slice(0, Math.max(0, Math.floor(Number.isFinite(limit) ? limit : 3)))
    .map(({ priority: _priority, ...item }) => item);
}
