import type { MatchIntent, MatchStyleProfile } from "../../domain/src/types.js";

export type { MatchStyleProfile } from "../../domain/src/types.js";

export type MatchStyleDimension = keyof MatchStyleProfile;
export type MatchStyleLoadBand = "LIGHT" | "STANDARD" | "DEMANDING" | "EXTREME";

export interface MatchStyleLoad {
  physical: number;
  creative: number;
  total: number;
  band: MatchStyleLoadBand;
}

export interface MatchStyleSkillProfile {
  inRingQuality: number;
  matchCraft: number;
  presentation: number;
  stamina: number;
  safety: number;
}

export interface MatchStyleExecutionEvaluation {
  load: MatchStyleLoad;
  demand: number;
  capability: number;
  shortfall: number;
  realizedUpside: number;
  difficultyPenalty: number;
  crowdAppeal: number;
}

export const MATCH_STYLE_DIMENSIONS = [
  "competitiveness",
  "technical",
  "story",
  "intensity",
  "risk",
  "epic",
] as const satisfies readonly MatchStyleDimension[];

const LEGACY_INTENT_STYLE: Record<MatchIntent, MatchStyleProfile> = {
  COMPETITIVE: {
    competitiveness: 85,
    technical: 55,
    story: 35,
    intensity: 60,
    risk: 25,
    epic: 35,
  },
  SHOWCASE: {
    competitiveness: 30,
    technical: 45,
    story: 35,
    intensity: 55,
    risk: 25,
    epic: 60,
  },
  DOMINANT: {
    competitiveness: 15,
    technical: 30,
    story: 25,
    intensity: 65,
    risk: 20,
    epic: 35,
  },
  TECHNICAL: {
    competitiveness: 75,
    technical: 92,
    story: 35,
    intensity: 55,
    risk: 25,
    epic: 45,
  },
  HIGH_RISK: {
    competitiveness: 60,
    technical: 40,
    story: 35,
    intensity: 88,
    risk: 95,
    epic: 68,
  },
  STORY: {
    competitiveness: 60,
    technical: 40,
    story: 92,
    intensity: 48,
    risk: 22,
    epic: 58,
  },
  PROTECTIVE: {
    competitiveness: 48,
    technical: 42,
    story: 68,
    intensity: 32,
    risk: 12,
    epic: 35,
  },
  EPIC: {
    competitiveness: 85,
    technical: 58,
    story: 72,
    intensity: 86,
    risk: 38,
    epic: 96,
  },
};

function rounded1(value: number): number {
  return Math.round(value * 10) / 10;
}

function validatedDimension(value: number, dimension: MatchStyleDimension): number {
  if (!Number.isFinite(value) || !Number.isInteger(value) || value < 0 || value > 100) {
    throw new Error(`match style ${dimension} must be an integer from 0 to 100`);
  }
  return value;
}

export function normalizeMatchStyle(style: MatchStyleProfile): MatchStyleProfile {
  return {
    competitiveness: validatedDimension(style.competitiveness, "competitiveness"),
    technical: validatedDimension(style.technical, "technical"),
    story: validatedDimension(style.story, "story"),
    intensity: validatedDimension(style.intensity, "intensity"),
    risk: validatedDimension(style.risk, "risk"),
    epic: validatedDimension(style.epic, "epic"),
  };
}

export function defaultMatchStyleForIntent(intent: MatchIntent): MatchStyleProfile {
  return { ...LEGACY_INTENT_STYLE[intent] };
}

