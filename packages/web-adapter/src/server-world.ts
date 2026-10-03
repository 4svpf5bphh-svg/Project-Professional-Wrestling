import type { ApplicationWorldRepository } from "../../application/src/world-aggregate.js";
import { createPostgresApplicationWorldRepository } from "../../persistence/src/postgres-world-repository.js";
import { ensureAlphaWorld } from "./alpha-service.js";

export interface AlphaServerContext {
  repository: ApplicationWorldRepository;
  worldId: string;
  playerId: string;
}

function integerEnvironment(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number(raw);
  if (!Number.isSafeInteger(parsed)) throw new Error(`${name} must be an integer`);
  return parsed;
}

export async function withAlphaServerContext<TResult>(
  action: (context: AlphaServerContext) => Promise<TResult>,
): Promise<TResult> {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is required to run the PPW Alpha web app");

  const playerId = (process.env.PPW_ALPHA_PLAYER_ID ?? "alpha-player-1").trim();
  if (!playerId) throw new Error("PPW_ALPHA_PLAYER_ID must not be empty");
  const seed = integerEnvironment("PPW_ALPHA_WORLD_SEED", 20261002);
  const worldName = process.env.PPW_ALPHA_WORLD_NAME?.trim() || "PPW Alpha World";

  const { repository, close } = createPostgresApplicationWorldRepository(connectionString);
  try {
    await repository.migrate();
    const worldId = await ensureAlphaWorld(repository, { seed, playerId, worldName });
    return await action({ repository, worldId, playerId });
  } finally {
    await close();
  }
}
