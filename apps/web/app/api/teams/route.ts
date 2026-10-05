import { NextResponse } from "next/server";
import { loadAlphaTeamHistory } from "../../../../../dist/packages/web-adapter/src/team-history-service.js";
import { withAlphaServerContext } from "../../../../../dist/packages/web-adapter/src/server-world.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(): Promise<NextResponse> {
  try {
    const view = await withAlphaServerContext(({ repository, worldId, playerId }) => (
      loadAlphaTeamHistory(repository, worldId, playerId)
    ));
    return NextResponse.json(view, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load PPW team history";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
