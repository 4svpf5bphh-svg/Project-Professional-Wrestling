import type { MatchIntent } from "../../domain/src/types.js";

export interface MatchStyleProfile {
  competitiveness: number;
  technical: number;
  story: number;
  intensity: number;
  risk: number;
  epic: number;
}

export type MatchStyleDimension = keyof MatchStyleProfile;
export type MatchStyleLoadBand = "LIGHT" | "STANDARD" | "DEMANDING" | "EXTREME";

export interface MatchStyleLoad {
  physical: number;
  creative: number;
  total: number;
  band: MatchStyleLoadBand;
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
