import type {
  ChemistryContext,
  InjurySeverity,
  Match,
  MatchIntent,
  MatchParticipant,
  MatchSide,
  MatchType,
  Person,
  ScheduledAppearance,
  WorldState,
  WrestlingEvent,
  WorkingChemistry,
} from "../../domain/src/types.js";
import { applyMatchLoad, createInjury } from "./career.js";
import { buildBookingCard } from "./booking.js";
import { nextEntityId } from "./id-allocator.js";
import { LedgerWriter } from "./ledger.js";
import {
  plannedMatchFinish,
  setActualMatchFinish,
  setPlannedMatchFinish,
  type MatchFinish,
} from "./match-finishes.js";
import {
  evaluateMatchStyleExecution,
  type MatchStyleExecutionEvaluation,
} from "./match-style.js";
import { DeterministicRng, deterministicSeedFromText } from "./rng.js";

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

const chemistryIndexes = new WeakMap<WorldState, Map<string, WorkingChemistry>>();

function chemistryKey(personAId: string, personBId: string, context: ChemistryContext): string {
  const [a, b] = pairKey(personAId, personBId);
  return `${a}:${b}:${context}`;
}

function chemistryIndex(state: WorldState): Map<string, WorkingChemistry> {
  let index = chemistryIndexes.get(state);
  if (!index || index.size !== state.workingChemistry.length) {
    index = new Map(state.workingChemistry.map((record) => [chemistryKey(record.personAId, record.personBId, record.context), record]));
    chemistryIndexes.set(state, index);
  }
  return index;
}

function pairKey(a: string, b: string): [string, string] {
  return a < b ? [a, b] : [b, a];
}

export function getOrCreateChemistry(state: WorldState, a: Person, b: Person, context: ChemistryContext): WorkingChemistry {
  const [personAId, personBId] = pairKey(a.id, b.id);
  const index = chemistryIndex(state);
  const key = chemistryKey(personAId, personBId, context);
  const existing = index.get(key);
  if (existing) return existing;
  const rng = new DeterministicRng(deterministicSeedFromText(`${state.world.seed}:chemistry:${context}:${personAId}:${personBId}`));
  const record: WorkingChemistry = {
    id: nextEntityId(state, "workingChemistry"),
    worldId: state.world.id,
    personAId,
    personBId,
    context,
    compatibility: Math.round(rng.float(-12, 13) * 10) / 10,
    familiarity: 0,
    matchesTogether: 0,
  };
  state.workingChemistry.push(record);
  index.set(key, record);
  return record;
}

function intentFor(event: WrestlingEvent, order: number, total: number, state: WorldState): MatchIntent {
  const promotion = state.promotions.find((candidate) => candidate.id === event.promotionId)!;
  const isMain = order === total;
  if (isMain && event.type === "MAJOR") return "EPIC";
  const rng = new DeterministicRng(deterministicSeedFromText(`${state.world.seed}:${event.id}:intent:${order}`));
  if (promotion.aiProfile.riskTolerance >= 72 && rng.chance(0.18)) return "HIGH_RISK";
  if (promotion.aiProfile.matchQualityPreference >= 70 && rng.chance(0.35)) return "TECHNICAL";
  if (promotion.aiProfile.starPreference >= 70 && rng.chance(0.3)) return "SHOWCASE";
  return rng.pick(["COMPETITIVE", "STORY", "PROTECTIVE"] as const);
}

function plannedLength(intent: MatchIntent, type: MatchType, isMain: boolean): number {
  const base = intent === "EPIC" ? 28
    : intent === "TECHNICAL" ? 20
      : intent === "HIGH_RISK" ? 17
        : intent === "DOMINANT" ? 7
          : intent === "SHOWCASE" ? 11
            : intent === "PROTECTIVE" ? 12
              : intent === "STORY" ? 14
                : 15;
  return base + (type === "TAG" ? 3 : 0) + (isMain && intent !== "EPIC" ? 4 : 0);
}

