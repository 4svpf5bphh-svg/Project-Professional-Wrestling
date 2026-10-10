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
import type {
  DetailedProgrammeSegmentDraft,
  DetailedShowDraft,
  DetailedShowSegmentDraft,
  DetailedShowSegmentType,
  AttackPresentation,
  AttackObjective,
  TurnPresentation,
  SigningOutcome,
  ChallengeResponse,
  InterruptionOutcome,
  StableInvitationOutcome,
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
  "ATTACK",
  "RESCUE",
  "POST_MATCH_ASSAULT",
  "CELEBRATION",
  "TURN",
]);

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
  attackerPersonId: Id | null;
  victimPersonId: Id | null;
  rescuerPersonId: Id | null;
  sourceDraftMatchId: string | null;
  sourceMatchId: Id | null;
  victimMatchOutcome: "WON" | "LOST" | "DRAW" | null;
  initiatorPersonId: Id | null;
  targetPersonId: Id | null;
  signingOutcome: SigningOutcome | null;
  challengeResponse: ChallengeResponse | null;
  interruptionOutcome: InterruptionOutcome | null;
  stableId: Id | null;
  stableName: string | null;
  stableInvitationOutcome: StableInvitationOutcome | null;
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
  attackerPersonId: Id | null;
  victimPersonId: Id | null;
  rescuerPersonId: Id | null;
  sourceDraftMatchId: string | null;
  initiatorPersonId: Id | null;
  targetPersonId: Id | null;
  signingOutcome: SigningOutcome | null;
  challengeResponse: ChallengeResponse | null;
  interruptionOutcome: InterruptionOutcome | null;
  stableId: Id | null;
  stableName: string | null;
  stableInvitationOutcome: StableInvitationOutcome | null;
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
  segment: Pick<DetailedProgrammeSegmentDraft | DetailedShowSegmentDraft, "participantIds">,
): Id[] {
  const selectedPeople = new Set(segment.participantIds);
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
    attackerPersonId: segment.type === "ATTACK" || segment.type === "RESCUE" || segment.type === "POST_MATCH_ASSAULT"
      ? (segment.attackerPersonId ?? null) : null,
    victimPersonId: segment.type === "ATTACK" || segment.type === "RESCUE" || segment.type === "POST_MATCH_ASSAULT"
      ? (segment.victimPersonId ?? null) : null,
    rescuerPersonId: segment.type === "RESCUE" ? (segment.rescuerPersonId ?? null) : null,
    sourceDraftMatchId: segment.type === "POST_MATCH_ASSAULT" ? (segment.sourceDraftMatchId ?? null) : null,
    initiatorPersonId: segment.type === "CHALLENGE" || segment.type === "CONFRONTATION" || segment.type === "INTERRUPTION" || segment.type === "CONTRACT_SIGNING" || segment.type === "STABLE_INVITATION" ? (segment.initiatorPersonId ?? null) : null,
    targetPersonId: segment.type === "CHALLENGE" || segment.type === "CONFRONTATION" || segment.type === "INTERRUPTION" || segment.type === "CONTRACT_SIGNING" || segment.type === "STABLE_INVITATION" ? (segment.targetPersonId ?? null) : null,
    signingOutcome: segment.type === "CONTRACT_SIGNING" ? (segment.signingOutcome ?? "SIGNED") : null,
    challengeResponse: segment.type === "CHALLENGE" ? (segment.challengeResponse ?? null) : null,
    interruptionOutcome: segment.type === "INTERRUPTION" ? (segment.interruptionOutcome ?? "VERBAL_EXCHANGE") : null,
    stableId: segment.type === "STABLE_INVITATION" ? (segment.stableId ?? null) : null,
    stableName: null,
    stableInvitationOutcome: segment.type === "STABLE_INVITATION" ? (segment.stableInvitationOutcome ?? "REFUSED") : null,
    attackPresentation: segment.type === "ATTACK" ? (segment.attackPresentation ?? null) : null,
    attackObjective: segment.type === "ATTACK" ? (segment.attackObjective ?? null) : null,
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
      participantIds: [...segment.participantIds],
      programmeId: segment.programmeId,
      plannedLengthMinutes: 6,
      attackerPersonId: null,
      victimPersonId: null,
      rescuerPersonId: null,
      sourceDraftMatchId: null,
      initiatorPersonId: null,
      targetPersonId: null,
      signingOutcome: null,
      challengeResponse: null,
      interruptionOutcome: null,
      stableId: null,
      stableName: null,
      stableInvitationOutcome: null,
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
  const people = segment.participantIds
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
    ATTACK: [0.38, 0.34, 0.28],
    RESCUE: [0.42, 0.30, 0.28],
    POST_MATCH_ASSAULT: [0.38, 0.35, 0.27],
    CELEBRATION: [0.40, 0.45, 0.15],
    TURN: [0.55, 0.25, 0.20],
  };
  const [presentationWeight, starWeight, momentumWeight] = weights[segment.type];
  const delivery = presentation * presentationWeight + starPower * starWeight + momentum * momentumWeight;
  const moraleModifier = round1((morale - 50) * 0.08);
  // Normal/rested condition should not make every segment report that fatigue
  // hurt delivery. Only materially elevated fatigue becomes a visible penalty.
  // A future chronological show executor can model within-show fatigue by slot.
  const fatigueModifier = round1(-Math.max(0, fatigue - 30) * 0.12);
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
      angleFitModifier = round1(clamp(formatFit + objectiveFit, -5, 5));
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
      // The save is not automatically successful: presentation, alignment and
      // storyline context determine how convincingly it lands.
      const clarity = rescuerAlignment === "FACE" && aggressorAlignment === "HEEL" && victimAlignment === "FACE"
        ? 2.5 : rescuerAlignment === "HEEL" && victimAlignment === "FACE" ? -2 : 0;
      const credibility = clamp((rescuer.skills.presentation - 50) / 20, -2.5, 2.5);
      const stakes = programme ? clamp(((programme.heat ?? 50) - 50) / 15, -2, 2) : -0.5;
      angleFitModifier = round1(clamp(clarity + credibility + stakes, -5, 5));
    }
  }
  if (segment.type === "POST_MATCH_ASSAULT" && segment.attackerPersonId && segment.victimPersonId && victimMatchOutcome) {
    const attackerAlignment = wrestlerAlignmentForPromotion(state, event.promotionId, segment.attackerPersonId);
    const victimAlignment = wrestlerAlignmentForPromotion(state, event.promotionId, segment.victimPersonId);
    const roleClarity = attackerAlignment === "HEEL" && victimAlignment === "FACE" ? 2
      : attackerAlignment === "FACE" && victimAlignment === "FACE" ? -2 : 0;
    // Match result is authoritative. The assault cannot alter it.
    const aftermath = victimMatchOutcome === "WON" ? 1 : victimMatchOutcome === "LOST" ? -0.5 : 0;
    angleFitModifier = round1(clamp(roleClarity + aftermath, -5, 5));
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
    angleFitModifier = round1(clamp(rivalryContext + contrast + beat, -5, 5));
  }
  if (segment.type === "CHALLENGE" && segment.challengeResponse && segment.initiatorPersonId && segment.targetPersonId) {
    // Booking controls the response; role clarity and rivalry affect reception.
    const challenger = wrestlerAlignmentForPromotion(state, event.promotionId, segment.initiatorPersonId);
    const challenged = wrestlerAlignmentForPromotion(state, event.promotionId, segment.targetPersonId);
    const contrast = challenger !== challenged ? 1 : 0;
    const context = programme ? clamp(((programme.heat ?? 50) - 50) / 18, -2, 2) : -0.5;
    const responseFit = segment.challengeResponse === "ACCEPTED" ? 0.5
      : segment.challengeResponse === "REFUSED" ? (challenged === "HEEL" ? 1 : -0.5) : 0;
    angleFitModifier = round1(clamp(contrast + context + responseFit, -5, 5));
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
  const attackerPersonId = entry.payload.attackerPersonId ?? null;
  const victimPersonId = entry.payload.victimPersonId ?? null;
  const rescuerPersonId = entry.payload.rescuerPersonId ?? null;
  const sourceDraftMatchId = entry.payload.sourceDraftMatchId ?? null;
  const sourceMatchId = entry.payload.sourceMatchId ?? null;
  const victimMatchOutcome = entry.payload.victimMatchOutcome ?? null;
  const initiatorPersonId = entry.payload.initiatorPersonId ?? null;
  const targetPersonId = entry.payload.targetPersonId ?? null;
  const signingOutcome = entry.payload.signingOutcome ?? null;
  const challengeResponse = entry.payload.challengeResponse ?? null;
  const interruptionOutcome = entry.payload.interruptionOutcome ?? null;
  const stableId = entry.payload.stableId ?? null;
  const stableName = entry.payload.stableName ?? null;
  const stableInvitationOutcome = entry.payload.stableInvitationOutcome ?? null;
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
    attackerPersonId: attackerPersonId as Id | null,
    victimPersonId: victimPersonId as Id | null,
    rescuerPersonId: rescuerPersonId as Id | null,
    sourceDraftMatchId: sourceDraftMatchId as string | null,
    sourceMatchId: sourceMatchId as Id | null,
    victimMatchOutcome: victimMatchOutcome as "WON" | "LOST" | "DRAW" | null,
    initiatorPersonId: initiatorPersonId as Id | null,
    targetPersonId: targetPersonId as Id | null,
    signingOutcome: signingOutcome as SigningOutcome | null,
    challengeResponse: challengeResponse as ChallengeResponse | null,
    interruptionOutcome: interruptionOutcome as InterruptionOutcome | null,
    stableId: stableId as Id | null,
    stableName: stableName as string | null,
    stableInvitationOutcome: stableInvitationOutcome as StableInvitationOutcome | null,
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

      segments.forEach((segment, segmentIndex) => {
        if (existing.has(segment.draftSegmentId)) return;
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
          entityIds: [event.id, draft.promotionId, ...segment.participantIds, ...(segment.stableId ? [segment.stableId] : [])],
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
            attackerPersonId: segment.attackerPersonId,
            victimPersonId: segment.victimPersonId,
            rescuerPersonId: segment.rescuerPersonId,
            sourceDraftMatchId: segment.sourceDraftMatchId,
            sourceMatchId: sourceMatch?.sourceMatchId ?? null,
            victimMatchOutcome: sourceMatch?.victimMatchOutcome ?? null,
            initiatorPersonId: segment.initiatorPersonId,
            targetPersonId: segment.targetPersonId,
            signingOutcome: segment.signingOutcome,
            challengeResponse: segment.challengeResponse,
            interruptionOutcome: segment.interruptionOutcome,
            stableId: segment.stableId,
            stableName: segment.stableId ? (state.stables ?? []).find((stable) => stable.id === segment.stableId)?.name ?? null : null,
            stableInvitationOutcome: segment.stableInvitationOutcome,
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
