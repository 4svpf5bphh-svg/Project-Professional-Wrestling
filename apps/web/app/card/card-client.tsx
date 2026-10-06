"use client";

import { useEffect, useRef, useState } from "react";
import type {
  AlphaCardChampionshipView,
  AlphaCardMatchView,
  AlphaChampionshipAssignmentView,
  AlphaCurrentWeekCardView,
  AlphaRecentMeetingView,
} from "../../../../dist/packages/web-adapter/src/card-service.js";
import styles from "./card.module.css";

type ErrorPayload = { error?: string };

type ParticipantBooking = {
  matchIndex: number;
  side: "A" | "B";
  slotIndex: number;
};

type BookableFinish = NonNullable<AlphaCardMatchView["plannedFinish"]>;

const SHOW_TIME_GUIDE_MINUTES = 120;
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
const MATCH_FINISHES: BookableFinish[] = [
  "CLEAN_PIN",
  "SUBMISSION",
  "FLASH_PIN",
  "PROTECTED_FINISH",
];

function isErrorPayload(payload: AlphaCurrentWeekCardView | ErrorPayload): payload is ErrorPayload {
  return "error" in payload;
}

function intentLabel(value: AlphaCardMatchView["intent"]): string {
  return value.replaceAll("_", " ");
}

function defaultFinishForIntent(intent: AlphaCardMatchView["intent"]): BookableFinish {
  if (intent === "TECHNICAL") return "SUBMISSION";
  if (intent === "STORY" || intent === "PROTECTIVE") return "PROTECTED_FINISH";
  return "CLEAN_PIN";
}

function finishLabel(value: BookableFinish): string {
  if (value === "CLEAN_PIN") return "Clean pin";
  if (value === "SUBMISSION") return "Submission";
  if (value === "FLASH_PIN") return "Flash pin";
  return "Protected / controversial";
}

function freshMatchId(): string {
  return `alpha-card:${crypto.randomUUID()}`;
}

function defaultCard(view: AlphaCurrentWeekCardView): AlphaCardMatchView[] {
  if (view.matches.length > 0) return view.matches.map((match) => ({
    ...match,
    sideAIds: [...match.sideAIds],
    sideBIds: [...match.sideBIds],
    plannedFinish: match.plannedFinish ?? defaultFinishForIntent(match.intent),
  }));

  const matches: AlphaCardMatchView[] = [];
  for (let index = 0; index < view.participants.length; index += 2) {
    const sideA = view.participants[index];
    const sideB = view.participants[index + 1];
    if (!sideA || !sideB) continue;
    matches.push({
      draftMatchId: `${view.draftId}:match:${matches.length + 1}`,
      type: "SINGLES",
      sideAIds: [sideA.personId],
      sideBIds: [sideB.personId],
      intendedWinnerSide: "A",
      intent: "COMPETITIVE",
      plannedLengthMinutes: 12,
      plannedFinish: "CLEAN_PIN",
    });
  }
  return matches;
}

function cloneCard(matches: AlphaCardMatchView[]): AlphaCardMatchView[] {
  return matches.map((match) => ({
    ...match,
    sideAIds: [...match.sideAIds],
    sideBIds: [...match.sideBIds],
  }));
}

function titleHolderCanAppearInMatch(
  championship: AlphaCardChampionshipView,
  match: AlphaCardMatchView,
): boolean {
  if (championship.holderPersonIds.length === 0) return true;
  if (championship.holderPersonIds.length === 1) {
    return [...match.sideAIds, ...match.sideBIds].includes(championship.holderPersonIds[0]!);
  }
  if (match.type !== "TAG" || championship.holderPersonIds.length !== 2) return false;
  const holderKey = [...championship.holderPersonIds].sort().join(":");
  return [match.sideAIds, match.sideBIds].some((side) => [...side].sort().join(":") === holderKey);
}

function requestedDraftId(): string | null {
  if (typeof window === "undefined") return null;
  const value = new URLSearchParams(window.location.search).get("draftId")?.trim() ?? "";
  return value || null;
}

