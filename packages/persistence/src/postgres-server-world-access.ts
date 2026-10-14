import postgres from "postgres";
import type { Id, PpwDate } from "../../domain/src/types.js";
import { CURRENT_WORLD_STATE_SCHEMA_VERSION } from "../../sim-core/src/state-schema.js";
import {
  createWorldEngagementState,
  normalizeWorldEngagementState,
  recordPlayerActivity as recordPlayerActivityInState,
  type WorldEngagementState,
} from "../../application/src/engagement.js";
import {
  CURRENT_APPLICATION_STATE_SCHEMA_VERSION,
  restorePersistedApplicationWorld,
  type ApplicationWorldAggregate,
  type PersistedApplicationWorld,
} from "../../application/src/world-aggregate.js";
import { createWorldPlanningState, type WorldPlanningState } from "../../application/src/planning.js";
import type { PromotionControl, WorldMembership } from "../../application/src/ownership.js";
import type { WorldRuntimePhase } from "../../application/src/runtime.js";
import { PostgresApplicationWorldRepository } from "./postgres-world-repository.js";

type SqlClient = ReturnType<typeof postgres>;

type ActivityRow = {
  engagement_state: unknown | null;
  current_ppw_date: PpwDate | null;
  runtime_revision: string | number;
  snapshot_version: string;
};

type WorldVersionRow = { snapshot_version: string };

export interface ServerWorldReadStatistics {
  fullSnapshotReads: number;
  versionProbes: number;
  cacheHits: number;
  /** Count of expensive but history-trimmed read-only Talent snapshots. */
  trimmedHistoryReads: number;
}

type WorldReadRow = {
  world_id: string;
  snapshot_version: string;
  world_state: unknown;
  planning_state: unknown | null;
  engagement_state: unknown | null;
  runtime_phase: WorldRuntimePhase;
  runtime_revision: string | number;
  locked_ppw_date: PpwDate | null;
  last_resolved_ppw_date: PpwDate | null;
  commitment_locked_ppw_date: PpwDate | null;
  commitment_locked_real_cycle_key: string | null;
  locked_real_cycle_key: string | null;
  last_resolved_real_cycle_key: string | null;
  human_seat_limit: number;
};

type MembershipRow = {
  player_id: string;
  joined_date: PpwDate;
  status: WorldMembership["status"];
};

type ControlRow = {
  promotion_id: string;
  player_id: string;
  control_start_date: PpwDate;
  control_end_date: PpwDate | null;
  status: PromotionControl["status"];
};

export interface PostgresServerWorldAccess {
  repository: PostgresApplicationWorldRepository;
  /** Diagnostic counters for tests and lightweight operational monitoring. */
  readStatistics(): ServerWorldReadStatistics;
  /** Fast bootstrap gate. Must only skip compatibility repairs previously completed. */
  bootstrapVerified(worldId: Id, requiredVersion: number): Promise<boolean>;
  markBootstrapVerified(worldId: Id, completedVersion: number): Promise<void>;
  recordPlayerActivity(
    worldId: Id,
    playerId: string,
    realCycleKey: string | null,
  ): Promise<void>;
  close(): Promise<void>;
}

function validPpwDate(value: PpwDate | null): value is PpwDate {
  return Boolean(
    value
    && Number.isSafeInteger(value.year)
    && value.year >= 1
    && Number.isSafeInteger(value.week)
    && value.week >= 1
    && Number.isSafeInteger(value.day)
    && value.day >= 1
    && value.day <= 7,
  );
}

