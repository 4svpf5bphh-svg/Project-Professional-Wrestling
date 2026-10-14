import { gunzipSync, gzipSync } from "node:zlib";

/**
 * Network transport copy of authoritative JSONB World state.
 * JSONB is retained for migrations, diagnostics, and rollback. Never update
 * the compressed representation without updating the JSONB in the SAME
 * authoritative transaction.
 */
export function compressWorldSnapshot(world: unknown): Buffer {
  return gzipSync(Buffer.from(JSON.stringify(world), "utf8"), { level: 1 });
}

export function restoreCompressedWorldSnapshot(bytes: Uint8Array): unknown {
  // gzip CRC detects corrupted compressed snapshots. Fail closed rather than
  // loading a potentially incomplete or stale simulation state.
  return JSON.parse(gunzipSync(Buffer.from(bytes)).toString("utf8")) as unknown;
}
