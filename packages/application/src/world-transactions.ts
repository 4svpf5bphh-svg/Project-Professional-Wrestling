import type { Id } from "../../domain/src/types.js";
import { LedgerWriter } from "../../sim-core/src/ledger.js";
import { generateWorldOpportunities } from "./opportunity-generation.js";
import { evaluateBackstagePromises, generateBackstageConversations } from "./backstage.js";
import { generateTagTeamPitches } from "./backstage-pitches.js";
import { generateRivalryPitches } from "./backstage-rivalries.js";
import { generateTeamMoments } from "./backstage-moments.js";
import { generateGimmickChangePitches } from "./backstage-gimmicks.js";
import { applyBackstagePromiseConsequences } from "./backstage-consequences.js";
import { assessCreativeFollowThrough } from "./backstage-follow-through.js";
import { assessWorkingConcernFollowThrough } from "./backstage-working-follow-through.js";
import { generateWorkingPartnershipConcerns } from "./backstage-working-concerns.js";
import {
  closeCurrentWeekReservationsAtCommitmentLock,
  discardUnapprovedMaterializedCardAmendmentsAtLock,
  materializeCurrentWeekReservations,
  materializedLiveArrivalConflicts,
  unresolvedDueCreativeApprovals,
  type ReservationMaterializationPass,
} from "./planning-materialization.js";
import {
  applyResolvedShowTurns,
  recordResolvedShowSegments,
} from "./programme-segments.js";
import type { ApplicationWorldRepository } from "./world-aggregate.js";
import {
  assertWorldOpenForPlayerMutation,
  beginWorldResolution,
  currentWeekShowCommitmentsLocked,
  incrementWorldRevision,
  lockCurrentWeekShowCommitments,
  lockWorldForResolution,
  resolveLockedWorldWeek,
} from "./runtime.js";

function passMutatedWorld(pass: ReservationMaterializationPass): boolean {
  return pass.materialized.length > 0 || pass.expiredReservationIds.length > 0;
}

export async function materializePersistedCurrentWeekReservations(
  repository: ApplicationWorldRepository,
  worldId: Id,
  expectedRevision: number,
): Promise<{ pass: ReservationMaterializationPass; revision: number }> {
  const committed = await repository.transact(worldId, expectedRevision, (aggregate) => {
    assertWorldOpenForPlayerMutation(aggregate.runtime);
    const pass = materializeCurrentWeekReservations(aggregate.state, aggregate.planning);
    if (passMutatedWorld(pass)) incrementWorldRevision(aggregate.runtime);
    return pass;
  });
  return { pass: committed.result, revision: committed.revision };
}

export async function lockPersistedCurrentWeekShowCommitments(
  repository: ApplicationWorldRepository,
  worldId: Id,
  expectedRevision: number,
  realCycleKey: string | null = null,
): Promise<number> {
  const committed = await repository.transact(worldId, expectedRevision, (aggregate) => {
    assertWorldOpenForPlayerMutation(aggregate.runtime);
    if (currentWeekShowCommitmentsLocked(aggregate.runtime, aggregate.state)) {
      lockCurrentWeekShowCommitments(aggregate.runtime, aggregate.state, realCycleKey);
      return;
    }

    const restoredAmendments = discardUnapprovedMaterializedCardAmendmentsAtLock(
      aggregate.state, aggregate.planning,
    );
    const closure = closeCurrentWeekReservationsAtCommitmentLock(
      aggregate.state,
      aggregate.planning,
    );
    if (
      restoredAmendments > 0
      || passMutatedWorld(closure)
      || closure.releasedAtRisk.length > 0
    ) {
      incrementWorldRevision(aggregate.runtime);
    }
    lockCurrentWeekShowCommitments(aggregate.runtime, aggregate.state, realCycleKey);
  });
  return committed.revision;
}

