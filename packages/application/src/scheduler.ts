import type { Id } from "../../domain/src/types.js";
import {
  createWorldEngagementState,
  evaluatePlayerInactivity,
} from "./engagement.js";
import { activePromotionControls } from "./ownership.js";
import { incrementWorldRevision } from "./runtime.js";
import {
  applyStewardshipTalentTrustPressure,
  openEligibleStewardshipExitRequests,
} from "./stewardship.js";
import { settleOverdueStewardshipExitRequests } from "./stewardship-auto-release.js";
import { runAiStewardshipBuyouts } from "./stewardship-ai-buyouts.js";
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
    || message.includes("cannot begin resolution from phase")
    || message.includes("scheduled lock changed before recovery");
}

async function claimExistingLockForCycle(
  repository: ApplicationWorldRepository,
  worldId: Id,
  expectedRevision: number,
  cycleKey: string,
): Promise<{ revision: number; stale: boolean }> {
  const committed = await repository.transact(worldId, expectedRevision, (aggregate) => {
    if (aggregate.runtime.phase !== "LOCKING") {
      throw new Error("scheduled lock changed before recovery");
    }
    const existing = aggregate.runtime.lockedRealCycleKey ?? null;
    if (existing !== null && existing > cycleKey) return true;
    aggregate.runtime.lockedRealCycleKey = cycleKey;
    return false;
  });
  return { revision: committed.revision, stale: committed.result };
}

async function evaluateScheduledPlayerInactivity(
  repository: ApplicationWorldRepository,
  worldId: Id,
  expectedRevision: number,
  cycleKey: string,
): Promise<number> {
  const committed = await repository.transact(worldId, expectedRevision, (aggregate) => {
    const controls = activePromotionControls(aggregate.ownership);
    if (controls.length === 0) return;

    const engagement = aggregate.engagement ?? createWorldEngagementState(worldId);
    aggregate.engagement = engagement;
    for (const control of controls) {
      evaluatePlayerInactivity(engagement, control.playerId, cycleKey);
    }

    const stewardship = applyStewardshipTalentTrustPressure(aggregate);
    openEligibleStewardshipExitRequests(aggregate, cycleKey);
    const aiBuyouts = runAiStewardshipBuyouts(aggregate, cycleKey);
    const automaticReleases = settleOverdueStewardshipExitRequests(aggregate, cycleKey);
    if (
      stewardship.promotionsAffected > 0
      || aiBuyouts.executedBuyouts > 0
      || automaticReleases.releasedContracts > 0
    ) {
      incrementWorldRevision(aggregate.runtime);
    }
  });
  return committed.revision;
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
        const claimed = await claimExistingLockForCycle(
          repository,
          worldId,
          before.runtime.revision,
          cycleKey,
        );
        if (claimed.stale) {
          return {
            worldId,
            cycleKey,
            status: "ALREADY_RESOLVED",
            revision: claimed.revision,
          };
        }
        const revision = await resolvePersistedWorldWeek(repository, worldId, claimed.revision);
        return { worldId, cycleKey, status: "RESOLVED", revision };
      }

      if (before.runtime.phase === "RESOLVING") {
        continue;
      }

      const activityRevision = await evaluateScheduledPlayerInactivity(
        repository,
        worldId,
        before.runtime.revision,
        cycleKey,
      );
      const materialized = await materializePersistedCurrentWeekReservations(
        repository,
        worldId,
        activityRevision,
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