async function readWorldWithoutCommandReceipts(
  sql: SqlClient,
  worldId: Id,
  mode: "full" | "talent" = "full",
): Promise<{ aggregate: ApplicationWorldAggregate; snapshotVersion: string }> {
  const startedAt = performance.now();
  // Only current-schema read-only Talent/Staff views may omit history.
  // Older schema versions must retain their complete legacy migration inputs.
  const stateProjection = mode === "talent"
    ? sql`CASE WHEN state_schema_version = ${CURRENT_WORLD_STATE_SCHEMA_VERSION}
      THEN jsonb_set(jsonb_set(world_state, '{ledger}', '[]'::jsonb),
        '{financialTransactions}', '[]'::jsonb)
      ELSE world_state END`
    : sql`world_state`;
  const worldRows = await sql`
    SELECT world_id, updated_at::text AS snapshot_version,
           ${stateProjection} AS world_state, planning_state, engagement_state, runtime_phase, runtime_revision,
           locked_ppw_date, last_resolved_ppw_date, commitment_locked_ppw_date, commitment_locked_real_cycle_key,
           locked_real_cycle_key, last_resolved_real_cycle_key, human_seat_limit
    FROM ppw_worlds
    WHERE world_id = ${worldId}
  ` as unknown as WorldReadRow[];
  const row = worldRows[0];
  if (!row) throw new Error(`World ${worldId} was not found`);

  const [membershipRows, controlRows] = await Promise.all([
    sql`
      SELECT player_id, joined_date, status
      FROM ppw_world_memberships
      WHERE world_id = ${worldId}
      ORDER BY ordinal
    ` as unknown as Promise<MembershipRow[]>,
    sql`
      SELECT promotion_id, player_id, control_start_date, control_end_date, status
      FROM ppw_promotion_controls
      WHERE world_id = ${worldId}
      ORDER BY ordinal
    ` as unknown as Promise<ControlRow[]>,
  ]);

  const snapshot: PersistedApplicationWorld = {
    applicationStateSchemaVersion: CURRENT_APPLICATION_STATE_SCHEMA_VERSION,
    world: row.world_state as PersistedApplicationWorld["world"],
    ownership: {
      worldId,
      humanSeatLimit: Number(row.human_seat_limit),
      memberships: membershipRows.map((membership) => ({
        worldId,
        playerId: membership.player_id,
        joinedDate: membership.joined_date,
        status: membership.status,
      })),
      promotionControls: controlRows.map((control) => ({
        worldId,
        promotionId: control.promotion_id,
        playerId: control.player_id,
        controlStartDate: control.control_start_date,
        controlEndDate: control.control_end_date,
        status: control.status,
      })),
    },
    commands: {
      worldId,
      receipts: [],
    },
    runtime: {
      worldId,
      phase: row.runtime_phase,
      revision: Number(row.runtime_revision),
      lockedPpwDate: row.locked_ppw_date,
      lastResolvedPpwDate: row.last_resolved_ppw_date,
      commitmentLockedPpwDate: row.commitment_locked_ppw_date,
      commitmentLockedRealCycleKey: row.commitment_locked_real_cycle_key,
      lockedRealCycleKey: row.locked_real_cycle_key,
      lastResolvedRealCycleKey: row.last_resolved_real_cycle_key,
    },
    planning: row.planning_state
      ? structuredClone(row.planning_state as WorldPlanningState)
      : createWorldPlanningState(worldId),
    engagement: row.engagement_state
      ? structuredClone(row.engagement_state as WorldEngagementState)
      : createWorldEngagementState(worldId),
  };
  const aggregate = restorePersistedApplicationWorld(snapshot);
  const elapsedMs = performance.now() - startedAt;
  if (process.env.PPW_PERF_LOGS !== "0" && elapsedMs >= 100) {
    console.info("[ppw-db-world-read]", JSON.stringify({
      elapsedMs: Math.round(elapsedMs * 10) / 10,
      membershipCount: membershipRows.length,
      controlCount: controlRows.length,
      worldRevision: Number(row.runtime_revision),
    }));
  }
  return { aggregate, snapshotVersion: row.snapshot_version };
}

class PostgresServerWorldRepository extends PostgresApplicationWorldRepository {
  // A warm server can serve repeat GETs without transmitting 5–6 MB of
  // World JSON each time. Only metadata is trusted for cache validity.
  // Each instance has its own bounded cache; transactions still read and
  // lock authoritative PostgreSQL state (never this cache).
  private readonly cache = new Map<Id, {
    version: string;
    aggregate: ApplicationWorldAggregate;
  }>();
  private readonly talentCache = new Map<Id, {
    version: string;
    aggregate: ApplicationWorldAggregate;
  }>();
  private readonly stats: ServerWorldReadStatistics = {
    fullSnapshotReads: 0, versionProbes: 0, cacheHits: 0, trimmedHistoryReads: 0,
  };

  constructor(private readonly serverSql: SqlClient) {
    super(serverSql);
  }

  readStatistics(): ServerWorldReadStatistics {
    return { ...this.stats };
  }

  override async load(worldId: Id): Promise<ApplicationWorldAggregate> {
    this.stats.versionProbes += 1;
    const rows = await this.serverSql`
      SELECT updated_at::text AS snapshot_version
      FROM ppw_worlds WHERE world_id = ${worldId}
    ` as unknown as WorldVersionRow[];
    if (!rows[0]) throw new Error(`World ${worldId} was not found`);
    const cached = this.cache.get(worldId);
    if (cached && cached.version === rows[0].snapshot_version) {
      this.stats.cacheHits += 1;
      // Read-only projections must not alter the shared cached aggregate.
      return structuredClone(cached.aggregate);
    }

    this.stats.fullSnapshotReads += 1;
    const fresh = await readWorldWithoutCommandReceipts(this.serverSql, worldId);
    // A bounded cache prevents many independent Worlds exhausting memory.
    this.cache.delete(worldId);
    this.cache.set(worldId, {
      version: fresh.snapshotVersion,
      aggregate: structuredClone(fresh.aggregate),
    });
    if (this.cache.size > 2) {
      this.cache.delete(this.cache.keys().next().value!);
    }
    return fresh.aggregate;
  }

