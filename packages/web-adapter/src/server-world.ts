import type { ApplicationWorldRepository } from "../../application/src/index.js";
import { utcScheduledCycleKey } from "../../application/src/schedule-clock.js";
import {
  createPostgresServerWorldAccess,
  type PostgresServerWorldAccess,
} from "../../persistence/src/postgres-server-world-access.js";
import { alphaWorldId, ensureAlphaWorld } from "./alpha-service.js";

/**
 * Increment whenever existing Worlds require a new startup compatibility
 * repair. A version is only persisted AFTER every repair succeeds.
 */
const SERVER_BOOTSTRAP_REPAIR_VERSION = 1;

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
const serverWorldAccesses = new Map<string, PostgresServerWorldAccess>();

function integerEnvironment(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number(raw);
  if (!Number.isSafeInteger(parsed)) throw new Error(`${name} must be an integer`);
  return parsed;
}

function serverWorldAccess(connectionString: string): {
  access: PostgresServerWorldAccess;
  reused: boolean;
} {
  const existing = serverWorldAccesses.get(connectionString);
  if (existing) return { access: existing, reused: true };
  const created = createPostgresServerWorldAccess(connectionString);
  serverWorldAccesses.set(connectionString, created);
  return { access: created, reused: false };
}

function ensureSchemaReady(
  connectionString: string,
  repository: PostgresServerWorldAccess["repository"],
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
  access: PostgresServerWorldAccess,
  options: { seed: number; playerId: string; worldName: string },
): Promise<string> {
  const key = `${connectionString}\u0000${options.seed}\u0000${options.worldName}`;
  const existing = worldBootstraps.get(key);
  if (existing) return existing;

  const bootstrap = (async () => {
    const candidate = alphaWorldId(options.seed);
    if (await access.bootstrapVerified(candidate, SERVER_BOOTSTRAP_REPAIR_VERSION)) return candidate;
    const worldId = await ensureAlphaWorld(access.repository, options);
    await access.markBootstrapVerified(worldId, SERVER_BOOTSTRAP_REPAIR_VERSION);
    return worldId;
  })().catch(error => {
    worldBootstraps.delete(key);
    throw error;
  });
  worldBootstraps.set(key, bootstrap);
  return bootstrap;
}

function roundedMs(value: number): number {
  return Math.round(value * 10) / 10;
}

function logPerformance(input: {
  totalMs: number;
  bootstrapMs: number;
  activityMs: number;
  actionMs: number;
  repositoryReused: boolean;
  trackedActivity: boolean;
  outcome: "ok" | "error";
}): void {
  if (process.env.PPW_PERF_LOGS === "0") return;
  const threshold = integerEnvironment("PPW_PERF_LOG_THRESHOLD_MS", 100);
  if (input.totalMs < threshold) return;
  console.info("[ppw-perf]", JSON.stringify({
    totalMs: roundedMs(input.totalMs),
    bootstrapMs: roundedMs(input.bootstrapMs),
    activityMs: roundedMs(input.activityMs),
    actionMs: roundedMs(input.actionMs),
    repositoryReused: input.repositoryReused,
    trackedActivity: input.trackedActivity,
    outcome: input.outcome,
  }));
}

export async function withAlphaServerContext<TResult>(
  action: (context: AlphaServerContext) => Promise<TResult>,
  options: AlphaServerContextOptions = {},
): Promise<TResult> {
  const startedAt = performance.now();
  let bootstrapMs = 0;
  let activityMs = 0;
  let actionMs = 0;
  let repositoryReused = false;
  let outcome: "ok" | "error" = "ok";
  const trackPlayerActivity = options.trackPlayerActivity !== false;

  try {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) throw new Error("DATABASE_URL is required to run the PPW Alpha web app");

    const playerId = (process.env.PPW_ALPHA_PLAYER_ID ?? "alpha-player-1").trim();
    if (!playerId) throw new Error("PPW_ALPHA_PLAYER_ID must not be empty");
    const seed = integerEnvironment("PPW_ALPHA_WORLD_SEED", 20261002);
    const worldName = process.env.PPW_ALPHA_WORLD_NAME?.trim() || "PPW Alpha World";

    const accessState = serverWorldAccess(connectionString);
    repositoryReused = accessState.reused;
    const { access } = accessState;

    const bootstrapStartedAt = performance.now();
    await ensureSchemaReady(connectionString, access.repository);
    const worldId = await ensureWorldReady(connectionString, access, { seed, playerId, worldName });
    bootstrapMs = performance.now() - bootstrapStartedAt;

    if (trackPlayerActivity) {
      const activityStartedAt = performance.now();
      await access.recordPlayerActivity(worldId, playerId, utcScheduledCycleKey());
      activityMs = performance.now() - activityStartedAt;
    }

    const actionStartedAt = performance.now();
    const result = await action({ repository: access.repository, worldId, playerId });
    actionMs = performance.now() - actionStartedAt;
    return result;
  } catch (error) {
    outcome = "error";
    throw error;
  } finally {
    logPerformance({
      totalMs: performance.now() - startedAt,
      bootstrapMs,
      activityMs,
      actionMs,
      repositoryReused,
      trackedActivity: trackPlayerActivity,
      outcome,
    });
  }
}
