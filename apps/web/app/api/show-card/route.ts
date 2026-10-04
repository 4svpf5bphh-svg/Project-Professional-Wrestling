import { NextRequest, NextResponse } from "next/server";
import type {
  MatchIntent,
  MatchSide,
  MatchType,
} from "../../../../../dist/packages/domain/src/types.js";
import {
  loadAlphaCurrentWeekCard,
  saveAlphaCurrentWeekCard,
  type AlphaCardMatchView,
  type AlphaChampionshipAssignmentView,
} from "../../../../../dist/packages/web-adapter/src/card-service.js";
import { withAlphaServerContext } from "../../../../../dist/packages/web-adapter/src/server-world.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ShowCardBody = {
  requestId?: unknown;
  expectedRevision?: unknown;
  expectedPlanVersion?: unknown;
  matches?: unknown;
  championshipAssignments?: unknown;
};

const MATCH_TYPES = new Set<MatchType>(["SINGLES", "TAG"]);
const MATCH_SIDES = new Set<MatchSide>(["A", "B"]);
const MATCH_INTENTS = new Set<MatchIntent>([
  "COMPETITIVE",
  "SHOWCASE",
  "DOMINANT",
  "TECHNICAL",
  "HIGH_RISK",
  "STORY",
  "PROTECTIVE",
  "EPIC",
]);

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

function plannedLength(value: unknown, label: string): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 3 || value > 60) {
    throw new Error(`${label} must be an integer from 3 to 60`);
  }
  return value;
}

function personIds(value: unknown, label: string): string[] {
  if (!Array.isArray(value)) throw new Error(`${label} must be an array`);
  return value.map((entry, index) => requiredText(entry, `${label}[${index}]`, 128));
}

function matches(value: unknown): AlphaCardMatchView[] {
  if (!Array.isArray(value)) throw new Error("matches must be an array");
  return value.map((entry, index) => {
    if (!entry || typeof entry !== "object") throw new Error(`matches[${index}] must be an object`);
    const candidate = entry as Record<string, unknown>;
    const type = requiredText(candidate.type, `matches[${index}].type`, 32) as MatchType;
    const intendedWinnerSide = requiredText(
      candidate.intendedWinnerSide,
      `matches[${index}].intendedWinnerSide`,
      8,
    ) as MatchSide;
    const intent = requiredText(candidate.intent, `matches[${index}].intent`, 32) as MatchIntent;
    if (!MATCH_TYPES.has(type)) throw new Error(`unsupported match type ${type}`);
    if (!MATCH_SIDES.has(intendedWinnerSide)) throw new Error("intended winner side must be A or B");
    if (!MATCH_INTENTS.has(intent)) throw new Error(`unsupported match intent ${intent}`);

    return {
      draftMatchId: requiredText(candidate.draftMatchId, `matches[${index}].draftMatchId`, 128),
      type,
      sideAIds: personIds(candidate.sideAIds, `matches[${index}].sideAIds`),
      sideBIds: personIds(candidate.sideBIds, `matches[${index}].sideBIds`),
      intendedWinnerSide,
      intent,
      plannedLengthMinutes: plannedLength(candidate.plannedLengthMinutes, `matches[${index}].plannedLengthMinutes`),
    };
  });
}

function championshipAssignments(value: unknown): AlphaChampionshipAssignmentView[] {
  if (!Array.isArray(value)) throw new Error("championshipAssignments must be an array");
  return value.map((entry, index) => {
    if (!entry || typeof entry !== "object") {
      throw new Error(`championshipAssignments[${index}] must be an object`);
    }
    const candidate = entry as Record<string, unknown>;
    return {
      draftMatchId: requiredText(
        candidate.draftMatchId,
        `championshipAssignments[${index}].draftMatchId`,
        128,
      ),
      championshipId: requiredText(
        candidate.championshipId,
        `championshipAssignments[${index}].championshipId`,
        128,
      ),
    };
  });
}

function errorResponse(error: unknown, fallback: string): NextResponse {
  const message = error instanceof Error ? error.message : fallback;
  const status = message.includes("DATABASE_URL") ? 500 : 409;
  return NextResponse.json({ error: message }, { status });
}

export async function GET(): Promise<NextResponse> {
  try {
    const view = await withAlphaServerContext(({ repository, worldId, playerId }) => (
      loadAlphaCurrentWeekCard(repository, worldId, playerId)
    ));
    return NextResponse.json(view, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return errorResponse(error, "Unable to load show card");
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json() as ShowCardBody;
    const view = await withAlphaServerContext(({ repository, worldId, playerId }) => (
      saveAlphaCurrentWeekCard(repository, worldId, playerId, {
        requestId: requiredText(body.requestId, "requestId", 220),
        expectedRevision: nonNegativeInteger(body.expectedRevision, "expectedRevision"),
        expectedPlanVersion: nonNegativeInteger(body.expectedPlanVersion, "expectedPlanVersion"),
        matches: matches(body.matches),
        championshipAssignments: championshipAssignments(body.championshipAssignments ?? []),
      })
    ));
    return NextResponse.json(view, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return errorResponse(error, "Unable to save show card");
  }
}
