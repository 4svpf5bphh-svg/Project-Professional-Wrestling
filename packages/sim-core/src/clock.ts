import type { PpwDate, World } from "../../domain/src/types.js";

export function advanceWeek(world: World, weeksPerYear: number): void {
  world.currentDate.week += 1;
  world.currentDate.day = 1;
  if (world.currentDate.week > weeksPerYear) {
    world.currentDate.year += 1;
    world.currentDate.week = 1;
  }
}

export function advanceWeeks(world: World, weeksPerYear: number, count: number): void {
  if (!Number.isInteger(count) || count < 0) throw new Error("weeks must be a non-negative integer");
  for (let i = 0; i < count; i += 1) advanceWeek(world, weeksPerYear);
}

export function formatPpwDate(date: PpwDate): string {
  return `Y${date.year} W${String(date.week).padStart(2, "0")} D${date.day}`;
}
