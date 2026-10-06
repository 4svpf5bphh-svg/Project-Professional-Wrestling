import postgres from "postgres";
import type { Id, PpwDate } from "../../domain/src/types.js";
import {
  createWorldEngagementState,
  normalizeWorldEngagementState,
  recordPlayerActivity as recordPlayerActivityInState,
  type WorldEngagementState,
} from "../../application/src/engagement.js";
import { PostgresApplicationWorldRepository } from "./postgres-world-repository.js";

type SqlClient = ReturnType<typeof postgres>;

type ActivityRow = {
  engagement_state: unknown | null;
  current_ppw_date: PpwDate | null;
  runtime_revision: string | number;
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

export function createPostgresServerWorldAccess(connectionString: string): PostgresServerWorldAccess {
  const sql = postgres(connectionString, { max: 5 });
  const repository = new PostgresApplicationWorldRepository(sql);

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
