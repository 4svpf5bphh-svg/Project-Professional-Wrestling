const STANDARD_CADENCE_OPTIONS = [1, 2, 4, 13, 26, 52] as const;

export function calendarCadenceOptions(currentCadenceWeeks: number): number[] {
  return [...new Set([...STANDARD_CADENCE_OPTIONS, currentCadenceWeeks])]
    .filter((weeks) => Number.isSafeInteger(weeks) && weeks >= 1 && weeks <= 260)
    .sort((a, b) => a - b);
}

export function calendarCadenceLabel(value: number): string {
  if (value === 1) return "Every week";
  if (value === 52) return "Every PPW year";
  return `Every ${value} weeks`;
}
