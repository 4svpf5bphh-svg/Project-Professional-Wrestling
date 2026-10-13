"use client";

import type { PlayerShowResultView } from "../../../../dist/packages/application/src/results-view.js";
import type { PlayerWorldResultShowView } from "../../../../dist/packages/application/src/world-results-view.js";
import { showResultHighlights, type ShowResultHighlight } from "../../../../dist/packages/web-adapter/src/results-highlights.js";
import styles from "./results.module.css";

type BroadcastShow = Pick<PlayerShowResultView, "eventId" | "runningOrder" | "crowdResponse" | "averageMatchRating" | "bestMatchRating"> |
  Pick<PlayerWorldResultShowView, "eventId" | "runningOrder" | "crowdResponse" | "averageMatchRating" | "bestMatchRating">;

function display(value: number): string {
  return new Intl.NumberFormat("en-GB", { maximumFractionDigits: 1 }).format(value);
}

function iconFor(category: ShowResultHighlight["category"]): string {
  if (category === "CHAMPIONSHIP") return "🏆";
  if (category === "ARRIVAL") return "✦";
  if (category === "INJURY") return "✚";
  if (category === "MAIN_EVENT" || category === "MATCH") return "★";
  return "⚡";
}

export function segmentResultIcon(kind: string): string {
  if (["PROMO", "INTERVIEW", "CHALLENGE"].includes(kind)) return "🎤";
  if (kind === "VIDEO_PACKAGE") return "▶";
  if (kind === "CELEBRATION") return "★";
  if (kind === "LIVE_APPEARANCE") return "✦";
  if (["ATTACK", "POST_MATCH_ASSAULT", "RESCUE"].includes(kind)) return "⚡";
  if (kind.startsWith("STABLE_")) return "◆";
  return "◈";
}

/** This is a presentation lens on already completed show records. */
export default function ShowBroadcast({ show }: { show: BroadcastShow }): React.JSX.Element {
  const moments = showResultHighlights(show);
  const crowd = Number.isFinite(show.crowdResponse) ? show.crowdResponse : 0;
  return (
    <section className={styles.broadcast} aria-label="Completed show highlights">
      <div className={styles.broadcastMasthead}>
        <span><span aria-hidden="true">◉</span> PPW · SHOW REPLAY</span>
        <span>THE NIGHT IN FOCUS</span>
      </div>
      <div className={styles.broadcastNumbers}>
        <div className={styles.broadcastCrowd}>
          <span>CROWD RESPONSE</span>
          <strong>{display(show.crowdResponse)}<small> / 100</small></strong>
          <div className={styles.crowdRail} role="meter" aria-label="Final crowd response out of 100"
            aria-valuemin={0} aria-valuemax={100}
            aria-valuenow={Math.min(100, Math.max(0, Math.round(crowd)))}>
            <span style={{ width: `${Math.min(100, Math.max(0, crowd))}%` }} />
          </div>
        </div>
        <div className={styles.broadcastBest}>
          <span>BEST BOUT</span>
          <strong><span aria-hidden="true">★</span> {display(show.bestMatchRating)}</strong>
          <small>Show average ★ {display(show.averageMatchRating)}</small>
        </div>
      </div>
      {moments.length > 0 ? (
        <div className={styles.reelCards}>
          {moments.map((moment) => (
            <a href={`#show-${show.eventId}-slot-${moment.slotOrder}`}
              className={`${styles.reelCard} ${moment.category === "CHAMPIONSHIP" ? styles.reelTitle : moment.category === "INJURY" ? styles.reelInjury : ""}`}
              key={moment.id}>
              <span className={styles.reelSymbol} aria-hidden="true">{iconFor(moment.category)}</span>
              <span className={styles.reelContents}>
                <small>{moment.category.replaceAll("_", " ")} · SLOT {moment.slotOrder}</small>
                <strong>{moment.headline}</strong>
                <span>{moment.detail}</span>
              </span>
              <span className={styles.reelArrow} aria-hidden="true">↗</span>
            </a>
          ))}
        </div>
      ) : <p className={styles.reelEmpty}>Full completed card and crowd response below.</p>}
    </section>
  );
}
