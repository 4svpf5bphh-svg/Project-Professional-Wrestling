"use client";

import { useEffect, useRef, useState } from "react";
import type { PlayerWrestlerProfileView } from "../../../../../dist/packages/application/src/wrestler-profile-view.js";
import {
  GIMMICK_ARCHETYPES, MOVE_CATEGORIES, WRESTLING_STYLES,
  type WrestlerCreativeFields, type WrestlingStyle, type GimmickArchetype, type MoveCategory,
} from "../../../../../dist/packages/application/src/wrestler-creative.js";
import styles from "./wrestler-profile.module.css";

type ErrorPayload = { error?: string };
export type WrestlerProfileOrigin = "talent" | "directory" | "industry";

type BackDestination = {
  href: string;
  label: string;
};

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

function backDestination(origin: WrestlerProfileOrigin): BackDestination {
  if (origin === "industry") return { href: "/industry", label: "Industry" };
  if (origin === "talent") return { href: "/talent", label: "Talent management" };
  return { href: "/talent/directory", label: "Wrestler profiles" };
}

export default function WrestlerProfileClient({
  personId,
  origin,
}: {
  personId: string;
  origin: WrestlerProfileOrigin;
}): React.JSX.Element {
  const [view, setView] = useState<PlayerWrestlerProfileView | null>(null);
  const [creativeDraft, setCreativeDraft] = useState<WrestlerCreativeFields | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const saveRequestId = useRef<string | null>(null);
  const [error, setError] = useState<string | null>(personId ? null : "No wrestler was selected.");
  const back = backDestination(origin);

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
        setCreativeDraft(payload.creativeProfile ? structuredClone(payload.creativeProfile.fields) : null);
        setSaved(false);
        saveRequestId.current = null;
      })
      .catch((reason: unknown) => setError(reason instanceof Error ? reason.message : "Unable to load wrestler profile"));
  }, [personId]);

  function updateCreative(patch: Partial<WrestlerCreativeFields>): void {
    setCreativeDraft((current) => current ? { ...current, ...patch } : null);
    setSaved(false);
    saveRequestId.current = null;
  }

  async function saveCreative(): Promise<void> {
    if (!view?.creativeProfile?.canEdit || !creativeDraft || saving) return;
    setSaving(true);
    setError(null);
    try {
      saveRequestId.current ??= crypto.randomUUID();
      const result = await fetch("/api/talent/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requestId: saveRequestId.current,
          expectedRevision: view.world.revision,
          personId: view.person.personId,
          fields: creativeDraft,
        }),
      });
      const payload = await result.json() as PlayerWrestlerProfileView | ErrorPayload;
      if (!result.ok || isErrorPayload(payload)) {
        throw new Error(isErrorPayload(payload) && payload.error
          ? payload.error : "Unable to save wrestler presentation");
      }
      setView(payload);
      setCreativeDraft(payload.creativeProfile ? structuredClone(payload.creativeProfile.fields) : null);
      setSaved(true);
      saveRequestId.current = null;
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to save wrestler presentation");
    } finally {
      setSaving(false);
    }
  }

  function returnToOrigin(): void {
    if (typeof window !== "undefined" && document.referrer) {
      try {
        const referrer = new URL(document.referrer);
        if (referrer.origin === window.location.origin) {
          window.history.back();
          return;
        }
      } catch {
        // Fall through to the known-safe origin below.
      }
    }
    window.location.assign(back.href);
  }

  const backControl = (
    <button className={styles.backLink} type="button" onClick={returnToOrigin}>← {back.label}</button>
  );

  if (!view) {
    return (
      <main className={styles.shell}>
        {backControl}
        <section className={error ? styles.error : styles.panel}>{error ?? "Loading wrestler profile…"}</section>
      </main>
    );
  }

  const relationship = view.relationship;
  const contract = relationship?.ourContract ?? null;
  const creative = view.creativeProfile;
  const hasCreativeChanges = creativeDraft && creative &&
    JSON.stringify(creativeDraft) !== JSON.stringify(creative.fields);

  const chip = <T extends string>(
    values: readonly T[],
    selected: T | null,
    onSelect: (choice: T) => void,
  ): React.JSX.Element => (
    <div className={styles.chips}>
      {values.map((choice) => (
        <button
          key={choice}
          type="button"
          className={choice === selected ? styles.chipActive : styles.chip}
          aria-pressed={choice === selected}
          onClick={() => onSelect(choice)}
        >
          {label(choice)}
        </button>
      ))}
    </div>
  );

  return (
    <main className={styles.shell}>
      {backControl}
      <header className={styles.header}>
        <div>
          <span className={styles.eyebrow}>{label(view.person.careerStage)} · {label(view.person.status)}</span>
          <h1>{view.person.name}</h1>
          <p>{view.person.homeMarketName} · age {view.person.biologicalAge.toFixed(1)} · debuted {ppwDate(view.person.debutDate)}</p>
        </div>
        {relationship ? <span className={styles.statusPill}>{label(relationship.employmentStatus)}</span> : null}
      </header>

      {error ? <section className={styles.error} role="alert">{error}</section> : null}

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
          <div><span className={styles.eyebrow}>THE CHARACTER</span><h2>Gimmick, style &amp; moves</h2></div>
          {creative ? <strong>{creative.promotionName}</strong> : null}
        </div>
        <p className={styles.note}>
          Shared-world wrestling style: <strong>{label(view.person.baselineStyle)}</strong>.
          {creative ? " Your promotion can set its own character and style emphasis. Nothing here changes match ratings yet."
            : " Promotional gimmicks and move lists can be edited by the promotion booking this wrestler."}
        </p>
        {creativeDraft && creative ? (
          <div className={styles.creativeEditor}>
            <label className={styles.field}>
              <span>Ring name</span>
              <input value={creativeDraft.ringName} maxLength={60}
                onChange={(event) => updateCreative({ ringName: event.target.value })}/>
            </label>
            <div className={styles.field}>
              <span>Character archetype</span>
              {chip<GimmickArchetype>(GIMMICK_ARCHETYPES, creativeDraft.gimmickArchetype,
                (gimmickArchetype) => updateCreative({gimmickArchetype}))}
            </div>
            <label className={styles.field}>
              <span>Gimmick description</span>
              <textarea rows={3} maxLength={240} value={creativeDraft.gimmickDescription}
                placeholder="What makes this character stand out?"
                onChange={(event) => updateCreative({gimmickDescription:event.target.value})}/>
            </label>
            <div className={styles.field}>
              <span>Primary wrestling style</span>
              {chip<WrestlingStyle>(WRESTLING_STYLES,creativeDraft.primaryStyle,(primaryStyle) =>
                updateCreative({
                  primaryStyle,
                  secondaryStyle: creativeDraft.secondaryStyle === primaryStyle ? null : creativeDraft.secondaryStyle,
                }))}
            </div>
            <div className={styles.field}>
              <span>Secondary style (optional)</span>
              <div className={styles.chips}>
                <button type="button" className={creativeDraft.secondaryStyle === null ? styles.chipActive : styles.chip}
                  onClick={() => updateCreative({secondaryStyle:null})}>None</button>
              </div>
              {chip<WrestlingStyle>(WRESTLING_STYLES.filter((entry) => entry !== creativeDraft.primaryStyle),
                creativeDraft.secondaryStyle,(secondaryStyle) => updateCreative({secondaryStyle}))}
            </div>
            {(["signatureMove","finishingMove"] as const).map((moveKey) => {
              const move = creativeDraft[moveKey];
              return (
                <div className={styles.field} key={moveKey}>
                  <span>{moveKey === "signatureMove" ? "Signature move" : "Finishing move"}</span>
                  <input value={move?.name ?? ""} maxLength={80}
                    placeholder={moveKey === "signatureMove" ? "Enter signature move" : "Enter finisher"}
                    onChange={(event) => updateCreative({
                      [moveKey]: event.target.value
                        ? {name:event.target.value,category:move?.category ?? "GRAPPLE"} : null,
                    })}/>
                  {move ? chip<MoveCategory>(MOVE_CATEGORIES,move.category,(category) =>
                    updateCreative({ [moveKey]: { ...move,category } })) : null}
                </div>
              );
            })}
            <div className={styles.editorActions}>
              <button type="button" className={styles.saveButton} disabled={saving || !hasCreativeChanges}
                onClick={() => void saveCreative()}>{saving ? "Saving…" : "Save presentation"}</button>
              <button type="button" className={styles.cancelButton} disabled={saving || !hasCreativeChanges}
                onClick={() => {setCreativeDraft(structuredClone(creative.fields));setSaved(false);saveRequestId.current=null;}}>
                Discard edits
              </button>
            </div>
            {saved ? <p className={styles.saved} role="status">Presentation saved to this promotion.</p> : null}
            {creative.history.length > 0 ? (
              <details className={styles.history}>
                <summary>Presentation changes ({creative.history.length})</summary>
                <div className={styles.stack}>{[...creative.history].reverse().slice(0,10).map((entry) => (
                  <p key={entry.revision}>{ppwDate(entry.date)} · {entry.previous.ringName} → {entry.next.ringName}
                    {" · "}{label(entry.next.gimmickArchetype)} · {label(entry.next.primaryStyle)}
                  </p>
                ))}</div>
              </details>
            ) : null}
          </div>
        ) : (
          <div className={styles.stack}>
            <p className={styles.note}>
              <strong>{view.person.baselinePresentation.ringName}</strong> ·
              {" "}{label(view.person.baselinePresentation.gimmickArchetype)} ·
              {" "}{label(view.person.baselinePresentation.primaryStyle)}
            </p>
            <p className={styles.note}>
              Signature: {view.person.baselinePresentation.signatureMove?.name ?? "Not set"} ·
              Finisher: {view.person.baselinePresentation.finishingMove?.name ?? "Not set"}.
            </p>
            <p className={styles.note}>
              Every wrestler has a character foundation. Their promotion's editable gimmick and move lists
              are not overwritten or exposed through another booker's profile.
            </p>
          </div>
        )}
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
            ) : <p className={styles.note}>Another promotion&apos;s private contract terms, Morale, fatigue and Wear are not exposed here.</p>}
          </>
        )}
      </section>

      <section className={styles.panel}>
        <div className={styles.sectionHeading}>
          <div><span className={styles.eyebrow}>ON THE MIC / BEHIND THE CURTAIN</span><h2>Persona &amp; promos</h2></div>
        </div>
        <div className={styles.skillGrid}>
          <div><span>Microphone</span><strong>{Math.round(view.person.personality.microphoneAbility)}</strong></div>
          <div><span>Backstage tendency</span><strong style={{fontSize: 13}}>{label(view.person.personality.temperament)}</strong></div>
        </div>
        <p className={styles.note}>
          Motivated by: {view.person.personality.motivations.map(label).join(" · ")}.
          {" "}Creative interests: {view.person.creativeInterests.topInterests.map(label).join(" · ")}.
          {" "}{view.person.personality.microphoneSource === "ESTIMATED"
            ? "Mic ability is an initial game estimate."
            : "Mic ability uses a curated game value."}
          {" "}These are fictional in-game descriptors, not biographical claims or automatic booking powers.
        </p>
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
