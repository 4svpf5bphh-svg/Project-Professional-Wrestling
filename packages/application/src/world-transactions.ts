import type { Id } from "../../domain/src/types.js";
import {
  closeCurrentWeekReservationsAtLock,
  materializeCurrentWeekReservations,
  type ReservationMaterializationPass,
} from "./planning-materialization.js";
import type { ApplicationWorldRepository } from "./world-aggregate.js";
import {
  assertWorldOpenForPlayerMutation,
  beginWorldResolution,
  incrementWorldRevision,
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

export async function lockPersistedWorldForResolution(
  repository: ApplicationWorldRepository,
  worldId: Id,
  expectedRevision: number,
): Promise<number> {
  const committed = await repository.transact(worldId, expectedRevision, (aggregate) => {
    const closure = closeCurrentWeekReservationsAtLock(aggregate.state, aggregate.planning);
    if (
      passMutatedWorld(closure)
      || closure.releasedAtRisk.length > 0
    ) {
      incrementWorldRevision(aggregate.runtime);
    }
    lockWorldForResolution(aggregate.runtime, aggregate.state);
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
    resolveLockedWorldWeek(aggregate.runtime, aggregate.state);
    materializeCurrentWeekReservations(aggregate.state, aggregate.planning);
  });
  return committed.revision;
}
