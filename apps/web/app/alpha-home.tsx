"use client";

import { useEffect, useRef, useState } from "react";
import type { AlphaPlayerWorldView } from "../../../dist/packages/application/src/player-view.js";

type ErrorPayload = { error?: string };

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
    case "SHOW_REQUIRED": return "No required show is prepared. Finishing now lets staff run the missing show and card.";
    case "CARD_REQUIRED": return "Your show exists, but the card is incomplete. Finishing now lets staff complete the card.";
    default: return "Weekly readiness is unavailable.";
  }
}

function readinessLabel(status: string): string {
  return status.replaceAll("_", " ");
}

export default function AlphaHome(): React.JSX.Element {
  const [view, setView] = useState<AlphaPlayerWorldView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyPromotionId, setBusyPromotionId] = useState<string | null>(null);
  const [finishingWeek, setFinishingWeek] = useState(false);
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

          <section className="panel week-panel">
            <div className="section-heading">
              <div>
                <span className="eyebrow">THIS PPW WEEK</span>
                <h2>{readinessLabel(promotion.weekReadiness.status)}</h2>
              </div>
              <span className={`readiness-pill readiness-${promotion.weekReadiness.readyToFinish ? "ready" : "attention"}`}>
                {promotion.weekReadiness.readyToFinish ? "READY" : "NEEDS ATTENTION"}
              </span>
            </div>
            <p className="muted body-copy">{readinessCopy(promotion.weekReadiness.status)}</p>
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
