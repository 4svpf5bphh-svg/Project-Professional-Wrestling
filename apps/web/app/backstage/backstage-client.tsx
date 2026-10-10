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
          Wrestlers can raise concerns about their treatment. Your decisions are recorded, but this first version does not change morale or contractual terms.
          Booking outcomes remain yours to script. Explicit booking promises are checked against completed matches, with no automatic morale or trust penalties yet.
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
              const selected = choices[conversation.conversationId] ?? "HEAR_OUT";
              return (
                <article className="choice-card" key={conversation.conversationId}>
                  <div className="choice-card-top">
                    <div>
                      <span className="eyebrow">{conversation.status === "OPEN" ? "WANTS A WORD" : "CONVERSATION RECORDED"}</span>
                      <h3>{conversation.wrestlerName}</h3>
                    </div>
                    <span className="revision">Y{conversation.createdDate.year} W{conversation.createdDate.week}</span>
                  </div>
                  <p className="body-copy">
                    I signed for a {roleLabel(conversation.promisedRole)} role, but I've worked {conversation.observedMatchShows} matches
                    without being given that featured position. I'd like to understand where I stand.
                  </p>
                  <p className="muted micro-copy">Contract role: {roleLabel(conversation.promisedRole)} · Last {conversation.observedMatchShows} completed in-ring appearances were not in that position</p>
                  {conversation.promise ? (
                    <p className="body-copy" style={{ borderTop: "1px solid #354459", paddingTop: 12 }}>
                      <strong>Booking promise: {conversation.promise.status.replaceAll("_", " ").toLowerCase()}.</strong>{" "}
                      Featured match due by Year {conversation.promise.dueDate.year}, Week {conversation.promise.dueDate.week}.
                      {conversation.promise.fulfilledEventId ? " Delivered through completed show results." : ""}
                      {conversation.promise.status === "NOT_DELIVERED" ? " No suitable featured match was completed in that window." : ""}
                      {conversation.promise.status === "NO_OPPORTUNITY" ? " No promotion show took place in that window." : ""}
                    </p>
                  ) : null}
                  {conversation.status === "OPEN" ? (
                    <div style={{ display: "grid", gap: 10, marginTop: 14 }}>
                      {REPLIES.map((reply) => (
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
                      This conversation is now part of your promotion history.</p>
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
