"use client";

import { useEffect, useState } from "react";
import type { PlayerSixWeekPlannerView } from "../../../../dist/packages/application/src/planning-view.js";
import styles from "./planner.module.css";

type ErrorPayload = { error?: string };

const DAY_NAMES = ["", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

function isErrorPayload(payload: PlayerSixWeekPlannerView | ErrorPayload): payload is ErrorPayload {
  return "error" in payload;
}

function label(value: string): string {
  return value.replaceAll("_", " ");
}

function statusClass(state: string): string {
  if (state === "AT_RISK") return styles.risk;
  if (state === "RESERVED" || state === "READY_TO_LOCK") return styles.good;
  if (state === "MATERIALIZED") return styles.live;
  return styles.neutral;
}

export default function PlannerClient(): React.JSX.Element {
  const [view, setView] = useState<PlayerSixWeekPlannerView | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function refresh(): Promise<void> {
    setError(null);
    const response = await fetch("/api/planner", { cache: "no-store" });
    const payload = await response.json() as PlayerSixWeekPlannerView | ErrorPayload;
    if (!response.ok || isErrorPayload(payload)) {
      throw new Error(isErrorPayload(payload) && payload.error ? payload.error : "Unable to load six-week planner");
    }
    setView(payload);
  }

  useEffect(() => {
    refresh().catch((reason: unknown) => {
      setError(reason instanceof Error ? reason.message : "Unable to load six-week planner");
    });
  }, []);

  if (!view) {
    return (
      <main className={styles.shell}>
        <a className={styles.backLink} href="/">← Promotion</a>
        <section className={styles.panel}>
          <p>{error ?? "Loading six-week planner…"}</p>
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
          <div className={styles.eyebrow}>SIX-WEEK PLANNER</div>
          <h1>{view.promotion?.name ?? "Planning"}</h1>
          <p>{view.world.name} · Year {view.world.currentDate.year}, Week {view.world.currentDate.week}</p>
        </div>
        <button className={styles.button} onClick={() => refresh().catch((reason: unknown) => setError(reason instanceof Error ? reason.message : "Unable to refresh"))}>Refresh</button>
      </header>

      {error ? <div className={styles.error}>{error}</div> : null}

      {!view.promotion ? (
        <section className={styles.panel}>
          <h2>No promotion yet</h2>
          <p>Take control of a promotion before the six-week planner is available.</p>
        </section>
      ) : (
        <>
          <section className={styles.intro}>
            <div>
              <span>Planning horizon</span>
              <strong>{view.promotion.horizonWeeks} PPW weeks</strong>
            </div>
            <div>
              <span>Plan version</span>
              <strong>{view.promotion.workspaceVersion}</strong>
            </div>
            <div>
              <span>World</span>
              <strong>{view.world.phase}</strong>
            </div>
          </section>

          <section className={styles.timeline}>
            {view.promotion.weeks.map((week) => (
              <article className={`${styles.weekCard} ${week.isCurrentWeek ? styles.currentWeek : ""}`} key={`${week.year}-${week.week}`}>
                <div className={styles.weekHeader}>
                  <div>
                    <span className={styles.eyebrow}>{week.isCurrentWeek ? "CURRENT WEEK" : `+${week.offset} WEEK${week.offset === 1 ? "" : "S"}`}</span>
                    <h2>Year {week.year} · Week {week.week}</h2>
                  </div>
                  <span className={week.showRequired ? styles.required : styles.optional}>{week.showRequired ? "SHOW DUE" : "OPTIONAL"}</span>
                </div>

                {week.shows.length === 0 ? (
                  <div className={styles.emptyShow}>
                    <strong>No show planned</strong>
                    <span>{week.showRequired ? "This week will need a show before lock." : "No mandatory show is due in this week."}</span>
                  </div>
                ) : week.shows.map((show) => (
                  <section className={styles.showCard} key={show.draftId}>
                    <div className={styles.showTop}>
                      <div>
                        <span>{DAY_NAMES[show.targetDate.day] ?? `Day ${show.targetDate.day}`}</span>
                        <strong>{show.venueName ?? "Venue not selected"}</strong>
                        <small>{show.marketName ?? "Market not selected"}{show.ticketStrategy ? ` · ${label(show.ticketStrategy)}` : ""}</small>
                      </div>
                      <span className={`${styles.state} ${statusClass(show.state)}`}>{label(show.state)}</span>
                    </div>

                    <div className={styles.metrics}>
                      <div><span>Talent</span><strong>{show.participants.length}</strong></div>
                      <div><span>Reserved</span><strong>{show.reservedParticipantCount}</strong></div>
                      <div><span>Matches</span><strong>{show.matchCount}</strong></div>
                      <div><span>Readiness</span><strong>{label(show.readiness)}</strong></div>
                    </div>

                    {show.participants.length > 0 ? (
                      <div className={styles.people}>
                        {show.participants.map((person) => <span key={person.personId}>{person.name}</span>)}
                      </div>
                    ) : <p className={styles.muted}>No wrestlers selected yet.</p>}

                    {show.workspaceChangedSinceReservation ? (
                      <div className={styles.warning}>Plan changed since reservation — refresh the reservation before relying on those commitments.</div>
                    ) : null}
                    {show.riskReasons.length > 0 ? (
                      <div className={styles.warning}>{show.riskReasons.map(label).join(" · ")}</div>
                    ) : null}
                  </section>
                ))}
              </article>
            ))}
          </section>

          <p className={styles.footerNote}>This first planner view is read-only. Future-week editing and reservation actions will be added on top of this player-scoped projection next.</p>
        </>
      )}
    </main>
  );
}
