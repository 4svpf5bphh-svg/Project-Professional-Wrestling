import type { Match } from "../../domain/src/types.js";
import { actualMatchFinish, finishCheaterSide, isRecordedMatchFinish, type MatchFinish } from "../../sim-core/src/match-finishes.js";

/** Prefer frozen match-completion evidence, then a genuinely persisted actual finish.
 * Historic records with neither must remain unknown, never infer from intent. */
export function recordedMatchFinish(match: Match, completedLedgerFinish?: unknown): MatchFinish | null {
  if (isRecordedMatchFinish(completedLedgerFinish)) return completedLedgerFinish;
  const persisted = actualMatchFinish(match);
  return isRecordedMatchFinish(persisted) ? persisted : null;
}

// A named culprit is public only when the actual cheating finish happened.
// Check immutable ledger first and verify that the ID belongs to the correct
// completed match side. This prevents a stale planned culprit leaking after
// an injury stoppage or a contradictory historical record.
export function recordedFinishCheaterId(
  match: Match, finish: MatchFinish | null,
  participants: readonly { personId: string; side: "A" | "B" }[],
  completedLedgerCheater?: unknown,
): string | null {
  if (!finish || !match.actualWinnerSide) return null;
  const side = finishCheaterSide(finish, match.actualWinnerSide);
  if (!side) return null;
  const chosen = typeof completedLedgerCheater === "string"
    ? completedLedgerCheater : match.finishCheaterPersonId;
  return chosen && participants.some((person) => person.personId === chosen && person.side === side)
    ? chosen : null;
}
