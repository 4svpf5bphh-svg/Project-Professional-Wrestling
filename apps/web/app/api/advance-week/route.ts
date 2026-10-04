import { NextResponse } from "next/server";
import { advanceAlphaWorldWeek } from "../../../../../dist/packages/web-adapter/src/alpha-service.js";
import { withAlphaServerContext } from "../../../../../dist/packages/web-adapter/src/server-world.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface AdvanceWeekBody {
  expectedRevision?: number;
}

function statusForError(message: string): number {
  if (
    message.includes("stale World revision")
    || message.includes("must control a promotion")
    || message.includes("is resolving")
    || message.includes("cannot")
  ) return 409;
  return 500;
}

export async function POST(request: Request): Promise<NextResponse> {
  if (process.env.PPW_ENABLE_MANUAL_WEEK_ADVANCE !== "1") {
    return NextResponse.json(
      { error: "World progression is server-scheduled; manual week advancement is disabled" },
      { status: 403 },
    );
  }

  let body: AdvanceWeekBody;
  try {
    body = await request.json() as AdvanceWeekBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!Number.isSafeInteger(body.expectedRevision) || (body.expectedRevision ?? -1) < 0) {
    return NextResponse.json({ error: "expectedRevision must be a non-negative integer" }, { status: 400 });
  }

  try {
    const view = await withAlphaServerContext(({ repository, worldId, playerId }) => (
      advanceAlphaWorldWeek(repository, worldId, playerId, {
        expectedRevision: body.expectedRevision!,
      })
    ));
    return NextResponse.json(view, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to finish PPW week";
    return NextResponse.json({ error: message }, { status: statusForError(message) });
  }
}
