import postgres from "postgres";
import { compressWorldSnapshot, restoreCompressedWorldSnapshot } from "./world-snapshot-compression.js";
import type { Id, PpwDate } from "../../domain/src/types.js";
import {
  CURRENT_APPLICATION_STATE_SCHEMA_VERSION,
  createPersistedApplicationWorld,
  restorePersistedApplicationWorld,
  type ApplicationWorldAggregate,
  type ApplicationWorldRepository,
  type PersistedApplicationWorld,
  type WorldTransactionResult,
} from "../../application/src/world-aggregate.js";
import { createWorldEngagementState, type WorldEngagementState } from "../../application/src/engagement.js";
import { createWorldPlanningState, type WorldPlanningState } from "../../application/src/planning.js";
import type { ApplicationCommandReceipt } from "../../application/src/commands.js";
import type { PromotionControl, WorldMembership } from "../../application/src/ownership.js";
import type { WorldRuntimePhase } from "../../application/src/runtime.js";
import { CURRENT_WORLD_STATE_SCHEMA_VERSION } from "../../sim-core/src/state-schema.js";

interface PostgresMigration {
  version: number;
  name: string;
  sql: string;
}

const POSTGRES_MIGRATION_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS ppw_schema_migrations (
  version integer PRIMARY KEY CHECK (version >= 1),
  name text NOT NULL,
  applied_at timestamptz NOT NULL DEFAULT now()
);
`;

export const POSTGRES_APPLICATION_MIGRATIONS: readonly PostgresMigration[] = [
  {
    version: 1,
    name: "application world repository baseline",
    sql: `
