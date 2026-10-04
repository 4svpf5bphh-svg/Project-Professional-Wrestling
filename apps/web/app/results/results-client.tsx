"use client";

import { useEffect, useState } from "react";
import type { PlayerShowHistoryView } from "../../../../dist/packages/application/src/results-view.js";
import styles from "./results.module.css";

type ErrorPayload = { error?: string };

const DAY_NAMES = ["", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

function isErrorPayload(payload: PlayerShowHistoryView | ErrorPayload): payload is ErrorPayload {
  return "error" in payload;
}

function money(value: number): string {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

function integer(value: number): string {
  return new Intl.NumberFormat("en-GB", { maximumFractionDigits: 0 }).format(value);
}

function decimal(value: number): string {
  return new Intl.NumberFormat("en-GB", { maximumFractionDigits: 1 }).format(value);
}

function label(value: string): string {
  return value.replaceAll("_", " ").toLowerCase();
}

export default function ResultsClient(): React.JSX.Element {
  const [view, setView] = useState<PlayerShowHistoryView | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function refresh(): Promise<void> {
    setError(null);
    const response = await fetch("/api/results", { cache: "no-store" });
    const payload = await response.json() as PlayerShowHistoryView | ErrorPayload;
    if (!response.ok || isErrorPayload(payload)) {
      throw new Error(isErrorPayload(payload) && payload.error ? payload.error : "Unable to load show history");
    }
    setView(payload);
  }

  useEffect(() => {
    refresh().catch((reason: unknown) => {
      setError(reason instanceof Error ? reason.message : "Unable to load show history");
    });
  }, []);

  if (!view) {
    return (
      <main className={styles.shell}>
        <a className={styles.backLink} href="/">← Promotion</a>
        <section className={styles.panel}>
          <p>{error ?? "Loading show history…"}</p>
          {error ? <button className={styles.button} onClick={() => refresh().catch(() => undefined)}>Retry</button> : null}
        </section>
      </main>
    );
  }

  return (
    <main className={styles.shell}>
      <header className={styles.header}>
        <div>
          <a className={styles.backLink} href="/">← Promotion</a>
          <div className={styles.eyebrow}>RESULTS & HISTORY</div>
          <h1>{view.promotion?.name ?? "Show history"}</h1>
          <p>{view.world.name} · Year {view.world.currentDate.year}, Week {view.world.currentDate.week}</p>
        </div>
        <button className={styles.button} onClick={() => refresh().catch((reason: unknown) => setError(reason instanceof Error ? reason.message : "Unable to refresh"))}>Refresh</button>
      </header>

      {error ? <div className={styles.error}>{error}</div> : null}

      {!view.promotion ? (
        <section className={styles.panel}>
          <h2>No promotion yet</h2>
          <p>Take control of a promotion before show history is available.</p>
        </section>
      ) : view.shows.length === 0 ? (
        <section className={styles.panel}>
          <div className={styles.eyebrow}>NO COMPLETED SHOWS</div>
          <h2>Your history starts here</h2>
          <p>Once your first show resolves, its full card and consequences will appear here.</p>
        </section>
      ) : (
        <section className={styles.history}>
          {view.shows.map((show, index) => (
            <details className={styles.showCard} key={show.eventId} open={index === 0}>
              <summary className={styles.showSummary}>
                <div>
                  <span className={styles.eyebrow}>{show.type} SHOW · {DAY_NAMES[show.date.day] ?? `Day ${show.date.day}`}</span>
                  <strong>Year {show.date.year}, Week {show.date.week} · {show.venueName}</strong>
                  <span>{show.marketName} · {integer(show.attendance)} attendance ({decimal(show.attendancePercentOfCapacity)}%)</span>
                </div>
                <div className={show.netResult >= 0 ? styles.positive : styles.negative}>
                  {show.netResult >= 0 ? "+" : ""}{money(show.netResult)}
                </div>
              </summary>

              <div className={styles.showBody}>
                <div className={styles.metrics}>
                  <div><span>Gate</span><strong>{money(show.gateRevenue)}</strong></div>
                  <div><span>Cost</span><strong>{money(show.totalCost)}</strong></div>
                  <div><span>Average</span><strong>★ {decimal(show.averageMatchRating)}</strong></div>
                  <div><span>Best match</span><strong>★ {decimal(show.bestMatchRating)}</strong></div>
                  <div><span>Crowd</span><strong>{decimal(show.crowdResponse)}</strong></div>
                  <div><span>Consequences</span><strong>{show.titleChangeCount} title · {show.injuryCount} inj.</strong></div>
                </div>

                <div className={styles.matches}>
                  {show.matches.map((match) => {
                    const sideA = match.participants.filter((participant) => participant.side === "A");
                    const sideB = match.participants.filter((participant) => participant.side === "B");
                    return (
                      <article className={styles.matchCard} key={match.matchId}>
                        <div className={styles.matchTop}>
                          <span>{match.isMainEvent ? "MAIN EVENT" : `MATCH ${match.order}`} · {label(match.type)}</span>
                          <strong>★ {decimal(match.criticalRatingStars)}</strong>
                        </div>
                        <div className={styles.versus}>
                          <div>{sideA.map((participant) => <span className={participant.won ? styles.winner : undefined} key={participant.personId}>{participant.name}{participant.won ? " ✓" : ""}</span>)}</div>
                          <b>vs</b>
                          <div>{sideB.map((participant) => <span className={participant.won ? styles.winner : undefined} key={participant.personId}>{participant.name}{participant.won ? " ✓" : ""}</span>)}</div>
                        </div>
                        <div className={styles.matchMeta}>
                          <span>{label(match.intent)} intent</span>
                          <span>{match.actualLengthMinutes} min{match.actualLengthMinutes !== match.plannedLengthMinutes ? ` / ${match.plannedLengthMinutes} planned` : ""}</span>
                          <span>Crowd {decimal(match.crowdResponse)}</span>
                        </div>
                        {match.titleOutcomes.map((title) => (
                          <div className={styles.consequence} key={title.championshipId}>
                            <strong>{title.championshipName}</strong>
                            <span>{title.titleChanged ? `Title change → ${title.winnerHolderName}` : `${title.winnerHolderName} retained`}</span>
                          </div>
                        ))}
                        {match.injuries.map((injury) => (
                          <div className={`${styles.consequence} ${styles.injury}`} key={injury.injuryId}>
                            <strong>{injury.personName} injured</strong>
                            <span>{label(injury.severity)} · {injury.weeksOut} PPW week{injury.weeksOut === 1 ? "" : "s"} out</span>
                          </div>
                        ))}
                        {match.finishChangedDueToInjury ? <div className={styles.warning}>Finish changed because of injury</div> : null}
                      </article>
                    );
                  })}
                </div>
              </div>
            </details>
          ))}
        </section>
      )}
    </main>
  );
}
