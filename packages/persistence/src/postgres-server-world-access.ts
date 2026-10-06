import postgres from "postgres";
import type { Id, PpwDate } from "../../domain/src/types.js";
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
};

type WorldReadRow = {
  world_id: string;
  world_state: unknown;
  planning_state: unknown | null;
  engagement_state: unknown | null;
  runtime_phase: WorldRuntimePhase;
  runtime_revision: string | number;
  locked_ppw_date: PpwDate | null;
  last_resolved_ppw_date: PpwDate | null;
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
): Promise<ApplicationWorldAggregate> {
  const worldRows = await sql`
    SELECT world_id, world_state, planning_state, engagement_state, runtime_phase, runtime_revision,
           locked_ppw_date, last_resolved_ppw_date, locked_real_cycle_key, last_resolved_real_cycle_key,
           human_seat_limit
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
  return restorePersistedApplicationWorld(snapshot);
}

class PostgresServerWorldRepository extends PostgresApplicationWorldRepository {
  constructor(private readonly serverSql: SqlClient) {
    super(serverSql);
  }

  override async load(worldId: Id): Promise<ApplicationWorldAggregate> {
    return readWorldWithoutCommandReceipts(this.serverSql, worldId);
  }
}

export function createPostgresServerWorldAccess(connectionString: string): PostgresServerWorldAccess {
  const sql = postgres(connectionString, { max: 5 });
  const repository = new PostgresServerWorldRepository(sql);

  return {
    repository,
    async recordPlayerActivity(worldId, playerId, realCycleKey): Promise<void> {
      await sql.begin(async (tx) => {
        const rows = await tx`
          SELECT
            engagement_state,
            world_state->'world'->'currentDate' AS current_ppw_date,
            runtime_revision
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
        recordPlayerActivityInState(
          engagement,
          playerId,
          row.current_ppw_date,
          Number(row.runtime_revision),
          realCycleKey,
        );

        await tx`
          UPDATE ppw_worlds
          SET engagement_state = ${tx.json(engagement as never)}, updated_at = now()
          WHERE world_id = ${worldId}
        `;
      });
    },
    close: () => sql.end({ timeout: 5 }),
  };
}