export function evaluateMatchStyleLoad(
  style: MatchStyleProfile,
  plannedLengthMinutes: number,
): MatchStyleLoad {
  const normalized = normalizeMatchStyle(style);
  if (!Number.isInteger(plannedLengthMinutes) || plannedLengthMinutes < 3 || plannedLengthMinutes > 60) {
    throw new Error("planned match length must be an integer from 3 to 60 minutes");
  }

  const lengthFactor = Math.max(0.82, Math.min(1.45, 0.82 + plannedLengthMinutes / 78));
  const physicalBase =
    normalized.intensity * 0.35
    + normalized.risk * 0.4
    + normalized.epic * 0.2
    + normalized.competitiveness * 0.05;
  const creative =
    normalized.technical * 0.3
    + normalized.story * 0.25
    + normalized.epic * 0.3
    + normalized.competitiveness * 0.15;
  const physical = physicalBase * lengthFactor;
  const total = physical * 0.65 + creative * 0.35;
  const band: MatchStyleLoadBand = total >= 95
    ? "EXTREME"
    : total >= 72
      ? "DEMANDING"
      : total >= 45
        ? "STANDARD"
        : "LIGHT";

  return {
    physical: rounded1(physical),
    creative: rounded1(creative),
    total: rounded1(total),
    band,
  };
}


function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function evaluateMatchStyleExecution(
  style: MatchStyleProfile,
  skills: MatchStyleSkillProfile,
  plannedLengthMinutes: number,
): MatchStyleExecutionEvaluation {
  const normalized = normalizeMatchStyle(style);
  const load = evaluateMatchStyleLoad(normalized, plannedLengthMinutes);
  const capabilities: Record<MatchStyleDimension, number> = {
    competitiveness:
      skills.inRingQuality * 0.4
      + skills.matchCraft * 0.35
      + skills.stamina * 0.15
      + skills.presentation * 0.1,
    technical:
      skills.inRingQuality * 0.4
      + skills.matchCraft * 0.38
      + skills.safety * 0.12
      + skills.stamina * 0.1,
    story:
      skills.matchCraft * 0.38
      + skills.presentation * 0.38
      + skills.inRingQuality * 0.14
      + skills.stamina * 0.1,
    intensity:
      skills.stamina * 0.38
      + skills.inRingQuality * 0.25
      + skills.safety * 0.22
      + skills.matchCraft * 0.15,
    risk:
      skills.safety * 0.4
      + skills.stamina * 0.25
      + skills.inRingQuality * 0.2
      + skills.matchCraft * 0.15,
    epic:
      skills.matchCraft * 0.3
      + skills.presentation * 0.25
      + skills.stamina * 0.25
      + skills.inRingQuality * 0.2,
  };
  const weights = MATCH_STYLE_DIMENSIONS.map((dimension) => Math.max(5, normalized[dimension]));
  const weightTotal = weights.reduce((sum, value) => sum + value, 0);
  const capability = MATCH_STYLE_DIMENSIONS.reduce(
    (sum, dimension, index) => sum + capabilities[dimension] * weights[index]!,
    0,
  ) / weightTotal;
  const shortfall = MATCH_STYLE_DIMENSIONS.reduce(
    (sum, dimension, index) => (
      sum + Math.max(0, normalized[dimension] - capabilities[dimension]) * weights[index]!
    ),
    0,
  ) / weightTotal;
  const demand = MATCH_STYLE_DIMENSIONS.reduce((sum, dimension) => sum + normalized[dimension], 0)
    / MATCH_STYLE_DIMENSIONS.length;
  const mastery = clamp((capability - 45) / 55, 0, 1);
  const realizedUpside = Math.max(0, demand - 35) * mastery * 0.16;
  const difficultyPenalty =
    shortfall * 0.34
    + Math.max(0, load.creative - capability) * 0.12
    + Math.max(0, load.total - 90) * 0.08;
  const crowdAppeal =
    normalized.epic * 0.3
    + normalized.intensity * 0.22
    + normalized.story * 0.2
    + normalized.competitiveness * 0.12
    + normalized.risk * 0.08
    + normalized.technical * 0.08;

  return {
    load,
    demand: rounded1(demand),
    capability: rounded1(capability),
    shortfall: rounded1(shortfall),
    realizedUpside: rounded1(realizedUpside),
    difficultyPenalty: rounded1(difficultyPenalty),
    crowdAppeal: rounded1(crowdAppeal),
  };
}
