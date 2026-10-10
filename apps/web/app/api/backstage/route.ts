import { NextResponse } from "next/server";
import { loadAlphaBackstage } from "../../../../../dist/packages/web-adapter/src/backstage-service.js";
import { withAlphaServerContext } from "../../../../../dist/packages/web-adapter/src/server-world.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(): Promise<NextResponse> {
  try {
    const view = await withAlphaServerContext(({ repository, worldId, playerId }) => (
      loadAlphaBackstage(repository, worldId, playerId)
    ));
    return NextResponse.json(view, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load Backstage";
    return NextResponse.json({ error: message }, { status: message.includes("DATABASE_URL") ? 500 : 403 });
  }
}
