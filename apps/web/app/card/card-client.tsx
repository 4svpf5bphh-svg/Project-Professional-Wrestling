"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type {
  AlphaCardChampionshipView,
  AlphaCardMatchView,
  AlphaCardParticipantView,
  AlphaCardSegmentView,
  AlphaCardSlotView,
  AlphaChampionshipAssignmentView,
  AlphaCurrentWeekCardView,
  AlphaShowCardRequest,
} from "../../../../dist/packages/web-adapter/src/card-service.js";
import type { MatchFinish } from "../../../../dist/packages/sim-core/src/match-finishes.js";
import {
  assessMatchStyleReadiness,
  defaultMatchStyleForIntent,
  evaluateMatchStyleLoad,
} from "../../../../dist/packages/sim-core/src/match-style.js";
import styles from "./card.module.css";

type ErrorPayload = { error?: string };
type BookableFinish = Exclude<MatchFinish, "INJURY_STOPPAGE">;

const MATCH_INTENTS: AlphaCardMatchView["intent"][] = [
  "COMPETITIVE", "SHOWCASE", "DOMINANT", "TECHNICAL",
  "HIGH_RISK", "STORY", "PROTECTIVE", "EPIC",
];
const MATCH_FINISHES: BookableFinish[] = ["CLEAN_PIN", "SUBMISSION", "FLASH_PIN", "PROTECTED_FINISH"];
const SEGMENT_TYPES: AlphaCardSegmentView["type"][] = [
  "PROMO", "INTERVIEW", "CONFRONTATION", "CHALLENGE", "ATTACK", "CELEBRATION", "TURN",
];
const SHOW_TIME_GUIDE_MINUTES = 120;
const STYLE_DIMENSIONS = [
  ["competitiveness", "Competitive"],
  ["technical", "Technical"],
  ["story", "Story"],
  ["intensity", "Intensity"],
  ["risk", "Risk"],
  ["epic", "Epic"],
] as const;
type StyleDimension = typeof STYLE_DIMENSIONS[number][0];

function isErrorPayload(payload: AlphaCurrentWeekCardView | ErrorPayload): payload is ErrorPayload {
  return "error" in payload;
}

function requestedDraftId(): string | null {
  if (typeof window === "undefined") return null;
  return new URLSearchParams(window.location.search).get("draftId")?.trim() || null;
}

function freshId(prefix: "match" | "segment"): string {
  return `alpha-${prefix}:${crypto.randomUUID()}`;
}

function defaultFinishForIntent(intent: AlphaCardMatchView["intent"]): BookableFinish {
  if (intent === "PROTECTIVE") return "PROTECTED_FINISH";
  if (intent === "STORY") return "FLASH_PIN";
  return "CLEAN_PIN";
}

function pretty(value: string): string {
  return value.replaceAll("_", " ").toLowerCase().replace(/(^|\s)\S/g, (letter) => letter.toUpperCase());
}

function finishLabel(value: BookableFinish): string {
  if (value === "CLEAN_PIN") return "Clean pin";
  if (value === "SUBMISSION") return "Submission";
  if (value === "FLASH_PIN") return "Flash pin";
  return "Protected / controversial";
}

function sameStyle(
  left: NonNullable<AlphaCardMatchView["style"]>,
  right: NonNullable<AlphaCardMatchView["style"]>,
): boolean {
  return STYLE_DIMENSIONS.every(([dimension]) => left[dimension] === right[dimension]);
}

function cloneMatches(matches: AlphaCardMatchView[]): AlphaCardMatchView[] {
  return matches.map((match) => ({
    ...match,
    sideAIds: [...match.sideAIds],
    sideBIds: [...match.sideBIds],
    style: { ...(match.style ?? defaultMatchStyleForIntent(match.intent)) },
    plannedFinish: match.plannedFinish ?? defaultFinishForIntent(match.intent),
  }));
}

function cloneSegments(segments: AlphaCardSegmentView[]): AlphaCardSegmentView[] {
  return segments.map((segment) => ({ ...segment, participantIds: [...segment.participantIds] }));
}

function cloneOrder(order: AlphaCardSlotView[]): AlphaCardSlotView[] {
  return order.map((slot) => ({ ...slot }));
}

function cloneAssignments(assignments: AlphaChampionshipAssignmentView[]): AlphaChampionshipAssignmentView[] {
  return assignments.map((assignment) => ({ ...assignment }));
}

function segmentMinimum(type: AlphaCardSegmentView["type"]): number {
  return type === "CONFRONTATION" || type === "CHALLENGE" || type === "ATTACK" ? 2 : 1;
}

function MinuteField(props: {
  value: number;
  min: number;
  max: number;
  disabled: boolean;
  onCommit: (value: number) => void;
}): React.JSX.Element {
  const [draft, setDraft] = useState(String(props.value));
  const cancelBlur = useRef(false);

  useEffect(() => {
    setDraft(String(props.value));
  }, [props.value]);

  function commit(): void {
    if (cancelBlur.current) {
      cancelBlur.current = false;
      setDraft(String(props.value));
      return;
    }
    const parsed = Number(draft);
    if (!draft.trim() || !Number.isFinite(parsed)) {
      setDraft(String(props.value));
      return;
    }
    const next = Math.max(props.min, Math.min(props.max, Math.round(parsed)));
    setDraft(String(next));
    if (next !== props.value) props.onCommit(next);
  }

  return (
    <input
      type="number"
      min={props.min}
      max={props.max}
      inputMode="numeric"
      value={draft}
      disabled={props.disabled}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === "Enter") event.currentTarget.blur();
        if (event.key === "Escape") {
          cancelBlur.current = true;
          setDraft(String(props.value));
          event.currentTarget.blur();
        }
      }}
    />
  );
}