function aiPlannedFinish(state: WorldState, event: WrestlingEvent, order: number, intent: MatchIntent): MatchFinish {
  const rng = new DeterministicRng(deterministicSeedFromText(`${state.world.seed}:${event.id}:finish:${order}`));
  const roll = rng.next();
  switch (intent) {
    case "TECHNICAL": return roll < 0.45 ? "SUBMISSION" : "CLEAN_PIN";
    case "PROTECTIVE": return roll < 0.55 ? "PROTECTED_FINISH" : roll < 0.8 ? "FLASH_PIN" : "CLEAN_PIN";
    case "STORY": return roll < 0.45 ? "PROTECTED_FINISH" : roll < 0.72 ? "FLASH_PIN" : "CLEAN_PIN";
    case "DOMINANT": return roll < 0.72 ? "CLEAN_PIN" : roll < 0.9 ? "SUBMISSION" : "FLASH_PIN";
    case "SHOWCASE": return roll < 0.7 ? "CLEAN_PIN" : roll < 0.88 ? "SUBMISSION" : "FLASH_PIN";
    case "EPIC": return roll < 0.58 ? "CLEAN_PIN" : roll < 0.9 ? "SUBMISSION" : "FLASH_PIN";
    case "HIGH_RISK": return roll < 0.55 ? "CLEAN_PIN" : roll < 0.78 ? "FLASH_PIN" : "PROTECTED_FINISH";
    case "COMPETITIVE": return roll < 0.56 ? "CLEAN_PIN" : roll < 0.8 ? "SUBMISSION" : "FLASH_PIN";
  }
}

function finishExecutionModifier(intent: MatchIntent, finish: MatchFinish): number {
  if (finish === "CLEAN_PIN") return intent === "DOMINANT" || intent === "SHOWCASE" || intent === "COMPETITIVE" ? 1 : 0;
  if (finish === "SUBMISSION") {
    if (intent === "TECHNICAL") return 2.5;
    if (intent === "EPIC") return 1.2;
    if (intent === "COMPETITIVE") return 0.5;
    return 0;
  }
  if (finish === "FLASH_PIN") {
    if (intent === "PROTECTIVE" || intent === "STORY") return 1.2;
    if (intent === "COMPETITIVE") return 0.4;
    if (intent === "DOMINANT") return -2.2;
    if (intent === "EPIC") return -1.2;
    return 0;
  }
  if (finish === "PROTECTED_FINISH") {
    if (intent === "PROTECTIVE" || intent === "STORY") return 1.8;
    if (intent === "HIGH_RISK") return 0.6;
    if (intent === "COMPETITIVE") return -0.8;
    if (intent === "TECHNICAL") return -1.8;
    if (intent === "EPIC") return -2.2;
    if (intent === "DOMINANT") return -2.5;
    return -1;
  }
  return -4;
}

function finishCrowdModifier(intent: MatchIntent, finish: MatchFinish): number {
  if (finish === "CLEAN_PIN") return intent === "DOMINANT" || intent === "SHOWCASE" ? 1 : 0.4;
  if (finish === "SUBMISSION") return intent === "TECHNICAL" ? 1.8 : intent === "EPIC" ? 1 : 0.2;
  if (finish === "FLASH_PIN") return intent === "STORY" || intent === "PROTECTIVE" ? 1.8 : 0.5;
  if (finish === "PROTECTED_FINISH") return intent === "STORY" || intent === "PROTECTIVE" ? 2 : -2.5;
  return -4;
}

function winnerMomentumDelta(finish: MatchFinish): number {
  switch (finish) {
    case "SUBMISSION": return 1.55;
    case "CLEAN_PIN": return 1.4;
    case "FLASH_PIN": return 0.95;
    case "PROTECTED_FINISH": return 0.7;
    case "INJURY_STOPPAGE": return 0.35;
  }
}

function loserMomentumDelta(finish: MatchFinish, greatMatch: boolean): number {
  if (greatMatch) return 0.35;
  switch (finish) {
    case "SUBMISSION": return -0.6;
    case "CLEAN_PIN": return -0.45;
    case "FLASH_PIN": return -0.15;
    case "PROTECTED_FINISH": return 0;
    case "INJURY_STOPPAGE": return -0.05;
  }
}

