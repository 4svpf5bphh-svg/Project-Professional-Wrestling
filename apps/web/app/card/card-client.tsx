"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type {
  AlphaCardChampionshipView,
  AlphaCardMatchView,
  AlphaChampionshipAssignmentView,
  AlphaCurrentWeekCardView,
  AlphaShowCardRequest,
} from "../../../../dist/packages/web-adapter/src/card-service.js";
import type { MatchFinish } from "../../../../dist/packages/sim-core/src/match-finishes.js";
import styles from "./card.module.css";

type ErrorPayload = { error?: string };
type BookableFinish = Exclude<MatchFinish, "INJURY_STOPPAGE">;

const MATCH_INTENTS: AlphaCardMatchView["intent"][] = [
  "COMPETITIVE",
  "SHOWCASE",
  "DOMINANT",
  "TECHNICAL",
  "HIGH_RISK",
  "STORY",
  "PROTECTIVE",
  "EPIC",
];
const MATCH_FINISHES: BookableFinish[] = ["CLEAN_PIN", "SUBMISSION", "FLASH_PIN", "PROTECTED_FINISH"];
const SHOW_TIME_GUIDE_MINUTES = 120;

function isErrorPayload(payload: AlphaCurrentWeekCardView | ErrorPayload): payload is ErrorPayload {
  return "error" in payload;
}

function requestedDraftId(): string | null {
  if (typeof window === "undefined") return null;
  return new URLSearchParams(window.location.search).get("draftId")?.trim() || null;
}

function freshMatchId(): string {
  return `alpha-card:${crypto.randomUUID()}`;
}

function defaultFinishForIntent(intent: AlphaCardMatchView["intent"]): BookableFinish {
  if (intent === "PROTECTIVE") return "PROTECTED_FINISH";
  if (intent === "STORY") return "FLASH_PIN";
  return "CLEAN_PIN";
}

function intentLabel(value: string): string {
  return value.replaceAll("_", " ").toLowerCase().replace(/(^|\s)\S/g, (letter) => letter.toUpperCase());
}

function finishLabel(value: BookableFinish): string {
  if (value === "CLEAN_PIN") return "Clean pin";
  if (value === "SUBMISSION") return "Submission";
  if (value === "FLASH_PIN") return "Flash pin";
  return "Protected / controversial";
}

function cloneCard(matches: AlphaCardMatchView[]): AlphaCardMatchView[] {
  return matches.map((match) => ({
    ...match,
    sideAIds: [...match.sideAIds],
    sideBIds: [...match.sideBIds],
    plannedFinish: match.plannedFinish ?? defaultFinishForIntent(match.intent),
  }));
}

function cloneAssignments(assignments: AlphaChampionshipAssignmentView[]): AlphaChampionshipAssignmentView[] {
  return assignments.map((assignment) => ({ ...assignment }));
}

