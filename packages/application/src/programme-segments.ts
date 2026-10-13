import type { WrestlerAlignment } from "../../domain/src/alignment.js";
import type { Id, LedgerEvent, WorldState } from "../../domain/src/types.js";
import type { Programme } from "../../domain/src/programmes.js";
import {
  programmeActivities,
  recordProgrammeActivity,
} from "../../sim-core/src/programmes.js";
import {
  changePromotionWrestlerAlignment,
  isWrestlerAlignment,
  recentAlignmentVolatilityPenalty,
  wrestlerAlignmentForPromotion,
} from "../../sim-core/src/alignment.js";
import { LedgerWriter } from "../../sim-core/src/ledger.js";
import { ppwDateToWeekIndex } from "../../sim-core/src/clock.js";
import {
  PROMO_PURPOSES, INTERVIEW_FORMATS, INTERVIEW_TOPICS, INTERVIEW_RESPONSES,
  CELEBRATION_OCCASIONS, CELEBRATION_ENDINGS, CONFRONTATION_ENDINGS,
  RESCUE_OUTCOMES, POST_MATCH_ASSAULT_ENDINGS,
} from "./planning.js";
import type {
  DetailedProgrammeSegmentDraft,
  DetailedShowDraft,
  DetailedShowSegmentDraft,
  DetailedShowSegmentType,
  PromoPurpose,
  InterviewFormat,
  InterviewTopic,
  InterviewResponse,
  CelebrationOccasion,
  CelebrationEnding,
  VideoPackageKind,
  VideoPackageObjective,
  VideoPackageReveal,
  LiveAppearanceKind,
  LiveAppearanceObjective,
  AttackPresentation,
  AttackObjective,
  RescueOutcome,
  PostMatchAssaultEnding,
  TurnPresentation,
  SigningOutcome,
  ChallengeResponse,
  InterruptionOutcome,
  ConfrontationEnding,
  StableInvitationOutcome,
  StableExitOutcome,
  StableReconciliationOutcome,
  WorldPlanningState,
} from "./planning.js";

const RESOLVED_SEGMENT_LEDGER_TYPE = "SHOW_SEGMENT_COMPLETED";
const SEGMENT_TYPES = new Set<DetailedShowSegmentType>([
  "PROMO",
  "INTERVIEW",
  "CONFRONTATION",
  "INTERRUPTION",
  "CHALLENGE",
  "CONTRACT_SIGNING",
  "STABLE_INVITATION",
  "STABLE_EXIT",
  "STABLE_RECONCILIATION",
  "ATTACK",
  "RESCUE",
  "POST_MATCH_ASSAULT",
  "CELEBRATION",
  "TURN",
  "VIDEO_PACKAGE",
  "LIVE_APPEARANCE",
]);

/**
 * Completed-history only. A submitted draft, future show, or another promotion
 * cannot exhaust this promotion's story variety. A different purpose, response
 * or presentation is a *different* beat, even with the same wrestlers.
 */
function recentPerformedBeatCount(
  state: WorldState,
  event: WorldState["events"][number],
  isSameBeat: (payload: LedgerEvent["payload"]) => boolean,
): number {
  const week = ppwDateToWeekIndex(event.date, state.ruleset.weeksPerYear);
  return state.ledger.filter((entry) => {
    if (entry.type !== RESOLVED_SEGMENT_LEDGER_TYPE
      || entry.payload.promotionId !== event.promotionId
      || !isSameBeat(entry.payload)) return false;
    const elapsedWeeks = week - ppwDateToWeekIndex(entry.date, state.ruleset.weeksPerYear);
    return elapsedWeeks >= 1 && elapsedWeeks <= 6;
  }).length;
}

export type ResolvedSegmentOutcomeBand = "POOR" | "FLAT" | "SOLID" | "STRONG" | "HOT";

export interface ResolvedShowSegment {
  ledgerId: Id;
  eventId: Id;
  promotionId: Id;
  sourceDraftId: string;
  draftSegmentId: string;
  slotOrder: number;
  type: DetailedShowSegmentType;
  participantIds: Id[];
  programmeId: Id | null;
  plannedLengthMinutes: number;
  videoSubjectPersonId: Id | null;
  videoKind: VideoPackageKind | null;
  videoObjective: VideoPackageObjective | null;
  videoReveal: VideoPackageReveal | null;
  liveAppearanceKind: LiveAppearanceKind | null;
  liveAppearanceObjective: LiveAppearanceObjective | null;
  promoPurpose: PromoPurpose | null;
  interviewFormat: InterviewFormat | null;
  interviewTopic: InterviewTopic | null;
  interviewResponse: InterviewResponse | null;
  celebrationOccasion: CelebrationOccasion | null;
  celebrationEnding: CelebrationEnding | null;
  attackerPersonId: Id | null;
  victimPersonId: Id | null;
  rescuerPersonId: Id | null;
  rescueOutcome: RescueOutcome | null;
  postMatchAssaultEnding: PostMatchAssaultEnding | null;
  sourceDraftMatchId: string | null;
  sourceMatchId: Id | null;
  victimMatchOutcome: "WON" | "LOST" | "DRAW" | null;
  initiatorPersonId: Id | null;
  targetPersonId: Id | null;
  signingOutcome: SigningOutcome | null;
  challengeResponse: ChallengeResponse | null;
  interruptionOutcome: InterruptionOutcome | null;
  confrontationEnding: ConfrontationEnding | null;
  stableId: Id | null;
  stableName: string | null;
  stableInvitationOutcome: StableInvitationOutcome | null;
  stableExitOutcome: StableExitOutcome | null;
  stableReconciliationOutcome: StableReconciliationOutcome | null;
  attackPresentation: AttackPresentation | null;
  attackObjective: AttackObjective | null;
  turnPersonId: Id | null;
  turnTargetAlignment: WrestlerAlignment | null;
  turnPresentation: TurnPresentation | null;
  betrayedPersonId: Id | null;
  executionQuality: number | null;
  crowdResponse: number | null;
  impact: number | null;
  outcomeBand: ResolvedSegmentOutcomeBand | null;
  programmeModifier: number;
  fatigueModifier: number;
  moraleModifier: number;
  alignmentVolatilityModifier: number;
  angleFitModifier: number;
}