function winnerPopularityGain(finish: MatchFinish): number {
  switch (finish) {
    case "SUBMISSION": return 0.013;
    case "CLEAN_PIN": return 0.012;
    case "FLASH_PIN": return 0.009;
    case "PROTECTED_FINISH": return 0.006;
    case "INJURY_STOPPAGE": return 0.004;
  }
}

function pushScore(person: Person): number {
  return person.momentum * 0.4 + person.popularity * 0.3 + person.recognition * 0.2 + person.skills.presentation * 0.1;
}

function tagSideContinuity(state: WorldState, side: Person[]): number {
  if (side.length !== 2) return 0;
  const [left, right] = pairKey(side[0]!.id, side[1]!.id);
  const chemistry = state.workingChemistry.find((record) => record.context === "TAG" && record.personAId === left && record.personBId === right);
  const activeTeam = (state.teams ?? []).some((team) => {
    if (team.status !== "ACTIVE") return false;
    const members = (state.teamMemberships ?? []).filter((membership) => membership.active && membership.teamId === team.id).map((membership) => membership.personId).sort();
    return members.length === 2 && members[0] === left && members[1] === right;
  });
  return (activeTeam ? 8 : 0) + Math.min(6, (chemistry?.matchesTogether ?? 0) * 0.3) + Math.min(2, (chemistry?.familiarity ?? 0) / 50);
}

function chooseWinnerSide(sideA: Person[], sideB: Person[], state: WorldState, matchId: string): MatchSide {
  const a = sideA.reduce((sum, person) => sum + pushScore(person), 0) / sideA.length + tagSideContinuity(state, sideA);
  const b = sideB.reduce((sum, person) => sum + pushScore(person), 0) / sideB.length + tagSideContinuity(state, sideB);
  const rng = new DeterministicRng(deterministicSeedFromText(`${state.world.seed}:${matchId}:winner`));
  const adjustedA = a + rng.float(-7, 7);
  const adjustedB = b + rng.float(-7, 7);
  return adjustedA >= adjustedB ? "A" : "B";
}

interface PlannedMatch {
  match: Match;
  sideA: Person[];
  sideB: Person[];
  participants: MatchParticipant[];
}

function makeMatch(state: WorldState, event: WrestlingEvent, order: number, total: number, type: MatchType, sideA: Person[], sideB: Person[]): PlannedMatch {
  const id = nextEntityId(state, "match");
  const intent = intentFor(event, order, total, state);
  const match: Match = {
    id, worldId: state.world.id, eventId: event.id, promotionId: event.promotionId, order, type, status: "SCHEDULED", intent,
    plannedLengthMinutes: plannedLength(intent, type, order === total), actualLengthMinutes: 0,
    intendedWinnerSide: chooseWinnerSide(sideA, sideB, state, id), actualWinnerSide: null,
    finishChangedDueToInjury: false, executionQuality: 0, criticalRatingStars: 0, crowdResponse: 0,
  };
  setPlannedMatchFinish(match, aiPlannedFinish(state, event, order, intent));
  state.matches.push(match);
  const createdParticipants: MatchParticipant[] = [];
  for (const [side, people] of [["A", sideA], ["B", sideB]] as const) {
    for (const person of people) {
      const participant: MatchParticipant = {
        id: nextEntityId(state, "matchParticipant"),
        worldId: state.world.id, matchId: match.id, eventId: event.id, personId: person.id, side, won: false,
      };
      state.matchParticipants.push(participant);
      createdParticipants.push(participant);
    }
  }
  return { match, sideA, sideB, participants: createdParticipants };
}

function buildEventCard(state: WorldState, event: WrestlingEvent, appearances: ScheduledAppearance[]): PlannedMatch[] {
  const peopleById = new Map(state.people.map((person) => [person.id, person]));
  const ranked = appearances.map((appearance) => peopleById.get(appearance.personId))
    .filter((person): person is Person => Boolean(person) && person!.status === "ACTIVE")
    .sort((a, b) => (b.recognition + b.popularity + b.momentum + b.skills.matchCraft) - (a.recognition + a.popularity + a.momentum + a.skills.matchCraft) || a.id.localeCompare(b.id));
  const rng = new DeterministicRng(deterministicSeedFromText(`${state.world.seed}:${event.id}:card`));
  const cards = buildBookingCard(state, event, ranked, rng);
  const total = cards.length;
  return cards.map((card, index) => makeMatch(state, event, index + 1, total, card.type, card.sideA, card.sideB));
}

