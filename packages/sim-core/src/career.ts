import type { CareerStage, InjurySeverity, Match, Person, WorldState } from "../../domain/src/types.js";
import { ppwDateToWeekIndex } from "./clock.js";
import { allocateEntityId, nextEntityId } from "./id-allocator.js";
import { LedgerWriter } from "./ledger.js";
import { personById } from "./indexes.js";
import { DeterministicRng, deterministicSeedFromText } from "./rng.js";

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

const GENERATED_FIRST_NAMES = ["Mason", "Kai", "Noah", "Jett", "Mila", "Sasha", "Remy", "Nico", "Aria", "Zane", "Ivy", "Rex"] as const;
const GENERATED_LAST_NAMES = ["Hale", "Vega", "Monroe", "Rook", "Ash", "Voss", "Lane", "Morrow", "Blaze", "Rhodes", "Nova", "West"] as const;

export function applyMatchLoad(person: Person, fatigue: number, wear: number): void {
  person.fatigue = Math.round(clamp(person.fatigue + fatigue, 0, 100) * 10) / 10;
  person.wear = Math.round(clamp(person.wear + wear, 0, 100) * 10) / 10;
}

export function createInjury(
  state: WorldState,
  person: Person,
  match: Match,
  severity: InjurySeverity,
  weeksOut: number,
): void {
  const existing = state.injuries.find((injury) => injury.personId === person.id && injury.status === "ACTIVE");
  if (existing) return;
  const eventDate = state.events.find((event) => event.id === match.eventId)?.date ?? state.world.currentDate;
  const injury = {
    id: nextEntityId(state, "injury"),
    worldId: state.world.id,
    personId: person.id,
    matchId: match.id,
    eventId: match.eventId,
    date: { ...eventDate },
    severity,
    weeksOut,
    weeksRemaining: weeksOut,
    status: "ACTIVE" as const,
  };
  state.injuries.push(injury);
  person.status = "INJURED";
  person.fatigue = Math.max(person.fatigue, severity === "SEVERE" ? 80 : severity === "MAJOR" ? 65 : severity === "MODERATE" ? 50 : 35);
  person.wear = Math.round(clamp(person.wear + (severity === "SEVERE" ? 5 : severity === "MAJOR" ? 3 : severity === "MODERATE" ? 1.5 : 0.5), 0, 100) * 10) / 10;

  new LedgerWriter(state.world.id, state.ledger).append({
    date: eventDate,
    type: "WRESTLER_INJURED",
    significance: severity === "SEVERE" ? "MAJOR" : severity === "MAJOR" ? "NOTABLE" : "ROUTINE",
    entityIds: [person.id, match.id, injury.id],
    payload: { severity, weeksOut, eventId: match.eventId },
  });
}

export function recoverWrestlersForNewWeek(state: WorldState): void {
  for (const person of state.people) {
    if (person.status === "RETIRED") continue;
    const recovery = state.ruleset.fatigueRecoveryBase + person.skills.stamina / 12;
    person.fatigue = Math.round(Math.max(0, person.fatigue - recovery) * 10) / 10;
  }

  for (const injury of state.injuries) {
    if (injury.status !== "ACTIVE") continue;
    injury.weeksRemaining = Math.max(0, injury.weeksRemaining - 1);
    if (injury.weeksRemaining > 0) continue;
    injury.status = "RECOVERED";
    const person = personById(state, injury.personId);
    if (!person || person.status === "RETIRED") continue;
    person.status = "ACTIVE";
    new LedgerWriter(state.world.id, state.ledger).append({
      date: state.world.currentDate,
      type: "WRESTLER_CLEARED_TO_RETURN",
      significance: injury.severity === "SEVERE" || injury.severity === "MAJOR" ? "NOTABLE" : "ROUTINE",
      entityIds: [person.id, injury.id],
      payload: { severity: injury.severity, weeksOut: injury.weeksOut },
    });
  }
}

function currentWeekMatchData(state: WorldState): Map<string, { matches: number; ratingTotal: number }> {
  const currentWeekIndex = ppwDateToWeekIndex(state.world.currentDate, state.ruleset.weeksPerYear);
  const currentEventIds = new Set<string>();
  for (let i = state.events.length - 1; i >= 0; i -= 1) {
    const event = state.events[i]!;
    const eventWeek = ppwDateToWeekIndex(event.date, state.ruleset.weeksPerYear);
    if (eventWeek < currentWeekIndex) break;
    if (event.status === "COMPLETED" && eventWeek === currentWeekIndex) currentEventIds.add(event.id);
  }
  const currentMatches = new Map<string, Match>();
  for (let i = state.matches.length - 1; i >= 0; i -= 1) {
    const match = state.matches[i]!;
    if (!currentEventIds.has(match.eventId)) {
      if (currentMatches.size > 0) break;
      continue;
    }
    if (match.status === "COMPLETED") currentMatches.set(match.id, match);
  }
  const data = new Map<string, { matches: number; ratingTotal: number }>();
  for (let i = state.matchParticipants.length - 1; i >= 0; i -= 1) {
    const participant = state.matchParticipants[i]!;
    const match = currentMatches.get(participant.matchId);
    if (!match) {
      if (data.size > 0) break;
      continue;
    }
    const entry = data.get(participant.personId) ?? { matches: 0, ratingTotal: 0 };
    entry.matches += 1;
    entry.ratingTotal += match.criticalRatingStars;
    data.set(participant.personId, entry);
  }
  return data;
}

