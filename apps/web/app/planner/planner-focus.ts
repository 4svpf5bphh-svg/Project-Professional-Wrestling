export function plannerFocusedWeekKey(
  yearParam: string | null,
  weekParam: string | null,
): string | null {
  if (yearParam === null || weekParam === null) return null;
  const year = Number(yearParam);
  const week = Number(weekParam);
  if (!Number.isSafeInteger(year) || year < 1) return null;
  if (!Number.isSafeInteger(week) || week < 1) return null;
  return `${year}:${week}`;
}
