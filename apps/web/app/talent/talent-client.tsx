"use client";

import { useEffect, useMemo, useState } from "react";
import type {
  PlayerPendingContractOfferView,
  PlayerRosterContractView,
  PlayerTalentManagementView,
  PlayerTalentMarketView,
} from "../../../../dist/packages/application/src/talent-view.js";
import styles from "./talent.module.css";

type ErrorPayload = { error?: string };
type Tab = "ROSTER" | "MARKET" | "OFFERS";

function isErrorPayload(payload: PlayerTalentManagementView | ErrorPayload): payload is ErrorPayload {
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

function ppwDate(date: { year: number; week: number }): string {
  return `Y${date.year} W${date.week}`;
}

function label(value: string): string {
  return value.replaceAll("_", " ");
}

function averageSkill(entry: { skills: { inRingQuality: number; matchCraft: number; presentation: number } }): number {
  return Math.round((entry.skills.inRingQuality + entry.skills.matchCraft + entry.skills.presentation) / 3);
}

function matchesQuery(name: string, query: string): boolean {
  return name.toLowerCase().includes(query.trim().toLowerCase());
}

function InjuryBadge({ injury }: { injury: { severity: string; weeksRemaining: number } | null }): React.JSX.Element | null {
  if (!injury) return null;
  return <span className={styles.injury}>{label(injury.severity)} · {injury.weeksRemaining}w</span>;
}

function RosterCard({ wrestler }: { wrestler: PlayerRosterContractView }): React.JSX.Element {
  const contract = wrestler.contract;
  return (
    <details className={styles.card}>
      <summary className={styles.summary}>
        <div>
          <div className={styles.nameLine}>
            <strong>{wrestler.name}</strong>
            <InjuryBadge injury={wrestler.injury} />
          </div>
          <span>{label(wrestler.careerStage)} · {label(contract.roleExpectation)} · {label(contract.family)}</span>
        </div>
        <div className={styles.scoreBlock}>
          <b>POP {Math.round(wrestler.popularity)}</b>
          <small>{contract.datesRemaining}/{contract.dateEntitlement} dates</small>
        </div>
      </summary>
      <div className={styles.cardBody}>
        <div className={styles.metricGrid}>
          <div><span>Trust</span><strong>{Math.round(wrestler.trust)}</strong></div>
          <div><span>Morale</span><strong>{Math.round(wrestler.morale)}</strong></div>
          <div><span>Momentum</span><strong>{Math.round(wrestler.momentum)}</strong></div>
          <div><span>Recognition</span><strong>{Math.round(wrestler.recognition)}</strong></div>
          <div><span>In-ring</span><strong>{Math.round(wrestler.skills.inRingQuality)}</strong></div>
          <div><span>Presentation</span><strong>{Math.round(wrestler.skills.presentation)}</strong></div>
        </div>
        <div className={styles.contractBox}>
          <div>
            <span>{label(contract.exclusivity)} · expires {ppwDate(contract.endDate)}</span>
            <strong>{contract.renewalWindowOpen ? "Renewal window open" : `${contract.weeksToExpiry} weeks to expiry`}</strong>
          </div>
          <div className={styles.moneyRows}>
            <span>Weekly guarantee <b>{money(contract.weeklyGuarantee)}</b></span>
            <span>Appearance fee <b>{money(contract.appearanceFee)}</b></span>
            <span>Signing bonus <b>{money(contract.signingBonus)}</b></span>
          </div>
        </div>
        <p className={styles.subtle}>Age {wrestler.biologicalAge.toFixed(1)} · Fatigue {Math.round(wrestler.fatigue)} · Wear {Math.round(wrestler.wear)} · Skill {averageSkill(wrestler)}</p>
      </div>
    </details>
  );
}

function MarketCard({ wrestler }: { wrestler: PlayerTalentMarketView }): React.JSX.Element {
  return (
    <article className={styles.card}>
      <div className={styles.marketTop}>
        <div>
          <div className={styles.nameLine}>
            <strong>{wrestler.name}</strong>
            <InjuryBadge injury={wrestler.injury} />
          </div>
          <span>{label(wrestler.careerStage)} · age {wrestler.biologicalAge.toFixed(1)}</span>
        </div>
        <span className={styles.availability}>{wrestler.availability === "FREE_AGENT" ? "Free agent" : "Non-exclusive"}</span>
      </div>
      <div className={styles.metricGrid}>
        <div><span>Popularity</span><strong>{Math.round(wrestler.popularity)}</strong></div>
        <div><span>Recognition</span><strong>{Math.round(wrestler.recognition)}</strong></div>
        <div><span>Momentum</span><strong>{Math.round(wrestler.momentum)}</strong></div>
        <div><span>In-ring</span><strong>{Math.round(wrestler.skills.inRingQuality)}</strong></div>
        <div><span>Craft</span><strong>{Math.round(wrestler.skills.matchCraft)}</strong></div>
        <div><span>Presentation</span><strong>{Math.round(wrestler.skills.presentation)}</strong></div>
      </div>
      <div className={styles.marketBottom}>
        <span>Estimated market value <b>{money(wrestler.estimatedWeeklyValue)}/wk</b></span>
        {wrestler.hasOurPendingOffer ? <span className={styles.pending}>Your offer pending</span> : null}
      </div>
    </article>
  );
}

function OfferCard({ offer }: { offer: PlayerPendingContractOfferView }): React.JSX.Element {
  return (
    <article className={styles.card}>
      <div className={styles.marketTop}>
        <div>
          <strong>{offer.personName}</strong>
          <span>{label(offer.offerKind)} · submitted {ppwDate(offer.submittedDate)}</span>
        </div>
        <span className={styles.pending}>Pending</span>
      </div>
      <div className={styles.contractBox}>
        <div>
          <span>{label(offer.family)} · {label(offer.exclusivity)}</span>
          <strong>{label(offer.roleExpectation)} · {offer.dateEntitlement} dates · to {ppwDate(offer.endDate)}</strong>
        </div>
        <div className={styles.moneyRows}>
          <span>Weekly <b>{money(offer.weeklyGuarantee)}</b></span>
          <span>Appearance <b>{money(offer.appearanceFee)}</b></span>
          <span>Signing <b>{money(offer.signingBonus)}</b></span>
        </div>
      </div>
    </article>
  );
}

export default function TalentClient(): React.JSX.Element {
  const [view, setView] = useState<PlayerTalentManagementView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("ROSTER");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);

  async function refresh(): Promise<void> {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/talent", { cache: "no-store" });
      const payload = await response.json() as PlayerTalentManagementView | ErrorPayload;
      if (!response.ok || isErrorPayload(payload)) {
        throw new Error(isErrorPayload(payload) && payload.error ? payload.error : "Unable to load talent management");
      }
      setView(payload);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to load talent management");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void refresh(); }, []);

  const roster = useMemo(
    () => (view?.roster ?? []).filter((entry) => matchesQuery(entry.name, query)),
    [view, query],
  );
  const market = useMemo(
    () => (view?.market ?? []).filter((entry) => matchesQuery(entry.name, query)),
    [view, query],
  );
  const offers = useMemo(
    () => (view?.pendingOffers ?? []).filter((entry) => matchesQuery(entry.personName, query)),
    [view, query],
  );

  return (
    <main className={styles.shell}>
      <a className={styles.backLink} href="/">← Promotion home</a>
      <header className={styles.header}>
        <div>
          <span className={styles.eyebrow}>ROSTER & TALENT MARKET</span>
          <h1>{view?.promotion?.name ?? "Talent management"}</h1>
          <p>{view ? `${view.world.name} · ${ppwDate(view.world.currentDate)}` : "Loading your World…"}</p>
        </div>
        <button className={styles.button} disabled={loading} onClick={() => void refresh()}>{loading ? "Loading…" : "Refresh"}</button>
      </header>

      {error ? <div className={styles.error}>{error}</div> : null}
      {view && !view.promotion ? <section className={styles.panel}><p>Take control of a promotion before managing talent.</p></section> : null}

      {view?.promotion ? (
        <>
          <section className={styles.overview}>
            <div><span>Roster contracts</span><strong>{view.roster.length}</strong></div>
            <div><span>Available talent</span><strong>{view.market.length}</strong></div>
            <div><span>Pending offers</span><strong>{view.pendingOffers.length}</strong></div>
          </section>

          <div className={styles.tabs} role="tablist" aria-label="Talent management views">
            {(["ROSTER", "MARKET", "OFFERS"] as const).map((candidate) => (
              <button
                key={candidate}
                role="tab"
                aria-selected={tab === candidate}
                className={tab === candidate ? styles.activeTab : styles.tab}
                onClick={() => { setTab(candidate); setQuery(""); }}
              >
                {candidate === "MARKET" ? "Talent market" : candidate[0] + candidate.slice(1).toLowerCase()}
              </button>
            ))}
          </div>

          <label className={styles.search}>
            <span>Search {tab === "ROSTER" ? "your roster" : tab === "MARKET" ? "available talent" : "pending offers"}</span>
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Wrestler name" />
          </label>

          <section className={styles.list}>
            {tab === "ROSTER" ? roster.map((entry) => <RosterCard key={entry.contractId} wrestler={entry} />) : null}
            {tab === "MARKET" ? market.map((entry) => <MarketCard key={entry.personId} wrestler={entry} />) : null}
            {tab === "OFFERS" ? offers.map((entry) => <OfferCard key={entry.offerId} offer={entry} />) : null}
            {(tab === "ROSTER" && roster.length === 0) || (tab === "MARKET" && market.length === 0) || (tab === "OFFERS" && offers.length === 0) ? (
              <div className={styles.empty}>Nothing matches this view right now.</div>
            ) : null}
          </section>

          {tab === "MARKET" ? <p className={styles.footerNote}>Market values are PPW estimates. Rival salary, bonus, role and pending-offer details remain private. Contract actions are the next contained Gate F slice.</p> : null}
        </>
      ) : null}
    </main>
  );
}
