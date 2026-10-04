"use client";

import { useEffect, useRef, useState } from "react";
import type { PlayerSixWeekPlannerView } from "../../../../dist/packages/application/src/planning-view.js";
import styles from "./planner.module.css";

type ErrorPayload = { error?: string };
type TicketStrategy = "ACCESSIBLE" | "STANDARD" | "PREMIUM" | "PRESTIGE";
type PromotionView = NonNullable<PlayerSixWeekPlannerView["promotion"]>;
type WeekView = PromotionView["weeks"][number];
type PlanForm = {
  year: number;
  week: number;
  day: number;
  marketId: string;
  venueId: string;
  ticketStrategy: TicketStrategy;
  participantIds: string[];
};

const DAY_NAMES = ["", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

function isErrorPayload(payload: PlayerSixWeekPlannerView | ErrorPayload): payload is ErrorPayload {
  return "error" in payload;
}

function label(value: string): string {
  return value.replaceAll("_", " ");
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

function statusClass(state: string): string {
  if (state === "AT_RISK") return styles.risk;
  if (state === "RESERVED" || state === "READY_TO_LOCK") return styles.good;
  if (state === "MATERIALIZED") return styles.live;
  return styles.neutral;
}

function weekKey(week: WeekView): string {
  return `${week.year}:${week.week}`;
}

function initialPlan(view: PlayerSixWeekPlannerView, week: WeekView): PlanForm | null {
  const promotion = view.promotion;
  if (!promotion) return null;
  const existing = week.shows[0] ?? null;
  const marketId = existing?.marketId ?? promotion.homeMarketId ?? promotion.markets[0]?.marketId;
  const market = promotion.markets.find((candidate) => candidate.marketId === marketId) ?? promotion.markets[0];
  const venueId = existing?.venueId ?? market?.venues[0]?.venueId;
  if (!market || !venueId) return null;

  let participantIds = existing?.participants.map((person) => person.personId) ?? [];
  if (participantIds.length === 0) {
    const minimum = week.minParticipants % 2 === 0 ? week.minParticipants : week.minParticipants + 1;
    participantIds = week.eligibleParticipants.slice(0, Math.min(minimum, week.maxParticipants)).map((person) => person.personId);
  }
  if (participantIds.length % 2 !== 0) participantIds = participantIds.slice(0, -1);

  return {
    year: week.year,
    week: week.week,
    day: existing?.targetDate.day ?? 6,
    marketId: market.marketId,
    venueId,
    ticketStrategy: existing?.ticketStrategy ?? "STANDARD",
    participantIds,
  };
}

export default function PlannerClient(): React.JSX.Element {
  const [view, setView] = useState<PlayerSixWeekPlannerView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [form, setForm] = useState<PlanForm | null>(null);
  const [saving, setSaving] = useState(false);
  const requestIds = useRef(new Map<string, string>());

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

  function beginEdit(week: WeekView): void {
    if (!view) return;
    const next = initialPlan(view, week);
    if (!next) {
      setError("No valid market and venue are available for this show.");
      return;
    }
    setError(null);
    setEditingKey(weekKey(week));
    setForm(next);
  }

  function cancelEdit(): void {
    setEditingKey(null);
    setForm(null);
  }

  function changeMarket(marketId: string): void {
    if (!view?.promotion || !form) return;
    const market = view.promotion.markets.find((candidate) => candidate.marketId === marketId);
    setForm({ ...form, marketId, venueId: market?.venues[0]?.venueId ?? "" });
  }

  function toggleParticipant(personId: string, week: WeekView): void {
    if (!form) return;
    if (form.participantIds.includes(personId)) {
      setForm({ ...form, participantIds: form.participantIds.filter((id) => id !== personId) });
      return;
    }
    if (form.participantIds.length >= week.maxParticipants) return;
    setForm({ ...form, participantIds: [...form.participantIds, personId] });
  }

  async function savePlan(week: WeekView): Promise<void> {
    if (!view?.promotion || !form) return;
    const key = weekKey(week);
    let requestId = requestIds.current.get(key);
    if (!requestId) {
      requestId = crypto.randomUUID();
      requestIds.current.set(key, requestId);
    }
    setSaving(true);
    setError(null);
    try {
      const response = await fetch("/api/planner/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requestId,
          expectedRevision: view.world.revision,
          expectedPlanVersion: view.promotion.workspaceVersion,
          ...form,
        }),
      });
      const payload = await response.json() as PlayerSixWeekPlannerView | ErrorPayload;
      if (!response.ok || isErrorPayload(payload)) {
        const message = isErrorPayload(payload) && payload.error ? payload.error : "Unable to reserve show plan";
        if (message.includes("stale World revision") || message.includes("stale plan version")) {
          await refresh();
          throw new Error(`${message}. Latest planner state loaded.`);
        }
        throw new Error(message);
      }
      requestIds.current.delete(key);
      setView(payload);
      cancelEdit();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to reserve show plan");
    } finally {
      setSaving(false);
    }
  }

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
            <div><span>Planning horizon</span><strong>{view.promotion.horizonWeeks} PPW weeks</strong></div>
            <div><span>Plan version</span><strong>{view.promotion.workspaceVersion}</strong></div>
            <div><span>World</span><strong>{view.world.phase}</strong></div>
          </section>

          <section className={styles.timeline}>
            {view.promotion.weeks.map((week) => {
              const existing = week.shows[0] ?? null;
              const isEditing = editingKey === weekKey(week) && form !== null;
              const selectedMarket = isEditing
                ? view.promotion!.markets.find((market) => market.marketId === form!.marketId) ?? null
                : null;
              const selectedVenue = selectedMarket && isEditing
                ? selectedMarket.venues.find((venue) => venue.venueId === form!.venueId) ?? null
                : null;
              const selectedCount = isEditing ? form!.participantIds.length : 0;
              const validRoster = isEditing
                && selectedCount >= week.minParticipants
                && selectedCount <= week.maxParticipants
                && selectedCount % 2 === 0;
              const editableExisting = existing?.availableActions.includes("EDIT_DRAFT") ?? false;
              const canOpenEditor = week.canPlan && (existing === null || editableExisting) && week.shows.length <= 1;
              const canSave = Boolean(
                isEditing && validRoster && form!.marketId && form!.venueId && view.world.phase === "OPEN" && !saving,
              );

              return (
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
                      <span>{week.showRequired ? "This operating week needs a reserved show before lock." : "No operating show is scheduled for this promotion in this week."}</span>
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
                        <div className={styles.people}>{show.participants.map((person) => <span key={person.personId}>{person.name}</span>)}</div>
                      ) : <p className={styles.muted}>No wrestlers selected yet.</p>}
                      {show.workspaceChangedSinceReservation ? <div className={styles.warning}>Plan changed since reservation — refresh it before relying on those commitments.</div> : null}
                      {show.riskReasons.length > 0 ? <div className={styles.warning}>{show.riskReasons.map(label).join(" · ")}</div> : null}
                    </section>
                  ))}

                  {week.shows.length > 1 ? <div className={styles.warning}>Multiple drafts exist in this week. Resolve them before using the Alpha planner editor.</div> : null}

                  {canOpenEditor && !isEditing ? (
                    <button className={styles.editButton} onClick={() => beginEdit(week)}>
                      {existing ? (existing.reservationId ? "Edit & refresh reservation" : "Edit & reserve show") : "Plan & reserve show"}
                    </button>
                  ) : null}

                  {isEditing ? (
                    <section className={styles.editor}>
                      <div className={styles.editorGrid}>
                        <label><span>Show day</span><select value={form!.day} onChange={(event) => setForm({ ...form!, day: Number(event.target.value) })}>{DAY_NAMES.slice(1).map((name, index) => <option value={index + 1} key={name}>{name}</option>)}</select></label>
                        <label><span>Market</span><select value={form!.marketId} onChange={(event) => changeMarket(event.target.value)}>{view.promotion!.markets.map((market) => <option key={market.marketId} value={market.marketId}>{market.name}{market.isHomeMarket ? " · Home" : ""}</option>)}</select></label>
                        <label><span>Venue</span><select value={form!.venueId} onChange={(event) => setForm({ ...form!, venueId: event.target.value })}>{selectedMarket?.venues.map((venue) => <option key={venue.venueId} value={venue.venueId}>{venue.name} · {integer(venue.capacity)}</option>)}</select></label>
                        <label><span>Ticket strategy</span><select value={form!.ticketStrategy} onChange={(event) => setForm({ ...form!, ticketStrategy: event.target.value as TicketStrategy })}>{view.promotion!.ticketStrategies.map((strategy) => <option key={strategy} value={strategy}>{label(strategy)}</option>)}</select></label>
                      </div>

                      {selectedVenue ? <div className={styles.venueSummary}>{selectedVenue.name} · {integer(selectedVenue.capacity)} cap · {money(selectedVenue.weeklyHireCost)} hire</div> : null}

                      <div className={styles.talentHeader}>
                        <div><strong>Reserve talent</strong><span>Choose an even {week.minParticipants}–{week.maxParticipants} wrestlers.</span></div>
                        <b className={validRoster ? styles.countGood : styles.countWarn}>{selectedCount}/{week.maxParticipants}</b>
                      </div>
                      <div className={styles.talentGrid}>
                        {week.eligibleParticipants.map((person) => {
                          const selected = form!.participantIds.includes(person.personId);
                          const maxed = !selected && selectedCount >= week.maxParticipants;
                          return (
                            <button type="button" key={person.personId} className={`${styles.talentPick} ${selected ? styles.talentSelected : ""}`} disabled={maxed} onClick={() => toggleParticipant(person.personId, week)}>
                              <span><strong>{person.name}</strong><small>{person.datesRemaining} dates · POP {person.popularity}</small></span><b>{selected ? "✓" : "+"}</b>
                            </button>
                          );
                        })}
                      </div>
                      {existing && existing.matchCount > 0 ? <p className={styles.editorNote}>This show already has a card. Existing matches are preserved; wrestlers already used on that card must remain in the show roster until card editing is available here.</p> : null}
                      <div className={styles.editorActions}>
                        <button className={styles.button} disabled={saving} onClick={cancelEdit}>Cancel</button>
                        <button className={styles.saveButton} disabled={!canSave} onClick={() => savePlan(week)}>{saving ? "Reserving…" : existing?.reservationId ? "Save & refresh reservation" : "Save & reserve"}</button>
                      </div>
                    </section>
                  ) : null}
                </article>
              );
            })}
          </section>

          <p className={styles.footerNote}>Reservations are shared-World commitments. The server rechecks venue, contract-date and wrestler Service Capacity when you save, so a rival action can make an otherwise valid-looking plan fail safely.</p>
        </>
      )}
    </main>
  );
}
