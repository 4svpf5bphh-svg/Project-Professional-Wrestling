import { NextRequest, NextResponse } from "next/server";
import { dismissAlphaAttention } from "../../../../../../../dist/packages/web-adapter/src/alpha-service.js";
import { withAlphaServerContext } from "../../../../../../../dist/packages/web-adapter/src/server-world.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type DismissAttentionBody = {
  attentionId?: unknown;
};

function requiredText(value: unknown, label: string, maxLength: number): string {
  if (typeof value !== "string") throw new Error(`${label} must be a string`);
  const normalized = value.trim();
  if (!normalized) throw new Error(`${label} must not be empty`);
  if (normalized.length > maxLength) throw new Error(`${label} is too long`);
  return normalized;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json() as DismissAttentionBody;
    const attentionId = requiredText(body.attentionId, "attentionId", 240);
    const view = await withAlphaServerContext(({ repository, worldId, playerId }) => (
      dismissAlphaAttention(repository, worldId, playerId, { attentionId })
    ));
    return NextResponse.json(view, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to dismiss Attention item";
    const status = message.includes("DATABASE_URL") ? 500 : 409;
    return NextResponse.json({ error: message }, { status });
  }
}
