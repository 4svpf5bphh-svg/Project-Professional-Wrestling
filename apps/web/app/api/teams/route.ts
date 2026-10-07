import { NextRequest, NextResponse } from "next/server";
import {
  createAlphaTagTeam,
  loadAlphaTeamHistory,
} from "../../../../../dist/packages/web-adapter/src/team-history-service.js";
import { withAlphaServerContext } from "../../../../../dist/packages/web-adapter/src/server-world.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(): Promise<NextResponse> {
  try {
    const view = await withAlphaServerContext(({ repository, worldId, playerId }) => (
      loadAlphaTeamHistory(repository, worldId, playerId)
    ));
    return NextResponse.json(view, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load PPW team history";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}


type CreateTeamBody = {
  requestId?: unknown;
  expectedRevision?: unknown;
  name?: unknown;
  personIds?: unknown;
};

function requiredText(value: unknown, label: string, maxLength: number): string {
  if (typeof value !== "string") throw new Error(`${label} must be a string`);
  const normalized = value.trim();
  if (!normalized) throw new Error(`${label} must not be empty`);
  if (normalized.length > maxLength) throw new Error(`${label} is too long`);
  return normalized;
}

function revision(value: unknown): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) {
    throw new Error("expectedRevision must be a non-negative integer");
  }
  return value;
}

function teamPersonIds(value: unknown): [string, string] {
  if (!Array.isArray(value) || value.length !== 2) throw new Error("personIds must contain exactly two wrestlers");
  return [
    requiredText(value[0], "personIds[0]", 128),
    requiredText(value[1], "personIds[1]", 128),
  ];
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json() as CreateTeamBody;
    const view = await withAlphaServerContext(({ repository, worldId, playerId }) => (
      createAlphaTagTeam(repository, worldId, playerId, {
        requestId: requiredText(body.requestId, "requestId", 220),
        expectedRevision: revision(body.expectedRevision),
        name: requiredText(body.name, "name", 60),
        personIds: teamPersonIds(body.personIds),
      })
    ));
    return NextResponse.json(view, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to create tag team";
    return NextResponse.json({ error: message }, { status: message.includes("DATABASE_URL") ? 500 : 409 });
  }
}
