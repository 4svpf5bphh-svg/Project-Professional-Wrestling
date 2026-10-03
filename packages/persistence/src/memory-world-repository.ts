import type { Id } from "../../domain/src/types.js";
import {
  createPersistedApplicationWorld,
  restorePersistedApplicationWorld,
  type ApplicationWorldAggregate,
  type ApplicationWorldRepository,
  type PersistedApplicationWorld,
  type WorldTransactionResult,
} from "../../application/src/world-aggregate.js";

export class InMemoryApplicationWorldRepository implements ApplicationWorldRepository {
  private readonly records = new Map<Id, PersistedApplicationWorld>();

  async initialize(aggregate: ApplicationWorldAggregate): Promise<void> {
    const worldId = aggregate.state.world.id;
    if (this.records.has(worldId)) throw new Error(`World ${worldId} already exists`);
    this.records.set(worldId, createPersistedApplicationWorld(aggregate));
  }

  async load(worldId: Id): Promise<ApplicationWorldAggregate> {
    const record = this.records.get(worldId);
    if (!record) throw new Error(`World ${worldId} was not found`);
    return restorePersistedApplicationWorld(record);
  }

  async transact<TResult>(
    worldId: Id,
    expectedRevision: number | null,
    action: (aggregate: ApplicationWorldAggregate) => TResult | Promise<TResult>,
  ): Promise<WorldTransactionResult<TResult>> {
    const record = this.records.get(worldId);
    if (!record) throw new Error(`World ${worldId} was not found`);

    const working = restorePersistedApplicationWorld(record);
    if (expectedRevision !== null && working.runtime.revision !== expectedRevision) {
      throw new Error(
        `stale World revision for ${worldId}: expected ${expectedRevision}, current ${working.runtime.revision}`,
      );
    }

    const result = await action(working);
    this.records.set(worldId, createPersistedApplicationWorld(working));
    return { result, revision: working.runtime.revision };
  }
}
