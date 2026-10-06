import type { Id, PpwDate, WorldState } from "../../domain/src/types.js";
import { resolveWorldWeek, type WorldResolutionHooks } from "../../sim-core/src/resolution.js";

export type WorldRuntimePhase = "OPEN" | "LOCKING" | "RESOLVING";

export interface WorldRuntimeState {
  worldId: Id;
  phase: WorldRuntimePhase;
  revision: number;
  lockedPpwDate: PpwDate | null;
  lastResolvedPpwDate: PpwDate | null;
  lockedRealCycleKey?: string | null;
  lastResolvedRealCycleKey?: string | null;
}

function cloneDate(date: PpwDate): PpwDate {
  return { ...date };
}

function requireWorld(runtime: WorldRuntimeState, state: WorldState): void {
  if (runtime.worldId !== state.world.id) {
    throw new Error(`runtime ${runtime.worldId} does not belong to World ${state.world.id}`);
  }
}

function normalizedRealCycleKey(value: string | null): string | null {
  if (value === null) return null;
  const normalized = value.trim();
  if (!normalized) throw new Error("real cycle key must not be empty");
  if (normalized.length > 80) throw new Error("real cycle key is too long");
  return normalized;
}

export function createWorldRuntimeState(worldId: Id): WorldRuntimeState {
  return {
    worldId,
    phase: "OPEN",
    revision: 0,
    lockedPpwDate: null,
    lastResolvedPpwDate: null,
    lockedRealCycleKey: null,
    lastResolvedRealCycleKey: null,
  };
}

export function assertWorldOpenForPlayerMutation(runtime: WorldRuntimeState): void {
  if (runtime.phase !== "OPEN") {
    throw new Error(`World ${runtime.worldId} is ${runtime.phase.toLowerCase()} and cannot accept player mutations`);
  }
}

export function incrementWorldRevision(runtime: WorldRuntimeState): number {
  if (!Number.isSafeInteger(runtime.revision) || runtime.revision < 0) {
    throw new Error("World runtime revision is invalid");
  }
  runtime.revision += 1;
  return runtime.revision;
}

export function lockWorldForResolution(
  runtime: WorldRuntimeState,
  state: WorldState,
  realCycleKey: string | null = null,
): void {
  requireWorld(runtime, state);
  if (runtime.phase !== "OPEN") {
    throw new Error(`World ${runtime.worldId} cannot lock from phase ${runtime.phase}`);
  }
  runtime.phase = "LOCKING";
  runtime.lockedPpwDate = cloneDate(state.world.currentDate);
  runtime.lockedRealCycleKey = normalizedRealCycleKey(realCycleKey);
}

export function beginWorldResolution(
  runtime: WorldRuntimeState,
  state: WorldState,
): void {
  requireWorld(runtime, state);
  if (runtime.phase !== "LOCKING") {
    throw new Error(`World ${runtime.worldId} cannot begin resolution from phase ${runtime.phase}`);
  }
  if (!runtime.lockedPpwDate) throw new Error("World lock is missing its PPW date");
  const current = state.world.currentDate;
  const locked = runtime.lockedPpwDate;
  if (current.year !== locked.year || current.week !== locked.week || current.day !== locked.day) {
    throw new Error("World date changed after lock and before resolution");
  }
  runtime.phase = "RESOLVING";
}

export function resolveLockedWorldWeek(
  runtime: WorldRuntimeState,
  state: WorldState,
  hooks: WorldResolutionHooks = {},
): void {
  requireWorld(runtime, state);
  if (runtime.phase !== "RESOLVING") {
    throw new Error(`World ${runtime.worldId} can only resolve from RESOLVING phase`);
  }
  if (!runtime.lockedPpwDate) throw new Error("World resolution is missing its locked PPW date");

  const resolvedDate = cloneDate(runtime.lockedPpwDate);
  const resolvedRealCycleKey = runtime.lockedRealCycleKey ?? null;
  resolveWorldWeek(state, hooks);

  runtime.lastResolvedPpwDate = resolvedDate;
  if (resolvedRealCycleKey !== null) runtime.lastResolvedRealCycleKey = resolvedRealCycleKey;
  runtime.lockedPpwDate = null;
  runtime.lockedRealCycleKey = null;
  runtime.phase = "OPEN";
  incrementWorldRevision(runtime);
}