function chemistryModifier(state: WorldState, match: Match, sideA: Person[], sideB: Person[]): number {
  if (match.type === "SINGLES") {
    const record = getOrCreateChemistry(state, sideA[0]!, sideB[0]!, "SINGLES");
    const modifier = record.compatibility * (0.45 + record.familiarity / 180) + Math.min(5, record.familiarity / 10);
    record.matchesTogether += 1;
    record.familiarity = Math.min(100, record.familiarity + 3);
    return modifier;
  }
  const a = getOrCreateChemistry(state, sideA[0]!, sideA[1]!, "TAG");
  const b = getOrCreateChemistry(state, sideB[0]!, sideB[1]!, "TAG");
  const modifier = ((a.compatibility + b.compatibility) / 2) * 0.55 + ((a.familiarity + b.familiarity) / 2) * 0.04;
  for (const record of [a, b]) {
    record.matchesTogether += 1;
    record.familiarity = Math.min(100, record.familiarity + 4);
  }
  return modifier;
}

function injuryProbability(state: WorldState, match: Match, person: Person, allPeople: Person[]): number {
  const avgSafety = allPeople.reduce((sum, candidate) => sum + candidate.skills.safety, 0) / allPeople.length;
  const intentRisk = match.intent === "HIGH_RISK" ? 0.006 : match.intent === "EPIC" ? 0.0024 : match.intent === "TECHNICAL" ? 0.0012 : 0.0007;
  const fatigueRisk = person.fatigue / 18000;
  const wearRisk = person.wear / 22000;
  const safetyRisk = Math.max(0, 70 - avgSafety) / 9000;
  const lengthRisk = Math.max(0, match.plannedLengthMinutes - 15) / 12000;
  return clamp((0.0007 + intentRisk + fatigueRisk + wearRisk + safetyRisk + lengthRisk) * state.ruleset.injuryRateMultiplier, 0.0002, 0.035);
}

function styledInjuryProbability(
  state: WorldState,
  match: Match,
  person: Person,
  allPeople: Person[],
  styleEvaluation: MatchStyleExecutionEvaluation,
): number {
  const style = match.style!;
  const avgSafety = allPeople.reduce((sum, candidate) => sum + candidate.skills.safety, 0) / allPeople.length;
  const styleRisk =
    0.0005
    + Math.pow(style.risk / 100, 2) * 0.005
    + Math.pow(style.intensity / 100, 2) * 0.0014
    + Math.max(0, styleEvaluation.load.physical - 70) / 12000;
  const fatigueRisk = person.fatigue / 18000;
  const wearRisk = person.wear / 22000;
  const safetyRisk = Math.max(0, 70 - avgSafety) / 9000;
  const lengthRisk = Math.max(0, match.plannedLengthMinutes - 15) / 12000;
  return clamp(
    (styleRisk + fatigueRisk + wearRisk + safetyRisk + lengthRisk) * state.ruleset.injuryRateMultiplier,
    0.0002,
    0.035,
  );
}

function styledFinishExecutionModifier(match: Match, finish: MatchFinish): number {
  const style = match.style!;
  if (finish === "CLEAN_PIN") {
    return clamp(((style.competitiveness + style.intensity) / 2 - 50) * 0.018, -2.5, 2.5);
  }
  if (finish === "SUBMISSION") {
    return clamp((style.technical - 50) * 0.035 + (style.competitiveness - 50) * 0.008, -2.5, 3);
  }
  if (finish === "FLASH_PIN") {
    return clamp((style.story - 50) * 0.03 - Math.max(0, style.epic - 70) * 0.015, -2.5, 2.5);
  }
  if (finish === "PROTECTED_FINISH") {
    return clamp(
      (style.story - 50) * 0.035
      - Math.max(0, style.competitiveness - 60) * 0.018
      - Math.max(0, style.technical - 70) * 0.012,
      -3,
      2.5,
    );
  }
  return -4;
}

