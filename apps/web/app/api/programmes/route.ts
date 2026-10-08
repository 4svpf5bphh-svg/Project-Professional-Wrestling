import { NextRequest, NextResponse } from "next/server";
import {
  loadAlphaProgrammeContext,
  setAlphaProgrammeSegment,
  startAlphaProgramme,
} from "../../../../../dist/packages/web-adapter/src/programme-service.js";
import { withAlphaServerContext } from "../../../../../dist/packages/web-adapter/src/server-world.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ProgrammeBody = {
  requestId?: unknown;
  expectedRevision?: unknown;
  expectedPlanVersion?: unknown;
  draftId?: unknown;
  sideAIds?: unknown;
  sideBIds?: unknown;
  championshipId?: unknown;
  programmeId?: unknown;
  enabled?: unknown;
};

function requiredText(value: unknown, label: string, maxLength: number): string {
  if (typeof value !== "string") throw new Error(`${label} must be a string`);
  const normalized = value.trim();
  if (!normalized) throw new Error(`${label} must not be empty`);
  if (normalized.length > maxLength) throw new Error(`${label} is too long`);
  return normalized;
}

function optionalText(value: unknown, label: string, maxLength: number): string | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  return requiredText(value, label, maxLength);
}

function nullableText(value: unknown, label: string, maxLength: number): string | null {
  if (value === undefined || value === null || value === "") return null;
  return requiredText(value, label, maxLength);
}

function ids(value: unknown, label: string): string[] {
  if (!Array.isArray(value)) throw new Error(`${label} must be an array`);
  return value.map((entry, index) => requiredText(entry, `${label}[${index}]`, 128));
}

function nonNegativeInteger(value: unknown, label: string): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) {
    throw new Error(`${label} must be a non-negative integer`);
  }
  return value;
}

function booleanValue(value: unknown, label: string): boolean {
  if (typeof value !== "boolean") throw new Error(`${label} must be a boolean`);
  return value;
}

function errorResponse(error: unknown, fallback: string): NextResponse {
  const message = error instanceof Error ? error.message : fallback;
  const status = message.includes("DATABASE_URL") ? 500 : 409;
  return NextResponse.json({ error: message }, { status });
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const draftId = optionalText(request.nextUrl.searchParams.get("draftId"), "draftId", 128);
    const view = await withAlphaServerContext(({ repository, worldId, playerId }) => (
      loadAlphaProgrammeContext(repository, worldId, playerId, draftId)
    ));
    return NextResponse.json(view, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return errorResponse(error, "Unable to load Programmes");
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json() as ProgrammeBody;
    const view = await withAlphaServerContext(({ repository, worldId, playerId }) => (
      startAlphaProgramme(repository, worldId, playerId, {
        requestId: requiredText(body.requestId, "requestId", 220),
        expectedRevision: nonNegativeInteger(body.expectedRevision, "expectedRevision"),
        draftId: optionalText(body.draftId, "draftId", 128),
        sideAIds: ids(body.sideAIds, "sideAIds"),
        sideBIds: ids(body.sideBIds, "sideBIds"),
        championshipId: nullableText(body.championshipId, "championshipId", 128),
      })
    ));
    return NextResponse.json(view, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return errorResponse(error, "Unable to start Programme");
  }
}

export async function PUT(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json() as ProgrammeBody;
    const view = await withAlphaServerContext(({ repository, worldId, playerId }) => (
      setAlphaProgrammeSegment(repository, worldId, playerId, {
        requestId: requiredText(body.requestId, "requestId", 220),
        expectedRevision: nonNegativeInteger(body.expectedRevision, "expectedRevision"),
        expectedPlanVersion: nonNegativeInteger(body.expectedPlanVersion, "expectedPlanVersion"),
        draftId: optionalText(body.draftId, "draftId", 128),
        programmeId: requiredText(body.programmeId, "programmeId", 128),
        enabled: booleanValue(body.enabled, "enabled"),
      })
    ));
    return NextResponse.json(view, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return errorResponse(error, "Unable to update Programme segment");
  }
}
