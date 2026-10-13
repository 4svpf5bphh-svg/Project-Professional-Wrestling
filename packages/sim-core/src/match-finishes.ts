import type { Match, MatchIntent } from "../../domain/src/types.js";

export type MatchFinish =
  | "CLEAN_PIN"
  | "SUBMISSION"
  | "FLASH_PIN"
  | "PROTECTED_FINISH"
  | "DISQUALIFICATION"
  | "FOREIGN_OBJECT"
  | "INJURY_STOPPAGE";

export const BOOKABLE_MATCH_FINISHES = [
  "CLEAN_PIN",
  "SUBMISSION",
  "FLASH_PIN",
  "PROTECTED_FINISH",
  "DISQUALIFICATION",
  "FOREIGN_OBJECT",
] as const satisfies readonly MatchFinish[];

const BOOKABLE_MATCH_FINISH_SET = new Set<MatchFinish>(BOOKABLE_MATCH_FINISHES);

type FinishAwareMatch = Match & {
  plannedFinish?: MatchFinish;
  actualFinish?: MatchFinish | null;
};

export function isRecordedMatchFinish(value: unknown): value is MatchFinish {
  return value === "INJURY_STOPPAGE" || isBookableMatchFinish(value);
}

export function isBookableMatchFinish(value: unknown): value is MatchFinish {
  return typeof value === "string" && BOOKABLE_MATCH_FINISH_SET.has(value as MatchFinish);
}

/** DQ: losing side cheats; foreign-object win: winning side cheats. */
export function finishCheaterSide(finish: MatchFinish, winner: "A" | "B"): "A" | "B" | null {
  if (finish === "FOREIGN_OBJECT") return winner;
  if (finish === "DISQUALIFICATION") return winner === "A" ? "B" : "A";
  return null;
}

/** Never guess a tag culprit; auto-select the sole singles wrestler. */
export function resolveBookedFinishCheater(
  finish: MatchFinish, winner: "A" | "B",
  sideA: readonly string[], sideB: readonly string[], selected?: string | null,
): string | null {
  const side = finishCheaterSide(finish, winner);
  if (!side) return null;
  const eligible = side === "A" ? sideA : sideB;
  if (selected && !eligible.includes(selected)) throw new Error("cheating wrestler is on the wrong match side");
  if (eligible.length === 1) return eligible[0] ?? null;
  if (!selected) throw new Error("choose which wrestler cheats in this tag-team finish");
  return selected;
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