function styledFinishCrowdModifier(match: Match, finish: MatchFinish): number {
  const style = match.style!;
  if (finish === "CLEAN_PIN") {
    return clamp(((style.competitiveness + style.intensity + style.epic) / 3 - 45) * 0.018, -2, 2.5);
  }
  if (finish === "SUBMISSION") {
    return clamp((style.technical - 45) * 0.028 + (style.competitiveness - 50) * 0.006, -2, 2.8);
  }
  if (finish === "FLASH_PIN") {
    return clamp((style.story - 45) * 0.028 - Math.max(0, style.epic - 75) * 0.012, -2, 2.5);
  }
  if (finish === "PROTECTED_FINISH") {
    return clamp(
      (style.story - 45) * 0.032 - Math.max(0, style.competitiveness - 65) * 0.018,
      -3,
      2.8,
    );
  }
  return -4;
}

function injurySeverity(rng: DeterministicRng): { severity: InjurySeverity; weeksOut: number } {
  const roll = rng.next();
  if (roll < 0.56) return { severity: "MINOR", weeksOut: rng.int(1, 2) };
  if (roll < 0.86) return { severity: "MODERATE", weeksOut: rng.int(2, 5) };
  if (roll < 0.97) return { severity: "MAJOR", weeksOut: rng.int(5, 10) };
  return { severity: "SEVERE", weeksOut: rng.int(10, 18) };
}

function sideAverage(people: Person[], selector: (person: Person) => number): number {
  return people.reduce((sum, person) => sum + selector(person), 0) / people.length;
}

