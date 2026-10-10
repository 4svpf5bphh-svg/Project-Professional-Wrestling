"use client";

import { useEffect, useRef, useState } from "react";
import type { PlayerBackstageView } from "../../../../dist/packages/application/src/backstage.js";
import type { BackstageResponse } from "../../../../dist/packages/application/src/engagement.js";

type ErrorPayload = { error?: string };

function isError(payload: PlayerBackstageView | ErrorPayload): payload is ErrorPayload {
  return "error" in payload;
}

const REPLIES: Array<{ value: BackstageResponse; label: string; detail: string }> = [
  { value: "HEAR_OUT", label: "Hear them out", detail: "Acknowledge what they have said without making a booking promise." },
  { value: "EXPLAIN_PLAN", label: "Explain your current plans", detail: "Discuss the way you have used them, without committing to a new position." },
  { value: "STAND_FIRM", label: "Stand firm", detail: "Make it clear that you intend to keep booking as you have." },
  { value: "PROMISE_FEATURED_BOOKING", label: "Promise a featured match", detail: "Commit to a suitable main-event or upper-card match within four PPW weeks (or before the contract ends). The World checks actual results." },
  { value: "CONSIDER_TAG_TEAM", label: "Explore the pairing", detail: "Keep this suggestion in mind. Only you decide whether to make an actual tag team or book them together." },
  { value: "PASS_TAG_TEAM", label: "Not right now", detail: "Pass on the pitch without affecting contracts, morale or wrestling results." },
  { value: "CONSIDER_RIVALRY", label: "Explore the programme", detail: "Consider building an on-screen feud. You still author every segment and outcome." },
  { value: "PASS_RIVALRY", label: "Not the right feud", detail: "Pass on this idea without changing relationships or any scripted wrestling." },
  { value: "CONSIDER_GIMMICK_CHANGE", label: "Explore a repackaging", detail: "Consider a new direction. Only you can edit the gimmick in the wrestler profile." },
  { value: "PASS_GIMMICK_CHANGE", label: "Keep the current gimmick", detail: "Decline the suggestion; no character, trust or morale change follows." },
  { value: "DISCUSS_WORKING_PLAN", label: "Discuss ways to improve the partnership", detail: "Open a professional conversation. Only completed future matches can demonstrate actual improvement; this is not a guarantee." },
  { value: "KEEP_WORKING_PAIR", label: "Keep the pairing for now", detail: "Maintain your creative direction. This response does not force any future booking or cause another trust penalty." },
  { value: "CONSIDER_PARTNER_CHANGE", label: "Explore a different pairing", detail: "Consider another partner or a rest period. You must make any actual changes yourself through booking and team management." },
];

function roleLabel(role: string): string {
  return role === "MAIN_EVENT" ? "main-event" : "upper-card";
}

