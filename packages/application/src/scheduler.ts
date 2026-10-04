import type { Id } from "../../domain/src/types.js";
import type { ApplicationWorldRepository } from "./world-aggregate.js";
import {
  lockPersistedWorldForResolution,
  materializePersistedCurrentWeekReservations,
  resolvePersistedWorldWeek,
} from "./world-transactions.js";

export type ScheduledResolutionStatus = "RESOLVED" | "ALREADY_RESOLVED";

export interface ScheduledResolutionResult {
  worldId: Id;
  cycleKey: string;
  status: ScheduledResolutionStatus;
  revision: number;
}

function requireUtcCycleKey(value: string): string {
  const normalized = value.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
    throw new Error("scheduled resolution cycle key must use YYYY-MM-DD UTC format");
  }
  const parsed = new Date(`${normalized}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== normalized) {
    throw new Error("scheduled resolution cycle key is not a valid UTC date");
  }
  return normalized;
}

function retryableSchedulerConflict(message: string): boolean {
  return message.includes("stale World revision")
    || message.includes("cannot lock from phase")
    || message.includes("cannot accept player mutations")
    || message.includes("cannot begin resolution from phase");
}

export async function resolveScheduledWorldCycle(
  repository: ApplicationWorldRepository,
  worldId: Id,
  rawCycleKey: string,
): Promise<ScheduledResolutionResult> {
  const cycleKey = requireUtcCycleKey(rawCycleKey);

  for (let attempt = 0; attempt < 6; attempt += 1) {
    const before = await repository.load(worldId);
    const lastCycle = before.runtime.lastResolvedRealCycleKey ?? null;

    if (lastCycle !== null && lastCycle >= cycleKey) {
      return {
        worldId,
        cycleKey,
        status: "ALREADY_RESOLVED",
        revision: before.runtime.revision,
      };
    }

    try {
      if (before.runtime.phase === "LOCKING") {
        const lockedCycle = before.runtime.lockedRealCycleKey ?? null;
        await resolvePersistedWorldWeek(repository, worldId, before.runtime.revision);
        if (lockedCycle === cycleKey) {
          const after = await repository.load(worldId);
          return {
            worldId,
            cycleKey,
            status: "RESOLVED",
            revision: after.runtime.revision,
          };
        }
        continue;
      }

      if (before.runtime.phase === "RESOLVING") {
        continue;
      }

      const materialized = await materializePersistedCurrentWeekReservations(
        repository,
        worldId,
        before.runtime.revision,
      );
      const lockedRevision = await lockPersistedWorldForResolution(
        repository,
        worldId,
        materialized.revision,
        cycleKey,
      );
      const revision = await resolvePersistedWorldWeek(repository, worldId, lockedRevision);
      return { worldId, cycleKey, status: "RESOLVED", revision };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (!retryableSchedulerConflict(message) || attempt === 5) throw error;
    }
  }

  throw new Error(`World ${worldId} scheduled resolution could not acquire a stable runtime state`);
}
