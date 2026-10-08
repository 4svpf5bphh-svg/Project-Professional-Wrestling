"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { AlphaProgrammeManagementView } from "../../../../dist/packages/web-adapter/src/programme-management-service.js";
import styles from "./programmes.module.css";

type ErrorPayload = { error?: string };

function isErrorPayload(payload: AlphaProgrammeManagementView | ErrorPayload): payload is ErrorPayload {
  return "error" in payload;
}

function programmeAge(startedYear: number, startedWeek: number, year: number, week: number): string {
  const age = Math.max(0, ((year - startedYear) * 52) + week - startedWeek);
  return age === 0 ? "Started this week" : `${age} week${age === 1 ? "" : "s"} active`;
}

export default function ProgrammesClient(): React.JSX.Element {
  const [view, setView] = useState<AlphaProgrammeManagementView | null>(null);
  const [sideA1, setSideA1] = useState("");
  const [sideA2, setSideA2] = useState("");
  const [sideB1, setSideB1] = useState("");
  const [sideB2, setSideB2] = useState("");
  const [championshipId, setChampionshipId] = useState("");
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestId = useRef<string | null>(null);

  async function load(): Promise<void> {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/programme-management", { cache: "no-store" });
      const payload = await response.json() as AlphaProgrammeManagementView | ErrorPayload;
      if (!response.ok || isErrorPayload(payload)) {
        throw new Error(isErrorPayload(payload) && payload.error ? payload.error : "Unable to load Programmes");
      }
      setView(payload);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to load Programmes");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  const selected = useMemo(
    () => new Set([sideA1, sideA2, sideB1, sideB2].filter(Boolean)),
    [sideA1, sideA2, sideB1, sideB2],
  );
  const canStart = Boolean(
    view?.canEdit
    && sideA1
    && sideB1
    && selected.size === [sideA1, sideA2, sideB1, sideB2].filter(Boolean).length
    && !starting
  );

  function options(current: string): React.JSX.Element[] {
    return (view?.roster ?? []).map((person) => (
      <option key={person.personId} value={person.personId} disabled={selected.has(person.personId) && current !== person.personId}>
        {person.name} · {person.alignment} · POP {Math.round(person.popularity)}
      </option>
    ));
  }

  async function start(): Promise<void> {
    if (!view || !canStart) return;
    if (!requestId.current) requestId.current = crypto.randomUUID();
    setStarting(true);
    setError(null);
    try {
      const response = await fetch("/api/programme-management", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requestId: requestId.current,
          expectedRevision: view.world.revision,
          sideAIds: [sideA1, sideA2].filter(Boolean),
          sideBIds: [sideB1, sideB2].filter(Boolean),
          championshipId: championshipId || null,
        }),
      });
      const payload = await response.json() as AlphaProgrammeManagementView | ErrorPayload;
      if (!response.ok || isErrorPayload(payload)) {
        throw new Error(isErrorPayload(payload) && payload.error ? payload.error : "Unable to start Programme");
      }
      setView(payload);
      setSideA1("");
      setSideA2("");
      setSideB1("");
      setSideB2("");
      setChampionshipId("");
      requestId.current = null;
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to start Programme");
    } finally {
      setStarting(false);
    }
  }

  return (
    <main className={styles.shell}>
      <a className={styles.backLink} href="/planner">← Shows</a>
      <header className={styles.header}>
        <div>
          <span className={styles.eyebrow}>PLAN · PROGRAMMES</span>
          <h1>{view?.promotion.name ?? "Programmes"}</h1>
          <p>{view ? `Year ${view.world.year} · Week ${view.world.week}` : "Loading ongoing stories…"}</p>
        </div>
        <button className={styles.button} disabled={loading || starting} onClick={() => void load()}>{loading ? "Loading…" : "Refresh"}</button>
      </header>

      {error ? <div className={styles.error}>{error}</div> : null}

      {view ? (
        <>
          <section className={styles.panel}>
            <div className={styles.sectionHeading}>
              <div><span className={styles.eyebrow}>STORIES IN MOTION</span><h2>Active Programmes</h2></div>
              <strong>{view.programmes.length}</strong>
            </div>
            {view.programmes.length > 0 ? (
              <div className={styles.programmeList}>
                {view.programmes.map((programme) => (
                  <article className={styles.programme} key={programme.programmeId}>
                    <div className={styles.matchup}><strong>{programme.sideA.label}</strong><span>vs</span><strong>{programme.sideB.label}</strong></div>
                    <div className={styles.meta}>
                      <span>{programmeAge(programme.startedYear, programme.startedWeek, view.world.year, view.world.week)}</span>
                      {programme.championshipName ? <span>{programme.championshipName}</span> : null}
                      <span>{programme.activityCount} beats</span>
                    </div>
                    <div className={styles.signals}>
                      <div><span>Heat</span><strong>{programme.heat === null ? "—" : Math.round(programme.heat)}</strong></div>
                      <div><span>Repetition</span><strong>{Math.round(programme.repetition)}</strong></div>
                      <div><span>Matches</span><strong>{programme.matchCount}</strong></div>
                      <div><span>Segments</span><strong>{programme.segmentCount}</strong></div>
                    </div>
                  </article>
                ))}
              </div>
            ) : <p className={styles.empty}>No active Programme yet. Start one below; you can then advance it through matches and segments while booking shows.</p>}
          </section>

          <section className={styles.panel}>
            <span className={styles.eyebrow}>START STORY</span>
            <h2>New Programme</h2>
            <p className={styles.note}>Create the ongoing rivalry here, independently of any one show. Two to four rostered wrestlers can be involved.</p>
            <div className={styles.sides}>
              <div>
                <label>Side A</label>
                <select value={sideA1} onChange={(event) => { setSideA1(event.target.value); requestId.current = null; }} disabled={!view.canEdit || starting}>
                  <option value="">Choose wrestler</option>{options(sideA1)}
                </select>
                <select value={sideA2} onChange={(event) => { setSideA2(event.target.value); requestId.current = null; }} disabled={!view.canEdit || starting}>
                  <option value="">Optional second wrestler</option>{options(sideA2)}
                </select>
              </div>
              <b>VS</b>
              <div>
                <label>Side B</label>
                <select value={sideB1} onChange={(event) => { setSideB1(event.target.value); requestId.current = null; }} disabled={!view.canEdit || starting}>
                  <option value="">Choose wrestler</option>{options(sideB1)}
                </select>
                <select value={sideB2} onChange={(event) => { setSideB2(event.target.value); requestId.current = null; }} disabled={!view.canEdit || starting}>
                  <option value="">Optional second wrestler</option>{options(sideB2)}
                </select>
              </div>
            </div>
            <label className={styles.titleField}>
              <span>Championship story</span>
              <select value={championshipId} onChange={(event) => { setChampionshipId(event.target.value); requestId.current = null; }} disabled={!view.canEdit || starting}>
                <option value="">No championship attached</option>
                {view.championships.map((championship) => <option key={championship.championshipId} value={championship.championshipId}>{championship.name}</option>)}
              </select>
            </label>
            <button className={styles.primary} disabled={!canStart} onClick={() => void start()}>{starting ? "Starting…" : "Start Programme"}</button>
          </section>
        </>
      ) : null}
    </main>
  );
}