export default function CardClient(): React.JSX.Element {
  const [view, setView] = useState<AlphaCurrentWeekCardView | null>(null);
  const [card, setCard] = useState<AlphaCardMatchView[]>([]);
  const [titleAssignments, setTitleAssignments] = useState<AlphaChampionshipAssignmentView[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestId = useRef<string | null>(null);

  async function load(): Promise<void> {
    setLoading(true);
    setError(null);
    try {
      const draftId = requestedDraftId();
      const endpoint = draftId ? `/api/show-card?draftId=${encodeURIComponent(draftId)}` : "/api/show-card";
      const response = await fetch(endpoint, { cache: "no-store" });
      const payload = await response.json() as AlphaCurrentWeekCardView | ErrorPayload;
      if (!response.ok || isErrorPayload(payload)) {
        throw new Error(isErrorPayload(payload) && payload.error ? payload.error : "Unable to load show booking");
      }
      setView(payload);
      setCard(cloneCard(payload.matches));
      setTitleAssignments(cloneAssignments(payload.championshipAssignments));
      setSaved(false);
      requestId.current = null;
    } catch (reason) {
      setView(null);
      setError(reason instanceof Error ? reason.message : "Unable to load show booking");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  const bookedPersonIds = useMemo(
    () => card.flatMap((match) => [...match.sideAIds, ...match.sideBIds]).filter(Boolean),
    [card],
  );
  const uniqueBookedCount = new Set(bookedPersonIds).size;
  const bookedMinutes = card.reduce((sum, match) => sum + match.plannedLengthMinutes, 0);
  const minutesRemaining = SHOW_TIME_GUIDE_MINUTES - bookedMinutes;
  const duplicateBooking = uniqueBookedCount !== bookedPersonIds.length;
  const completeMatches = card.every((match) => [...match.sideAIds, ...match.sideBIds].every(Boolean));
  const canSave = Boolean(
    view?.canEdit
    && card.length > 0
    && completeMatches
    && !duplicateBooking
    && uniqueBookedCount >= (view?.minParticipants ?? 0)
    && uniqueBookedCount <= (view?.maxParticipants ?? Number.MAX_SAFE_INTEGER)
    && !saving
  );

  function markDirty(): void {
    setSaved(false);
    requestId.current = null;
  }

  function addMatch(type: AlphaCardMatchView["type"]): void {
    const size = type === "TAG" ? 2 : 1;
    setCard((current) => [...current, {
      draftMatchId: freshMatchId(),
      type,
      sideAIds: Array.from({ length: size }, () => ""),
      sideBIds: Array.from({ length: size }, () => ""),
      intendedWinnerSide: "A",
      intent: "COMPETITIVE",
      plannedLengthMinutes: type === "TAG" ? 15 : 12,
      plannedFinish: "CLEAN_PIN",
    }]);
    markDirty();
  }

  function updateMatch(index: number, patch: Partial<AlphaCardMatchView>): void {
    setCard((current) => current.map((match, matchIndex) => (
      matchIndex === index ? { ...match, ...patch } : match
    )));
    markDirty();
  }

  function setMatchType(index: number, type: AlphaCardMatchView["type"]): void {
    const size = type === "TAG" ? 2 : 1;
    const matchId = card[index]?.draftMatchId;
    updateMatch(index, {
      type,
      sideAIds: Array.from({ length: size }, () => ""),
      sideBIds: Array.from({ length: size }, () => ""),
    });
    if (matchId) setTitleAssignments((current) => current.filter((entry) => entry.draftMatchId !== matchId));
  }

  function setParticipant(index: number, side: "A" | "B", slotIndex: number, personId: string): void {
    const match = card[index];
    if (!match) return;
    const ids = [...(side === "A" ? match.sideAIds : match.sideBIds)];
    ids[slotIndex] = personId;
    updateMatch(index, side === "A" ? { sideAIds: ids } : { sideBIds: ids });
  }

  function removeMatch(index: number): void {
    const matchId = card[index]?.draftMatchId;
    setCard((current) => current.filter((_, matchIndex) => matchIndex !== index));
    if (matchId) setTitleAssignments((current) => current.filter((entry) => entry.draftMatchId !== matchId));
    markDirty();
  }

  function moveMatch(index: number, direction: -1 | 1): void {
    const target = index + direction;
    if (target < 0 || target >= card.length) return;
    setCard((current) => {
      const next = [...current];
      [next[index], next[target]] = [next[target]!, next[index]!];
      return next;
    });
    markDirty();
  }

  function assignmentForMatch(draftMatchId: string): AlphaChampionshipAssignmentView | undefined {
    return titleAssignments.find((assignment) => assignment.draftMatchId === draftMatchId);
  }

  function assignChampionship(draftMatchId: string, championshipId: string): void {
    setTitleAssignments((current) => {
      const withoutMatch = current.filter((assignment) => assignment.draftMatchId !== draftMatchId);
      return championshipId ? [...withoutMatch, { draftMatchId, championshipId }] : withoutMatch;
    });
    markDirty();
  }

  function personBookedElsewhere(personId: string, matchIndex: number, currentId: string): boolean {
    if (!personId || personId === currentId) return false;
    return card.some((match, index) => (
      index !== matchIndex && [...match.sideAIds, ...match.sideBIds].includes(personId)
    ));
  }

  function holderEligible(championship: AlphaCardChampionshipView, match: AlphaCardMatchView): boolean {
    if (championship.holderPersonIds.length === 0) return true;
    const ids = [...match.sideAIds, ...match.sideBIds];
    return championship.holderPersonIds.every((personId) => ids.includes(personId));
  }

  async function save(): Promise<void> {
    if (!view || !canSave) return;
    setSaving(true);
    setError(null);
    try {
      if (!requestId.current) requestId.current = crypto.randomUUID();
      const body: AlphaShowCardRequest = {
        requestId: requestId.current,
        expectedRevision: view.world.revision,
        expectedPlanVersion: view.workspaceVersion,
        draftId: view.draftId,
        matches: cloneCard(card),
        championshipAssignments: cloneAssignments(titleAssignments),
      };
      const response = await fetch("/api/show-card", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const payload = await response.json() as AlphaCurrentWeekCardView | ErrorPayload;
      if (!response.ok || isErrorPayload(payload)) {
        throw new Error(isErrorPayload(payload) && payload.error ? payload.error : "Unable to save show booking");
      }
      setView(payload);
      setCard(cloneCard(payload.matches));
      setTitleAssignments(cloneAssignments(payload.championshipAssignments));
      setSaved(true);
      requestId.current = null;
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to save show booking");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <main className="app-shell loading-shell"><div className="brand-mark">PPW</div><p>Opening the booking sheet…</p></main>;
  }

  if (!view) {
    return (
      <main className="app-shell">
        <div className={styles.header}><div><span className="eyebrow">BOOK SHOW</span><h1>Nothing to book yet</h1></div><a className={styles.backLink} href="/planner">← Shows</a></div>
        <div className={styles.errorBox}>{error ?? "Plan a show before booking it."}</div>
        <button className="primary-button" onClick={() => void load()}>Retry</button>
      </main>
    );
  }

  return (
    <main className="app-shell">
      <div className={styles.header}>
        <div>
          <span className="eyebrow">SHOW BUILDER</span>
          <h1>{view.promotion.name}</h1>
          <p className="muted">Year {view.targetDate.year} · Week {view.targetDate.week} · {view.marketName}</p>
        </div>
        <a className={styles.backLink} href="/planner">← Shows</a>
      </div>

      {error ? <div className={styles.errorBox}>{error}</div> : null}

      <section className="panel planner-panel">
        <div className="section-heading">
          <div><span className="eyebrow">RUNNING ORDER</span><h2>{view.venueName}</h2></div>
          <span className="plan-pill plan-reserved">{view.reservationId ? "RESERVED" : "DRAFT"}</span>
        </div>
        <p className="muted body-copy">Build the show directly. Talent chosen in booked slots becomes the underlying shared-World reservation when you save a valid card.</p>
        <div className={styles.summary}>
          <div><span>Booked talent</span><strong>{uniqueBookedCount} / {view.maxParticipants}</strong></div>
          <div><span>Minimum</span><strong>{view.minParticipants}</strong></div>
          <div><span>Match time</span><strong>{bookedMinutes} min</strong></div>
          <div><span>Guide left</span><strong className={minutesRemaining < 0 ? styles.timeOver : undefined}>{minutesRemaining >= 0 ? `${minutesRemaining} min` : `${Math.abs(minutesRemaining)} over`}</strong></div>
        </div>

        <div className={styles.cardList}>
          {card.length === 0 ? (
            <button className={styles.emptySlot} type="button" onClick={() => addMatch("SINGLES")} disabled={!view.canEdit}>
              <strong>+ Add your first slot</strong>
              <span>Start with a match. Segment slots are the next part of this booking rebuild.</span>
            </button>
          ) : null}

          {card.map((match, matchIndex) => {
            const isMainEvent = matchIndex === card.length - 1;
            const assignment = assignmentForMatch(match.draftMatchId);
            const finish = (match.plannedFinish ?? defaultFinishForIntent(match.intent)) as BookableFinish;
            const participantOptions = (currentId: string) => view.availableParticipants.map((person) => (
              <option
                key={person.personId}
                value={person.personId}
                disabled={personBookedElsewhere(person.personId, matchIndex, currentId)}
              >
                {person.name} · {person.alignment} · POP {Math.round(person.popularity)}
              </option>
            ));
            return (
              <article className={`${styles.matchCard} ${isMainEvent ? styles.mainEventCard : ""}`} key={match.draftMatchId}>
                <div className={styles.matchHeader}>
                  <div><span className={styles.slotNumber}>SLOT {matchIndex + 1}</span><strong>Match</strong></div>
                  {isMainEvent ? <span className={styles.mainEvent}>MAIN EVENT</span> : null}
                </div>

                <div className={styles.slotTypeRow}>
                  <button className={match.type === "SINGLES" ? styles.typeActive : styles.secondaryButton} type="button" onClick={() => setMatchType(matchIndex, "SINGLES")} disabled={!view.canEdit}>Singles</button>
                  <button className={match.type === "TAG" ? styles.typeActive : styles.secondaryButton} type="button" onClick={() => setMatchType(matchIndex, "TAG")} disabled={!view.canEdit}>Tag Team</button>
                </div>

                <div className={styles.sides}>
                  <div className={styles.side}>
                    <span className={styles.sideLabel}>Side A</span>
                    {match.sideAIds.map((personId, slotIndex) => (
                      <select key={`A-${slotIndex}`} value={personId} disabled={!view.canEdit} onChange={(event) => setParticipant(matchIndex, "A", slotIndex, event.target.value)}>
                        <option value="">Choose wrestler</option>{participantOptions(personId)}
                      </select>
                    ))}
                  </div>
                  <div className={styles.versus}>VS</div>
                  <div className={styles.side}>
                    <span className={styles.sideLabel}>Side B</span>
                    {match.sideBIds.map((personId, slotIndex) => (
                      <select key={`B-${slotIndex}`} value={personId} disabled={!view.canEdit} onChange={(event) => setParticipant(matchIndex, "B", slotIndex, event.target.value)}>
                        <option value="">Choose wrestler</option>{participantOptions(personId)}
                      </select>
                    ))}
                  </div>
                </div>

                <div className={styles.controls}>
                  <div className={styles.control}><label>Winner</label><select value={match.intendedWinnerSide} disabled={!view.canEdit} onChange={(event) => updateMatch(matchIndex, { intendedWinnerSide: event.target.value as "A" | "B" })}><option value="A">Side A</option><option value="B">Side B</option></select></div>
                  <div className={styles.control}><label>Intent</label><select value={match.intent} disabled={!view.canEdit} onChange={(event) => { const intent=event.target.value as AlphaCardMatchView["intent"]; updateMatch(matchIndex, { intent, plannedFinish: defaultFinishForIntent(intent) }); }}>{MATCH_INTENTS.map((intent) => <option key={intent} value={intent}>{intentLabel(intent)}</option>)}</select></div>
                  <div className={styles.control}><label>Finish</label><select value={finish} disabled={!view.canEdit} onChange={(event) => updateMatch(matchIndex, { plannedFinish: event.target.value as BookableFinish })}>{MATCH_FINISHES.map((item) => <option key={item} value={item}>{finishLabel(item)}</option>)}</select></div>
                  <div className={styles.control}><label>Minutes</label><input type="number" min={3} max={60} inputMode="numeric" value={match.plannedLengthMinutes} disabled={!view.canEdit} onChange={(event) => updateMatch(matchIndex, { plannedLengthMinutes: Math.max(3, Math.min(60, Number(event.target.value) || 3)) })} /></div>
                  <div className={styles.control}>
                    <label>Championship</label>
                    <select value={assignment?.championshipId ?? ""} disabled={!view.canEdit} onChange={(event) => assignChampionship(match.draftMatchId, event.target.value)}>
                      <option value="">Non-title match</option>
                      {view.championships.filter((championship) => championship.division === match.type).map((championship) => {
                        const usedElsewhere = titleAssignments.some((candidate) => candidate.championshipId === championship.championshipId && candidate.draftMatchId !== match.draftMatchId);
                        const unavailable = usedElsewhere || !holderEligible(championship, match);
                        return <option key={championship.championshipId} value={championship.championshipId} disabled={unavailable}>{championship.name}{championship.holderName ? ` · ${championship.holderName}` : " · Vacant"}</option>;
                      })}
                    </select>
                  </div>
                </div>

                <div className={styles.actions}>
                  <button className={styles.secondaryButton} type="button" disabled={!view.canEdit || matchIndex === 0} onClick={() => moveMatch(matchIndex, -1)}>↑ Earlier</button>
                  <button className={styles.secondaryButton} type="button" disabled={!view.canEdit || matchIndex === card.length - 1} onClick={() => moveMatch(matchIndex, 1)}>↓ Later</button>
                  <button className={styles.removeButton} type="button" disabled={!view.canEdit} onClick={() => removeMatch(matchIndex)}>Remove</button>
                </div>
              </article>
            );
          })}
        </div>

        <div className={styles.addSlotBar}>
          <span>Add match slot</span>
          <div>
            <button className={styles.secondaryButton} type="button" onClick={() => addMatch("SINGLES")} disabled={!view.canEdit}>+ Singles</button>
            <button className={styles.secondaryButton} type="button" onClick={() => addMatch("TAG")} disabled={!view.canEdit}>+ Tag Team</button>
          </div>
        </div>

        {!completeMatches && card.length > 0 ? <div className={styles.assignmentWarning}>Choose every wrestler before saving.</div> : null}
        {duplicateBooking ? <div className={styles.assignmentWarning}>A wrestler can only be booked in one match on this show.</div> : null}
        {uniqueBookedCount > 0 && uniqueBookedCount < view.minParticipants ? <div className={styles.assignmentWarning}>Book at least {view.minParticipants} unique wrestlers before saving the show.</div> : null}

        <div className={styles.saveBar}>
          <button className="primary-button" type="button" disabled={!canSave} onClick={() => void save()}>{saving ? "Saving booking…" : view.reservationId ? "Save & refresh reservation" : "Save show booking"}</button>
          {saved ? <div className={styles.saved}>Booking saved · talent reservation refreshed</div> : null}
        </div>
      </section>
    </main>
  );
}
