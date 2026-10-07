"use client";

import { useEffect, useMemo, useState } from "react";
import type { PlayerShowHistoryView } from "../../../../dist/packages/application/src/results-view.js";
import type { PlayerWorldResultsView } from "../../../../dist/packages/application/src/world-results-view.js";
import styles from "./results.module.css";

type ErrorPayload = { error?: string };
type ResultsOverviewPayload = {
  promotion: PlayerShowHistoryView;
  world: PlayerWorldResultsView;
};
type ResultsTab = "PROMOTION" | "WORLD";

const DAY_NAMES = ["", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

function isErrorPayload(payload: unknown): payload is ErrorPayload {
  return typeof payload === "object" && payload !== null && "error" in payload;
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

function signedDecimal(value: number): string {
  if (value > 0) return `+${decimal(value)}`;
  if (value < 0) return `−${decimal(Math.abs(value))}`;
  return decimal(value);
}

function label(value: string): string {
  return value.replaceAll("_", " ").toLowerCase();
}

function crowdStoryTitle(tone: "POSITIVE" | "NEUTRAL" | "NEGATIVE"): string {
  if (tone === "POSITIVE") return "The card lifted the room";
  if (tone === "NEGATIVE") return "The card left energy on the table";
  return "The room matched the card";
}

export default function ResultsClient(): React.JSX.Element {
  const [promotionView, setPromotionView] = useState<PlayerShowHistoryView | null>(null);
  const [worldView, setWorldView] = useState<PlayerWorldResultsView | null>(null);
  const [promotionError, setPromotionError] = useState<string | null>(null);
  const [worldError, setWorldError] = useState<string | null>(null);
  const [tab, setTab] = useState<ResultsTab>("PROMOTION");
  const [worldPromotionId, setWorldPromotionId] = useState("ALL");

  async function refreshResults(): Promise<void> {
    setPromotionError(null);
    setWorldError(null);
    const response = await fetch("/api/results-overview", { cache: "no-store" });
    const payload = await response.json() as ResultsOverviewPayload | ErrorPayload;
    if (!response.ok || isErrorPayload(payload)) {
      throw new Error(isErrorPayload(payload) && payload.error ? payload.error : "Unable to load Results & history");
    }
    setPromotionView(payload.promotion);
    setWorldView(payload.world);
  }

  useEffect(() => {
    refreshResults().catch((reason: unknown) => {
      const message = reason instanceof Error ? reason.message : "Unable to load Results & history";
      setPromotionError(message);
      setWorldError(message);
    });
  }, []);

  const worldPromotions = useMemo(() => {
    if (!worldView) return [];
    const promotions = new Map<string, string>();
    for (const show of worldView.shows) promotions.set(show.promotionId, show.promotionName);
    return [...promotions.entries()].sort((left, right) => left[1].localeCompare(right[1]));
  }, [worldView]);

  const visibleWorldShows = useMemo(() => {
    if (!worldView) return [];
    if (worldPromotionId === "ALL") return worldView.shows;
    return worldView.shows.filter((show) => show.promotionId === worldPromotionId);
  }, [worldPromotionId, worldView]);

  const activeWorld = promotionView?.world ?? worldView?.world ?? null;

  if (!promotionView && promotionError) {
    return (
      <main className={styles.shell}>
        <a className={styles.backLink} href="/">← Promotion</a>
        <section className={styles.panel}>
          <p>{promotionError}</p>
          <button className={styles.button} onClick={() => refreshResults().catch(() => undefined)}>Retry</button>
        </section>
      </main>
    );
  }

  if (!promotionView) {
    return (
      <main className={styles.shell}>
        <a className={styles.backLink} href="/">← Promotion</a>
        <section className={styles.panel}><p>Loading Results & history…</p></section>
      </main>
    );
  }

  return (
    <main className={styles.shell}>
      <header className={styles.header}>
        <div>
          <a className={styles.backLink} href="/">← Promotion</a>
          <div className={styles.eyebrow}>RESULTS & HISTORY</div>
          <h1>Results & history</h1>
          <p>{activeWorld?.name} · Year {activeWorld?.currentDate.year}, Week {activeWorld?.currentDate.week}</p>
        </div>
        <button
          className={styles.button}
          onClick={() => {
            refreshResults().catch((reason: unknown) => {
              const message = reason instanceof Error ? reason.message : "Unable to refresh";
              if (tab === "PROMOTION") setPromotionError(message);
              else setWorldError(message);
            });
          }}
        >Refresh</button>
      </header>

      <nav className={styles.tabs} aria-label="Results view">
        <button className={`${styles.tab} ${tab === "PROMOTION" ? styles.activeTab : ""}`} onClick={() => setTab("PROMOTION")} aria-pressed={tab === "PROMOTION"}>
          <strong>My promotion</strong>
          <span>Full cards + private show economics</span>
        </button>
        <button className={`${styles.tab} ${tab === "WORLD" ? styles.activeTab : ""}`} onClick={() => setTab("WORLD")} aria-pressed={tab === "WORLD"}>
          <strong>World results</strong>
          <span>What happened across PPW</span>
        </button>
      </nav>

      {tab === "PROMOTION" ? (
        <>
          {promotionError ? <div className={styles.error}>{promotionError}</div> : null}

          {!promotionView.promotion ? (
            <section className={styles.panel}>
              <h2>No promotion yet</h2>
              <p>Take control of a promotion before your private show history is available.</p>
            </section>
          ) : promotionView.shows.length === 0 ? (
            <section className={styles.panel}>
              <div className={styles.eyebrow}>NO COMPLETED SHOWS</div>
              <h2>Your history starts here</h2>
              <p>Once your first show resolves, its full card and consequences will appear here.</p>
            </section>
          ) : (
            <section className={styles.history}>
              <div className={styles.sectionHeading}>
                <div><span className={styles.eyebrow}>YOUR RECORD</span><strong>{promotionView.promotion.name}</strong></div>
                <span>{promotionView.shows.length} recent completed show{promotionView.shows.length === 1 ? "" : "s"}</span>
              </div>
              {promotionView.shows.map((show, index) => (
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
                      <div><span>Segments</span><strong>{show.segmentCount}</strong></div>
                      <div><span>Consequences</span><strong>{show.titleChangeCount} title · {show.injuryCount} inj.</strong></div>
                    </div>

                    {show.crowdStory ? (
                      <section className={`${styles.crowdStory} ${show.crowdStory.tone === "POSITIVE" ? styles.crowdStoryPositive : show.crowdStory.tone === "NEGATIVE" ? styles.crowdStoryNegative : ""}`}>
                        <div className={styles.crowdStoryTop}>
                          <div>
                            <span className={styles.eyebrow}>CROWD STORY</span>
                            <strong>{crowdStoryTitle(show.crowdStory.tone)}</strong>
                            <p>{show.crowdStory.summary}</p>
                          </div>
                          <div className={styles.crowdStoryScore}>
                            <span>Raw {decimal(show.crowdStory.baseCrowdResponse)}</span>
                            <b>→</b>
                            <span>Final {decimal(show.crowdStory.finalCrowdResponse)}</span>
                            <em className={show.crowdStory.adjustment >= 0 ? styles.crowdPositive : styles.crowdNegative}>{signedDecimal(show.crowdStory.adjustment)}</em>
                          </div>
                        </div>
                        {show.crowdStory.positiveDrivers.length > 0 || show.crowdStory.negativeDrivers.length > 0 ? (
                          <div className={styles.crowdDrivers}>
                            {show.crowdStory.positiveDrivers.length > 0 ? (
                              <div className={styles.crowdDriverGroup}>
                                <span>Helped</span>
                                {show.crowdStory.positiveDrivers.map((driver) => (
                                  <div className={`${styles.crowdDriver} ${styles.crowdPositive}`} key={`positive-${driver.matchId}-${driver.scope}`}>
                                    <small>Match {driver.matchOrder}</small>
                                    <strong>{driver.label}</strong>
                                    <em>{signedDecimal(driver.impact)}</em>
                                  </div>
                                ))}
                              </div>
                            ) : null}
                            {show.crowdStory.negativeDrivers.length > 0 ? (
                              <div className={styles.crowdDriverGroup}>
                                <span>Hurt</span>
                                {show.crowdStory.negativeDrivers.map((driver) => (
                                  <div className={`${styles.crowdDriver} ${styles.crowdNegative}`} key={`negative-${driver.matchId}-${driver.scope}`}>
                                    <small>Match {driver.matchOrder}</small>
                                    <strong>{driver.label}</strong>
                                    <em>{signedDecimal(driver.impact)}</em>
                                  </div>
                                ))}
                              </div>
                            ) : null}
                          </div>
                        ) : null}
                      </section>
                    ) : null}

                    <div className={styles.matches}>
                      {show.runningOrder.map((slot) => {
                        if (slot.kind === "SEGMENT") {
                          return (
                            <article className={`${styles.matchCard} ${styles.segmentResultCard}`} key={slot.segment.segmentId}>
                              <div className={styles.matchTop}>
                                <span>SLOT {slot.order} · SEGMENT · {label(slot.segment.type)}</span>
                                <strong>
                                  {slot.segment.crowdResponse === null || slot.segment.outcomeBand === null
                                    ? `${slot.segment.plannedLengthMinutes} min`
                                    : `${label(slot.segment.outcomeBand)} · Crowd ${decimal(slot.segment.crowdResponse)}`}
                                </strong>
                              </div>
                              <div className={styles.segmentParticipants}>
                                {slot.segment.participants.map((participant) => (
                                  <span key={participant.personId}>{participant.name}</span>
                                ))}
                              </div>
                              <div className={styles.matchMeta}>
                                <span>{slot.segment.programmeId ? "Programme attached" : "Standalone segment"}</span>
                                {slot.segment.executionQuality !== null ? <span>Execution {decimal(slot.segment.executionQuality)}</span> : null}
                                {slot.segment.type === "TURN" && slot.segment.turnTargetAlignment ? (
                                  <span>
                                    {slot.segment.participants.find((participant) => participant.personId === slot.segment.turnPersonId)?.name ?? "Wrestler"} → {label(slot.segment.turnTargetAlignment)}
                                  </span>
                                ) : slot.segment.executionQuality === null ? <span>Resolved show history</span> : null}
                              </div>
                              {slot.segment.factors.length > 0 ? (
                                <div className={styles.crowdContext}>
                                  <span>Segment context</span>
                                  <div>
                                    {slot.segment.factors.map((factor) => (
                                      <span className={factor.impact >= 0 ? styles.crowdFactorPositive : styles.crowdFactorNegative} key={factor.label}>
                                        {factor.label} <b>{signedDecimal(factor.impact)}</b>
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              ) : null}
                            </article>
                          );
                        }
                        const match = slot.match;
                        const sideA = match.participants.filter((participant) => participant.side === "A");
                        const sideB = match.participants.filter((participant) => participant.side === "B");
                        return (
                          <article className={styles.matchCard} key={match.matchId}>
                            <div className={styles.matchTop}>
                              <span>SLOT {slot.order} · {match.isMainEvent ? "MAIN EVENT" : "MATCH"} · {label(match.type)}</span>
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
                            {match.crowdFlowFactors.length > 0 ? (
                              <div className={styles.crowdContext}>
                                <span>Crowd context</span>
                                <div>
                                  {match.crowdFlowFactors.map((factor) => (
                                    <span className={factor.impact >= 0 ? styles.crowdFactorPositive : styles.crowdFactorNegative} key={`${factor.scope}-${factor.reason}`}>
                                      {factor.label} <b>{signedDecimal(factor.impact)}</b>
                                    </span>
                                  ))}
                                </div>
                              </div>
                            ) : null}
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
        </>
      ) : (
        <>
          {worldError ? <div className={styles.error}>{worldError}</div> : null}

          {!worldView ? (
            <section className={styles.panel}>
              <p>{worldError ?? "Loading the World results timeline…"}</p>
              {worldError ? <button className={styles.button} onClick={() => refreshResults().catch(() => undefined)}>Retry</button> : null}
            </section>
          ) : (
            <>
              <section className={styles.worldIntro}>
                <div><span>Recent shows</span><strong>{visibleWorldShows.length}</strong></div>
                <div><span>Promotions</span><strong>{new Set(visibleWorldShows.map((show) => show.promotionId)).size}</strong></div>
                <div><span>Title changes</span><strong>{visibleWorldShows.reduce((sum, show) => sum + show.titleChangeCount, 0)}</strong></div>
                <div><span>Injuries</span><strong>{visibleWorldShows.reduce((sum, show) => sum + show.injuryCount, 0)}</strong></div>
              </section>

              <section className={styles.worldTools}>
                <div>
                  <span className={styles.eyebrow}>WORLD TIMELINE</span>
                  <strong>Latest completed shows across PPW</strong>
                </div>
                <label>
                  <span>Promotion</span>
                  <select value={worldPromotionId} onChange={(event) => setWorldPromotionId(event.target.value)}>
                    <option value="ALL">All promotions</option>
                    {worldPromotions.map(([promotionId, promotionName]) => (
                      <option value={promotionId} key={promotionId}>{promotionName}</option>
                    ))}
                  </select>
                </label>
              </section>

              {visibleWorldShows.length === 0 ? (
                <section className={styles.panel}><p>No completed shows match that promotion.</p></section>
              ) : (
                <section className={styles.history}>
                  {visibleWorldShows.map((show, index) => (
                    <details className={`${styles.showCard} ${show.isPlayerPromotion ? styles.playerWorldShow : ""}`} key={show.eventId} open={index === 0}>
                      <summary className={styles.showSummary}>
                        <div>
                          <div className={styles.worldIdentity}>
                            <span className={styles.eyebrow}>{show.promotionName} · {show.type} SHOW</span>
                            {show.isPlayerPromotion ? <span className={styles.youBadge}>YOU</span> : null}
                          </div>
                          <strong>Year {show.date.year}, Week {show.date.week} · {show.venueName}</strong>
                          <span>{show.marketName} · {integer(show.attendance)} attendance ({decimal(show.attendancePercentOfCapacity)}%)</span>
                        </div>
                        <div className={styles.worldRating}><span>BEST</span><strong>★ {decimal(show.bestMatchRating)}</strong></div>
                      </summary>

                      <div className={styles.showBody}>
                        <div className={styles.metrics}>
                          <div><span>Average</span><strong>★ {decimal(show.averageMatchRating)}</strong></div>
                          <div><span>Best match</span><strong>★ {decimal(show.bestMatchRating)}</strong></div>
                          <div><span>Crowd</span><strong>{decimal(show.crowdResponse)}</strong></div>
                          <div><span>Capacity</span><strong>{decimal(show.attendancePercentOfCapacity)}%</strong></div>
                          <div><span>Matches</span><strong>{show.matchCount}</strong></div>
                          <div><span>Segments</span><strong>{show.segmentCount}</strong></div>
                          <div><span>Consequences</span><strong>{show.titleChangeCount} title · {show.injuryCount} inj.</strong></div>
                        </div>

                        <div className={styles.matches}>
                          {show.runningOrder.map((slot) => {
                            if (slot.kind === "SEGMENT") {
                              return (
                                <article className={`${styles.matchCard} ${styles.segmentResultCard}`} key={slot.segment.segmentId}>
                                  <div className={styles.matchTop}>
                                    <span>SLOT {slot.order} · SEGMENT · {label(slot.segment.type)}</span>
                                    <strong>
                                      {slot.segment.crowdResponse === null || slot.segment.outcomeBand === null
                                        ? "SEGMENT"
                                        : `${label(slot.segment.outcomeBand)} · Crowd ${decimal(slot.segment.crowdResponse)}`}
                                    </strong>
                                  </div>
                                  <div className={styles.segmentParticipants}>
                                    {slot.segment.participants.map((participant) => (
                                      <a className={styles.participantLink} href={`/talent/profile?personId=${encodeURIComponent(participant.personId)}`} key={participant.personId}>
                                        {participant.name}
                                      </a>
                                    ))}
                                  </div>
                                  {slot.segment.type === "TURN" && slot.segment.turnTargetAlignment ? (
                                    <div className={styles.matchMeta}>
                                      <span>
                                        {slot.segment.participants.find((participant) => participant.personId === slot.segment.turnPersonId)?.name ?? "Wrestler"} → {label(slot.segment.turnTargetAlignment)}
                                      </span>
                                    </div>
                                  ) : null}
                                </article>
                              );
                            }
                            const match = slot.match;
                            const sideA = match.participants.filter((participant) => participant.side === "A");
                            const sideB = match.participants.filter((participant) => participant.side === "B");
                            return (
                              <article className={styles.matchCard} key={match.matchId}>
                                <div className={styles.matchTop}>
                                  <span>SLOT {slot.order} · {match.isMainEvent ? "MAIN EVENT" : "MATCH"} · {label(match.type)}</span>
                                  <strong>★ {decimal(match.criticalRatingStars)}</strong>
                                </div>
                                <div className={styles.versus}>
                                  <div>{sideA.map((participant) => (
                                    <a className={`${styles.participantLink} ${participant.won ? styles.winner : ""}`} href={`/talent/profile?personId=${encodeURIComponent(participant.personId)}`} key={participant.personId}>
                                      {participant.name}{participant.won ? " ✓" : ""}
                                    </a>
                                  ))}</div>
                                  <b>vs</b>
                                  <div>{sideB.map((participant) => (
                                    <a className={`${styles.participantLink} ${participant.won ? styles.winner : ""}`} href={`/talent/profile?personId=${encodeURIComponent(participant.personId)}`} key={participant.personId}>
                                      {participant.name}{participant.won ? " ✓" : ""}
                                    </a>
                                  ))}</div>
                                </div>
                                <div className={styles.matchMeta}>
                                  <span>{match.actualLengthMinutes} min</span>
                                  <span>Crowd {decimal(match.crowdResponse)}</span>
                                </div>
                                {match.titleOutcomes.map((title) => (
                                  <a className={`${styles.consequence} ${styles.titleLink}`} href="/championships" key={title.championshipId}>
                                    <strong>{title.championshipName}</strong>
                                    <span>{title.titleChanged ? `Title change → ${title.winnerHolderName}` : `${title.winnerHolderName} retained`}</span>
                                  </a>
                                ))}
                                {match.injuries.map((injury) => (
                                  <a className={`${styles.consequence} ${styles.injury} ${styles.titleLink}`} href={`/talent/profile?personId=${encodeURIComponent(injury.personId)}`} key={injury.injuryId}>
                                    <strong>{injury.personName} injured</strong>
                                    <span>{label(injury.severity)} · {injury.weeksOut} PPW week{injury.weeksOut === 1 ? "" : "s"} out</span>
                                  </a>
                                ))}
                              </article>
                            );
                          })}
                        </div>
                      </div>
                    </details>
                  ))}
                </section>
              )}

              <p className={styles.worldPrivacy}>World Results contains public wrestling history only. Rival gate revenue, costs, profit, contracts, private condition, booking intent and future plans remain hidden.</p>
            </>
          )}
        </>
      )}
    </main>
  );
}
