import type { Match, MatchIntent } from "../../domain/src/types.js";

export type MatchFinish =
  | "CLEAN_PIN"
  | "SUBMISSION"
  | "FLASH_PIN"
  | "PROTECTED_FINISH"
  | "INJURY_STOPPAGE";

export const BOOKABLE_MATCH_FINISHES = [
  "CLEAN_PIN",
  "SUBMISSION",
  "FLASH_PIN",
  "PROTECTED_FINISH",
] as const satisfies readonly MatchFinish[];

const BOOKABLE_MATCH_FINISH_SET = new Set<MatchFinish>(BOOKABLE_MATCH_FINISHES);

type FinishAwareMatch = Match & {
  plannedFinish?: MatchFinish;
  actualFinish?: MatchFinish | null;
};

export function isBookableMatchFinish(value: unknown): value is MatchFinish {
  return typeof value === "string" && BOOKABLE_MATCH_FINISH_SET.has(value as MatchFinish);
}

export function defaultPlannedFinishForIntent(intent: MatchIntent): MatchFinish {
  if (intent === "TECHNICAL") return "SUBMISSION";
  if (intent === "STORY" || intent === "PROTECTIVE") return "PROTECTED_FINISH";
  return "CLEAN_PIN";
}

export function setPlannedMatchFinish(match: Match, finish: MatchFinish): void {
  if (!isBookableMatchFinish(finish)) throw new Error("planned match finish must be bookable");
  const target = match as FinishAwareMatch;
  target.plannedFinish = finish;
  if (target.actualFinish === undefined) target.actualFinish = null;
}

export function plannedMatchFinish(match: Match): MatchFinish {
  const finish = (match as FinishAwareMatch).plannedFinish;
  return finish && isBookableMatchFinish(finish)
    ? finish
    : defaultPlannedFinishForIntent(match.intent);
}

export function setActualMatchFinish(match: Match, finish: MatchFinish): void {
  (match as FinishAwareMatch).actualFinish = finish;
}

export function actualMatchFinish(match: Match): MatchFinish | null {
  return (match as FinishAwareMatch).actualFinish ?? null;
}
