import { NextResponse } from "next/server";
import { loadAlphaPlayerSession } from "../../../lib/alpha-service";
import { withAlphaServerContext } from "../../../lib/server-world";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(): Promise<NextResponse> {
  try {
    const view = await withAlphaServerContext(({ repository, worldId, playerId }) => (
      loadAlphaPlayerSession(repository, worldId, playerId)
    ));
    return NextResponse.json(view, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load PPW Alpha session";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
