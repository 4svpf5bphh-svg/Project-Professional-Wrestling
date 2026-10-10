import { NextRequest, NextResponse } from "next/server";
import { respondAlphaBackstage } from "../../../../../../dist/packages/web-adapter/src/backstage-service.js";
import type { BackstageResponse } from "../../../../../../dist/packages/application/src/engagement.js";
import { withAlphaServerContext } from "../../../../../../dist/packages/web-adapter/src/server-world.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function requiredText(value: unknown, label: string, max: number): string {
  if (typeof value !== "string" || !value.trim() || value.trim().length > max) throw new Error(label + " is invalid");
  return value.trim();
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json() as Record<string, unknown>;
    const response = requiredText(body.response, "response", 32);
    if (!["HEAR_OUT", "EXPLAIN_PLAN", "STAND_FIRM", "PROMISE_FEATURED_BOOKING", "CONSIDER_TAG_TEAM", "PASS_TAG_TEAM"].includes(response)) throw new Error("unsupported Backstage response");
    const result = await withAlphaServerContext(({ repository, worldId, playerId }) => (
      respondAlphaBackstage(repository, worldId, playerId, {
        requestId: requiredText(body.requestId, "requestId", 256),
        conversationId: requiredText(body.conversationId, "conversationId", 240),
        response: response as BackstageResponse,
      })
    ));
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to respond Backstage";
    return NextResponse.json({ error: message }, { status: message.includes("DATABASE_URL") ? 500 : 409 });
  }
}