export default function BackstageClient(): React.JSX.Element {
  const [view, setView] = useState<PlayerBackstageView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [choices, setChoices] = useState<Record<string, BackstageResponse>>({});
  const requestIds = useRef(new Map<string, string>());

  async function load(): Promise<void> {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/backstage", { cache: "no-store" });
      const payload = await response.json() as PlayerBackstageView | ErrorPayload;
      if (!response.ok || isError(payload)) {
        throw Error(isError(payload) && payload.error ? payload.error : "Unable to load Backstage");
      }
      setView(payload);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to load Backstage");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  async function respond(conversationId: string, selected: BackstageResponse): Promise<void> {
    if (busyId || !view?.canRespond) return;
    setError(null);
    setBusyId(conversationId);
    const key = conversationId + ":" + selected;
    const requestId = requestIds.current.get(key) ?? crypto.randomUUID();
    requestIds.current.set(key, requestId);
    try {
      const response = await fetch("/api/backstage/respond", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestId, conversationId, response: selected }),
      });
      const payload = await response.json() as PlayerBackstageView | ErrorPayload;
      if (!response.ok || isError(payload)) {
        throw Error(isError(payload) && payload.error ? payload.error : "Unable to record your response");
      }
      setView(payload);
      requestIds.current.delete(key);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to respond Backstage");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <main className="page-shell" style={{ paddingBottom: 120 }}>
      <section className="panel">
        <div className="section-heading">
          <div>
            <span className="eyebrow">TALENT / BACKSTAGE</span>
            <h1>Behind the curtain</h1>
          </div>
          <a href="/" className="secondary-button">Home</a>
        </div>
        <p className="muted body-copy">
          Hear your wrestlers out, assess their creative ideas, and follow through on any booking commitments.
          Only an unexcused broken promise can cost promotion-specific trust; ordinary conversations do not change morale.
          You script the wrestling. Backstage cannot create a team, feud or match on its own.
        </p>
      </section>

      {error ? <section className="panel"><p className="error-card">{error}</p><button type="button" onClick={() => void load()}>Reload</button></section> : null}
      {loading ? <section className="panel"><p className="muted">Checking the locker room…</p></section> : null}
      {!loading && view?.promotionId === null ? (
        <section className="panel"><p className="muted">Take control of a promotion to receive private Backstage conversations.</p></section>
      ) : null}
      {!loading && view?.promotionId ? (
        <section className="panel">
          <div className="section-heading">
            <div><span className="eyebrow">YOUR LOCKER ROOM</span><h2>{view.openCount} conversation{view.openCount === 1 ? "" : "s"} awaiting response</h2></div>
          </div>
          {view.conversations.length === 0 ? <p className="muted body-copy">No concerns have been raised. A quiet locker room is perfectly normal.</p> : null}
          {!view.canRespond && view.openCount > 0 ? <p className="muted body-copy">The World is currently locked. Conversations can be answered when it reopens.</p> : null}
          <div className="choice-grid">
            {view.conversations.map((conversation) => {
              const pitch = conversation.kind === "TAG_TEAM_PITCH";
              const rivalry = conversation.kind === "RIVALRY_PITCH";
              const moment = conversation.kind === "TEAM_MOMENT";
              const gimmick = conversation.kind === "GIMMICK_CHANGE_PITCH";
              const working = conversation.kind === "WORKING_PARTNERSHIP_CONCERN";
              const replies = REPLIES.filter((reply) => pitch
                ? reply.value === "CONSIDER_TAG_TEAM" || reply.value === "PASS_TAG_TEAM"
                : rivalry
                  ? reply.value === "CONSIDER_RIVALRY" || reply.value === "PASS_RIVALRY"
                  : gimmick
                    ? reply.value === "CONSIDER_GIMMICK_CHANGE" || reply.value === "PASS_GIMMICK_CHANGE"
                    : working
                      ? ["DISCUSS_WORKING_PLAN", "KEEP_WORKING_PAIR", "CONSIDER_PARTNER_CHANGE"].includes(reply.value)
                      : !["CONSIDER_TAG_TEAM","PASS_TAG_TEAM","CONSIDER_RIVALRY","PASS_RIVALRY",
                          "CONSIDER_GIMMICK_CHANGE","PASS_GIMMICK_CHANGE",
                          "DISCUSS_WORKING_PLAN","KEEP_WORKING_PAIR","CONSIDER_PARTNER_CHANGE"].includes(reply.value));
              const selected = choices[conversation.conversationId] ?? (
                pitch ? "CONSIDER_TAG_TEAM" : rivalry ? "CONSIDER_RIVALRY"
                  : gimmick ? "CONSIDER_GIMMICK_CHANGE" : working ? "DISCUSS_WORKING_PLAN" : "HEAR_OUT"
              );
              return (
                <article className="choice-card" key={conversation.conversationId}>
                  <div className="choice-card-top">
                    <div>
                      <span className="eyebrow">{moment ? "LOCKER-ROOM GOOD NEWS" : pitch ? "TAG-TEAM PITCH" : rivalry ? "RIVALRY PITCH"
                        : gimmick ? "CHARACTER PITCH" : working ? "TAG PARTNERSHIP CONCERN" : conversation.status === "OPEN" ? "WANTS A WORD" : "CONVERSATION RECORDED"}</span>
                      <h3>{conversation.wrestlerName}</h3>
                    </div>
                    <span className="revision">Y{conversation.createdDate.year} W{conversation.createdDate.week}</span>
                  </div>
                  <p className="body-copy" style={{fontStyle:"italic",borderLeft:"3px solid #5de9ce",paddingLeft:12}}>
                    “{conversation.dialogue.speech}”
                  </p>
                  {working ? (
                    <>
                      <p className="muted micro-copy">
                        {conversation.observedMatchShows} independently completed poor tag outings ·
                        Professional working confidence {conversation.workingTrustDelta?.toFixed(1) ?? "—"}.
                        The World ledger recorded this before the conversation.
                      </p>
                      <a href="/talent/teams" style={{ color: "#5de9ce", fontWeight: 850 }}>
                        Review tag teams →
                      </a>
                      <p className="muted micro-copy">
                        This is about professional in-ring execution, not personal hostility.
                        None of your replies breaks up the team, changes a scripted storyline, alters morale or restores trust automatically.
                      </p>
                    </>
                  ) : gimmick ? (
                    <>

                      <p className="muted micro-copy">
                        Actual completed appearances: {conversation.observedMatchShows} ·
                        Average match crowd response: {conversation.observedCrowdResponse?.toFixed(1) ?? "—"}/100.
                        This does not prove the gimmick caused the results.
                      </p>
                      <a href={`/talent/profile?personId=${encodeURIComponent(conversation.wrestlerId)}&from=talent`}
                        style={{ color: "#5de9ce", fontWeight: 850 }}>Open wrestler presentation →</a>
                      <p className="muted micro-copy">
                        You choose the character, style and moves. Exploring this idea does not apply it.
                      </p>
                    </>
                  ) : moment ? (
                    <>

                      <p className="muted micro-copy">
                        {conversation.sharedTagMatches} verified recent tag matches · Average crowd response:
                        {" "}{conversation.averageCrowdResponse?.toFixed(1) ?? "—"}/100 ·
                        Professional trust: {conversation.professionalTrustAtPitch?.toFixed(1) ?? "—"}/100.
                      </p>
                      <p className="muted micro-copy">For your information only. No reply or booking action required.</p>
                    </>
                  ) : rivalry ? (
                    <>

                      <p className="muted micro-copy">
                        {conversation.sharedSinglesMatches} completed singles matches · Average crowd response:
                        {" "}{conversation.averageCrowdResponse?.toFixed(1) ?? "—"}/100 ·
                        Professional trust: {conversation.professionalTrustAtPitch?.toFixed(1) ?? "—"}/100.
                      </p>
                      <a href="/programmes" style={{ color: "#5de9ce", fontWeight: 850 }}>Open Programmes →</a>
                      <p className="muted micro-copy">
                        They work well together backstage. Any on-screen hostility is scripted by you.
                        No feud is started automatically.
                      </p>
                    </>
                  ) : pitch ? (
                    <>

                      <p className="muted micro-copy">
                        {conversation.sharedTagMatches} completed tag matches together · Average crowd response: {conversation.averageCrowdResponse?.toFixed(1) ?? "—"}/100.
                      </p>
                      <a href="/talent/teams" style={{ color: "#5de9ce", fontWeight: 850 }}>
                        Tag teams management →
                      </a>
                      <p className="muted micro-copy">This is a creative suggestion only. No team, match or storyline is created automatically.</p>
                    </>
                  ) : (
                    <>

                      <p className="muted micro-copy">Contract role: {roleLabel(conversation.promisedRole ?? "UPPER_CARD")} · Last {conversation.observedMatchShows} completed in-ring appearances were not in that position.</p>
                    </>
                  )}
                  {conversation.creativeFollowThrough ? (
                    <p className="body-copy">
                      <strong>Booked follow-through:</strong>{" "}
                      {conversation.creativeFollowThrough.kind==="TAG_MATCH_BOOKED"
                        ? "You booked the suggested partnership in a completed tag match."
                        : conversation.creativeFollowThrough.kind==="PROGRAMME_STARTED"
                          ? "You started a Programme with the suggested opponent."
                          : "You changed the wrestler's gimmick presentation."}
                      {" "}Y{conversation.creativeFollowThrough.happenedDate.year}
                      {" "}W{conversation.creativeFollowThrough.happenedDate.week}.
                      No new points or trust modifier has been applied.
                    </p>
                  ) : null}
                  {conversation.workingFollowThrough ? (
                    <p className="body-copy">
                      <strong>Verified later booking:</strong>{" "}
                      {conversation.workingFollowThrough.kind === "PARTNERS_REBOOKED"
                        ? "These wrestlers worked together again in a completed tag match."
                        : `A completed tag match featured ${conversation.wrestlerName} alongside ${conversation.workingFollowThroughPartnerName ?? "another wrestler"}.`}
                      {" "}Execution {conversation.workingFollowThrough.executionQuality.toFixed(1)}/100 ·
                      {" "}Y{conversation.workingFollowThrough.happenedDate.year}
                      {" "}W{conversation.workingFollowThrough.happenedDate.week}.
                      This records the booking and performance, not the cause,
                      consent or a guaranteed improvement. No additional trust or morale effect.
                    </p>
                  ) : null}
                  {conversation.continuity
                    && (conversation.continuity.priorAnsweredCount > 0
                      || conversation.continuity.pastPositiveTeamMomentsWithPartner > 0
                      || conversation.continuity.lastWorkingDecision) ? (
                    <p className="muted micro-copy">
                      <strong>Working history:</strong>
                      {" "}{conversation.continuity.priorAnsweredCount} earlier answered conversation(s)
                      with this promotion.
                      {conversation.continuity.pastPositiveTeamMomentsWithPartner > 0
                        ? ` ${conversation.continuity.pastPositiveTeamMomentsWithPartner} previous verified positive team note(s) with this partner.`
                        : ""}
                      {conversation.continuity.lastWorkingDecision
                        ? ` Earlier, you ${conversation.continuity.lastWorkingDecision.response === "DISCUSS_WORKING_PLAN"
                            ? "discussed ways to improve this pairing"
                            : conversation.continuity.lastWorkingDecision.response === "KEEP_WORKING_PAIR"
                              ? "chose to keep the pairing" : "considered another partner"}.`
                        : ""}
                      {conversation.continuity.lastWorkingDecision?.observedLaterKind === "PARTNERS_REBOOKED"
                        ? " A subsequent completed tag match used the original pair."
                        : conversation.continuity.lastWorkingDecision?.observedLaterKind === "ALTERNATE_PARTNER_APPEARED"
                          ? " A subsequent completed tag match featured a different partner."
                          : ""}
                      {" "}Suggestions are not promises, and scripted decisions remain yours.
                    </p>
                  ) : null}
                  {conversation.creativeInterestAtPitch ? (
                    <p className="muted micro-copy">
                      In-game creative interest: {conversation.creativeInterestAtPitch.replaceAll("_"," ").toLowerCase()}.
                      {conversation.kind === "TAG_TEAM_PITCH" && conversation.tagFamiliarityAtPitch !== null
                        ? ` Recorded tag familiarity: ${conversation.tagFamiliarityAtPitch.toFixed(1)}/100.`
                        : ""}
                      {conversation.kind === "TAG_TEAM_PITCH" && conversation.professionalTrustAtPitch !== null
                        ? ` Recorded professional trust: ${conversation.professionalTrustAtPitch.toFixed(1)}/100.`
                        : ""}
                      {" "}A suggested idea is not an acceptance or a booked outcome.
                    </p>
                  ) : null}
                  {conversation.promise ? (
                    <p className="body-copy" style={{ borderTop: "1px solid #354459", paddingTop: 12 }}>
                      <strong>Booking promise: {conversation.promise.status.replaceAll("_", " ").toLowerCase()}.</strong>{" "}
                      Featured match due by Year {conversation.promise.dueDate.year}, Week {conversation.promise.dueDate.week}.
                      {conversation.promise.fulfilledEventId ? " Delivered through completed show results." : ""}
                      {conversation.promise.status === "NOT_DELIVERED" ? " No suitable featured match was completed in that window." : ""}
                      {conversation.promise.status === "NO_OPPORTUNITY" ? " No promotion show took place in that window." : ""}
                      {conversation.promise.status === "EXCUSED" ? " The missed commitment was excused due to circumstances outside normal booking control." : ""}
                      {conversation.promise.consequence
                        ? <span style={{ display: "block", marginTop: 8 }}>
                            <strong>Follow-through:</strong>{" "}
                            {conversation.promise.consequence.reason.replaceAll("_", " ").toLowerCase()} ·
                            Trust {conversation.promise.consequence.trustDelta > 0 ? "+" : ""}
                            {conversation.promise.consequence.trustDelta} · Morale{" "}
                            {conversation.promise.consequence.moraleDelta > 0 ? "+" : ""}
                            {conversation.promise.consequence.moraleDelta}.
                          </span> : null}
                    </p>
                  ) : null}
                  {conversation.status === "NOTED" ? (
                    <p className="muted body-copy">Good news noted in your Backstage history. You can carry on booking as normal.</p>
                  ) : conversation.status === "OPEN" ? (
                    <div style={{ display: "grid", gap: 10, marginTop: 14 }}>
                      {replies.map((reply) => (
                        <button key={reply.value} type="button"
                          disabled={!view.canRespond || busyId !== null
                            || (reply.value === "PROMISE_FEATURED_BOOKING" && !conversation.canPromiseFeaturedBooking)}
                          onClick={() => setChoices((current) => ({ ...current, [conversation.conversationId]: reply.value }))}
                          style={{ textAlign: "left", padding: 14, borderRadius: 12,
                            border: selected === reply.value ? "2px solid #5de9ce" : "1px solid #354459",
                            background: selected === reply.value ? "#142c2c" : "#0c151f", color: "inherit" }}>
                          <strong>{selected === reply.value ? "◉ " : "○ "}{reply.label}</strong>
                          <span className="muted micro-copy" style={{ display: "block", marginTop: 5 }}>{reply.detail}</span>
                          {reply.value === "PROMISE_FEATURED_BOOKING" && !conversation.canPromiseFeaturedBooking
                            ? <span className="muted micro-copy" style={{ display: "block" }}>Not available: an eligible contract and future date are required.</span>
                            : null}
                        </button>
                      ))}
                      <button className="primary-button" type="button" disabled={!view.canRespond || busyId !== null
                        || (selected === "PROMISE_FEATURED_BOOKING" && !conversation.canPromiseFeaturedBooking)}
                        onClick={() => void respond(conversation.conversationId, selected)}>
                        {busyId === conversation.conversationId ? "Recording…" : "Confirm response"}
                      </button>
                    </div>
                  ) : (
                    <p className="muted body-copy">You responded: {REPLIES.find((reply) => reply.value === conversation.response)?.label ?? "Response recorded"}.
                      This conversation is now part of your promotion history. {pitch ? "No team has been created automatically."
                        : rivalry ? "No Programme has been created automatically."
                        : gimmick ? "Their existing gimmick is unchanged until you edit it."
                        : working ? "Your choice was recorded. Future wrestling remains yours to book." : ""}</p>
                  )}
                </article>
              );
            })}
          </div>
        </section>
      ) : null}
    </main>
  );
}
