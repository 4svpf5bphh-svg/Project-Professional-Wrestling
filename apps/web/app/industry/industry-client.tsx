"use client";

import { useEffect, useMemo, useState } from "react";
import type {
  PlayerIndustryPromotionView,
  PlayerIndustryView,
} from "../../../../dist/packages/application/src/industry-view.js";
import styles from "./industry.module.css";

type ErrorPayload = { error?: string };
type TierFilter = "ALL" | PlayerIndustryPromotionView["tier"];

function isErrorPayload(payload: PlayerIndustryView | ErrorPayload): payload is ErrorPayload {
  return "error" in payload;
}

function label(value: string): string {
  return value.replaceAll("_", " ");
}

function ppwDate(date: { year: number; week: number }): string {
  return `Y${date.year} W${date.week}`;
}

function integer(value: number): string {
  return new Intl.NumberFormat("en-GB", { maximumFractionDigits: 0 }).format(value);
}

function decimal(value: number): string {
  return new Intl.NumberFormat("en-GB", { maximumFractionDigits: 1 }).format(value);
}

function standingAverage(promotion: PlayerIndustryPromotionView): number | null {
  if (!promotion.standing) return null;
  return (
    promotion.standing.prestige
    + promotion.standing.fanReputation
    + promotion.standing.businessReputation
    + promotion.standing.talentReputation
  ) / 4;
}

