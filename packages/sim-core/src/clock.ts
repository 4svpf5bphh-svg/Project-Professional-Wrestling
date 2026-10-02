import type { PpwDate, World } from "../../domain/src/types.js";

export function ppwDateToWeekIndex(date: PpwDate, weeksPerYear: number): number {
  return (date.year - 1) * weeksPerYear + (date.week - 1);
}

export function comparePpwDates(a: PpwDate, b: PpwDate, weeksPerYear: number): number {
  return ppwDateToWeekIndex(a, weeksPerYear) - ppwDateToWeekIndex(b, weeksPerYear) || a.day - b.day;
}

export function addPpwWeeks(date: PpwDate, weeks: number, weeksPerYear: number): PpwDate {
  if (!Number.isInteger(weeks)) throw new Error("weeks must be an integer");
  const index = ppwDateToWeekIndex(date, weeksPerYear) + weeks;
  if (index < 0) throw new Error("PPW date cannot precede Year 1 Week 1");
  return {
    year: Math.floor(index / weeksPerYear) + 1,
    week: (index % weeksPerYear) + 1,
    day: date.day,
  };
}

export function weeksBetween(from: PpwDate, to: PpwDate, weeksPerYear: number): number {
  return ppwDateToWeekIndex(to, weeksPerYear) - ppwDateToWeekIndex(from, weeksPerYear);
}

export function advanceWeek(world: World, weeksPerYear: number): void {
  world.currentDate = addPpwWeeks(world.currentDate, 1, weeksPerYear);
  world.currentDate.day = 1;
}

export function advanceWeeks(world: World, weeksPerYear: number, count: number): void {
  if (!Number.isInteger(count) || count < 0) throw new Error("weeks must be a non-negative integer");
  for (let i = 0; i < count; i += 1) advanceWeek(world, weeksPerYear);
}

export function formatPpwDate(date: PpwDate): string {
  return `Y${date.year} W${String(date.week).padStart(2, "0")} D${date.day}`;
}