function resolveMatch(state: WorldState, planned: PlannedMatch, event: WrestlingEvent, isMainEvent: boolean): void {
  const { match, sideA, sideB, participants } = planned;
  if (match.status !== "SCHEDULED") return;
  const allPeople = [...sideA, ...sideB];
  if (sideA.length === 0 || sideB.length === 0 || allPeople.some((person) => person.status !== "ACTIVE")) {
    match.status = "CANCELLED";
    return;
  }

  const rng = new DeterministicRng(deterministicSeedFromText(`${state.world.seed}:${match.id}:resolve`));
  const averageRing = sideAverage(allPeople, (person) => person.skills.inRingQuality);
  const averageCraft = sideAverage(allPeople, (person) => person.skills.matchCraft);
  const averagePresentation = sideAverage(allPeople, (person) => person.skills.presentation);
  const averageStamina = sideAverage(allPeople, (person) => person.skills.stamina);
  const averageSafety = sideAverage(allPeople, (person) => person.skills.safety);
  const averageFatigue = sideAverage(allPeople, (person) => person.fatigue);
  const averageStar = sideAverage(allPeople, (person) => (person.popularity + person.recognition + person.momentum) / 3);
  const chemistry = chemistryModifier(state, match, sideA, sideB);
  const styleEvaluation = match.style === undefined
    ? null
    : evaluateMatchStyleExecution(
      match.style,
      {
        inRingQuality: averageRing,
        matchCraft: averageCraft,
        presentation: averagePresentation,
        stamina: averageStamina,
        safety: averageSafety,
      },
      match.plannedLengthMinutes,
    );
  const intentBonus = match.intent === "EPIC" ? 6 : match.intent === "TECHNICAL" ? 4 : match.intent === "HIGH_RISK" ? 3 : match.intent === "SHOWCASE" ? 2 : 0;
  const bookedFinish = plannedMatchFinish(match);
  const finishExecution = styleEvaluation === null
    ? finishExecutionModifier(match.intent, bookedFinish)
    : styledFinishExecutionModifier(match, bookedFinish);
  const fatiguePenalty = averageFatigue * 0.17;
  const staminaFit = Math.min(6, (averageStamina - 50) * 0.1) - Math.max(0, match.plannedLengthMinutes - 18) * Math.max(0, 62 - averageStamina) / 160;
  const execution = styleEvaluation === null
    ? clamp(
      averageRing * 0.43
        + averageCraft * 0.37
        + averagePresentation * 0.08
        + 8
        + chemistry
        + intentBonus
        + finishExecution
        + staminaFit
        - fatiguePenalty
        + rng.float(-7, 7),
      5,
      100,
    )
    : clamp(
      averageRing * 0.4
        + averageCraft * 0.35
        + averagePresentation * 0.08
        + averageSafety * 0.03
        + 7
        + chemistry
        + styleEvaluation.realizedUpside
        - styleEvaluation.difficultyPenalty
        + finishExecution
        + staminaFit
        - fatiguePenalty
        + rng.float(-7, 7),
      5,
      100,
    );
  match.executionQuality = Math.round(execution * 10) / 10;
  const rawStars = 0.5 + execution / 25.5 + Math.max(0, execution - 82) / 36;
  match.criticalRatingStars = Math.round(clamp(rawStars, 0.5, 5) * 4) / 4;
  const styledCrowdDelivery = styleEvaluation === null
    ? 0
    : (styleEvaluation.crowdAppeal - 45)
      * clamp(execution / 75, 0.35, 1.15)
      * 0.11;
  match.crowdResponse = Math.round(clamp(
    averageStar * 0.53
      + execution * 0.34
      + event.eventImportance * 0.13
      + (match.order >= 4 ? 2 : 0)
      + (styleEvaluation === null
        ? finishCrowdModifier(match.intent, bookedFinish)
        : styledFinishCrowdModifier(match, bookedFinish))
      + styledCrowdDelivery
      + rng.float(-6, 6),
    0,
    100,
  ) * 10) / 10;
  match.actualLengthMinutes = Math.max(3, Math.round(match.plannedLengthMinutes * rng.float(0.88, 1.1)));

  const injuriesThisMatch: { person: Person; severity: InjurySeverity }[] = [];
  for (const person of allPeople) {
    const probability = styleEvaluation === null
      ? injuryProbability(state, match, person, allPeople)
      : styledInjuryProbability(state, match, person, allPeople, styleEvaluation);
    if (!rng.chance(probability)) continue;
    const injury = injurySeverity(rng);
    createInjury(state, person, match, injury.severity, injury.weeksOut);
    injuriesThisMatch.push({ person, severity: injury.severity });
  }

  let actualWinnerSide = match.intendedWinnerSide;
  let actualFinish: MatchFinish = bookedFinish;
  const intendedWinners = match.intendedWinnerSide === "A" ? sideA : sideB;
  const seriousWinnerInjury = injuriesThisMatch.some(({ person, severity }) => (
    intendedWinners.some((winner) => winner.id === person.id)
    && (severity === "MAJOR" || severity === "SEVERE")
  ));
  if (seriousWinnerInjury) {
    actualWinnerSide = match.intendedWinnerSide === "A" ? "B" : "A";
    actualFinish = "INJURY_STOPPAGE";
    match.finishChangedDueToInjury = true;
    match.crowdResponse = Math.round(clamp(match.crowdResponse - 4, 0, 100) * 10) / 10;
  }
  // A run-in is resolved against the booked/actual winner, not a hidden
  // chance to reverse player-authored results. Injury stoppages take priority.
  if (match.interference) {
    const interferer = state.people.find((person) => person.id === match.interference!.personId);
    const eligible = interferer?.status === "ACTIVE"
      && state.scheduledAppearances.some((appearance) => (
        appearance.eventId === event.id
        && appearance.personId === interferer.id
        && appearance.status === "COMMITTED"
      ));
    const roll = new DeterministicRng(
      deterministicSeedFromText(`${state.world.seed}:${match.id}:${match.interference.personId}:run-in`),
    );
    const chance = interferer
      ? clamp(0.43 + (interferer.skills.presentation - 50) * 0.004, 0.25, 0.73) : 0;
    const landed = eligible
      && actualFinish !== "INJURY_STOPPAGE"
      && match.interference.aidedSide === actualWinnerSide
      && roll.chance(chance);
    match.interference.outcome = landed ? "SUCCESS" : "THWARTED";
    if (landed) actualFinish = "PROTECTED_FINISH";
    match.crowdResponse = Math.round(clamp(match.crowdResponse + (landed ? 2 : -1.5), 0, 100) * 10) / 10;
  }
  match.actualWinnerSide = actualWinnerSide;
  setActualMatchFinish(match, actualFinish);
  match.status = "COMPLETED";
  for (const participant of participants) participant.won = participant.side === actualWinnerSide;

  const loadBase = match.actualLengthMinutes * (
    styleEvaluation === null
      ? (match.intent === "HIGH_RISK" ? 0.72 : match.intent === "EPIC" ? 0.62 : 0.48)
      : clamp(0.32 + styleEvaluation.load.physical / 220, 0.28, 0.82)
  );
  const styledWearRate = styleEvaluation === null
    ? null
    : clamp(
      0.005
        + styleEvaluation.load.physical / 100 * 0.006
        + match.style!.risk / 100 * 0.006,
      0.004,
      0.022,
    );
  const promotion = state.promotions.find((candidate) => candidate.id === event.promotionId)!;
  for (const person of allPeople) {
    const fatigue = loadBase * (1.15 - person.skills.stamina / 220);
    const wear = match.actualLengthMinutes
      * (styleEvaluation === null
        ? (match.intent === "HIGH_RISK" ? 0.018 : match.intent === "EPIC" ? 0.012 : 0.008)
        : styledWearRate!)
      * (1.15 - person.skills.safety / 260);
    applyMatchLoad(person, fatigue, wear);

    const won = (actualWinnerSide === "A" ? sideA : sideB).some((winner) => winner.id === person.id);
    const greatMatch = match.criticalRatingStars >= 4;
    const momentumDelta = won
      ? winnerMomentumDelta(actualFinish)
      : loserMomentumDelta(actualFinish, greatMatch);
    person.momentum = Math.round(clamp(person.momentum + momentumDelta, 0, 100) * 10) / 10;

    const exposureBase = 0.025 + promotion.mediaReach / 3000 + event.eventImportance / 5000 + (isMainEvent ? 0.015 : 0);
    const recognitionGain = exposureBase * Math.max(0.08, 1 - person.recognition / 108);
    person.recognition = Math.round(clamp(person.recognition + recognitionGain, 0, 100) * 100) / 100;

    const crowdGain = Math.max(0, match.crowdResponse - 55) / 800;
    const performanceGain = Math.max(0, match.criticalRatingStars - 2.5) * 0.035;
    const resultGain = won ? winnerPopularityGain(actualFinish) : 0;
    const poorPerformancePenalty = match.criticalRatingStars < 1.75 ? 0.02 : match.crowdResponse < 32 ? 0.01 : 0;
    const popularityHeadroom = Math.max(0.12, 1 - person.popularity / 108);
    const popularityDelta = (crowdGain + performanceGain + resultGain) * popularityHeadroom - poorPerformancePenalty;
    person.popularity = Math.round(clamp(person.popularity + popularityDelta, 0, 100) * 100) / 100;
  }

  new LedgerWriter(state.world.id, state.ledger).append({
    date: event.date,
    type: "MATCH_COMPLETED",
    significance: match.criticalRatingStars >= 4.75 || (event.type === "MAJOR" && isMainEvent) ? "NOTABLE" : "ROUTINE",
    entityIds: [match.id, event.id, ...allPeople.map((person) => person.id),
      ...(match.interference ? [match.interference.personId] : [])],
    payload: {
      matchType: match.type,
      intent: match.intent,
      plannedFinish: bookedFinish,
      actualFinish,
      rating: match.criticalRatingStars,
      crowd: match.crowdResponse,
      winnerSide: actualWinnerSide,
      ...(match.interference ? {
        interferencePersonId: match.interference.personId,
        interferenceAidedSide: match.interference.aidedSide,
        interferenceOutcome: match.interference.outcome,
      } : {}),
      finishChangedDueToInjury: match.finishChangedDueToInjury,
      ...(styleEvaluation === null ? {} : {
        styleResolver: "DIMENSIONAL",
        styleCompetitiveness: match.style!.competitiveness,
        styleTechnical: match.style!.technical,
        styleStory: match.style!.story,
        styleIntensity: match.style!.intensity,
        styleRisk: match.style!.risk,
        styleEpic: match.style!.epic,
        stylePhysicalLoad: styleEvaluation.load.physical,
        styleCreativeLoad: styleEvaluation.load.creative,
        styleTotalLoad: styleEvaluation.load.total,
        styleLoadBand: styleEvaluation.load.band,
        styleDemand: styleEvaluation.demand,
        styleCapability: styleEvaluation.capability,
        styleShortfall: styleEvaluation.shortfall,
        styleRealizedUpside: styleEvaluation.realizedUpside,
        styleDifficultyPenalty: styleEvaluation.difficultyPenalty,
        styleCrowdAppeal: styleEvaluation.crowdAppeal,
      }),
    },
  });
}

