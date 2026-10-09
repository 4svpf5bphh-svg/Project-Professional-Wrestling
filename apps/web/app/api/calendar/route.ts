import { NextRequest, NextResponse } from "next/server";
import {
  archiveAlphaWorldCalendarSeries,
  loadAlphaWorldCalendar,
  saveAlphaWorldCalendarSeries,
} from "../../../../../dist/packages/web-adapter/src/world-calendar-service.js";
import { withAlphaServerContext } from "../../../../../dist/packages/web-adapter/src/server-world.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = {
  action?: unknown;
  requestId?: unknown;
  expectedRevision?: unknown;
  showSeriesId?: unknown;
  name?: unknown;
  role?: unknown;
  eventType?: unknown;
  cadenceWeeks?: unknown;
  anchorWeek?: unknown;
  eventImportance?: unknown;
};

function textValue(value: unknown, label: string, max = 220): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${label} must be a non-empty string`);
  const normalized = value.trim();
  if (normalized.length > max) throw new Error(`${label} is too long`);
  return normalized;
}

function integer(value: unknown, label: string): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value)) throw new Error(`${label} must be a whole number`);
  return value;
}

function revision(value: unknown): number {
  const parsed = integer(value, "expectedRevision");
  if (parsed < 0) throw new Error("expectedRevision must be non-negative");
  return parsed;
}

function role(value: unknown): "FLAGSHIP" | "SECONDARY" | "DEVELOPMENTAL" | "SPECIAL" | "PREMIUM" {
  if (value === "FLAGSHIP" || value === "SECONDARY" || value === "DEVELOPMENTAL" || value === "SPECIAL" || value === "PREMIUM") return value;
  throw new Error("unsupported show role");
}

function eventType(value: unknown): "REGULAR" | "MAJOR" {
  if (value === "REGULAR" || value === "MAJOR") return value;
  throw new Error("unsupported event type");
}

function errorResponse(error: unknown): NextResponse {
  const message = error instanceof Error ? error.message : "Unable to manage PPW calendar";
  return NextResponse.json({ error: message }, { status: message.includes("DATABASE_URL") ? 500 : 409 });
}

export async function GET(): Promise<NextResponse> {
  try {
    const view = await withAlphaServerContext(({ repository, worldId, playerId }) => (
      loadAlphaWorldCalendar(repository, worldId, playerId, 12)
    ));
    return NextResponse.json(view, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json() as Body;
    const action = body.action === "ARCHIVE" ? "ARCHIVE" : "UPSERT";
    const view = await withAlphaServerContext(({ repository, worldId, playerId }) => (
      action === "ARCHIVE"
        ? archiveAlphaWorldCalendarSeries(repository, worldId, playerId, {
          requestId: textValue(body.requestId, "requestId"),
          expectedRevision: revision(body.expectedRevision),
          showSeriesId: textValue(body.showSeriesId, "showSeriesId", 180),
        })
        : saveAlphaWorldCalendarSeries(repository, worldId, playerId, {
          requestId: textValue(body.requestId, "requestId"),
          expectedRevision: revision(body.expectedRevision),
          showSeriesId: body.showSeriesId === undefined || body.showSeriesId === null || body.showSeriesId === ""
            ? null
            : textValue(body.showSeriesId, "showSeriesId", 180),
          name: textValue(body.name, "name", 80),
          role: role(body.role),
          eventType: eventType(body.eventType),
          cadenceWeeks: integer(body.cadenceWeeks, "cadenceWeeks"),
          anchorWeek: integer(body.anchorWeek, "anchorWeek"),
          eventImportance: integer(body.eventImportance, "eventImportance"),
        })
    ));
    return NextResponse.json(view, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return errorResponse(error);
  }
}
