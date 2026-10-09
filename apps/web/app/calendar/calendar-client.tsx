"use client";

import { useEffect, useMemo, useState } from "react";
import type {
  PlayerWorldCalendarOccurrenceView,
  PlayerWorldCalendarView,
} from "../../../../dist/packages/application/src/world-calendar-view.js";
import styles from "./calendar.module.css";

type ErrorPayload = { error?: string };
type CalendarFilter = "ALL" | "MINE" | "BIG";

function isErrorPayload(payload: PlayerWorldCalendarView | ErrorPayload): payload is ErrorPayload {
  return "error" in payload;
}

function label(value: string): string {
  return value.replaceAll("_", " ");
}

function weekKey(entry: Pick<PlayerWorldCalendarOccurrenceView, "year" | "week">): string {
  return `${entry.year}:${entry.week}`;
}

function dayLabel(day: number | null): string {
  if (day === null) return "Date TBC";
  const names = ["", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  return names[day] ?? `Day ${day}`;
}

function isBig(entry: PlayerWorldCalendarOccurrenceView): boolean {
  return entry.eventType === "MAJOR"
    || entry.role === "PREMIUM"
    || entry.role === "SPECIAL"
    || entry.eventImportance >= 80;
}

export default function CalendarClient(): React.JSX.Element {
  const [view, setView] = useState<PlayerWorldCalendarView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<CalendarFilter>("ALL");

  async function refresh(): Promise<void> {
    setError(null);
    const response = await fetch("/api/calendar", { cache: "no-store" });
    const payload = await response.json() as PlayerWorldCalendarView | ErrorPayload;
    if (!response.ok || isErrorPayload(payload)) {
      throw new Error(isErrorPayload(payload) && payload.error ? payload.error : "Unable to load calendar");
    }
    setView(payload);
  }

  useEffect(() => {
    refresh().catch((reason: unknown) => {
      setError(reason instanceof Error ? reason.message : "Unable to load calendar");
    });
  }, []);

  const visible = useMemo(() => {
    if (!view) return [];
    if (filter === "MINE") return view.occurrences.filter((entry) => entry.isPlayerPromotion);
    if (filter === "BIG") return view.occurrences.filter(isBig);
    return view.occurrences;
  }, [filter, view]);

  const weeks = useMemo(() => {
    const grouped = new Map<string, PlayerWorldCalendarOccurrenceView[]>();
    for (const entry of visible) {
      const key = weekKey(entry);
      const current = grouped.get(key) ?? [];
      current.push(entry);
      grouped.set(key, current);
    }
    return [...grouped.entries()].map(([key, entries]) => ({
      key,
      year: entries[0]!.year,
      week: entries[0]!.week,
      entries,
    }));
  }, [visible]);

  if (!view) {
    return (
      <main className={styles.shell}>
        <section className={styles.panel}>
          <p>{error ?? "Loading World calendar…"}</p>
          {error ? <button className={styles.button} onClick={() => refresh().catch(() => undefined)}>Retry</button> : null}
        </section>
      </main>
    );
  }

  const currentKey = `${view.world.currentDate.year}:${view.world.currentDate.week}`;

  return (
    <main className={styles.shell}>
      <header className={styles.header}>
        <div>
          <div className={styles.eyebrow}>WORLD CALENDAR</div>
          <h1>Upcoming wrestling</h1>
          <p>{view.world.name} · Year {view.world.currentDate.year}, Week {view.world.currentDate.week}</p>
        </div>
        <button className={styles.button} onClick={() => refresh().catch((reason: unknown) => {
          setError(reason instanceof Error ? reason.message : "Unable to refresh");
        })}>Refresh</button>
      </header>

      {error ? <div className={styles.error}>{error}</div> : null}

      <section className={styles.summary}>
        <div><span>Horizon</span><strong>{view.horizonWeeks} weeks</strong></div>
        <div><span>Upcoming</span><strong>{view.occurrences.length}</strong></div>
        <div><span>Big events</span><strong>{view.occurrences.filter(isBig).length}</strong></div>
      </section>

      <nav className={styles.filters} aria-label="Calendar filters">
        <button className={filter === "ALL" ? styles.activeFilter : ""} onClick={() => setFilter("ALL")}>All</button>
        <button className={filter === "MINE" ? styles.activeFilter : ""} onClick={() => setFilter("MINE")}>My promotion</button>
        <button className={filter === "BIG" ? styles.activeFilter : ""} onClick={() => setFilter("BIG")}>Big events</button>
      </nav>

      <section className={styles.agenda}>
        {weeks.map((group) => (
          <section className={`${styles.week} ${group.key === currentKey ? styles.currentWeek : ""}`} key={group.key}>
            <header className={styles.weekHeader}>
              <div>
                <span>{group.key === currentKey ? "CURRENT WEEK" : "PPW WEEK"}</span>
                <strong>Year {group.year} · Week {group.week}</strong>
              </div>
              <b>{group.entries.length} event{group.entries.length === 1 ? "" : "s"}</b>
            </header>

            <div className={styles.events}>
              {group.entries.map((entry) => {
                const big = isBig(entry);
                const booked = entry.eventId !== null;
                const content = (
                  <>
                    <div className={styles.eventLead}>
                      <div className={styles.eventBadges}>
                        {entry.isPlayerPromotion ? <span className={styles.yours}>YOU</span> : null}
                        <span className={big ? styles.bigBadge : styles.regularBadge}>{label(entry.role)}</span>
                        {booked ? <span className={styles.booked}>BOOKED</span> : null}
                      </div>
                      <strong>{entry.showName}</strong>
                      <span>{entry.promotionName} · {label(entry.promotionTier)}</span>
                    </div>

                    <div className={styles.eventMeta}>
                      <strong>{dayLabel(entry.day)}</strong>
                      <span>
                        {entry.marketName && entry.venueName
                          ? `${entry.venueName} · ${entry.marketName}`
                          : entry.marketName ?? "Location not announced"}
                      </span>
                    </div>
                  </>
                );

                return entry.isPlayerPromotion ? (
                  <a className={`${styles.eventCard} ${big ? styles.bigEvent : ""} ${styles.ownEvent}`} href="/planner" key={entry.occurrenceId}>
                    {content}
                  </a>
                ) : (
                  <article className={`${styles.eventCard} ${big ? styles.bigEvent : ""}`} key={entry.occurrenceId}>
                    {content}
                  </article>
                );
              })}
            </div>
          </section>
        ))}

        {weeks.length === 0 ? (
          <section className={styles.panel}>
            <strong>No events match this filter.</strong>
            <p>Try another calendar view.</p>
          </section>
        ) : null}
      </section>

      <p className={styles.privacy}>
        The World calendar shows public show identities and canonical bookings. Rival private drafts, unannounced locations and booking plans remain hidden.
      </p>
    </main>
  );
}
