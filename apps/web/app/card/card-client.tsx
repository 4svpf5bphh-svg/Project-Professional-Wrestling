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
import { canMoveRunningOrderSlot, moveRunningOrderSlot } from "../../../../dist/packages/web-adapter/src/card-running-order.js";
import {
  SEGMENT_STORY_GOALS,
  firstSegmentForGoal,
  segmentDirectionHint,
  storyGoalForSegment,
  typesForStoryGoal,
} from "../../../../dist/packages/web-adapter/src/segment-story-goals.js";
import { stableStoryContinuityWarnings } from "../../../../dist/packages/web-adapter/src/stable-story-continuity.js";
import styles from "./card.module.css";

type ErrorPayload = { error?: string };
type BookableFinish = Exclude<MatchFinish, "INJURY_STOPPAGE">;
type WrestlerPickerSort = "POPULARITY" | "MOMENTUM" | "IN_RING" | "PRESENTATION" | "DATES" | "NAME";
type WrestlerPickerTarget =
  | { kind: "MATCH"; matchId: string; side: "A" | "B"; slotIndex: number; currentId: string; label: string }
  | { kind: "RUN_IN"; matchId: string; currentId: string; label: string }
  | { kind: "SEGMENT"; segmentId: string; slotIndex: number; currentId: string; label: string }
  | { kind: "TURN"; segmentId: string; currentId: string; label: string };

type WrestlerPickerOption = {
  person: AlphaCardParticipantView;
  disabledReason: string | null;
};

const MATCH_INTENTS: AlphaCardMatchView["intent"][] = [
  "COMPETITIVE", "SHOWCASE", "DOMINANT", "TECHNICAL",
  "HIGH_RISK", "STORY", "PROTECTIVE", "EPIC",
];
const MATCH_FINISHES: BookableFinish[] = ["CLEAN_PIN", "SUBMISSION", "FLASH_PIN", "PROTECTED_FINISH", "DISQUALIFICATION", "FOREIGN_OBJECT"];
const PROMO_PURPOSE_OPTIONS = [
  ["STATEMENT_OF_INTENT", "Statement of intent"],
  ["BOAST", "Brag / boast"],
  ["RALLY_FANS", "Rally the crowd"],
  ["AIR_GRIEVANCE", "Air a grievance"],
  ["ISSUE_WARNING", "Send a warning"],
] as const;
const INTERVIEW_TOPICS = [
  ["CAREER_STORY", "Career story"], ["RIVALRY_PRESSURE", "Feud pressure"],
  ["RECENT_FORM", "Recent form"], ["NEXT_STEPS", "What's next?"],
] as const;
const INTERVIEW_RESPONSES = [
  ["CANDID", "Open / candid"], ["EVASIVE", "Dodges the question"],
  ["DEFIANT", "Defiant answer"], ["WALKOUT", "Walks out"],
] as const;
const INTERVIEW_FORMATS = [
  ["BACKSTAGE", "Backstage"], ["SIT_DOWN", "Sit-down"], ["IN_RING", "In-ring"],
] as const;
const CELEBRATION_OCCASION_OPTIONS = [
  ["FAN_APPRECIATION", "Thank the fans"],
  ["SELF_CORONATION", "Self-coronation (kayfabe boast)"],
  ["RIVALRY_TAUNT", "Taunt a rival"],
  ["VICTORY_LAP", "Celebrate a real recent win"],
] as const;
const CELEBRATION_ENDING_OPTIONS = [
  ["SALUTE_CROWD", "Salute the crowd"],
  ["POSE", "Strike a pose"],
  ["TAUNT_RIVALS", "Taunt your rivals"],
  ["WALK_OFF", "Walk away"],
] as const;
const CONFRONTATION_ENDING_OPTIONS = [
  ["STAREDOWN", "Neither backs down"],
  ["INITIATOR_BACKS_DOWN", "Instigator backs down"],
  ["TARGET_BACKS_DOWN", "Target backs down"],
  ["RELUCTANT_HANDSHAKE", "Reluctant handshake"],
] as const;
const ATTACK_FORMATS = ["BLINDSIDE", "BEATDOWN", "PULL_APART_BRAWL"] as const;
const ATTACK_OBJECTIVES = ["GENERATE_HEAT", "BUILD_SYMPATHY", "ESCALATE_RIVALRY"] as const;
const RESCUE_OUTCOME_OPTIONS = [
  ["RESCUER_STANDS_TALL", "Rescuer drives attacker away"],
  ["ATTACKER_ESCAPES", "Attacker flees the save"],
  ["RESCUE_OVERWHELMED", "Rescue fails — attacker overpowers them"],
] as const;
const POST_MATCH_ENDING_OPTIONS = [
  ["ATTACKER_STANDS_TALL", "Aggressor stands tall"],
  ["VICTIM_FIGHTS_BACK", "Victim fights back"],
  ["OFFICIALS_SEPARATE", "Officials separate them"],
] as const;
const VIDEO_KINDS = [
  ["DEBUT_TEASER", "Coming soon"], ["RETURN_TEASER", "Return teaser"],
  ["CHARACTER_SPOTLIGHT", "Character spotlight"], ["RIVALRY_RECAP", "Rivalry recap"],
  ["EVENT_HYPE", "Match / event hype"], ["TRAINING_MONTAGE", "Training montage"],
] as const;
const VIDEO_GOALS = [
  ["CREATE_INTRIGUE", "Create mystery"], ["BUILD_ANTICIPATION", "Build anticipation"],
  ["ESTABLISH_THREAT", "Establish a threat"], ["BUILD_SYMPATHY", "Build sympathy"],
  ["RECAP_STAKES", "Raise the stakes"],
] as const;
const LIVE_KINDS = [
  ["DEBUT", "Promotion debut"], ["RETURN", "Comeback / return"],
  ["SURPRISE_REVEAL", "Surprise reveal"], ["INTRODUCTION", "On-screen introduction"],
] as const;
const LIVE_OBJECTIVES = [
  ["ESTABLISH_STAR", "Establish a star"], ["BUILD_EXCITEMENT", "Build excitement"],
  ["CREATE_MYSTERY", "Create a surprise"], ["UNSETTLE_RIVAL", "Unsettle a rival"],
  ["REIGNITE_PROGRAMME", "Reignite a rivalry"],
] as const;
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
  if (value === "DISQUALIFICATION") return "DQ · Opponent caught cheating";
  if (value === "FOREIGN_OBJECT") return "Foreign object · Undetected dirty win";
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

function isDirectedSegment(type: AlphaCardSegmentView["type"]): boolean {
  return type === "CHALLENGE" || type === "CONFRONTATION" || type === "INTERRUPTION" || type === "CONTRACT_SIGNING" || type === "STABLE_INVITATION" || type === "STABLE_EXIT" || type === "STABLE_RECONCILIATION";
}