function developmentStageFactor(stage: CareerStage): number {
  switch (stage) {
    case "PROSPECT": return 1.35;
    case "PRIME": return 0.75;
    case "VETERAN": return 0.28;
    case "SPECIAL_ATTRACTION": return 0.12;
  }
}

function developSkill(value: number, growth: number): number {
  const ceilingFactor = Math.max(0.05, (100 - value) / 100);
  return Math.round(clamp(value + growth * ceilingFactor, 1, 99) * 100) / 100;
}

function applyDevelopment(person: Person, matches: number, averageRating: number, state: WorldState): void {
  if (matches <= 0 || person.status === "RETIRED") return;
  const base = state.ruleset.developmentRate
    * developmentStageFactor(person.careerStage)
    * (0.035 + averageRating * 0.012)
    * (0.55 + person.developmentAptitude / 100)
    * Math.min(1.4, 0.8 + matches * 0.25);
  person.careerExperience = Math.round(clamp(person.careerExperience + 0.08 * matches + averageRating * 0.012, 0, 100) * 100) / 100;
  person.skills.matchCraft = developSkill(person.skills.matchCraft, base * 1.15);
  person.skills.inRingQuality = developSkill(person.skills.inRingQuality, base);
  person.skills.safety = developSkill(person.skills.safety, base * 0.42);
  person.skills.presentation = developSkill(person.skills.presentation, base * 0.52);
  if (person.careerStage === "PROSPECT" || person.careerStage === "PRIME") person.skills.stamina = developSkill(person.skills.stamina, base * 0.35);
}

function nextCareerStage(person: Person): CareerStage {
  if (person.careerStage === "PROSPECT" && (person.biologicalAge >= 25 || person.careerExperience >= 45)) return "PRIME";
  if (person.careerStage === "PRIME" && (person.biologicalAge >= 35 || (person.wear >= 68 && person.careerExperience >= 70))) return "VETERAN";
  if (person.careerStage === "VETERAN" && person.biologicalAge >= 42 && Math.max(person.recognition, person.popularity) >= 62) return "SPECIAL_ATTRACTION";
  return person.careerStage;
}

function applyAgeAndWearDecline(person: Person, state: WorldState): void {
  if (person.status === "RETIRED") return;
  const biologicalWeek = state.ruleset.careerTimeFactor / state.ruleset.weeksPerYear;
  person.biologicalAge = Math.round((person.biologicalAge + biologicalWeek) * 1_000_000) / 1_000_000;
  const agePressure = Math.max(0, person.biologicalAge - 36) / 12;
  const wearPressure = Math.max(0, person.wear - 58) / 42;
  const decline = biologicalWeek * (agePressure + wearPressure * 0.75);
  if (decline <= 0) return;
  person.skills.stamina = Math.round(clamp(person.skills.stamina - decline * 2.4, 10, 99) * 100) / 100;
  person.skills.inRingQuality = Math.round(clamp(person.skills.inRingQuality - decline * 0.7, 10, 99) * 100) / 100;
  person.skills.matchCraft = developSkill(person.skills.matchCraft, decline * 0.25);
}

function retirementProbability(person: Person, state: WorldState): number {
  if (person.biologicalAge < state.ruleset.retirementBaseAge && person.wear < 88) return 0;
  const age = Math.max(0, person.biologicalAge - state.ruleset.retirementBaseAge);
  const wear = Math.max(0, person.wear - 65);
  const demandProtection = Math.max(person.recognition, person.popularity) / 100;
  const annualBiologicalProbability = clamp(0.05 + age * 0.065 + wear * 0.012 - demandProtection * 0.08, 0.01, 0.82);
  return annualBiologicalProbability * state.ruleset.careerTimeFactor / state.ruleset.weeksPerYear;
}