interface NormalizedDraftSegment {
  draftSegmentId: string;
  type: DetailedShowSegmentType;
  participantIds: Id[];
  programmeId: Id | null;
  plannedLengthMinutes: number;
  videoSubjectPersonId: Id | null;
  videoKind: VideoPackageKind | null;
  videoObjective: VideoPackageObjective | null;
  videoReveal: VideoPackageReveal | null;
  liveAppearanceKind: LiveAppearanceKind | null;
  liveAppearanceObjective: LiveAppearanceObjective | null;
  promoPurpose: PromoPurpose | null;
  interviewFormat: InterviewFormat | null;
  interviewTopic: InterviewTopic | null;
  interviewResponse: InterviewResponse | null;
  celebrationOccasion: CelebrationOccasion | null;
  celebrationEnding: CelebrationEnding | null;
  attackerPersonId: Id | null;
  victimPersonId: Id | null;
  rescuerPersonId: Id | null;
  rescueOutcome: RescueOutcome | null;
  postMatchAssaultEnding: PostMatchAssaultEnding | null;
  sourceDraftMatchId: string | null;
  initiatorPersonId: Id | null;
  targetPersonId: Id | null;
  signingOutcome: SigningOutcome | null;
  challengeResponse: ChallengeResponse | null;
  interruptionOutcome: InterruptionOutcome | null;
  confrontationEnding: ConfrontationEnding | null;
  stableId: Id | null;
  stableName: string | null;
  stableInvitationOutcome: StableInvitationOutcome | null;
  stableExitOutcome: StableExitOutcome | null;
  stableReconciliationOutcome: StableReconciliationOutcome | null;
  attackPresentation: AttackPresentation | null;
  attackObjective: AttackObjective | null;
  turnPersonId: Id | null;
  turnTargetAlignment: WrestlerAlignment | null;
  turnPresentation: TurnPresentation | null;
  betrayedPersonId: Id | null;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

function outcomeBand(value: number): ResolvedSegmentOutcomeBand {
  if (value >= 80) return "HOT";
  if (value >= 68) return "STRONG";
  if (value >= 55) return "SOLID";
  if (value >= 42) return "FLAT";
  return "POOR";
}

function sameWeek(left: { year: number; week: number }, right: { year: number; week: number }): boolean {
  return left.year === right.year && left.week === right.week;
}

function sameDate(
  left: { year: number; week: number; day: number },
  right: { year: number; week: number; day: number },
): boolean {
  return sameWeek(left, right) && left.day === right.day;
}

function activityEntityIds(
  state: WorldState,
  programme: Programme,
  segment: Pick<DetailedProgrammeSegmentDraft | DetailedShowSegmentDraft, "participantIds"> & { videoSubjectPersonId?: Id | null },
): Id[] {
  const selectedPeople = new Set(segment.participantIds);
  if (segment.videoSubjectPersonId) selectedPeople.add(segment.videoSubjectPersonId);
  const result = new Set<Id>();
  for (const ref of [...programme.sideA, ...programme.sideB]) {
    if (ref.kind === "PERSON") {
      if (selectedPeople.has(ref.entityId)) result.add(ref.entityId);
      continue;
    }
    const hasSelectedMember = (state.teamMemberships ?? []).some((membership) => (
      membership.teamId === ref.entityId
      && membership.active
      && selectedPeople.has(membership.personId)
    ));
    if (hasSelectedMember) result.add(ref.entityId);
  }
  return [...result].sort();
}

function normalizedSegments(draft: DetailedShowDraft): NormalizedDraftSegment[] {
  const typed = (draft.segments ?? []).map((segment) => ({
    draftSegmentId: segment.draftSegmentId,
    type: segment.type,
    participantIds: [...segment.participantIds],
    programmeId: segment.programmeId,
    plannedLengthMinutes: segment.plannedLengthMinutes,
    videoSubjectPersonId: segment.type === "VIDEO_PACKAGE" ? (segment.videoSubjectPersonId ?? null) : null,
    videoKind: segment.type === "VIDEO_PACKAGE" ? (segment.videoKind ?? null) : null,
    videoObjective: segment.type === "VIDEO_PACKAGE" ? (segment.videoObjective ?? null) : null,
    videoReveal: segment.type === "VIDEO_PACKAGE" ? (segment.videoReveal ?? null) : null,
    liveAppearanceKind: segment.type === "LIVE_APPEARANCE" ? (segment.liveAppearanceKind ?? null) : null,
    liveAppearanceObjective: segment.type === "LIVE_APPEARANCE" ? (segment.liveAppearanceObjective ?? null) : null,
    promoPurpose: segment.type === "PROMO" ? (segment.promoPurpose ?? null) : null,
    interviewFormat: segment.type === "INTERVIEW" ? (segment.interviewFormat ?? null) : null,
    interviewTopic: segment.type === "INTERVIEW" ? (segment.interviewTopic ?? null) : null,
    interviewResponse: segment.type === "INTERVIEW" ? (segment.interviewResponse ?? null) : null,
    celebrationOccasion: segment.type === "CELEBRATION" ? (segment.celebrationOccasion ?? null) : null,
    celebrationEnding: segment.type === "CELEBRATION" ? (segment.celebrationEnding ?? null) : null,
    attackerPersonId: segment.type === "ATTACK" || segment.type === "RESCUE" || segment.type === "POST_MATCH_ASSAULT"
      ? (segment.attackerPersonId ?? null) : null,
    victimPersonId: segment.type === "ATTACK" || segment.type === "RESCUE" || segment.type === "POST_MATCH_ASSAULT"
      ? (segment.victimPersonId ?? null) : null,
    rescuerPersonId: segment.type === "RESCUE" ? (segment.rescuerPersonId ?? null) : null,
    rescueOutcome: segment.type === "RESCUE" ? (segment.rescueOutcome ?? null) : null,
    postMatchAssaultEnding: segment.type === "POST_MATCH_ASSAULT" ? (segment.postMatchAssaultEnding ?? null) : null,
    sourceDraftMatchId: segment.type === "POST_MATCH_ASSAULT" ? (segment.sourceDraftMatchId ?? null) : null,
    initiatorPersonId: segment.type === "CHALLENGE" || segment.type === "CONFRONTATION" || segment.type === "INTERRUPTION" || segment.type === "CONTRACT_SIGNING" || segment.type === "STABLE_INVITATION" || segment.type === "STABLE_EXIT" || segment.type === "STABLE_RECONCILIATION" ? (segment.initiatorPersonId ?? null) : null,
    targetPersonId: segment.type === "CHALLENGE" || segment.type === "CONFRONTATION" || segment.type === "INTERRUPTION" || segment.type === "CONTRACT_SIGNING" || segment.type === "STABLE_INVITATION" || segment.type === "STABLE_EXIT" || segment.type === "STABLE_RECONCILIATION" ? (segment.targetPersonId ?? null) : null,
    signingOutcome: segment.type === "CONTRACT_SIGNING" ? (segment.signingOutcome ?? "SIGNED") : null,
    challengeResponse: segment.type === "CHALLENGE" ? (segment.challengeResponse ?? null) : null,
    interruptionOutcome: segment.type === "INTERRUPTION" ? (segment.interruptionOutcome ?? "VERBAL_EXCHANGE") : null,
    confrontationEnding: segment.type === "CONFRONTATION" ? (segment.confrontationEnding ?? null) : null,
    stableId: segment.type === "STABLE_INVITATION" || segment.type === "STABLE_EXIT" || segment.type === "STABLE_RECONCILIATION" ? (segment.stableId ?? null) : null,
    stableName: null,
    stableInvitationOutcome: segment.type === "STABLE_INVITATION" ? (segment.stableInvitationOutcome ?? "REFUSED") : null,
    stableExitOutcome: segment.type === "STABLE_EXIT" ? (segment.stableExitOutcome ?? "EXPELLED") : null,
    stableReconciliationOutcome: segment.type === "STABLE_RECONCILIATION" ? (segment.stableReconciliationOutcome ?? "RECONCILED") : null,
    attackPresentation: segment.type === "ATTACK" || segment.type === "POST_MATCH_ASSAULT"
      ? (segment.attackPresentation ?? null) : null,
    attackObjective: segment.type === "ATTACK" || segment.type === "POST_MATCH_ASSAULT"
      ? (segment.attackObjective ?? null) : null,
    turnPersonId: segment.type === "TURN" ? (segment.turnPersonId ?? null) : null,
    turnTargetAlignment: segment.type === "TURN" ? (segment.turnTargetAlignment ?? null) : null,
    turnPresentation: segment.type === "TURN" ? (segment.turnPresentation ?? "REVEAL") : null,
    betrayedPersonId: segment.type === "TURN" && segment.turnPresentation === "BETRAYAL"
      ? (segment.betrayedPersonId ?? null) : null,
  }));
  const typedIds = new Set(typed.map((segment) => segment.draftSegmentId));
  const legacy = (draft.programmeSegments ?? [])
    .filter((segment) => !typedIds.has(segment.draftSegmentId))
    .map((segment) => ({
      draftSegmentId: segment.draftSegmentId,
      type: "PROMO" as const,
      promoPurpose: null,
      interviewFormat: null,
      interviewTopic: null,
      interviewResponse: null,
      celebrationOccasion: null,
      celebrationEnding: null,
      participantIds: [...segment.participantIds],
      programmeId: segment.programmeId,
      plannedLengthMinutes: 6,
      videoSubjectPersonId: null,
      videoKind: null,
      videoObjective: null,
      videoReveal: null,
      liveAppearanceKind: null,
      liveAppearanceObjective: null,
      attackerPersonId: null,
      victimPersonId: null,
      rescuerPersonId: null,
      rescueOutcome: null,
      postMatchAssaultEnding: null,
      sourceDraftMatchId: null,
      initiatorPersonId: null,
      targetPersonId: null,
      signingOutcome: null,
      challengeResponse: null,
      interruptionOutcome: null,
      confrontationEnding: null,
      stableId: null,
      stableName: null,
      stableInvitationOutcome: null,
      stableExitOutcome: null,
      stableReconciliationOutcome: null,
      attackPresentation: null,
      attackObjective: null,
      turnPersonId: null,
      turnTargetAlignment: null,
      turnPresentation: null,
      betrayedPersonId: null,
    }));
  return [...typed, ...legacy];
}

function segmentOutcome(
  state: WorldState,
  event: WorldState["events"][number],
  segment: NormalizedDraftSegment,
  victimMatchOutcome: "WON" | "LOST" | "DRAW" | null = null,
): {
  executionQuality: number;
  crowdResponse: number;
  impact: number;
  outcomeBand: ResolvedSegmentOutcomeBand;
  programmeModifier: number;
  fatigueModifier: number;
  moraleModifier: number;
  alignmentVolatilityModifier: number;
  angleFitModifier: number;
} {
  const people = (segment.type === "VIDEO_PACKAGE" && segment.videoSubjectPersonId
    ? [segment.videoSubjectPersonId] : segment.participantIds)
    .map((personId) => state.people.find((person) => person.id === personId))
    .filter((person): person is WorldState["people"][number] => Boolean(person));
  const average = (selector: (person: WorldState["people"][number]) => number): number => (
    people.length > 0 ? people.reduce((sum, person) => sum + selector(person), 0) / people.length : 0
  );
  const presentation = average((person) => person.skills.presentation);
  const starPower = average((person) => (person.popularity + person.recognition) / 2);
  const momentum = average((person) => person.momentum);
  const morale = average((person) => person.morale);
  const fatigue = average((person) => person.fatigue);
  const weights: Record<DetailedShowSegmentType, [number, number, number]> = {
    PROMO: [0.62, 0.23, 0.15],
    INTERVIEW: [0.68, 0.20, 0.12],
    CONFRONTATION: [0.50, 0.32, 0.18],
    INTERRUPTION: [0.57, 0.28, 0.15],
    CHALLENGE: [0.56, 0.28, 0.16],
    CONTRACT_SIGNING: [0.53, 0.31, 0.16],
    STABLE_INVITATION: [0.59, 0.24, 0.17],
    STABLE_EXIT: [0.51, 0.27, 0.22],
    STABLE_RECONCILIATION: [0.58, 0.23, 0.19],
    ATTACK: [0.38, 0.34, 0.28],
    RESCUE: [0.42, 0.30, 0.28],
    POST_MATCH_ASSAULT: [0.38, 0.35, 0.27],
    CELEBRATION: [0.40, 0.45, 0.15],
    TURN: [0.55, 0.25, 0.20],
    VIDEO_PACKAGE: [0.50, 0.30, 0.20],
    LIVE_APPEARANCE: [0.46, 0.40, 0.14],
  };
  const [presentationWeight, starWeight, momentumWeight] = weights[segment.type];
  const delivery = presentation * presentationWeight + starPower * starWeight + momentum * momentumWeight;
  const moraleModifier = segment.type === "VIDEO_PACKAGE" ? 0 : round1((morale - 50) * 0.08);
  // Normal/rested condition should not make every segment report that fatigue
  // hurt delivery. Only materially elevated fatigue becomes a visible penalty.
  // A future chronological show executor can model within-show fatigue by slot.
  const fatigueModifier = segment.type === "VIDEO_PACKAGE" ? 0 : round1(-Math.max(0, fatigue - 30) * 0.12);
  const programme = segment.programmeId
    ? (state.programmes ?? []).find((candidate) => candidate.id === segment.programmeId)
    : null;
  const heatEffect = programme?.heat === null || programme?.heat === undefined
    ? 0
    : clamp((programme.heat - 50) / 10, -4, 4);
  const repetitionPenalty = programme ? Math.min(4, programme.repetition / 20) : 0;
  const programmeModifier = round1(heatEffect - repetitionPenalty);
  // A format's appeal depends on character roles and rivalry context.
  // An angle never invents an injury or changes a finish.
  let angleFitModifier = 0;
  if (segment.type === "PROMO" && segment.promoPurpose) {
    const speakerAlignment = segment.participantIds.length === 1
      ? wrestlerAlignmentForPromotion(state, event.promotionId, segment.participantIds[0]!) : "TWEENER";
    const context = segment.promoPurpose === "AIR_GRIEVANCE" || segment.promoPurpose === "ISSUE_WARNING"
      ? (programme ? 1.5 : -0.8)
      : segment.promoPurpose === "BOAST" ? (speakerAlignment === "HEEL" ? 1.5 : speakerAlignment === "FACE" ? -0.6 : 0)
      : segment.promoPurpose === "RALLY_FANS" ? (speakerAlignment === "FACE" ? 1.5 : speakerAlignment === "HEEL" ? -1.0 : 0)
      : 0.5;
    // Only actual earlier performances matter, never pending cards or future shows.
    // A recurring performer can change subject instead of losing the promo format.
    const thisWeek = ppwDateToWeekIndex(event.date, state.ruleset.weeksPerYear);
    const repeated = state.ledger.filter((entry) => {
      if (entry.type !== RESOLVED_SEGMENT_LEDGER_TYPE
        || entry.payload.promotionId !== event.promotionId
        || entry.payload.segmentType !== "PROMO"
        || entry.payload.promoPurpose !== segment.promoPurpose
        || typeof entry.payload.participantIds !== "string") return false;
      const weeksAgo = thisWeek - ppwDateToWeekIndex(entry.date, state.ruleset.weeksPerYear);
      if (weeksAgo < 1 || weeksAgo > 6) return false;
      const prior = entry.payload.participantIds.split(",");
      return segment.participantIds.some((personId) => prior.includes(personId));
    }).length;
    angleFitModifier = round1(clamp(context - Math.min(3.5, repeated * 1.25), -5, 5));
  }
  if (segment.type === "INTERVIEW" && segment.interviewFormat && segment.interviewTopic && segment.interviewResponse) {
    // An interview is a hosted question and scripted answer, not a monologue
    // or an automatically created challenge. No imaginary interview host is
    // added to contracted wrestler dates.
    const subjectAlignment = segment.participantIds.length === 1
      ? wrestlerAlignmentForPromotion(state, event.promotionId, segment.participantIds[0]!) : "TWEENER";
    const topicFit = segment.interviewTopic === "RIVALRY_PRESSURE"
      ? (programme ? 1.35 : -1.25)
      : segment.interviewTopic === "CAREER_STORY" && segment.interviewFormat === "SIT_DOWN"
        ? 1.1 : segment.interviewTopic === "RECENT_FORM" ? 0.35 : 0.45;
    const formatFit = segment.interviewFormat === "IN_RING" && segment.interviewResponse === "DEFIANT" ? 1
      : segment.interviewFormat === "SIT_DOWN" && segment.interviewResponse === "CANDID" ? 0.85 : 0;
    const responseFit = segment.interviewResponse === "CANDID"
      ? (subjectAlignment === "FACE" ? 1.35 : 0)
      : segment.interviewResponse === "EVASIVE"
        ? (subjectAlignment === "HEEL" ? 1.25 : subjectAlignment === "FACE" ? -0.6 : 0)
        : segment.interviewResponse === "DEFIANT" ? (programme ? 0.9 : 0.25)
        : segment.interviewResponse === "WALKOUT" ? (programme ? 0.45 : -1.25) : 0;
    const thisWeek = ppwDateToWeekIndex(event.date, state.ruleset.weeksPerYear);
    const repeated = state.ledger.filter((entry) => {
      if (entry.type !== RESOLVED_SEGMENT_LEDGER_TYPE
        || entry.payload.promotionId !== event.promotionId
        || entry.payload.segmentType !== "INTERVIEW"
        || entry.payload.interviewTopic !== segment.interviewTopic
        || entry.payload.interviewResponse !== segment.interviewResponse
        || typeof entry.payload.participantIds !== "string") return false;
      const weeksAgo = thisWeek - ppwDateToWeekIndex(entry.date, state.ruleset.weeksPerYear);
      const priorGuests = entry.payload.participantIds;
      return weeksAgo >= 1 && weeksAgo <= 6
        && segment.participantIds.some((id) => priorGuests.split(",").includes(id));
    }).length;
    angleFitModifier = round1(clamp(
      topicFit + formatFit + responseFit - Math.min(3.5, repeated * 1.25), -5, 5,
    ));
  }
  if (segment.type === "CELEBRATION" && segment.celebrationOccasion && segment.celebrationEnding) {
    const character = segment.participantIds.length === 1
      ? wrestlerAlignmentForPromotion(state, event.promotionId, segment.participantIds[0]!) : "TWEENER";
    const occasion = segment.celebrationOccasion === "VICTORY_LAP" ? 1.3
      : segment.celebrationOccasion === "FAN_APPRECIATION" ? (character === "FACE" ? 1.2 : -0.3)
      : segment.celebrationOccasion === "SELF_CORONATION" ? (character === "HEEL" ? 1.25 : -0.45)
      : programme ? 1.2 : -1.15;
    const ending = segment.celebrationEnding === "SALUTE_CROWD"
      ? (character === "FACE" ? 0.8 : 0.1)
      : segment.celebrationEnding === "TAUNT_RIVALS"
        ? (character === "HEEL" ? 0.8 : programme ? 0.4 : -0.2)
        : segment.celebrationEnding === "POSE" ? 0.3 : 0.15;
    // A repeated celebration means the same people, occasion and scripted
    // ending were actually performed, never that another promoter planned it.
    const thisWeek = ppwDateToWeekIndex(event.date, state.ruleset.weeksPerYear);
    const repeated = state.ledger.filter((entry) => {
      if (entry.type !== RESOLVED_SEGMENT_LEDGER_TYPE
        || entry.payload.promotionId !== event.promotionId
        || entry.payload.segmentType !== "CELEBRATION"
        || entry.payload.celebrationOccasion !== segment.celebrationOccasion
        || entry.payload.celebrationEnding !== segment.celebrationEnding
        || typeof entry.payload.participantIds !== "string") return false;
      const weeksAgo = thisWeek - ppwDateToWeekIndex(entry.date, state.ruleset.weeksPerYear);
      const priorParticipants = entry.payload.participantIds;
      return weeksAgo >= 1 && weeksAgo <= 6
        && segment.participantIds.some((id) => priorParticipants.split(",").includes(id));
    }).length;
    angleFitModifier = round1(clamp(occasion + ending - Math.min(3.5, repeated * 1.25), -5, 5));
  }
  if (segment.type === "LIVE_APPEARANCE") {
    const introductionFit = segment.liveAppearanceKind === "DEBUT"
      || segment.liveAppearanceKind === "RETURN" ? 1.2 : 0;
    const programmeFit = segment.liveAppearanceObjective === "REIGNITE_PROGRAMME"
      ? (programme ? 1.1 : -1.3) : 0;
    angleFitModifier = round1(clamp(introductionFit + programmeFit, -5, 5));
  }
  if (segment.type === "VIDEO_PACKAGE") {
    // Booked subtype, reveal and objective remain fixed. Context only affects audience reception.
    const mysteryFit = segment.videoReveal === "CRYPTIC" && segment.videoObjective === "CREATE_INTRIGUE" ? 1.5 : 0;
    const milestoneFit = segment.videoKind === "RIVALRY_RECAP" && programme ? 1.2
      : segment.videoKind === "RIVALRY_RECAP" ? -1.2 : 0;
    const repeats = segment.videoSubjectPersonId && segment.videoKind && segment.videoObjective && segment.videoReveal
      ? recentPerformedBeatCount(state, event, (payload) => (
          payload.segmentType === "VIDEO_PACKAGE"
          && payload.videoSubjectPersonId === segment.videoSubjectPersonId
          && payload.videoKind === segment.videoKind
          && payload.videoObjective === segment.videoObjective
          && payload.videoReveal === segment.videoReveal
        )) : 0;
    angleFitModifier = round1(clamp(mysteryFit + milestoneFit - Math.min(3, repeats * 1), -5, 5));
  }
  if (segment.type === "ATTACK" && segment.attackerPersonId && segment.victimPersonId
    && segment.attackPresentation && segment.attackObjective) {
    const attacker = people.find((person) => person.id === segment.attackerPersonId);
    const victim = people.find((person) => person.id === segment.victimPersonId);
    if (attacker && victim) {
      const attackerAlignment = wrestlerAlignmentForPromotion(state, event.promotionId, attacker.id);
      const victimAlignment = wrestlerAlignmentForPromotion(state, event.promotionId, victim.id);
      const formatFit = segment.attackPresentation === "BLINDSIDE"
        ? (attackerAlignment === "HEEL" ? 1.5 : attackerAlignment === "FACE" ? -1.5 : 0)
        : segment.attackPresentation === "BEATDOWN"
          ? clamp(((attacker.skills.presentation + attacker.skills.safety) / 2 - 50) / 17, -3, 3)
          : programme ? clamp(((programme.heat ?? 50) - 50) / 12, -3, 3) : -2.5;
      const objectiveFit = segment.attackObjective === "GENERATE_HEAT"
        ? (attackerAlignment === "HEEL" && victimAlignment === "FACE" ? 2.5 : -1.5)
        : segment.attackObjective === "BUILD_SYMPATHY"
          ? (victimAlignment === "FACE" && attackerAlignment !== "FACE" ? 2.5 : -1.5)
          : programme ? 1.5 : -2.5;
      const exact = recentPerformedBeatCount(state, event, (payload) => (
        payload.segmentType === "ATTACK"
        && payload.attackerPersonId === segment.attackerPersonId
        && payload.victimPersonId === segment.victimPersonId
        && payload.attackPresentation === segment.attackPresentation
        && payload.attackObjective === segment.attackObjective
      ));
      // A beat-down after a match is a different context from an isolated
      // attack. Recognise the recycled pair + identical delivery modestly,
      // without treating the two booking categories as interchangeable.
      const crossContext = recentPerformedBeatCount(state, event, (payload) => (
        payload.segmentType === "POST_MATCH_ASSAULT"
        && payload.attackerPersonId === segment.attackerPersonId
        && payload.victimPersonId === segment.victimPersonId
        && payload.attackPresentation === segment.attackPresentation
        && payload.attackObjective === segment.attackObjective
      ));
      angleFitModifier = round1(clamp(
        formatFit + objectiveFit - Math.min(3.5, exact * 1.1 + crossContext * 0.5), -5, 5,
      ));
    }
  }
  if (segment.type === "RESCUE" && segment.attackerPersonId && segment.victimPersonId && segment.rescuerPersonId) {
    const rescuer = people.find((person) => person.id === segment.rescuerPersonId);
    const aggressor = people.find((person) => person.id === segment.attackerPersonId);
    const victim = people.find((person) => person.id === segment.victimPersonId);
    if (rescuer && aggressor && victim) {
      const rescuerAlignment = wrestlerAlignmentForPromotion(state, event.promotionId, rescuer.id);
      const aggressorAlignment = wrestlerAlignmentForPromotion(state, event.promotionId, aggressor.id);
      const victimAlignment = wrestlerAlignmentForPromotion(state, event.promotionId, victim.id);
      // The World only rates reception. It never changes whether the
      // player-scripted attempted save actually succeeds or fails.
      const clarity = rescuerAlignment === "FACE" && aggressorAlignment === "HEEL" && victimAlignment === "FACE"
        ? 2.5 : rescuerAlignment === "HEEL" && victimAlignment === "FACE" ? -2 : 0;
      const credibility = clamp((rescuer.skills.presentation - 50) / 20, -2.5, 2.5);
      const stakes = programme ? clamp(((programme.heat ?? 50) - 50) / 15, -2, 2) : -0.5;
      const endingFit = segment.rescueOutcome === "RESCUER_STANDS_TALL" ? 0.9
        : segment.rescueOutcome === "ATTACKER_ESCAPES" ? (programme ? 0.8 : 0)
        : segment.rescueOutcome === "RESCUE_OVERWHELMED" ? (rescuerAlignment === "FACE" ? -0.45 : 0.15) : 0;
      const currentWeek = ppwDateToWeekIndex(event.date, state.ruleset.weeksPerYear);
      const repeats = segment.rescueOutcome ? state.ledger.filter((entry) => {
        if (entry.type !== RESOLVED_SEGMENT_LEDGER_TYPE
          || entry.payload.promotionId !== event.promotionId
          || entry.payload.segmentType !== "RESCUE"
          || entry.payload.attackerPersonId !== segment.attackerPersonId
          || entry.payload.victimPersonId !== segment.victimPersonId
          || entry.payload.rescuerPersonId !== segment.rescuerPersonId
          || entry.payload.rescueOutcome !== segment.rescueOutcome) return false;
        const weeksAgo = currentWeek - ppwDateToWeekIndex(entry.date, state.ruleset.weeksPerYear);
        return weeksAgo >= 1 && weeksAgo <= 6;
      }).length : 0;
      angleFitModifier = round1(clamp(
        clarity + credibility + stakes + endingFit - Math.min(3.5, repeats * 1.25), -5, 5,
      ));
    }
  }
  if (segment.type === "POST_MATCH_ASSAULT" && segment.attackerPersonId && segment.victimPersonId && victimMatchOutcome) {
    const attackerAlignment = wrestlerAlignmentForPromotion(state, event.promotionId, segment.attackerPersonId);
    const victimAlignment = wrestlerAlignmentForPromotion(state, event.promotionId, segment.victimPersonId);
    const roleClarity = attackerAlignment === "HEEL" && victimAlignment === "FACE" ? 2
      : attackerAlignment === "FACE" && victimAlignment === "FACE" ? -2 : 0;
    // Match result is authoritative. The assault cannot alter it.
    const aftermath = victimMatchOutcome === "WON" ? 1 : victimMatchOutcome === "LOST" ? -0.5 : 0;
    const formatFit = segment.attackPresentation === "BLINDSIDE" ? (attackerAlignment === "HEEL" ? 0.9 : -0.75)
      : segment.attackPresentation === "BEATDOWN" ? 0.5
      : segment.attackPresentation === "PULL_APART_BRAWL" ? (programme ? 1 : -0.75) : 0;
    const objectiveFit = segment.attackObjective === "ESCALATE_RIVALRY" ? (programme ? 1.15 : -0.8)
      : segment.attackObjective === "BUILD_SYMPATHY" ? (victimAlignment === "FACE" ? 0.8 : -0.6)
      : segment.attackObjective === "GENERATE_HEAT" ? (attackerAlignment === "HEEL" ? 0.8 : -0.6) : 0;
    const endingFit = segment.postMatchAssaultEnding === "ATTACKER_STANDS_TALL" ? (attackerAlignment === "HEEL" ? 0.55 : 0)
      : segment.postMatchAssaultEnding === "VICTIM_FIGHTS_BACK" ? (victimAlignment === "FACE" ? 0.9 : 0.15)
      : segment.postMatchAssaultEnding === "OFFICIALS_SEPARATE" ? 0.35 : 0;
    const currentWeek = ppwDateToWeekIndex(event.date, state.ruleset.weeksPerYear);
    const repeats = segment.postMatchAssaultEnding && segment.attackPresentation && segment.attackObjective
      ? state.ledger.filter((entry) => {
        if (entry.type !== RESOLVED_SEGMENT_LEDGER_TYPE
          || entry.payload.promotionId !== event.promotionId
          || entry.payload.segmentType !== "POST_MATCH_ASSAULT"
          || entry.payload.attackerPersonId !== segment.attackerPersonId
          || entry.payload.victimPersonId !== segment.victimPersonId
          || entry.payload.attackPresentation !== segment.attackPresentation
          || entry.payload.attackObjective !== segment.attackObjective
          || entry.payload.postMatchAssaultEnding !== segment.postMatchAssaultEnding) return false;
        const weeksAgo = currentWeek - ppwDateToWeekIndex(entry.date, state.ruleset.weeksPerYear);
        return weeksAgo >= 1 && weeksAgo <= 6;
      }).length : 0;
    // The completed match result is an immutable input, never edited by an
    // assault. The booked aftermath controls who stands tall after the bell.
    angleFitModifier = round1(clamp(
      roleClarity + aftermath + formatFit + objectiveFit + endingFit - Math.min(
        3.5, repeats * 1.25 + (segment.attackPresentation && segment.attackObjective
          ? recentPerformedBeatCount(state, event, (payload) => (
              payload.segmentType === "ATTACK"
              && payload.attackerPersonId === segment.attackerPersonId
              && payload.victimPersonId === segment.victimPersonId
              && payload.attackPresentation === segment.attackPresentation
              && payload.attackObjective === segment.attackObjective
            )) * 0.5 : 0),
      ), -5, 5,
    ));
  }
  if (segment.type === "CONFRONTATION" && segment.confrontationEnding
    && segment.initiatorPersonId && segment.targetPersonId) {
    const instigator = wrestlerAlignmentForPromotion(state, event.promotionId, segment.initiatorPersonId);
    const opponent = wrestlerAlignmentForPromotion(state, event.promotionId, segment.targetPersonId);
    const stakes = programme ? clamp(((programme.heat ?? 50) - 50) / 16, -2, 2) : -0.65;
    const contrastingCharacters = instigator !== opponent ? 1.0 : 0;
    const endingFit = segment.confrontationEnding === "STAREDOWN" ? (programme ? 1.15 : 0.2)
      : segment.confrontationEnding === "INITIATOR_BACKS_DOWN" ? (instigator === "HEEL" ? 0.9 : -0.5)
      : segment.confrontationEnding === "TARGET_BACKS_DOWN" ? (opponent === "HEEL" ? 0.9 : -0.5)
      : instigator === "FACE" && opponent === "FACE" ? 1.25 : -0.7;
    // Only a completed prior stand-off between the exact ordered pair with
    // the same booked ending counts. An unperformed draft or rival promotion
    // never changes this promoter's crowd response.
    const thisWeek = ppwDateToWeekIndex(event.date, state.ruleset.weeksPerYear);
    const repeated = state.ledger.filter((entry) => (
      entry.type === RESOLVED_SEGMENT_LEDGER_TYPE
      && entry.payload.promotionId === event.promotionId
      && entry.payload.segmentType === "CONFRONTATION"
      && entry.payload.initiatorPersonId === segment.initiatorPersonId
      && entry.payload.targetPersonId === segment.targetPersonId
      && entry.payload.confrontationEnding === segment.confrontationEnding
      && thisWeek - ppwDateToWeekIndex(entry.date, state.ruleset.weeksPerYear) >= 1
      && thisWeek - ppwDateToWeekIndex(entry.date, state.ruleset.weeksPerYear) <= 6
    )).length;
    angleFitModifier = round1(clamp(
      stakes + contrastingCharacters + endingFit - Math.min(3.5, repeated * 1.25),
      -5, 5,
    ));
  }
  if (segment.type === "INTERRUPTION" && segment.initiatorPersonId && segment.targetPersonId) {
    const interrupterAlignment = wrestlerAlignmentForPromotion(state, event.promotionId, segment.initiatorPersonId);
    const speakerAlignment = wrestlerAlignmentForPromotion(state, event.promotionId, segment.targetPersonId);
    const rivalryContext = programme ? clamp(((programme.heat ?? 50) - 50) / 18, -2, 2) : -0.5;
    const contrast = interrupterAlignment !== speakerAlignment ? 1.5 : 0;
    // No simulation veto: the booked side prevails, even if the audience is unconvinced.
    const beat = segment.interruptionOutcome === "BRAWL" ? (programme ? 1.5 : -0.5)
      : segment.interruptionOutcome === "INTERRUPTER_PREVAILS" ? (interrupterAlignment === "HEEL" ? 1 : 0)
      : segment.interruptionOutcome === "SPEAKER_PREVAILS" ? (speakerAlignment === "FACE" ? 1 : 0)
      : 0.25;
    const repeats = segment.interruptionOutcome
      ? recentPerformedBeatCount(state, event, (payload) => (
          payload.segmentType === "INTERRUPTION"
          && payload.initiatorPersonId === segment.initiatorPersonId
          && payload.targetPersonId === segment.targetPersonId
          && payload.interruptionOutcome === segment.interruptionOutcome
        )) : 0;
    angleFitModifier = round1(clamp(
      rivalryContext + contrast + beat - Math.min(3.3, repeats * 1.1), -5, 5,
    ));
  }
  if (segment.type === "CHALLENGE" && segment.challengeResponse && segment.initiatorPersonId && segment.targetPersonId) {
    // Booking controls the response; role clarity and rivalry affect reception.
    const challenger = wrestlerAlignmentForPromotion(state, event.promotionId, segment.initiatorPersonId);
    const challenged = wrestlerAlignmentForPromotion(state, event.promotionId, segment.targetPersonId);
    const contrast = challenger !== challenged ? 1 : 0;
    const context = programme ? clamp(((programme.heat ?? 50) - 50) / 18, -2, 2) : -0.5;
    const responseFit = segment.challengeResponse === "ACCEPTED" ? 0.5
      : segment.challengeResponse === "REFUSED" ? (challenged === "HEEL" ? 1 : -0.5) : 0;
    const repeats = recentPerformedBeatCount(state, event, (payload) => (
      payload.segmentType === "CHALLENGE"
      && payload.initiatorPersonId === segment.initiatorPersonId
      && payload.targetPersonId === segment.targetPersonId
      && payload.challengeResponse === segment.challengeResponse
    ));
    angleFitModifier = round1(clamp(
      contrast + context + responseFit - Math.min(3.3, repeats * 1.1), -5, 5,
    ));
  }
  if (segment.type === "STABLE_RECONCILIATION" && segment.initiatorPersonId && segment.targetPersonId) {
    // The booker scripts reconciliation or rejection; the World judges delivery.
    const representative = wrestlerAlignmentForPromotion(state, event.promotionId, segment.initiatorPersonId);
    const formerMember = wrestlerAlignmentForPromotion(state, event.promotionId, segment.targetPersonId);
    const characterFit = representative === formerMember ? 1 : -0.5;
    const programmeFit = programme ? clamp(((programme.heat ?? 50) - 50) / 16, -2, 2) : -0.5;
    angleFitModifier = round1(clamp(characterFit + programmeFit + (segment.stableReconciliationOutcome === "REBUFFED" ? 0.4 : 0.7), -5, 5));
  }
  if (segment.type === "STABLE_EXIT" && segment.initiatorPersonId && segment.targetPersonId) {
    // Which wrestler leaves, and whether by expulsion or walkout, is scripted.
    // Alignment, ongoing programmes and talent drive audience credibility only.
    const representative = wrestlerAlignmentForPromotion(state, event.promotionId, segment.initiatorPersonId);
    const departing = wrestlerAlignmentForPromotion(state, event.promotionId, segment.targetPersonId);
    const clarity = segment.stableExitOutcome === "EXPELLED"
      ? (representative === "HEEL" ? 1.5 : representative === "FACE" ? -0.5 : 0)
      : (departing === "FACE" ? 1.25 : 0);
    const stakes = programme ? clamp(((programme.heat ?? 50) - 50) / 16, -2, 2) : -0.5;
    angleFitModifier = round1(clamp(clarity + stakes, -5, 5));
  }
  if (segment.type === "STABLE_INVITATION" && segment.initiatorPersonId && segment.targetPersonId) {
    // The player writes the response; existing stable identity and performers
    // affect delivery. An accepted offer never silently changes membership.
    const repAlignment = wrestlerAlignmentForPromotion(state, event.promotionId, segment.initiatorPersonId);
    const recruitAlignment = wrestlerAlignmentForPromotion(state, event.promotionId, segment.targetPersonId);
    const characterFit = repAlignment === recruitAlignment ? 1.2 : -0.8;
    const storyline = programme ? clamp(((programme.heat ?? 50) - 50) / 20, -2, 2) : 0;
    angleFitModifier = round1(clamp(characterFit + storyline, -5, 5));
  }
  if (segment.type === "CONTRACT_SIGNING" && segment.initiatorPersonId && segment.targetPersonId) {
    // The signed/rejected/walkout/brawl beat is scripted. Alignment and
    // ongoing rivalry only influence how convincingly it plays to the crowd.
    const proposer = wrestlerAlignmentForPromotion(state, event.promotionId, segment.initiatorPersonId);
    const responder = wrestlerAlignmentForPromotion(state, event.promotionId, segment.targetPersonId);
    const tension = proposer !== responder ? 1.5 : -0.5;
    const context = programme ? clamp(((programme.heat ?? 50) - 50) / 18, -2, 2) : -0.5;
    const format = segment.signingOutcome === "BRAWL" ? (programme ? 1.5 : -1.5)
      : segment.signingOutcome === "SIGNED" ? 0.5
      : segment.signingOutcome === "WALKOUT" ? (programme ? 0.5 : -0.5) : 0;
    angleFitModifier = round1(clamp(tension + context + format, -5, 5));
  }
  const alignmentVolatilityModifier = segment.type === "TURN" && segment.turnPersonId
    ? round1(recentAlignmentVolatilityPenalty(state, event.promotionId, [segment.turnPersonId]))
    : 0;
  const executionQuality = round1(clamp(
    delivery
      + moraleModifier
      + fatigueModifier
      + programmeModifier * 0.25
      + alignmentVolatilityModifier * 0.5
      + angleFitModifier * 0.35,
    0,
    100,
  ));
  const crowdResponse = round1(clamp(
    executionQuality * 0.48
      + starPower * 0.34
      + event.eventImportance * 0.18
      + programmeModifier
      + alignmentVolatilityModifier
      + angleFitModifier,
    0,
    100,
  ));
  const impact = round1(clamp(
    executionQuality * 0.45 + crowdResponse * 0.45 + event.eventImportance * 0.10,
    0,
    100,
  ));
  return {
    executionQuality,
    crowdResponse,
    impact,
    outcomeBand: outcomeBand(crowdResponse),
    programmeModifier,
    fatigueModifier,
    moraleModifier,
    alignmentVolatilityModifier,
    angleFitModifier,
  };
}

function resolvedSegmentFromLedger(entry: LedgerEvent): ResolvedShowSegment | null {
  if (entry.type !== RESOLVED_SEGMENT_LEDGER_TYPE) return null;
  const eventId = entry.payload.eventId;
  const promotionId = entry.payload.promotionId;
  const sourceDraftId = entry.payload.sourceDraftId;
  const draftSegmentId = entry.payload.draftSegmentId;
  const slotOrder = entry.payload.slotOrder;
  const type = entry.payload.segmentType;
  const participantIds = entry.payload.participantIds;
  const programmeId = entry.payload.programmeId;
  const plannedLengthMinutes = entry.payload.plannedLengthMinutes;
  const videoSubjectPersonId = entry.payload.videoSubjectPersonId ?? null;
  const videoKind = entry.payload.videoKind ?? null;
  const videoObjective = entry.payload.videoObjective ?? null;
  const videoReveal = entry.payload.videoReveal ?? null;
  const liveAppearanceKind = entry.payload.liveAppearanceKind ?? null;
  const liveAppearanceObjective = entry.payload.liveAppearanceObjective ?? null;
  const promoPurpose = entry.payload.promoPurpose ?? null;
  const interviewFormat = entry.payload.interviewFormat ?? null;
  const interviewTopic = entry.payload.interviewTopic ?? null;
  const interviewResponse = entry.payload.interviewResponse ?? null;
  const celebrationOccasion = entry.payload.celebrationOccasion ?? null;
  const celebrationEnding = entry.payload.celebrationEnding ?? null;
  const attackerPersonId = entry.payload.attackerPersonId ?? null;
  const victimPersonId = entry.payload.victimPersonId ?? null;
  const rescuerPersonId = entry.payload.rescuerPersonId ?? null;
  const rescueOutcome = entry.payload.rescueOutcome ?? null;
  const postMatchAssaultEnding = entry.payload.postMatchAssaultEnding ?? null;
  const sourceDraftMatchId = entry.payload.sourceDraftMatchId ?? null;
  const sourceMatchId = entry.payload.sourceMatchId ?? null;
  const victimMatchOutcome = entry.payload.victimMatchOutcome ?? null;
  const initiatorPersonId = entry.payload.initiatorPersonId ?? null;
  const targetPersonId = entry.payload.targetPersonId ?? null;
  const signingOutcome = entry.payload.signingOutcome ?? null;
  const challengeResponse = entry.payload.challengeResponse ?? null;
  const interruptionOutcome = entry.payload.interruptionOutcome ?? null;
  const confrontationEnding = entry.payload.confrontationEnding ?? null;
  const stableId = entry.payload.stableId ?? null;
  const stableName = entry.payload.stableName ?? null;
  const stableInvitationOutcome = entry.payload.stableInvitationOutcome ?? null;
  const stableExitOutcome = entry.payload.stableExitOutcome ?? null;
  const stableReconciliationOutcome = entry.payload.stableReconciliationOutcome ?? null;
  const attackPresentation = entry.payload.attackPresentation ?? null;
  const attackObjective = entry.payload.attackObjective ?? null;
  const turnPersonId = entry.payload.turnPersonId === undefined ? null : entry.payload.turnPersonId;
  const turnTargetAlignment = entry.payload.turnTargetAlignment === undefined ? null : entry.payload.turnTargetAlignment;
  const turnPresentation = entry.payload.turnPresentation ?? (type === "TURN" ? "REVEAL" : null);
  const betrayedPersonId = entry.payload.betrayedPersonId ?? null;
  const executionQuality = typeof entry.payload.segmentExecutionQuality === "number" ? entry.payload.segmentExecutionQuality : null;
  const crowdResponse = typeof entry.payload.segmentCrowdResponse === "number" ? entry.payload.segmentCrowdResponse : null;
  const impact = typeof entry.payload.segmentImpact === "number" ? entry.payload.segmentImpact : null;
  const outcome = typeof entry.payload.segmentOutcomeBand === "string" ? entry.payload.segmentOutcomeBand : null;
  const programmeModifier = typeof entry.payload.segmentProgrammeModifier === "number" ? entry.payload.segmentProgrammeModifier : 0;
  const fatigueModifier = typeof entry.payload.segmentFatigueModifier === "number" ? entry.payload.segmentFatigueModifier : 0;
  const moraleModifier = typeof entry.payload.segmentMoraleModifier === "number" ? entry.payload.segmentMoraleModifier : 0;
  const alignmentVolatilityModifier = typeof entry.payload.segmentAlignmentVolatilityModifier === "number"
    ? entry.payload.segmentAlignmentVolatilityModifier
    : 0;
  const angleFitModifier = typeof entry.payload.segmentAngleFitModifier === "number"
    ? entry.payload.segmentAngleFitModifier : 0;
  if (
    typeof eventId !== "string"
    || typeof promotionId !== "string"
    || typeof sourceDraftId !== "string"
    || typeof draftSegmentId !== "string"
    || typeof slotOrder !== "number"
    || !Number.isInteger(slotOrder)
    || slotOrder < 1
    || typeof type !== "string"
    || !SEGMENT_TYPES.has(type as DetailedShowSegmentType)
    || typeof participantIds !== "string"
    || (programmeId !== null && typeof programmeId !== "string")
    || (videoSubjectPersonId !== null && typeof videoSubjectPersonId !== "string")
    || (videoKind !== null && !["DEBUT_TEASER", "RETURN_TEASER", "CHARACTER_SPOTLIGHT", "RIVALRY_RECAP", "EVENT_HYPE", "TRAINING_MONTAGE"].includes(String(videoKind)))
    || (videoObjective !== null && !["CREATE_INTRIGUE", "BUILD_ANTICIPATION", "ESTABLISH_THREAT", "BUILD_SYMPATHY", "RECAP_STAKES"].includes(String(videoObjective)))
    || (videoReveal !== null && !["CRYPTIC", "NAMED", "FULL"].includes(String(videoReveal)))
    || (liveAppearanceKind !== null && !["DEBUT", "RETURN", "SURPRISE_REVEAL", "INTRODUCTION"].includes(String(liveAppearanceKind)))
    || (liveAppearanceObjective !== null && !["ESTABLISH_STAR", "BUILD_EXCITEMENT", "CREATE_MYSTERY", "UNSETTLE_RIVAL", "REIGNITE_PROGRAMME"].includes(String(liveAppearanceObjective)))
    || (promoPurpose !== null && !PROMO_PURPOSES.includes(promoPurpose as PromoPurpose))
    || (interviewFormat !== null && !INTERVIEW_FORMATS.includes(interviewFormat as InterviewFormat))
    || (interviewTopic !== null && !INTERVIEW_TOPICS.includes(interviewTopic as InterviewTopic))
    || (interviewResponse !== null && !INTERVIEW_RESPONSES.includes(interviewResponse as InterviewResponse))
    || (celebrationOccasion !== null && !CELEBRATION_OCCASIONS.includes(celebrationOccasion as CelebrationOccasion))
    || (celebrationEnding !== null && !CELEBRATION_ENDINGS.includes(celebrationEnding as CelebrationEnding))
    || (confrontationEnding !== null && !CONFRONTATION_ENDINGS.includes(confrontationEnding as ConfrontationEnding))
    || (rescueOutcome !== null && !RESCUE_OUTCOMES.includes(rescueOutcome as RescueOutcome))
    || (postMatchAssaultEnding !== null
      && !POST_MATCH_ASSAULT_ENDINGS.includes(postMatchAssaultEnding as PostMatchAssaultEnding))
    || typeof plannedLengthMinutes !== "number"
    || !Number.isInteger(plannedLengthMinutes)
    || (attackerPersonId !== null && typeof attackerPersonId !== "string")
    || (victimPersonId !== null && typeof victimPersonId !== "string")
    || (rescuerPersonId !== null && typeof rescuerPersonId !== "string")
    || (sourceDraftMatchId !== null && typeof sourceDraftMatchId !== "string")
    || (sourceMatchId !== null && typeof sourceMatchId !== "string")
    || (victimMatchOutcome !== null && !["WON", "LOST", "DRAW"].includes(String(victimMatchOutcome)))
    || (initiatorPersonId !== null && typeof initiatorPersonId !== "string")
    || (targetPersonId !== null && typeof targetPersonId !== "string")
    || (signingOutcome !== null && !["SIGNED", "REJECTED", "WALKOUT", "BRAWL"].includes(String(signingOutcome)))
    || (challengeResponse !== null && !["ACCEPTED", "REFUSED", "LEFT_OPEN"].includes(String(challengeResponse)))
    || (interruptionOutcome !== null && !["VERBAL_EXCHANGE", "INTERRUPTER_PREVAILS", "SPEAKER_PREVAILS", "BRAWL"].includes(String(interruptionOutcome)))
    || (stableId !== null && typeof stableId !== "string")
    || (stableName !== null && typeof stableName !== "string")
    || (stableInvitationOutcome !== null && !["ACCEPTED", "REFUSED"].includes(String(stableInvitationOutcome)))
    || (stableExitOutcome !== null && !["EXPELLED", "WALKED_OUT"].includes(String(stableExitOutcome)))
    || (stableReconciliationOutcome !== null && !["RECONCILED", "REBUFFED"].includes(String(stableReconciliationOutcome)))
    || (attackPresentation !== null && !["BLINDSIDE", "BEATDOWN", "PULL_APART_BRAWL"].includes(String(attackPresentation)))
    || (attackObjective !== null && !["GENERATE_HEAT", "BUILD_SYMPATHY", "ESCALATE_RIVALRY"].includes(String(attackObjective)))
    || (turnPersonId !== null && typeof turnPersonId !== "string")
    || (turnTargetAlignment !== null && !isWrestlerAlignment(turnTargetAlignment))
    || (turnPresentation !== null && turnPresentation !== "REVEAL" && turnPresentation !== "BETRAYAL")
    || (betrayedPersonId !== null && typeof betrayedPersonId !== "string")
    || (outcome !== null && !["POOR", "FLAT", "SOLID", "STRONG", "HOT"].includes(outcome))
  ) return null;

  return {
    ledgerId: entry.id,
    eventId,
    promotionId,
    sourceDraftId,
    draftSegmentId,
    slotOrder,
    type: type as DetailedShowSegmentType,
    participantIds: participantIds ? participantIds.split(",").filter(Boolean) : [],
    programmeId,
    plannedLengthMinutes,
    videoSubjectPersonId: videoSubjectPersonId as Id | null,
    videoKind: videoKind as VideoPackageKind | null,
    videoObjective: videoObjective as VideoPackageObjective | null,
    videoReveal: videoReveal as VideoPackageReveal | null,
    liveAppearanceKind: liveAppearanceKind as LiveAppearanceKind | null,
    liveAppearanceObjective: liveAppearanceObjective as LiveAppearanceObjective | null,
    promoPurpose: promoPurpose as PromoPurpose | null,
    interviewFormat: interviewFormat as InterviewFormat | null,
    interviewTopic: interviewTopic as InterviewTopic | null,
    interviewResponse: interviewResponse as InterviewResponse | null,
    celebrationOccasion: celebrationOccasion as CelebrationOccasion | null,
    celebrationEnding: celebrationEnding as CelebrationEnding | null,
    attackerPersonId: attackerPersonId as Id | null,
    victimPersonId: victimPersonId as Id | null,
    rescuerPersonId: rescuerPersonId as Id | null,
    rescueOutcome: rescueOutcome as RescueOutcome | null,
    postMatchAssaultEnding: postMatchAssaultEnding as PostMatchAssaultEnding | null,
    sourceDraftMatchId: sourceDraftMatchId as string | null,
    sourceMatchId: sourceMatchId as Id | null,
    victimMatchOutcome: victimMatchOutcome as "WON" | "LOST" | "DRAW" | null,
    initiatorPersonId: initiatorPersonId as Id | null,
    targetPersonId: targetPersonId as Id | null,
    signingOutcome: signingOutcome as SigningOutcome | null,
    challengeResponse: challengeResponse as ChallengeResponse | null,
    interruptionOutcome: interruptionOutcome as InterruptionOutcome | null,
    confrontationEnding: confrontationEnding as ConfrontationEnding | null,
    stableId: stableId as Id | null,
    stableName: stableName as string | null,
    stableInvitationOutcome: stableInvitationOutcome as StableInvitationOutcome | null,
    stableExitOutcome: stableExitOutcome as StableExitOutcome | null,
    stableReconciliationOutcome: stableReconciliationOutcome as StableReconciliationOutcome | null,
    attackPresentation: attackPresentation as AttackPresentation | null,
    attackObjective: attackObjective as AttackObjective | null,
    turnPersonId,
    turnTargetAlignment: turnTargetAlignment as WrestlerAlignment | null,
    turnPresentation: turnPresentation as TurnPresentation | null,
    betrayedPersonId: betrayedPersonId as Id | null,
    executionQuality,
    crowdResponse,
    impact,
    outcomeBand: outcome as ResolvedSegmentOutcomeBand | null,
    programmeModifier,
    fatigueModifier,
    moraleModifier,
    alignmentVolatilityModifier,
    angleFitModifier,
  };
}

export function resolvedShowSegmentsForEvent(state: WorldState, eventId: Id): ResolvedShowSegment[] {
  return state.ledger
    .map(resolvedSegmentFromLedger)
    .filter((segment): segment is ResolvedShowSegment => segment !== null && segment.eventId === eventId)
    .sort((left, right) => left.slotOrder - right.slotOrder || left.ledgerId.localeCompare(right.ledgerId));
}

function completedMatchForAftermath(
  state: WorldState,
  eventId: Id,
  draft: DetailedShowDraft,
  segment: NormalizedDraftSegment,
): { sourceMatchId: Id; victimMatchOutcome: "WON" | "LOST" | "DRAW" } | null {
  if (segment.type !== "POST_MATCH_ASSAULT" || !segment.sourceDraftMatchId || !segment.victimPersonId) return null;
  const source = draft.matches.find((match) => match.draftMatchId === segment.sourceDraftMatchId);
  if (!source) return null;
  const expected = [...source.sideAIds, ...source.sideBIds];
  const match = state.matches.find((candidate) => {
    if (candidate.eventId !== eventId || candidate.status !== "COMPLETED" || candidate.type !== source.type) return false;
    const actual = state.matchParticipants.filter((participant) => participant.matchId === candidate.id);
    return actual.length === expected.length && actual.every((participant) => expected.includes(participant.personId));
  });
  if (!match) return null;
  const victim = state.matchParticipants.find((participant) => (
    participant.matchId === match.id && participant.personId === segment.victimPersonId
  ));
  if (!victim) return null;
  return {
    sourceMatchId: match.id,
    victimMatchOutcome: match.actualWinnerSide === null ? "DRAW"
      : victim.side === match.actualWinnerSide ? "WON" : "LOST",
  };
}

function segmentSlotOrder(draft: DetailedShowDraft, segmentId: string, fallbackIndex: number): number {
  const configured = draft.runningOrder?.findIndex((slot) => slot.kind === "SEGMENT" && slot.refId === segmentId) ?? -1;
  if (configured >= 0) return configured + 1;
  return Math.max(draft.runningOrder?.length ?? 0, draft.matches.length) + fallbackIndex + 1;
}

/**
 * Freezes human-booked segments into immutable show history after the event has
 * completed. Programme activity is derived from the same frozen occurrence so
 * Results and Programme Heat cannot disagree about whether a segment happened.
 */
export function recordResolvedShowSegments(
  state: WorldState,
  planning: WorldPlanningState,
): number {
  if (planning.worldId !== state.world.id) throw new Error("planning state does not belong to this World");
  let recorded = 0;
  const writer = new LedgerWriter(state.world.id, state.ledger);

  for (const workspace of planning.workspaces) {
    for (const draft of workspace.detailedShowDrafts) {
      if (!sameWeek(draft.targetDate, state.world.currentDate)) continue;
      const segments = normalizedSegments(draft);
      if (segments.length === 0) continue;
      const event = state.events.find((candidate) => (
        candidate.promotionId === draft.promotionId
        && candidate.status === "COMPLETED"
        && sameDate(candidate.date, draft.targetDate)
      ));
      if (!event) continue;

      const existing = new Set(
        resolvedShowSegmentsForEvent(state, event.id).map((segment) => segment.draftSegmentId),
      );
      const cancelled = new Set(state.ledger.filter((entry) => (
        entry.type === "PLANNED_LIVE_ARRIVAL_CANCELLED_AT_LOCK"
        && entry.payload.eventId === event.id
        && entry.payload.sourceDraftId === draft.draftId
      )).map((entry) => String(entry.payload.draftSegmentId)));

      segments.forEach((segment, segmentIndex) => {
        if (existing.has(segment.draftSegmentId) || cancelled.has(segment.draftSegmentId)) return;
        const slotOrder = segmentSlotOrder(draft, segment.draftSegmentId, segmentIndex);
        const sourceMatch = segment.type === "POST_MATCH_ASSAULT"
          ? completedMatchForAftermath(state, event.id, draft, segment)
          : null;
        // Incomplete or missing matches never yield fictional aftermath.
        if (segment.type === "POST_MATCH_ASSAULT" && !sourceMatch) return;
        const outcome = segmentOutcome(state, event, segment, sourceMatch?.victimMatchOutcome ?? null);
        writer.append({
          date: event.date,
          type: RESOLVED_SEGMENT_LEDGER_TYPE,
          significance: "ROUTINE",
          entityIds: [event.id, draft.promotionId, ...segment.participantIds, ...(segment.videoSubjectPersonId ? [segment.videoSubjectPersonId] : []), ...(segment.stableId ? [segment.stableId] : [])],
          payload: {
            eventId: event.id,
            promotionId: draft.promotionId,
            sourceDraftId: draft.draftId,
            draftSegmentId: segment.draftSegmentId,
            slotOrder,
            segmentType: segment.type,
            participantIds: segment.participantIds.join(","),
            programmeId: segment.programmeId,
            plannedLengthMinutes: segment.plannedLengthMinutes,
            videoSubjectPersonId: segment.videoSubjectPersonId,
            videoKind: segment.videoKind,
            videoObjective: segment.videoObjective,
            videoReveal: segment.videoReveal,
            liveAppearanceKind: segment.liveAppearanceKind,
            liveAppearanceObjective: segment.liveAppearanceObjective,
            promoPurpose: segment.promoPurpose,
            interviewFormat: segment.interviewFormat,
            interviewTopic: segment.interviewTopic,
            interviewResponse: segment.interviewResponse,
            celebrationOccasion: segment.celebrationOccasion,
            celebrationEnding: segment.celebrationEnding,
            attackerPersonId: segment.attackerPersonId,
            victimPersonId: segment.victimPersonId,
            rescuerPersonId: segment.rescuerPersonId,
            rescueOutcome: segment.rescueOutcome,
            postMatchAssaultEnding: segment.postMatchAssaultEnding,
            sourceDraftMatchId: segment.sourceDraftMatchId,
            sourceMatchId: sourceMatch?.sourceMatchId ?? null,
            victimMatchOutcome: sourceMatch?.victimMatchOutcome ?? null,
            initiatorPersonId: segment.initiatorPersonId,
            targetPersonId: segment.targetPersonId,
            signingOutcome: segment.signingOutcome,
            challengeResponse: segment.challengeResponse,
            interruptionOutcome: segment.interruptionOutcome,
            confrontationEnding: segment.confrontationEnding,
            stableId: segment.stableId,
            stableName: segment.stableId ? (state.stables ?? []).find((stable) => stable.id === segment.stableId)?.name ?? null : null,
            stableInvitationOutcome: segment.stableInvitationOutcome,
            stableExitOutcome: segment.stableExitOutcome,
            stableReconciliationOutcome: segment.stableReconciliationOutcome,
            attackPresentation: segment.attackPresentation,
            attackObjective: segment.attackObjective,
            turnPersonId: segment.turnPersonId,
            turnTargetAlignment: segment.turnTargetAlignment,
            turnPresentation: segment.turnPresentation,
            betrayedPersonId: segment.betrayedPersonId,
            segmentExecutionQuality: outcome.executionQuality,
            segmentCrowdResponse: outcome.crowdResponse,
            segmentImpact: outcome.impact,
            segmentOutcomeBand: outcome.outcomeBand,
            segmentProgrammeModifier: outcome.programmeModifier,
            segmentFatigueModifier: outcome.fatigueModifier,
            segmentMoraleModifier: outcome.moraleModifier,
            segmentAlignmentVolatilityModifier: outcome.alignmentVolatilityModifier,
            segmentAngleFitModifier: outcome.angleFitModifier,
          },
        });
        existing.add(segment.draftSegmentId);
        recorded += 1;

        if (!segment.programmeId) return;
        const programme = (state.programmes ?? []).find((candidate) => (
          candidate.id === segment.programmeId
          && candidate.promotionId === draft.promotionId
          && candidate.status === "ACTIVE"
        ));
        if (!programme) return;
        const alreadyRecorded = programmeActivities(state, programme.id).some((activity) => (
          activity.kind === "SEGMENT" && activity.eventId === event.id
        ));
        if (alreadyRecorded) return;
        const participantEntityIds = activityEntityIds(state, programme, segment);
        if (participantEntityIds.length === 0) return;
        recordProgrammeActivity(state, {
          programmeId: programme.id,
          kind: "SEGMENT",
          date: event.date,
          participantEntityIds,
          eventId: event.id,
        });
      });
    }
  }

  return recorded;
}

export function recordResolvedProgrammeSegments(
  state: WorldState,
  planning: WorldPlanningState,
): number {
  return recordResolvedShowSegments(state, planning);
}


export function applyResolvedShowTurns(state: WorldState): number {
  const turnSegments = state.ledger
    .filter((entry) => entry.type === RESOLVED_SEGMENT_LEDGER_TYPE && sameWeek(entry.date, state.world.currentDate))
    .map(resolvedSegmentFromLedger)
    .filter((segment): segment is ResolvedShowSegment => (
      segment !== null
      && segment.type === "TURN"
      && segment.turnPersonId !== null
      && segment.turnTargetAlignment !== null
    ))
    .sort((left, right) => left.slotOrder - right.slotOrder || left.ledgerId.localeCompare(right.ledgerId));

  let applied = 0;
  for (const segment of turnSegments) {
    const alreadyApplied = state.ledger.some((entry) => (
      entry.type === "PROMOTION_ALIGNMENT_CHANGED"
      && entry.payload.method === "TURN"
      && entry.payload.sourceEventId === segment.eventId
      && entry.payload.sourceSegmentId === segment.draftSegmentId
    ));
    if (alreadyApplied) continue;

    changePromotionWrestlerAlignment(
      state,
      segment.promotionId,
      segment.turnPersonId!,
      segment.turnTargetAlignment!,
      {
        method: "TURN",
        sourceEventId: segment.eventId,
        sourceSegmentId: segment.draftSegmentId,
      },
    );
    applied += 1;
  }
  return applied;
}
