"use client";

import { useEffect, useRef, useState } from "react";
import type { AlphaPlayerWorldView } from "../../../packages/application/src/player-view";

function money(value: number): string {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

function ppwDate(view: AlphaPlayerWorldView): string {
  return `Year ${view.world.year} · Week ${view.world.week}`;
}

export default function AlphaHome(): React.JSX.Element {
  const [view, setView] = useState<AlphaPlayerWorldView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyPromotionId, setBusyPromotionId] = useState<string | null>(null);
  const requestIds = useRef(new Map<string, string>());

  async function refresh(): Promise<void> {
    setError(null);
    const response = await fetch("/api/session", { cache: "no-store" });
    const payload = await response.json() as AlphaPlayerWorldView | { error?: string };
    if (!response.ok || "error" in payload) {
      throw new Error("error" in payload && payload.error ? payload.error : "Unable to load World");
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
      const payload = await response.json() as AlphaPlayerWorldView | { error?: string };
      if (!response.ok || "error" in payload) {
        throw new Error("error" in payload && payload.error ? payload.error : "Unable to claim promotion");
      }
      requestIds.current.delete(promotionId);
      setView(payload);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to claim promotion");
    } finally {
      setBusyPromotionId(null);
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
