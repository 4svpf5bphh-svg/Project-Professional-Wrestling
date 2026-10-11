import type { Id } from "../../domain/src/types.js";
import {
  createWorldEngagementState,
  evaluatePlayerInactivity,
  recordMissedSchedulerCycles,
} from "./engagement.js";
import { activePromotionControls } from "./ownership.js";
import {
  currentWeekShowCommitmentsLocked,
  incrementWorldRevision,
} from "./runtime.js";
import {
  applyStewardshipTalentTrustPressure,
  openEligibleStewardshipExitRequests,
} from "./stewardship.js";
import { settleOverdueStewardshipExitRequests } from "./stewardship-auto-release.js";
import { runAiStewardshipBuyouts } from "./stewardship-ai-buyouts.js";
import { runStewardshipCaretakerRecruitment } from "./stewardship-caretaker.js";
import type { ApplicationWorldRepository } from "./world-aggregate.js";
import { LedgerWriter } from "../../sim-core/src/ledger.js";
import {
  lockPersistedCurrentWeekShowCommitments,
  lockPersistedWorldForResolution,
  resolvePersistedWorldWeek,
} from "./world-transactions.js";

export type ScheduledResolutionStatus = "RESOLVED" | "ALREADY_RESOLVED";

export type ScheduledCommitmentStatus = "COMMITTED" | "ALREADY_COMMITTED" | "ALREADY_RESOLVED";

export interface ScheduledCommitmentResult {
  worldId: Id;
  cycleKey: string;
  status: ScheduledCommitmentStatus;
  revision: number;
}

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

/**
 * Apply outage credit at most once for each gap. The recovering tick is the
 * ONLY tick we resolve; skipped real days never simulate extra PPW weeks.
 */
function protectMissedCycles(
  aggregate: import("./world-aggregate.js").ApplicationWorldAggregate,
  cycleKey: string,
): number {
  const previous = aggregate.runtime.lastResolvedRealCycleKey ?? null;
  if (!previous) return 0;
  aggregate.engagement ??= createWorldEngagementState(aggregate.state.world.id);
  const skipped = recordMissedSchedulerCycles(aggregate.engagement, previous, cycleKey);
  if (skipped > 0) {
    const span = aggregate.engagement.schedulerPauseSpans!.at(-1)!;
    new LedgerWriter(aggregate.state.world.id, aggregate.state.ledger).append({
      date: aggregate.state.world.currentDate,
      type: "SCHEDULER_MISSED_CYCLES_PROTECTED",
      significance: "NOTABLE",
      entityIds: [],
      payload: {
        firstMissedCycleKey: span.firstMissedCycleKey,
        lastMissedCycleKey: span.lastMissedCycleKey,
        recoveredCycleKey: cycleKey,
        skippedRealDays: skipped,
        replayedPpwWeeks: 0,
        reason: "scheduler outage dates excluded from inactivity and stewardship deadlines",
      },
    });
  }
  return skipped;
}

function retryableSchedulerConflict(message: string): boolean {
  return message.includes("stale World revision")
    || message.includes("cannot lock from phase")
    || message.includes("cannot lock show commitments from phase")
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
    protectMissedCycles(aggregate, cycleKey);
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
    // Even a World with zero current controllers remembers actual scheduler
    // outages for any existing/open stewardship notice timers.
    protectMissedCycles(aggregate, cycleKey);
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
    const caretaker = runStewardshipCaretakerRecruitment(aggregate, cycleKey);
    if (
      stewardship.promotionsAffected > 0
      || aiBuyouts.executedBuyouts > 0
      || automaticReleases.releasedContracts > 0
      || caretaker.cyclesProcessed > 0
    ) {
      incrementWorldRevision(aggregate.runtime);
    }
  });
  return committed.revision;
}

export async function lockScheduledShowCommitments(
  repository: ApplicationWorldRepository,
  worldId: Id,
  rawCycleKey: string,
): Promise<ScheduledCommitmentResult> {
  const cycleKey = requireUtcCycleKey(rawCycleKey);

  for (let attempt = 0; attempt < 6; attempt += 1) {
    const before = await repository.load(worldId);
    const lastResolved = before.runtime.lastResolvedRealCycleKey ?? null;
    if (lastResolved !== null && lastResolved >= cycleKey) {
      return {
        worldId,
        cycleKey,
        status: "ALREADY_RESOLVED",
        revision: before.runtime.revision,
      };
    }

    if (before.runtime.phase !== "OPEN") {
      return {
        worldId,
        cycleKey,
        status: "ALREADY_COMMITTED",
        revision: before.runtime.revision,
      };
    }

    if (currentWeekShowCommitmentsLocked(before.runtime, before.state)) {
      return {
        worldId,
        cycleKey,
        status: "ALREADY_COMMITTED",
        revision: before.runtime.revision,
      };
    }

    try {
      const revision = await lockPersistedCurrentWeekShowCommitments(
        repository,
        worldId,
        before.runtime.revision,
        cycleKey,
      );
      return { worldId, cycleKey, status: "COMMITTED", revision };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (!retryableSchedulerConflict(message) || attempt === 5) throw error;
    }
  }

  throw new Error(`World ${worldId} scheduled commitment lock could not acquire a stable runtime state`);
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
      const lockedRevision = await lockPersistedWorldForResolution(
        repository,
        worldId,
        activityRevision,
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
