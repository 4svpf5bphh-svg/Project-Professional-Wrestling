import { NextResponse } from "next/server";
import {
  requestAlphaShowCreativeConsent,
  type AlphaCreativeConsentRequest,
} from "../../../../../../dist/packages/web-adapter/src/card-service.js";
import { withAlphaServerContext } from "../../../../../../dist/packages/web-adapter/src/server-world.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function stringField(value: unknown, name: string, max = 128): string {
  if (typeof value !== "string" || value.trim().length === 0 || value.trim().length > max) {
    throw new Error(`${name} must be non-empty text (maximum ${max} characters)`);
  }
  return value.trim();
}

function nonnegativeInteger(value: unknown, name: string): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) {
    throw new Error(`${name} must be a non-negative integer`);
  }
  return value;
}

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const raw = await request.json() as Record<string, unknown>;
    const body: AlphaCreativeConsentRequest = {
      requestId: stringField(raw.requestId, "requestId", 220),
      expectedRevision: nonnegativeInteger(raw.expectedRevision, "expectedRevision"),
      expectedPlanVersion: nonnegativeInteger(raw.expectedPlanVersion, "expectedPlanVersion"),
      draftId: stringField(raw.draftId, "draftId"),
      draftMatchId: stringField(raw.draftMatchId, "draftMatchId"),
      personId: stringField(raw.personId, "personId"),
    };
    const view = await withAlphaServerContext(({ repository, worldId, playerId }) =>
      requestAlphaShowCreativeConsent(repository, worldId, playerId, body));
    return NextResponse.json(view, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to request creative approval";
    return NextResponse.json({ error: message }, { status: 409 });
  }
}
