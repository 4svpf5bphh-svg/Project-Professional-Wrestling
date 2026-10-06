import {
  createWorldEngagementState,
  recordPlayerActivity,
  type ApplicationWorldRepository,
} from "../../application/src/index.js";
import { createPostgresApplicationWorldRepository } from "../../persistence/src/postgres-world-repository.js";
import { ensureAlphaWorld } from "./alpha-service.js";

export interface AlphaServerContext {
  repository: ApplicationWorldRepository;
  worldId: string;
  playerId: string;
}

export interface AlphaServerContextOptions {
  trackPlayerActivity?: boolean;
}

const schemaBootstraps = new Map<string, Promise<void>>();
const worldBootstraps = new Map<string, Promise<string>>();

function integerEnvironment(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number(raw);
  if (!Number.isSafeInteger(parsed)) throw new Error(`${name} must be an integer`);
  return parsed;
}

function currentUtcCycleKey(): string {
  return new Date().toISOString().slice(0, 10);
}

function ensureSchemaReady(
  connectionString: string,
  repository: ReturnType<typeof createPostgresApplicationWorldRepository>["repository"],
): Promise<void> {
  const existing = schemaBootstraps.get(connectionString);
  if (existing) return existing;

  const bootstrap = repository.migrate().catch((error) => {
    schemaBootstraps.delete(connectionString);
    throw error;
  });
  schemaBootstraps.set(connectionString, bootstrap);
  return bootstrap;
}

function ensureWorldReady(
  connectionString: string,
  repository: ApplicationWorldRepository,
  options: { seed: number; playerId: string; worldName: string },
): Promise<string> {
  const key = `${connectionString}\u0000${options.seed}\u0000${options.worldName}`;
  const existing = worldBootstraps.get(key);
  if (existing) return existing;

  const bootstrap = ensureAlphaWorld(repository, options).catch((error) => {
    worldBootstraps.delete(key);
    throw error;
  });
  worldBootstraps.set(key, bootstrap);
  return bootstrap;
}

export async function withAlphaServerContext<TResult>(
  action: (context: AlphaServerContext) => Promise<TResult>,
  options: AlphaServerContextOptions = {},
): Promise<TResult> {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is required to run the PPW Alpha web app");

  const playerId = (process.env.PPW_ALPHA_PLAYER_ID ?? "alpha-player-1").trim();
  if (!playerId) throw new Error("PPW_ALPHA_PLAYER_ID must not be empty");
  const seed = integerEnvironment("PPW_ALPHA_WORLD_SEED", 20261002);
  const worldName = process.env.PPW_ALPHA_WORLD_NAME?.trim() || "PPW Alpha World";

  const { repository, close } = createPostgresApplicationWorldRepository(connectionString);
  try {
    await ensureSchemaReady(connectionString, repository);
    const worldId = await ensureWorldReady(connectionString, repository, { seed, playerId, worldName });

    if (options.trackPlayerActivity !== false) {
      await repository.transact(worldId, null, (aggregate) => {
        const engagement = aggregate.engagement ?? createWorldEngagementState(worldId);
        aggregate.engagement = engagement;
        recordPlayerActivity(
          engagement,
          playerId,
          aggregate.state.world.currentDate,
          aggregate.runtime.revision,
          currentUtcCycleKey(),
        );
      });
    }

    return await action({ repository, worldId, playerId });
  } finally {
    await close();
  }
}
