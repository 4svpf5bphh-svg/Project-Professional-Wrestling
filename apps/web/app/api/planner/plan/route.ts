import { NextRequest, NextResponse } from "next/server";
import type { TicketStrategy } from "../../../../../../dist/packages/domain/src/types.js";
import { saveAlphaPlannerShowPlan } from "../../../../../../dist/packages/web-adapter/src/planner-service.js";
import { withAlphaServerContext } from "../../../../../../dist/packages/web-adapter/src/server-world.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type PlannerPlanBody = {
  requestId?: unknown;
  expectedRevision?: unknown;
  expectedPlanVersion?: unknown;
  year?: unknown;
  week?: unknown;
  day?: unknown;
  marketId?: unknown;
  venueId?: unknown;
  ticketStrategy?: unknown;
  showSeriesId?: unknown;
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

function positiveInteger(value: unknown, label: string): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 1) {
    throw new Error(`${label} must be a positive integer`);
  }
  return value;
}

function showDay(value: unknown): number {
  const day = positiveInteger(value, "day");
  if (day > 7) throw new Error("day must be an integer from 1 to 7");
  return day;
}

function participantIds(value: unknown): string[] {
  if (!Array.isArray(value)) throw new Error("participantIds must be an array");
  return value.map((entry, index) => requiredText(entry, `participantIds[${index}]`, 128));
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json() as PlannerPlanBody;
    const ticketStrategy = requiredText(body.ticketStrategy, "ticketStrategy", 32) as TicketStrategy;
    if (!TICKET_STRATEGIES.has(ticketStrategy)) throw new Error("unsupported ticket strategy");

    const view = await withAlphaServerContext(({ repository, worldId, playerId }) => (
      saveAlphaPlannerShowPlan(repository, worldId, playerId, {
        requestId: requiredText(body.requestId, "requestId", 220),
        expectedRevision: nonNegativeInteger(body.expectedRevision, "expectedRevision"),
        expectedPlanVersion: nonNegativeInteger(body.expectedPlanVersion, "expectedPlanVersion"),
        year: positiveInteger(body.year, "year"),
        week: positiveInteger(body.week, "week"),
        day: showDay(body.day),
        marketId: requiredText(body.marketId, "marketId", 128),
        venueId: requiredText(body.venueId, "venueId", 128),
        ticketStrategy,
        ...(body.showSeriesId === undefined || body.showSeriesId === null || body.showSeriesId === ""
          ? {}
          : { showSeriesId: requiredText(body.showSeriesId, "showSeriesId", 180) }),
        ...(body.participantIds === undefined ? {} : { participantIds: participantIds(body.participantIds) }),
      })
    ));
    return NextResponse.json(view, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to save planner show";
    const status = message.includes("DATABASE_URL") ? 500 : 409;
    return NextResponse.json({ error: message }, { status });
  }
}
