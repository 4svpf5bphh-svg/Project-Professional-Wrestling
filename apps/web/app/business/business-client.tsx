"use client";

import { useEffect, useState } from "react";
import type { PlayerBusinessView } from "../../../../dist/packages/application/src/business-view.js";
import styles from "./business.module.css";

type ErrorPayload = { error?: string };

function isErrorPayload(payload: PlayerBusinessView | ErrorPayload): payload is ErrorPayload {
  return "error" in payload;
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

function ppwDate(date: { year: number; week: number; day?: number }): string {
  return `Y${date.year} W${date.week}${date.day ? ` · D${date.day}` : ""}`;
}

function label(value: string): string {
  return value.replaceAll("_", " ");
}

export default function BusinessClient(): React.JSX.Element {
  const [view, setView] = useState<PlayerBusinessView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function refresh(): Promise<void> {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/business", { cache: "no-store" });
      const payload = await response.json() as PlayerBusinessView | ErrorPayload;
      if (!response.ok || isErrorPayload(payload)) {
        throw new Error(isErrorPayload(payload) && payload.error ? payload.error : "Unable to load business view");
      }
      setView(payload);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to load business view");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void refresh(); }, []);

  const promotion = view?.promotion ?? null;

  return (
    <main className={styles.shell}>
      <a className={styles.backLink} href="/">← Promotion home</a>
      <header className={styles.header}>
        <div>
          <span className={styles.eyebrow}>BUSINESS</span>
          <h1>{promotion?.name ?? "Promotion business"}</h1>
          <p>{view ? `${view.world.name} · ${ppwDate(view.world.currentDate)}` : "Loading your World…"}</p>
        </div>
        <button className={styles.button} type="button" disabled={loading} onClick={() => void refresh()}>
          {loading ? "Loading…" : "Refresh"}
        </button>
      </header>

      {error ? <div className={styles.error}>{error}</div> : null}
      {view && !promotion ? <section className={styles.panel}><p>Take control of a promotion before opening Business.</p></section> : null}

      {promotion ? (
        <>
          <section className={styles.overview}>
            <div><span>Cash</span><strong>{money(promotion.cash)}</strong></div>
            <div><span>Debt</span><strong>{money(promotion.debt)}</strong></div>
            <div><span>Last PPW week</span><strong className={promotion.lastWeeklyNet >= 0 ? styles.positive : styles.negative}>{promotion.lastWeeklyNet >= 0 ? "+" : ""}{money(promotion.lastWeeklyNet)}</strong></div>
            <div><span>Runway</span><strong>{promotion.runwayWeeks === null ? "—" : `${promotion.runwayWeeks.toFixed(1)}w`}</strong></div>
          </section>

          <section className={styles.panel}>
            <div className={styles.sectionHeading}>
              <div>
                <span className={styles.eyebrow}>OPERATING POSITION</span>
                <h2>{promotion.tier} · {promotion.homeMarketName}</h2>
              </div>
              <span className={`${styles.status} ${styles[`status${promotion.financialDistress}`] ?? ""}`}>{promotion.financialDistress}</span>
            </div>
            <div className={styles.detailGrid}>
              <div><span>Lifecycle</span><strong>{label(promotion.lifecycle)}</strong></div>
              <div><span>Media reach</span><strong>{Math.round(promotion.mediaReach)}</strong></div>
              <div><span>Show cadence</span><strong>Every {promotion.eventCadenceWeeks} PPW week{promotion.eventCadenceWeeks === 1 ? "" : "s"}</strong></div>
              <div><span>World revision</span><strong>r{view.world.revision}</strong></div>
            </div>
          </section>

          <section className={styles.panel}>
            <div className={styles.sectionHeading}>
              <div>
                <span className={styles.eyebrow}>RECURRING WEEKLY MODEL</span>
                <h2>Before event-variable costs</h2>
              </div>
              <strong className={promotion.recurringWeekly.marginBeforeEventCosts >= 0 ? styles.positive : styles.negative}>
                {promotion.recurringWeekly.marginBeforeEventCosts >= 0 ? "+" : ""}{money(promotion.recurringWeekly.marginBeforeEventCosts)}
              </strong>
            </div>
            <div className={styles.moneyRows}>
              <div><span>Media income</span><strong className={styles.positive}>+{money(promotion.recurringWeekly.mediaIncome)}</strong></div>
              <div><span>Sponsor income</span><strong className={styles.positive}>+{money(promotion.recurringWeekly.sponsorIncome)}</strong></div>
              <div><span>Fixed overhead</span><strong className={styles.negative}>−{money(promotion.recurringWeekly.fixedOverhead)}</strong></div>
              <div><span>Contract guarantees</span><strong className={styles.negative}>−{money(promotion.recurringWeekly.contractGuarantees)}</strong></div>
            </div>
            <p className={styles.note}>This baseline excludes venue, travel, production, appearance fees, signing bonuses, buyouts and gate revenue. Those appear in actual World transactions.</p>
          </section>

          <section className={styles.panel}>
            <div className={styles.sectionHeading}>
              <div>
                <span className={styles.eyebrow}>LAST FOUR PPW WEEKS</span>
                <h2>Actual cash movement</h2>
              </div>
              <strong className={promotion.rollingFourWeeks.net >= 0 ? styles.positive : styles.negative}>
                {promotion.rollingFourWeeks.net >= 0 ? "+" : ""}{money(promotion.rollingFourWeeks.net)}
              </strong>
            </div>
            <div className={styles.detailGrid}>
              <div><span>Income</span><strong>{money(promotion.rollingFourWeeks.income)}</strong></div>
              <div><span>Spending</span><strong>{money(promotion.rollingFourWeeks.spending)}</strong></div>
            </div>
            {promotion.rollingFourWeeks.byCategory.length > 0 ? (
              <div className={styles.breakdown}>
                {promotion.rollingFourWeeks.byCategory.map((entry) => (
                  <div key={entry.category}>
                    <span>{label(entry.category)}</span>
                    <strong className={entry.amount >= 0 ? styles.positive : styles.negative}>{entry.amount >= 0 ? "+" : ""}{money(entry.amount)}</strong>
                  </div>
                ))}
              </div>
            ) : <p className={styles.note}>No financial transactions have been posted in this four-week window yet.</p>}
          </section>

          <section className={styles.panel}>
            <span className={styles.eyebrow}>STANDING</span>
            <h2>How the World sees you</h2>
            {promotion.standing ? (
              <div className={styles.standingGrid}>
                <div><span>Prestige</span><strong>{Math.round(promotion.standing.prestige)}</strong></div>
                <div><span>Fans</span><strong>{Math.round(promotion.standing.fanReputation)}</strong></div>
                <div><span>Business</span><strong>{Math.round(promotion.standing.businessReputation)}</strong></div>
                <div><span>Talent</span><strong>{Math.round(promotion.standing.talentReputation)}</strong></div>
              </div>
            ) : <p className={styles.note}>Standing has not been evaluated yet.</p>}
          </section>

          <section className={styles.panel}>
            <div className={styles.sectionHeading}>
              <div>
                <span className={styles.eyebrow}>RECENT SHOW ECONOMICS</span>
                <h2>What live events are doing</h2>
              </div>
              <a className={styles.inlineLink} href="/results">Full results →</a>
            </div>
            <div className={styles.list}>
              {promotion.recentShows.map((show) => (
                <article className={styles.rowCard} key={show.eventId}>
                  <div>
                    <strong>{ppwDate(show.date)} · {show.venueName}</strong>
                    <span>{show.marketName} · {integer(show.attendance)} attendance · {money(show.gateRevenue)} gate</span>
                  </div>
                  <strong className={show.netResult >= 0 ? styles.positive : styles.negative}>{show.netResult >= 0 ? "+" : ""}{money(show.netResult)}</strong>
                </article>
              ))}
              {promotion.recentShows.length === 0 ? <p className={styles.note}>No completed shows yet.</p> : null}
            </div>
          </section>

          <section className={styles.panel}>
            <span className={styles.eyebrow}>RECENT TRANSACTIONS</span>
            <h2>Promotion ledger</h2>
            <div className={styles.list}>
              {promotion.recentTransactions.map((transaction) => (
                <div className={styles.transaction} key={transaction.transactionId}>
                  <div><strong>{label(transaction.category)}</strong><span>{ppwDate(transaction.date)}</span></div>
                  <strong className={transaction.amount >= 0 ? styles.positive : styles.negative}>{transaction.amount >= 0 ? "+" : ""}{money(transaction.amount)}</strong>
                </div>
              ))}
              {promotion.recentTransactions.length === 0 ? <p className={styles.note}>No transactions posted yet.</p> : null}
            </div>
          </section>
        </>
      ) : null}
    </main>
  );
}
