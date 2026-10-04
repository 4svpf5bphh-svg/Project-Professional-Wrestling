import { NextResponse } from "next/server";
import { loadAlphaWrestlerProfile } from "../../../../../../dist/packages/web-adapter/src/wrestler-profile-service.js";
import { withAlphaServerContext } from "../../../../../../dist/packages/web-adapter/src/server-world.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<NextResponse> {
  try {
    const personId = new URL(request.url).searchParams.get("personId") ?? "";
    const view = await withAlphaServerContext(({ repository, worldId, playerId }) => (
      loadAlphaWrestlerProfile(repository, worldId, playerId, personId)
    ));
    return NextResponse.json(view, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load wrestler profile";
    const status = message.includes("unknown wrestler") || message.includes("personId") ? 400 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
