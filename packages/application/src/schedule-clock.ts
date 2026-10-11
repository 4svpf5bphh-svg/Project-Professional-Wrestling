/**
 * PPW's real scheduler is daily, seven days a week. Each UTC cycle resolves
 * exactly one complete PPW week (whose show days remain 1–7).
 *
 * Keep these UTC wall-clock hours aligned with vercel.json. They are *not*
 * Europe/London wall-clock hours: the UK display shifts during BST.
 */
export const PPW_COMMITMENT_UTC_HOUR = 6 as const;
export const PPW_RESOLUTION_UTC_HOUR = 8 as const;

export function utcScheduledCycleKey(now: Date = new Date()): string {
  if (Number.isNaN(now.getTime())) throw new Error("scheduler requires a valid UTC date");
  return now.toISOString().slice(0, 10);
}
