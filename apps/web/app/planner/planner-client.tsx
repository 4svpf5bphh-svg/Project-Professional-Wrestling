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
};

const DAY_NAMES = ["", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const SHOW_TIME_GUIDE_MINUTES = 120;

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

function presenceLabel(value: string): string {
  if (value === "STRONG") return "Strong";
  if (value === "ESTABLISHED") return "Established";
  if (value === "DEVELOPING") return "Developing";
  return "Light";
}

function indexLabel(value: number): string {
  if (value >= 80) return "Very high";
  if (value >= 65) return "High";
  if (value >= 45) return "Moderate";
  return "Low";
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

  return {
    year: week.year,
    week: week.week,
    day: existing?.targetDate.day ?? 6,
    marketId: market.marketId,
    venueId,
    ticketStrategy: existing?.ticketStrategy ?? "STANDARD",
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
              const editableExisting = existing?.availableActions.includes("EDIT_DRAFT") ?? false;
              const canOpenEditor = week.canPlan && (existing === null || editableExisting) && week.shows.length <= 1;
              const canSave = Boolean(
                isEditing && form!.marketId && form!.venueId && view.world.phase === "OPEN" && !saving,
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
                  ) : week.shows.map((show) => {
                    const timeRemaining = SHOW_TIME_GUIDE_MINUTES - show.plannedShowMinutes;
                    return (
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
                          <div><span>Segments</span><strong>{show.segmentCount}</strong></div>
                          <div><span>Show time</span><strong>{show.plannedShowMinutes} min</strong></div>
                          <div><span>Time left</span><strong className={timeRemaining < 0 ? styles.timeOver : undefined}>{timeRemaining >= 0 ? `${timeRemaining} min` : `${Math.abs(timeRemaining)} over`}</strong></div>
                          <div><span>Readiness</span><strong>{label(show.readiness)}</strong></div>
                        </div>
                        {show.runningOrder.length > 0 ? (
                          <div className={styles.runningOrder}>
                            <div className={styles.runningOrderHeader}>
                              <strong>Running order</strong>
                              <span>{show.plannedShowMinutes} / {SHOW_TIME_GUIDE_MINUTES} min Alpha guide</span>
                            </div>
                            {show.runningOrder.map((slot) => slot.kind === "MATCH" ? (
                              <div className={`${styles.matchRow} ${slot.match.isMainEvent ? styles.mainEventRow : ""}`} key={`MATCH:${slot.refId}`}>
                                <span className={styles.matchNumber}>Slot {slot.order}</span>
                                <div>
                                  <strong>{slot.match.sideANames.join(" & ")} <span>vs</span> {slot.match.sideBNames.join(" & ")}</strong>
                                  <small>{slot.match.type === "TAG" ? "Tag Team" : "Singles"}{slot.match.plannedLengthMinutes !== null ? ` · ${slot.match.plannedLengthMinutes} min` : ""}</small>
                                </div>
                                {slot.match.isMainEvent ? <b>MAIN EVENT</b> : null}
                              </div>
                            ) : (
                              <div className={`${styles.matchRow} ${styles.segmentRow}`} key={`SEGMENT:${slot.refId}`}>
                                <span className={styles.matchNumber}>Slot {slot.order}</span>
                                <div>
                                  <strong>{label(slot.segment.type)} · {slot.segment.participantNames.join(" & ")}</strong>
                                  <small>Segment · {slot.segment.plannedLengthMinutes} min{slot.segment.programmeId ? " · Programme attached" : ""}</small>
                                </div>
                                <b>SEGMENT</b>
                              </div>
                            ))}
                          </div>
                        ) : show.participants.length > 0 ? (
                          <div className={styles.people}>{show.participants.map((person) => <span key={person.personId}>{person.name}</span>)}</div>
                        ) : <p className={styles.muted}>No wrestlers selected yet.</p>}
                        {show.workspaceChangedSinceReservation ? <div className={styles.warning}>Plan changed since reservation — refresh it before relying on those commitments.</div> : null}
                        {show.riskReasons.length > 0 ? <div className={styles.warning}>{show.riskReasons.map(label).join(" · ")}</div> : null}
                        {show.availableActions.includes("EDIT_DRAFT") || show.availableActions.includes("EDIT_CARD") ? (
                          <a
                            className={styles.editButton}
                            style={{ display: "block", padding: "10px 14px", textAlign: "center", textDecoration: "none" }}
                            href={`/card?draftId=${encodeURIComponent(show.draftId)}`}
                          >
                            {show.slotCount > 0 ? "Edit card" : "Book card"}
                          </a>
                        ) : null}
                      </section>
                    );
                  })}

                  {week.shows.length > 1 ? <div className={styles.warning}>Multiple drafts exist in this week. Resolve them before using the Alpha planner editor.</div> : null}

                  {canOpenEditor && !isEditing ? (
                    <button className={styles.editButton} onClick={() => beginEdit(week)}>
                      {existing ? "Edit show details" : "Plan show"}
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

                      {selectedMarket ? (
                        <section className={styles.marketContext}>
                          <div className={styles.marketContextHeader}>
                            <div>
                              <span className={styles.eyebrow}>MARKET CONTEXT</span>
                              <strong>{selectedMarket.name}</strong>
                            </div>
                            <span className={selectedMarket.isHomeMarket ? styles.homeMarketTag : styles.awayMarketTag}>
                              {selectedMarket.isHomeMarket ? "HOME MARKET" : "AWAY MARKET"}
                            </span>
                          </div>

                          <div className={styles.marketContextGrid}>
                            <div><span>Your presence</span><strong>{presenceLabel(selectedMarket.yourPresence)}</strong></div>
                            <div><span>Awareness</span><strong>{Math.round(selectedMarket.yourAwareness)}</strong></div>
                            <div><span>Live strength</span><strong>{Math.round(selectedMarket.yourLiveStrength)}</strong></div>
                            <div><span>Loyalty</span><strong>{Math.round(selectedMarket.yourLoyalty)}</strong></div>
                            <div><span>Audience potential</span><strong>{indexLabel(selectedMarket.audiencePotential)} · {Math.round(selectedMarket.audiencePotential)}</strong></div>
                            <div><span>Wrestling interest</span><strong>{indexLabel(selectedMarket.wrestlingInterest)} · {Math.round(selectedMarket.wrestlingInterest)}</strong></div>
                            <div><span>Spending index</span><strong>{Math.round(selectedMarket.spendingIndex)}</strong></div>
                            <div><span>Market maturity</span><strong>{Math.round(selectedMarket.maturity)}</strong></div>
                          </div>

                          <div className={styles.territoryContext}>
                            <div>
                              <span>Promotions based here</span>
                              {selectedMarket.homePromotions.length > 0 ? (
                                <strong>{selectedMarket.homePromotions.map((promotion) => `${promotion.name} (${label(promotion.tier)})`).join(" · ")}</strong>
                              ) : <strong>None</strong>}
                            </div>
                            <div>
                              <span>Strongest rival presence</span>
                              {selectedMarket.strongestRivals.length > 0 ? (
                                <div className={styles.rivalPresenceList}>
                                  {selectedMarket.strongestRivals.map((rival) => (
                                    <span key={rival.promotionId}>
                                      <b>{rival.name}</b>
                                      <small>{rival.isHomePromotion ? "Home base · " : ""}{presenceLabel(rival.presence)}</small>
                                    </span>
                                  ))}
                                </div>
                              ) : <strong>None</strong>}
                            </div>
                          </div>
                        </section>
                      ) : null}

                      {selectedVenue ? (
                        <div className={styles.venueSummary}>
                          <strong>{selectedVenue.name}</strong>
                          <span>{integer(selectedVenue.capacity)} capacity · {money(selectedVenue.weeklyHireCost)} hire</span>
                          <span>Prestige {Math.round(selectedVenue.prestige)} · Production suitability {Math.round(selectedVenue.productionSuitability)}</span>
                        </div>
                      ) : null}

                      <p className={styles.editorNote}>Market context is factual World information. Staff advice and interpretation can layer on later. Talent is booked on the show card, so there is no separate show-roster step.</p>
                      <div className={styles.editorActions}>
                        <button className={styles.button} disabled={saving} onClick={cancelEdit}>Cancel</button>
                        <button className={styles.saveButton} disabled={!canSave} onClick={() => savePlan(week)}>{saving ? "Saving…" : "Save show details"}</button>
                      </div>
                    </section>
                  ) : null}
                </article>
              );
            })}
          </section>

          <p className={styles.footerNote}>Show details are planning intent. Wrestler commitments become shared-World reservations from the booked card, where PPW rechecks contract dates and Service Capacity.</p>
        </>
      )}
    </main>
  );
}
