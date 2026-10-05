"use client";

import { useEffect, useMemo, useState } from "react";
import type {
  PlayerChampionshipHistoryView,
  PlayerChampionshipLineageView,
  PlayerChampionshipReignView,
} from "../../../../dist/packages/application/src/championship-history-view.js";
import styles from "./championships.module.css";

type ErrorPayload = { error?: string };
type StatusFilter = "ALL" | PlayerChampionshipLineageView["status"];

function isErrorPayload(payload: PlayerChampionshipHistoryView | ErrorPayload): payload is ErrorPayload {
  return "error" in payload;
}

function label(value: string): string {
  return value.replaceAll("_", " ");
}

function ppwDate(date: { year: number; week: number; day: number }): string {
  return `Y${date.year} W${date.week}`;
}

function reignStatus(reign: PlayerChampionshipReignView): string {
  if (reign.isCurrent) return "CURRENT REIGN";
  if (reign.endReason) return label(reign.endReason);
  return label(reign.status);
}

export default function ChampionshipsClient(): React.JSX.Element {
  const [view, setView] = useState<PlayerChampionshipHistoryView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<StatusFilter>("ALL");

  async function refresh(): Promise<void> {
    setError(null);
    const response = await fetch("/api/championships", { cache: "no-store" });
    const payload = await response.json() as PlayerChampionshipHistoryView | ErrorPayload;
    if (!response.ok || isErrorPayload(payload)) {
      throw new Error(isErrorPayload(payload) && payload.error ? payload.error : "Unable to load championship history");
    }
    setView(payload);
  }

  useEffect(() => {
    refresh().catch((reason: unknown) => {
      setError(reason instanceof Error ? reason.message : "Unable to load championship history");
    });
  }, []);

  const visible = useMemo(() => {
    if (!view) return [];
    const normalized = query.trim().toLowerCase();
    return view.championships.filter((championship) => {
      if (status !== "ALL" && championship.status !== status) return false;
      if (!normalized) return true;
      return championship.name.toLowerCase().includes(normalized)
        || championship.promotionName.toLowerCase().includes(normalized)
        || championship.currentHolderName?.toLowerCase().includes(normalized)
        || championship.lineage.some((reign) => reign.holderName.toLowerCase().includes(normalized));
    });
  }, [query, status, view]);

  if (!view) {
    return (
      <main className={styles.shell}>
        <a className={styles.backLink} href="/industry">← Industry</a>
        <section className={styles.panel}>
          <p>{error ?? "Loading championship history…"}</p>
          {error ? <button className={styles.button} onClick={() => refresh().catch(() => undefined)}>Retry</button> : null}
        </section>
      </main>
    );
  }

  const activeCount = view.championships.filter((championship) => championship.status === "ACTIVE").length;
  const reignCount = view.championships.reduce((total, championship) => total + championship.totalReigns, 0);

  return (
    <main className={styles.shell}>
      <header className={styles.header}>
        <div>
          <a className={styles.backLink} href="/industry">← Industry</a>
          <div className={styles.eyebrow}>WORLD HISTORY</div>
          <h1>Championship lineage</h1>
          <p>{view.world.name} · Year {view.world.currentDate.year}, Week {view.world.currentDate.week}</p>
        </div>
        <button className={styles.button} onClick={() => refresh().catch((reason: unknown) => setError(reason instanceof Error ? reason.message : "Unable to refresh"))}>Refresh</button>
      </header>

      {error ? <div className={styles.error}>{error}</div> : null}

      <section className={styles.intro}>
        <div><span>Championships</span><strong>{view.championships.length}</strong></div>
        <div><span>Active titles</span><strong>{activeCount}</strong></div>
        <div><span>Recorded reigns</span><strong>{reignCount}</strong></div>
      </section>

      <section className={styles.filters}>
        <label>
          <span>Search title, promotion or champion</span>
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search championship history" />
        </label>
        <label>
          <span>Status</span>
          <select value={status} onChange={(event) => setStatus(event.target.value as StatusFilter)}>
            <option value="ALL">All titles</option>
            <option value="ACTIVE">Active</option>
            <option value="INACTIVE">Inactive</option>
          </select>
        </label>
      </section>

      <section className={styles.list}>
        {visible.map((championship) => (
          <details className={styles.titleCard} key={championship.championshipId}>
            <summary className={styles.summary}>
              <div className={styles.identity}>
                <div className={styles.nameLine}>
                  <strong>{championship.name}</strong>
                  <span className={`${styles.status} ${championship.status === "ACTIVE" ? styles.active : styles.inactive}`}>{label(championship.status)}</span>
                </div>
                <span>{championship.promotionName} · {label(championship.division)} · Prestige {Math.round(championship.prestige)}</span>
              </div>
              <div className={styles.current}>
                <strong>{championship.currentHolderName ?? "Vacant / inactive"}</strong>
                <span>{championship.totalReigns} reign{championship.totalReigns === 1 ? "" : "s"} · {championship.totalDefenses} defenses</span>
              </div>
            </summary>

            <div className={styles.body}>
              <div className={styles.meta}>
                <span>Created {ppwDate(championship.createdDate)}</span>
                <span>{championship.lineage.length === 0 ? "No reigns recorded yet" : `${championship.lineage.length} reigns in lineage`}</span>
              </div>

              <section className={styles.reignList}>
                {championship.lineage.map((reign) => (
                  <article className={`${styles.reign} ${reign.isCurrent ? styles.currentReign : ""}`} key={reign.reignId}>
                    <div className={styles.holder}>
                      {reign.holderType === "PERSON" ? (
                        <a href={`/talent/profile?personId=${encodeURIComponent(reign.holderId)}`}>{reign.holderName}</a>
                      ) : (
                        <a href={`/teams?teamId=${encodeURIComponent(reign.holderId)}`}>{reign.holderName}</a>
                      )}
                      <span>{label(reign.holderType)}</span>
                    </div>
                    <div className={styles.reignDetail}>
                      <strong>{reignStatus(reign)}</strong>
                      <span>{ppwDate(reign.startDate)} → {reign.endDate ? ppwDate(reign.endDate) : "present"}</span>
                      <span>{reign.defenses} defense{reign.defenses === 1 ? "" : "s"}</span>
                    </div>
                  </article>
                ))}
                {championship.lineage.length === 0 ? <p className={styles.muted}>No championship reigns have been recorded for this title.</p> : null}
              </section>
            </div>
          </details>
        ))}
        {visible.length === 0 ? <section className={styles.panel}>No championships match those filters.</section> : null}
      </section>

      <p className={styles.privacy}>Championship lineage is shared wrestling history. Rival finances, contract terms, internal condition, offers and future booking remain private.</p>
    </main>
  );
}