export function retireWrestler(state: WorldState, person: Person, reason = "career decision"): void {
  if (person.status === "RETIRED") return;
  person.status = "RETIRED";
  person.fatigue = 0;
  for (const contract of state.contracts) {
    if (contract.personId === person.id && contract.status === "SIGNED") contract.status = "TERMINATED";
  }
  for (const offer of state.contractOffers) {
    if (offer.personId === person.id && offer.status === "PENDING") {
      offer.status = "WITHDRAWN";
      offer.rejectionReason = "wrestler retired";
    }
  }
  for (const injury of state.injuries) {
    if (injury.personId === person.id && injury.status === "ACTIVE") {
      injury.status = "RECOVERED";
      injury.weeksRemaining = 0;
    }
  }
  new LedgerWriter(state.world.id, state.ledger).append({
    date: state.world.currentDate,
    type: "WRESTLER_RETIRED",
    significance: Math.max(person.recognition, person.popularity) >= 75 ? "MAJOR" : "NOTABLE",
    entityIds: [person.id],
    payload: { age: Math.round(person.biologicalAge * 10) / 10, wear: person.wear, reason },
  });
}

function maybeRetireWrestlers(state: WorldState): void {
  const weekIndex = ppwDateToWeekIndex(state.world.currentDate, state.ruleset.weeksPerYear);
  for (const person of state.people) {
    if (person.status === "RETIRED") continue;
    const probability = retirementProbability(person, state);
    if (probability <= 0) continue;
    const rng = new DeterministicRng(deterministicSeedFromText(`${state.world.seed}:${weekIndex}:${person.id}:retirement`));
    if (rng.chance(probability)) retireWrestler(state, person, person.wear >= 88 ? "physical wear" : "career timing");
  }
}

function generatedProspect(state: WorldState, index: number, id: string): Person {
  const weekIndex = ppwDateToWeekIndex(state.world.currentDate, state.ruleset.weeksPerYear);
  const rng = new DeterministicRng(deterministicSeedFromText(`${state.world.seed}:${weekIndex}:${index}:prospect-generation`));
  const stat = (min: number, max: number) => rng.int(min, max);
  return {
    id,
    worldId: state.world.id,
    name: `${rng.pick(GENERATED_FIRST_NAMES)} ${rng.pick(GENERATED_LAST_NAMES)} ${index}`,
    careerStage: "PROSPECT",
    status: "ACTIVE",
    homeMarketId: rng.pick(state.markets).id,
    biologicalAge: Math.round(rng.float(18, 23) * 10) / 10,
    careerExperience: rng.int(0, 8),
    developmentAptitude: rng.int(48, 96),
    debutDate: { ...state.world.currentDate },
    generatedTalent: true,
    fatigue: 0,
    wear: rng.int(0, 4),
    morale: rng.int(58, 82),
    momentum: rng.int(12, 35),
    recognition: rng.int(2, 16),
    popularity: rng.int(2, 18),
    skills: {
      inRingQuality: stat(24, 65),
      matchCraft: stat(22, 58),
      safety: stat(32, 72),
      stamina: stat(45, 82),
      presentation: stat(20, 68),
    },
    priorities: {
      money: stat(20, 90),
      role: stat(20, 90),
      prestige: stat(20, 90),
      schedule: stat(20, 90),
      loyalty: stat(20, 90),
      exposure: stat(35, 96),
    },
  };
}

export function replenishTalentPopulation(state: WorldState): number {
  const activeCount = state.people.filter((person) => person.status !== "RETIRED").length;
  const floor = Math.ceil(state.ruleset.wrestlers * state.ruleset.talentGenerationFloorRatio);
  if (activeCount >= floor) return 0;
  const toTarget = Math.max(0, state.ruleset.wrestlers - activeCount);
  const count = Math.min(state.ruleset.maxProspectsGeneratedPerWeek, toTarget);
  const writer = new LedgerWriter(state.world.id, state.ledger);
  for (let i = 0; i < count; i += 1) {
    const allocation = allocateEntityId(state, "person");
    const person = generatedProspect(state, allocation.sequence, allocation.id);
    state.people.push(person);
    writer.append({
      date: state.world.currentDate,
      type: "WRESTLER_DEBUTED",
      significance: "ROUTINE",
      entityIds: [person.id, person.homeMarketId],
      payload: { age: person.biologicalAge, generatedTalent: true },
    });
  }
  return count;
}

export function processCareerProgressionForWeek(state: WorldState): void {
  const matchData = currentWeekMatchData(state);
  const writer = new LedgerWriter(state.world.id, state.ledger);
  for (const person of state.people) {
    const data = matchData.get(person.id);
    if (data) applyDevelopment(person, data.matches, data.ratingTotal / data.matches, state);
    applyAgeAndWearDecline(person, state);
    const stage = nextCareerStage(person);
    if (stage !== person.careerStage) {
      const previous = person.careerStage;
      person.careerStage = stage;
      writer.append({
        date: state.world.currentDate,
        type: "CAREER_STAGE_CHANGED",
        significance: stage === "SPECIAL_ATTRACTION" ? "NOTABLE" : "ROUTINE",
        entityIds: [person.id],
        payload: { from: previous, to: stage, age: Math.round(person.biologicalAge * 10) / 10 },
      });
    }
  }
  maybeRetireWrestlers(state);
  replenishTalentPopulation(state);
}