CREATE TABLE IF NOT EXISTS ppw_worlds (
  world_id text PRIMARY KEY,
  state_schema_version integer NOT NULL,
  world_state jsonb NOT NULL,
  runtime_phase text NOT NULL CHECK (runtime_phase IN ('OPEN', 'LOCKING', 'RESOLVING')),
  runtime_revision bigint NOT NULL CHECK (runtime_revision >= 0),
  locked_ppw_date jsonb NULL,
  last_resolved_ppw_date jsonb NULL,
  human_seat_limit integer NOT NULL CHECK (human_seat_limit >= 1),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ppw_world_memberships (
  world_id text NOT NULL REFERENCES ppw_worlds(world_id) ON DELETE CASCADE,
  ordinal integer NOT NULL CHECK (ordinal >= 0),
  player_id text NOT NULL,
  joined_date jsonb NOT NULL,
  status text NOT NULL CHECK (status IN ('ACTIVE', 'LEFT')),
  PRIMARY KEY (world_id, ordinal)
);
CREATE UNIQUE INDEX IF NOT EXISTS ppw_world_memberships_active_player
  ON ppw_world_memberships(world_id, player_id) WHERE status = 'ACTIVE';

CREATE TABLE IF NOT EXISTS ppw_promotion_controls (
  world_id text NOT NULL REFERENCES ppw_worlds(world_id) ON DELETE CASCADE,
  ordinal integer NOT NULL CHECK (ordinal >= 0),
  promotion_id text NOT NULL,
  player_id text NOT NULL,
  control_start_date jsonb NOT NULL,
  control_end_date jsonb NULL,
  status text NOT NULL CHECK (status IN ('ACTIVE', 'ENDED')),
  PRIMARY KEY (world_id, ordinal)
);
CREATE UNIQUE INDEX IF NOT EXISTS ppw_promotion_controls_active_player
  ON ppw_promotion_controls(world_id, player_id) WHERE status = 'ACTIVE';
CREATE UNIQUE INDEX IF NOT EXISTS ppw_promotion_controls_active_promotion
  ON ppw_promotion_controls(world_id, promotion_id) WHERE status = 'ACTIVE';

CREATE TABLE IF NOT EXISTS ppw_command_receipts (
  world_id text NOT NULL REFERENCES ppw_worlds(world_id) ON DELETE CASCADE,
  request_id text NOT NULL,
  player_id text NOT NULL,
  command_type text NOT NULL,
  canonical_payload text NOT NULL,
  result_json text NOT NULL,
  committed_date jsonb NOT NULL,
  committed_revision bigint NOT NULL CHECK (committed_revision >= 0),
  PRIMARY KEY (world_id, request_id)
);
`,
  },
  {
    version: 2,
    name: "editable planning state",
    sql: `ALTER TABLE ppw_worlds ADD COLUMN IF NOT EXISTS planning_state jsonb NULL;`,
  },
  {
    version: 3,
    name: "scheduled resolution cycle keys",
    sql: `
ALTER TABLE ppw_worlds ADD COLUMN IF NOT EXISTS locked_real_cycle_key text NULL;
ALTER TABLE ppw_worlds ADD COLUMN IF NOT EXISTS last_resolved_real_cycle_key text NULL;
`,
  },
  {
    version: 4,
    name: "player engagement and opportunity state",
    sql: `ALTER TABLE ppw_worlds ADD COLUMN IF NOT EXISTS engagement_state jsonb NULL;`,
  },
  {
    version: 5,
    name: "reset Alpha playtest World for calibrated real roster",
    sql: `
DELETE FROM ppw_worlds AS worlds
WHERE worlds.world_id = 'world-20261002'
   OR worlds.world_state->'world'->>'name' = 'PPW Alpha World'
   OR EXISTS (
     SELECT 1
     FROM ppw_world_memberships AS memberships
     WHERE memberships.world_id = worlds.world_id
       AND memberships.player_id = 'alpha-player-1'
   );
`,
  },
  {
    version: 6,
    name: "persist show commitment lock runtime state",
    sql: `
ALTER TABLE ppw_worlds ADD COLUMN IF NOT EXISTS commitment_locked_ppw_date jsonb NULL;
ALTER TABLE ppw_worlds ADD COLUMN IF NOT EXISTS commitment_locked_real_cycle_key text NULL;
`,
  },
  {
    version: 7,
    name: "reset Alpha World for audited real-world ecosystem cutover",
    sql: `
DELETE FROM ppw_worlds AS worlds
WHERE worlds.world_id = 'world-20261002'
   OR (
     worlds.world_state->'world'->>'name' = 'PPW Alpha World'
     AND EXISTS (
       SELECT 1
       FROM ppw_world_memberships AS memberships
       WHERE memberships.world_id = worlds.world_id
         AND memberships.player_id = 'alpha-player-1'
     )
   );
`,
  },
  {
    version: 8,
    name: "reset Alpha World for Reality Check roster and talent release",
    sql: `
DELETE FROM ppw_worlds AS worlds
WHERE worlds.world_id = 'world-20261002'
   OR (
     worlds.world_state->'world'->>'name' = 'PPW Alpha World'
     AND EXISTS (
       SELECT 1
       FROM ppw_world_memberships AS memberships
       WHERE memberships.world_id = worlds.world_id
         AND memberships.player_id = 'alpha-player-1'
     )
   );
`,
  },
  {
    version: 9,
    name: "track completed server bootstrap repairs without loading World snapshots",
    sql: `ALTER TABLE ppw_worlds ADD COLUMN IF NOT EXISTS bootstrap_verified_version integer NOT NULL DEFAULT 0;`,
  },
  {
    version: 10,
    name: "add optional compressed snapshot transport without changing authoritative JSONB",
    sql: `ALTER TABLE ppw_worlds ADD COLUMN IF NOT EXISTS world_state_gzip bytea NULL;`,
  },
] as const;

export const POSTGRES_APPLICATION_SCHEMA_SQL = [
  POSTGRES_MIGRATION_TABLE_SQL,
  ...POSTGRES_APPLICATION_MIGRATIONS.map((migration) => migration.sql),
].join("\n");

type SqlClient = ReturnType<typeof postgres>;

type WorldRow = {
  world_id: string;
  world_state: unknown | null;
  world_state_gzip: Uint8Array | null;
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

type ReceiptRow = {
  request_id: string;
  player_id: string;
  command_type: ApplicationCommandReceipt["commandType"];
  canonical_payload: string;
  result_json: string;
  committed_date: PpwDate;
  committed_revision: string | number;
};

async function readAggregate(sql: SqlClient, worldId: Id, forUpdate: boolean): Promise<ApplicationWorldAggregate> {
  const lock = forUpdate ? " FOR UPDATE" : "";
  const worldRows = await sql.unsafe(
    `SELECT world_id,
            CASE WHEN world_state_gzip IS NULL THEN world_state ELSE NULL END AS world_state,
            world_state_gzip,
            planning_state, engagement_state, runtime_phase, runtime_revision, locked_ppw_date, last_resolved_ppw_date,
            commitment_locked_ppw_date, commitment_locked_real_cycle_key,
            locked_real_cycle_key, last_resolved_real_cycle_key, human_seat_limit
       FROM ppw_worlds WHERE world_id = $1${lock}`,
    [worldId],
  ) as unknown as WorldRow[];
  const row = worldRows[0];
  if (!row) throw new Error(`World ${worldId} was not found`);
  const world = row.world_state_gzip
    ? restoreCompressedWorldSnapshot(row.world_state_gzip)
    : row.world_state;
  if (!world) throw new Error(`World ${worldId} has no persisted snapshot`);

  const membershipRows = await sql`
    SELECT player_id, joined_date, status
    FROM ppw_world_memberships
    WHERE world_id = ${worldId}
    ORDER BY ordinal
  ` as unknown as MembershipRow[];
  const controlRows = await sql`
    SELECT promotion_id, player_id, control_start_date, control_end_date, status
    FROM ppw_promotion_controls
    WHERE world_id = ${worldId}
    ORDER BY ordinal
  ` as unknown as ControlRow[];
  const receiptRows = await sql`
    SELECT request_id, player_id, command_type, canonical_payload, result_json, committed_date, committed_revision
    FROM ppw_command_receipts
    WHERE world_id = ${worldId}
    ORDER BY committed_revision, request_id
  ` as unknown as ReceiptRow[];

  const snapshot: PersistedApplicationWorld = {
    applicationStateSchemaVersion: CURRENT_APPLICATION_STATE_SCHEMA_VERSION,
    world: world as PersistedApplicationWorld["world"],
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
      receipts: receiptRows.map((receipt) => ({
        worldId,
        requestId: receipt.request_id,
        playerId: receipt.player_id,
        commandType: receipt.command_type,
        canonicalPayload: receipt.canonical_payload,
        resultJson: receipt.result_json,
        committedDate: receipt.committed_date,
        committedRevision: Number(receipt.committed_revision),
      })),
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
  return restorePersistedApplicationWorld(snapshot);
}

async function writeAggregate(sql: SqlClient, aggregate: ApplicationWorldAggregate): Promise<void> {
  const snapshot = createPersistedApplicationWorld(aggregate);
  const worldId = aggregate.state.world.id;

  await sql`
    UPDATE ppw_worlds SET
      state_schema_version = ${CURRENT_WORLD_STATE_SCHEMA_VERSION},
      world_state = ${sql.json(snapshot.world as never)},
      world_state_gzip = ${compressWorldSnapshot(snapshot.world)},
      planning_state = ${sql.json(snapshot.planning as never)},
      engagement_state = ${sql.json(snapshot.engagement as never)},
      runtime_phase = ${snapshot.runtime.phase},
      runtime_revision = ${snapshot.runtime.revision},
      locked_ppw_date = ${snapshot.runtime.lockedPpwDate ? sql.json(snapshot.runtime.lockedPpwDate as never) : null},
      last_resolved_ppw_date = ${snapshot.runtime.lastResolvedPpwDate ? sql.json(snapshot.runtime.lastResolvedPpwDate as never) : null},
      commitment_locked_ppw_date = ${snapshot.runtime.commitmentLockedPpwDate ? sql.json(snapshot.runtime.commitmentLockedPpwDate as never) : null},
      commitment_locked_real_cycle_key = ${snapshot.runtime.commitmentLockedRealCycleKey ?? null},
      locked_real_cycle_key = ${snapshot.runtime.lockedRealCycleKey ?? null},
      last_resolved_real_cycle_key = ${snapshot.runtime.lastResolvedRealCycleKey ?? null},
      human_seat_limit = ${snapshot.ownership.humanSeatLimit},
      updated_at = now()
    WHERE world_id = ${worldId}
  `;

  for (let ordinal = 0; ordinal < snapshot.ownership.memberships.length; ordinal += 1) {
    const membership = snapshot.ownership.memberships[ordinal]!;
    await sql`
      INSERT INTO ppw_world_memberships(world_id, ordinal, player_id, joined_date, status)
      VALUES (${worldId}, ${ordinal}, ${membership.playerId}, ${sql.json(membership.joinedDate as never)}, ${membership.status})
      ON CONFLICT (world_id, ordinal) DO UPDATE SET
        player_id = EXCLUDED.player_id,
        joined_date = EXCLUDED.joined_date,
        status = EXCLUDED.status
    `;
  }
  await sql`DELETE FROM ppw_world_memberships WHERE world_id = ${worldId} AND ordinal >= ${snapshot.ownership.memberships.length}`;

  for (let ordinal = 0; ordinal < snapshot.ownership.promotionControls.length; ordinal += 1) {
    const control = snapshot.ownership.promotionControls[ordinal]!;
    await sql`
      INSERT INTO ppw_promotion_controls(
        world_id, ordinal, promotion_id, player_id, control_start_date, control_end_date, status
      ) VALUES (
        ${worldId}, ${ordinal}, ${control.promotionId}, ${control.playerId},
        ${sql.json(control.controlStartDate as never)}, ${control.controlEndDate ? sql.json(control.controlEndDate as never) : null}, ${control.status}
      )
      ON CONFLICT (world_id, ordinal) DO UPDATE SET
        promotion_id = EXCLUDED.promotion_id,
        player_id = EXCLUDED.player_id,
        control_start_date = EXCLUDED.control_start_date,
        control_end_date = EXCLUDED.control_end_date,
        status = EXCLUDED.status
    `;
  }
  await sql`DELETE FROM ppw_promotion_controls WHERE world_id = ${worldId} AND ordinal >= ${snapshot.ownership.promotionControls.length}`;

  for (const receipt of snapshot.commands.receipts) {
    await sql`
      INSERT INTO ppw_command_receipts(
        world_id, request_id, player_id, command_type, canonical_payload, result_json, committed_date, committed_revision
      ) VALUES (
        ${worldId}, ${receipt.requestId}, ${receipt.playerId}, ${receipt.commandType}, ${receipt.canonicalPayload},
        ${receipt.resultJson}, ${sql.json(receipt.committedDate as never)}, ${receipt.committedRevision}
      )
      ON CONFLICT (world_id, request_id) DO UPDATE SET
        player_id = EXCLUDED.player_id,
        command_type = EXCLUDED.command_type,
        canonical_payload = EXCLUDED.canonical_payload,
        result_json = EXCLUDED.result_json,
        committed_date = EXCLUDED.committed_date,
        committed_revision = EXCLUDED.committed_revision
    `;
  }
}

export class PostgresApplicationWorldRepository implements ApplicationWorldRepository {
  constructor(private readonly sql: SqlClient) {}

  async migrate(): Promise<void> {
    await this.sql.begin(async (tx) => {
      await tx.unsafe(POSTGRES_MIGRATION_TABLE_SQL);
      await tx.unsafe("LOCK TABLE ppw_schema_migrations IN EXCLUSIVE MODE");
      const appliedRows = await tx`SELECT version FROM ppw_schema_migrations ORDER BY version` as unknown as Array<{ version: number }>;
      const applied = new Set(appliedRows.map((row) => Number(row.version)));

      for (const migration of POSTGRES_APPLICATION_MIGRATIONS) {
        if (applied.has(migration.version)) continue;
        await tx.unsafe(migration.sql);
        await tx`
          INSERT INTO ppw_schema_migrations(version, name)
          VALUES (${migration.version}, ${migration.name})
        `;
      }
    });
  }

  async initialize(aggregate: ApplicationWorldAggregate): Promise<void> {
    const snapshot = createPersistedApplicationWorld(aggregate);
    const worldId = aggregate.state.world.id;
    await this.sql.begin(async (tx) => {
      const inserted = await tx`
        INSERT INTO ppw_worlds(
          world_id, state_schema_version, world_state, planning_state, engagement_state, runtime_phase, runtime_revision,
          locked_ppw_date, last_resolved_ppw_date, commitment_locked_ppw_date, commitment_locked_real_cycle_key,
          locked_real_cycle_key, last_resolved_real_cycle_key, human_seat_limit
        ) VALUES (
          ${worldId}, ${CURRENT_WORLD_STATE_SCHEMA_VERSION}, ${tx.json(snapshot.world as never)}, ${tx.json(snapshot.planning as never)},
          ${tx.json(snapshot.engagement as never)}, ${snapshot.runtime.phase}, ${snapshot.runtime.revision},
          ${null}, ${null}, ${null}, ${null}, ${null}, ${null}, ${snapshot.ownership.humanSeatLimit}
        )
        ON CONFLICT (world_id) DO NOTHING
        RETURNING world_id
      `;
      if (inserted.length !== 1) throw new Error(`World ${worldId} already exists`);
      await writeAggregate(tx as unknown as SqlClient, aggregate);
    });
  }

  async load(worldId: Id): Promise<ApplicationWorldAggregate> {
    return readAggregate(this.sql, worldId, false);
  }

  async transact<TResult>(
    worldId: Id,
    expectedRevision: number | null,
    action: (aggregate: ApplicationWorldAggregate) => TResult | Promise<TResult>,
  ): Promise<WorldTransactionResult<TResult>> {
    return this.sql.begin(async (tx) => {
      const transactionalSql = tx as unknown as SqlClient;
      const working = await readAggregate(transactionalSql, worldId, true);
      if (expectedRevision !== null && working.runtime.revision !== expectedRevision) {
        throw new Error(
          `stale World revision for ${worldId}: expected ${expectedRevision}, current ${working.runtime.revision}`,
        );
      }
      const result = await action(working);
      await writeAggregate(transactionalSql, working);
      return { result, revision: working.runtime.revision };
    });
  }
}

export function createPostgresApplicationWorldRepository(connectionString: string): {
  repository: PostgresApplicationWorldRepository;
  close: () => Promise<void>;
} {
  const sql = postgres(connectionString, { max: 5 });
  return {
    repository: new PostgresApplicationWorldRepository(sql),
    close: () => sql.end({ timeout: 5 }),
  };
}