function preparedHumanEventCard(
  state: WorldState,
  event: WrestlingEvent,
  appearances: ScheduledAppearance[],
  staffMayBookCard: boolean,
): PlannedMatch[] | null {
  const promotion = state.promotions.find((candidate) => candidate.id === event.promotionId);
  if (!promotion || promotion.controllerType !== "HUMAN") return null;

  const scheduledMatches = state.matches
    .filter((match) => match.eventId === event.id && match.status === "SCHEDULED")
    .sort((a, b) => a.order - b.order || a.id.localeCompare(b.id));
  if (scheduledMatches.length === 0) return staffMayBookCard ? null : [];

  const appearanceIds = new Set(appearances.map((appearance) => appearance.personId));
  const peopleById = new Map(state.people.map((person) => [person.id, person]));
  return scheduledMatches.map((match) => {
    const participants = state.matchParticipants.filter(
      (participant) => participant.matchId === match.id && appearanceIds.has(participant.personId),
    );
    const sideA = participants
      .filter((participant) => participant.side === "A")
      .map((participant) => peopleById.get(participant.personId))
      .filter((person): person is Person => Boolean(person));
    const sideB = participants
      .filter((participant) => participant.side === "B")
      .map((participant) => peopleById.get(participant.personId))
      .filter((person): person is Person => Boolean(person));
    return { match, sideA, sideB, participants };
  });
}

