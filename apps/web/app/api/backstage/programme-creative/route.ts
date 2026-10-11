import { NextRequest, NextResponse } from "next/server";
import { discussAlphaBackstageProgrammeCreative } from "../../../../../../dist/packages/web-adapter/src/backstage-service.js";
import { withAlphaServerContext } from "../../../../../../dist/packages/web-adapter/src/server-world.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function textField(value: unknown, label: string, max = 220): string {
  if (typeof value !== "string" || value.trim().length === 0 || value.trim().length > max) {
    throw new Error(`${label} must be nonempty text of at most ${max} characters`);
  }
  return value.trim();
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const raw = await request.json() as Record<string, unknown>;
    const matchType = textField(raw.matchType, "matchType", 16);
    const permittedOutcome = textField(raw.permittedOutcome, "permittedOutcome", 40);
    if (matchType !== "SINGLES" && matchType !== "TAG") throw new Error("unsupported match type");
    if (permittedOutcome !== "WIN_ONLY" && permittedOutcome !== "WIN_OR_PROTECTED_LOSS") {
      throw new Error("unsupported Programme creative finish scope");
    }
    if (typeof raw.termWeeks !== "number" || !Number.isSafeInteger(raw.termWeeks)
      || raw.termWeeks < 1 || raw.termWeeks > 6) {
      throw new Error("termWeeks must be between 1 and 6 PPW weeks");
    }
    const view = await withAlphaServerContext(({ repository, worldId, playerId }) =>
      discussAlphaBackstageProgrammeCreative(repository, worldId, playerId, {
        requestId: textField(raw.requestId, "requestId"),
        programmeId: textField(raw.programmeId, "programmeId", 128),
        personId: textField(raw.personId, "personId", 128),
        matchType, permittedOutcome, termWeeks: raw.termWeeks as number,
      }));
    return NextResponse.json(view, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to discuss Programme terms";
    return NextResponse.json({ error: message }, { status: message.includes("DATABASE_URL") ? 500 : 409 });
  }
}