function segmentMinimum(type: AlphaCardSegmentView["type"]): number {
  if (type === "VIDEO_PACKAGE") return 0;
  return type === "RESCUE" ? 3 : type === "POST_MATCH_ASSAULT" || type === "CONFRONTATION" || type === "INTERRUPTION" || type === "CHALLENGE" || type === "CONTRACT_SIGNING" || type === "STABLE_INVITATION" || type === "STABLE_EXIT" || type === "STABLE_RECONCILIATION" || type === "ATTACK" ? 2 : 1;
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

function WrestlerSlotButton({
  person,
  disabled,
  onClick,
}: {
  person: AlphaCardParticipantView | null;
  disabled: boolean;
  onClick: () => void;
}): React.JSX.Element {
  return (
    <button
      type="button"
      className={person ? styles.wrestlerSlotSelected : styles.wrestlerSlotEmpty}
      disabled={disabled}
      onClick={onClick}
    >
      {person ? (
        <>
          <span><strong>{person.name}</strong><small>{person.division === "WOMEN" ? "WOMAN" : person.division === "MEN" ? "MAN" : "DIVISION ?"} · {person.alignment}</small></span>
          <span><b>POP {Math.round(person.popularity)}</b><small>{person.unlimitedAppearances ? "Unlimited dates" : `${person.unreservedDatesRemaining} free / ${person.datesRemaining} purchased`}</small></span>
        </>
      ) : (
        <>
          <span><strong>Choose wrestler</strong><small>Search your available roster</small></span>
          <b>＋</b>
        </>
      )}
    </button>
  );
}

function WrestlerPicker({
  label,
  currentId,
  options,
  onSelect,
  onClose,
}: {
  label: string;
  currentId: string;
  options: WrestlerPickerOption[];
  onSelect: (personId: string) => void;
  onClose: () => void;
}): React.JSX.Element {
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<WrestlerPickerSort>("POPULARITY");

  useEffect(() => {
    const body = document.body;
    const previousOverflow = body.style.overflow;
    body.style.overflow = "hidden";
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  const visible = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    const filtered = options.filter(({ person }) => !normalized || person.name.toLowerCase().includes(normalized));
    return [...filtered].sort((left, right) => {
      const availability = Number(Boolean(left.disabledReason)) - Number(Boolean(right.disabledReason));
      if (availability !== 0) return availability;
      if (sort === "MOMENTUM") return right.person.momentum - left.person.momentum || left.person.name.localeCompare(right.person.name);
      if (sort === "IN_RING") return right.person.skills.inRingQuality - left.person.skills.inRingQuality || left.person.name.localeCompare(right.person.name);
      if (sort === "PRESENTATION") return right.person.skills.presentation - left.person.skills.presentation || left.person.name.localeCompare(right.person.name);
      if (sort === "DATES") return (right.person.unlimitedAppearances ? Number.MAX_SAFE_INTEGER : right.person.unreservedDatesRemaining)
        - (left.person.unlimitedAppearances ? Number.MAX_SAFE_INTEGER : left.person.unreservedDatesRemaining)
        || left.person.name.localeCompare(right.person.name);
      if (sort === "NAME") return left.person.name.localeCompare(right.person.name);
      return right.person.popularity - left.person.popularity
        || right.person.momentum - left.person.momentum
        || left.person.name.localeCompare(right.person.name);
    });
  }, [options, query, sort]);

  return (
    <div
      className={styles.pickerBackdrop}
      role="presentation"
      onMouseDown={(event) => {
        if (event.currentTarget === event.target) onClose();
      }}
    >
      <section className={styles.pickerSheet} role="dialog" aria-modal="true" aria-label={label}>
        <header className={styles.pickerHeader}>
          <div>
            <span className={styles.pickerEyebrow}>SELECT WRESTLER</span>
            <h2>{label}</h2>
          </div>
          <button type="button" className={styles.pickerClose} onClick={onClose}>Close</button>
        </header>
        <div className={styles.pickerTools}>
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search wrestler…"
            aria-label="Search wrestlers"
          />
          <select value={sort} onChange={(event) => setSort(event.target.value as WrestlerPickerSort)} aria-label="Sort wrestlers">
            <option value="POPULARITY">Popularity</option>
            <option value="MOMENTUM">Momentum</option>
            <option value="IN_RING">In-ring</option>
            <option value="PRESENTATION">Presentation</option>
            <option value="DATES">Dates remaining</option>
            <option value="NAME">Name</option>
          </select>
        </div>
        <div className={styles.pickerMeta}>
          <span>{visible.length} wrestler{visible.length === 1 ? "" : "s"}</span>
          {currentId ? <button type="button" onClick={() => onSelect("")}>Clear selection</button> : null}
        </div>
        <div className={styles.pickerList}>
          {visible.map(({ person, disabledReason }) => {
            const selected = person.personId === currentId;
            return (
              <button
                type="button"
                key={person.personId}
                className={selected ? styles.pickerRowSelected : styles.pickerRow}
                disabled={Boolean(disabledReason)}
                onClick={() => onSelect(person.personId)}
              >
                <div className={styles.pickerIdentity}>
                  <span>
                    <strong>{person.name}</strong>
                    <small className={styles.pickerDivision}>{person.division === "WOMEN" ? "WOMAN" : person.division === "MEN" ? "MAN" : "DIVISION ?"}</small>
                    <small>{person.alignment}</small>
                  </span>
                  {selected ? <em>Selected</em> : disabledReason ? <em>{disabledReason}</em> : null}
                </div>
                <div className={styles.pickerMetrics}>
                  <span>POP <b>{Math.round(person.popularity)}</b></span>
                  <span>MOM <b>{Math.round(person.momentum)}</b></span>
                  <span>RING <b>{Math.round(person.skills.inRingQuality)}</b></span>
                  <span>CRAFT <b>{Math.round(person.skills.matchCraft)}</b></span>
                  <span>PRES <b>{Math.round(person.skills.presentation)}</b></span>
                  <span>DATES <b>{person.unlimitedAppearances ? "Unlimited" : `${person.unreservedDatesRemaining} free / ${person.datesRemaining} purchased`}</b></span>
                </div>
              </button>
            );
          })}
          {visible.length === 0 ? <div className={styles.pickerEmpty}>No wrestlers match that search.</div> : null}
        </div>
      </section>
    </div>
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
  const [dirty, setDirty] = useState(false);
  const [requestingConsent, setRequestingConsent] = useState<string | null>(null);
  const [withdrawingAmendment, setWithdrawingAmendment] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedSlotKey, setExpandedSlotKey] = useState<string | null>(null);
  const [bookingMode, setBookingMode] = useState<"QUICK" | "ADVANCED">("QUICK");
  const editorCloseRef = useRef<HTMLButtonElement | null>(null);
  const [wrestlerPicker, setWrestlerPicker] = useState<WrestlerPickerTarget | null>(null);
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
      setWrestlerPicker(null);
      setSaved(false);
      setDirty(false);
      requestId.current = null;
    } catch (reason) {
      setView(null);
      setError(reason instanceof Error ? reason.message : "Unable to load show booking");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  // An editor is a focused mobile sheet, not an expanded card inside the running order.
  // The wrestler picker is a higher-priority sheet and owns Escape while it is open.
  useEffect(() => {
    if (!expandedSlotKey) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    if (!wrestlerPicker) editorCloseRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !wrestlerPicker) {
        event.preventDefault();
        setExpandedSlotKey(null);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [expandedSlotKey, wrestlerPicker]);

  function openSlotEditor(key: string): void {
    setBookingMode("QUICK");
    setExpandedSlotKey(key);
  }

  const matchPersonIds = useMemo(
    () => matches.flatMap((match) => [...match.sideAIds, ...match.sideBIds]).filter(Boolean),
    [matches],
  );
  const allBookedPersonIds = useMemo(
    () => [
      ...matchPersonIds,
      ...matches.map((match) => match.interfererPersonId ?? "").filter(Boolean),
      ...segments.flatMap((segment) => segment.participantIds).filter(Boolean),
    ],
    [matchPersonIds, matches, segments],
  );
  const uniqueBookedCount = new Set(allBookedPersonIds).size;
  const bookedMinutes = matches.reduce((sum, match) => sum + match.plannedLengthMinutes, 0)
    + segments.reduce((sum, segment) => sum + segment.plannedLengthMinutes, 0);
  const minutesRemaining = SHOW_TIME_GUIDE_MINUTES - bookedMinutes;
  const duplicateMatchBooking = new Set(matchPersonIds).size !== matchPersonIds.length;
  const completeMatches = matches.every((match) => {
    const ids = [...match.sideAIds, ...match.sideBIds];
    return ids.every(Boolean) && (
      !match.interfererPersonId
        ? !match.interferenceSide && !match.interferenceOutcome
        : Boolean(match.interferenceSide) && !ids.includes(match.interfererPersonId)
          && (match.interferenceOutcome === "THWARTED" || (
            (match.interferenceOutcome ?? "SUCCESS") === "SUCCESS"
            && match.interferenceSide === match.intendedWinnerSide
          ))
    );
  });
  const completeSegments = segments.every((segment) => (
    segment.participantIds.length >= segmentMinimum(segment.type)
    && segment.participantIds.length <= 4
    && segment.participantIds.every(Boolean)
    && new Set(segment.participantIds).size === segment.participantIds.length
    && (segment.type !== "LIVE_APPEARANCE" || Boolean(
      segment.participantIds.length === 1 && segment.liveAppearanceKind && segment.liveAppearanceObjective
    ))
    && (segment.type !== "VIDEO_PACKAGE" || Boolean(
      segment.videoSubjectPersonId
      && view?.videoSubjects.some((person) => person.personId === segment.videoSubjectPersonId)
      && segment.videoKind && segment.videoObjective && segment.videoReveal
    ))
    && (!isDirectedSegment(segment.type) || (
      Boolean(segment.initiatorPersonId) && Boolean(segment.targetPersonId)
      && segment.initiatorPersonId !== segment.targetPersonId
      && segment.participantIds.includes(segment.initiatorPersonId ?? "")
      && segment.participantIds.includes(segment.targetPersonId ?? "")
    ))
    && (segment.type !== "STABLE_RECONCILIATION" || Boolean(
      view?.availableStables.some((stable) => stable.stableId === segment.stableId
        && stable.memberIds.includes(segment.initiatorPersonId ?? "")
        && stable.formerMemberIds.includes(segment.targetPersonId ?? ""))
      && (segment.stableReconciliationOutcome === "RECONCILED" || segment.stableReconciliationOutcome === "REBUFFED")
    ))
    && (segment.type !== "STABLE_EXIT" || Boolean(
      view?.availableStables.some((stable) => stable.stableId === segment.stableId
        && stable.memberIds.includes(segment.initiatorPersonId ?? "")
        && stable.memberIds.includes(segment.targetPersonId ?? ""))
      && (segment.stableExitOutcome === "EXPELLED" || segment.stableExitOutcome === "WALKED_OUT")
    ))
    && (segment.type !== "STABLE_INVITATION" || Boolean(
      view?.availableStables.some((stable) => stable.stableId === segment.stableId
        && stable.memberIds.includes(segment.initiatorPersonId ?? "")
        && !stable.memberIds.includes(segment.targetPersonId ?? ""))
      && (segment.stableInvitationOutcome === "ACCEPTED" || segment.stableInvitationOutcome === "REFUSED")
    ))
    && (segment.type !== "ATTACK" && segment.type !== "RESCUE" && segment.type !== "POST_MATCH_ASSAULT" || (
      Boolean(segment.attackerPersonId) && Boolean(segment.victimPersonId)
      && segment.attackerPersonId !== segment.victimPersonId
      && segment.participantIds.includes(segment.attackerPersonId ?? "")
      && segment.participantIds.includes(segment.victimPersonId ?? "")
    ))
    && (segment.type !== "POST_MATCH_ASSAULT" || (() => {
      const match = matches.find((candidate) => candidate.draftMatchId === segment.sourceDraftMatchId);
      const sourceIndex = runningOrder.findIndex((slot) => slot.kind === "MATCH" && slot.refId === segment.sourceDraftMatchId);
      const segmentIndex = runningOrder.findIndex((slot) => slot.kind === "SEGMENT" && slot.refId === segment.draftSegmentId);
      return Boolean(match && segment.victimPersonId
        && [...match.sideAIds, ...match.sideBIds].includes(segment.victimPersonId)
        && segmentIndex === sourceIndex + 1);
    })())
    && (segment.type !== "RESCUE" || (
      Boolean(segment.rescuerPersonId) && segment.rescuerPersonId !== segment.attackerPersonId
      && segment.rescuerPersonId !== segment.victimPersonId
      && segment.participantIds.includes(segment.rescuerPersonId ?? "")
    ))
    && (segment.type !== "TURN" || (
      Boolean(segment.turnPersonId)
      && segment.participantIds.includes(segment.turnPersonId ?? "")
      && Boolean(segment.turnTargetAlignment)
      && segment.turnTargetAlignment !== personAlignment(segment.turnPersonId ?? "")
      && (segment.turnPresentation !== "BETRAYAL" || (
        Boolean(segment.betrayedPersonId)
        && segment.betrayedPersonId !== segment.turnPersonId
        && segment.participantIds.includes(segment.betrayedPersonId ?? "")
      ))
    ))
  ));
  const hasCurrentStyleRefusal = matches.some((match) => {
    const readiness = liveMatchReadiness(match);
    return readiness?.status === "REFUSES" && !readiness.provisional;
  });
  const saveBlockers: string[] = [];
  if (view && !view.canEdit) {
    saveBlockers.push("Card editing is closed for this show.");
  }
  if (matches.length === 0) {
    saveBlockers.push("Add at least one match to the card.");
  }
  if (matches.length > 0 && !completeMatches) {
    saveBlockers.push("Choose every wrestler in each match.");
  }
  if (segments.length > 0 && !completeSegments) {
    saveBlockers.push("Complete every segment, including post-match source match and participants, and choose all required wrestlers.");
  }
  if (duplicateMatchBooking) {
    saveBlockers.push("A wrestler can only be booked in one match. Segment appearances are still allowed.");
  }
  if (hasCurrentStyleRefusal) {
    saveBlockers.push("At least one wrestler refuses the current match style. Lower the demand or change the booking.");
  }
  if (view && matches.length > 0 && uniqueBookedCount < view.minParticipants) {
    saveBlockers.push(
      `This card currently uses ${uniqueBookedCount} unique wrestler${uniqueBookedCount === 1 ? "" : "s"}; this show requires at least ${view.minParticipants}.`,
    );
  }
  if (view && uniqueBookedCount > view.maxParticipants) {
    saveBlockers.push(
      `This card currently uses ${uniqueBookedCount} unique wrestlers; this show allows a maximum of ${view.maxParticipants}.`,
    );
  }
  const canSave = Boolean(view && saveBlockers.length === 0 && !saving);

  function markDirty(): void {
    setDirty(true);
    setSaved(false);
    requestId.current = null;
  }

  function addMatch(type: AlphaCardMatchView["type"]): void {
    const id = freshId("match");
    const size = type === "TAG" ? 2 : 1;
    setMatches((current) => [...current, {
      draftMatchId: id,
      programmeId: null,
      type,
      sideAIds: Array.from({ length: size }, () => ""),
      sideBIds: Array.from({ length: size }, () => ""),
      intendedWinnerSide: "A",
      intent: "COMPETITIVE",
      style: { ...defaultMatchStyleForIntent("COMPETITIVE") },
      plannedLengthMinutes: type === "TAG" ? 15 : 12,
      plannedFinish: "CLEAN_PIN",
      finishCheaterPersonId: null,
      interfererPersonId: null,
      interferenceSide: null,
    }]);
    setRunningOrder((current) => [...current, { kind: "MATCH", refId: id }]);
    openSlotEditor(`MATCH:${id}`);
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
      videoSubjectPersonId: type === "VIDEO_PACKAGE" ? null : undefined,
      videoKind: type === "VIDEO_PACKAGE" ? "CHARACTER_SPOTLIGHT" : null,
      videoObjective: type === "VIDEO_PACKAGE" ? "BUILD_ANTICIPATION" : null,
      videoReveal: type === "VIDEO_PACKAGE" ? "NAMED" : null,
      liveAppearanceKind: type === "LIVE_APPEARANCE" ? "INTRODUCTION" : null,
      liveAppearanceObjective: type === "LIVE_APPEARANCE" ? "ESTABLISH_STAR" : null,
      promoPurpose: type === "PROMO" ? "STATEMENT_OF_INTENT" : null,
      interviewFormat: type === "INTERVIEW" ? "BACKSTAGE" : null,
      interviewTopic: type === "INTERVIEW" ? "CAREER_STORY" : null,
      interviewResponse: type === "INTERVIEW" ? "CANDID" : null,
      celebrationOccasion: type === "CELEBRATION" ? "FAN_APPRECIATION" : null,
      celebrationEnding: type === "CELEBRATION" ? "SALUTE_CROWD" : null,
      attackerPersonId: null,
      victimPersonId: null,
      rescuerPersonId: null,
      rescueOutcome: type === "RESCUE" ? "RESCUER_STANDS_TALL" : null,
      postMatchAssaultEnding: type === "POST_MATCH_ASSAULT" ? "ATTACKER_STANDS_TALL" : null,
      sourceDraftMatchId: type === "POST_MATCH_ASSAULT"
        ? ([...runningOrder].reverse().find((slot) => slot.kind === "MATCH")?.refId ?? null) : null,
      initiatorPersonId: null,
      targetPersonId: null,
      signingOutcome: type === "CONTRACT_SIGNING" ? "SIGNED" : null,
      stableId: null,
      stableInvitationOutcome: type === "STABLE_INVITATION" ? "REFUSED" : null,
      stableExitOutcome: type === "STABLE_EXIT" ? "EXPELLED" : null,
      stableReconciliationOutcome: type === "STABLE_RECONCILIATION" ? "RECONCILED" : null,
      interruptionOutcome: type === "INTERRUPTION" ? "VERBAL_EXCHANGE" : null,
      confrontationEnding: type === "CONFRONTATION" ? "STAREDOWN" : null,
      challengeResponse: type === "CHALLENGE" ? "LEFT_OPEN" : null,
      attackPresentation: type === "ATTACK" || type === "POST_MATCH_ASSAULT" ? "BLINDSIDE" : null,
      attackObjective: type === "ATTACK" || type === "POST_MATCH_ASSAULT" ? "GENERATE_HEAT" : null,
      turnPersonId: null,
      turnTargetAlignment: null,
      turnPresentation: type === "TURN" ? "REVEAL" : null,
      betrayedPersonId: null,
    }]);
    setRunningOrder((current) => [...current, { kind: "SEGMENT", refId: id }]);
    openSlotEditor(`SEGMENT:${id}`);
    markDirty();
  }

  function updateMatch(matchId: string, patch: Partial<AlphaCardMatchView>): void {
    setMatches((current) => current.map((match) => match.draftMatchId === matchId ? { ...match, ...patch } : match));
    markDirty();
  }

  function setRunInPerson(matchId: string, personId: string): void {
    const match = matches.find((candidate) => candidate.draftMatchId === matchId);
    if (!match) return;
    updateMatch(matchId, {
      interfererPersonId: personId || null,
      interferenceSide: personId ? (match.interferenceSide ?? match.intendedWinnerSide) : null,
      interferenceOutcome: personId ? (match.interferenceOutcome ?? "SUCCESS") : null,
    });
  }

  function setMatchPreset(matchId: string, intent: AlphaCardMatchView["intent"]): void {
    updateMatch(matchId, {
      intent,
      style: { ...defaultMatchStyleForIntent(intent) },
      plannedFinish: defaultFinishForIntent(intent),
      finishCheaterPersonId: null,
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

  function teamForSide(match: AlphaCardMatchView, side: "A" | "B"): string {
    if (!view || match.type !== "TAG") return "";
    const ids = [...(side === "A" ? match.sideAIds : match.sideBIds)].sort();
    const team = view.availableTeams.find((candidate) => (
      [...candidate.memberIds].sort().join(":") === ids.join(":")
    ));
    return team?.teamId ?? "";
  }

  function teamBookedElsewhere(teamId: string, matchId: string): boolean {
    if (!view) return false;
    const team = view.availableTeams.find((candidate) => candidate.teamId === teamId);
    if (!team) return false;
    return team.memberIds.some((personId) => personBookedInOtherMatch(personId, matchId, ""));
  }

  function setMatchTeam(matchId: string, side: "A" | "B", teamId: string): void {
    if (!view || !teamId) return;
    const team = view.availableTeams.find((candidate) => candidate.teamId === teamId);
    if (!team) return;
    updateMatch(matchId, side === "A"
      ? { sideAIds: [...team.memberIds] }
      : { sideBIds: [...team.memberIds] });
  }


  function updateSegment(segmentId: string, patch: Partial<AlphaCardSegmentView>): void {
    setSegments((current) => current.map((segment) => (
      segment.draftSegmentId === segmentId ? { ...segment, ...patch } : segment
    )));
    markDirty();
  }

  function placeAfterMatch(segmentId: string, draftMatchId: string): void {
    setRunningOrder((current) => {
      const withoutSegment = current.filter((slot) => !(slot.kind === "SEGMENT" && slot.refId === segmentId));
      const matchPosition = withoutSegment.findIndex((slot) => slot.kind === "MATCH" && slot.refId === draftMatchId);
      if (matchPosition < 0) return current;
      const reordered = [...withoutSegment];
      reordered.splice(matchPosition + 1, 0, { kind: "SEGMENT", refId: segmentId });
      return reordered;
    });
  }

  function linkPostMatch(segmentId: string, draftMatchId: string): void {
    const segment = segments.find((candidate) => candidate.draftSegmentId === segmentId);
    if (!segment) return;
    const match = matches.find((candidate) => candidate.draftMatchId === draftMatchId);
    const victim = segment.victimPersonId;
    const victimIsInMatch = match && victim && [...match.sideAIds, ...match.sideBIds].includes(victim);
    const participantIds = [...segment.participantIds];
    if (!victimIsInMatch && participantIds.length > 1) participantIds[1] = "";
    updateSegment(segmentId, {
      sourceDraftMatchId: draftMatchId || null,
      victimPersonId: victimIsInMatch ? victim : null,
      participantIds,
    });
    if (draftMatchId) placeAfterMatch(segmentId, draftMatchId);
  }

  function setSegmentType(segmentId: string, type: AlphaCardSegmentView["type"]): void {
    const segment = segments.find((candidate) => candidate.draftSegmentId === segmentId);
    if (!segment) return;
    const minimum = segmentMinimum(type);
    const participantIds = type === "VIDEO_PACKAGE" ? [] :
      type === "LIVE_APPEARANCE" ? [segment.participantIds[0] ?? ""] : [...segment.participantIds];
    while (participantIds.length < minimum) participantIds.push("");
    const sourceDraftMatchId = type === "POST_MATCH_ASSAULT"
      ? (segment.type === type ? (segment.sourceDraftMatchId ?? null)
        : ([...runningOrder].reverse().find((slot) => slot.kind === "MATCH")?.refId ?? null))
      : null;
    updateSegment(segmentId, {
      type,
      participantIds,
      videoSubjectPersonId: type === "VIDEO_PACKAGE"
        ? (segment.type === type ? (segment.videoSubjectPersonId ?? null) : null) : null,
      videoKind: type === "VIDEO_PACKAGE" ? (segment.type === type ? (segment.videoKind ?? "CHARACTER_SPOTLIGHT") : "CHARACTER_SPOTLIGHT") : null,
      videoObjective: type === "VIDEO_PACKAGE" ? (segment.type === type ? (segment.videoObjective ?? "BUILD_ANTICIPATION") : "BUILD_ANTICIPATION") : null,
      videoReveal: type === "VIDEO_PACKAGE" ? (segment.type === type ? (segment.videoReveal ?? "NAMED") : "NAMED") : null,
      liveAppearanceKind: type === "LIVE_APPEARANCE" ? (segment.type === type ? (segment.liveAppearanceKind ?? "INTRODUCTION") : "INTRODUCTION") : null,
      liveAppearanceObjective: type === "LIVE_APPEARANCE" ? (segment.type === type ? (segment.liveAppearanceObjective ?? "ESTABLISH_STAR") : "ESTABLISH_STAR") : null,
      promoPurpose: type === "PROMO" ? (segment.type === type ? (segment.promoPurpose ?? "STATEMENT_OF_INTENT") : "STATEMENT_OF_INTENT") : null,
      interviewFormat: type === "INTERVIEW" ? (segment.type === type ? (segment.interviewFormat ?? "BACKSTAGE") : "BACKSTAGE") : null,
      interviewTopic: type === "INTERVIEW" ? (segment.type === type ? (segment.interviewTopic ?? "CAREER_STORY") : "CAREER_STORY") : null,
      interviewResponse: type === "INTERVIEW" ? (segment.type === type ? (segment.interviewResponse ?? "CANDID") : "CANDID") : null,
      celebrationOccasion: type === "CELEBRATION" ? (segment.type === type ? (segment.celebrationOccasion ?? "FAN_APPRECIATION") : "FAN_APPRECIATION") : null,
      celebrationEnding: type === "CELEBRATION" ? (segment.type === type ? (segment.celebrationEnding ?? "SALUTE_CROWD") : "SALUTE_CROWD") : null,
      attackerPersonId: (type === "ATTACK" || type === "RESCUE" || type === "POST_MATCH_ASSAULT") && type === segment.type && participantIds[0] === segment.attackerPersonId
        ? (segment.attackerPersonId ?? null) : null,
      victimPersonId: (type === "ATTACK" || type === "RESCUE" || type === "POST_MATCH_ASSAULT") && type === segment.type && participantIds[1] === segment.victimPersonId
        ? (segment.victimPersonId ?? null) : null,
      sourceDraftMatchId,
      rescuerPersonId: type === "RESCUE" && type === segment.type && participantIds[2] === segment.rescuerPersonId
        ? (segment.rescuerPersonId ?? null) : null,
      rescueOutcome: type === "RESCUE"
        ? (segment.type === type ? (segment.rescueOutcome ?? "RESCUER_STANDS_TALL") : "RESCUER_STANDS_TALL") : null,
      postMatchAssaultEnding: type === "POST_MATCH_ASSAULT"
        ? (segment.type === type ? (segment.postMatchAssaultEnding ?? "ATTACKER_STANDS_TALL") : "ATTACKER_STANDS_TALL") : null,
      initiatorPersonId: isDirectedSegment(type) && type === segment.type && participantIds.includes(segment.initiatorPersonId ?? "")
        ? (segment.initiatorPersonId ?? null) : null,
      targetPersonId: isDirectedSegment(type) && type === segment.type && participantIds.includes(segment.targetPersonId ?? "")
        ? (segment.targetPersonId ?? null) : null,
      signingOutcome: type === "CONTRACT_SIGNING" ? (segment.signingOutcome ?? "SIGNED") : null,
      stableId: (type === "STABLE_INVITATION" || type === "STABLE_EXIT" || type === "STABLE_RECONCILIATION") && type === segment.type ? (segment.stableId ?? null) : null,
      stableInvitationOutcome: type === "STABLE_INVITATION" ? (segment.stableInvitationOutcome ?? "REFUSED") : null,
      stableExitOutcome: type === "STABLE_EXIT" ? (segment.stableExitOutcome ?? "EXPELLED") : null,
      stableReconciliationOutcome: type === "STABLE_RECONCILIATION" ? (segment.stableReconciliationOutcome ?? "RECONCILED") : null,
      interruptionOutcome: type === "INTERRUPTION" ? (segment.interruptionOutcome ?? "VERBAL_EXCHANGE") : null,
      confrontationEnding: type === "CONFRONTATION"
        ? (segment.type === type ? (segment.confrontationEnding ?? "STAREDOWN") : "STAREDOWN") : null,
      challengeResponse: type === "CHALLENGE"
        ? (segment.type === "CHALLENGE" ? (segment.challengeResponse ?? null) : "LEFT_OPEN") : null,
      attackPresentation: type === "ATTACK" || type === "POST_MATCH_ASSAULT"
        ? (segment.type === type ? (segment.attackPresentation ?? "BLINDSIDE") : "BLINDSIDE") : null,
      attackObjective: type === "ATTACK" || type === "POST_MATCH_ASSAULT"
        ? (segment.type === type ? (segment.attackObjective ?? "GENERATE_HEAT") : "GENERATE_HEAT") : null,
      turnPersonId: type === "TURN"
        ? (segment.turnPersonId && participantIds.includes(segment.turnPersonId) ? segment.turnPersonId : participantIds.find(Boolean) ?? null)
        : null,
      turnTargetAlignment: type === "TURN" ? (segment.turnTargetAlignment ?? null) : null,
      turnPresentation: type === "TURN" ? (segment.turnPresentation ?? "REVEAL") : null,
      betrayedPersonId: type === "TURN" && segment.turnPresentation === "BETRAYAL"
        && segment.betrayedPersonId && participantIds.includes(segment.betrayedPersonId)
        && segment.betrayedPersonId !== segment.turnPersonId ? segment.betrayedPersonId : null,
    });
    if (type === "POST_MATCH_ASSAULT" && sourceDraftMatchId) placeAfterMatch(segmentId, sourceDraftMatchId);
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
    let participantIds = segment.type === "RESCUE" || segment.type === "POST_MATCH_ASSAULT"
      ? segment.participantIds.map((personId, index) => (
          !personId || allowed.has(personId)
            || (segment.type === "RESCUE" && index === 2)
            || (segment.type === "POST_MATCH_ASSAULT" && index === 0)
            ? personId : ""
        ))
      : segment.participantIds.filter((personId) => !personId || allowed.has(personId));
    while (participantIds.length < minimum) participantIds.push("");
    updateSegment(segmentId, {
      programmeId,
      participantIds,
      videoSubjectPersonId: segment.videoSubjectPersonId && !allowed.has(segment.videoSubjectPersonId)
        ? null : (segment.videoSubjectPersonId ?? null),
      victimPersonId: segment.victimPersonId && participantIds[1] === segment.victimPersonId ? segment.victimPersonId : null,
      attackerPersonId: segment.attackerPersonId && participantIds[0] === segment.attackerPersonId ? segment.attackerPersonId : null,
      rescuerPersonId: segment.rescuerPersonId && participantIds[2] === segment.rescuerPersonId ? segment.rescuerPersonId : null,
      initiatorPersonId: segment.initiatorPersonId && participantIds[0] === segment.initiatorPersonId ? segment.initiatorPersonId : null,
      targetPersonId: segment.targetPersonId && participantIds[1] === segment.targetPersonId ? segment.targetPersonId : null,
      turnPersonId: segment.turnPersonId && participantIds.includes(segment.turnPersonId) ? segment.turnPersonId : null,
      betrayedPersonId: segment.betrayedPersonId && participantIds.includes(segment.betrayedPersonId) ? segment.betrayedPersonId : null,
    });
  }

  function setSegmentParticipant(segmentId: string, index: number, personId: string): void {
    const segment = segments.find((candidate) => candidate.draftSegmentId === segmentId);
    if (!segment) return;
    const participantIds = [...segment.participantIds];
    participantIds[index] = personId;
    updateSegment(segmentId, {
      participantIds,
      attackerPersonId: (segment.type === "ATTACK" || segment.type === "RESCUE" || segment.type === "POST_MATCH_ASSAULT") && index === 0 ? (personId || null) : (segment.attackerPersonId ?? null),
      victimPersonId: (segment.type === "ATTACK" || segment.type === "RESCUE" || segment.type === "POST_MATCH_ASSAULT") && index === 1 ? (personId || null) : (segment.victimPersonId ?? null),
      rescuerPersonId: segment.type === "RESCUE" && index === 2 ? (personId || null) : (segment.rescuerPersonId ?? null),
      initiatorPersonId: isDirectedSegment(segment.type) && index === 0 ? (personId || null) : (segment.initiatorPersonId ?? null),
      targetPersonId: isDirectedSegment(segment.type) && index === 1 ? (personId || null) : (segment.targetPersonId ?? null),
      turnPersonId: segment.type === "TURN" ? (segment.turnPersonId ?? null) : null,
      betrayedPersonId: segment.type === "TURN" && segment.betrayedPersonId === segment.participantIds[index]
        ? (personId && personId !== segment.turnPersonId ? personId : null)
        : (segment.betrayedPersonId ?? null),
    });
  }

  function swapAttackRoles(segmentId: string): void {
    const segment = segments.find((candidate) => candidate.draftSegmentId === segmentId);
    if (!segment || segment.type !== "ATTACK" || !segment.participantIds[0] || !segment.participantIds[1]) return;
    const participantIds = [...segment.participantIds];
    [participantIds[0], participantIds[1]] = [participantIds[1]!, participantIds[0]!];
    updateSegment(segmentId, {
      participantIds,
      attackerPersonId: participantIds[0],
      victimPersonId: participantIds[1],
    });
  }

  function confirmDirectedPair(segmentId: string): void {
    const segment = segments.find((candidate) => candidate.draftSegmentId === segmentId);
    if (!segment || !isDirectedSegment(segment.type)) return;
    const [initiator, target] = segment.participantIds;
    if (!initiator || !target || initiator === target) return;
    updateSegment(segmentId, { initiatorPersonId: initiator, targetPersonId: target });
  }

  function swapDirectedPair(segmentId: string): void {
    const segment = segments.find((candidate) => candidate.draftSegmentId === segmentId);
    if (!segment || !isDirectedSegment(segment.type)) return;
    const [initiator, target] = segment.participantIds;
    if (!initiator || !target || initiator === target) return;
    const participantIds = [...segment.participantIds];
    participantIds[0] = target;
    participantIds[1] = initiator;
    updateSegment(segmentId, { participantIds, initiatorPersonId: target, targetPersonId: initiator });
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
      betrayedPersonId: segment.betrayedPersonId && participantIds.includes(segment.betrayedPersonId)
        && segment.betrayedPersonId !== personId ? segment.betrayedPersonId : null,
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
      betrayedPersonId: segment.betrayedPersonId && participantIds.includes(segment.betrayedPersonId)
        ? segment.betrayedPersonId : null,
    });
  }

  function removeSlot(slot: AlphaCardSlotView): void {
    if (slot.kind === "MATCH") {
      setMatches((current) => current.filter((match) => match.draftMatchId !== slot.refId));
      setSegments((current) => current.map((segment) => segment.sourceDraftMatchId === slot.refId
        ? { ...segment, sourceDraftMatchId: null, victimPersonId: null,
            participantIds: segment.participantIds.map((id, index) => index === 1 ? "" : id) }
        : segment));
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
    if (!view?.canEdit) return;
    const moved = moveRunningOrderSlot(runningOrder, segments, index, direction);
    if (!moved) return;
    setRunningOrder(moved);
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

  function pickerPerson(personId: string): AlphaCardParticipantView | null {
    return participantView(personId);
  }

  function otherMatchBookingLabel(personId: string, currentMatchId: string): string | null {
    const other = matches.find((match) => (
      match.draftMatchId !== currentMatchId
      && [...match.sideAIds, ...match.sideBIds].includes(personId)
    ));
    if (!other) return null;
    const slotIndex = runningOrder.findIndex((slot) => slot.kind === "MATCH" && slot.refId === other.draftMatchId);
    return slotIndex >= 0 ? `Booked · Slot ${slotIndex + 1}` : "Booked in another match";
  }

  function pickerOptions(target: WrestlerPickerTarget): WrestlerPickerOption[] {
    if (!view) return [];
    const pool = new Map(view.availableParticipants.map((person) => [person.personId, person]));
    const current = target.currentId ? participantView(target.currentId) : null;
    if (current) pool.set(current.personId, current);

    if (target.kind === "RUN_IN") {
      const match = matches.find((candidate) => candidate.draftMatchId === target.matchId);
      const competitorIds = new Set(match ? [...match.sideAIds, ...match.sideBIds].filter(Boolean) : []);
      return [...pool.values()].map((person) => ({
        person,
        disabledReason: competitorIds.has(person.personId) ? "Competing in this match" : null,
      }));
    }
    if (target.kind === "MATCH") {
      const match = matches.find((candidate) => candidate.draftMatchId === target.matchId);
      const sameMatchIds = new Set(match ? [...match.sideAIds, ...match.sideBIds].filter(Boolean) : []);
      sameMatchIds.delete(target.currentId);
      return [...pool.values()].map((person) => ({
        person,
        disabledReason: sameMatchIds.has(person.personId)
          ? "Already in this match"
          : otherMatchBookingLabel(person.personId, target.matchId),
      }));
    }

    const segment = segments.find((candidate) => candidate.draftSegmentId === target.segmentId);
    if (!segment) return [];
    const eligibleIds = new Set(segmentEligiblePeople(segment, target.kind === "SEGMENT" ? target.slotIndex : null).map((person) => person.personId));
    if (segment.type === "POST_MATCH_ASSAULT" && target.kind === "SEGMENT" && target.slotIndex === 1) {
      const source = matches.find((match) => match.draftMatchId === segment.sourceDraftMatchId);
      const matchPeople = new Set(source ? [...source.sideAIds, ...source.sideBIds].filter(Boolean) : []);
      for (const personId of [...eligibleIds]) if (!matchPeople.has(personId)) eligibleIds.delete(personId);
    }
    if (current && !(segment.type === "POST_MATCH_ASSAULT" && target.kind === "SEGMENT" && target.slotIndex === 1))
      eligibleIds.add(current.personId);
    const sameSegmentIds = new Set(segment.participantIds.filter(Boolean));
    sameSegmentIds.delete(target.currentId);

    return [...pool.values()]
      .filter((person) => eligibleIds.has(person.personId))
      .map((person) => ({
        person,
        disabledReason: target.kind === "TURN" || !sameSegmentIds.has(person.personId)
          ? null
          : "Already in this segment",
      }));
  }

  function selectFromPicker(personId: string): void {
    if (!wrestlerPicker) return;
    if (wrestlerPicker.kind === "MATCH") {
      setMatchParticipant(wrestlerPicker.matchId, wrestlerPicker.side, wrestlerPicker.slotIndex, personId);
    } else if (wrestlerPicker.kind === "RUN_IN") {
      setRunInPerson(wrestlerPicker.matchId, personId);
    } else if (wrestlerPicker.kind === "SEGMENT") {
      setSegmentParticipant(wrestlerPicker.segmentId, wrestlerPicker.slotIndex, personId);
    } else {
      setTurnPerson(wrestlerPicker.segmentId, personId);
    }
    setWrestlerPicker(null);
  }

  function matchSummary(match: AlphaCardMatchView): string {
    const sideA = match.sideAIds.map(personName).join(" & ");
    const sideB = match.sideBIds.map(personName).join(" & ");
    const winner = match.intendedWinnerSide === "A" ? sideA : sideB;
    return `${sideA} vs ${sideB} · ${match.plannedLengthMinutes} min · ${stylePresetLabel(match)} · Winner: ${winner || "TBD"}`;
  }

  function segmentSummary(segment: AlphaCardSegmentView): string {
    if (segment.type === "LIVE_APPEARANCE") {
      const who = segment.participantIds[0] ? personName(segment.participantIds[0]) : "Choose a wrestler";
      return `${pretty(segment.liveAppearanceKind ?? "INTRODUCTION")} · ${who} · ${segment.plannedLengthMinutes} min`;
    }
    if (segment.type === "PROMO") {
      const cast = segment.participantIds.map(personName).join(" & ") || "Choose speaker";
      return `Promo · ${pretty(segment.promoPurpose ?? "STATEMENT_OF_INTENT")} · ${cast} · ${segment.plannedLengthMinutes} min`;
    }
    if (segment.type === "INTERVIEW") {
      const cast = segment.participantIds.map(personName).join(" & ") || "Choose guest";
      return `Interview · ${pretty(segment.interviewTopic ?? "CAREER_STORY")} · ${pretty(segment.interviewResponse ?? "CANDID")} · ${cast}`;
    }
    if (segment.type === "CELEBRATION") {
      const cast = segment.participantIds.map(personName).join(" & ") || "Choose wrestler";
      return `Celebration · ${pretty(segment.celebrationOccasion ?? "FAN_APPRECIATION")} · ${pretty(segment.celebrationEnding ?? "SALUTE_CROWD")} · ${cast}`;
    }
    if (segment.type === "VIDEO_PACKAGE") {
      const subject = view?.videoSubjects.find((person) => person.personId === segment.videoSubjectPersonId)?.name
        ?? (segment.videoSubjectPersonId || "Choose featured wrestler");
      return `Video · ${pretty(segment.videoKind ?? "CHARACTER_SPOTLIGHT")} · ${subject} · ${segment.plannedLengthMinutes} min`;
    }
    const people = segment.participantIds.map(personName).join(" · ") || "No wrestlers selected";
    if (segment.type === "TURN") {
      const who = segment.turnPersonId ? personName(segment.turnPersonId) : "Choose wrestler";
      const target = segment.turnTargetAlignment ? pretty(segment.turnTargetAlignment) : "Choose alignment";
      const betrayed = segment.turnPresentation === "BETRAYAL"
        ? ` · Betrays ${segment.betrayedPersonId ? personName(segment.betrayedPersonId) : "choose wrestler"}` : "";
      return `Turn · ${who} → ${target}${betrayed} · ${segment.plannedLengthMinutes} min`;
    }
    if (isDirectedSegment(segment.type)) {
      const initiator = segment.initiatorPersonId ? personName(segment.initiatorPersonId) : "Choose initiator";
      const target = segment.targetPersonId ? personName(segment.targetPersonId) : "Choose target";
      if (segment.type === "CONFRONTATION") {
        const ending = segment.confrontationEnding ? pretty(segment.confrontationEnding) : "Unrecorded stand-off";
        return `Confrontation · ${initiator} faces ${target} · ${ending} · ${segment.plannedLengthMinutes} min`;
      }
      if (segment.type === "INTERRUPTION") {
        const beat = segment.interruptionOutcome === "INTERRUPTER_PREVAILS" ? "interrupter prevails"
          : segment.interruptionOutcome === "SPEAKER_PREVAILS" ? "speaker prevails"
          : segment.interruptionOutcome === "BRAWL" ? "brawl" : "verbal exchange";
        return `Interruption · ${initiator} interrupts ${target} · ${beat} · ${segment.plannedLengthMinutes} min`;
      }
      if (segment.type === "STABLE_RECONCILIATION") {
        const stable = view?.availableStables.find((item) => item.stableId === segment.stableId);
        return `Stable reconciliation · ${initiator} & ${target} · ${stable?.name ?? "choose stable"} · ${(segment.stableReconciliationOutcome ?? "RECONCILED").toLowerCase()} · ${segment.plannedLengthMinutes} min`;
      }
      if (segment.type === "STABLE_EXIT") {
        const stable = view?.availableStables.find((item) => item.stableId === segment.stableId);
        const ending = segment.stableExitOutcome === "WALKED_OUT" ? "walks out" : "expelled";
        return `Stable exit · ${target} ${ending} · ${stable?.name ?? "choose stable"} · ${segment.plannedLengthMinutes} min`;
      }
      if (segment.type === "STABLE_INVITATION") {
        const stable = view?.availableStables.find((item) => item.stableId === segment.stableId);
        return `Stable invitation · ${initiator} invites ${target} to ${stable?.name ?? "choose stable"} · ${(segment.stableInvitationOutcome ?? "REFUSED").toLowerCase()} · ${segment.plannedLengthMinutes} min`;
      }
      if (segment.type === "CONTRACT_SIGNING") {
        return `Contract signing · ${initiator} & ${target} · ${(segment.signingOutcome ?? "SIGNED").toLowerCase()} · ${segment.plannedLengthMinutes} min`;
      }
      if (segment.type === "CHALLENGE") {
        const response = segment.challengeResponse
          ? ` · ${segment.challengeResponse === "ACCEPTED" ? "accepted" : segment.challengeResponse === "REFUSED" ? "refused" : "left open"}`
          : "";
        return `${initiator} challenges ${target}${response} · ${segment.plannedLengthMinutes} min`;
      }
      return `${initiator} confronts ${target} · ${segment.plannedLengthMinutes} min`;
    }
    if (segment.type === "POST_MATCH_ASSAULT") {
      const attacker = segment.attackerPersonId ? personName(segment.attackerPersonId) : "Choose aggressor";
      const victim = segment.victimPersonId ? personName(segment.victimPersonId) : "Choose victim";
      const match = matches.find((candidate) => candidate.draftMatchId === segment.sourceDraftMatchId);
      const aftermath = segment.postMatchAssaultEnding ? pretty(segment.postMatchAssaultEnding) : "Unrecorded aftermath";
      return `Post-match assault · ${attacker} vs ${victim} · ${aftermath} · After ${match ? match.sideAIds.map(personName).join(" & ") + " vs " + match.sideBIds.map(personName).join(" & ") : "choose match"}`;
    }
    if (segment.type === "RESCUE") {
      const rescuer = segment.rescuerPersonId ? personName(segment.rescuerPersonId) : "Choose rescuer";
      const victim = segment.victimPersonId ? personName(segment.victimPersonId) : "Choose victim";
      const aggressor = segment.attackerPersonId ? personName(segment.attackerPersonId) : "Choose aggressor";
      const outcome = segment.rescueOutcome === "RESCUE_OVERWHELMED" ? "rescue fails"
        : segment.rescueOutcome === "ATTACKER_ESCAPES" ? "attacker escapes" : "rescuer stands tall";
      return `Rescue attempt · ${rescuer} helps ${victim} against ${aggressor} · ${outcome} · ${segment.plannedLengthMinutes} min`;
    }
    if (segment.type === "ATTACK") {
      const attacker = segment.attackerPersonId ? personName(segment.attackerPersonId) : "Choose attacker";
      const victim = segment.victimPersonId ? personName(segment.victimPersonId) : "Choose victim";
      const format = segment.attackPresentation ? pretty(segment.attackPresentation) : "Attack";
      return `${format} · ${attacker} attacks ${victim} · ${segment.plannedLengthMinutes} min`;
    }
    return `${pretty(segment.type)} · ${people} · ${segment.plannedLengthMinutes} min`;
  }

  function holderEligible(championship: AlphaCardChampionshipView, match: AlphaCardMatchView): boolean {
    if (championship.holderPersonIds.length === 0) return true;
    const ids = [...match.sideAIds, ...match.sideBIds];
    return championship.holderPersonIds.every((personId) => ids.includes(personId));
  }

  function segmentEligiblePeople(segment: AlphaCardSegmentView, slotIndex: number | null): AlphaCardParticipantView[] {
    if (!view) return [];
    const programme = segment.programmeId
      ? view.programmes.find((candidate) => candidate.programmeId === segment.programmeId)
      : null;
    const allowed = programme ? new Set(programme.participantIds) : null;
    return view.availableParticipants.filter((person) => (
      !allowed
      || (segment.type === "RESCUE" && slotIndex === 2)
      || (segment.type === "POST_MATCH_ASSAULT" && slotIndex === 0)
      || allowed.has(person.personId)
    ));
  }

  async function save(): Promise<boolean> {
    if (!view || !canSave) return false;
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
      setDirty(false);
      requestId.current = null;
      return true;
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to save show booking");
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function saveAndCloseEditor(): Promise<void> {
    if (await save()) setExpandedSlotKey(null);
  }

  async function withdrawPendingAmendment(): Promise<void> {
    if (!view || !view.canEdit || !view.cardPendingConsent || withdrawingAmendment || saving || requestingConsent) return;
    setWithdrawingAmendment(true);
    setError(null);
    try {
      const response = await fetch("/api/show-card/creative-withdraw", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requestId: crypto.randomUUID(),
          expectedRevision: view.world.revision,
          expectedPlanVersion: view.workspaceVersion,
          draftId: view.draftId,
        }),
      });
      const payload = await response.json() as AlphaCurrentWeekCardView | ErrorPayload;
      if (!response.ok || isErrorPayload(payload)) {
        throw new Error(isErrorPayload(payload) && payload.error ? payload.error : "Unable to restore committed card");
      }
      // This discards only uncommitted local/editor changes. The actual
      // scheduled card and the wrestler's contract remain untouched.
      setView(payload);
      setMatches(cloneMatches(payload.matches));
      setSegments(cloneSegments(payload.segments));
      setRunningOrder(cloneOrder(payload.runningOrder));
      setTitleAssignments(cloneAssignments(payload.championshipAssignments));
      setSaved(false);
      setDirty(false);
      requestId.current = null;
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to withdraw booking changes");
    } finally {
      setWithdrawingAmendment(false);
    }
  }

  async function askCreativeApproval(draftMatchId: string, personId: string): Promise<void> {
    if (!view || dirty || !view.canEdit || requestingConsent) return;
    const key = `${draftMatchId}:${personId}`;
    setRequestingConsent(key);
    setError(null);
    try {
      const response = await fetch("/api/show-card/creative-consent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requestId: crypto.randomUUID(),
          expectedRevision: view.world.revision,
          expectedPlanVersion: view.workspaceVersion,
          draftId: view.draftId,
          draftMatchId, personId,
        }),
      });
      const payload = await response.json() as AlphaCurrentWeekCardView | ErrorPayload;
      if (!response.ok || isErrorPayload(payload)) {
        throw new Error(isErrorPayload(payload) && payload.error ? payload.error : "Unable to request approval");
      }
      setView(payload);
      setMatches(cloneMatches(payload.matches));
      setSegments(cloneSegments(payload.segments));
      setRunningOrder(cloneOrder(payload.runningOrder));
      setTitleAssignments(cloneAssignments(payload.championshipAssignments));
      setSaved(false);
      setDirty(false);
      const declined = payload.creativeConcerns.some((entry) =>
        entry.personId === personId && entry.draftMatchId === draftMatchId && entry.consent === "DECLINED");
      if (declined) {
        setError("Wrestler declined this booking. Change the finish, participants or match, or postpone it. The planned outcome has not been altered.");
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to request approval");
    } finally {
      setRequestingConsent(null);
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
    <>
      {wrestlerPicker ? (
        <WrestlerPicker
          label={wrestlerPicker.label}
          currentId={wrestlerPicker.currentId}
          options={pickerOptions(wrestlerPicker)}
          onSelect={selectFromPicker}
          onClose={() => setWrestlerPicker(null)}
        />
      ) : null}
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
      {view.liveArrivalNeedsReview ? (
        <div className={styles.errorBox} role="alert">
          A booked live debut or return no longer matches this promotion’s completed or earlier scheduled show history.
          Edit that segment and choose a truthful introduction, or revise your card before World Lock.
          Your scripted choice has not been changed automatically.
        </div>
      ) : null}

      <section className="panel planner-panel">
        <div className="section-heading">
          <div><span className="eyebrow">RUNNING ORDER</span><h2>{view.venueName}</h2></div>
          <span className="plan-pill plan-reserved">{view.reservationId ? "RESERVED" : "DRAFT"}</span>
        </div>
        <div className={styles.summary} aria-label="Running order progress">
          <span><b>{uniqueBookedCount}/{view.maxParticipants}</b> booked <small>(min {view.minParticipants})</small></span>
          <span><b>{bookedMinutes} min</b> planned</span>
          <span className={minutesRemaining < 0 ? styles.timeOver : undefined}><b>{minutesRemaining >= 0 ? `${minutesRemaining} min` : `${Math.abs(minutesRemaining)} min`}</b> {minutesRemaining >= 0 ? "guide left" : "over guide"}</span>
        </div>
        <div className={styles.addSlotToolbar} aria-label="Add to the running order">
          <button type="button" onClick={() => addMatch("SINGLES")} disabled={!view.canEdit}>+ Match</button>
          <button type="button" onClick={() => addSegment()} disabled={!view.canEdit}>+ Segment</button>
        </div>
        {runningOrder.length === 0 ? <p className={styles.startHint}>Add a match or segment to begin your running order.</p> : null}

        <div className={styles.cardList}>
          {runningOrder.map((slot, slotIndex) => {
            if (slot.kind === "MATCH") {
              const match = matches.find((candidate) => candidate.draftMatchId === slot.refId);
              if (!match) return null;
              const assignment = assignmentForMatch(match.draftMatchId);
              const finish = (match.plannedFinish ?? defaultFinishForIntent(match.intent)) as BookableFinish;
              const cheatingSide = finish === "FOREIGN_OBJECT" ? match.intendedWinnerSide
                : finish === "DISQUALIFICATION" ? (match.intendedWinnerSide === "A" ? "B" : "A") : null;
              const cheaterOptions = cheatingSide === "A" ? match.sideAIds : cheatingSide === "B" ? match.sideBIds : [];
              const style = match.style ?? defaultMatchStyleForIntent(match.intent);
              const styleLoad = evaluateMatchStyleLoad(style, match.plannedLengthMinutes);
              const readiness = liveMatchReadiness({ ...match, style });
              const concernPeople = readiness?.participants.filter((person) => person.status !== "COMFORTABLE") ?? [];
              const slotKey = `MATCH:${slot.refId}`;
              const expanded = expandedSlotKey === slotKey;
              return (
                <article className={`${styles.matchCard} ${match.draftMatchId === lastMatchId ? styles.mainEventCard : ""}`} key={slotKey}>
                  <div className={styles.slotTopRow}>
                  <button
                    className={styles.slotToggle}
                    type="button"
                    aria-expanded={expanded}
                    onClick={() => expanded ? setExpandedSlotKey(null) : openSlotEditor(slotKey)}
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
                    <div className={styles.slotOrderControls} role="group" aria-label={`Reorder match slot ${slotIndex + 1}`}>
                      <button type="button" title="Move up" aria-label={`Move match in slot ${slotIndex + 1} up`} disabled={!view.canEdit || !canMoveRunningOrderSlot(runningOrder, segments, slotIndex, -1)} onClick={() => moveSlot(slotIndex, -1)}>↑</button>
                      <button type="button" title="Move down" aria-label={`Move match in slot ${slotIndex + 1} down`} disabled={!view.canEdit || !canMoveRunningOrderSlot(runningOrder, segments, slotIndex, 1)} onClick={() => moveSlot(slotIndex, 1)}>↓</button>
                    </div>
                  </div>

                  {expanded ? (
                    <div className={styles.editorOverlay} onClick={() => setExpandedSlotKey(null)}>
                      <section className={styles.editorSheet} role="dialog" aria-modal="true"
                        aria-labelledby={`booking-title-${slotKey}`} onClick={(event) => event.stopPropagation()}>
                        <header className={styles.editorHeading}>
                          <div>
                            <span className="eyebrow">MATCH {slotIndex + 1} · SHOW RUNDOWN</span>
                            <h2 id={`booking-title-${slotKey}`}>{matchSummary(match)}</h2>
                            <small>Changes stay in this draft until you save the show.</small>
                          </div>
                          <button ref={editorCloseRef} className={styles.editorClose} type="button"
                            onClick={() => setExpandedSlotKey(null)} aria-label="Return to running order">✕</button>
                        </header>
                        <div className={styles.editorTabs} role="group" aria-label="Booking detail">
                          <button type="button" className={bookingMode === "QUICK" ? styles.editorTabActive : styles.editorTab}
                            aria-pressed={bookingMode === "QUICK"} onClick={() => setBookingMode("QUICK")}>Quick Book</button>
                          <button type="button" className={bookingMode === "ADVANCED" ? styles.editorTabActive : styles.editorTab}
                            aria-pressed={bookingMode === "ADVANCED"} onClick={() => setBookingMode("ADVANCED")}>Advanced Booking</button>
                        </div>
                        <div className={styles.editorBody}>
                  <div className={styles.slotTypeRow}>
                    <button className={match.type === "SINGLES" ? styles.typeActive : styles.secondaryButton} type="button" onClick={() => setMatchType(match.draftMatchId, "SINGLES")} disabled={!view.canEdit}>Singles</button>
                    <button className={match.type === "TAG" ? styles.typeActive : styles.secondaryButton} type="button" onClick={() => setMatchType(match.draftMatchId, "TAG")} disabled={!view.canEdit}>Tag Team</button>
                  </div>

                  <div className={styles.control}>
                    <label htmlFor={`programme-match-${match.draftMatchId}`}>Programme · optional</label>
                    <select
                      id={`programme-match-${match.draftMatchId}`}
                      value={match.programmeId ?? ""}
                      disabled={!view.canEdit}
                      onChange={(event) => updateMatch(match.draftMatchId, {
                        programmeId: event.target.value || null,
                      })}
                    >
                      <option value="">No Programme association</option>
                      {view.programmes.map((programme) => {
                        const booked = [...match.sideAIds, ...match.sideBIds].filter(Boolean);
                        const eligible = booked.length > 0
                          && booked.every((personId) => programme.participantIds.includes(personId));
                        return (
                          <option
                            key={programme.programmeId}
                            value={programme.programmeId}
                            disabled={!eligible}
                          >{programme.label}{eligible ? "" : " · different participants"}</option>
                        );
                      })}
                    </select>
                    <small>Link this specific match to its storyline. An existing standing agreement applies only when this booking fits its exact terms. No storyline is inferred automatically.</small>
                  </div>

                  <div className={styles.sides}>
                    <div className={styles.side}>
                      <span className={styles.sideLabel}>Side A</span>
                      {match.type === "TAG" && view.availableTeams.length > 0 ? (
                        <select
                          value={teamForSide(match, "A")}
                          disabled={!view.canEdit}
                          onChange={(event) => setMatchTeam(match.draftMatchId, "A", event.target.value)}
                        >
                          <option value="">Custom pairing</option>
                          {view.availableTeams.map((team) => (
                            <option
                              key={team.teamId}
                              value={team.teamId}
                              disabled={teamBookedElsewhere(team.teamId, match.draftMatchId)}
                            >
                              {team.name} — {team.memberNames.join(" & ")}
                            </option>
                          ))}
                        </select>
                      ) : null}
                      {match.sideAIds.map((personId, personIndex) => (
                        <WrestlerSlotButton
                          key={`A-${personIndex}`}
                          person={pickerPerson(personId)}
                          disabled={!view.canEdit}
                          onClick={() => setWrestlerPicker({
                            kind: "MATCH",
                            matchId: match.draftMatchId,
                            side: "A",
                            slotIndex: personIndex,
                            currentId: personId,
                            label: `Side A · ${match.type === "TAG" ? `Wrestler ${personIndex + 1}` : "Singles"}`,
                          })}
                        />
                      ))}
                    </div>
                    <div className={styles.versus}>VS</div>
                    <div className={styles.side}>
                      <span className={styles.sideLabel}>Side B</span>
                      {match.type === "TAG" && view.availableTeams.length > 0 ? (
                        <select
                          value={teamForSide(match, "B")}
                          disabled={!view.canEdit}
                          onChange={(event) => setMatchTeam(match.draftMatchId, "B", event.target.value)}
                        >
                          <option value="">Custom pairing</option>
                          {view.availableTeams.map((team) => (
                            <option
                              key={team.teamId}
                              value={team.teamId}
                              disabled={teamBookedElsewhere(team.teamId, match.draftMatchId)}
                            >
                              {team.name} — {team.memberNames.join(" & ")}
                            </option>
                          ))}
                        </select>
                      ) : null}
                      {match.sideBIds.map((personId, personIndex) => (
                        <WrestlerSlotButton
                          key={`B-${personIndex}`}
                          person={pickerPerson(personId)}
                          disabled={!view.canEdit}
                          onClick={() => setWrestlerPicker({
                            kind: "MATCH",
                            matchId: match.draftMatchId,
                            side: "B",
                            slotIndex: personIndex,
                            currentId: personId,
                            label: `Side B · ${match.type === "TAG" ? `Wrestler ${personIndex + 1}` : "Singles"}`,
                          })}
                        />
                      ))}
                    </div>
                  </div>

                  <div className={styles.controls}>
                    <div className={styles.control}><label>Winner</label><select value={match.intendedWinnerSide} disabled={!view.canEdit} onChange={(event) => updateMatch(match.draftMatchId, { intendedWinnerSide: event.target.value as "A" | "B", finishCheaterPersonId: null })}><option value="A">Side A</option><option value="B">Side B</option></select></div>
                    <div className={styles.control}><label>Preset</label><select value={match.intent} disabled={!view.canEdit} onChange={(event) => setMatchPreset(match.draftMatchId, event.target.value as AlphaCardMatchView["intent"])}>{MATCH_INTENTS.map((intent) => <option key={intent} value={intent}>{pretty(intent)}</option>)}</select></div>
                    <div className={styles.control}><label>Finish</label><select value={finish} disabled={!view.canEdit} onChange={(event) => updateMatch(match.draftMatchId, { plannedFinish: event.target.value as BookableFinish, finishCheaterPersonId: null })}>{MATCH_FINISHES.map((item) => <option key={item} value={item}>{finishLabel(item)}</option>)}</select></div>
                    {cheatingSide ? (
                      <div className={styles.control}>
                        <label>{finish === "DISQUALIFICATION" ? "Who gets caught cheating?" : "Who uses the foreign object?"}</label>
                        {match.type === "SINGLES" ? (
                          <div>{cheaterOptions[0] ? participantView(cheaterOptions[0])?.name ?? "Selected wrestler" : "Choose both wrestlers"}</div>
                        ) : (
                          <select value={cheaterOptions.includes(match.finishCheaterPersonId ?? "") ? match.finishCheaterPersonId ?? "" : ""}
                            disabled={!view.canEdit} aria-label="Wrestler who cheats"
                            onChange={(event) => updateMatch(match.draftMatchId, { finishCheaterPersonId: event.target.value || null })}>
                            <option value="">Choose wrestler…</option>
                            {cheaterOptions.filter(Boolean).map((personId) => (
                              <option key={personId} value={personId}>{participantView(personId)?.name ?? "Selected wrestler"}</option>
                            ))}
                          </select>
                        )}
                        <small>{finish === "DISQUALIFICATION"
                          ? "The culprit's team is disqualified; the booked winner gets the match."
                          : "The referee misses it; the booked winner gets the match."}</small>
                      </div>
                    ) : null}
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

                  {bookingMode === "QUICK" && match.interfererPersonId ? (
                    <p className={styles.editorHint}>A run-in is already scripted for this match. Open Advanced Booking to review or change it.</p>
                  ) : null}
                  {bookingMode === "QUICK" && concernPeople.length > 0 ? (
                    <p className={styles.editorConcern}>Wrestler creative concerns detected. Open Advanced Booking for the details before saving.</p>
                  ) : null}
                  {bookingMode === "ADVANCED" ? <div className={styles.advancedSection}>
                  <div className={styles.segmentPeople}>
                    <div className={styles.segmentPeopleHeader}>
                      <span>Run-in / Match interference</span>
                      <small>Optional scripted spot. Choose who interferes, who they help, and whether the run-in works. The simulation judges delivery, not your storyline choice.</small>
                    </div>
                    <div className={styles.segmentPersonRow}>
                      <WrestlerSlotButton
                        person={pickerPerson(match.interfererPersonId ?? "")}
                        disabled={!view.canEdit}
                        onClick={() => setWrestlerPicker({
                          kind: "RUN_IN", matchId: match.draftMatchId,
                          currentId: match.interfererPersonId ?? "",
                          label: "Choose run-in wrestler",
                        })}
                      />
                    </div>
                    {match.interfererPersonId ? (
                      <div className={styles.control}>
                        <label>Who are they helping?</label>
                        <select value={match.interferenceSide ?? match.intendedWinnerSide} disabled={!view.canEdit}
                          onChange={(event) => updateMatch(match.draftMatchId, { interferenceSide: event.target.value as "A" | "B" })}>
                          <option value="A">Side A</option><option value="B">Side B</option>
                        </select>
                      </div>
                    ) : null}
                    {match.interfererPersonId ? (
                      <div className={styles.control}>
                        <label>Scripted result</label>
                        <select value={match.interferenceOutcome ?? "SUCCESS"} disabled={!view.canEdit}
                          onChange={(event) => updateMatch(match.draftMatchId, { interferenceOutcome: event.target.value as "SUCCESS" | "THWARTED" })}>
                          <option value="SUCCESS">Run-in succeeds</option>
                          <option value="THWARTED">Run-in is thwarted</option>
                        </select>
                      </div>
                    ) : null}
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
                  </div> : null}

                  <div className={styles.actions}>
                    
                    
                    <button className={styles.removeButton} type="button" disabled={!view.canEdit} onClick={() => removeSlot(slot)}>Remove</button>
                  </div>
                        </div>
                        <footer className={styles.editorFooter}>
                          <span>{dirty ? "Unsaved card changes" : "No new changes"}</span>
                          <div className={styles.editorFooterActions}>
                            <button className={styles.editorDoneSecondary} type="button" onClick={() => setExpandedSlotKey(null)}>Done editing</button>
                            <button className={styles.editorDone} type="button" disabled={!canSave || saving}
                              onClick={() => void saveAndCloseEditor()}>{saving ? "Saving…" : "Save show & return"}</button>
                          </div>
                        </footer>
                      </section>
                    </div>
                  ) : null}
                </article>
              );
            }

            const segment = segments.find((candidate) => candidate.draftSegmentId === slot.refId);
            if (!segment) return null;
            const slotKey = `SEGMENT:${slot.refId}`;
            const expanded = expandedSlotKey === slotKey;
            const stableContinuity = stableStoryContinuityWarnings(
              segment, view.stableStoryFollowThrough, segments,
            );
            const usedProgrammeElsewhere = new Set(
              segments
                .filter((candidate) => candidate.draftSegmentId !== segment.draftSegmentId && candidate.programmeId)
                .map((candidate) => candidate.programmeId),
            );
            return (
              <article className={`${styles.matchCard} ${styles.segmentCard}`} key={slotKey}>
                <div className={styles.slotTopRow}>
                <button
                  className={styles.slotToggle}
                  type="button"
                  aria-expanded={expanded}
                  onClick={() => expanded ? setExpandedSlotKey(null) : openSlotEditor(slotKey)}
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
                  <div className={styles.slotOrderControls} role="group" aria-label={`Reorder segment slot ${slotIndex + 1}`}>
                    <button type="button" title="Move up" aria-label={`Move segment in slot ${slotIndex + 1} up`} disabled={!view.canEdit || !canMoveRunningOrderSlot(runningOrder, segments, slotIndex, -1)} onClick={() => moveSlot(slotIndex, -1)}>↑</button>
                    <button type="button" title="Move down" aria-label={`Move segment in slot ${slotIndex + 1} down`} disabled={!view.canEdit || !canMoveRunningOrderSlot(runningOrder, segments, slotIndex, 1)} onClick={() => moveSlot(slotIndex, 1)}>↓</button>
                  </div>
                </div>

                {expanded ? (
                  <div className={styles.editorOverlay} onClick={() => setExpandedSlotKey(null)}>
                    <section className={styles.editorSheet} role="dialog" aria-modal="true"
                      aria-labelledby={`booking-title-${slotKey}`} onClick={(event) => event.stopPropagation()}>
                      <header className={styles.editorHeading}>
                        <div>
                          <span className="eyebrow">SEGMENT {slotIndex + 1} · SHOW RUNDOWN</span>
                          <h2 id={`booking-title-${slotKey}`}>{segmentSummary(segment)}</h2>
                          <small>Script the story you want the audience to see.</small>
                        </div>
                        <button ref={editorCloseRef} className={styles.editorClose} type="button"
                          onClick={() => setExpandedSlotKey(null)} aria-label="Return to running order">✕</button>
                      </header>
                      <div className={styles.editorTabs} role="group" aria-label="Segment detail">
                        <button type="button" className={bookingMode === "QUICK" ? styles.editorTabActive : styles.editorTab}
                          aria-pressed={bookingMode === "QUICK"} onClick={() => setBookingMode("QUICK")}>Quick Book</button>
                        <button type="button" className={bookingMode === "ADVANCED" ? styles.editorTabActive : styles.editorTab}
                          aria-pressed={bookingMode === "ADVANCED"} onClick={() => setBookingMode("ADVANCED")}>Advanced Booking</button>
                      </div>
                      <div className={styles.editorBody}>
                <div className={styles.storyGoalSection}>
                  <span className={styles.storyGoalPrompt}>What kind of moment are we booking?</span>
                  <div className={styles.storyGoalChoices} role="group" aria-label="Segment story goal">
                    {SEGMENT_STORY_GOALS.map((goal) => (
                      <button key={goal.id} type="button"
                        className={storyGoalForSegment(segment.type) === goal.id ? styles.storyGoalSelected : styles.storyGoalChoice}
                        aria-pressed={storyGoalForSegment(segment.type) === goal.id}
                        title={goal.description}
                        disabled={!view.canEdit}
                        onClick={() => {
                          if (storyGoalForSegment(segment.type) !== goal.id) {
                            setSegmentType(segment.draftSegmentId, firstSegmentForGoal(goal.id));
                          }
                        }}>{goal.label}</button>
                    ))}
                  </div>
                  <small>{SEGMENT_STORY_GOALS.find((goal) => goal.id === storyGoalForSegment(segment.type))?.description}</small>
                </div>
                <div className={styles.controls}>
                  <div className={styles.control}>
                    <label>How does it happen?</label>
                    <select value={segment.type} disabled={!view.canEdit} onChange={(event) => setSegmentType(segment.draftSegmentId, event.target.value as AlphaCardSegmentView["type"])}>
                      {typesForStoryGoal(storyGoalForSegment(segment.type)).map((type) => <option key={type} value={type}>{pretty(type)}</option>)}
                    </select>
                    <small className={styles.storyDirectionHint}>{segmentDirectionHint(segment.type)}</small>
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

                {segment.type === "LIVE_APPEARANCE" ? (
                  <div className={styles.segmentPeople}>
                    <div className={styles.segmentPeopleHeader}>
                      <span>Live in-person appearance</span>
                      <small>The wrestler must be available for the show and uses the normal contracted appearance date. A debut or return must match verified promotion history.</small>
                    </div>
                    <div className={styles.segmentPeopleHeader}>
                      <span>What happens on screen?</span>
                      <small>Choose the scripted introduction</small>
                    </div>
                    <div className={styles.slotTypeRow} role="group" aria-label="Live appearance type">
                      {LIVE_KINDS.map(([kind, name]) => (
                        <button type="button" key={kind} disabled={!view.canEdit}
                          aria-pressed={(segment.liveAppearanceKind ?? "INTRODUCTION") === kind}
                          className={(segment.liveAppearanceKind ?? "INTRODUCTION") === kind ? styles.typeActive : styles.secondaryButton}
                          onClick={() => updateSegment(segment.draftSegmentId, { liveAppearanceKind: kind })}>{name}</button>
                      ))}
                    </div>
                    <div className={styles.segmentPeopleHeader}>
                      <span>Booking objective</span>
                      <small>The audience response may vary; your chosen appearance always happens</small>
                    </div>
                    <div className={styles.slotTypeRow} role="group" aria-label="Live appearance objective">
                      {LIVE_OBJECTIVES.map(([objective, name]) => (
                        <button type="button" key={objective} disabled={!view.canEdit}
                          aria-pressed={(segment.liveAppearanceObjective ?? "ESTABLISH_STAR") === objective}
                          className={(segment.liveAppearanceObjective ?? "ESTABLISH_STAR") === objective ? styles.typeActive : styles.secondaryButton}
                          onClick={() => updateSegment(segment.draftSegmentId, { liveAppearanceObjective: objective })}>{name}</button>
                      ))}
                    </div>
                    <small className={styles.sideLabel}>Choose the wrestler below. Debut means first appearance for your promotion; return requires at least four PPW weeks away.</small>
                  </div>
                ) : null}
                {segment.type === "VIDEO_PACKAGE" ? (
                  <div className={styles.segmentPeople}>
                    <div className={styles.segmentPeopleHeader}>
                      <span>Pre-recorded video package</span>
                      <small>Footage does not bring the subject to the venue or spend contracted appearance dates.</small>
                    </div>
                    <div className={styles.controls}>
                      <div className={styles.control}>
                        <label>Featured wrestler (signed talent)</label>
                        <select value={segment.videoSubjectPersonId ?? ""} disabled={!view.canEdit}
                          onChange={(event) => updateSegment(segment.draftSegmentId, { videoSubjectPersonId: event.target.value || null })}>
                          <option value="">Choose subject of the footage</option>
                          {view.videoSubjects
                            .filter((person) => !segment.programmeId || view.programmes.some((programme) => (
                              programme.programmeId === segment.programmeId && programme.participantIds.includes(person.personId)
                            )))
                            .map((person) => (
                            <option value={person.personId} key={person.personId}>{person.name}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <div className={styles.segmentPeopleHeader}>
                      <span>Video format</span>
                      <small>What the audience actually sees</small>
                    </div>
                    <div className={styles.slotTypeRow}>
                      {VIDEO_KINDS.map(([kind, label]) => (
                        <button type="button" key={kind} disabled={!view.canEdit}
                          className={(segment.videoKind ?? "CHARACTER_SPOTLIGHT") === kind ? styles.typeActive : styles.secondaryButton}
                          onClick={() => updateSegment(segment.draftSegmentId, { videoKind: kind })}>{label}</button>
                      ))}
                    </div>
                    <div className={styles.segmentPeopleHeader}>
                      <span>Booking objective</span>
                      <small>The feeling you're trying to create</small>
                    </div>
                    <div className={styles.slotTypeRow}>
                      {VIDEO_GOALS.map(([objective, label]) => (
                        <button type="button" key={objective} disabled={!view.canEdit}
                          className={(segment.videoObjective ?? "BUILD_ANTICIPATION") === objective ? styles.typeActive : styles.secondaryButton}
                          onClick={() => updateSegment(segment.draftSegmentId, { videoObjective: objective })}>{label}</button>
                      ))}
                    </div>
                    <div className={styles.segmentPeopleHeader}>
                      <span>How much do we reveal?</span>
                      <small>Control exactly what the audience learns</small>
                    </div>
                    <div className={styles.slotTypeRow} role="group" aria-label="Video reveal level">
                      {([["CRYPTIC", "Cryptic / silhouette"], ["NAMED", "Name reveal"], ["FULL", "Full footage"]] as const).map(([reveal, label]) => (
                        <button type="button" key={reveal} disabled={!view.canEdit}
                          aria-pressed={(segment.videoReveal ?? "NAMED") === reveal}
                          className={(segment.videoReveal ?? "NAMED") === reveal ? styles.typeActive : styles.secondaryButton}
                          onClick={() => updateSegment(segment.draftSegmentId, { videoReveal: reveal })}>{label}</button>
                      ))}
                    </div>
                    <small className={styles.sideLabel}>A cryptic teaser conceals the wrestler's identity from the audience. A video never causes an actual debut, return, contract or recovery.</small>
                  </div>
                ) : null}

                {segment.type === "PROMO" ? (
                  <div className={styles.segmentPeople}>
                    <div className={styles.segmentPeopleHeader}>
                      <span>What's the message?</span>
                      <small>Choose one clear purpose for this promo. Challenges and confrontations are separate angles.</small>
                    </div>
                    <div className={styles.slotTypeRow} role="group" aria-label="Promo message">
                      {PROMO_PURPOSE_OPTIONS.map(([purpose, label]) => (
                        <button key={purpose} type="button" disabled={!view.canEdit}
                          aria-pressed={(segment.promoPurpose ?? "STATEMENT_OF_INTENT") === purpose}
                          className={(segment.promoPurpose ?? "STATEMENT_OF_INTENT") === purpose ? styles.typeActive : styles.secondaryButton}
                          onClick={() => updateSegment(segment.draftSegmentId, { promoPurpose: purpose })}>{label}</button>
                      ))}
                    </div>
                    <small className={styles.sideLabel}>Repeating the same message with the same wrestler can wear thin. Develop the storyline or change the subject to keep the audience interested.</small>
                  </div>
                ) : null}

                {segment.type === "INTERVIEW" ? (
                  <div className={styles.segmentPeople}>
                    <div className={styles.segmentPeopleHeader}>
                      <span>What's the interviewer asking about?</span>
                      <small>A neutral host asks the question; no extra wrestler or contract date is booked.</small>
                    </div>
                    <div className={styles.slotTypeRow} role="group" aria-label="Interview topic">
                      {INTERVIEW_TOPICS.map(([topic, label]) => (
                        <button key={topic} type="button" disabled={!view.canEdit}
                          aria-pressed={(segment.interviewTopic ?? "CAREER_STORY") === topic}
                          className={(segment.interviewTopic ?? "CAREER_STORY") === topic ? styles.typeActive : styles.secondaryButton}
                          onClick={() => updateSegment(segment.draftSegmentId, { interviewTopic: topic })}>{label}</button>
                      ))}
                    </div>
                    <div className={styles.segmentPeopleHeader}>
                      <span>How does the wrestler answer?</span>
                      <small>You script the response. The simulation judges the crowd's reaction, not what was said.</small>
                    </div>
                    <div className={styles.slotTypeRow} role="group" aria-label="Interview scripted response">
                      {INTERVIEW_RESPONSES.map(([response, label]) => (
                        <button key={response} type="button" disabled={!view.canEdit}
                          aria-pressed={(segment.interviewResponse ?? "CANDID") === response}
                          className={(segment.interviewResponse ?? "CANDID") === response ? styles.typeActive : styles.secondaryButton}
                          onClick={() => updateSegment(segment.draftSegmentId, { interviewResponse: response })}>{label}</button>
                      ))}
                    </div>
                    {bookingMode === "ADVANCED" ? (
                      <>
                        <div className={styles.segmentPeopleHeader}>
                          <span>Where does the interview happen?</span>
                          <small>A different setting, not a new type of segment or additional booked talent.</small>
                        </div>
                        <div className={styles.slotTypeRow} role="group" aria-label="Interview format">
                          {INTERVIEW_FORMATS.map(([format, label]) => (
                            <button key={format} type="button" disabled={!view.canEdit}
                              aria-pressed={(segment.interviewFormat ?? "BACKSTAGE") === format}
                              className={(segment.interviewFormat ?? "BACKSTAGE") === format ? styles.typeActive : styles.secondaryButton}
                              onClick={() => updateSegment(segment.draftSegmentId, { interviewFormat: format })}>{label}</button>
                          ))}
                        </div>
                      </>
                    ) : null}
                    <small className={styles.sideLabel}>An evasive answer or walkout is scripted, not randomly imposed. A question about feud pressure lands more naturally when an active Programme exists.</small>
                  </div>
                ) : null}

                {segment.type === "CELEBRATION" ? (
                  <div className={styles.segmentPeople}>
                    <div className={styles.segmentPeopleHeader}>
                      <span>What are they celebrating?</span>
                      <small>A kayfabe self-coronation is a boast, not a real title win.</small>
                    </div>
                    <div className={styles.slotTypeRow} role="group" aria-label="Celebration occasion">
                      {CELEBRATION_OCCASION_OPTIONS.map(([occasion, caption]) => (
                        <button key={occasion} type="button" disabled={!view.canEdit}
                          aria-pressed={(segment.celebrationOccasion ?? "FAN_APPRECIATION") === occasion}
                          className={(segment.celebrationOccasion ?? "FAN_APPRECIATION") === occasion ? styles.typeActive : styles.secondaryButton}
                          onClick={() => updateSegment(segment.draftSegmentId, { celebrationOccasion: occasion })}>
                          {caption}
                        </button>
                      ))}
                    </div>
                    <div className={styles.segmentPeopleHeader}>
                      <span>How does the celebration end?</span>
                      <small>The ending is booked by you, not randomly chosen by the simulation.</small>
                    </div>
                    <div className={styles.slotTypeRow} role="group" aria-label="Celebration ending">
                      {CELEBRATION_ENDING_OPTIONS.map(([ending, caption]) => (
                        <button key={ending} type="button" disabled={!view.canEdit}
                          aria-pressed={(segment.celebrationEnding ?? "SALUTE_CROWD") === ending}
                          className={(segment.celebrationEnding ?? "SALUTE_CROWD") === ending ? styles.typeActive : styles.secondaryButton}
                          onClick={() => updateSegment(segment.draftSegmentId, { celebrationEnding: ending })}>{caption}</button>
                      ))}
                    </div>
                    <small className={styles.sideLabel}>A victory lap requires every featured wrestler to have actually won a completed match for your promotion within six PPW weeks. A match merely booked to be won does not count.</small>
                  </div>
                ) : null}

                {segment.type === "RESCUE" ? (
                  <div className={styles.segmentPeople}>
                    <div className={styles.segmentPeopleHeader}>
                      <span>How does the rescue play out?</span>
                      <small>The wrestlers and on-screen result are scripted by you. Audience reaction is simulated.</small>
                    </div>
                    <div className={styles.slotTypeRow} role="group" aria-label="Rescue scripted result">
                      {RESCUE_OUTCOME_OPTIONS.map(([outcome, caption]) => (
                        <button key={outcome} type="button" disabled={!view.canEdit}
                          aria-pressed={(segment.rescueOutcome ?? "RESCUER_STANDS_TALL") === outcome}
                          className={(segment.rescueOutcome ?? "RESCUER_STANDS_TALL") === outcome ? styles.typeActive : styles.secondaryButton}
                          onClick={() => updateSegment(segment.draftSegmentId, { rescueOutcome: outcome })}>{caption}</button>
                      ))}
                    </div>
                    <small className={styles.sideLabel}>A failed rescue remains a failed attempt, not an invented successful save. No injury or backstage relationship change is automatic.</small>
                  </div>
                ) : null}

                {segment.type === "POST_MATCH_ASSAULT" ? (
                  <div className={styles.controls}>
                    <div className={styles.control}>
                      <label>After which match?</label>
                      <select value={segment.sourceDraftMatchId ?? ""} disabled={!view.canEdit}
                        onChange={(event) => linkPostMatch(segment.draftSegmentId, event.target.value)}>
                        <option value="">Choose a match on this card</option>
                        {matches.map((match) => (
                          <option key={match.draftMatchId} value={match.draftMatchId}>
                            {match.sideAIds.map(personName).join(" & ")} vs {match.sideBIds.map(personName).join(" & ")}
                          </option>
                        ))}
                      </select>
                      <small className={styles.sideLabel}>Automatically places this assault immediately after the match. The victim must have competed in it; the aggressor may be an outsider.</small>
                    </div>
                    <div className={styles.segmentPeopleHeader}>
                      <span>How does the attacker strike?</span>
                      <small>Reuse the same physical formats as an Attack — this angle happens after an actual match.</small>
                    </div>
                    <div className={styles.slotTypeRow} role="group" aria-label="Post-match assault format">
                      {ATTACK_FORMATS.map((format) => (
                        <button key={format} type="button" disabled={!view.canEdit}
                          aria-pressed={(segment.attackPresentation ?? "BLINDSIDE") === format}
                          className={(segment.attackPresentation ?? "BLINDSIDE") === format ? styles.typeActive : styles.secondaryButton}
                          onClick={() => updateSegment(segment.draftSegmentId, { attackPresentation: format })}>{pretty(format)}</button>
                      ))}
                    </div>
                    {bookingMode === "ADVANCED" ? (
                      <>
                        <div className={styles.segmentPeopleHeader}>
                          <span>What is the attack meant to achieve?</span>
                        </div>
                        <div className={styles.slotTypeRow} role="group" aria-label="Post-match assault objective">
                          {ATTACK_OBJECTIVES.map((objective) => (
                            <button key={objective} type="button" disabled={!view.canEdit}
                              aria-pressed={(segment.attackObjective ?? "GENERATE_HEAT") === objective}
                              className={(segment.attackObjective ?? "GENERATE_HEAT") === objective ? styles.typeActive : styles.secondaryButton}
                              onClick={() => updateSegment(segment.draftSegmentId, { attackObjective: objective })}>{pretty(objective)}</button>
                          ))}
                        </div>
                      </>
                    ) : null}
                    <div className={styles.segmentPeopleHeader}>
                      <span>Who stands tall after the bell?</span>
                      <small>Script the aftermath; the already-completed match winner never changes.</small>
                    </div>
                    <div className={styles.slotTypeRow} role="group" aria-label="Post-match assault ending">
                      {POST_MATCH_ENDING_OPTIONS.map(([ending, caption]) => (
                        <button key={ending} type="button" disabled={!view.canEdit}
                          aria-pressed={(segment.postMatchAssaultEnding ?? "ATTACKER_STANDS_TALL") === ending}
                          className={(segment.postMatchAssaultEnding ?? "ATTACKER_STANDS_TALL") === ending ? styles.typeActive : styles.secondaryButton}
                          onClick={() => updateSegment(segment.draftSegmentId, { postMatchAssaultEnding: ending })}>{caption}</button>
                      ))}
                    </div>
                    <small className={styles.sideLabel}>No automatic injury, disqualification, result reversal or hidden substitution occurs because of this booked assault.</small>
                  </div>
                ) : null}

                {segment.type === "CONFRONTATION" ? (
                  <div className={styles.segmentPeople}>
                    <div className={styles.segmentPeopleHeader}>
                      <span>How does the face-off end?</span>
                      <small>You decide whether someone backs down or both leave the tension unresolved. No match challenge or physical attack is created.</small>
                    </div>
                    <div className={styles.slotTypeRow} role="group" aria-label="Confrontation scripted ending">
                      {CONFRONTATION_ENDING_OPTIONS.map(([ending, caption]) => (
                        <button key={ending} type="button" disabled={!view.canEdit}
                          aria-pressed={(segment.confrontationEnding ?? "STAREDOWN") === ending}
                          className={(segment.confrontationEnding ?? "STAREDOWN") === ending ? styles.typeActive : styles.secondaryButton}
                          onClick={() => updateSegment(segment.draftSegmentId, { confrontationEnding: ending })}>
                          {caption}
                        </button>
                      ))}
                    </div>
                    <small className={styles.sideLabel}>A handshake is an on-screen gesture, not automatic friendship. Repeating the same face-off between the same pair can wear thin.</small>
                  </div>
                ) : null}

                {segment.type === "INTERRUPTION" ? (
                  <div className={styles.segmentPeople}>
                    <div className={styles.segmentPeopleHeader}>
                      <span>Script the interruption</span>
                      <small>Who gets the better of the exchange is your choice. The simulation rates the crowd response, not the story result.</small>
                    </div>
                    <div className={styles.control}>
                      <label>On-screen ending</label>
                      <select value={segment.interruptionOutcome ?? "VERBAL_EXCHANGE"} disabled={!view.canEdit}
                        onChange={(event) => updateSegment(segment.draftSegmentId, {
                          interruptionOutcome: event.target.value as "VERBAL_EXCHANGE" | "INTERRUPTER_PREVAILS" | "SPEAKER_PREVAILS" | "BRAWL",
                        })}>
                        <option value="VERBAL_EXCHANGE">Heated verbal exchange</option>
                        <option value="INTERRUPTER_PREVAILS">Interrupter shuts down the speaker</option>
                        <option value="SPEAKER_PREVAILS">Original speaker shuts down the interrupter</option>
                        <option value="BRAWL">It breaks into a brawl</option>
                      </select>
                    </div>
                  </div>
                ) : null}

                {segment.type === "CHALLENGE" ? (
                  <div className={styles.segmentPeople}>
                    <div className={styles.segmentPeopleHeader}>
                      <span>Script the challenge response</span>
                      <small>You decide how the opponent responds. Acceptance does not automatically book a match.</small>
                    </div>
                    <div className={styles.control}>
                      <label>On-screen reply</label>
                      <select value={segment.challengeResponse ?? ""} disabled={!view.canEdit}
                        onChange={(event) => updateSegment(segment.draftSegmentId, {
                          challengeResponse: (event.target.value || null) as AlphaCardSegmentView["challengeResponse"],
                        })}>
                        <option value="">Not recorded (older booking)</option>
                        <option value="ACCEPTED">Challenge accepted</option>
                        <option value="REFUSED">Challenge refused</option>
                        <option value="LEFT_OPEN">Challenge left unresolved</option>
                      </select>
                    </div>
                  </div>
                ) : null}

                {stableContinuity.length > 0 ? (
                  <aside className={styles.continuityNote} aria-label="Stable storyline continuity">
                    <strong><span aria-hidden="true">ⓘ</span> Story continuity</strong>
                    {stableContinuity.map((note) => <p key={note}>{note}</p>)}
                    <small>Advisory only. Your scripted story and the World roster remain entirely under your control.</small>
                  </aside>
                ) : null}

                {segment.type === "STABLE_RECONCILIATION" ? (
                  <div className={styles.segmentPeople}>
                    <div className={styles.segmentPeopleHeader}>
                      <span>Script a reunion attempt</span>
                      <small>An active stable member approaches a former member. You choose the response, not the simulation. Reunion on-screen does not reinstate membership.</small>
                    </div>
                    <div className={styles.control}>
                      <label>Stable history</label>
                      <select value={segment.stableId ?? ""} disabled={!view.canEdit}
                        onChange={(event) => updateSegment(segment.draftSegmentId, { stableId: event.target.value || null })}>
                        <option value="">Choose stable</option>
                        {view.availableStables.filter((stable) => stable.formerMemberIds.length > 0).map((stable) => (
                          <option key={stable.stableId} value={stable.stableId}>{stable.name}</option>
                        ))}
                      </select>
                      {!view.availableStables.some((stable) => stable.formerMemberIds.length > 0)
                        ? <small>First remove a member from an active stable through Roster → Stables to establish real history.</small> : null}
                      {segment.stableId && !view.availableStables.some((stable) => stable.stableId === segment.stableId
                        && stable.memberIds.includes(segment.initiatorPersonId ?? "")
                        && stable.formerMemberIds.includes(segment.targetPersonId ?? ""))
                        ? <small>Choose a current stable representative and a former member of that stable.</small> : null}
                    </div>
                    <div className={styles.control}>
                      <label>On-screen response</label>
                      <select value={segment.stableReconciliationOutcome ?? "RECONCILED"} disabled={!view.canEdit}
                        onChange={(event) => updateSegment(segment.draftSegmentId, {
                          stableReconciliationOutcome: event.target.value as "RECONCILED" | "REBUFFED",
                        })}>
                        <option value="RECONCILED">They reconcile</option>
                        <option value="REBUFFED">The former member rebuffs the approach</option>
                      </select>
                    </div>
                  </div>
                ) : null}

                {segment.type === "STABLE_EXIT" ? (
                  <div className={styles.segmentPeople}>
                    <div className={styles.segmentPeopleHeader}>
                      <span>Script a stable departure</span>
                      <small>Choose who leaves and how the segment plays out. The World records this on-screen exit, but actual stable membership is managed separately in Roster → Stables.</small>
                    </div>
                    <div className={styles.control}>
                      <label>Existing stable</label>
                      <select value={segment.stableId ?? ""} disabled={!view.canEdit}
                        onChange={(event) => updateSegment(segment.draftSegmentId, { stableId: event.target.value || null })}>
                        <option value="">Choose a stable</option>
                        {view.availableStables.map((stable) => (
                          <option key={stable.stableId} value={stable.stableId}>{stable.name}</option>
                        ))}
                      </select>
                      {!view.availableStables.length ? <small>Create a stable on your Roster first.</small> : null}
                      {segment.stableId && !view.availableStables.some((stable) => stable.stableId === segment.stableId
                        && stable.memberIds.includes(segment.initiatorPersonId ?? "")
                        && stable.memberIds.includes(segment.targetPersonId ?? "")) ? <small>Both wrestlers must currently belong to the selected stable.</small> : null}
                    </div>
                    <div className={styles.control}>
                      <label>On-screen outcome</label>
                      <select value={segment.stableExitOutcome ?? "EXPELLED"} disabled={!view.canEdit}
                        onChange={(event) => updateSegment(segment.draftSegmentId, {
                          stableExitOutcome: event.target.value as "EXPELLED" | "WALKED_OUT",
                        })}>
                        <option value="EXPELLED">Member is expelled by the stable</option>
                        <option value="WALKED_OUT">Member walks out voluntarily</option>
                      </select>
                    </div>
                  </div>
                ) : null}

                {segment.type === "STABLE_INVITATION" ? (
                  <div className={styles.segmentPeople}>
                    <div className={styles.segmentPeopleHeader}>
                      <span>Script a stable invitation</span>
                      <small>A current stable member offers another wrestler a place. You script their response; accepted on-screen does not automatically change World membership. Manage the actual roster in Stables.</small>
                    </div>
                    <div className={styles.control}>
                      <label>Inviting stable</label>
                      <select value={segment.stableId ?? ""} disabled={!view.canEdit}
                        onChange={(event) => updateSegment(segment.draftSegmentId, { stableId: event.target.value || null })}>
                        <option value="">Choose a stable</option>
                        {view.availableStables.map((stable) => (
                          <option key={stable.stableId} value={stable.stableId}>{stable.name}</option>
                        ))}
                      </select>
                      {(view.availableStables.length === 0) ? <small>No stables yet. Create one on Roster → Stables first.</small> : null}
                      {segment.stableId && !view.availableStables.some((stable) => stable.stableId === segment.stableId && stable.memberIds.includes(segment.initiatorPersonId ?? "")) ? <small>The recruiter must already belong to this stable.</small> : null}
                    </div>
                    <div className={styles.control}>
                      <label>Scripted response</label>
                      <select value={segment.stableInvitationOutcome ?? "REFUSED"} disabled={!view.canEdit}
                        onChange={(event) => updateSegment(segment.draftSegmentId, {
                          stableInvitationOutcome: event.target.value as "ACCEPTED" | "REFUSED",
                        })}>
                        <option value="ACCEPTED">Recruit accepts the invitation</option>
                        <option value="REFUSED">Recruit refuses the invitation</option>
                      </select>
                    </div>
                  </div>
                ) : null}

                {segment.type === "CONTRACT_SIGNING" ? (
                  <div className={styles.segmentPeople}>
                    <div className={styles.segmentPeopleHeader}>
                      <span>Script the signing</span>
                      <small>You decide the story beat. This does not sign an employment agreement or automatically book a match.</small>
                    </div>
                    <div className={styles.control}>
                      <label>On-screen outcome</label>
                      <select value={segment.signingOutcome ?? "SIGNED"} disabled={!view.canEdit}
                        onChange={(event) => updateSegment(segment.draftSegmentId, { signingOutcome: event.target.value as "SIGNED" | "REJECTED" | "WALKOUT" | "BRAWL" })}>
                        <option value="SIGNED">Both sign</option>
                        <option value="REJECTED">Proposal rejected</option>
                        <option value="WALKOUT">Responder walks out</option>
                        <option value="BRAWL">Signing breaks into a brawl</option>
                      </select>
                    </div>
                  </div>
                ) : null}

                {segment.type === "ATTACK" ? (
                  <div className={styles.segmentPeople}>
                    <div className={styles.segmentPeopleHeader}>
                      <span>Attack format</span>
                      <small>The angle the audience sees</small>
                    </div>
                    <div className={styles.slotTypeRow}>
                      {ATTACK_FORMATS.map((format) => (
                        <button type="button" key={format}
                          className={(segment.attackPresentation ?? "BLINDSIDE") === format ? styles.typeActive : styles.secondaryButton}
                          disabled={!view.canEdit}
                          onClick={() => updateSegment(segment.draftSegmentId, { attackPresentation: format })}>
                          {pretty(format)}
                        </button>
                      ))}
                    </div>
                    <div className={styles.segmentPeopleHeader}>
                      <span>Booking objective</span>
                      <small>Private to your promotion</small>
                    </div>
                    <div className={styles.slotTypeRow}>
                      {ATTACK_OBJECTIVES.map((objective) => (
                        <button type="button" key={objective}
                          className={(segment.attackObjective ?? "GENERATE_HEAT") === objective ? styles.typeActive : styles.secondaryButton}
                          disabled={!view.canEdit}
                          onClick={() => updateSegment(segment.draftSegmentId, { attackObjective: objective })}>
                          {pretty(objective)}
                        </button>
                      ))}
                    </div>
                    <small className={styles.sideLabel}>A blindside favours credible aggressors; pull-apart brawls need a rivalry with heat. Booking goals may fall flat if the characters do not fit.</small>
                  </div>
                ) : null}

                {segment.type === "TURN" ? (
                  <div className={styles.controls}>
                    <div className={styles.control}>
                      <label>Who turns?</label>
                      <WrestlerSlotButton
                        person={pickerPerson(segment.turnPersonId ?? "")}
                        disabled={!view.canEdit}
                        onClick={() => setWrestlerPicker({
                          kind: "TURN",
                          segmentId: segment.draftSegmentId,
                          currentId: segment.turnPersonId ?? "",
                          label: "Who turns?",
                        })}
                      />
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
                      <span>Turn angle</span>
                      <small>How the turn happens on screen</small>
                    </div>
                    <div className={styles.slotTypeRow}>
                      <button type="button" className={(segment.turnPresentation ?? "REVEAL") === "REVEAL" ? styles.typeActive : styles.secondaryButton} disabled={!view.canEdit}
                        onClick={() => updateSegment(segment.draftSegmentId, { turnPresentation: "REVEAL", betrayedPersonId: null })}>Alignment reveal</button>
                      <button type="button" className={segment.turnPresentation === "BETRAYAL" ? styles.typeActive : styles.secondaryButton} disabled={!view.canEdit}
                        onClick={() => updateSegment(segment.draftSegmentId, { turnPresentation: "BETRAYAL" })}>Betrayal</button>
                    </div>
                    {segment.turnPresentation === "BETRAYAL" ? (
                      <div className={styles.segmentPeopleHeader}>
                        <span>Who gets betrayed?</span>
                        <small>First add them below, then select their name</small>
                      </div>
                    ) : null}
                    {segment.turnPresentation === "BETRAYAL" ? (
                      <div className={styles.slotTypeRow}>
                        {segment.participantIds.filter((personId) => Boolean(personId) && personId !== segment.turnPersonId).map((personId) => (
                          <button type="button" key={personId}
                            className={segment.betrayedPersonId === personId ? styles.typeActive : styles.secondaryButton}
                            disabled={!view.canEdit}
                            onClick={() => updateSegment(segment.draftSegmentId, { betrayedPersonId: personId })}>
                            {personName(personId)}
                          </button>
                        ))}
                      </div>
                    ) : null}
                    <div className={styles.segmentPeopleHeader}>
                      <span>Others involved (optional)</span>
                      <small>{segment.programmeId ? "Limited to this Programme" : "Add anyone else involved in the turn"}</small>
                    </div>
                    {segment.participantIds.map((personId, personIndex) => {
                      if (personId === segment.turnPersonId) return null;
                      return (
                        <div className={styles.segmentPersonRow} key={personIndex}>
                          <WrestlerSlotButton
                            person={pickerPerson(personId)}
                            disabled={!view.canEdit}
                            onClick={() => setWrestlerPicker({
                              kind: "SEGMENT",
                              segmentId: segment.draftSegmentId,
                              slotIndex: personIndex,
                              currentId: personId,
                              label: `${pretty(segment.type)} · Wrestler ${personIndex + 1}`,
                            })}
                          />
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
                ) : segment.type === "VIDEO_PACKAGE" ? null : (
                  <div className={styles.segmentPeople}>
                    <div className={styles.segmentPeopleHeader}>
                      <span>{segment.type === "RESCUE" ? "Who attacks, who is saved, and who makes the save?" : segment.type === "POST_MATCH_ASSAULT" ? "Who attacks after the match?" : segment.type === "ATTACK" ? "Who attacks whom?" : isDirectedSegment(segment.type) ? "Who starts it?" : "Who is involved?"}</span>
                      {segment.programmeId ? <small>{segment.type === "RESCUE" ? "Aggressor and victim from Programme; rescuer can be an outsider"
                        : segment.type === "POST_MATCH_ASSAULT" ? "Victim belongs to the Programme; aggressor may be an outsider"
                        : "Limited to this Programme"}</small> : <small>Any contracted wrestler</small>}
                    </div>
                    {segment.participantIds.map((personId, personIndex) => (
                      <div className={(segment.type === "RESCUE" && personIndex < 3) || ((segment.type === "ATTACK" || segment.type === "POST_MATCH_ASSAULT" || isDirectedSegment(segment.type)) && personIndex < 2) ? styles.attackFixedPersonRow : styles.segmentPersonRow} key={personIndex}>
                        <div className={styles.segmentPersonCell}>
                        {segment.type === "ATTACK" || segment.type === "RESCUE" || segment.type === "POST_MATCH_ASSAULT" || isDirectedSegment(segment.type) ? (
                          <span className={styles.sideLabel}>
                            {segment.type === "RESCUE" ? (personIndex === 0 ? "Aggressor" : personIndex === 1 ? "Victim" : personIndex === 2 ? "Rescuer" : "Also involved")
                              : segment.type === "ATTACK" || segment.type === "POST_MATCH_ASSAULT"
                              ? (personIndex === 0 ? "Attacker" : personIndex === 1 ? "Victim" : "Also involved")
                              : (personIndex === 0 ? (segment.type === "CHALLENGE" ? "Challenger" : segment.type === "CONTRACT_SIGNING" ? "Proposer" : segment.type === "INTERRUPTION" ? "Interrupter" : segment.type === "STABLE_INVITATION" || segment.type === "STABLE_EXIT" || segment.type === "STABLE_RECONCILIATION" ? "Stable representative" : "Instigator") : personIndex === 1 ? (segment.type === "CONTRACT_SIGNING" ? "Responder" : segment.type === "INTERRUPTION" ? "Original speaker" : segment.type === "STABLE_INVITATION" ? "Recruit" : segment.type === "STABLE_EXIT" ? "Departing member" : segment.type === "STABLE_RECONCILIATION" ? "Former member" : "Target") : "Also involved")}
                          </span>
                        ) : null}
                        <WrestlerSlotButton
                          person={pickerPerson(segment.type === "RESCUE" && personIndex < 3
                            ? (personIndex === 0 ? (segment.attackerPersonId ?? "") : personIndex === 1 ? (segment.victimPersonId ?? "") : (segment.rescuerPersonId ?? ""))
                            : (segment.type === "ATTACK" || segment.type === "POST_MATCH_ASSAULT") && personIndex < 2
                            ? (personIndex === 0 ? (segment.attackerPersonId ?? "") : (segment.victimPersonId ?? ""))
                            : isDirectedSegment(segment.type) && personIndex < 2
                              ? (personIndex === 0 ? (segment.initiatorPersonId ?? "") : (segment.targetPersonId ?? ""))
                              : personId)}
                          disabled={!view.canEdit}
                          onClick={() => setWrestlerPicker({
                            kind: "SEGMENT",
                            segmentId: segment.draftSegmentId,
                            slotIndex: personIndex,
                            currentId: personId,
                            label: segment.type === "RESCUE"
                              ? (personIndex === 0 ? "Choose aggressor" : personIndex === 1 ? "Choose victim" : personIndex === 2 ? "Choose rescuer" : "Also involved")
                              : segment.type === "ATTACK" || segment.type === "POST_MATCH_ASSAULT"
                              ? (personIndex === 0 ? "Choose attacker" : personIndex === 1 ? "Choose victim" : "Also involved")
                              : isDirectedSegment(segment.type)
                                ? (personIndex === 0 ? (segment.type === "CHALLENGE" ? "Choose challenger" : segment.type === "CONTRACT_SIGNING" ? "Choose proposer" : segment.type === "INTERRUPTION" ? "Choose interrupter" : segment.type === "STABLE_INVITATION" || segment.type === "STABLE_EXIT" || segment.type === "STABLE_RECONCILIATION" ? "Choose stable representative" : "Choose instigator") : personIndex === 1 ? (segment.type === "CONTRACT_SIGNING" ? "Choose responder" : segment.type === "INTERRUPTION" ? "Choose original speaker" : segment.type === "STABLE_INVITATION" ? "Choose recruit" : segment.type === "STABLE_EXIT" ? "Choose departing member" : segment.type === "STABLE_RECONCILIATION" ? "Choose former member" : "Choose target") : "Also involved")
                                : `${pretty(segment.type)} · Wrestler ${personIndex + 1}`,
                          })}
                        />
                        </div>
                        {(segment.type === "RESCUE" && personIndex < 3) || ((segment.type === "ATTACK" || segment.type === "POST_MATCH_ASSAULT" || isDirectedSegment(segment.type)) && personIndex < 2) ? null : (
                          <button type="button" className={styles.smallRemove} disabled={!view.canEdit || segment.participantIds.length <= segmentMinimum(segment.type)} onClick={() => removeSegmentParticipant(segment.draftSegmentId, personIndex)}>×</button>
                        )}
                      </div>
                    ))}
                    {segment.type === "ATTACK" ? (
                      <button type="button" className={styles.secondaryButton} disabled={!view.canEdit || !segment.participantIds[0] || !segment.participantIds[1]} onClick={() => swapAttackRoles(segment.draftSegmentId)}>Swap attacker / victim</button>
                    ) : null}
                    {isDirectedSegment(segment.type) ? (
                      <div className={styles.slotTypeRow}>
                        {(!segment.initiatorPersonId || !segment.targetPersonId) ? (
                          <button type="button" className={styles.secondaryButton} disabled={!view.canEdit || !segment.participantIds[0] || !segment.participantIds[1] || segment.participantIds[0] === segment.participantIds[1]} onClick={() => confirmDirectedPair(segment.draftSegmentId)}>Confirm first wrestler initiates</button>
                        ) : null}
                        <button type="button" className={styles.secondaryButton} disabled={!view.canEdit || !segment.participantIds[0] || !segment.participantIds[1]} onClick={() => swapDirectedPair(segment.draftSegmentId)}>Swap initiator / target</button>
                      </div>
                    ) : null}
                    {bookingMode === "ADVANCED" ? (
                      <div className={styles.advancedSection}>
                        {segment.type !== "LIVE_APPEARANCE" ? <button type="button" className={styles.secondaryButton} disabled={!view.canEdit || segment.participantIds.length >= 4} onClick={() => addSegmentParticipant(segment.draftSegmentId)}>+ Add extra wrestler</button> : null}
                        {view.programmes.length > 0 ? <a className={styles.programmeLink} href="/programmes">Manage Programmes →</a> : <a className={styles.programmeLink} href="/programmes">Start a Programme →</a>}
                      </div>
                    ) : null}
                  </div>
                )}

                <div className={styles.actions}>
                  
                  
                  <button className={styles.removeButton} type="button" disabled={!view.canEdit} onClick={() => removeSlot(slot)}>Remove</button>
                </div>
                      </div>
                      <footer className={styles.editorFooter}>
                        <span>{dirty ? "Unsaved card changes" : "No new changes"}</span>
                        <div className={styles.editorFooterActions}>
                          <button className={styles.editorDoneSecondary} type="button" onClick={() => setExpandedSlotKey(null)}>Done editing</button>
                          <button className={styles.editorDone} type="button" disabled={!canSave || saving}
                            onClick={() => void saveAndCloseEditor()}>{saving ? "Saving…" : "Save show & return"}</button>
                        </div>
                      </footer>
                    </section>
                  </div>
                ) : null}
              </article>
            );
          })}
        </div>

        {runningOrder.length > 0 ? <div className={styles.addSlotBar}>
          <span>Add next slot</span>
          <div>
            <button className={styles.secondaryButton} type="button" onClick={() => addMatch("SINGLES")} disabled={!view.canEdit}>+ Match</button>
            <button className={styles.secondaryButton} type="button" onClick={() => addSegment()} disabled={!view.canEdit}>+ Segment</button>
          </div>
        </div> : null}

        {view.creativeConcerns?.length ? (
          <section className={styles.saveBlockers} aria-live="polite" aria-label="Wrestler creative approval">
            <div className={styles.saveBlockerHeading}>
              <strong>Creative permissions</strong>
              <span>{view.creativeConcerns.filter((item) => item.requiresConsent && item.consent !== "APPROVED").length} outstanding</span>
            </div>
            <p>Wrestler contract rights are checked against the saved script. A booking change requires a fresh agreement; no result is rewritten automatically.</p>
            {dirty ? <p>Save your card edits before requesting approval for the revised script.</p> : null}
            {view.cardPendingConsent ? (
              <>
                <p>This proposed card is not live. Your last committed show is still intact until all approvals are granted.</p>
                <button
                  type="button"
                  className={styles.secondaryButton}
                  disabled={!view.canEdit || withdrawingAmendment || saving || requestingConsent !== null}
                  onClick={() => void withdrawPendingAmendment()}
                >
                  {withdrawingAmendment ? "Restoring…" : "Withdraw changes · restore committed card"}
                </button>
                {dirty ? <p>Unsaved edits on this screen will also be discarded.</p> : null}
              </>
            ) : null}
            <ul>
              {view.creativeConcerns.map((concern) => (
                <li key={`${concern.draftMatchId}:${concern.personId}:${concern.reason}`}>
                  <strong>{concern.wrestlerName}</strong> · {pretty(concern.reason)} · {
                    concern.approvalSource === "STANDING_PROGRAMME" ? "Covered by Programme agreement"
                      : !concern.requiresConsent ? "Consultation only — no veto"
                      : concern.consent === "APPROVED" ? "Approved"
                        : concern.consent === "DECLINED" ? "Declined — revise the booking"
                          : "Permission required"
                  }
                  {concern.requiresConsent && concern.consent === "NOT_REQUESTED" ? (
                    <button
                      type="button"
                      className={styles.secondaryButton}
                      disabled={!view.canEdit || dirty || requestingConsent !== null || withdrawingAmendment}
                      onClick={() => void askCreativeApproval(concern.draftMatchId, concern.personId)}
                    >
                      {requestingConsent === `${concern.draftMatchId}:${concern.personId}` ? "Asking…" : "Ask for approval"}
                    </button>
                  ) : null}
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {saveBlockers.length > 0 ? (
          <section className={styles.saveBlockers} aria-live="polite" aria-label="Show booking save blockers">
            <div className={styles.saveBlockerHeading}>
              <strong>Can’t save yet</strong>
              <span>{saveBlockers.length} {saveBlockers.length === 1 ? "issue" : "issues"}</span>
            </div>
            <ul>
              {saveBlockers.map((blocker) => <li key={blocker}>{blocker}</li>)}
            </ul>
          </section>
        ) : (
          <div className={styles.saveReady}>
            Ready to save · {uniqueBookedCount} unique wrestler{uniqueBookedCount === 1 ? "" : "s"}
          </div>
        )}

        <div className={styles.saveBar}>
          <button
            className="primary-button"
            type="button"
            disabled={!canSave}
            aria-describedby={saveBlockers.length > 0 ? "card-save-blockers" : undefined}
            onClick={() => void save()}
          >
            {saving ? "Saving booking…" : view.reservationId ? "Save & refresh reservation" : "Save show booking"}
          </button>
          {saveBlockers.length > 0 ? (
            <span id="card-save-blockers" className={styles.saveBarHint}>Resolve the issues above to enable saving.</span>
          ) : null}
          {saved ? <div className={styles.saved}>{view.cardPendingConsent ? "Booking proposal saved · creative approval needed before this card replaces the committed show" : "Booking saved · running order and talent reservation refreshed"}</div> : null}
        </div>
      </section>
      </main>
    </>
  );
}
