import { NextResponse } from "next/server";
import {
  loadAlphaWrestlerProfile,
  saveAlphaWrestlerCreative,
} from "../../../../../../dist/packages/web-adapter/src/wrestler-profile-service.js";
import type {
  WrestlerCreativeFields,
} from "../../../../../../dist/packages/application/src/wrestler-creative.js";
import { withAlphaServerContext } from "../../../../../../dist/packages/web-adapter/src/server-world.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<NextResponse> {
  try {
    const personId = new URL(request.url).searchParams.get("personId") ?? "";
    const view = await withAlphaServerContext(({ repository, worldId, playerId }) => (
      loadAlphaWrestlerProfile(repository, worldId, playerId, personId)
    ));
    return NextResponse.json(view, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load wrestler profile";
    const status = message.includes("unknown wrestler") || message.includes("personId") ? 400 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const body = await request.json() as Record<string, unknown>;
    if (typeof body.requestId !== "string" || !body.requestId.trim() || body.requestId.length > 220) {
      throw new Error("invalid requestId");
    }
    if (typeof body.expectedRevision !== "number" || !Number.isSafeInteger(body.expectedRevision)
      || body.expectedRevision < 0) throw new Error("invalid expectedRevision");
    if (typeof body.personId !== "string" || !body.personId.trim() || body.personId.length > 128) {
      throw new Error("invalid personId");
    }
    if (!body.fields || typeof body.fields !== "object" || Array.isArray(body.fields)) {
      throw new Error("creative fields must be an object");
    }
    const result = await withAlphaServerContext(({repository,worldId,playerId}) =>
      saveAlphaWrestlerCreative(repository,worldId,playerId,{
        requestId:body.requestId as string,
        expectedRevision:body.expectedRevision as number,
        personId:body.personId as string,
        fields:body.fields as unknown as WrestlerCreativeFields,
      }));
    return NextResponse.json(result,{headers:{"Cache-Control":"no-store"}});
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to update wrestler presentation";
    return NextResponse.json({error:message},{status:message.includes("DATABASE_URL") ? 500 : 409});
  }
}
