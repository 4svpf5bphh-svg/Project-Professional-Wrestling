"use client";

import { useEffect, useRef, useState } from "react";
import type { AlphaPlayerWorldView } from "../../../dist/packages/application/src/player-view.js";

type ErrorPayload = { error?: string };
type TicketStrategy = "ACCESSIBLE" | "STANDARD" | "PREMIUM" | "PRESTIGE";
type ShowPlanForm = {
  day: number;
  marketId: string;
  venueId: string;
  ticketStrategy: TicketStrategy;
  participantIds: string[];
};

function isErrorPayload(payload: AlphaPlayerWorldView | ErrorPayload): payload is ErrorPayload {
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

function ppwDate(view: AlphaPlayerWorldView): string {
  return `Year ${view.world.year} · Week ${view.world.week}`;
}

function readinessCopy(status: AlphaPlayerWorldView["promotion"] extends infer T
  ? T extends { weekReadiness: { status: infer S } } ? S : never
  : never): string {
  switch (status) {
    case "READY": return "Your required show and card are ready for the weekly lock.";
    case "NOT_REQUIRED": return "No mandatory show is due for your promotion this week.";
    case "SHOW_REQUIRED": return "No required show is committed yet. Finish the show plan below or staff will take over the missing work at lock.";
    case "CARD_REQUIRED": return "Your show exists, but the card is incomplete. Finishing now lets staff complete the card.";
    default: return "Weekly readiness is unavailable.";
  }
}

function readinessLabel(status: string): string {
  return status.replaceAll("_", " ");
}

function planningStateLabel(state: string): string {
  return state.replaceAll("_", " ");
}

function defaultShowPlan(view: AlphaPlayerWorldView): ShowPlanForm | null {
  const promotion = view.promotion;
  if (!promotion) return null;
  const planning = promotion.showPlanning;
  const existing = planning.currentPlan;
  const marketId = existing?.marketId ?? promotion.homeMarketId ?? planning.markets[0]?.marketId;
  if (!marketId) return null;
  const market = planning.markets.find((candidate) => candidate.marketId === marketId) ?? planning.markets[0];
  const venueId = existing?.venueId ?? market?.venues[0]?.venueId;
  if (!market || !venueId) return null;

  let participantIds = existing?.participantIds ?? promotion.roster
    .filter((person) => person.status === "ACTIVE" && person.datesRemaining > 0)
    .slice(0, planning.maxParticipants)
    .map((person) => person.personId);
  if (participantIds.length % 2 !== 0) participantIds = participantIds.slice(0, -1);

  return {
    day: existing?.day ?? 6,
    marketId: market.marketId,
    venueId,
    ticketStrategy: existing?.ticketStrategy ?? "STANDARD",
    participantIds,
  };
}

export default function AlphaHome(): React.JSX.Element {
  const [view, setView] = useState<AlphaPlayerWorldView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyPromotionId, setBusyPromotionId] = useState<string | null>(null);
  const [finishingWeek, setFinishingWeek] = useState(false);
  const [savingShowPlan, setSavingShowPlan] = useState(false);
  const [showPlan, setShowPlan] = useState<ShowPlanForm | null>(null);
  const requestIds = useRef(new Map<string, string>());

  async function refresh(): Promise<void> {
    setError(null);
    const response = await fetch("/api/session", { cache: "no-store" });
    const payload = await response.json() as AlphaPlayerWorldView | ErrorPayload;
    if (!response.ok || isErrorPayload(payload)) {
      throw new Error(isErrorPayload(payload) && payload.error ? payload.error : "Unable to load World");
    }
    setView(payload);
  }

  useEffect(() => {
    refresh().catch((reason: unknown) => {
      setError(reason instanceof Error ? reason.message : "Unable to load PPW Alpha");
    });
  }, []);

  useEffect(() => {
    if (!view?.promotion) {
      setShowPlan(null);
      return;
    }
    setShowPlan(defaultShowPlan(view));
  }, [view]);

  async function claim(promotionId: string): Promise<void> {
    setBusyPromotionId(promotionId);
    setError(null);
    let requestId = requestIds.current.get(promotionId);
    if (!requestId) {
      requestId = crypto.randomUUID();
      requestIds.current.set(promotionId, requestId);
    }
    try {
      const response = await fetch("/api/claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ promotionId, requestId }),
      });
      const payload = await response.json() as AlphaPlayerWorldView | ErrorPayload;
      if (!response.ok || isErrorPayload(payload)) {
        throw new Error(isErrorPayload(payload) && payload.error ? payload.error : "Unable to claim promotion");
      }
      requestIds.current.delete(promotionId);
      setView(payload);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to claim promotion");
    } finally {
      setBusyPromotionId(null);
    }
  }

  async function saveShowPlan(): Promise<void> {
    if (!view?.promotion || !showPlan) return;
    const planning = view.promotion.showPlanning;
    setSavingShowPlan(true);
    setError(null);
    const requestKey = `show-plan:${planning.draftId}`;
    let requestId = requestIds.current.get(requestKey);
    if (!requestId) {
      requestId = crypto.randomUUID();
      requestIds.current.set(requestKey, requestId);
    }

    try {
      const response = await fetch("/api/show-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requestId,
          expectedRevision: view.world.revision,
          expectedPlanVersion: planning.workspaceVersion,
          ...showPlan,
        }),
      });
      const payload = await response.json() as AlphaPlayerWorldView | ErrorPayload;
      if (!response.ok || isErrorPayload(payload)) {
        const message = isErrorPayload(payload) && payload.error ? payload.error : "Unable to save show plan";
        if (message.includes("stale World revision") || message.includes("stale plan version")) {
          await refresh();
          throw new Error(`${message}. Latest World state loaded.`);
        }
        throw new Error(message);
      }
      requestIds.current.delete(requestKey);
      setView(payload);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to save show plan");
    } finally {
      setSavingShowPlan(false);
    }
  }

  async function finishWeek(): Promise<void> {
    if (!view?.promotion) return;
    setFinishingWeek(true);
    setError(null);
    try {
      const response = await fetch("/api/advance-week", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ expectedRevision: view.world.revision }),
      });
      const payload = await response.json() as AlphaPlayerWorldView | ErrorPayload;
      if (!response.ok || isErrorPayload(payload)) {
        if (response.status === 409) {
          await refresh();
          throw new Error(isErrorPayload(payload) && payload.error
            ? `${payload.error}. Latest World state loaded.`
            : "The World changed before the week finished. Latest state loaded.");
        }
        throw new Error(isErrorPayload(payload) && payload.error ? payload.error : "Unable to finish PPW week");
      }
      setView(payload);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to finish PPW week");
    } finally {
      setFinishingWeek(false);
    }
  }

  function changeMarket(marketId: string): void {
    if (!view?.promotion || !showPlan) return;
    const market = view.promotion.showPlanning.markets.find((candidate) => candidate.marketId === marketId);
    setShowPlan({ ...showPlan, marketId, venueId: market?.venues[0]?.venueId ?? "" });
  }

  function toggleParticipant(personId: string): void {
    if (!view?.promotion || !showPlan) return;
    const selected = showPlan.participantIds.includes(personId);
    if (selected) {
      setShowPlan({ ...showPlan, participantIds: showPlan.participantIds.filter((id) => id !== personId) });
      return;
    }
    if (showPlan.participantIds.length >= view.promotion.showPlanning.maxParticipants) return;
    setShowPlan({ ...showPlan, participantIds: [...showPlan.participantIds, personId] });
  }

  if (!view) {
    return (
      <main className="app-shell loading-shell">
        <div className="brand-mark">PPW</div>
        <p>{error ?? "Opening your World…"}</p>
        {error ? <button className="primary-button" onClick={() => refresh().catch((reason: unknown) => setError(reason instanceof Error ? reason.message : "Unable to load PPW Alpha"))}>Retry</button> : null}
      </main>
    );
  }

  const promotion = view.promotion;
  const canFinishWeek = promotion !== null && view.world.phase !== "RESOLVING";
  const planning = promotion?.showPlanning ?? null;
  const selectedMarket = planning && showPlan
    ? planning.markets.find((market) => market.marketId === showPlan.marketId) ?? null
    : null;
  const selectedVenue = selectedMarket && showPlan
    ? selectedMarket.venues.find((venue) => venue.venueId === showPlan.venueId) ?? null
    : null;
  const selectedCount = showPlan?.participantIds.length ?? 0;
  const validRosterCount = planning
    ? selectedCount >= planning.minParticipants && selectedCount <= planning.maxParticipants && selectedCount % 2 === 0
    : false;
  const canSaveShowPlan = Boolean(
    promotion && planning?.canPlanThisWeek && showPlan && showPlan.marketId && showPlan.venueId
    && validRosterCount && view.world.phase === "OPEN" && !savingShowPlan,
  );

  return (
    <main className="app-shell">
      <header className="topbar">
        <div>
          <div className="eyebrow">PROJECT PROFESSIONAL WRESTLING</div>
          <h1>{promotion?.name ?? "Choose your promotion"}</h1>
          <p className="muted">{view.world.name} · {ppwDate(view)}</p>
        </div>
        <div className={`phase-pill phase-${view.world.phase.toLowerCase()}`}>{view.world.phase}</div>
      </header>

      {error ? <div className="error-card">{error}</div> : null}

      {!promotion ? (
        <section className="panel">
          <div className="section-heading">
            <div>
              <span className="eyebrow">ALPHA-1A ENTRY</span>
              <h2>Take control of an Independent</h2>
            </div>
            <span className="revision">World r{view.world.revision}</span>
          </div>
          <p className="muted body-copy">This choice is committed to the living World. You get the promotion as it exists now: its cash, market, roster and problems.</p>
          <div className="choice-grid">
            {view.availableIndependentPromotions.map((choice) => (
              <article className="choice-card" key={choice.promotionId}>
                <div className="choice-card-top">
                  <div>
                    <h3>{choice.name}</h3>
                    <p>{choice.homeMarketName}</p>
                  </div>
                  <span className={`distress distress-${choice.financialDistress.toLowerCase()}`}>{choice.financialDistress}</span>
                </div>
                <div className="money-stat">{money(choice.cash)}</div>
                <button
                  className="primary-button"
                  disabled={busyPromotionId !== null || view.world.phase !== "OPEN"}
                  onClick={() => claim(choice.promotionId)}
                >
                  {busyPromotionId === choice.promotionId ? "Claiming…" : "Take control"}
                </button>
              </article>
            ))}
          </div>
        </section>
      ) : (
        <>
          <section className="metric-grid">
            <article className="metric-card"><span>Cash</span><strong>{money(promotion.cash)}</strong></article>
            <article className="metric-card"><span>Last week</span><strong>{promotion.lastWeeklyNet >= 0 ? "+" : ""}{money(promotion.lastWeeklyNet)}</strong></article>
            <article className="metric-card"><span>Roster</span><strong>{promotion.roster.length}</strong></article>
            <article className="metric-card"><span>Status</span><strong>{promotion.lifecycle}</strong></article>
          </section>

          {planning?.canPlanThisWeek && showPlan ? (
            <section className="panel planner-panel" id="show-plan">
              <div className="section-heading">
                <div>
                  <span className="eyebrow">BOOK THIS WEEK&apos;S SHOW</span>
                  <h2>Commit the logistics</h2>
                </div>
                <span className={`plan-pill ${planning.currentPlan?.state === "RESERVED" ? "plan-reserved" : ""}`}>
                  {planning.currentPlan ? planningStateLabel(planning.currentPlan.state) : "UNPLANNED"}
                </span>
              </div>
              <p className="muted body-copy">Choose where you run, what you charge and who you commit. Saving reserves the venue and wrestler dates in the shared World. Match booking comes next.</p>

              <div className="planner-grid">
                <label className="field-label">
                  <span>PPW day</span>
                  <select value={showPlan.day} onChange={(event) => setShowPlan({ ...showPlan, day: Number(event.target.value) })}>
                    {[1, 2, 3, 4, 5, 6, 7].map((day) => <option key={day} value={day}>Day {day}</option>)}
                  </select>
                </label>
                <label className="field-label">
                  <span>Market</span>
                  <select value={showPlan.marketId} onChange={(event) => changeMarket(event.target.value)}>
                    {planning.markets.map((market) => (
                      <option key={market.marketId} value={market.marketId}>{market.name}{market.isHomeMarket ? " · Home" : ""}</option>
                    ))}
                  </select>
                </label>
                <label className="field-label">
                  <span>Venue</span>
                  <select value={showPlan.venueId} onChange={(event) => setShowPlan({ ...showPlan, venueId: event.target.value })}>
                    {selectedMarket?.venues.map((venue) => (
                      <option key={venue.venueId} value={venue.venueId}>{venue.name} · {integer(venue.capacity)}</option>
                    ))}
                  </select>
                </label>
                <label className="field-label">
                  <span>Ticket strategy</span>
                  <select value={showPlan.ticketStrategy} onChange={(event) => setShowPlan({ ...showPlan, ticketStrategy: event.target.value as TicketStrategy })}>
                    {planning.ticketStrategies.map((strategy) => <option key={strategy} value={strategy}>{strategy.replaceAll("_", " ")}</option>)}
                  </select>
                </label>
              </div>

              {selectedVenue ? (
                <div className="venue-summary">
                  <span>{selectedVenue.name}</span>
                  <strong>{integer(selectedVenue.capacity)} cap · {money(selectedVenue.weeklyHireCost)} hire · PRE {Math.round(selectedVenue.prestige)}</strong>
                </div>
              ) : null}

              <div className="roster-picker-heading">
                <div>
                  <strong>Show roster</strong>
                  <span>Select an even {planning.minParticipants}–{planning.maxParticipants} wrestlers.</span>
                </div>
                <span className={validRosterCount ? "positive" : "warning-text"}>{selectedCount}/{planning.maxParticipants}</span>
              </div>
              <div className="roster-picker">
                {promotion.roster.map((person) => {
                  const selected = showPlan.participantIds.includes(person.personId);
                  const available = person.status === "ACTIVE" && person.datesRemaining > 0;
                  const maxed = !selected && selectedCount >= planning.maxParticipants;
                  return (
                    <button
                      type="button"
                      className={`talent-pick ${selected ? "talent-selected" : ""}`}
                      key={person.personId}
                      disabled={!available || maxed}
                      onClick={() => toggleParticipant(person.personId)}
                    >
                      <span>
                        <strong>{person.name}</strong>
                        <small>{person.status === "ACTIVE" ? `${person.datesRemaining} dates · POP ${person.popularity}` : person.status}</small>
                      </span>
                      <b>{selected ? "✓" : "+"}</b>
                    </button>
                  );
                })}
              </div>

              <button className="primary-button planner-save" disabled={!canSaveShowPlan} onClick={saveShowPlan}>
                {savingShowPlan ? "Reserving…" : planning.currentPlan?.reservationId ? "Update reservation" : "Reserve show plan"}
              </button>
              <p className="micro-copy">Reservations are competitive commitments: another human player cannot take the same venue or wrestler on the same PPW day once yours is committed.</p>
            </section>
          ) : null}

          <section className="panel week-panel">
            <div className="section-heading">
              <div>
                <span className="eyebrow">THIS PPW WEEK</span>
                <h2>{planning?.currentPlan?.state === "RESERVED" ? "SHOW RESERVED · CARD REQUIRED" : readinessLabel(promotion.weekReadiness.status)}</h2>
              </div>
              <span className={`readiness-pill readiness-${promotion.weekReadiness.readyToFinish ? "ready" : "attention"}`}>
                {promotion.weekReadiness.readyToFinish ? "READY" : "NEEDS ATTENTION"}
              </span>
            </div>
            <p className="muted body-copy">
              {planning?.currentPlan?.state === "RESERVED"
                ? "Your show logistics and talent are reserved. The card is not player-booked yet, so staff will complete that missing responsibility if you finish the week now."
                : readinessCopy(promotion.weekReadiness.status)}
            </p>
            <button
              className="primary-button"
              disabled={!canFinishWeek || finishingWeek}
              onClick={finishWeek}
            >
              {finishingWeek
                ? "Resolving World…"
                : view.world.phase === "LOCKING"
                  ? "Resume week resolution"
                  : promotion.weekReadiness.staffHelpRequired
                    ? `Finish Week ${view.world.week} with staff help`
                    : `Finish Week ${view.world.week}`}
            </button>
            <p className="micro-copy">Alpha-1A test harness: the server owns the lock and resolution. This button only asks the server to finish the current shared World week.</p>
          </section>

          {promotion.lastResolvedShow ? (
            <section className="panel">
              <div className="section-heading">
                <div>
                  <span className="eyebrow">LAST RESOLVED SHOW</span>
                  <h2>Year {promotion.lastResolvedShow.year} · Week {promotion.lastResolvedShow.week}</h2>
                </div>
                <strong className={promotion.lastResolvedShow.netResult >= 0 ? "positive" : "negative"}>
                  {promotion.lastResolvedShow.netResult >= 0 ? "+" : ""}{money(promotion.lastResolvedShow.netResult)}
                </strong>
              </div>
              <div className="result-grid">
                <div><span>Venue</span><strong>{promotion.lastResolvedShow.venueName}</strong></div>
                <div><span>Attendance</span><strong>{integer(promotion.lastResolvedShow.attendance)}</strong></div>
                <div><span>Gate</span><strong>{money(promotion.lastResolvedShow.gateRevenue)}</strong></div>
                <div><span>Avg rating</span><strong>{promotion.lastResolvedShow.averageMatchRating.toFixed(2)}★</strong></div>
                <div><span>Best match</span><strong>{promotion.lastResolvedShow.bestMatchRating.toFixed(2)}★</strong></div>
                <div><span>Crowd</span><strong>{Math.round(promotion.lastResolvedShow.crowdResponse)}</strong></div>
              </div>
            </section>
          ) : view.world.lastResolvedPpwDate ? (
            <section className="panel compact-panel">
              <span className="eyebrow">LAST RESOLVED WEEK</span>
              <p className="muted body-copy no-margin">Year {view.world.lastResolvedPpwDate.year} · Week {view.world.lastResolvedPpwDate.week} resolved with no completed show for your promotion.</p>
            </section>
          ) : null}

          <section className="panel">
            <div className="section-heading">
              <div>
                <span className="eyebrow">PROMOTION</span>
                <h2>{promotion.tier} · {promotion.homeMarketName}</h2>
              </div>
              <span className="revision">World r{view.world.revision}</span>
            </div>
            <div className="status-row">
              <span className={`distress distress-${promotion.financialDistress.toLowerCase()}`}>{promotion.financialDistress}</span>
              <span>{promotion.runwayWeeks === null ? "Runway unavailable" : `${promotion.runwayWeeks.toFixed(1)} weeks runway`}</span>
              <span>{promotion.planningDraftCount} drafts · {promotion.reservationCount} reserved</span>
            </div>
          </section>

          <section className="panel">
            <div className="section-heading">
              <div>
                <span className="eyebrow">ROSTER</span>
                <h2>Your contracted talent</h2>
              </div>
              <span className="muted">Top by popularity</span>
            </div>
            <div className="roster-list">
              {promotion.roster.slice(0, 10).map((person) => (
                <div className="roster-row" key={person.personId}>
                  <div>
                    <strong>{person.name}</strong>
                    <span>{person.contractFamily.replaceAll("_", " ")} · {person.datesRemaining} dates</span>
                  </div>
                  <div className="roster-numbers">
                    <span>POP {person.popularity}</span>
                    <span>MOM {person.momentum}</span>
                    <span>MOR {Math.round(person.morale)}</span>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <nav className="bottom-nav" aria-label="Alpha navigation preview">
            <button className="nav-active">World</button>
            <button disabled>Roster</button>
            <button disabled>Plan</button>
            <button disabled>Industry</button>
          </nav>
        </>
      )}
    </main>
  );
}