export async function lockPersistedWorldForResolution(
  repository: ApplicationWorldRepository,
  worldId: Id,
  expectedRevision: number,
  realCycleKey: string | null = null,
  /** Manual Alpha advance only. Scheduled shared-World ticks do not pass this. */
  manualPromotionId: Id | null = null,
): Promise<number> {
  const committed = await repository.transact(worldId, expectedRevision, (aggregate) => {
    if (manualPromotionId && !currentWeekShowCommitmentsLocked(aggregate.runtime, aggregate.state)) {
      const unresolved = unresolvedDueCreativeApprovals(
        aggregate.state, aggregate.planning, manualPromotionId,
      );
      if (unresolved.length > 0) {
        const names = [...new Set(unresolved.flatMap((entry) => entry.wrestlerNames))].slice(0, 4).join(", ");
        throw new Error(`Creative approval required before advancing: ${names}. Open your Show Card to request approval or revise the finish. The shared World will still advance on its scheduled tick.`);
      }
    }
    // The commitment lock freezes venue/talent commitments, not the last
    // editable card. Reconcile again at final resolution for amendments
    // submitted during the lock-to-resolution window.
    const restoredAmendments = discardUnapprovedMaterializedCardAmendmentsAtLock(
      aggregate.state, aggregate.planning,
    );
    if (!currentWeekShowCommitmentsLocked(aggregate.runtime, aggregate.state)) {
      const closure = closeCurrentWeekReservationsAtCommitmentLock(
        aggregate.state,
        aggregate.planning,
      );
      if (passMutatedWorld(closure) || closure.releasedAtRisk.length > 0 || restoredAmendments > 0) {
        incrementWorldRevision(aggregate.runtime);
      }
      lockCurrentWeekShowCommitments(aggregate.runtime, aggregate.state, realCycleKey);
    } else if (restoredAmendments > 0) {
      incrementWorldRevision(aggregate.runtime);
    }
    const conflicts = materializedLiveArrivalConflicts(aggregate.state, aggregate.planning);
    const ownConflict = manualPromotionId
      ? conflicts.find((entry) => entry.promotionId === manualPromotionId)
      : null;
    if (ownConflict) {
      throw new Error(
        `Live ${ownConflict.kind.toLowerCase()} is no longer historically valid. Review the arrival segment on your Show Card and choose a truthful presentation before advancing.`,
      );
    }
    // Automatic shared-World progression may not be stopped by an offline
    // player's now-impossible scripted reveal. Explicitly log the unperformed
    // segment; do not silently convert it to another authored outcome.
    let cancelled = 0;
    const writer = new LedgerWriter(aggregate.state.world.id, aggregate.state.ledger);
    for (const conflict of conflicts) {
      const alreadyRecorded = aggregate.state.ledger.some((entry) => (
        entry.type === "PLANNED_LIVE_ARRIVAL_CANCELLED_AT_LOCK"
        && entry.payload.eventId === conflict.eventId
        && entry.payload.draftSegmentId === conflict.draftSegmentId
      ));
      if (alreadyRecorded) continue;
      writer.append({
        date: aggregate.state.world.currentDate,
        type: "PLANNED_LIVE_ARRIVAL_CANCELLED_AT_LOCK",
        significance: "NOTABLE",
        entityIds: [conflict.promotionId, conflict.eventId, conflict.personId],
        payload: {
          eventId: conflict.eventId,
          promotionId: conflict.promotionId,
          sourceDraftId: conflict.sourceDraftId,
          draftSegmentId: conflict.draftSegmentId,
          personId: conflict.personId,
          liveAppearanceKind: conflict.kind,
          reason: conflict.reason,
        },
      });
      cancelled += 1;
    }
    if (cancelled > 0) incrementWorldRevision(aggregate.runtime);
    lockWorldForResolution(aggregate.runtime, aggregate.state, realCycleKey);
  });
  return committed.revision;
}

export async function resolvePersistedWorldWeek(
  repository: ApplicationWorldRepository,
  worldId: Id,
  expectedRevision: number,
): Promise<number> {
  const committed = await repository.transact(worldId, expectedRevision, (aggregate) => {
    beginWorldResolution(aggregate.runtime, aggregate.state);
    resolveLockedWorldWeek(aggregate.runtime, aggregate.state, {
      afterProgrammeMatches: (state) => {
        recordResolvedShowSegments(state, aggregate.planning);
      },
      afterShowFlow: (state) => {
        applyResolvedShowTurns(state);
      },
    });
    evaluateBackstagePromises(aggregate);
    applyBackstagePromiseConsequences(aggregate);
    assessCreativeFollowThrough(aggregate);
    assessWorkingConcernFollowThrough(aggregate);
    generateWorkingPartnershipConcerns(aggregate);
    generateBackstageConversations(aggregate);
    generateTagTeamPitches(aggregate);
    generateRivalryPitches(aggregate);
    generateGimmickChangePitches(aggregate);
    generateTeamMoments(aggregate);
    generateWorldOpportunities(aggregate);
  });
  return committed.revision;
}