export default function CardClient(): React.JSX.Element {
  const [view, setView] = useState<AlphaCurrentWeekCardView | null>(null);
  const [matches, setMatches] = useState<AlphaCardMatchView[]>([]);
  const [segments, setSegments] = useState<AlphaCardSegmentView[]>([]);
  const [runningOrder, setRunningOrder] = useState<AlphaCardSlotView[]>([]);
  const [titleAssignments, setTitleAssignments] = useState<AlphaChampionshipAssignmentView[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedSlotKey, setExpandedSlotKey] = useState<string | null>(null);
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
      setMatches(cloneMatches(payload.matches));
      setSegments(cloneSegments(payload.segments));
      setRunningOrder(cloneOrder(payload.runningOrder));
      setTitleAssignments(cloneAssignments(payload.championshipAssignments));
      setExpandedSlotKey(null);
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

  const matchPersonIds = useMemo(
    () => matches.flatMap((match) => [...match.sideAIds, ...match.sideBIds]).filter(Boolean),
    [matches],
  );
  const allBookedPersonIds = useMemo(
    () => [
      ...matchPersonIds,
      ...segments.flatMap((segment) => segment.participantIds).filter(Boolean),
    ],
    [matchPersonIds, segments],
  );
  const uniqueBookedCount = new Set(allBookedPersonIds).size;
  const bookedMinutes = matches.reduce((sum, match) => sum + match.plannedLengthMinutes, 0)
    + segments.reduce((sum, segment) => sum + segment.plannedLengthMinutes, 0);
  const minutesRemaining = SHOW_TIME_GUIDE_MINUTES - bookedMinutes;
  const duplicateMatchBooking = new Set(matchPersonIds).size !== matchPersonIds.length;
  const completeMatches = matches.every((match) => [...match.sideAIds, ...match.sideBIds].every(Boolean));
  const completeSegments = segments.every((segment) => (
    segment.participantIds.length >= segmentMinimum(segment.type)
    && segment.participantIds.length <= 4
    && segment.participantIds.every(Boolean)
    && new Set(segment.participantIds).size === segment.participantIds.length
    && (segment.type !== "TURN" || (
      Boolean(segment.turnPersonId)
      && segment.participantIds.includes(segment.turnPersonId ?? "")
      && Boolean(segment.turnTargetAlignment)
      && segment.turnTargetAlignment !== personAlignment(segment.turnPersonId ?? "")
    ))
  ));
  const hasCurrentStyleRefusal = matches.some((match) => {
    const readiness = liveMatchReadiness(match);
    return readiness?.status === "REFUSES" && !readiness.provisional;
  });
  const canSave = Boolean(
    view?.canEdit
    && matches.length > 0
    && completeMatches
    && completeSegments
    && !duplicateMatchBooking
    && !hasCurrentStyleRefusal
    && uniqueBookedCount >= (view?.minParticipants ?? 0)
    && uniqueBookedCount <= (view?.maxParticipants ?? Number.MAX_SAFE_INTEGER)
    && !saving
  );

  function markDirty(): void {
    setSaved(false);
    requestId.current = null;
  }

  function addMatch(type: AlphaCardMatchView["type"]): void {
    const id = freshId("match");
    const size = type === "TAG" ? 2 : 1;
    setMatches((current) => [...current, {
      draftMatchId: id,
      type,
      sideAIds: Array.from({ length: size }, () => ""),
      sideBIds: Array.from({ length: size }, () => ""),
      intendedWinnerSide: "A",
      intent: "COMPETITIVE",
      style: { ...defaultMatchStyleForIntent("COMPETITIVE") },
      plannedLengthMinutes: type === "TAG" ? 15 : 12,
      plannedFinish: "CLEAN_PIN",
    }]);
    setRunningOrder((current) => [...current, { kind: "MATCH", refId: id }]);
    setExpandedSlotKey(`MATCH:${id}`);
    markDirty();
  }

  function addSegment(type: AlphaCardSegmentView["type"] = "PROMO"): void {
    const id = freshId("segment");
    setSegments((current) => [...current, {
      draftSegmentId: id,
      type,
      participantIds: Array.from({ length: segmentMinimum(type) }, () => ""),
      programmeId: null,
      plannedLengthMinutes: 6,
      turnPersonId: null,
      turnTargetAlignment: null,
    }]);
    setRunningOrder((current) => [...current, { kind: "SEGMENT", refId: id }]);
    setExpandedSlotKey(`SEGMENT:${id}`);
    markDirty();
  }

  function updateMatch(matchId: string, patch: Partial<AlphaCardMatchView>): void {
    setMatches((current) => current.map((match) => match.draftMatchId === matchId ? { ...match, ...patch } : match));
    markDirty();
  }

  function setMatchPreset(matchId: string, intent: AlphaCardMatchView["intent"]): void {
    updateMatch(matchId, {
      intent,
      style: { ...defaultMatchStyleForIntent(intent) },
      plannedFinish: defaultFinishForIntent(intent),
    });
  }

  function setStyleDimension(matchId: string, dimension: StyleDimension, value: number): void {
    const match = matches.find((candidate) => candidate.draftMatchId === matchId);
    if (!match) return;
    const style = { ...(match.style ?? defaultMatchStyleForIntent(match.intent)) };
    style[dimension] = Math.max(0, Math.min(100, Math.round(value)));
    updateMatch(matchId, { style });
  }

  function participantView(personId: string): AlphaCardParticipantView | null {
    if (!view || !personId) return null;
    return view.availableParticipants.find((person) => person.personId === personId)
      ?? view.participants.find((person) => person.personId === personId)
      ?? null;
  }

  function liveMatchReadiness(match: AlphaCardMatchView): AlphaCardMatchView["readiness"] {
    if (!view || !match.style) return undefined;
    const ids = [...match.sideAIds, ...match.sideBIds].filter(Boolean);
    if (ids.length === 0) return undefined;
    const provisional = view.targetDate.year > view.world.year
      || (view.targetDate.year === view.world.year && view.targetDate.week > view.world.week);
    const participants = ids.flatMap((personId) => {
      const person = participantView(personId);
      if (!person) return [];
      const assessment = assessMatchStyleReadiness(
        match.style!,
        person.skills,
        match.plannedLengthMinutes,
        person.fatigue,
        person.wear,
      );
      return [{
        personId,
        name: person.name,
        status: assessment.status,
        reasons: [...assessment.reasons],
        capability: assessment.capability,
        shortfall: assessment.shortfall,
        physicalLoad: assessment.physicalLoad,
      }];
    });
    const rank = { COMFORTABLE: 0, CONCERNED: 1, REFUSES: 2 } as const;
    const status = participants.reduce<"COMFORTABLE" | "CONCERNED" | "REFUSES">(
      (worst, participant) => rank[participant.status] > rank[worst] ? participant.status : worst,
      "COMFORTABLE",
    );
    return { status, provisional, participants };
  }

  function stylePresetLabel(match: AlphaCardMatchView): string {
    if (!match.style) return pretty(match.intent);
    const preset = defaultMatchStyleForIntent(match.intent);
    return sameStyle(match.style, preset) ? pretty(match.intent) : `${pretty(match.intent)} · Custom`;
  }

  function readinessReasonLabel(reason: string): string {
    if (reason === "FATIGUE") return "fatigue";
    if (reason === "WEAR") return "physical wear";
    if (reason === "STYLE_STRETCH") return "style stretch";
    if (reason === "RISK_SAFETY") return "risk vs safety";
    if (reason === "ENDURANCE") return "length vs stamina";
    if (reason === "PHYSICAL_LOAD") return "physical demand";
    return pretty(reason);
  }

  function setMatchType(matchId: string, type: AlphaCardMatchView["type"]): void {
    const size = type === "TAG" ? 2 : 1;
    updateMatch(matchId, {
      type,
      sideAIds: Array.from({ length: size }, () => ""),
      sideBIds: Array.from({ length: size }, () => ""),
    });
    setTitleAssignments((current) => current.filter((entry) => entry.draftMatchId !== matchId));
  }

  function setMatchParticipant(matchId: string, side: "A" | "B", slotIndex: number, personId: string): void {
    const match = matches.find((candidate) => candidate.draftMatchId === matchId);
    if (!match) return;
    const ids = [...(side === "A" ? match.sideAIds : match.sideBIds)];
    ids[slotIndex] = personId;
    updateMatch(matchId, side === "A" ? { sideAIds: ids } : { sideBIds: ids });
  }

  function updateSegment(segmentId: string, patch: Partial<AlphaCardSegmentView>): void {
    setSegments((current) => current.map((segment) => (
      segment.draftSegmentId === segmentId ? { ...segment, ...patch } : segment
    )));
    markDirty();
  }

  function setSegmentType(segmentId: string, type: AlphaCardSegmentView["type"]): void {
    const segment = segments.find((candidate) => candidate.draftSegmentId === segmentId);
    if (!segment) return;
    const minimum = segmentMinimum(type);
    const participantIds = [...segment.participantIds];
    while (participantIds.length < minimum) participantIds.push("");
    updateSegment(segmentId, {
      type,
      participantIds,
      turnPersonId: type === "TURN"
        ? (segment.turnPersonId && participantIds.includes(segment.turnPersonId) ? segment.turnPersonId : participantIds.find(Boolean) ?? null)
        : null,
      turnTargetAlignment: type === "TURN" ? (segment.turnTargetAlignment ?? null) : null,
    });
  }

  function setSegmentProgramme(segmentId: string, programmeId: string): void {
    const segment = segments.find((candidate) => candidate.draftSegmentId === segmentId);
    if (!segment || !view) return;
    if (!programmeId) {
      updateSegment(segmentId, { programmeId: null });
      return;
    }
    const programme = view.programmes.find((candidate) => candidate.programmeId === programmeId);
    const allowed = new Set(programme?.participantIds ?? []);
    const minimum = segmentMinimum(segment.type);
    let participantIds = segment.participantIds.filter((personId) => !personId || allowed.has(personId));
    while (participantIds.length < minimum) participantIds.push("");
    updateSegment(segmentId, {
      programmeId,
      participantIds,
      turnPersonId: segment.turnPersonId && participantIds.includes(segment.turnPersonId) ? segment.turnPersonId : null,
    });
  }

  function setSegmentParticipant(segmentId: string, index: number, personId: string): void {
    const segment = segments.find((candidate) => candidate.draftSegmentId === segmentId);
    if (!segment) return;
    const participantIds = [...segment.participantIds];
    participantIds[index] = personId;
    updateSegment(segmentId, {
      participantIds,
      turnPersonId: segment.type === "TURN" ? (segment.turnPersonId ?? null) : null,
    });
  }

  function setTurnPerson(segmentId: string, personId: string): void {
    const segment = segments.find((candidate) => candidate.draftSegmentId === segmentId);
    if (!segment || segment.type !== "TURN") return;
    const previousTurner = segment.turnPersonId ?? null;
    const otherParticipants = segment.participantIds.filter((candidate) => (
      Boolean(candidate)
      && candidate !== previousTurner
      && candidate !== personId
    ));
    const participantIds = personId
      ? [personId, ...otherParticipants]
      : otherParticipants.length > 0 ? otherParticipants : [""];
    const targetMatchesNewCurrent = personId
      && segment.turnTargetAlignment
      && segment.turnTargetAlignment === personAlignment(personId);
    updateSegment(segmentId, {
      participantIds,
      turnPersonId: personId || null,
      turnTargetAlignment: targetMatchesNewCurrent ? null : (segment.turnTargetAlignment ?? null),
    });
  }

  function addSegmentParticipant(segmentId: string): void {
    const segment = segments.find((candidate) => candidate.draftSegmentId === segmentId);
    if (!segment || segment.participantIds.length >= 4) return;
    updateSegment(segmentId, { participantIds: [...segment.participantIds, ""] });
  }

  function removeSegmentParticipant(segmentId: string, index: number): void {
    const segment = segments.find((candidate) => candidate.draftSegmentId === segmentId);
    if (!segment || segment.participantIds.length <= segmentMinimum(segment.type)) return;
    const participantIds = segment.participantIds.filter((_, personIndex) => personIndex !== index);
    updateSegment(segmentId, {
      participantIds,
      turnPersonId: segment.turnPersonId && participantIds.includes(segment.turnPersonId)
        ? segment.turnPersonId
        : segment.type === "TURN" ? (participantIds.find(Boolean) ?? null) : null,
    });
  }

  function removeSlot(slot: AlphaCardSlotView): void {
    if (slot.kind === "MATCH") {
      setMatches((current) => current.filter((match) => match.draftMatchId !== slot.refId));
      setTitleAssignments((current) => current.filter((entry) => entry.draftMatchId !== slot.refId));
    } else {
      setSegments((current) => current.filter((segment) => segment.draftSegmentId !== slot.refId));
    }
    setRunningOrder((current) => current.filter((candidate) => !(candidate.kind === slot.kind && candidate.refId === slot.refId)));
    const key = `${slot.kind}:${slot.refId}`;
    setExpandedSlotKey((current) => current === key ? null : current);
    markDirty();
  }

  function moveSlot(index: number, direction: -1 | 1): void {
    const target = index + direction;
    if (target < 0 || target >= runningOrder.length) return;
    setRunningOrder((current) => {
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

  function personBookedInOtherMatch(personId: string, matchId: string, currentId: string): boolean {
    if (!personId || personId === currentId) return false;
    return matches.some((match) => match.draftMatchId !== matchId && [...match.sideAIds, ...match.sideBIds].includes(personId));
  }

  function personAlignment(personId: string): AlphaCardParticipantView["alignment"] | null {
    if (!view || !personId) return null;
    return view.availableParticipants.find((person) => person.personId === personId)?.alignment
      ?? view.participants.find((person) => person.personId === personId)?.alignment
      ?? null;
  }

  function personName(personId: string): string {
    if (!view || !personId) return "TBD";
    return view.availableParticipants.find((person) => person.personId === personId)?.name
      ?? view.participants.find((person) => person.personId === personId)?.name
      ?? "Unknown wrestler";
  }

  function matchSummary(match: AlphaCardMatchView): string {
    const sideA = match.sideAIds.map(personName).join(" & ");
    const sideB = match.sideBIds.map(personName).join(" & ");
    const winner = match.intendedWinnerSide === "A" ? sideA : sideB;
    return `${sideA} vs ${sideB} · ${match.plannedLengthMinutes} min · ${stylePresetLabel(match)} · Winner: ${winner || "TBD"}`;
  }

  function segmentSummary(segment: AlphaCardSegmentView): string {
    const people = segment.participantIds.map(personName).join(" · ") || "No wrestlers selected";
    if (segment.type === "TURN") {
      const who = segment.turnPersonId ? personName(segment.turnPersonId) : "Choose wrestler";
      const target = segment.turnTargetAlignment ? pretty(segment.turnTargetAlignment) : "Choose alignment";
      return `Turn · ${who} → ${target} · ${segment.plannedLengthMinutes} min`;
    }
    return `${pretty(segment.type)} · ${people} · ${segment.plannedLengthMinutes} min`;
  }

  function holderEligible(championship: AlphaCardChampionshipView, match: AlphaCardMatchView): boolean {
    if (championship.holderPersonIds.length === 0) return true;
    const ids = [...match.sideAIds, ...match.sideBIds];
    return championship.holderPersonIds.every((personId) => ids.includes(personId));
  }

  function segmentEligiblePeople(segment: AlphaCardSegmentView): AlphaCardParticipantView[] {
    if (!view) return [];
    const programme = segment.programmeId
      ? view.programmes.find((candidate) => candidate.programmeId === segment.programmeId)
      : null;
    const allowed = programme ? new Set(programme.participantIds) : null;
    return view.availableParticipants.filter((person) => !allowed || allowed.has(person.personId));
  }

  function segmentPersonOptions(segment: AlphaCardSegmentView, currentId: string): React.JSX.Element[] {
    return segmentEligiblePeople(segment).map((person) => (
      <option
        key={person.personId}
        value={person.personId}
        disabled={segment.participantIds.some((personId) => personId === person.personId && personId !== currentId)}
      >
        {person.name} · {person.alignment} · POP {Math.round(person.popularity)}
      </option>
    ));
  }

  async function save(): Promise<void> {
    if (!view || !canSave) return;
    setSaving(true);
    setError(null);
    try {
      if (!requestId.current) requestId.current = crypto.randomUUID();
      const matchRank = new Map(
        runningOrder.filter((slot) => slot.kind === "MATCH").map((slot, index) => [slot.refId, index]),
      );
      const orderedMatches = cloneMatches(matches).sort((left, right) => (
        (matchRank.get(left.draftMatchId) ?? Number.MAX_SAFE_INTEGER)
        - (matchRank.get(right.draftMatchId) ?? Number.MAX_SAFE_INTEGER)
      ));
      const body: AlphaShowCardRequest = {
        requestId: requestId.current,
        expectedRevision: view.world.revision,
        expectedPlanVersion: view.workspaceVersion,
        draftId: view.draftId,
        matches: orderedMatches,
        segments: cloneSegments(segments),
        runningOrder: cloneOrder(runningOrder),
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
      setMatches(cloneMatches(payload.matches));
      setSegments(cloneSegments(payload.segments));
      setRunningOrder(cloneOrder(payload.runningOrder));
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

  const lastMatchId = [...runningOrder].reverse().find((slot) => slot.kind === "MATCH")?.refId ?? null;

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
        <p className="muted body-copy">Build the show in order. Wrestlers chosen in matches or segments become the shared-World talent reservation automatically.</p>

        <div className={styles.summary}>
          <div><span>Booked talent</span><strong>{uniqueBookedCount} / {view.maxParticipants}</strong></div>
          <div><span>Minimum</span><strong>{view.minParticipants}</strong></div>
          <div><span>Show time</span><strong>{bookedMinutes} min</strong></div>
          <div><span>Guide left</span><strong className={minutesRemaining < 0 ? styles.timeOver : undefined}>{minutesRemaining >= 0 ? `${minutesRemaining} min` : `${Math.abs(minutesRemaining)} over`}</strong></div>
        </div>

        <div className={styles.cardList}>
          {runningOrder.length === 0 ? (
            <div className={styles.emptySlot}>
              <strong>Add your first slot</strong>
              <span>Build the show from matches and segments in the order the audience will see them.</span>
              <div className={styles.emptyActions}>
                <button type="button" onClick={() => addMatch("SINGLES")} disabled={!view.canEdit}>+ Match</button>
                <button type="button" onClick={() => addSegment()} disabled={!view.canEdit}>+ Segment</button>
              </div>
            </div>
          ) : null}

          {runningOrder.map((slot, slotIndex) => {
            if (slot.kind === "MATCH") {
              const match = matches.find((candidate) => candidate.draftMatchId === slot.refId);
              if (!match) return null;
              const assignment = assignmentForMatch(match.draftMatchId);
              const finish = (match.plannedFinish ?? defaultFinishForIntent(match.intent)) as BookableFinish;
              const style = match.style ?? defaultMatchStyleForIntent(match.intent);
              const styleLoad = evaluateMatchStyleLoad(style, match.plannedLengthMinutes);
              const readiness = liveMatchReadiness({ ...match, style });
              const concernPeople = readiness?.participants.filter((person) => person.status !== "COMFORTABLE") ?? [];
              const slotKey = `MATCH:${slot.refId}`;
              const expanded = expandedSlotKey === slotKey;
              const participantOptions = (currentId: string) => view.availableParticipants.map((person) => (
                <option
                  key={person.personId}
                  value={person.personId}
                  disabled={personBookedInOtherMatch(person.personId, match.draftMatchId, currentId)}
                >
                  {person.name} · {person.alignment} · POP {Math.round(person.popularity)}
                </option>
              ));
              return (
                <article className={`${styles.matchCard} ${match.draftMatchId === lastMatchId ? styles.mainEventCard : ""}`} key={slotKey}>
                  <button
                    className={styles.slotToggle}
                    type="button"
                    aria-expanded={expanded}
                    onClick={() => setExpandedSlotKey(expanded ? null : slotKey)}
                  >
                    <div className={styles.slotHeading}>
                      <span className={styles.slotNumber}>SLOT {slotIndex + 1} · MATCH</span>
                      <strong>{matchSummary(match)}</strong>
                    </div>
                    <div className={styles.slotHeaderBadges}>
                      {match.draftMatchId === lastMatchId ? <span className={styles.mainEvent}>MAIN EVENT</span> : null}
                      <span className={styles.chevron}>{expanded ? "▲" : "▼"}</span>
                    </div>
                  </button>

                  {expanded ? <>
                  <div className={styles.slotTypeRow}>
                    <button className={match.type === "SINGLES" ? styles.typeActive : styles.secondaryButton} type="button" onClick={() => setMatchType(match.draftMatchId, "SINGLES")} disabled={!view.canEdit}>Singles</button>
                    <button className={match.type === "TAG" ? styles.typeActive : styles.secondaryButton} type="button" onClick={() => setMatchType(match.draftMatchId, "TAG")} disabled={!view.canEdit}>Tag Team</button>
                  </div>

                  <div className={styles.sides}>
                    <div className={styles.side}>
                      <span className={styles.sideLabel}>Side A</span>
                      {match.sideAIds.map((personId, personIndex) => (
                        <select key={`A-${personIndex}`} value={personId} disabled={!view.canEdit} onChange={(event) => setMatchParticipant(match.draftMatchId, "A", personIndex, event.target.value)}>
                          <option value="">Choose wrestler</option>{participantOptions(personId)}
                        </select>
                      ))}
                    </div>
                    <div className={styles.versus}>VS</div>
                    <div className={styles.side}>
                      <span className={styles.sideLabel}>Side B</span>
                      {match.sideBIds.map((personId, personIndex) => (
                        <select key={`B-${personIndex}`} value={personId} disabled={!view.canEdit} onChange={(event) => setMatchParticipant(match.draftMatchId, "B", personIndex, event.target.value)}>
                          <option value="">Choose wrestler</option>{participantOptions(personId)}
                        </select>
                      ))}
                    </div>
                  </div>

                  <div className={styles.controls}>
                    <div className={styles.control}><label>Winner</label><select value={match.intendedWinnerSide} disabled={!view.canEdit} onChange={(event) => updateMatch(match.draftMatchId, { intendedWinnerSide: event.target.value as "A" | "B" })}><option value="A">Side A</option><option value="B">Side B</option></select></div>
                    <div className={styles.control}><label>Preset</label><select value={match.intent} disabled={!view.canEdit} onChange={(event) => setMatchPreset(match.draftMatchId, event.target.value as AlphaCardMatchView["intent"])}>{MATCH_INTENTS.map((intent) => <option key={intent} value={intent}>{pretty(intent)}</option>)}</select></div>
                    <div className={styles.control}><label>Finish</label><select value={finish} disabled={!view.canEdit} onChange={(event) => updateMatch(match.draftMatchId, { plannedFinish: event.target.value as BookableFinish })}>{MATCH_FINISHES.map((item) => <option key={item} value={item}>{finishLabel(item)}</option>)}</select></div>
                    <div className={styles.control}><label>Minutes</label><MinuteField value={match.plannedLengthMinutes} min={3} max={60} disabled={!view.canEdit} onCommit={(plannedLengthMinutes) => updateMatch(match.draftMatchId, { plannedLengthMinutes })} /></div>
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

                  <details className={styles.stylePanel}>
                    <summary>
                      <span>
                        <b>Tune Style</b>
                        <small>{stylePresetLabel(match)} · {pretty(styleLoad.band)} load</small>
                      </span>
                      <span className={
                        readiness?.status === "REFUSES"
                          ? styles.readinessRefuses
                          : readiness?.status === "CONCERNED"
                            ? styles.readinessConcerned
                            : styles.readinessComfortable
                      }>
                        {readiness ? pretty(readiness.status) : "Choose wrestlers"}
                        {readiness?.provisional ? " · provisional" : ""}
                      </span>
                    </summary>
                    <div className={styles.styleGrid}>
                      {STYLE_DIMENSIONS.map(([dimension, label]) => (
                        <label className={styles.styleSlider} key={dimension}>
                          <span><b>{label}</b><strong>{style[dimension]}</strong></span>
                          <input
                            type="range"
                            min={0}
                            max={100}
                            step={5}
                            value={style[dimension]}
                            disabled={!view.canEdit}
                            onChange={(event) => setStyleDimension(match.draftMatchId, dimension, Number(event.target.value))}
                          />
                        </label>
                      ))}
                    </div>
                    <div className={styles.styleReadout}>
                      <span>Physical {Math.round(styleLoad.physical)} · Creative {Math.round(styleLoad.creative)} · Total {Math.round(styleLoad.total)}</span>
                      {concernPeople.length > 0 ? (
                        <span>
                          {concernPeople.map((person) => (
                            `${person.name}: ${pretty(person.status)} (${person.reasons.map(readinessReasonLabel).join(", ")})`
                          )).join(" · ")}
                        </span>
                      ) : <span>Wrestlers are comfortable with this demand.</span>}
                      {readiness?.provisional ? <em>Future-card assessment will be checked again when the show materialises.</em> : null}
                    </div>
                  </details>

                  <div className={styles.actions}>
                    <button className={styles.secondaryButton} type="button" disabled={!view.canEdit || slotIndex === 0} onClick={() => moveSlot(slotIndex, -1)}>↑ Earlier</button>
                    <button className={styles.secondaryButton} type="button" disabled={!view.canEdit || slotIndex === runningOrder.length - 1} onClick={() => moveSlot(slotIndex, 1)}>↓ Later</button>
                    <button className={styles.removeButton} type="button" disabled={!view.canEdit} onClick={() => removeSlot(slot)}>Remove</button>
                  </div>
                  </> : null}
                </article>
              );
            }

            const segment = segments.find((candidate) => candidate.draftSegmentId === slot.refId);
            if (!segment) return null;
            const slotKey = `SEGMENT:${slot.refId}`;
            const expanded = expandedSlotKey === slotKey;
            const usedProgrammeElsewhere = new Set(
              segments
                .filter((candidate) => candidate.draftSegmentId !== segment.draftSegmentId && candidate.programmeId)
                .map((candidate) => candidate.programmeId),
            );
            return (
              <article className={`${styles.matchCard} ${styles.segmentCard}`} key={slotKey}>
                <button
                  className={styles.slotToggle}
                  type="button"
                  aria-expanded={expanded}
                  onClick={() => setExpandedSlotKey(expanded ? null : slotKey)}
                >
                  <div className={styles.slotHeading}>
                    <span className={styles.slotNumber}>SLOT {slotIndex + 1} · SEGMENT</span>
                    <strong>{segmentSummary(segment)}</strong>
                  </div>
                  <div className={styles.slotHeaderBadges}>
                    <span className={styles.segmentBadge}>{pretty(segment.type)}</span>
                    <span className={styles.chevron}>{expanded ? "▲" : "▼"}</span>
                  </div>
                </button>

                {expanded ? <>
                <div className={styles.controls}>
                  <div className={styles.control}>
                    <label>What happens?</label>
                    <select value={segment.type} disabled={!view.canEdit} onChange={(event) => setSegmentType(segment.draftSegmentId, event.target.value as AlphaCardSegmentView["type"])}>
                      {SEGMENT_TYPES.map((type) => <option key={type} value={type}>{pretty(type)}</option>)}
                    </select>
                  </div>
                  <div className={styles.control}>
                    <label>Active Programme</label>
                    <select value={segment.programmeId ?? ""} disabled={!view.canEdit} onChange={(event) => setSegmentProgramme(segment.draftSegmentId, event.target.value)}>
                      <option value="">No Programme attached</option>
                      {view.programmes.map((programme) => (
                        <option key={programme.programmeId} value={programme.programmeId} disabled={usedProgrammeElsewhere.has(programme.programmeId)}>
                          {programme.label}{programme.heat === null ? "" : ` · Heat ${Math.round(programme.heat)}`}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className={styles.control}>
                    <label>Minutes</label>
                    <MinuteField value={segment.plannedLengthMinutes} min={2} max={20} disabled={!view.canEdit} onCommit={(plannedLengthMinutes) => updateSegment(segment.draftSegmentId, { plannedLengthMinutes })} />
                  </div>
                </div>

                {segment.type === "TURN" ? (
                  <div className={styles.controls}>
                    <div className={styles.control}>
                      <label>Who turns?</label>
                      <select
                        value={segment.turnPersonId ?? ""}
                        disabled={!view.canEdit}
                        onChange={(event) => setTurnPerson(segment.draftSegmentId, event.target.value)}
                      >
                        <option value="">Choose wrestler</option>
                        {segmentEligiblePeople(segment).map((person) => (
                          <option key={person.personId} value={person.personId}>
                            {person.name} · {person.alignment} · POP {Math.round(person.popularity)}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className={styles.control}>
                      <label>Turns to</label>
                      <select
                        value={segment.turnTargetAlignment ?? ""}
                        disabled={!view.canEdit}
                        onChange={(event) => updateSegment(segment.draftSegmentId, {
                          turnTargetAlignment: (event.target.value || null) as AlphaCardSegmentView["turnTargetAlignment"],
                        })}
                      >
                        <option value="">Choose alignment</option>
                        {(["FACE", "HEEL", "TWEENER"] as const).map((alignment) => {
                          const current = view.availableParticipants.find((person) => person.personId === segment.turnPersonId)?.alignment
                            ?? view.participants.find((person) => person.personId === segment.turnPersonId)?.alignment;
                          return <option key={alignment} value={alignment} disabled={current === alignment}>{pretty(alignment)}{current === alignment ? " · current" : ""}</option>;
                        })}
                      </select>
                    </div>
                  </div>
                ) : null}

                {segment.type === "TURN" ? (
                  <div className={styles.segmentPeople}>
                    <div className={styles.segmentPeopleHeader}>
                      <span>Others involved (optional)</span>
                      <small>{segment.programmeId ? "Limited to this Programme" : "Add anyone else involved in the turn"}</small>
                    </div>
                    {segment.participantIds.map((personId, personIndex) => {
                      if (personId === segment.turnPersonId) return null;
                      return (
                        <div className={styles.segmentPersonRow} key={personIndex}>
                          <select value={personId} disabled={!view.canEdit} onChange={(event) => setSegmentParticipant(segment.draftSegmentId, personIndex, event.target.value)}>
                            <option value="">Choose wrestler</option>{segmentPersonOptions(segment, personId)}
                          </select>
                          <button type="button" className={styles.smallRemove} disabled={!view.canEdit || segment.participantIds.length <= 1} onClick={() => removeSegmentParticipant(segment.draftSegmentId, personIndex)}>×</button>
                        </div>
                      );
                    })}
                    <button
                      type="button"
                      className={styles.secondaryButton}
                      disabled={!view.canEdit || !segment.turnPersonId || segment.participantIds.length >= 4}
                      onClick={() => addSegmentParticipant(segment.draftSegmentId)}
                    >
                      + Add another wrestler
                    </button>
                    {view.programmes.length > 0 ? <a className={styles.programmeLink} href="/programmes">Manage Programmes →</a> : <a className={styles.programmeLink} href="/programmes">Start a Programme →</a>}
                  </div>
                ) : (
                  <div className={styles.segmentPeople}>
                    <div className={styles.segmentPeopleHeader}>
                      <span>Who is involved?</span>
                      {segment.programmeId ? <small>Limited to this Programme</small> : <small>Any contracted wrestler</small>}
                    </div>
                    {segment.participantIds.map((personId, personIndex) => (
                      <div className={styles.segmentPersonRow} key={personIndex}>
                        <select value={personId} disabled={!view.canEdit} onChange={(event) => setSegmentParticipant(segment.draftSegmentId, personIndex, event.target.value)}>
                          <option value="">Choose wrestler</option>{segmentPersonOptions(segment, personId)}
                        </select>
                        <button type="button" className={styles.smallRemove} disabled={!view.canEdit || segment.participantIds.length <= segmentMinimum(segment.type)} onClick={() => removeSegmentParticipant(segment.draftSegmentId, personIndex)}>×</button>
                      </div>
                    ))}
                    <button type="button" className={styles.secondaryButton} disabled={!view.canEdit || segment.participantIds.length >= 4} onClick={() => addSegmentParticipant(segment.draftSegmentId)}>+ Add wrestler</button>
                    {view.programmes.length > 0 ? <a className={styles.programmeLink} href="/programmes">Manage Programmes →</a> : <a className={styles.programmeLink} href="/programmes">Start a Programme →</a>}
                  </div>
                )}

                <div className={styles.actions}>
                  <button className={styles.secondaryButton} type="button" disabled={!view.canEdit || slotIndex === 0} onClick={() => moveSlot(slotIndex, -1)}>↑ Earlier</button>
                  <button className={styles.secondaryButton} type="button" disabled={!view.canEdit || slotIndex === runningOrder.length - 1} onClick={() => moveSlot(slotIndex, 1)}>↓ Later</button>
                  <button className={styles.removeButton} type="button" disabled={!view.canEdit} onClick={() => removeSlot(slot)}>Remove</button>
                </div>
                </> : null}
              </article>
            );
          })}
        </div>

        <div className={styles.addSlotBar}>
          <span>Add next slot</span>
          <div>
            <button className={styles.secondaryButton} type="button" onClick={() => addMatch("SINGLES")} disabled={!view.canEdit}>+ Match</button>
            <button className={styles.secondaryButton} type="button" onClick={() => addSegment()} disabled={!view.canEdit}>+ Segment</button>
          </div>
        </div>

        {!completeMatches && matches.length > 0 ? <div className={styles.assignmentWarning}>Choose every wrestler in each match before saving.</div> : null}
        {!completeSegments && segments.length > 0 ? <div className={styles.assignmentWarning}>Complete every segment and choose the required wrestlers before saving.</div> : null}
        {duplicateMatchBooking ? <div className={styles.assignmentWarning}>A wrestler can only be booked in one match, but may also appear in segments.</div> : null}
        {hasCurrentStyleRefusal ? <div className={styles.refusalWarning}>A wrestler refuses the current match style. Lower the demand or change the booking before saving.</div> : null}
        {uniqueBookedCount > 0 && uniqueBookedCount < view.minParticipants ? <div className={styles.assignmentWarning}>Use at least {view.minParticipants} unique wrestlers across matches and segments before saving.</div> : null}

        <div className={styles.saveBar}>
          <button className="primary-button" type="button" disabled={!canSave} onClick={() => void save()}>{saving ? "Saving booking…" : view.reservationId ? "Save & refresh reservation" : "Save show booking"}</button>
          {saved ? <div className={styles.saved}>Booking saved · running order and talent reservation refreshed</div> : null}
        </div>
      </section>
    </main>
  );
}
