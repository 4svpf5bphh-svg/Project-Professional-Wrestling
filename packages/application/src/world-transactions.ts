import type { Id } from "../../domain/src/types.js";
import type { ApplicationWorldRepository } from "./world-aggregate.js";
import {
  beginWorldResolution,
  lockWorldForResolution,
  resolveLockedWorldWeek,
} from "./runtime.js";

export async function lockPersistedWorldForResolution(
  repository: ApplicationWorldRepository,
  worldId: Id,
  expectedRevision: number,
): Promise<number> {
  const committed = await repository.transact(worldId, expectedRevision, (aggregate) => {
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
  });
  return committed.revision;
}
