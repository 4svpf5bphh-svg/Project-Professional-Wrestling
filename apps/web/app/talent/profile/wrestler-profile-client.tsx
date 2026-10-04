"use client";

import { useEffect, useState } from "react";
import type { PlayerWrestlerProfileView } from "../../../../../dist/packages/application/src/wrestler-profile-view.js";
import styles from "./wrestler-profile.module.css";

type ErrorPayload = { error?: string };

function isErrorPayload(payload: PlayerWrestlerProfileView | ErrorPayload): payload is ErrorPayload {
  return "error" in payload;
}

function label(value: string): string {
  return value.replaceAll("_", " ");
}

function ppwDate(date: { year: number; week: number }): string {
  return `Y${date.year} W${date.week}`;
}

function money(value: number): string {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

function matchDescription(match: PlayerWrestlerProfileView["recentMatches"][number]): string {
  const allies = match.partners.length > 0 ? ` with ${match.partners.join(" & ")}` : "";
  const opponents = match.opponents.length > 0 ? ` vs ${match.opponents.join(" & ")}` : "";
  return `${label(match.type)}${allies}${opponents}`;
}

export default function WrestlerProfileClient({ personId }: { personId: string }): React.JSX.Element {
  const [view, setView] = useState<PlayerWrestlerProfileView | null>(null);
  const [error, setError] = useState<string | null>(personId ? null : "No wrestler was selected.");

  useEffect(() => {
    if (!personId) return;
    setError(null);
    fetch(`/api/talent/profile?personId=${encodeURIComponent(personId)}`, { cache: "no-store" })
      .then(async (response) => {
        const payload = await response.json() as PlayerWrestlerProfileView | ErrorPayload;
        if (!response.ok || isErrorPayload(payload)) {
          throw new Error(isErrorPayload(payload) && payload.error ? payload.error : "Unable to load wrestler profile");
        }
        setView(payload);
      })
      .catch((reason: unknown) => setError(reason instanceof Error ? reason.message : "Unable to load wrestler profile"));
  }, [personId]);

  if (!view) {
    return (
      <main className={styles.shell}>
        <a className={styles.backLink} href="/talent/directory">← Wrestler profiles</a>
        <section className={error ? styles.error : styles.panel}>{error ?? "Loading wrestler profile…"}</section>
      </main>
    );
  }

  const relationship = view.relationship;
  const contract = relationship?.ourContract ?? null;

  return (
    <main className={styles.shell}>
      <a className={styles.backLink} href="/talent/directory">← Wrestler profiles</a>
      <header className={styles.header}>
        <div>
          <span className={styles.eyebrow}>{label(view.person.careerStage)} · {label(view.person.status)}</span>
          <h1>{view.person.name}</h1>
          <p>{view.person.homeMarketName} · age {view.person.biologicalAge.toFixed(1)} · debuted {ppwDate(view.person.debutDate)}</p>
        </div>
        {relationship ? <span className={styles.statusPill}>{label(relationship.employmentStatus)}</span> : null}
      </header>

      {view.person.currentInjury ? (
        <section className={styles.injuryBanner}>{label(view.person.currentInjury.severity)} injury · {view.person.currentInjury.weeksRemaining} PPW weeks remaining</section>
      ) : null}

      <section className={styles.metricGrid}>
        <div><span>Popularity</span><strong>{Math.round(view.person.popularity)}</strong></div>
        <div><span>Recognition</span><strong>{Math.round(view.person.recognition)}</strong></div>
        <div><span>Momentum</span><strong>{Math.round(view.person.momentum)}</strong></div>
        <div><span>Market value</span><strong>{money(view.person.estimatedWeeklyValue)}</strong></div>
      </section>

      <section className={styles.panel}>
        <div className={styles.sectionHeading}>
          <div><span className={styles.eyebrow}>YOUR PROMOTION</span><h2>Relationship</h2></div>
          {relationship ? <strong>Trust {Math.round(relationship.trust)}</strong> : null}
        </div>
        {!relationship ? <p>No controlled promotion relationship is available.</p> : (
          <>
            <p>{relationship.promotionName} · {label(relationship.employmentStatus)}{relationship.hasPendingOffer ? " · your offer pending" : ""}</p>
            {contract ? (
              <div className={styles.contractBox}>
                <div><span>Role</span><strong>{label(contract.roleExpectation)}</strong></div>
                <div><span>Contract</span><strong>{label(contract.family)}</strong></div>
                <div><span>Dates left</span><strong>{contract.datesRemaining}/{contract.dateEntitlement}</strong></div>
                <div><span>Expires</span><strong>{ppwDate(contract.endDate)}</strong></div>
                <div><span>Weekly</span><strong>{money(contract.weeklyGuarantee)}</strong></div>
                <div><span>Appearance</span><strong>{money(contract.appearanceFee)}</strong></div>
              </div>
            ) : null}
            {relationship.morale !== null ? (
              <div className={styles.privateMetrics}>
                <span>Morale <b>{Math.round(relationship.morale)}</b></span>
                <span>Fatigue <b>{Math.round(relationship.fatigue ?? 0)}</b></span>
                <span>Wear <b>{Math.round(relationship.wear ?? 0)}</b></span>
              </div>
            ) : <p className={styles.note}>Another promotion's private contract terms, Morale, fatigue and Wear are not exposed here.</p>}
          </>
        )}
      </section>

      <section className={styles.panel}>
        <div className={styles.sectionHeading}><div><span className={styles.eyebrow}>ABILITY</span><h2>Skills</h2></div></div>
        <div className={styles.skillGrid}>
          <div><span>In-ring</span><strong>{Math.round(view.person.skills.inRingQuality)}</strong></div>
          <div><span>Match craft</span><strong>{Math.round(view.person.skills.matchCraft)}</strong></div>
          <div><span>Safety</span><strong>{Math.round(view.person.skills.safety)}</strong></div>
          <div><span>Stamina</span><strong>{Math.round(view.person.skills.stamina)}</strong></div>
          <div><span>Presentation</span><strong>{Math.round(view.person.skills.presentation)}</strong></div>
        </div>
      </section>

      <section className={styles.panel}>
        <div className={styles.sectionHeading}><div><span className={styles.eyebrow}>CAREER</span><h2>Record</h2></div></div>
        <div className={styles.statGrid}>
          <div><span>Matches</span><strong>{view.careerStats.completedMatches}</strong></div>
          <div><span>Wins</span><strong>{view.careerStats.wins}</strong></div>
          <div><span>Losses</span><strong>{view.careerStats.losses}</strong></div>
          <div><span>Singles</span><strong>{view.careerStats.singlesMatches}</strong></div>
          <div><span>Tag</span><strong>{view.careerStats.tagMatches}</strong></div>
          <div><span>Best rating</span><strong>{view.careerStats.bestCriticalRating.toFixed(2)}★</strong></div>
        </div>
      </section>

      {view.currentChampionships.length > 0 ? (
        <section className={styles.panel}>
          <div className={styles.sectionHeading}><div><span className={styles.eyebrow}>CHAMPIONSHIPS</span><h2>Current titles</h2></div></div>
          <div className={styles.stack}>
            {view.currentChampionships.map((title) => (
              <article className={styles.historyCard} key={title.championshipId}>
                <div><strong>{title.name}</strong><span>{title.promotionName} · {label(title.division)}</span></div>
                <div className={styles.right}><b>{title.defenses} defenses</b><span>since {ppwDate(title.reignStartDate)}</span></div>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      {view.activeTeams.length > 0 ? (
        <section className={styles.panel}>
          <div className={styles.sectionHeading}><div><span className={styles.eyebrow}>TAG TEAMS</span><h2>Active teams</h2></div></div>
          <div className={styles.stack}>
            {view.activeTeams.map((team) => (
              <article className={styles.historyCard} key={team.teamId}>
                <div><strong>{team.name}</strong><span>{team.partners.length > 0 ? `with ${team.partners.join(" & ")}` : "No active partner listed"}</span></div>
                <div className={styles.right}><span>formed {ppwDate(team.formedDate)}</span></div>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      <section className={styles.panel}>
        <div className={styles.sectionHeading}><div><span className={styles.eyebrow}>MATCH HISTORY</span><h2>Recent matches</h2></div><strong>{view.careerStats.averageCriticalRating.toFixed(2)}★ avg</strong></div>
        <div className={styles.stack}>
          {view.recentMatches.map((match) => (
            <article className={styles.historyCard} key={match.matchId}>
              <div>
                <strong>{match.won ? "Win" : "Loss"} · {matchDescription(match)}</strong>
                <span>{match.promotionName} · {ppwDate(match.date)}{match.championshipNames.length > 0 ? ` · ${match.championshipNames.join(", ")}` : ""}</span>
              </div>
              <div className={styles.right}><b>{match.criticalRatingStars.toFixed(2)}★</b><span>Crowd {Math.round(match.crowdResponse)}</span></div>
            </article>
          ))}
          {view.recentMatches.length === 0 ? <p>No completed matches yet.</p> : null}
        </div>
      </section>

      {view.injuryHistory.length > 0 ? (
        <section className={styles.panel}>
          <div className={styles.sectionHeading}><div><span className={styles.eyebrow}>HEALTH HISTORY</span><h2>Injuries</h2></div></div>
          <div className={styles.stack}>
            {view.injuryHistory.map((injury) => (
              <article className={styles.historyCard} key={injury.injuryId}>
                <div><strong>{label(injury.severity)}</strong><span>{ppwDate(injury.date)} · {label(injury.status)}</span></div>
                <div className={styles.right}><b>{injury.weeksOut}w original</b>{injury.status === "ACTIVE" ? <span>{injury.weeksRemaining}w left</span> : null}</div>
              </article>
            ))}
          </div>
        </section>
      ) : null}
    </main>
  );
}
