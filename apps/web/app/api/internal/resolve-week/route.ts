import { NextResponse } from "next/server";
import { resolveScheduledWorldCycle, utcScheduledCycleKey } from "../../../../../../dist/packages/application/src/index.js";
import { withAlphaServerContext } from "../../../../../../dist/packages/web-adapter/src/server-world.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<NextResponse> {
  const cronSecret = process.env.CRON_SECRET;
  const authorization = request.headers.get("authorization");
  if (!cronSecret || authorization !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await withAlphaServerContext(
      ({ repository, worldId }) => resolveScheduledWorldCycle(repository, worldId, utcScheduledCycleKey()),
      { trackPlayerActivity: false },
    );
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to resolve scheduled PPW week";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
