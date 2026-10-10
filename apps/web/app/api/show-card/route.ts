import { NextRequest, NextResponse } from "next/server";
import type {
  MatchIntent,
  MatchSide,
  MatchStyleProfile,
  MatchType,
} from "../../../../../dist/packages/domain/src/types.js";
import { normalizeMatchStyle } from "../../../../../dist/packages/sim-core/src/match-style.js";
import {
  loadAlphaShowCard,
  saveAlphaShowCard,
  type AlphaCardMatchView,
  type AlphaCardSegmentView,
  type AlphaCardSlotView,
  type AlphaChampionshipAssignmentView,
} from "../../../../../dist/packages/web-adapter/src/card-service.js";
import { withAlphaServerContext } from "../../../../../dist/packages/web-adapter/src/server-world.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ShowCardBody = {
  requestId?: unknown;
  expectedRevision?: unknown;
  expectedPlanVersion?: unknown;
  draftId?: unknown;
  matches?: unknown;
  segments?: unknown;
  runningOrder?: unknown;
  championshipAssignments?: unknown;
};

type BookableFinish = NonNullable<AlphaCardMatchView["plannedFinish"]>;

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
const MATCH_FINISHES = new Set<BookableFinish>([
  "CLEAN_PIN",
  "SUBMISSION",
  "FLASH_PIN",
  "PROTECTED_FINISH",
]);

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

function nonNegativeInteger(value: unknown, label: string): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) {
    throw new Error(`${label} must be a non-negative integer`);
  }
  return value;
}

/** Parse enum-bearing script fields without trusting arbitrary client strings. */
function nullableChoice<const T extends string>(
  value: unknown,
  label: string,
  options: readonly T[],
): T | null {
  const text = optionalText(value, label, 64);
  if (text === undefined) return null;
  if (!options.some((option) => option === text)) throw new Error(`${label} has an unsupported value`);
  return text as T;
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

function matchStyle(value: unknown, label: string): MatchStyleProfile | undefined {
  if (value === undefined) return undefined;
  if (!value || typeof value !== "object") throw new Error(`${label} must be an object`);
  const candidate = value as Record<string, unknown>;
  const dimension = (key: keyof MatchStyleProfile): number => {
    const entry = candidate[key];
    if (typeof entry !== "number") throw new Error(`${label}.${key} must be a number`);
    return entry;
  };
  return normalizeMatchStyle({
    competitiveness: dimension("competitiveness"),
    technical: dimension("technical"),
    story: dimension("story"),
    intensity: dimension("intensity"),
    risk: dimension("risk"),
    epic: dimension("epic"),
  });
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
    const plannedFinishText = optionalText(candidate.plannedFinish, `matches[${index}].plannedFinish`, 32);
    const plannedFinish = plannedFinishText as BookableFinish | undefined;
    const style = matchStyle(candidate.style, `matches[${index}].style`);
    if (!MATCH_TYPES.has(type)) throw new Error(`unsupported match type ${type}`);
    if (!MATCH_SIDES.has(intendedWinnerSide)) throw new Error("intended winner side must be A or B");
    if (!MATCH_INTENTS.has(intent)) throw new Error(`unsupported match intent ${intent}`);
    if (plannedFinish !== undefined && !MATCH_FINISHES.has(plannedFinish)) {
      throw new Error(`unsupported match finish ${plannedFinish}`);
    }

    return {
      draftMatchId: requiredText(candidate.draftMatchId, `matches[${index}].draftMatchId`, 128),
      type,
      sideAIds: personIds(candidate.sideAIds, `matches[${index}].sideAIds`),
      sideBIds: personIds(candidate.sideBIds, `matches[${index}].sideBIds`),
      intendedWinnerSide,
      intent,
      ...(style === undefined ? {} : { style }),
      plannedLengthMinutes: plannedLength(candidate.plannedLengthMinutes, `matches[${index}].plannedLengthMinutes`),
      ...(plannedFinish === undefined ? {} : { plannedFinish }),
      // The HTTP boundary must not strip the script written in the card UI.
      interfererPersonId: optionalText(candidate.interfererPersonId, `matches[${index}].interfererPersonId`, 128) ?? null,
      interferenceSide: nullableChoice(candidate.interferenceSide, `matches[${index}].interferenceSide`, ["A", "B"]) ,
      interferenceOutcome: nullableChoice(candidate.interferenceOutcome, `matches[${index}].interferenceOutcome`, ["SUCCESS", "THWARTED"]),
    };
  });
}

function segmentLength(value: unknown, label: string): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 2 || value > 20) {
    throw new Error(`${label} must be an integer from 2 to 20`);
  }
  return value;
}

