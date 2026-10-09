"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type {
  PlayerWorldCalendarOccurrenceView,
  PlayerWorldCalendarShowSeriesView,
  PlayerWorldCalendarView,
} from "../../../../dist/packages/application/src/world-calendar-view.js";
import styles from "./calendar.module.css";

type ErrorPayload = { error?: string };
type CalendarFilter = "ALL" | "MINE" | "BIG";
type ShowRole = PlayerWorldCalendarShowSeriesView["role"];
type EventType = PlayerWorldCalendarShowSeriesView["eventType"];
type SeriesForm = {
  showSeriesId: string | null;
  name: string;
  role: ShowRole;
  eventType: EventType;
  cadenceWeeks: number;
  anchorWeek: number;
  eventImportance: number;
};

const CADENCE_OPTIONS = [1, 2, 4, 13, 52];

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

function newSeriesForm(currentWeek: number): SeriesForm {
  return {
    showSeriesId: null,
    name: "",
    role: "SPECIAL",
    eventType: "MAJOR",
    cadenceWeeks: 52,
    anchorWeek: Math.max(0, Math.min(51, currentWeek - 1)),
    eventImportance: 85,
  };
}

function editSeriesForm(series: PlayerWorldCalendarShowSeriesView): SeriesForm {
  return {
    showSeriesId: series.showSeriesId,
    name: series.name,
    role: series.role,
    eventType: series.eventType,
    cadenceWeeks: series.cadenceWeeks,
    anchorWeek: series.anchorWeek,
    eventImportance: series.eventImportance,
  };
}

function cadenceLabel(value: number): string {
  if (value === 1) return "Every week";
  if (value === 52) return "Every PPW year";
  if (value === 13) return "Every 13 weeks";
  return `Every ${value} weeks`;
}

