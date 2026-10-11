import { NextResponse } from "next/server";
import {
  submitAlphaDatesAddendum,
  type AlphaDatesAddendumRequest,
} from "../../../../../../dist/packages/web-adapter/src/talent-service.js";
import { withAlphaServerContext } from "../../../../../../dist/packages/web-adapter/src/server-world.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Non-exclusive date top-up. It never renews the agreement or alters exclusivity. */
export async function POST(request: Request): Promise<NextResponse> {
  try {
    const body = await request.json() as AlphaDatesAddendumRequest;
    const result = await withAlphaServerContext(({ repository, worldId, playerId }) => (
      submitAlphaDatesAddendum(repository, worldId, playerId, body)
    ));
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to negotiate additional dates";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
