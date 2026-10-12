import { NextResponse } from "next/server";
import {
  loadAlphaStaff,
  hireAlphaTalentManager,
  releaseAlphaTalentManager,
  authoriseAlphaTalentManagerRenewal,
  type StaffActionRequest,
} from "../../../../../dist/packages/web-adapter/src/staff-service.js";
import { withAlphaServerContext } from "../../../../../dist/packages/web-adapter/src/server-world.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(): Promise<NextResponse> {
  try {
    const result = await withAlphaServerContext(({ repository, worldId, playerId }) =>
      loadAlphaStaff(repository, worldId, playerId));
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not load staff" }, { status: 500 });
  }
}

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const body = await request.json() as StaffActionRequest;
    const result = await withAlphaServerContext(({ repository, worldId, playerId }) =>
      hireAlphaTalentManager(repository, worldId, playerId, body));
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not hire Talent Manager" }, { status: 400 });
  }
}

export async function DELETE(request: Request): Promise<NextResponse> {
  try {
    const body = await request.json() as StaffActionRequest;
    const result = await withAlphaServerContext(({ repository, worldId, playerId }) =>
      releaseAlphaTalentManager(repository, worldId, playerId, body));
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not release Talent Manager" }, { status: 400 });
  }
}

export async function PATCH(request: Request): Promise<NextResponse> {
  try {
    const body = await request.json() as StaffActionRequest;
    const result = await withAlphaServerContext(({ repository, worldId, playerId }) =>
      authoriseAlphaTalentManagerRenewal(repository, worldId, playerId, body));
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not authorise renewal" }, { status: 400 });
  }
}
