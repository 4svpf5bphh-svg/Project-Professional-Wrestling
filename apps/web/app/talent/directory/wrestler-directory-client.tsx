"use client";

import { useEffect, useMemo, useState } from "react";
import type {
  PlayerTalentDirectoryEntryView,
  PlayerTalentDirectoryStatus,
  PlayerTalentDirectoryView,
} from "../../../../../dist/packages/application/src/talent-view.js";
import type { AlphaTalentWatchResult } from "../../../../../dist/packages/web-adapter/src/talent-service.js";
import styles from "./wrestler-directory.module.css";

type ErrorPayload = { error?: string };
type DivisionFilter = "ALL" | "MEN" | "WOMEN";
type StatusFilter = "ALL" | PlayerTalentDirectoryStatus;

function isErrorPayload(payload: PlayerTalentDirectoryView | AlphaTalentWatchResult | ErrorPayload): payload is ErrorPayload {
  return "error" in payload;
}

function label(value: string): string {
  return value.replaceAll("_", " ");
}

function statusLabel(value: PlayerTalentDirectoryStatus): string {
  if (value === "YOUR_ROSTER") return "Your roster";
  if (value === "FREE_AGENT") return "Free agent";
  if (value === "NON_EXCLUSIVE") return "Non-exclusive";
  if (value === "EXCLUSIVE") return "Exclusive";
  return "Retired";
}

function profileHref(personId: string): string {
  return `/talent/profile?personId=${encodeURIComponent(personId)}&from=directory`;
}

function publicHome(entry: PlayerTalentDirectoryEntryView): string {
  return entry.rosterAffiliations[0]?.promotionName
    ?? entry.employmentPromotions[0]?.promotionName
    ?? (entry.directoryStatus === "RETIRED" ? "Retired" : "Free agent");
}

