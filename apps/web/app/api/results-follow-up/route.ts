import { NextRequest, NextResponse } from "next/server";
import { saveAlphaPostShowFollowUp } from "../../../../../dist/packages/web-adapter/src/results-overview-service.js";
import { withAlphaServerContext } from "../../../../../dist/packages/web-adapter/src/server-world.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = {
  requestId?: unknown; expectedRevision?: unknown; promotionId?: unknown;
  eventId?: unknown; matchId?: unknown; programmeId?: unknown; choice?: unknown;
};

function requiredText(value: unknown, label: string, max = 220): string {
  if (typeof value !== "string" || !value.trim() || value.length > max) {
    throw new Error(`${label} must be a non-empty string of up to ${max} characters`);
  }
  return value.trim();
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json() as Body;
    if (typeof body.expectedRevision !== "number" || !Number.isSafeInteger(body.expectedRevision)
      || body.expectedRevision < 0) throw new Error("expectedRevision must be a non-negative integer");
    if (body.choice !== "PURSUE_REMATCH" && body.choice !== "PLAN_RETALIATION" && body.choice !== "LET_STAND") {
      throw new Error("unsupported follow-up choice");
    }
    const view = await withAlphaServerContext(({ repository, worldId, playerId }) => (
      saveAlphaPostShowFollowUp(repository, worldId, playerId, {
        requestId: requiredText(body.requestId, "requestId"),
        expectedRevision: body.expectedRevision as number,
        promotionId: requiredText(body.promotionId, "promotionId", 128),
        eventId: requiredText(body.eventId, "eventId", 128),
        matchId: requiredText(body.matchId, "matchId", 128),
        programmeId: requiredText(body.programmeId, "programmeId", 128),
        choice: body.choice as "PURSUE_REMATCH" | "PLAN_RETALIATION" | "LET_STAND",
      })
    ));
    return NextResponse.json(view, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : "Unable to save Programme follow-up",
    }, { status: 409 });
  }
}
