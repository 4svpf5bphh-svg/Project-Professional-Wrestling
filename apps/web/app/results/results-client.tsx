"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import type { PlayerShowHistoryView } from "../../../../dist/packages/application/src/results-view.js";
import type { PlayerWorldResultsView } from "../../../../dist/packages/application/src/world-results-view.js";
import ShowBroadcast, { MatchFinishReplay, MatchStarRating, ShowFinalBell, segmentResultIcon } from "./show-broadcast";
import { showResultHighlights } from "../../../../dist/packages/web-adapter/src/results-highlights.js";
import { reviewPlayerMatch, reviewPlayerSegment, reviewPlayerShowChapters, type SlotReview, type ShowReviewChapter } from "../../../../dist/packages/web-adapter/src/results-review.js";
import {
  discoverWorldResults, worldResultsWeekLabel, WORLD_RESULTS_SPOTLIGHTS,
  type WorldResultsSpotlight,
} from "../../../../dist/packages/web-adapter/src/world-results-discovery.js";
import styles from "./results.module.css";

type ErrorPayload = { error?: string };
type ResultsOverviewPayload = {
  promotion: PlayerShowHistoryView;
  world: PlayerWorldResultsView;
  revision: number;
  canChooseFollowUp: boolean;
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

function EditorialReview({ review }: { review: SlotReview }): React.JSX.Element {
  return (
    <div className={`${styles.editorialReview} ${review.tone === "GREAT" ? styles.editorialGreat : review.tone === "ROUGH" ? styles.editorialRough : ""}`}>
      <span className={styles.editorialKicker}>AT RINGSIDE · THE REVIEW</span>
      <strong className={styles.editorialHeadline}>{review.headline}</strong>
      <p>{review.recap}</p>
      <div className={styles.editorialVerdict}><b>THE VERDICT</b> {review.verdict}</div>
    </div>
  );
}

function ShowChapterIntro({ chapter }: { chapter: ShowReviewChapter }): React.JSX.Element {
  return (
    <section className={styles.showChapter} aria-label={chapter.chapter + ": " + chapter.headline}>
      <div className={styles.chapterRule} aria-hidden="true"><span /></div>
      <span className={styles.chapterKicker}>{chapter.chapter}</span>
      <h3>{chapter.headline}</h3>
      <p>{chapter.recap}</p>
    </section>
  );
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
  const [worldSpotlight, setWorldSpotlight] = useState<WorldResultsSpotlight>("ALL");
  const [worldSearch, setWorldSearch] = useState("");
  const [worldRevision, setWorldRevision] = useState(0);
  const [canChooseFollowUp, setCanChooseFollowUp] = useState(false);
  const [followUpDrafts, setFollowUpDrafts] = useState<Record<string, "PURSUE_REMATCH" | "PLAN_RETALIATION" | "LET_STAND">>({});
  const [followUpSaving, setFollowUpSaving] = useState<string | null>(null);
  const [followUpError, setFollowUpError] = useState<string | null>(null);

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
    setWorldRevision(payload.revision);
    setCanChooseFollowUp(payload.canChooseFollowUp);
  }

  async function saveFollowUp(eventId: string, matchId: string, programmeId: string, choice: "PURSUE_REMATCH" | "PLAN_RETALIATION" | "LET_STAND"): Promise<void> {
    const promotionId = promotionView?.player.promotionId;
    if (!promotionId || !canChooseFollowUp || followUpSaving) return;
    setFollowUpSaving(matchId);
    setFollowUpError(null);
    try {
      const response = await fetch("/api/results-follow-up", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requestId: crypto.randomUUID(), expectedRevision: worldRevision,
          promotionId, eventId, matchId, programmeId, choice,
        }),
      });
      const payload = await response.json() as ResultsOverviewPayload | ErrorPayload;
      if (!response.ok || isErrorPayload(payload)) {
        throw new Error(isErrorPayload(payload) ? payload.error ?? "Unable to save follow-up" : "Unable to save follow-up");
      }
      setPromotionView(payload.promotion);
      setWorldView(payload.world);
      setWorldRevision(payload.revision);
      setCanChooseFollowUp(payload.canChooseFollowUp);
      setFollowUpDrafts((current) => { const next = { ...current }; delete next[matchId]; return next; });
    } catch (error) {
      setFollowUpError(error instanceof Error ? error.message : "Unable to save follow-up");
    } finally {
      setFollowUpSaving(null);
    }
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
    return discoverWorldResults(worldView.shows, {
      promotionId: worldPromotionId, spotlight: worldSpotlight, query: worldSearch,
    });
  }, [worldPromotionId, worldSpotlight, worldSearch, worldView]);

  const activeWorld = promotionView?.world ?? worldView?.world ?? null;

  if (!promotionView && promotionError) {
    return (
      <main className={styles.shell}>
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
        <section className={styles.panel}><p>Loading Results & history…</p></section>
      </main>
    );
  }

  return (
    <main className={styles.shell}>
      <header className={styles.header}>
        <div>
          <div className={styles.eyebrow}>RESULTS & HISTORY</div>
          <h1>Results & history</h1>
          {followUpError ? <p className={styles.followUpError} role="alert">{followUpError} <button type="button" onClick={() => void refreshResults()}>Refresh</button></p> : null}
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
              {promotionView.shows.map((show, index) => {
                const chapters = reviewPlayerShowChapters(show);
                const chapterByOrder = new Map(chapters.map((chapter) => [chapter.startOrder, chapter]));
                return (
                <details className={styles.showCard} key={show.eventId} open={index === 0}>
                  <summary className={styles.showSummary}>
                    <div>
                      <span className={styles.eyebrow}>{show.type} SHOW · {DAY_NAMES[show.date.day] ?? `Day ${show.date.day}`}</span>
                      <strong>Year {show.date.year}, Week {show.date.week} · {show.venueName}</strong>
                      <span>{show.marketName} · {integer(show.attendance)} attendance ({decimal(show.attendancePercentOfCapacity)}%)</span>
                    </div>
                    <div className={styles.playerEventMarker}>
                      <span>SHOW REVIEW</span>
                      <strong>READ THE SHOW →</strong>
                    </div>
                  </summary>

                  <div className={styles.showBody}>
                    <ShowBroadcast show={show} />
                    <details className={styles.showAnalysis}>
                      <summary>Show analysis &amp; economics <span>Full numbers and crowd breakdown</span></summary>
                      <div className={styles.analysisBody}>
                    <div className={styles.metrics}>
                      <div><span>Net result</span><strong className={show.netResult >= 0 ? styles.positive : styles.negative}>{show.netResult >= 0 ? "+" : ""}{money(show.netResult)}</strong></div>
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
                      </div>
                    </details>

                    {show.cancelledArrivals.length > 0 ? (
                      <section className={styles.unperformedArrivals} aria-label="Unperformed live arrivals">
                        <div className={styles.unperformedArrivalsHeading}>
                          <span aria-hidden="true">⚠</span>
                          <div>
                            <strong>Unperformed live {show.cancelledArrivals.length === 1 ? "arrival" : "arrivals"}</strong>
                            <p>These segments could not take place as booked. The rest of your show ran normally.</p>
                          </div>
                        </div>
                        {show.cancelledArrivals.map((arrival) => (
                          <div className={styles.unperformedArrival} key={arrival.draftSegmentId}>
                            <strong>{arrival.wrestlerName} · {label(arrival.authoredKind)}</strong>
                            <span>{arrival.reason === "EARLIER_COMMITTED_APPEARANCE"
                              ? "An earlier committed appearance in this promotion made this introduction invalid."
                              : "A previous completed appearance changed this wrestler's debut or return eligibility."}</span>
                          </div>
                        ))}
                        <p className={styles.unperformedArrivalsFootnote}>No in-ring segment or crowd response was recorded for these cancelled arrivals.</p>
                      </section>
                    ) : null}

                    <div className={styles.matches} id={`show-${show.eventId}-card`}>
                      {show.runningOrder.map((slot) => {
                        const chapter = chapterByOrder.get(slot.order);
                        if (slot.kind === "SEGMENT") {
                          const review = reviewPlayerSegment(slot.segment);
                          return (
                            <Fragment key={slot.segment.segmentId}>
                              {chapter ? <ShowChapterIntro chapter={chapter} /> : null}
                            <article id={`show-${show.eventId}-slot-${slot.order}`}
                              className={`${styles.matchCard} ${styles.segmentResultCard} ${slot.segment.outcomeBand === "HOT" ? styles.hotAngleResult : ""}`} key={slot.segment.segmentId}>
                              <div className={styles.matchTop}>
                                <span><b className={styles.slotGlyph} aria-hidden="true">{segmentResultIcon(slot.segment.type)}</b> SLOT {slot.order} · SEGMENT · {slot.segment.type === "LIVE_APPEARANCE" && slot.segment.liveAppearanceKind ? `live · ${label(slot.segment.liveAppearanceKind)}` : slot.segment.type === "VIDEO_PACKAGE" && slot.segment.videoKind ? `video · ${label(slot.segment.videoKind)}` : slot.segment.type === "ATTACK" && slot.segment.attackPresentation ? label(slot.segment.attackPresentation) : slot.segment.type === "PROMO" && slot.segment.promoPurpose ? `promo · ${label(slot.segment.promoPurpose)}` : slot.segment.type === "INTERVIEW" && slot.segment.interviewTopic && slot.segment.interviewResponse ? `interview · ${label(slot.segment.interviewTopic)} · ${label(slot.segment.interviewResponse)}` : slot.segment.type === "CELEBRATION" && slot.segment.celebrationOccasion && slot.segment.celebrationEnding ? `celebration · ${label(slot.segment.celebrationOccasion)}` : slot.segment.type === "CONFRONTATION" && slot.segment.confrontationEnding ? `face-off · ${label(slot.segment.confrontationEnding)}` : label(slot.segment.type)}</span>
                                <strong className={slot.segment.outcomeBand === "HOT" ? styles.angleHot : slot.segment.outcomeBand === "POOR" ? styles.anglePoor : styles.angleImpact}>
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
                              <EditorialReview review={review} />
                              <details className={styles.matchAnalysis}>
                                <summary>Booker breakdown · segment context &amp; recorded details</summary>
                                <div className={styles.matchAnalysisBody}>
                              {slot.segment.type === "LIVE_APPEARANCE" && slot.segment.liveAppearanceKind ? (

                                <div className={styles.matchMeta}>

                                  <span>{slot.segment.participants[0]?.name ?? "Wrestler"} · {slot.segment.liveAppearanceKind === "DEBUT" ? "First live appearance for this promotion" : slot.segment.liveAppearanceKind === "RETURN" ? "Returns after time away" : slot.segment.liveAppearanceKind === "SURPRISE_REVEAL" ? "Surprise arrival" : "In-person introduction"}</span>

                                  <span>Booking objective: {slot.segment.liveAppearanceObjective ? label(slot.segment.liveAppearanceObjective) : "Establish a star"}</span>\n

                                </div>

                              ) : null}
                              {slot.segment.type === "INTERVIEW" && slot.segment.interviewTopic && slot.segment.interviewResponse ? (
                                <div className={styles.matchMeta}>
                                  <span>Host asks about {label(slot.segment.interviewTopic)} · {label(slot.segment.interviewFormat ?? "BACKSTAGE")} interview</span>
                                  <span>Scripted answer: {slot.segment.interviewResponse === "CANDID" ? "Candid answer" : slot.segment.interviewResponse === "EVASIVE" ? "Dodges the question" : slot.segment.interviewResponse === "DEFIANT" ? "Defiant answer" : "Walks out"}</span>
                                </div>
                              ) : null}
                              {slot.segment.type === "CELEBRATION" && slot.segment.celebrationOccasion && slot.segment.celebrationEnding ? (
                                <div className={styles.matchMeta}>
                                  <span>{slot.segment.celebrationOccasion === "VICTORY_LAP" ? "Celebrates an actual previous match win" : slot.segment.celebrationOccasion === "SELF_CORONATION" ? "Kayfabe self-coronation · no real title awarded" : slot.segment.celebrationOccasion === "FAN_APPRECIATION" ? "Thanks the fans" : "Taunts a rival"}</span>
                                  <span>Booked ending: {label(slot.segment.celebrationEnding)}</span>
                                </div>
                              ) : null}
                              {slot.segment.type === "CONFRONTATION" && slot.segment.confrontationEnding ? (
                                <div className={styles.matchMeta}>
                                  <span>{slot.segment.initiatorPersonId === null || slot.segment.targetPersonId === null ? "On-screen face-off" : "Direct confrontation · booked wrestler roles"}</span>
                                  <span>{slot.segment.confrontationEnding === "STAREDOWN" ? "Neither wrestler backs down" : slot.segment.confrontationEnding === "INITIATOR_BACKS_DOWN" ? "The instigator backs down" : slot.segment.confrontationEnding === "TARGET_BACKS_DOWN" ? "The targeted wrestler backs down" : "The wrestlers share a reluctant handshake"}</span>
                                </div>
                              ) : null}
                              {slot.segment.type === "VIDEO_PACKAGE" ? (

                                <div className={styles.matchMeta}>

                                  <span>{slot.segment.videoReveal === "CRYPTIC" ? "Mystery footage / silhouette" : slot.segment.videoSubjectName ?? "Featured talent"} · {slot.segment.videoKind ? label(slot.segment.videoKind) : "Wrestler spotlight"} · {slot.segment.videoObjective ? label(slot.segment.videoObjective) : "Build anticipation"}</span>

                                  <span>Pre-recorded footage · not a live appearance</span>

                                </div>

                              ) : null}
                              {slot.segment.type === "INTERRUPTION" && slot.segment.initiatorPersonId && slot.segment.targetPersonId && slot.segment.interruptionOutcome ? (
                                <div className={styles.matchMeta}>
                                  <span>{slot.segment.participants.find((person) => person.personId === slot.segment.initiatorPersonId)?.name ?? "Interrupter"} interrupts {slot.segment.participants.find((person) => person.personId === slot.segment.targetPersonId)?.name ?? "speaker"} · {slot.segment.interruptionOutcome === "VERBAL_EXCHANGE" ? "Verbal exchange" : slot.segment.interruptionOutcome === "INTERRUPTER_PREVAILS" ? "Interrupter gets the better of them" : slot.segment.interruptionOutcome === "SPEAKER_PREVAILS" ? "Original speaker gets the better of them" : "Brawl erupts"}</span>
                                </div>
                              ) : null}
                              {slot.segment.type === "STABLE_RECONCILIATION" && slot.segment.initiatorPersonId && slot.segment.targetPersonId && slot.segment.stableReconciliationOutcome ? (
                                <div className={styles.matchMeta}>
                                  <span>{slot.segment.participants.find((person) => person.personId === slot.segment.initiatorPersonId)?.name ?? "Representative"} approaches former member {slot.segment.participants.find((person) => person.personId === slot.segment.targetPersonId)?.name ?? "Former member"} of {slot.segment.stableName ?? "the stable"} · {slot.segment.stableReconciliationOutcome === "RECONCILED" ? "Reconciled on-screen" : "Reconciliation rebuffed"}</span>
                                </div>
                              ) : null}
                              {slot.segment.type === "STABLE_EXIT" && slot.segment.initiatorPersonId && slot.segment.targetPersonId && slot.segment.stableExitOutcome ? (
                                <div className={styles.matchMeta}>
                                  <span>{slot.segment.participants.find((person) => person.personId === slot.segment.targetPersonId)?.name ?? "Departing member"} {slot.segment.stableExitOutcome === "EXPELLED" ? "expelled from" : "walks out of"} {slot.segment.stableName ?? "the stable"} · {slot.segment.participants.find((person) => person.personId === slot.segment.initiatorPersonId)?.name ?? "Representative"} represents the group</span>
                                </div>
                              ) : null}
                              {slot.segment.type === "STABLE_INVITATION" && slot.segment.initiatorPersonId && slot.segment.targetPersonId && slot.segment.stableInvitationOutcome ? (
                                <div className={styles.matchMeta}>
                                  <span>{slot.segment.participants.find((person) => person.personId === slot.segment.initiatorPersonId)?.name ?? "Representative"} invites {slot.segment.participants.find((person) => person.personId === slot.segment.targetPersonId)?.name ?? "Recruit"} to {slot.segment.stableName ?? "stable"} · {slot.segment.stableInvitationOutcome === "ACCEPTED" ? "Accepted on-screen" : "Refused on-screen"}</span>
                                </div>
                              ) : null}
                              {(slot.segment.type === "STABLE_EXIT"
                                || slot.segment.type === "STABLE_INVITATION" && slot.segment.stableInvitationOutcome === "ACCEPTED"
                                || slot.segment.type === "STABLE_RECONCILIATION" && slot.segment.stableReconciliationOutcome === "RECONCILED") && slot.segment.stableId ? (
                                <div className={styles.matchMeta}>
                                  <span>The televised stable story is recorded. Real roster membership is a separate, explicit promoter decision.</span>
                                  <a href="/talent/stables" className={styles.participantLink}>Review stable follow-through →</a>
                                </div>
                              ) : null}
                              {slot.segment.type === "CONTRACT_SIGNING" && slot.segment.initiatorPersonId && slot.segment.targetPersonId && slot.segment.signingOutcome ? (
                                <div className={styles.matchMeta}>
                                  <span>{slot.segment.participants.find((person) => person.personId === slot.segment.initiatorPersonId)?.name ?? "Proposer"} and {slot.segment.participants.find((person) => person.personId === slot.segment.targetPersonId)?.name ?? "Responder"} · {slot.segment.signingOutcome === "SIGNED" ? "Signed on-screen" : slot.segment.signingOutcome === "REJECTED" ? "Proposal rejected" : slot.segment.signingOutcome === "WALKOUT" ? "Walkout" : "Signing broke into a brawl"}</span>
                                </div>
                              ) : null}
                              {(slot.segment.type === "CHALLENGE" || slot.segment.type === "CONFRONTATION") && slot.segment.initiatorPersonId && slot.segment.targetPersonId ? (
                                  <div className={styles.matchMeta}>
                                    <span>{slot.segment.participants.find((person) => person.personId === slot.segment.initiatorPersonId)?.name ?? "Wrestler"} {slot.segment.type === "CHALLENGE" ? "challenged" : "confronted"} {slot.segment.participants.find((person) => person.personId === slot.segment.targetPersonId)?.name ?? "opponent"}{slot.segment.type === "CHALLENGE" && slot.segment.challengeResponse
                                      ? ` · ${slot.segment.challengeResponse === "ACCEPTED" ? "Challenge accepted" : slot.segment.challengeResponse === "REFUSED" ? "Challenge refused" : "Challenge left open"}`
                                      : ""}</span>
                                  </div>
                                ) : null}
                              {slot.segment.type === "POST_MATCH_ASSAULT" && slot.segment.attackerPersonId && slot.segment.victimPersonId && slot.segment.sourceMatchId ? (
                                <div className={styles.matchMeta}>
                                  <span>{slot.segment.participants.find((person) => person.personId === slot.segment.attackerPersonId)?.name ?? "Aggressor"} attacked {slot.segment.participants.find((person) => person.personId === slot.segment.victimPersonId)?.name ?? "victim"} after the match ({slot.segment.victimMatchOutcome === "WON" ? "victim won" : slot.segment.victimMatchOutcome === "LOST" ? "victim lost" : "match drawn"})</span>
                                  {slot.segment.postMatchAssaultEnding ? (
                                    <span>{slot.segment.attackPresentation ? label(slot.segment.attackPresentation) : "Assault"} · {slot.segment.attackObjective ? label(slot.segment.attackObjective) : "Unspecified motive"} · {slot.segment.postMatchAssaultEnding === "ATTACKER_STANDS_TALL" ? "Aggressor stands tall" : slot.segment.postMatchAssaultEnding === "VICTIM_FIGHTS_BACK" ? "Victim fights back" : "Officials separate the wrestlers"}</span>
                                  ) : null}
                                </div>
                              ) : null}
                              {slot.segment.type === "RESCUE" && slot.segment.attackerPersonId && slot.segment.victimPersonId && slot.segment.rescuerPersonId ? (
                                <div className={styles.matchMeta}>
                                  <span>{slot.segment.participants.find((person) => person.personId === slot.segment.rescuerPersonId)?.name ?? "Rescuer"} attempted to save {slot.segment.participants.find((person) => person.personId === slot.segment.victimPersonId)?.name ?? "victim"} from {slot.segment.participants.find((person) => person.personId === slot.segment.attackerPersonId)?.name ?? "aggressor"}{slot.segment.rescueOutcome === "RESCUER_STANDS_TALL" ? " · rescuer drives off the attacker" : slot.segment.rescueOutcome === "ATTACKER_ESCAPES" ? " · attacker escapes the save" : slot.segment.rescueOutcome === "RESCUE_OVERWHELMED" ? " · rescue fails; attacker overwhelms them" : " · outcome not recorded in legacy booking"}</span>
                                </div>
                              ) : null}
                              {slot.segment.type === "ATTACK" && slot.segment.attackerPersonId && slot.segment.victimPersonId ? (
                                <div className={styles.matchMeta}>
                                  <span>{slot.segment.participants.find((person) => person.personId === slot.segment.attackerPersonId)?.name ?? "Attacker"} attacked {slot.segment.participants.find((person) => person.personId === slot.segment.victimPersonId)?.name ?? "victim"}</span>
                                </div>
                              ) : null}
                              <div className={styles.matchMeta}>
                                <span>{slot.segment.programmeId ? "Programme attached" : "Standalone segment"}</span>
                                {slot.segment.type === "ATTACK" && slot.segment.attackObjective ? (
                                  <span>Booking objective: {label(slot.segment.attackObjective)}</span>
                                ) : null}
                                {slot.segment.executionQuality !== null ? <span>Execution {decimal(slot.segment.executionQuality)}</span> : null}
                                {slot.segment.type === "TURN" && slot.segment.turnTargetAlignment ? (
                                  <>
                                    <span>
                                      {slot.segment.participants.find((participant) => participant.personId === slot.segment.turnPersonId)?.name ?? "Wrestler"} → {label(slot.segment.turnTargetAlignment)}
                                    </span>
                                    {slot.segment.turnPresentation === "BETRAYAL" && slot.segment.betrayedPersonId ? (
                                      <span>Betrayed {slot.segment.participants.find((person) => person.personId === slot.segment.betrayedPersonId)?.name ?? "another wrestler"}</span>
                                    ) : null}
                                  </>
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
                                </div>
                              </details>
                            </article>
                            </Fragment>
                          );
                        }
                        const match = slot.match;
                        const review = reviewPlayerMatch(match);
                        const sideA = match.participants.filter((participant) => participant.side === "A");
                        const sideB = match.participants.filter((participant) => participant.side === "B");
                        return (
                          <Fragment key={match.matchId}>
                            {chapter ? <ShowChapterIntro chapter={chapter} /> : null}
                          <article id={`show-${show.eventId}-slot-${slot.order}`} className={`${styles.matchCard} ${styles.matchResultCard} ${match.isMainEvent ? styles.mainEventResult : ""}`} key={match.matchId}>
                            <div className={styles.matchTop}>
                              <span>SLOT {slot.order} · {match.isMainEvent ? "MAIN EVENT" : "MATCH"} · {label(match.type)}</span>
                              <MatchStarRating rating={match.criticalRatingStars} />
                            </div>
                            <div className={styles.versus}>
                              <div>{sideA.map((participant) => <span className={participant.won ? styles.winner : undefined} key={participant.personId}>{participant.name}{participant.won ? " ✓" : ""}</span>)}</div>
                              <b>vs</b>
                              <div>{sideB.map((participant) => <span className={participant.won ? styles.winner : undefined} key={participant.personId}>{participant.name}{participant.won ? " ✓" : ""}</span>)}</div>
                            </div>
                            <div className={styles.matchOutcomeLine} aria-label="Recorded match result">
                              <span>RESULT</span>
                              <strong>{match.winnerNames.length > 0 ? match.winnerNames.join(" & ") + " wins" : "No winner recorded"}</strong>
                            </div>
                            <EditorialReview review={review} />
                            <details className={styles.matchAnalysis}>
                              <summary>Booker breakdown · Crowd {decimal(match.crowdResponse)} · {match.actualLengthMinutes} min</summary>
                              <div className={styles.matchAnalysisBody}>
                            <MatchFinishReplay match={match} />
                            <div className={styles.matchMeta}>
                              <span>{match.styleResult ? "Dimensional style" : `${label(match.intent)} intent`}</span>
                              <span>{match.actualLengthMinutes} min{match.actualLengthMinutes !== match.plannedLengthMinutes ? ` / ${match.plannedLengthMinutes} planned` : ""}</span>
                              <span>Crowd {decimal(match.crowdResponse)}</span>
                            </div>
                            {match.interference ? (
                              <div className={styles.matchMeta}>
                                <span>Run-in: {match.interference.name} assisted Side {match.interference.aidedSide} · {match.interference.outcome === "SUCCESS" ? "Succeeded (protected finish)" : match.interference.outcome === "ABORTED" ? "Aborted" : "Thwarted"}</span>
                              </div>
                            ) : null}
                            {match.styleResult ? (
                              <div className={styles.styleResult}>
                                <div>
                                  <span>Style delivery</span>
                                  <strong>{label(match.styleResult.delivery)}</strong>
                                </div>
                                <div>
                                  <span>Execution</span>
                                  <strong>{decimal(match.executionQuality)}</strong>
                                </div>
                                <div>
                                  <span>Load</span>
                                  <strong>{label(match.styleResult.loadBand)}</strong>
                                </div>
                                <div>
                                  <span>Capability</span>
                                  <strong>{decimal(match.styleResult.capability)}</strong>
                                </div>
                                <p>
                                  Physical {decimal(match.styleResult.physicalLoad)} · Creative {decimal(match.styleResult.creativeLoad)}
                                  {match.styleResult.shortfall >= 12 ? ` · Style stretch ${decimal(match.styleResult.shortfall)}` : ""}
                                </p>
                              </div>
                            ) : null}
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
                              </div>
                            </details>
                            {match.followUpProgrammeId ? (
                              <details className={styles.matchAnalysis}>
                                <summary>Booker's next move · plan a programme follow-up</summary>
                                <div className={styles.matchAnalysisBody}>
                                  <div className={styles.followUpPlanner}>
                                    <strong>WHAT'S NEXT FOR THIS PROGRAMME?</strong>
                                    <small>Optional planning note. No automatic rematch or segment is created.</small>
                                    <select aria-label="Next Programme direction"
                                      disabled={!canChooseFollowUp || followUpSaving === match.matchId}
                                      value={followUpDrafts[match.matchId] ?? match.followUpChoice ?? ""}
                                      onChange={(event) => setFollowUpDrafts((current) => ({
                                        ...current, [match.matchId]: event.target.value as "PURSUE_REMATCH" | "PLAN_RETALIATION" | "LET_STAND",
                                      }))}>
                                      <option value="">Choose direction…</option>
                                      <option value="PURSUE_REMATCH">Pursue a rematch</option>
                                      <option value="PLAN_RETALIATION">Plan retaliation</option>
                                      <option value="LET_STAND">Let the result stand</option>
                                    </select>
                                    <button type="button"
                                      disabled={!canChooseFollowUp || Boolean(followUpSaving)
                                        || !followUpDrafts[match.matchId]
                                        || followUpDrafts[match.matchId] === match.followUpChoice}
                                      onClick={() => void saveFollowUp(show.eventId, match.matchId, match.followUpProgrammeId!,
                                        followUpDrafts[match.matchId]!)}>
                                      {followUpSaving === match.matchId ? "Saving…" : "Save direction"}
                                    </button>
                                    <a href="/programmes">Open Programmes →</a>
                                    {match.followUpChoice ? <small>Saved: {label(match.followUpChoice)}</small> : null}
                                    {!canChooseFollowUp ? <small>Available when the World is open for planning.</small> : null}
                                  </div>
                                </div>
                              </details>
                            ) : null}
                            {match.titleOutcomes.map((title) => (
                              <div className={`${styles.consequence} ${title.titleChanged ? styles.titleChangeMoment : ""}`} key={title.championshipId}>
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
                          </Fragment>
                        );
                      })}
                    </div>
                    <div id={`show-${show.eventId}-finale`} className={styles.finaleAnchor}>
                      <ShowFinalBell show={show} />
                    </div>
                  </div>
                </details>
                );
              })}
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
                <div className={styles.worldToolsHeading}>
                  <span className={styles.eyebrow}>WORLD TIMELINE</span>
                  <strong>Follow the stories across PPW</strong>
                  <small>Search and filters cover the latest {worldView.shows.length} completed public shows, not the entire World archive.</small>
                </div>
                <div className={styles.worldFilters}>
                  <label>
                    <span>Promotion</span>
                    <select value={worldPromotionId} onChange={(event) => setWorldPromotionId(event.target.value)}>
                      <option value="ALL">All promotions</option>
                      {worldPromotions.map(([promotionId, promotionName]) => (
                        <option value={promotionId} key={promotionId}>{promotionName}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    <span>Find a wrestler, title or venue</span>
                    <input type="search" value={worldSearch}
                      onChange={(event) => setWorldSearch(event.target.value)}
                      placeholder="Search recent results" maxLength={100} autoComplete="off" />
                  </label>
                </div>
              </section>
              <div className={styles.worldSpotlights} aria-label="Filter World results by moment">
                {WORLD_RESULTS_SPOTLIGHTS.map((option) => (
                  <button type="button" key={option.value}
                    className={`${styles.worldSpotlight} ${worldSpotlight === option.value ? styles.worldSpotlightSelected : ""}`}
                    aria-pressed={worldSpotlight === option.value}
                    onClick={() => setWorldSpotlight(option.value)}>
                    {option.label}
                  </button>
                ))}
              </div>
              <p className={styles.worldResultCount} aria-live="polite">
                {visibleWorldShows.length} of {worldView.shows.length} recent completed shows
              </p>

              {visibleWorldShows.length === 0 ? (
                <section className={styles.panel}>
                  <p>No recent completed shows match those filters.</p>
                  <button type="button" className={styles.button}
                    onClick={() => { setWorldPromotionId("ALL"); setWorldSearch(""); setWorldSpotlight("ALL"); }}>
                    Clear filters
                  </button>
                </section>
              ) : (
                <section className={styles.history}>
                  {visibleWorldShows.map((show, index) => (
                    <Fragment key={show.eventId}>
                      {index === 0 || worldResultsWeekLabel(show) !== worldResultsWeekLabel(visibleWorldShows[index - 1]!)
                        ? <h3 className={styles.worldWeekHeading}>{worldResultsWeekLabel(show)}</h3> : null}
                    <details className={`${styles.showCard} ${show.isPlayerPromotion ? styles.playerWorldShow : ""}`} open={index === 0}>
                      <summary className={styles.showSummary}>
                        <div>
                          <div className={styles.worldIdentity}>
                            <span className={styles.eyebrow}>{show.promotionName} · {show.type} SHOW</span>
                            {show.isPlayerPromotion ? <span className={styles.youBadge}>YOU</span> : null}
                          </div>
                          <strong>{show.venueName} · {DAY_NAMES[show.date.day] ?? `Day ${show.date.day}`}</strong>
                          {showResultHighlights(show, 1)[0] ? (
                            <span className={styles.worldSummaryHeadline}>
                              {showResultHighlights(show, 1)[0]!.headline}
                            </span>
                          ) : <span>{show.marketName} · completed show</span>}
                          <span>{integer(show.attendance)} in attendance · {show.marketName}</span>
                        </div>
                        <div className={styles.worldRating}><span>BEST</span><strong>★ {decimal(show.bestMatchRating)}</strong></div>
                      </summary>

                      <div className={styles.showBody}>
                        <div className={styles.worldScoreboard}>
                          <div className={styles.worldScoreboardHeading}>
                            <div>
                              <span className={styles.eyebrow}>RESULTS FROM THE WORLD</span>
                              <strong>Final bell · full match results</strong>
                            </div>
                            <MatchStarRating rating={show.averageMatchRating} />
                          </div>
                          {show.matches.length === 0 ? (
                            <p className={styles.worldScoreboardEmpty}>No completed bouts were recorded for this show.</p>
                          ) : show.matches.map((match) => (
                            <article className={styles.worldResultRow} key={match.matchId}>
                              <div className={styles.worldResultTop}>
                                <span>{match.isMainEvent ? "MAIN EVENT" : "MATCH " + match.order} · {label(match.type)}</span>
                                <MatchStarRating rating={match.criticalRatingStars} />
                              </div>
                              <div className={styles.worldContestants}>
                                <div className={styles.worldSide}>
                                  {match.participants.filter((person) => person.side === "A").map((person) => (
                                    <span key={person.personId} className={person.won ? styles.worldWinner : undefined}>
                                      {person.name}{person.won ? " ✓" : ""}
                                    </span>
                                  ))}
                                </div>
                                <b>VS</b>
                                <div className={styles.worldSide}>
                                  {match.participants.filter((person) => person.side === "B").map((person) => (
                                    <span key={person.personId} className={person.won ? styles.worldWinner : undefined}>
                                      {person.name}{person.won ? " ✓" : ""}
                                    </span>
                                  ))}
                                </div>
                              </div>
                              <small>{match.winnerNames.length > 0 ? match.winnerNames.join(" & ") + " wins" : "Winner not recorded"}
                                {match.actualFinish ? " · " + label(match.actualFinish) : ""}
                              </small>
                              {match.titleOutcomes.filter((entry) => entry.titleChanged).map((title) => (
                                <div className={styles.worldMajorMoment} key={title.championshipId}>
                                  <span aria-hidden="true">🏆</span>
                                  <span>{title.championshipName} · new champion: {title.winnerHolderName}</span>
                                </div>
                              ))}
                              {match.injuries.map((injury) => (
                                <div className={styles.worldMajorMoment} key={injury.injuryId}>
                                  <span aria-hidden="true">✚</span>
                                  <span>{injury.personName} injured · {injury.weeksOut} PPW weeks out</span>
                                </div>
                              ))}
                            </article>
                          ))}
                          <p className={styles.worldScoreboardFoot}>
                            {integer(show.attendance)} attended · {show.segmentCount} segments · {show.titleChangeCount} title changes · {show.injuryCount} injuries
                          </p>
                        </div>
                      </div>
                    </details>
                    </Fragment>
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