export default function CalendarClient(): React.JSX.Element {
  const [view, setView] = useState<PlayerWorldCalendarView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<CalendarFilter>("ALL");
  const [form, setForm] = useState<SeriesForm | null>(null);
  const [saving, setSaving] = useState(false);
  const requestIds = useRef(new Map<string, string>());

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

  function requestIdFor(key: string): string {
    const existing = requestIds.current.get(key);
    if (existing) return existing;
    const created = crypto.randomUUID();
    requestIds.current.set(key, created);
    return created;
  }

  async function saveSeries(): Promise<void> {
    if (!view || !form) return;
    const key = form.showSeriesId ? `edit:${form.showSeriesId}` : "create";
    setSaving(true);
    setError(null);
    try {
      const response = await fetch("/api/calendar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "UPSERT",
          requestId: requestIdFor(key),
          expectedRevision: view.world.revision,
          ...form,
        }),
      });
      const payload = await response.json() as PlayerWorldCalendarView | ErrorPayload;
      if (!response.ok || isErrorPayload(payload)) {
        throw new Error(isErrorPayload(payload) && payload.error ? payload.error : "Unable to save show identity");
      }
      requestIds.current.delete(key);
      setView(payload);
      setForm(null);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to save show identity");
    } finally {
      setSaving(false);
    }
  }

  async function archiveSeries(series: PlayerWorldCalendarShowSeriesView): Promise<void> {
    if (!view || !series.canArchive) return;
    if (!window.confirm(`Archive ${series.name}? Future calendar occurrences will disappear.`)) return;
    const key = `archive:${series.showSeriesId}`;
    setSaving(true);
    setError(null);
    try {
      const response = await fetch("/api/calendar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "ARCHIVE",
          requestId: requestIdFor(key),
          expectedRevision: view.world.revision,
          showSeriesId: series.showSeriesId,
        }),
      });
      const payload = await response.json() as PlayerWorldCalendarView | ErrorPayload;
      if (!response.ok || isErrorPayload(payload)) {
        throw new Error(isErrorPayload(payload) && payload.error ? payload.error : "Unable to archive show identity");
      }
      requestIds.current.delete(key);
      setView(payload);
      if (form?.showSeriesId === series.showSeriesId) setForm(null);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to archive show identity");
    } finally {
      setSaving(false);
    }
  }

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

      {view.player.promotionId ? (
        <section className={styles.manage}>
          <div className={styles.manageHeader}>
            <div>
              <span className={styles.eyebrow}>MY CALENDAR</span>
              <strong>{view.player.promotionName ?? "Your promotion"}</strong>
            </div>
            <button
              className={styles.button}
              disabled={!view.player.canEdit || saving}
              onClick={() => setForm(newSeriesForm(view.world.currentDate.week))}
            >
              + Add event
            </button>
          </div>

          <div className={styles.seriesList}>
            {view.myShowSeries.map((series) => (
              <article className={styles.seriesRow} key={series.showSeriesId}>
                <div>
                  <strong>{series.name}</strong>
                  <span>{label(series.role)} · {cadenceLabel(series.cadenceWeeks)} · {label(series.eventType)}</span>
                </div>
                <div className={styles.seriesActions}>
                  <button disabled={!view.player.canEdit || saving} onClick={() => setForm(editSeriesForm(series))}>Edit</button>
                  {series.canArchive ? (
                    <button className={styles.archiveButton} disabled={!view.player.canEdit || saving} onClick={() => archiveSeries(series)}>Archive</button>
                  ) : null}
                </div>
              </article>
            ))}
          </div>

          {form ? (
            <section className={styles.editor}>
              <div className={styles.editorHeader}>
                <strong>{form.showSeriesId ? "Edit show identity" : "Create show identity"}</strong>
                <button onClick={() => setForm(null)} disabled={saving}>Close</button>
              </div>
              <div className={styles.editorGrid}>
                <label className={styles.fullField}>
                  <span>Name</span>
                  <input
                    value={form.name}
                    maxLength={80}
                    onChange={(event) => setForm({ ...form, name: event.target.value })}
                    placeholder="e.g. Final Reckoning"
                  />
                </label>

                <label>
                  <span>Role</span>
                  <select
                    value={form.role}
                    disabled={form.role === "FLAGSHIP"}
                    onChange={(event) => {
                      const role = event.target.value as ShowRole;
                      setForm({
                        ...form,
                        role,
                        eventType: role === "SPECIAL" || role === "PREMIUM" ? "MAJOR" : "REGULAR",
                      });
                    }}
                  >
                    {form.role === "FLAGSHIP" ? <option value="FLAGSHIP">Flagship</option> : null}
                    <option value="SECONDARY">Secondary</option>
                    <option value="DEVELOPMENTAL">Developmental</option>
                    <option value="SPECIAL">Special</option>
                    <option value="PREMIUM">Premium</option>
                  </select>
                </label>

                <label>
                  <span>Weekly slot</span>
                  <select value={form.eventType} disabled>
                    <option value="REGULAR">Regular show slot</option>
                    <option value="MAJOR">Additional major/special slot</option>
                  </select>
                </label>

                <label>
                  <span>Runs</span>
                  <select
                    value={form.cadenceWeeks}
                    onChange={(event) => {
                      const cadenceWeeks = Number(event.target.value);
                      setForm({
                        ...form,
                        cadenceWeeks,
                        anchorWeek: Math.min(form.anchorWeek, cadenceWeeks - 1),
                      });
                    }}
                  >
                    {CADENCE_OPTIONS.map((weeks) => <option value={weeks} key={weeks}>{cadenceLabel(weeks)}</option>)}
                  </select>
                </label>

                <label>
                  <span>{form.cadenceWeeks === 52 ? "Event week" : "Cycle position"}</span>
                  <select
                    value={form.anchorWeek}
                    disabled={form.cadenceWeeks === 1}
                    onChange={(event) => setForm({ ...form, anchorWeek: Number(event.target.value) })}
                  >
                    {Array.from({ length: form.cadenceWeeks }, (_, index) => (
                      <option value={index} key={index}>{form.cadenceWeeks === 52 ? `Week ${index + 1}` : `Position ${index + 1}`}</option>
                    ))}
                  </select>
                </label>

                <label className={styles.fullField}>
                  <span>Importance · {form.eventImportance}</span>
                  <input
                    type="range"
                    min={1}
                    max={100}
                    value={form.eventImportance}
                    onChange={(event) => setForm({ ...form, eventImportance: Number(event.target.value) })}
                  />
                </label>
              </div>
              <div className={styles.editorFooter}>
                <small>Calendar identity only. Venue, market and card are still booked through Planner.</small>
                <button
                  className={styles.saveButton}
                  disabled={saving || !form.name.trim()}
                  onClick={() => saveSeries()}
                >
                  {saving ? "Saving…" : form.showSeriesId ? "Save changes" : "Create event"}
                </button>
              </div>
            </section>
          ) : null}
        </section>
      ) : null}

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

                return entry.canPlanNow ? (
                  <a
                    className={`${styles.eventCard} ${big ? styles.bigEvent : ""} ${styles.ownEvent}`}
                    href={`/planner?year=${entry.year}&week=${entry.week}&showSeriesId=${encodeURIComponent(entry.showSeriesId)}`}
                    key={entry.occurrenceId}
                  >
                    {content}
                  </a>
                ) : (
                  <article className={`${styles.eventCard} ${big ? styles.bigEvent : ""} ${entry.isPlayerPromotion ? styles.ownEvent : ""}`} key={entry.occurrenceId}>
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
