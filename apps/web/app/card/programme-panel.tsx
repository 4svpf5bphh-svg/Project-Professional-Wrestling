"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type {
  AlphaProgrammeContextView,
  AlphaProgrammeView,
} from "../../../../dist/packages/web-adapter/src/programme-service.js";
import styles from "./programme-panel.module.css";

type ErrorPayload = { error?: string };

function isErrorPayload(payload: AlphaProgrammeContextView | ErrorPayload): payload is ErrorPayload {
  return "error" in payload;
}

function requestedDraftId(): string | null {
  if (typeof window === "undefined") return null;
  const value = new URLSearchParams(window.location.search).get("draftId")?.trim() ?? "";
  return value || null;
}

function programmeAge(programme: AlphaProgrammeView, year: number, week: number): string {
  const weeks = Math.max(0, ((year - programme.startedYear) * 52) + (week - programme.startedWeek));
  if (weeks === 0) return "Started this week";
  return `${weeks} week${weeks === 1 ? "" : "s"} active`;
}

export default function ProgrammePanel(): React.JSX.Element | null {
  const [view, setView] = useState<AlphaProgrammeContextView | null>(null);
  const [sideA1, setSideA1] = useState("");
  const [sideA2, setSideA2] = useState("");
  const [sideB1, setSideB1] = useState("");
  const [sideB2, setSideB2] = useState("");
  const [championshipId, setChampionshipId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const requestId = useRef<string | null>(null);

  async function load(): Promise<void> {
    setLoading(true);
    setError(null);
    try {
      const draftId = requestedDraftId();
      const endpoint = draftId ? `/api/programmes?draftId=${encodeURIComponent(draftId)}` : "/api/programmes";
      const response = await fetch(endpoint, { cache: "no-store" });
      const payload = await response.json() as AlphaProgrammeContextView | ErrorPayload;
      if (!response.ok || isErrorPayload(payload)) {
        throw new Error(isErrorPayload(payload) && payload.error ? payload.error : "Unable to load Programmes");
      }
      setView(payload);
      setSideA1((current) => current || payload.participants[0]?.personId || "");
      setSideB1((current) => current || payload.participants[1]?.personId || "");
      requestId.current = null;
    } catch (reason) {
      setView(null);
      setError(reason instanceof Error ? reason.message : "Unable to load Programmes");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load().catch(() => undefined);
  }, []);

  const chosen = useMemo(() => new Set([sideA1, sideA2, sideB1, sideB2].filter(Boolean)), [sideA1, sideA2, sideB1, sideB2]);
  const sideAIds = [sideA1, sideA2].filter(Boolean);
  const sideBIds = [sideB1, sideB2].filter(Boolean);
  const canStart = Boolean(view?.canEdit && sideAIds.length > 0 && sideBIds.length > 0 && chosen.size === sideAIds.length + sideBIds.length);

  function optionUnavailable(personId: string, current: string): boolean {
    return personId !== current && chosen.has(personId);
  }

  async function startProgramme(): Promise<void> {
    if (!view || !canStart || starting) return;
    setStarting(true);
    setError(null);
    if (!requestId.current) requestId.current = crypto.randomUUID();
    try {
      const response = await fetch("/api/programmes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requestId: requestId.current,
          expectedRevision: view.world.revision,
          draftId: view.draftId,
          sideAIds,
          sideBIds,
          championshipId: championshipId || null,
        }),
      });
      const payload = await response.json() as AlphaProgrammeContextView | ErrorPayload;
      if (!response.ok || isErrorPayload(payload)) {
        const message = isErrorPayload(payload) && payload.error ? payload.error : "Unable to start Programme";
        if (message.includes("stale World revision")) {
          requestId.current = null;
          await load();
          throw new Error(`${message}. Latest World state loaded.`);
        }
        throw new Error(message);
      }
      setView(payload);
      requestId.current = null;
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to start Programme");
    } finally {
      setStarting(false);
    }
  }

  if (loading) {
    return (
      <section className={styles.shell} aria-label="Programmes">
        <div className={styles.panel}><span className="muted">Loading active Programmes…</span></div>
      </section>
    );
  }

  if (!view) {
    return error ? (
      <section className={styles.shell} aria-label="Programmes">
        <div className={styles.error}>{error}</div>
      </section>
    ) : null;
  }

  const participantOptions = (current: string) => view.participants.map((person) => (
    <option
      key={person.personId}
      value={person.personId}
      disabled={optionUnavailable(person.personId, current)}
    >
      {person.name}{optionUnavailable(person.personId, current) ? " — already selected" : ""}
    </option>
  ));

  return (
    <section className={styles.shell} aria-label="Programmes">
      <div className={styles.panel}>
        <div className={styles.heading}>
          <div>
            <span className="eyebrow">PROGRAMMES</span>
            <h2>Stories in motion</h2>
          </div>
          <span className={styles.count}>{view.programmes.length} active</span>
        </div>
        <p className="muted body-copy">A Programme is PPW&apos;s ongoing story between wrestlers. Start one from talent reserved for this show; the World will remember it beyond a single match.</p>

        {view.programmes.length > 0 ? (
          <div className={styles.programmeList}>
            {view.programmes.map((programme) => (
              <article className={styles.programme} key={programme.programmeId}>
                <div className={styles.programmeTitle}>
                  <strong>{programme.sideA.label}</strong>
                  <span>vs</span>
                  <strong>{programme.sideB.label}</strong>
                </div>
                <div className={styles.meta}>
                  <span>{programmeAge(programme, view.world.year, view.world.week)}</span>
                  {programme.championshipName ? <span>{programme.championshipName}</span> : null}
                  <span>{programme.activityCount} beat{programme.activityCount === 1 ? "" : "s"}</span>
                  <span>{programme.matchCount} match{programme.matchCount === 1 ? "" : "es"}</span>
                </div>
                <div className={styles.signals}>
                  <span>Heat: {programme.heat === null ? "not established" : Math.round(programme.heat)}</span>
                  <span>Repetition: {Math.round(programme.repetition)}</span>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className={styles.empty}>No active Programme currently involves talent reserved for this show.</div>
        )}

        <div className={styles.creator}>
          <div className={styles.creatorHeading}>
            <strong>Start a Programme</strong>
            <span>2–4 wrestlers</span>
          </div>
          <div className={styles.sides}>
            <div className={styles.side}>
              <label>Side A</label>
              <select value={sideA1} disabled={!view.canEdit || starting} onChange={(event) => { setSideA1(event.target.value); requestId.current = null; }}>
                <option value="">Choose wrestler</option>
                {participantOptions(sideA1)}
              </select>
              <select value={sideA2} disabled={!view.canEdit || starting} onChange={(event) => { setSideA2(event.target.value); requestId.current = null; }}>
                <option value="">Optional second wrestler</option>
                {participantOptions(sideA2)}
              </select>
            </div>
            <div className={styles.vs}>VS</div>
            <div className={styles.side}>
              <label>Side B</label>
              <select value={sideB1} disabled={!view.canEdit || starting} onChange={(event) => { setSideB1(event.target.value); requestId.current = null; }}>
                <option value="">Choose wrestler</option>
                {participantOptions(sideB1)}
              </select>
              <select value={sideB2} disabled={!view.canEdit || starting} onChange={(event) => { setSideB2(event.target.value); requestId.current = null; }}>
                <option value="">Optional second wrestler</option>
                {participantOptions(sideB2)}
              </select>
            </div>
          </div>
          <label className={styles.titleField}>
            <span>Championship story</span>
            <select value={championshipId} disabled={!view.canEdit || starting} onChange={(event) => { setChampionshipId(event.target.value); requestId.current = null; }}>
              <option value="">No championship attached</option>
              {view.championships.map((championship) => (
                <option key={championship.championshipId} value={championship.championshipId}>
                  {championship.name}
                </option>
              ))}
            </select>
          </label>
          {error ? <div className={styles.error}>{error}</div> : null}
          <button className="primary-button" disabled={!canStart || starting} onClick={() => startProgramme()}>
            {starting ? "Starting…" : "Start Programme"}
          </button>
          {!view.canEdit ? <p className="muted">The World is currently locked; Programme changes reopen with the next planning phase.</p> : null}
        </div>
      </div>
    </section>
  );
}