function MatchDurationInput(props: {
  value: number;
  disabled: boolean;
  onCommit: (minutes: number) => void;
}): React.JSX.Element {
  const [draft, setDraft] = useState(String(props.value));

  useEffect(() => {
    setDraft(String(props.value));
  }, [props.value]);

  function commit(): void {
    const parsed = draft.trim() === "" ? props.value : Number(draft);
    const finite = Number.isFinite(parsed) ? parsed : props.value;
    const normalized = Math.max(3, Math.min(60, Math.round(finite)));
    setDraft(String(normalized));
    if (normalized !== props.value) props.onCommit(normalized);
  }

  return (
    <input
      type="number"
      min={3}
      max={60}
      step={1}
      inputMode="numeric"
      value={draft}
      disabled={props.disabled}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === "Enter") event.currentTarget.blur();
      }}
    />
  );
}

export default function CardClient(): React.JSX.Element {
  const [view, setView] = useState<AlphaCurrentWeekCardView | null>(null);
  const [card, setCard] = useState<AlphaCardMatchView[]>([]);
  const [titleAssignments, setTitleAssignments] = useState<AlphaChampionshipAssignmentView[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
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
        throw new Error(isErrorPayload(payload) && payload.error ? payload.error : "Unable to load match card");
      }
      setView(payload);
      setCard(defaultCard(payload));
      setTitleAssignments(payload.championshipAssignments.map((assignment) => ({ ...assignment })));
      setSaved(payload.matches.length > 0);
      requestId.current = null;
    } catch (reason) {
      setView(null);
      setCard([]);
      setTitleAssignments([]);
      setError(reason instanceof Error ? reason.message : "Unable to load match card");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load().catch(() => undefined);
  }, []);

  function markDirty(): void {
    setSaved(false);
    requestId.current = null;
  }

  function participantName(personId: string): string {
    if (!personId) return "Unassigned";
    return view?.participants.find((person) => person.personId === personId)?.name ?? personId;
  }

  function sideName(match: AlphaCardMatchView, side: "A" | "B"): string {
    const ids = side === "A" ? match.sideAIds : match.sideBIds;
    const names = ids.filter(Boolean).map(participantName);
    return names.length > 0 ? names.join(" & ") : "Unassigned";
  }

  function assignmentForMatch(draftMatchId: string): AlphaChampionshipAssignmentView | undefined {
    return titleAssignments.find((assignment) => assignment.draftMatchId === draftMatchId);
  }

  function bookingForPerson(personId: string): ParticipantBooking | null {
    for (let matchIndex = 0; matchIndex < card.length; matchIndex += 1) {
      const match = card[matchIndex]!;
      const sideAIndex = match.sideAIds.indexOf(personId);
      if (sideAIndex >= 0) return { matchIndex, side: "A", slotIndex: sideAIndex };
      const sideBIndex = match.sideBIds.indexOf(personId);
      if (sideBIndex >= 0) return { matchIndex, side: "B", slotIndex: sideBIndex };
    }
    return null;
  }

  function setParticipant(
    matchIndex: number,
    side: "A" | "B",
    slotIndex: number,
    nextPersonId: string,
  ): void {
    const occupied = nextPersonId ? bookingForPerson(nextPersonId) : null;
    if (
      occupied
      && (occupied.matchIndex !== matchIndex || occupied.side !== side || occupied.slotIndex !== slotIndex)
    ) return;

    setCard((current) => {
      const next = cloneCard(current);
      const targetMatch = next[matchIndex];
      if (!targetMatch) return current;
      const targetSide = side === "A" ? targetMatch.sideAIds : targetMatch.sideBIds;
      if (targetSide[slotIndex] === nextPersonId) return current;
      targetSide[slotIndex] = nextPersonId;
      return next;
    });
    markDirty();
  }

  function updateMatch(matchIndex: number, patch: Partial<AlphaCardMatchView>): void {
    setCard((current) => current.map((match, index) => index === matchIndex ? { ...match, ...patch } : match));
    markDirty();
  }

  function assignChampionship(draftMatchId: string, championshipId: string): void {
    setTitleAssignments((current) => {
      const withoutMatch = current.filter((assignment) => assignment.draftMatchId !== draftMatchId);
      if (!championshipId) return withoutMatch;
      return [
        ...withoutMatch.filter((assignment) => assignment.championshipId !== championshipId),
        { draftMatchId, championshipId },
      ];
    });
    markDirty();
  }

  function moveMatch(matchIndex: number, direction: -1 | 1): void {
    setCard((current) => {
      const destination = matchIndex + direction;
      if (destination < 0 || destination >= current.length) return current;
      const next = cloneCard(current);
      const [moved] = next.splice(matchIndex, 1);
      if (!moved) return current;
      next.splice(destination, 0, moved);
      return next;
    });
    markDirty();
  }

  function mergeWithNext(matchIndex: number): void {
    const firstId = card[matchIndex]?.draftMatchId;
    const secondId = card[matchIndex + 1]?.draftMatchId;
    if (firstId && secondId) {
      setTitleAssignments((current) => current.filter(
        (assignment) => assignment.draftMatchId !== firstId && assignment.draftMatchId !== secondId,
      ));
    }
    setCard((current) => {
      const first = current[matchIndex];
      const second = current[matchIndex + 1];
      if (!first || !second || first.type !== "SINGLES" || second.type !== "SINGLES") return current;
      const ids = [...first.sideAIds, ...first.sideBIds, ...second.sideAIds, ...second.sideBIds];
      if (ids.some((personId) => !personId)) return current;
      const next = cloneCard(current);
      next.splice(matchIndex, 2, {
        draftMatchId: first.draftMatchId,
        type: "TAG",
        sideAIds: [first.sideAIds[0]!, second.sideAIds[0]!],
        sideBIds: [first.sideBIds[0]!, second.sideBIds[0]!],
        intendedWinnerSide: first.intendedWinnerSide,
        intent: first.intent,
        plannedLengthMinutes: Math.min(60, Math.max(8, first.plannedLengthMinutes + second.plannedLengthMinutes - 5)),
        plannedFinish: first.plannedFinish ?? defaultFinishForIntent(first.intent),
      });
      return next;
    });
    markDirty();
  }

  function splitTag(matchIndex: number): void {
    const originalId = card[matchIndex]?.draftMatchId;
    if (originalId) {
      setTitleAssignments((current) => current.filter((assignment) => assignment.draftMatchId !== originalId));
    }
    setCard((current) => {
      const match = current[matchIndex];
      if (!match || match.type !== "TAG") return current;
      if ([...match.sideAIds, ...match.sideBIds].some((personId) => !personId)) return current;
      const length = Math.max(3, Math.floor(match.plannedLengthMinutes / 2));
      const plannedFinish = match.plannedFinish ?? defaultFinishForIntent(match.intent);
      const next = cloneCard(current);
      next.splice(matchIndex, 1,
        {
          draftMatchId: match.draftMatchId,
          type: "SINGLES",
          sideAIds: [match.sideAIds[0]!],
          sideBIds: [match.sideBIds[0]!],
          intendedWinnerSide: match.intendedWinnerSide,
          intent: match.intent,
          plannedLengthMinutes: length,
          plannedFinish,
        },
        {
          draftMatchId: freshMatchId(),
          type: "SINGLES",
          sideAIds: [match.sideAIds[1]!],
          sideBIds: [match.sideBIds[1]!],
          intendedWinnerSide: match.intendedWinnerSide,
          intent: match.intent,
          plannedLengthMinutes: length,
          plannedFinish,
        },
      );
      return next;
    });
    markDirty();
  }

  function meetingForPair(leftId: string, rightId: string): AlphaRecentMeetingView | undefined {
    if (!view || !leftId || !rightId) return undefined;
    return view.recentMeetings.find((meeting) => (
      (meeting.personAId === leftId && meeting.personBId === rightId)
      || (meeting.personAId === rightId && meeting.personBId === leftId)
    ));
  }

  function recentContext(match: AlphaCardMatchView): string | null {
    if (!view) return null;
    let latest: AlphaRecentMeetingView | undefined;
    for (const leftId of match.sideAIds.filter(Boolean)) {
      for (const rightId of match.sideBIds.filter(Boolean)) {
        const meeting = meetingForPair(leftId, rightId);
        if (meeting && (!latest || meeting.weeksAgo < latest.weeksAgo)) latest = meeting;
      }
    }
    if (!latest) return null;
    const winners = latest.winnerPersonIds
      .filter((personId) => view.participants.some((person) => person.personId === personId))
      .map(participantName);
    const ago = latest.weeksAgo === 0 ? "this week" : `${latest.weeksAgo} week${latest.weeksAgo === 1 ? "" : "s"} ago`;
    return `Last faced: Year ${latest.year}, Week ${latest.week} · ${ago}${winners.length > 0 ? ` · ${winners.join(" & ")} won` : ""}`;
  }

  const assignedIds = card.flatMap((match) => [...match.sideAIds, ...match.sideBIds]).filter(Boolean);
  const uniqueAssignedIds = new Set(assignedIds);
  const unassignedParticipants = view
    ? view.participants.filter((person) => !uniqueAssignedIds.has(person.personId))
    : [];
  const cardComplete = Boolean(
    view
    && assignedIds.length === view.participants.length
    && uniqueAssignedIds.size === view.participants.length
    && unassignedParticipants.length === 0,
  );
  const bookedMinutes = card.reduce((sum, match) => sum + match.plannedLengthMinutes, 0);
  const minutesRemaining = SHOW_TIME_GUIDE_MINUTES - bookedMinutes;

  async function saveCard(): Promise<void> {
    if (!view || !view.canEdit || saving || !cardComplete) return;
    setSaving(true);
    setError(null);
    if (!requestId.current) requestId.current = crypto.randomUUID();

    try {
      const response = await fetch("/api/show-card", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requestId: requestId.current,
          expectedRevision: view.world.revision,
          expectedPlanVersion: view.workspaceVersion,
          draftId: view.draftId,
          matches: card,
          championshipAssignments: titleAssignments,
        }),
      });
      const payload = await response.json() as AlphaCurrentWeekCardView | ErrorPayload;
      if (!response.ok || isErrorPayload(payload)) {
        const message = isErrorPayload(payload) && payload.error ? payload.error : "Unable to save match card";
        if (message.includes("stale World revision") || message.includes("stale plan version")) {
          requestId.current = null;
          await load();
          throw new Error(`${message}. Latest World state loaded.`);
        }
        throw new Error(message);
      }
      setView(payload);
      setCard(defaultCard(payload));
      setTitleAssignments(payload.championshipAssignments.map((assignment) => ({ ...assignment })));
      setSaved(true);
      requestId.current = null;
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to save match card");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <main className="app-shell loading-shell">
        <div className="brand-mark">PPW</div>
        <p>Opening the booking sheet…</p>
      </main>
    );
  }

  if (!view) {
    return (
      <main className="app-shell">
        <div className={styles.header}>
          <div>
            <span className="eyebrow">MATCH CARD</span>
            <h1>Nothing to book yet</h1>
          </div>
          <a className={styles.backLink} href="/planner">← Planner</a>
        </div>
        <div className={styles.errorBox}>{error ?? "Reserve a show before booking its card."}</div>
        <p className="muted body-copy">Choose the show&apos;s market, venue and roster in the six-week planner first. The card editor only works against a real reservation.</p>
        <button className="primary-button" onClick={() => load()}>Retry</button>
      </main>
    );
  }

  return (
    <main className="app-shell">
      <div className={styles.header}>
        <div>
          <span className="eyebrow">MANUAL MATCH CARD</span>
          <h1>{view.promotion.name}</h1>
          <p className="muted">Year {view.targetDate.year} · Week {view.targetDate.week}</p>
        </div>
        <a className={styles.backLink} href="/planner">← Planner</a>
      </div>

      {error ? <div className={styles.errorBox}>{error}</div> : null}

      <section className="panel planner-panel">
        <div className="section-heading">
          <div>
            <span className="eyebrow">RESERVED SHOW</span>
            <h2>{view.venueName}</h2>
          </div>
          <span className="plan-pill plan-reserved">{view.planningState.replaceAll("_", " ")}</span>
        </div>
        <p className="muted body-copy">Book every reserved wrestler exactly once. The final match is the main event. Saving updates the same reservation; it does not create the show early.</p>
        <div className={styles.summary}>
          <div><span>Market</span><strong>{view.marketName}</strong></div>
          <div><span>Talent committed</span><strong>{view.participants.length}</strong></div>
          <div><span>Match time booked</span><strong>{bookedMinutes} / {SHOW_TIME_GUIDE_MINUTES} min</strong></div>
          <div><span>Time remaining</span><strong className={minutesRemaining < 0 ? styles.timeOver : undefined}>{minutesRemaining >= 0 ? `${minutesRemaining} min` : `${Math.abs(minutesRemaining)} min over`}</strong></div>
        </div>
        <p className={styles.timeGuide}>120 minutes is an Alpha planning guide, not a simulation limit.</p>

        <div className={styles.cardList}>
          {card.map((match, matchIndex) => {
            const isMainEvent = matchIndex === card.length - 1;
            const canMerge = match.type === "SINGLES"
              && card[matchIndex + 1]?.type === "SINGLES"
              && [...match.sideAIds, ...match.sideBIds, ...card[matchIndex + 1]!.sideAIds, ...card[matchIndex + 1]!.sideBIds].every(Boolean);
            const assignment = assignmentForMatch(match.draftMatchId);
            const selectedChampionship = assignment
              ? view.championships.find((championship) => championship.championshipId === assignment.championshipId)
              : undefined;
            const context = recentContext(match);
            const plannedFinish = match.plannedFinish ?? defaultFinishForIntent(match.intent);
            return (
              <article className={`${styles.matchCard} ${isMainEvent ? styles.mainEventCard : ""}`} key={match.draftMatchId}>
                <div className={styles.matchHeader}>
                  <div>
                    <strong>Match {matchIndex + 1} · {match.type === "TAG" ? "Tag Team" : "Singles"}</strong>
                    <div className={styles.matchMeta}>{match.plannedLengthMinutes} min · {intentLabel(match.intent)} · {finishLabel(plannedFinish)}</div>
                  </div>
                  {isMainEvent ? <span className={styles.mainEvent}>MAIN EVENT</span> : null}
                </div>

                <div className={styles.sides}>
                  <div className={styles.side}>
                    <span className={styles.sideLabel}>Side A</span>
                    {match.sideAIds.map((personId, slotIndex) => (
                      <select
                        aria-label={`Match ${matchIndex + 1} side A wrestler ${slotIndex + 1}`}
                        key={`A-${slotIndex}`}
                        value={personId}
                        disabled={!view.canEdit}
                        onChange={(event) => setParticipant(matchIndex, "A", slotIndex, event.target.value)}
                      >
                        <option value="">Unassigned</option>
                        {view.participants.map((person) => {
                          const booking = bookingForPerson(person.personId);
                          const isCurrent = person.personId === personId;
                          const unavailable = Boolean(booking && !isCurrent);
                          return (
                            <option key={person.personId} value={person.personId} disabled={unavailable}>
                              {person.name}{unavailable && booking ? ` — Booked · Match ${booking.matchIndex + 1}` : ""}
                            </option>
                          );
                        })}
                      </select>
                    ))}
                  </div>
                  <div className={styles.versus}>VS</div>
                  <div className={styles.side}>
                    <span className={styles.sideLabel}>Side B</span>
                    {match.sideBIds.map((personId, slotIndex) => (
                      <select
                        aria-label={`Match ${matchIndex + 1} side B wrestler ${slotIndex + 1}`}
                        key={`B-${slotIndex}`}
                        value={personId}
                        disabled={!view.canEdit}
                        onChange={(event) => setParticipant(matchIndex, "B", slotIndex, event.target.value)}
                      >
                        <option value="">Unassigned</option>
                        {view.participants.map((person) => {
                          const booking = bookingForPerson(person.personId);
                          const isCurrent = person.personId === personId;
                          const unavailable = Boolean(booking && !isCurrent);
                          return (
                            <option key={person.personId} value={person.personId} disabled={unavailable}>
                              {person.name}{unavailable && booking ? ` — Booked · Match ${booking.matchIndex + 1}` : ""}
                            </option>
                          );
                        })}
                      </select>
                    ))}
                  </div>
                </div>

                {context ? <div className={styles.recentContext}>{context}</div> : null}

                <div className={styles.controls}>
                  <div className={styles.control}>
                    <label>Winner</label>
                    <select
                      value={match.intendedWinnerSide}
                      disabled={!view.canEdit}
                      onChange={(event) => updateMatch(matchIndex, { intendedWinnerSide: event.target.value as "A" | "B" })}
                    >
                      <option value="A">{sideName(match, "A")}</option>
                      <option value="B">{sideName(match, "B")}</option>
                    </select>
                  </div>
                  <div className={styles.control}>
                    <label>Intent</label>
                    <select
                      value={match.intent}
                      disabled={!view.canEdit}
                      onChange={(event) => updateMatch(matchIndex, { intent: event.target.value as AlphaCardMatchView["intent"] })}
                    >
                      {MATCH_INTENTS.map((intent) => <option key={intent} value={intent}>{intentLabel(intent)}</option>)}
                    </select>
                  </div>
                  <div className={styles.control}>
                    <label>Finish</label>
                    <select
                      value={plannedFinish}
                      disabled={!view.canEdit}
                      onChange={(event) => updateMatch(matchIndex, { plannedFinish: event.target.value as BookableFinish })}
                    >
                      {MATCH_FINISHES.map((finish) => <option key={finish} value={finish}>{finishLabel(finish)}</option>)}
                    </select>
                  </div>
                  <div className={styles.control}>
                    <label>Minutes</label>
                    <MatchDurationInput
                      value={match.plannedLengthMinutes}
                      disabled={!view.canEdit}
                      onCommit={(minutes) => updateMatch(matchIndex, { plannedLengthMinutes: minutes })}
                    />
                  </div>
                  <div className={styles.control}>
                    <label>Championship</label>
                    <select
                      value={assignment?.championshipId ?? ""}
                      disabled={!view.canEdit}
                      onChange={(event) => assignChampionship(match.draftMatchId, event.target.value)}
                    >
                      <option value="">Non-title match</option>
                      {view.championships
                        .filter((championship) => championship.division === match.type)
                        .map((championship) => {
                          const usedElsewhere = titleAssignments.some((candidate) => (
                            candidate.championshipId === championship.championshipId
                            && candidate.draftMatchId !== match.draftMatchId
                          ));
                          const holderEligible = titleHolderCanAppearInMatch(championship, match);
                          const unavailable = usedElsewhere || !holderEligible;
                          const status = championship.holderName
                            ? `Champion: ${championship.holderName}`
                            : "Vacant";
                          const suffix = usedElsewhere
                            ? " · already used"
                            : !holderEligible
                              ? " · champion not in match"
                              : "";
                          return (
                            <option
                              key={championship.championshipId}
                              value={championship.championshipId}
                              disabled={unavailable}
                            >
                              {championship.name} · {status}{suffix}
                            </option>
                          );
                        })}
                    </select>
                    {selectedChampionship ? (
                      <div className={styles.titleStatus}>
                        {selectedChampionship.holderName
                          ? `Champion: ${selectedChampionship.holderName}`
                          : "Vacant championship"}
                      </div>
                    ) : null}
                  </div>
                </div>

                <div className={styles.actions}>
                  <button className={styles.secondaryButton} disabled={!view.canEdit || matchIndex === 0} onClick={() => moveMatch(matchIndex, -1)}>↑ Earlier</button>
                  <button className={styles.secondaryButton} disabled={!view.canEdit || isMainEvent} onClick={() => moveMatch(matchIndex, 1)}>↓ Later</button>
                  {match.type === "TAG" ? (
                    <button className={styles.secondaryButton} disabled={!view.canEdit || [...match.sideAIds, ...match.sideBIds].some((personId) => !personId)} onClick={() => splitTag(matchIndex)}>Split to singles</button>
                  ) : (
                    <button className={styles.secondaryButton} disabled={!view.canEdit || !canMerge} onClick={() => mergeWithNext(matchIndex)}>Merge next → tag</button>
                  )}
                </div>
              </article>
            );
          })}
        </div>

        <p className={styles.hint}>Winner and finish are separate choices. A protected / controversial finish protects the loser more but can hurt the crowd when it clashes with the match intent. Injury stoppages can still override what you booked.</p>
        <p className={styles.hint}>To change a pairing, set a slot to Unassigned first. Wrestlers already booked elsewhere stay greyed out and show the match they are currently in; nothing is silently swapped.</p>
        {!cardComplete ? (
          <div className={styles.assignmentWarning}>
            Complete the card before saving. Unassigned talent: {unassignedParticipants.length > 0 ? unassignedParticipants.map((person) => person.name).join(", ") : "check empty match slots"}.
          </div>
        ) : null}

        <div className={styles.saveBar}>
          <button className="primary-button" disabled={!view.canEdit || saving || card.length === 0 || !cardComplete} onClick={saveCard}>
            {saving ? "Saving card…" : saved ? "Save card again" : "Save complete card"}
          </button>
          {saved ? <div className={styles.saved}>✓ Manual card saved to the reserved show</div> : null}
        </div>
      </section>
    </main>
  );
}
