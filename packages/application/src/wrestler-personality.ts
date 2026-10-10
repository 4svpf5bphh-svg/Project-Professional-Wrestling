/**
 * Read-only foundations for promo ability and fictional locker-room personality.
 *
 * These are not extra simulated power and do not alter show ratings, contracts,
 * trust, injuries or scripted outcomes. Older saved Worlds remain intact. The
 * deterministic fallback is an estimate, not a factual claim about real talent.
 *
 * Source and reason are explicit for a future curated talent/personality wave.
 */
import type { Person } from "../../domain/src/types.js";
import { deterministicSeedFromText } from "../../sim-core/src/rng.js";

export const BACKSTAGE_TEMPERAMENTS = [
  "COLLABORATIVE", "AMBITIOUS", "INDEPENDENT",
  "METHODICAL", "SHOWMAN", "STEADY",
] as const;
export type BackstageTemperament = (typeof BACKSTAGE_TEMPERAMENTS)[number];

export const PERSONALITY_MOTIVATIONS = [
  "CREATIVE_FREEDOM", "TOP_BILLING", "MONEY", "PRESTIGE", "ROUTINE", "LOYALTY", "EXPOSURE",
] as const;
export type PersonalityMotivation = (typeof PERSONALITY_MOTIVATIONS)[number];

export interface WrestlerPersonalityView {
  /** 0–100: an independent microphone performance estimate, not Presentation. */
  microphoneAbility: number;
  microphoneSource: "CURATED" | "ESTIMATED";
  temperament: BackstageTemperament;
  temperamentSource: "CURATED" | "DERIVED";
  /** Existing contractual priorities are summarised, never duplicated or modified. */
  motivations: PersonalityMotivation[];
}

function validRating(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 100;
}
function validTemperament(value: unknown): value is BackstageTemperament {
  return typeof value === "string" && BACKSTAGE_TEMPERAMENTS.some((entry) => entry === value);
}

/** Avoid random rerolls and avoid altering any historical simulation state. */
export function wrestlerPersonalityFor(person: Person): WrestlerPersonalityView {
  const micSeed = deterministicSeedFromText("ppw:microphone:v1:" + person.id);
  const estimatedMic = Math.max(0, Math.min(100, Math.round(
    12 + person.skills.presentation * 0.52
    + person.skills.matchCraft * 0.20
    + (micSeed % 47) - 23
  )));
  const microphoneSource = validRating(person.microphoneAbility) ? "CURATED" : "ESTIMATED";
  const microphoneAbility = microphoneSource === "CURATED"
    ? Math.round(person.microphoneAbility!)
    : estimatedMic;

  const motiveScores: Array<[PersonalityMotivation, number]> = [
    ["TOP_BILLING", person.priorities.role],
    ["MONEY", person.priorities.money],
    ["PRESTIGE", person.priorities.prestige],
    ["ROUTINE", person.priorities.schedule],
    ["LOYALTY", person.priorities.loyalty],
    ["EXPOSURE", person.priorities.exposure],
  ];
  const sorted = motiveScores.sort((a,b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  const motivations = sorted.slice(0,2).map(([m])=>m);

  const temperamentSeed = deterministicSeedFromText("ppw:temperament:v1:" + person.id);
  const temperamentScores: Array<[BackstageTemperament, number]> = [
    ["COLLABORATIVE", person.priorities.loyalty * 0.56 + person.priorities.schedule * 0.14],
    ["AMBITIOUS", person.priorities.role * 0.51 + person.priorities.prestige * 0.21],
    ["INDEPENDENT", person.priorities.money * 0.26 + person.priorities.role * 0.33],
    ["METHODICAL", person.skills.matchCraft * 0.34 + person.priorities.schedule * 0.31],
    ["SHOWMAN", person.priorities.exposure * 0.45 + person.skills.presentation * 0.30],
    ["STEADY", person.priorities.schedule * 0.32 + person.priorities.loyalty * 0.32],
  ];
  const best = temperamentScores.map(([name,score],i)=>({
    name,
    score:score + ((temperamentSeed >>> (i * 5)) & 31) * 0.65,
  })).sort((a,b)=>b.score-a.score || a.name.localeCompare(b.name))[0]!.name;
  const curated = validTemperament(person.backstageTemperament);
  return {
    microphoneAbility,
    microphoneSource,
    temperament: curated ? person.backstageTemperament! : best,
    temperamentSource: curated ? "CURATED" : "DERIVED",
    motivations,
  };
}