export default function WrestlerDirectoryClient(): React.JSX.Element {
  const [view, setView] = useState<PlayerTalentDirectoryView | null>(null);
  const [query, setQuery] = useState("");
  const [division, setDivision] = useState<DivisionFilter>("ALL");
  const [status, setStatus] = useState<StatusFilter>("ALL");
  const [promotion, setPromotion] = useState("ALL");
  const [watchOnly, setWatchOnly] = useState(false);
  const [limit, setLimit] = useState(25);
  const [watchSaving, setWatchSaving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/talent/directory", { cache: "no-store" })
      .then(async (response) => {
        const payload = await response.json() as PlayerTalentDirectoryView | ErrorPayload;
        if (!response.ok || isErrorPayload(payload)) {
          throw new Error(isErrorPayload(payload) && payload.error ? payload.error : "Unable to load wrestler directory");
        }
        setView(payload);
      })
      .catch((reason: unknown) => setError(reason instanceof Error ? reason.message : "Unable to load wrestler directory"));
  }, []);

  const promotions = useMemo(() => {
    const names = new Set<string>();
    for (const entry of view?.entries ?? []) {
      for (const affiliation of entry.rosterAffiliations) names.add(affiliation.promotionName);
      for (const employer of entry.employmentPromotions) names.add(employer.promotionName);
    }
    return [...names].sort((left, right) => left.localeCompare(right));
  }, [view]);

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return (view?.entries ?? [])
      .filter((entry) => !normalized || entry.name.toLowerCase().includes(normalized))
      .filter((entry) => division === "ALL" || entry.division === division)
      .filter((entry) => status === "ALL" || entry.directoryStatus === status)
      .filter((entry) => !watchOnly || entry.watched)
      .filter((entry) => {
        if (promotion === "ALL") return true;
        return entry.rosterAffiliations.some((item) => item.promotionName === promotion)
          || entry.employmentPromotions.some((item) => item.promotionName === promotion);
      });
  }, [view, query, division, status, promotion, watchOnly]);

  useEffect(() => {
    setLimit(25);
  }, [query, division, status, promotion, watchOnly]);

  const visible = filtered.slice(0, limit);

  async function changeWatch(entry: PlayerTalentDirectoryEntryView): Promise<void> {
    if (watchSaving || entry.directoryStatus === "RETIRED") return;
    setWatchSaving(entry.personId);
    setError(null);
    try {
      const response = await fetch("/api/talent", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          personId: entry.personId,
          watched: !entry.watched,
        }),
      });
      const payload = await response.json() as AlphaTalentWatchResult | ErrorPayload;
      if (!response.ok || isErrorPayload(payload)) {
        throw new Error(isErrorPayload(payload) && payload.error ? payload.error : "Unable to update Watchlist");
      }
      setView((current) => current ? {
        ...current,
        entries: current.entries.map((candidate) => (
          candidate.personId === entry.personId
            ? { ...candidate, watched: payload.watched }
            : candidate
        )),
      } : current);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to update Watchlist");
    } finally {
      setWatchSaving(null);
    }
  }

  return (
    <main className={styles.shell}>
      <a className={styles.backLink} href="/talent">← Talent management</a>
      <header className={styles.header}>
        <div>
          <span className={styles.eyebrow}>GLOBAL WRESTLER DIRECTORY</span>
          <h1>World talent</h1>
          <p>{view ? `${view.world.name} · ${view.entries.length} wrestlers` : "Loading your World…"}</p>
        </div>
      </header>

      {error ? <div className={styles.error}>{error}</div> : null}

      {view ? (
        <>
          <section className={styles.toolbar} aria-label="Wrestler directory search and filters">
            <label className={styles.search}>
              <span>Search all wrestlers</span>
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Find wrestler…" />
            </label>

            <div className={styles.divisionToggle} role="group" aria-label="Directory division">
              {(["ALL", "MEN", "WOMEN"] as const).map((candidate) => (
                <button
                  key={candidate}
                  type="button"
                  className={division === candidate ? styles.filterActive : styles.filterButton}
                  onClick={() => setDivision(candidate)}
                >
                  {candidate === "ALL" ? "All" : candidate === "MEN" ? "Men" : "Women"}
                </button>
              ))}
              <button
                type="button"
                aria-pressed={watchOnly}
                className={watchOnly ? styles.watchFilterActive : styles.watchFilter}
                onClick={() => setWatchOnly((current) => !current)}
              >
                ★ Watchlist
              </button>
            </div>

            <div className={styles.selects}>
              <label>
                <span>Status</span>
                <select value={status} onChange={(event) => setStatus(event.target.value as StatusFilter)}>
                  <option value="ALL">All statuses</option>
                  <option value="YOUR_ROSTER">Your roster</option>
                  <option value="FREE_AGENT">Free agents</option>
                  <option value="NON_EXCLUSIVE">Non-exclusive</option>
                  <option value="EXCLUSIVE">Exclusive</option>
                  <option value="RETIRED">Retired</option>
                </select>
              </label>
              <label>
                <span>Promotion</span>
                <select value={promotion} onChange={(event) => setPromotion(event.target.value)}>
                  <option value="ALL">All promotions</option>
                  {promotions.map((name) => <option key={name} value={name}>{name}</option>)}
                </select>
              </label>
            </div>

            <div className={styles.count}>
              Showing <b>{Math.min(limit, filtered.length)}</b> of <b>{filtered.length}</b> matching wrestlers
            </div>
          </section>

          <section className={styles.list} aria-label="Wrestler directory results">
            {visible.map((entry) => (
              <article className={styles.row} key={entry.personId}>
                <a className={styles.profileLink} href={profileHref(entry.personId)}>
                  <div className={styles.identity}>
                    <div className={styles.nameLine}>
                      <strong>{entry.name}</strong>
                      <span className={styles.divisionBadge}>{entry.division === "WOMEN" ? "Women" : "Men"}</span>
                    </div>
                    <span>{publicHome(entry)} · {label(entry.careerStage)}</span>
                  </div>
                  <div className={styles.metrics}>
                    <b>POP {Math.round(entry.popularity)}</b>
                    <span>REC {Math.round(entry.recognition)}</span>
                    <span className={styles.status}>{statusLabel(entry.directoryStatus)}</span>
                  </div>
                </a>
                <button
                  className={entry.watched ? styles.watchButtonActive : styles.watchButton}
                  type="button"
                  disabled={watchSaving === entry.personId || entry.directoryStatus === "RETIRED"}
                  onClick={() => void changeWatch(entry)}
                  aria-label={entry.watched ? `Remove ${entry.name} from Watchlist` : `Add ${entry.name} to Watchlist`}
                >
                  {watchSaving === entry.personId ? "…" : entry.watched ? "★" : "☆"}
                </button>
              </article>
            ))}
            {visible.length === 0 ? <div className={styles.panel}>No wrestlers match those filters.</div> : null}
          </section>

          {visible.length < filtered.length ? (
            <button className={styles.loadMore} type="button" onClick={() => setLimit((current) => current + 25)}>
              Load 25 more · {filtered.length - visible.length} remaining
            </button>
          ) : null}

          <p className={styles.note}>
            Directory is public World information. Rival salaries, dates, bonuses, promised roles, Morale and other private contract details remain hidden.
          </p>
        </>
      ) : null}
    </main>
  );
}
