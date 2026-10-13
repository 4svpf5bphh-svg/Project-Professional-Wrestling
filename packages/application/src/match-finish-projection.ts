import type { Match } from "../../domain/src/types.js";
import { actualMatchFinish, isRecordedMatchFinish, type MatchFinish } from "../../sim-core/src/match-finishes.js";

/** Prefer frozen match-completion evidence, then a genuinely persisted actual finish.
 * Historic records with neither must remain unknown, never infer from intent. */
export function recordedMatchFinish(match: Match, completedLedgerFinish?: unknown): MatchFinish | null {
  if (isRecordedMatchFinish(completedLedgerFinish)) return completedLedgerFinish;
  const persisted = actualMatchFinish(match);
  return isRecordedMatchFinish(persisted) ? persisted : null;
}
