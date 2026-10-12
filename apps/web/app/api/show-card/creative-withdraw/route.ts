import { NextResponse } from "next/server";
import {
  withdrawAlphaShowCreativeAmendment,
  type AlphaWithdrawCreativeCardRequest,
} from "../../../../../../dist/packages/web-adapter/src/card-service.js";
import { withAlphaServerContext } from "../../../../../../dist/packages/web-adapter/src/server-world.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function textField(value: unknown, label: string, maxLength = 128): string {
  if (typeof value !== "string" || value.trim().length === 0 || value.trim().length > maxLength) {
    throw new Error(`${label} must be nonempty text, no more than ${maxLength} characters`);
  }
  return value.trim();
}

function integerField(value: unknown, label: string): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) {
    throw new Error(`${label} must be a nonnegative integer`);
  }
  return value;
}

/** Recover the previous committed card without changing any actual show match. */
export async function POST(request: Request): Promise<NextResponse> {
  try {
    const raw = await request.json() as Record<string, unknown>;
    const body: AlphaWithdrawCreativeCardRequest = {
      requestId: textField(raw.requestId, "requestId", 220),
      expectedRevision: integerField(raw.expectedRevision, "expectedRevision"),
      expectedPlanVersion: integerField(raw.expectedPlanVersion, "expectedPlanVersion"),
      draftId: textField(raw.draftId, "draftId"),
    };
    const result = await withAlphaServerContext(({ repository, worldId, playerId }) =>
      withdrawAlphaShowCreativeAmendment(repository, worldId, playerId, body));
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to withdraw the creative amendment";
    return NextResponse.json({ error: message }, { status: 409 });
  }
}
