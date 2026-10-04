import { NextResponse } from "next/server";
import {
  loadAlphaTalentSession,
  submitAlphaTalentOffer,
  type AlphaTalentOfferRequest,
} from "../../../../../dist/packages/web-adapter/src/talent-service.js";
import { withAlphaServerContext } from "../../../../../dist/packages/web-adapter/src/server-world.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(): Promise<NextResponse> {
  try {
    const view = await withAlphaServerContext(({ repository, worldId, playerId }) => (
      loadAlphaTalentSession(repository, worldId, playerId)
    ));
    return NextResponse.json(view, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load PPW talent management";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const body = await request.json() as AlphaTalentOfferRequest;
    const result = await withAlphaServerContext(({ repository, worldId, playerId }) => (
      submitAlphaTalentOffer(repository, worldId, playerId, body)
    ));
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to submit PPW contract offer";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
