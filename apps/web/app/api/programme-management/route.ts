import { NextRequest, NextResponse } from "next/server";
import {
  loadAlphaProgrammeManagement,
  startAlphaManagedProgramme,
} from "../../../../../dist/packages/web-adapter/src/programme-management-service.js";
import { withAlphaServerContext } from "../../../../../dist/packages/web-adapter/src/server-world.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = {
  requestId?: unknown;
  expectedRevision?: unknown;
  sideAIds?: unknown;
  sideBIds?: unknown;
  championshipId?: unknown;
};

function textValue(value: unknown, label: string, max = 220): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${label} must be a non-empty string`);
  const normalized = value.trim();
  if (normalized.length > max) throw new Error(`${label} is too long`);
  return normalized;
}

function ids(value: unknown, label: string): string[] {
  if (!Array.isArray(value)) throw new Error(`${label} must be an array`);
  return value.map((entry, index) => textValue(entry, `${label}[${index}]`, 128));
}

function revision(value: unknown): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) {
    throw new Error("expectedRevision must be a non-negative integer");
  }
  return value;
}

function errorResponse(error: unknown): NextResponse {
  const message = error instanceof Error ? error.message : "Unable to manage Programmes";
  return NextResponse.json({ error: message }, { status: message.includes("DATABASE_URL") ? 500 : 409 });
}

export async function GET(): Promise<NextResponse> {
  try {
    const view = await withAlphaServerContext(({ repository, worldId, playerId }) => (
      loadAlphaProgrammeManagement(repository, worldId, playerId)
    ));
    return NextResponse.json(view, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json() as Body;
    const view = await withAlphaServerContext(({ repository, worldId, playerId }) => (
      startAlphaManagedProgramme(repository, worldId, playerId, {
        requestId: textValue(body.requestId, "requestId"),
        expectedRevision: revision(body.expectedRevision),
        sideAIds: ids(body.sideAIds, "sideAIds"),
        sideBIds: ids(body.sideBIds, "sideBIds"),
        championshipId: body.championshipId === undefined || body.championshipId === null || body.championshipId === ""
          ? null
          : textValue(body.championshipId, "championshipId", 128),
      })
    ));
    return NextResponse.json(view, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return errorResponse(error);
  }
}