  override async loadTalentView(worldId: Id): Promise<ApplicationWorldAggregate> {
    this.stats.versionProbes += 1;
    const rows = await this.serverSql`
      SELECT updated_at::text AS snapshot_version
      FROM ppw_worlds WHERE world_id = ${worldId}
    ` as unknown as WorldVersionRow[];
    if (!rows[0]) throw new Error(`World ${worldId} was not found`);
    const version = rows[0].snapshot_version;
    const full = this.cache.get(worldId);
    if (full?.version === version) {
      this.stats.cacheHits += 1;
      const readOnly = structuredClone(full.aggregate);
      readOnly.state.ledger = [];
      readOnly.state.financialTransactions = [];
      return readOnly;
    }
    const cached = this.talentCache.get(worldId);
    if (cached?.version === version) {
      this.stats.cacheHits += 1;
      return structuredClone(cached.aggregate);
    }
    const fresh = await readWorldWithoutCommandReceipts(this.serverSql, worldId, "talent");
    this.stats.trimmedHistoryReads += 1;
    this.talentCache.delete(worldId);
    this.talentCache.set(worldId, {
      version: fresh.snapshotVersion, aggregate: structuredClone(fresh.aggregate),
    });
    if (this.talentCache.size > 2) this.talentCache.delete(this.talentCache.keys().next().value!);
    return fresh.aggregate;
  }

  /** Activity writes only change engagement, not simulation World state.
   * Patch the cache only when it was current BEFORE the authoritative write.
   * Otherwise invalidate; a rival's World mutation must never be hidden.
   */
  applyPlayerActivity(
    worldId: Id, beforeVersion: string, afterVersion: string,
    engagement: WorldEngagementState,
  ): void {
    const cached = this.cache.get(worldId);
    const cachedTalent = this.talentCache.get(worldId);
    if (cachedTalent) {
      if (cachedTalent.version === beforeVersion) {
        cachedTalent.aggregate.engagement = structuredClone(engagement);
        cachedTalent.version = afterVersion;
      } else this.talentCache.delete(worldId);
    }
    if (!cached) return;
    if (cached.version !== beforeVersion) {
      this.cache.delete(worldId);
      return;
    }
    cached.aggregate.engagement = structuredClone(engagement);
    cached.version = afterVersion;
  }
}

export function createPostgresServerWorldAccess(connectionString: string): PostgresServerWorldAccess {
  const sql = postgres(connectionString, { max: 5 });
  const repository = new PostgresServerWorldRepository(sql);

  return {
    repository,
    readStatistics: () => repository.readStatistics(),
    async bootstrapVerified(worldId, requiredVersion): Promise<boolean> {
      const rows = await sql`
        SELECT bootstrap_verified_version FROM ppw_worlds
        WHERE world_id = ${worldId}
      ` as unknown as Array<{ bootstrap_verified_version: number }>;
      return Boolean(rows[0] && Number(rows[0].bootstrap_verified_version) >= requiredVersion);
    },
    async markBootstrapVerified(worldId, completedVersion): Promise<void> {
      // Metadata-only update. World state, revision, updated_at and the
      // version-validated read cache remain unchanged.
      const rows = await sql`
        UPDATE ppw_worlds
        SET bootstrap_verified_version = GREATEST(bootstrap_verified_version, ${completedVersion})
        WHERE world_id = ${worldId}
        RETURNING world_id
      `;
      if (rows.length !== 1) throw new Error(`World ${worldId} was not found during bootstrap verification`);
    },
    async recordPlayerActivity(worldId, playerId, realCycleKey): Promise<void> {
      const activity = await sql.begin(async (tx) => {
        const rows = await tx`
          SELECT
            engagement_state,
            world_state->'world'->'currentDate' AS current_ppw_date,
            runtime_revision, updated_at::text AS snapshot_version
          FROM ppw_worlds
          WHERE world_id = ${worldId}
          FOR UPDATE
        ` as unknown as ActivityRow[];
        const row = rows[0];
        if (!row) throw new Error(`World ${worldId} was not found`);
        if (!validPpwDate(row.current_ppw_date)) {
          throw new Error(`World ${worldId} has an invalid current PPW date`);
        }

        const engagement = row.engagement_state
          ? normalizeWorldEngagementState(row.engagement_state as WorldEngagementState, worldId)
          : createWorldEngagementState(worldId);
        const previous = engagement.playerActivity.find((activity) => activity.playerId === playerId);
        const unchanged = previous?.status === "ACTIVE"
          && previous.lastActiveCycleKey === realCycleKey
          && previous.lastActiveRevision === Number(row.runtime_revision)
          && previous.lastActivePpwDate.year === row.current_ppw_date.year
          && previous.lastActivePpwDate.week === row.current_ppw_date.week
          && previous.lastActivePpwDate.day === row.current_ppw_date.day;
        if (unchanged) return null;

        recordPlayerActivityInState(
          engagement,
          playerId,
          row.current_ppw_date,
          Number(row.runtime_revision),
          realCycleKey,
        );

        const updated = await tx`
          UPDATE ppw_worlds
          SET engagement_state = ${tx.json(engagement as never)}, updated_at = clock_timestamp()
          WHERE world_id = ${worldId}
          RETURNING updated_at::text AS snapshot_version
        ` as unknown as WorldVersionRow[];
        return { beforeVersion: row.snapshot_version,
          afterVersion: updated[0]!.snapshot_version, engagement };
      });
      if (activity) repository.applyPlayerActivity(
        worldId, activity.beforeVersion, activity.afterVersion, activity.engagement,
      );
    },
    close: () => sql.end({ timeout: 5 }),
  };
}
