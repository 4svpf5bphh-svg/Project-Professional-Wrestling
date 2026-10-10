import type { Id } from "../../domain/src/types.js";
import { generateWorldOpportunities } from "./opportunity-generation.js";
import { evaluateBackstagePromises, generateBackstageConversations } from "./backstage.js";
import { generateTagTeamPitches } from "./backstage-pitches.js";
import { generateRivalryPitches } from "./backstage-rivalries.js";
import { generateTeamMoments } from "./backstage-moments.js";
import { generateGimmickChangePitches } from "./backstage-gimmicks.js";
import { applyBackstagePromiseConsequences } from "./backstage-consequences.js";
import {
  closeCurrentWeekReservationsAtCommitmentLock,
  materializeCurrentWeekReservations,
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

    const closure = closeCurrentWeekReservationsAtCommitmentLock(
      aggregate.state,
      aggregate.planning,
    );
    if (
      passMutatedWorld(closure)
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
): Promise<number> {
  const committed = await repository.transact(worldId, expectedRevision, (aggregate) => {
    if (!currentWeekShowCommitmentsLocked(aggregate.runtime, aggregate.state)) {
      const closure = closeCurrentWeekReservationsAtCommitmentLock(
        aggregate.state,
        aggregate.planning,
      );
      if (
        passMutatedWorld(closure)
        || closure.releasedAtRisk.length > 0
      ) {
        incrementWorldRevision(aggregate.runtime);
      }
      lockCurrentWeekShowCommitments(aggregate.runtime, aggregate.state, realCycleKey);
    }
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
    generateBackstageConversations(aggregate);
    generateTagTeamPitches(aggregate);
    generateRivalryPitches(aggregate);
    generateGimmickChangePitches(aggregate);
    generateTeamMoments(aggregate);
    generateWorldOpportunities(aggregate);
  });
  return committed.revision;
}
