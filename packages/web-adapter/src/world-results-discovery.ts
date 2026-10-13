import type { PlayerWorldResultShowView } from "../../application/src/world-results-view.js";

export type WorldResultsSpotlight = "ALL" | "TITLE_CHANGES" | "ARRIVALS" | "CONTROVERSY" | "INJURIES";

export const WORLD_RESULTS_SPOTLIGHTS: ReadonlyArray<{ value: WorldResultsSpotlight; label: string }> = [
  { value: "ALL", label: "All shows" },
  { value: "TITLE_CHANGES", label: "Title changes" },
  { value: "ARRIVALS", label: "Debuts & returns" },
  { value: "CONTROVERSY", label: "Controversy" },
  { value: "INJURIES", label: "Injuries" },
];

/** All filters examine existing publicly completed results, NOT the three
 * selected broadcast headlines (a fourth real consequence must not disappear). */
export function worldShowHasSpotlight(show: PlayerWorldResultShowView, spotlight: WorldResultsSpotlight): boolean {
  switch (spotlight) {
    case "ALL": return true;
    case "TITLE_CHANGES":
      return show.matches.some((match) => match.titleOutcomes.some((title) => title.titleChanged));
    case "ARRIVALS":
      return show.segments.some((segment) =>
        segment.type === "LIVE_APPEARANCE"
        && ["DEBUT", "RETURN", "SURPRISE_REVEAL"].includes(segment.liveAppearanceKind ?? ""));
    case "CONTROVERSY":
      return show.matches.some((match) =>
        match.actualFinish === "DISQUALIFICATION" || match.actualFinish === "FOREIGN_OBJECT"
        || (match.actualFinish === "PROTECTED_FINISH" && match.interference?.outcome === "SUCCESS"));
    case "INJURIES": return show.matches.some((match) => match.injuries.length > 0);
  }
}

function publicSearchText(show: PlayerWorldResultShowView): string {
  const terms = [show.promotionName, show.marketName, show.venueName];
  for (const match of show.matches) {
    terms.push(...match.participants.map((participant) => participant.name));
    for (const title of match.titleOutcomes) {
      terms.push(title.championshipName, title.winnerHolderName);
      if (title.previousHolderName) terms.push(title.previousHolderName);
    }
  }
  for (const segment of show.segments) {
    // Cryptic footage's deliberately obscured subject must never enter public
    // search results, even if a legacy public snapshot lists them as participant.
    if (segment.type === "VIDEO_PACKAGE" && segment.videoReveal === "CRYPTIC") continue;
    terms.push(...segment.participants.map((participant) => participant.name));
    if (segment.videoSubjectName) terms.push(segment.videoSubjectName);
  }
  return terms.join(" ").toLocaleLowerCase();
}

export interface WorldResultsDiscoveryFilters {
  promotionId: string;
  spotlight: WorldResultsSpotlight;
  query: string;
}

export function discoverWorldResults(
  shows: readonly PlayerWorldResultShowView[],
  filters: WorldResultsDiscoveryFilters,
): PlayerWorldResultShowView[] {
  const needle = filters.query.trim().toLocaleLowerCase().slice(0, 100);
  return shows.filter((show) =>
    (filters.promotionId === "ALL" || show.promotionId === filters.promotionId)
    && worldShowHasSpotlight(show, filters.spotlight)
    && (!needle || publicSearchText(show).includes(needle)));
}

/** The backend already sorts recent completed public shows; this only groups
 * visible entries. It deliberately makes no claim about completeness beyond
 * the current 30-show public window. */
export function worldResultsWeekLabel(show: Pick<PlayerWorldResultShowView, "date">): string {
  return `Year ${show.date.year} · Week ${show.date.week}`;
}
