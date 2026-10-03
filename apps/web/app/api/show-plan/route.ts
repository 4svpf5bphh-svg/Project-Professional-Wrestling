import { NextRequest, NextResponse } from "next/server";
import type { TicketStrategy } from "../../../../../dist/packages/domain/src/types.js";
import { saveAlphaCurrentWeekShowPlan } from "../../../../../dist/packages/web-adapter/src/alpha-service.js";
import { withAlphaServerContext } from "../../../../../dist/packages/web-adapter/src/server-world.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ShowPlanBody = {
  requestId?: unknown;
  expectedRevision?: unknown;
  expectedPlanVersion?: unknown;
  day?: unknown;
  marketId?: unknown;
  venueId?: unknown;
  ticketStrategy?: unknown;
  participantIds?: unknown;
};

const TICKET_STRATEGIES = new Set<TicketStrategy>(["ACCESSIBLE", "STANDARD", "PREMIUM", "PRESTIGE"]);

function requiredText(value: unknown, label: string, maxLength: number): string {
  if (typeof value !== "string") throw new Error(`${label} must be a string`);
  const normalized = value.trim();
  if (!normalized) throw new Error(`${label} must not be empty`);
  if (normalized.length > maxLength) throw new Error(`${label} is too long`);
  return normalized;
}

function nonNegativeInteger(value: unknown, label: string): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) {
    throw new Error(`${label} must be a non-negative integer`);
  }
  return value;
}

function showDay(value: unknown): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 1 || value > 7) {
    throw new Error("day must be an integer from 1 to 7");
  }
  return value;
}

function participantIds(value: unknown): string[] {
  if (!Array.isArray(value)) throw new Error("participantIds must be an array");
  return value.map((entry, index) => requiredText(entry, `participantIds[${index}]`, 128));
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json() as ShowPlanBody;
    const requestId = requiredText(body.requestId, "requestId", 220);
    const marketId = requiredText(body.marketId, "marketId", 128);
    const venueId = requiredText(body.venueId, "venueId", 128);
    const ticketStrategy = requiredText(body.ticketStrategy, "ticketStrategy", 32) as TicketStrategy;
    if (!TICKET_STRATEGIES.has(ticketStrategy)) throw new Error("unsupported ticket strategy");

    const view = await withAlphaServerContext(({ repository, worldId, playerId }) => (
      saveAlphaCurrentWeekShowPlan(repository, worldId, playerId, {
        requestId,
        expectedRevision: nonNegativeInteger(body.expectedRevision, "expectedRevision"),
        expectedPlanVersion: nonNegativeInteger(body.expectedPlanVersion, "expectedPlanVersion"),
        day: showDay(body.day),
        marketId,
        venueId,
        ticketStrategy,
        participantIds: participantIds(body.participantIds),
      })
    ));
    return NextResponse.json(view, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to save show plan";
    const status = message.includes("DATABASE_URL") ? 500 : 409;
    return NextResponse.json({ error: message }, { status });
  }
}
