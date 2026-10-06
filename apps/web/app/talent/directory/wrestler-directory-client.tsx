"use client";

import { useEffect, useMemo, useState } from "react";
import type { PlayerTalentManagementView } from "../../../../../dist/packages/application/src/talent-view.js";
import styles from "./wrestler-directory.module.css";

type ErrorPayload = { error?: string };

type DirectoryEntry = {
  personId: string;
  name: string;
  careerStage: string;
  popularity: number;
  recognition: number;
  momentum: number;
  status: "YOUR_ROSTER" | "FREE_AGENT" | "NON_EXCLUSIVE";
};

function isErrorPayload(payload: PlayerTalentManagementView | ErrorPayload): payload is ErrorPayload {
  return "error" in payload;
}

function label(value: string): string {
  return value.replaceAll("_", " ");
}

function profileHref(personId: string): string {
  return `/talent/profile?personId=${encodeURIComponent(personId)}&from=directory`;
}

export default function WrestlerDirectoryClient(): React.JSX.Element {
  const [view, setView] = useState<PlayerTalentManagementView | null>(null);
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/talent", { cache: "no-store" })
      .then(async (response) => {
        const payload = await response.json() as PlayerTalentManagementView | ErrorPayload;
        if (!response.ok || isErrorPayload(payload)) {
          throw new Error(isErrorPayload(payload) && payload.error ? payload.error : "Unable to load wrestler directory");
        }
        setView(payload);
      })
      .catch((reason: unknown) => setError(reason instanceof Error ? reason.message : "Unable to load wrestler directory"));
  }, []);

  const entries = useMemo<DirectoryEntry[]>(() => {
    if (!view?.promotion) return [];
    const roster = view.roster.map((person) => ({
      personId: person.personId,
      name: person.name,
      careerStage: person.careerStage,
      popularity: person.popularity,
      recognition: person.recognition,
      momentum: person.momentum,
      status: "YOUR_ROSTER" as const,
    }));
    const market = view.market.map((person) => ({
      personId: person.personId,
      name: person.name,
      careerStage: person.careerStage,
      popularity: person.popularity,
      recognition: person.recognition,
      momentum: person.momentum,
      status: person.availability as "FREE_AGENT" | "NON_EXCLUSIVE",
    }));
    return [...roster, ...market]
      .filter((person, index, all) => all.findIndex((candidate) => candidate.personId === person.personId) === index)
      .sort((left, right) => right.popularity - left.popularity || left.name.localeCompare(right.name));
  }, [view]);

  const visible = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return entries;
    return entries.filter((entry) => entry.name.toLowerCase().includes(normalized));
  }, [entries, query]);

  return (
    <main className={styles.shell}>
      <a className={styles.backLink} href="/talent">← Talent management</a>
      <header className={styles.header}>
        <div>
          <span className={styles.eyebrow}>WRESTLER PROFILES</span>
          <h1>Talent directory</h1>
          <p>{view ? `${view.world.name} · ${view.promotion?.name ?? "No promotion"}` : "Loading your World…"}</p>
        </div>
      </header>

      {error ? <div className={styles.error}>{error}</div> : null}
      {view && !view.promotion ? <section className={styles.panel}>Take control of a promotion before browsing talent profiles.</section> : null}

      {view?.promotion ? (
        <>
          <section className={styles.summary}>
            <div><span>Your roster</span><strong>{view.roster.length}</strong></div>
            <div><span>Open market</span><strong>{view.market.length}</strong></div>
            <div><span>Profiles shown</span><strong>{visible.length}</strong></div>
          </section>
          <label className={styles.search}>
            <span>Search wrestlers currently visible to your promotion</span>
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Wrestler name" />
          </label>
          <section className={styles.list}>
            {visible.map((entry) => (
              <a className={styles.card} href={profileHref(entry.personId)} key={entry.personId}>
                <div>
                  <strong>{entry.name}</strong>
                  <span>{label(entry.careerStage)} · {label(entry.status)}</span>
                </div>
                <div className={styles.metrics}>
                  <span>POP <b>{Math.round(entry.popularity)}</b></span>
                  <span>REC <b>{Math.round(entry.recognition)}</b></span>
                  <span>MOM <b>{Math.round(entry.momentum)}</b></span>
                </div>
              </a>
            ))}
            {visible.length === 0 ? <div className={styles.panel}>No wrestlers match that search.</div> : null}
          </section>
          <p className={styles.note}>This directory intentionally shows your roster and talent currently available to your promotion. Rival-exclusive rosters stay behind the Industry views rather than leaking private labour-market information here.</p>
        </>
      ) : null}
    </main>
  );
}
