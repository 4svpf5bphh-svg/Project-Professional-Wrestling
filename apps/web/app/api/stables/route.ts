import { NextRequest, NextResponse } from "next/server";
import {
  loadAlphaStableRoster, mutateAlphaStable,
  type AlphaStableMutationRequest,
} from "../../../../../dist/packages/web-adapter/src/stable-service.js";
import { withAlphaServerContext } from "../../../../../dist/packages/web-adapter/src/server-world.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(): Promise<NextResponse> {
  try {
    const view = await withAlphaServerContext(({ repository, worldId, playerId }) =>
      loadAlphaStableRoster(repository, worldId, playerId));
    return NextResponse.json(view, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to load stables" }, { status: 500 });
  }
}

function requiredText(value: unknown, label: string, max: number): string {
  if (typeof value !== "string" || !value.trim() || value.trim().length > max)
    throw new Error(`${label} must contain 1–${max} characters`);
  return value.trim();
}
function revision(value: unknown): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) {
    throw new Error("expectedRevision must be a non-negative integer");
  }
  return value;
}
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json() as Record<string, unknown>;
    const common = {
      requestId: requiredText(body.requestId, "requestId", 220),
      expectedRevision: revision(body.expectedRevision),
    };
    let action: AlphaStableMutationRequest;
    if (body.action === "CREATE") {
      if (!Array.isArray(body.personIds) || body.personIds.length < 3 || body.personIds.length > 12)
        throw new Error("new stables require 3–12 wrestlers");
      action = {
        ...common, action: "CREATE",
        name: requiredText(body.name, "stable name", 60),
        personIds: body.personIds.map((id: unknown) => requiredText(id, "wrestler", 128)),
      };
    } else if (body.action === "ADD" || body.action === "REMOVE") {
      action = {
        ...common, action: body.action,
        stableId: requiredText(body.stableId, "stableId", 128),
        personId: requiredText(body.personId, "personId", 128),
      };
    } else if (body.action === "DISBAND") {
      action = { ...common, action: "DISBAND", stableId: requiredText(body.stableId, "stableId", 128) };
    } else {
      throw new Error("unsupported stable management action");
    }
    const view = await withAlphaServerContext(({ repository, worldId, playerId }) =>
      mutateAlphaStable(repository, worldId, playerId, action));
    return NextResponse.json(view, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to manage stables";
    return NextResponse.json({ error: message }, { status: message.includes("DATABASE_URL") ? 500 : 409 });
  }
}