function segments(value: unknown): AlphaCardSegmentView[] {
  if (value === undefined) return [];
  if (!Array.isArray(value)) throw new Error("segments must be an array");
  // Keep the HTTP schema in step with the playable Card and service layer.
  const supported = new Set<string>([
    "PROMO", "INTERVIEW", "CONFRONTATION", "INTERRUPTION", "CHALLENGE",
    "CONTRACT_SIGNING", "STABLE_INVITATION", "STABLE_EXIT", "STABLE_RECONCILIATION",
    "ATTACK", "RESCUE", "POST_MATCH_ASSAULT", "CELEBRATION", "TURN",
  ]);
  return value.map((entry, index) => {
    if (!entry || typeof entry !== "object") throw new Error(`segments[${index}] must be an object`);
    const candidate = entry as Record<string, unknown>;
    const type = requiredText(candidate.type, `segments[${index}].type`, 32);
    if (!supported.has(type)) throw new Error(`unsupported segment type ${type}`);
    const fieldId = (key: string): string | null => (
      optionalText(candidate[key], `segments[${index}].${key}`, 128) ?? null
    );
    const pick = <const T extends string>(key: string, values: readonly T[]): T | null => (
      nullableChoice(candidate[key], `segments[${index}].${key}`, values)
    );
    return {
      draftSegmentId: requiredText(candidate.draftSegmentId, `segments[${index}].draftSegmentId`, 128),
      type: type as AlphaCardSegmentView["type"],
      participantIds: personIds(candidate.participantIds, `segments[${index}].participantIds`),
      programmeId: fieldId("programmeId"),
      plannedLengthMinutes: segmentLength(candidate.plannedLengthMinutes, `segments[${index}].plannedLengthMinutes`),
      attackerPersonId: fieldId("attackerPersonId"),
      victimPersonId: fieldId("victimPersonId"),
      rescuerPersonId: fieldId("rescuerPersonId"),
      sourceDraftMatchId: fieldId("sourceDraftMatchId"),
      initiatorPersonId: fieldId("initiatorPersonId"),
      targetPersonId: fieldId("targetPersonId"),
      signingOutcome: pick("signingOutcome", ["SIGNED", "REJECTED", "WALKOUT", "BRAWL"]),
      stableId: fieldId("stableId"),
      stableInvitationOutcome: pick("stableInvitationOutcome", ["ACCEPTED", "REFUSED"]),
      stableExitOutcome: pick("stableExitOutcome", ["EXPELLED", "WALKED_OUT"]),
      stableReconciliationOutcome: pick("stableReconciliationOutcome", ["RECONCILED", "REBUFFED"]),
      challengeResponse: pick("challengeResponse", ["ACCEPTED", "REFUSED", "LEFT_OPEN"]),
      interruptionOutcome: pick("interruptionOutcome", [
        "VERBAL_EXCHANGE", "INTERRUPTER_PREVAILS", "SPEAKER_PREVAILS", "BRAWL",
      ]),
      attackPresentation: pick("attackPresentation", ["BLINDSIDE", "BEATDOWN", "PULL_APART_BRAWL"]),
      attackObjective: pick("attackObjective", ["GENERATE_HEAT", "BUILD_SYMPATHY", "ESCALATE_RIVALRY"]),
      turnPersonId: fieldId("turnPersonId"),
      turnTargetAlignment: pick("turnTargetAlignment", ["FACE", "HEEL", "TWEENER"]),
      turnPresentation: pick("turnPresentation", ["REVEAL", "BETRAYAL"]),
      betrayedPersonId: fieldId("betrayedPersonId"),
    };
  });
}

function runningOrder(value: unknown): AlphaCardSlotView[] | undefined {
  if (value === undefined) return undefined;
  if (!Array.isArray(value)) throw new Error("runningOrder must be an array");
  return value.map((entry, index) => {
    if (!entry || typeof entry !== "object") throw new Error(`runningOrder[${index}] must be an object`);
    const candidate = entry as Record<string, unknown>;
    const kind = requiredText(candidate.kind, `runningOrder[${index}].kind`, 16);
    if (kind !== "MATCH" && kind !== "SEGMENT") throw new Error(`runningOrder[${index}] has an invalid kind`);
    return {
      kind,
      refId: requiredText(candidate.refId, `runningOrder[${index}].refId`, 128),
    } as AlphaCardSlotView;
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

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const draftId = optionalText(request.nextUrl.searchParams.get("draftId"), "draftId", 128);
    const view = await withAlphaServerContext(({ repository, worldId, playerId }) => (
      loadAlphaShowCard(repository, worldId, playerId, draftId)
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
      saveAlphaShowCard(repository, worldId, playerId, {
        requestId: requiredText(body.requestId, "requestId", 220),
        expectedRevision: nonNegativeInteger(body.expectedRevision, "expectedRevision"),
        expectedPlanVersion: nonNegativeInteger(body.expectedPlanVersion, "expectedPlanVersion"),
        draftId: optionalText(body.draftId, "draftId", 128),
        matches: matches(body.matches),
        segments: segments(body.segments),
        runningOrder: runningOrder(body.runningOrder),
        championshipAssignments: championshipAssignments(body.championshipAssignments ?? []),
      })
    ));
    return NextResponse.json(view, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return errorResponse(error, "Unable to save show card");
  }
}