export function resolveEventCard(
  state: WorldState,
  event: WrestlingEvent,
  appearances: ScheduledAppearance[],
  execution: { staffMayBookCard?: boolean } = {},
): { usedPersonIds: Set<string>; completedMatches: Match[] } {
  const preparedHumanCard = preparedHumanEventCard(state, event, appearances, execution.staffMayBookCard === true);
  const plannedMatches = preparedHumanCard ?? buildEventCard(state, event, appearances);
  for (let i = 0; i < plannedMatches.length; i += 1) {
    resolveMatch(state, plannedMatches[i]!, event, i === plannedMatches.length - 1);
  }
  const completedPlans = plannedMatches.filter((planned) => planned.match.status === "COMPLETED");
  const completedMatches = completedPlans.map((planned) => planned.match);
  const usedPersonIds = new Set(completedPlans.flatMap((planned) => [
    ...planned.participants.map((participant) => participant.personId),
    ...(planned.match.interference && planned.match.interference.outcome !== null
      ? [planned.match.interference.personId] : []),
  ]));
  event.matchCount = completedMatches.length;
  event.averageMatchRating = completedMatches.length === 0
    ? 0
    : Math.round((completedMatches.reduce((sum, match) => sum + match.criticalRatingStars, 0) / completedMatches.length) * 100) / 100;
  event.bestMatchRating = completedMatches.length === 0 ? 0 : Math.max(...completedMatches.map((match) => match.criticalRatingStars));
  event.crowdResponse = completedMatches.length === 0
    ? 0
    : Math.round((completedMatches.reduce((sum, match) => sum + match.crowdResponse, 0) / completedMatches.length) * 10) / 10;
  return { usedPersonIds, completedMatches };
}