export default function IndustryClient(): React.JSX.Element {
  const [view, setView] = useState<PlayerIndustryView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [tier, setTier] = useState<TierFilter>("ALL");

  async function refresh(): Promise<void> {
    setError(null);
    const response = await fetch("/api/industry", { cache: "no-store" });
    const payload = await response.json() as PlayerIndustryView | ErrorPayload;
    if (!response.ok || isErrorPayload(payload)) {
      throw new Error(isErrorPayload(payload) && payload.error ? payload.error : "Unable to load Industry");
    }
    setView(payload);
  }

  useEffect(() => {
    refresh().catch((reason: unknown) => {
      setError(reason instanceof Error ? reason.message : "Unable to load Industry");
    });
  }, []);

  const visible = useMemo(() => {
    if (!view) return [];
    const normalized = query.trim().toLowerCase();
    return view.promotions.filter((promotion) => {
      if (tier !== "ALL" && promotion.tier !== tier) return false;
      if (!normalized) return true;
      return promotion.name.toLowerCase().includes(normalized)
        || promotion.homeMarketName.toLowerCase().includes(normalized)
        || promotion.featuredTalent.some((person) => person.name.toLowerCase().includes(normalized));
    });
  }, [query, tier, view]);

  if (!view) {
    return (
      <main className={styles.shell}>
        <a className={styles.backLink} href="/results">← Results & history</a>
        <section className={styles.panel}>
          <p>{error ?? "Loading the PPW industry…"}</p>
          {error ? <button className={styles.button} onClick={() => refresh().catch(() => undefined)}>Retry</button> : null}
        </section>
      </main>
    );
  }

  return (
    <main className={styles.shell}>
      <header className={styles.header}>
        <div>
          <a className={styles.backLink} href="/results">← Results & history</a>
          <div className={styles.eyebrow}>INDUSTRY</div>
          <h1>The PPW world</h1>
          <p>{view.world.name} · Year {view.world.currentDate.year}, Week {view.world.currentDate.week}</p>
        </div>
        <button className={styles.button} onClick={() => refresh().catch((reason: unknown) => setError(reason instanceof Error ? reason.message : "Unable to refresh"))}>Refresh</button>
      </header>

      {error ? <div className={styles.error}>{error}</div> : null}

      <section className={styles.intro}>
        <div><span>Promotions</span><strong>{view.promotions.length}</strong></div>
        <div><span>Active rankings</span><strong>{view.promotions.filter((promotion) => promotion.worldRank !== null).length}</strong></div>
        <div><span>Your company</span><strong>{view.promotions.find((promotion) => promotion.isPlayerPromotion)?.name ?? "Not claimed"}</strong></div>
      </section>

      <section className={styles.filters}>
        <label>
          <span>Search promotions, markets or featured talent</span>
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search Industry" />
        </label>
        <label>
          <span>Tier</span>
          <select value={tier} onChange={(event) => setTier(event.target.value as TierFilter)}>
            <option value="ALL">All tiers</option>
            <option value="GLOBAL">Global</option>
            <option value="NATIONAL">National</option>
            <option value="RISING">Rising</option>
            <option value="INDEPENDENT">Independent</option>
            <option value="LOCAL">Local</option>
          </select>
        </label>
      </section>

      <section className={styles.list}>
        {visible.map((promotion) => {
          const average = standingAverage(promotion);
          return (
            <details className={`${styles.promotionCard} ${promotion.isPlayerPromotion ? styles.ours : ""}`} key={promotion.promotionId}>
              <summary className={styles.summary}>
                <div className={styles.rank}>{promotion.worldRank === null ? "—" : `#${promotion.worldRank}`}</div>
                <div className={styles.identity}>
                  <div className={styles.nameLine}>
                    <strong>{promotion.name}</strong>
                    {promotion.isPlayerPromotion ? <span className={styles.you}>YOU</span> : null}
                  </div>
                  <span>{label(promotion.tier)} · {promotion.homeMarketName} · {label(promotion.lifecycle)}</span>
                </div>
                <div className={styles.score}>
                  <strong>{average === null ? "—" : Math.round(average)}</strong>
                  <span>standing</span>
                </div>
              </summary>

              <div className={styles.body}>
                <section>
                  <div className={styles.sectionTitle}><span>COMPANY STANDING</span><b>{promotion.rosterSize} wrestlers</b></div>
                  {promotion.standing ? (
                    <div className={styles.metrics}>
                      <div><span>Prestige</span><strong>{Math.round(promotion.standing.prestige)}</strong></div>
                      <div><span>Fans</span><strong>{Math.round(promotion.standing.fanReputation)}</strong></div>
                      <div><span>Business</span><strong>{Math.round(promotion.standing.businessReputation)}</strong></div>
                      <div><span>Talent</span><strong>{Math.round(promotion.standing.talentReputation)}</strong></div>
                    </div>
                  ) : <p className={styles.muted}>No standing record yet.</p>}
                </section>

                <section>
                  <div className={styles.sectionTitle}><span>FEATURED TALENT</span><b>public roster view</b></div>
                  <div className={styles.talentGrid}>
                    {promotion.featuredTalent.map((person) => (
                      <a href={`/talent/profile?personId=${encodeURIComponent(person.personId)}`} className={styles.talent} key={person.personId}>
                        <strong>{person.name}</strong>
                        <span>{label(person.careerStage)} · POP {Math.round(person.popularity)} · REC {Math.round(person.recognition)}</span>
                      </a>
                    ))}
                    {promotion.featuredTalent.length === 0 ? <p className={styles.muted}>No active roster talent to show.</p> : null}
                  </div>
                </section>

                <section>
                  <div className={styles.sectionTitle}><span>CHAMPIONSHIPS</span><b>{promotion.championships.length}</b></div>
                  <div className={styles.stack}>
                    {promotion.championships.map((title) => (
                      <article className={styles.row} key={title.championshipId}>
                        <div><strong>{title.name}</strong><span>{label(title.division)}</span></div>
                        <div className={styles.right}><b>{title.holderName ?? "Vacant"}</b>{title.reignStartDate ? <span>{title.defenses} def. · since {ppwDate(title.reignStartDate)}</span> : null}</div>
                      </article>
                    ))}
                    {promotion.championships.length === 0 ? <p className={styles.muted}>No active championships.</p> : null}
                  </div>
                </section>

                <section>
                  <div className={styles.sectionTitle}><span>RECENT SHOWS</span><b>public results</b></div>
                  <div className={styles.stack}>
                    {promotion.recentShows.map((show) => (
                      <article className={styles.row} key={show.eventId}>
                        <div><strong>{label(show.type)} · {ppwDate(show.date)}</strong><span>{show.venueName} · {show.marketName}</span></div>
                        <div className={styles.right}><b>{integer(show.attendance)} attendance</b><span>{decimal(show.averageMatchRating)}★ avg · {decimal(show.bestMatchRating)}★ best · crowd {Math.round(show.crowdResponse)}</span></div>
                      </article>
                    ))}
                    {promotion.recentShows.length === 0 ? <p className={styles.muted}>No completed shows yet.</p> : null}
                  </div>
                </section>
              </div>
            </details>
          );
        })}
        {visible.length === 0 ? <section className={styles.panel}>No promotions match those filters.</section> : null}
      </section>

      <p className={styles.privacy}>Industry shows public competitive information only. Rival salaries, bonuses, cash, debt, private planning and internal wrestler condition remain hidden.</p>
    </main>
  );
}
