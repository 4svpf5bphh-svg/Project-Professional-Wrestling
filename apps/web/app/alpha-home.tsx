"use client";

import { useEffect, useRef, useState } from "react";
import type { AlphaPlayerWorldView } from "../../../dist/packages/application/src/player-view.js";

type ErrorPayload = { error?: string };
type AttentionItem = AlphaPlayerWorldView["attention"][number];

const DAY_NAMES = ["", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const SHOW_COMMITMENT_LOCK_HOUR_UTC = 6;
const WORLD_LOCK_HOUR_UTC = 8;
const PRIMARY_LINK_STYLE = {
  minHeight: 48,
  display: "grid",
  placeItems: "center",
  borderRadius: 14,
  background: "linear-gradient(135deg, #20deb8, #20a7df)",
  color: "#03120f",
  fontWeight: 900,
  textDecoration: "none",
  textAlign: "center",
  padding: "0 14px",
} as const;
const SECONDARY_LINK_STYLE = {
  minHeight: 42,
  display: "grid",
  placeItems: "center",
  border: "1px solid #273244",
  borderRadius: 12,
  background: "#0b1118",
  color: "#5de9ce",
  fontWeight: 850,
  textDecoration: "none",
  textAlign: "center",
  padding: "0 12px",
} as const;

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

function readinessCopy(status: string): string {
  switch (status) {
    case "READY": return "Your required show and card are ready. The server will resolve the World at the scheduled weekly lock.";
    case "NOT_REQUIRED": return "No mandatory show is due this week. You can use the planner to prepare future weeks.";
    case "SHOW_REQUIRED": return "A show is due this week but is not safely reserved yet. Open the planner before the weekly lock.";
    case "CARD_REQUIRED": return "Your show is reserved, but the match card still needs booking before the weekly lock.";
    default: return "Weekly readiness is unavailable.";
  }
}

function readinessLabel(status: string): string {
  return status.replaceAll("_", " ");
}

function planningStateLabel(state: string): string {
  return state.replaceAll("_", " ");
}

function attentionLabel(category: AttentionItem["category"]): string {
  return category.replaceAll("_", " ");
}

function attentionPillClass(category: AttentionItem["category"]): string {
  if (category === "ACTION_REQUIRED") return "readiness-pill readiness-attention";
  if (category === "OPPORTUNITY") return "plan-pill plan-reserved";
  return "plan-pill";
}

function attentionDeadline(item: AttentionItem): string | null {
  if (!item.deadline) return null;
  const day = DAY_NAMES[item.deadline.day] ?? `Day ${item.deadline.day}`;
  return `Year ${item.deadline.year} · Week ${item.deadline.week} · ${day}`;
}

function nextAutomaticWorldLock(nowMs: number): Date {
  const now = new Date(nowMs);
  const next = new Date(nowMs);
  next.setUTCHours(WORLD_LOCK_HOUR_UTC, 0, 0, 0);
  if (next.getTime() <= now.getTime()) next.setUTCDate(next.getUTCDate() + 1);
  return next;
}

function showCommitmentLockForWorldCycle(worldLock: Date): Date {
  const commitment = new Date(worldLock.getTime());
  commitment.setUTCHours(SHOW_COMMITMENT_LOCK_HOUR_UTC, 0, 0, 0);
  return commitment;
}

function countdownCopy(nowMs: number, target: Date): string {
  const totalSeconds = Math.max(0, Math.floor((target.getTime() - nowMs) / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return [hours, minutes, seconds]
    .map((value) => String(value).padStart(2, "0"))
    .join(":");
}

function localLockTime(target: Date): string {
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(target);
}

export default function AlphaHome(): React.JSX.Element {
  const [view, setView] = useState<AlphaPlayerWorldView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyPromotionId, setBusyPromotionId] = useState<string | null>(null);
  const [busyAttentionId, setBusyAttentionId] = useState<string | null>(null);
  const [nowMs, setNowMs] = useState(() => Date.now());
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
    const timer = window.setInterval(() => setNowMs(Date.now()), 1_000);
    return () => window.clearInterval(timer);
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

  async function dismissAttentionItem(attentionId: string): Promise<void> {
    setBusyAttentionId(attentionId);
    setError(null);
    try {
      const response = await fetch("/api/attention/dismiss", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ attentionId }),
      });
      const payload = await response.json() as AlphaPlayerWorldView | ErrorPayload;
      if (!response.ok || isErrorPayload(payload)) {
        throw new Error(isErrorPayload(payload) && payload.error ? payload.error : "Unable to dismiss Attention item");
      }
      setView(payload);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to dismiss Attention item");
    } finally {
      setBusyAttentionId(null);
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
  const planning = promotion?.showPlanning ?? null;
  const currentPlan = planning?.currentPlan ?? null;
  const actionRequiredCount = view.attention.filter((item) => item.category === "ACTION_REQUIRED").length;
  const currentMarket = currentPlan?.marketId && planning
    ? planning.markets.find((market) => market.marketId === currentPlan.marketId) ?? null
    : null;
  const currentVenue = currentPlan?.venueId && currentMarket
    ? currentMarket.venues.find((venue) => venue.venueId === currentPlan.venueId) ?? null
    : null;
  const nextWorldLock = nextAutomaticWorldLock(nowMs);
  const nextCommitmentLock = showCommitmentLockForWorldCycle(nextWorldLock);
  const worldLockCountdown = countdownCopy(nowMs, nextWorldLock);
  const commitmentLockCountdown = countdownCopy(nowMs, nextCommitmentLock);
  const commitmentDeadlinePassed = nextCommitmentLock.getTime() <= nowMs;
  const commitmentsLocked = view.world.showCommitmentsLocked;
  const logisticsLocked = Boolean(
    currentPlan && (currentPlan.state === "MATERIALIZED" || currentPlan.state === "READY_TO_LOCK"),
  );
  const worldIsOpen = view.world.phase === "OPEN";
  const commitmentStateLabel = commitmentsLocked || logisticsLocked
    ? "LOCKED"
    : commitmentDeadlinePassed
      ? "DUE NOW"
      : commitmentLockCountdown;
  const worldLockStateLabel = !worldIsOpen
    ? view.world.phase
    : worldLockCountdown;

  let weekActionHref = "/planner";
  let weekActionLabel = "Open six-week planner";
  if (promotion?.weekReadiness.status === "SHOW_REQUIRED") {
    weekActionLabel = "Plan this week's show";
  } else if (promotion?.weekReadiness.status === "CARD_REQUIRED" && currentPlan) {
    weekActionHref = `/card?draftId=${encodeURIComponent(currentPlan.draftId)}`;
    weekActionLabel = "Book this week's match card";
  } else if (promotion?.weekReadiness.status === "READY") {
    weekActionLabel = "Review future weeks";
  }

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
          <section className="panel">
            <div className="section-heading">
              <div>
                <span className="eyebrow">ATTENTION</span>
                <h2>What needs you</h2>
              </div>
              <span className={actionRequiredCount > 0 ? "readiness-pill readiness-attention" : "readiness-pill readiness-ready"}>
                {actionRequiredCount > 0 ? `${actionRequiredCount} ACTION REQUIRED` : "CLEAR"}
              </span>
            </div>
            {view.attention.length === 0 ? (
              <p className="muted body-copy no-margin">Nothing currently needs your attention. The World can stay quiet when there is nothing meaningful to surface.</p>
            ) : (
              <div className="choice-grid">
                {view.attention.map((item) => {
                  const deadline = attentionDeadline(item);
                  return (
                    <article className="choice-card" key={item.attentionId}>
                      <div className="choice-card-top">
                        <div>
                          <span className="eyebrow">{attentionLabel(item.category)}</span>
                          <h3>{item.title}</h3>
                        </div>
                        {deadline ? <span className="revision">{deadline}</span> : <span className={attentionPillClass(item.category)}>{attentionLabel(item.category)}</span>}
                      </div>
                      <p className="muted body-copy">{item.summary}</p>
                      <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
                        {item.deepLink ? <a href={item.deepLink} style={{ color: "#5de9ce", fontWeight: 850, textDecoration: "none" }}>Open →</a> : null}
                        {item.dismissible ? (
                          <button
                            type="button"
                            disabled={busyAttentionId !== null}
                            onClick={() => void dismissAttentionItem(item.attentionId)}
                            style={{
                              border: 0,
                              background: "transparent",
                              color: "#8ea0b4",
                              fontWeight: 800,
                              padding: 0,
                              cursor: busyAttentionId === null ? "pointer" : "default",
                            }}
                          >
                            {busyAttentionId === item.attentionId ? "Dismissing…" : "Dismiss"}
                          </button>
                        ) : null}
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>

          <section className="metric-grid">
            <article className="metric-card"><span>Cash</span><strong>{money(promotion.cash)}</strong></article>
            <article className="metric-card"><span>Last week</span><strong className={promotion.lastWeeklyNet >= 0 ? "positive" : "negative"}>{promotion.lastWeeklyNet >= 0 ? "+" : ""}{money(promotion.lastWeeklyNet)}</strong></article>
            <article className="metric-card"><span>Roster</span><strong>{promotion.roster.length}</strong></article>
            <article className="metric-card"><span>Runway</span><strong>{promotion.runwayWeeks === null ? "—" : `${promotion.runwayWeeks.toFixed(1)}w`}</strong></article>
          </section>

          <section className="panel">
            <div className="section-heading">
              <div>
                <span className="eyebrow">WORLD CLOCK</span>
                <h2>Two deadlines · one World cycle</h2>
              </div>
              <span className={worldIsOpen ? "plan-pill plan-reserved" : "readiness-pill readiness-attention"}>
                {worldIsOpen
                  ? commitmentsLocked
                    ? "CARD EDIT WINDOW"
                    : "WORLD OPEN"
                  : view.world.phase}
              </span>
            </div>

            <div className="world-clock-grid">
              <article className={`world-clock-card ${commitmentsLocked || logisticsLocked ? "world-clock-locked" : ""}`}>
                <div className="world-clock-card-top">
                  <div>
                    <span className="eyebrow">SHOW COMMITMENT LOCK</span>
                    <h3>06:00 UTC</h3>
                  </div>
                  <strong className="world-clock-countdown">{commitmentStateLabel}</strong>
                </div>
                <p className="muted">
                  {localLockTime(nextCommitmentLock)} local · locks venue and committed talent.
                </p>
              </article>

              <article className={`world-clock-card ${!worldIsOpen ? "world-clock-locked" : ""}`}>
                <div className="world-clock-card-top">
                  <div>
                    <span className="eyebrow">WORLD LOCK</span>
                    <h3>08:00 UTC</h3>
                  </div>
                  <strong className="world-clock-countdown">{worldLockStateLabel}</strong>
                </div>
                <p className="muted">
                  {localLockTime(nextWorldLock)} local · closes card editing and resolves the PPW week.
                </p>
              </article>
            </div>

            <p className="micro-copy">
              Before 06:00 you can change show logistics and reserved talent. Between 06:00 and 08:00 the committed venue and wrestlers are fixed, but the card remains editable. At World Lock, player editing closes and the week resolves.
            </p>
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

            {currentPlan ? (
              <>
                <div className="result-grid">
                  <div><span>Plan state</span><strong>{planningStateLabel(currentPlan.state)}</strong></div>
                  <div><span>Show day</span><strong>{DAY_NAMES[currentPlan.day] ?? `Day ${currentPlan.day}`}</strong></div>
                  <div><span>Market</span><strong>{currentMarket?.name ?? "Not selected"}</strong></div>
                  <div><span>Venue</span><strong>{currentVenue?.name ?? "Not selected"}</strong></div>
                  <div><span>Talent</span><strong>{currentPlan.participantIds.length}</strong></div>
                  <div><span>Reservation</span><strong>{currentPlan.reservationId ? "Committed" : "Not committed"}</strong></div>
                </div>
                {currentPlan.riskReasons.length > 0 ? <div className="error-card" style={{ marginTop: 12 }}>{currentPlan.riskReasons.map(readinessLabel).join(" · ")}</div> : null}
              </>
            ) : null}

            <div style={{ marginTop: 14 }}>
              <a href={weekActionHref} style={PRIMARY_LINK_STYLE}>{weekActionLabel}</a>
            </div>
            <p className="micro-copy">World progression is server-scheduled. Prepare required work before lock; a fully prepared show runs normally even if you are away.</p>
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
              <div style={{ marginTop: 12 }}><a href="/results" style={SECONDARY_LINK_STYLE}>Open full results</a></div>
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
                <span className="eyebrow">PROMOTION SNAPSHOT</span>
                <h2>{promotion.tier} · {promotion.homeMarketName}</h2>
              </div>
              <span className={`distress distress-${promotion.financialDistress.toLowerCase()}`}>{promotion.financialDistress}</span>
            </div>
            <div className="status-row">
              <span>{promotion.lifecycle}</span>
              <span>{promotion.planningDraftCount} drafts · {promotion.reservationCount} reserved</span>
              <span>World r{view.world.revision}</span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 8, marginTop: 14 }}>
              <a href="/business" style={SECONDARY_LINK_STYLE}>Open Business</a>
              <a href="/talent" style={SECONDARY_LINK_STYLE}>Open Talent</a>
            </div>
          </section>
        </>
      )}
    </main>
  );
}
