import type { TicketStrategy } from "../../domain/src/types.js";
import {
  activePromotionControlForPlayer,
  buildPlayerSixWeekPlannerView,
  reserveDetailedShowDraftCommand,
  upsertDetailedShowDraftCommand,
  type ApplicationWorldRepository,
  type DetailedShowDraft,
  type PlayerSixWeekPlannerView,
} from "../../application/src/index.js";

export interface AlphaPlannerShowPlanRequest {
  requestId: string;
  expectedRevision: number;
  expectedPlanVersion: number;
  year: number;
  week: number;
  day: number;
  marketId: string;
  venueId: string;
  ticketStrategy: TicketStrategy;
  participantIds: string[];
}

const TICKET_STRATEGIES = new Set<TicketStrategy>(["ACCESSIBLE", "STANDARD", "PREMIUM", "PRESTIGE"]);

function requireNonNegativeInteger(value: number, label: string): number {
  if (!Number.isSafeInteger(value) || value < 0) throw new Error(`${label} must be a non-negative integer`);
  return value;
}

function requirePositiveInteger(value: number, label: string): number {
  if (!Number.isSafeInteger(value) || value < 1) throw new Error(`${label} must be a positive integer`);
  return value;
}

function requireRequestId(value: string): string {
  const normalized = value.trim();
  if (!normalized) throw new Error("requestId must not be empty");
  if (normalized.length > 220) throw new Error("requestId is too long");
  return normalized;
}

function requireShowDay(value: number): number {
  if (!Number.isSafeInteger(value) || value < 1 || value > 7) throw new Error("day must be an integer from 1 to 7");
  return value;
}

function sameWeek(left: { year: number; week: number }, right: { year: number; week: number }): boolean {
  return left.year === right.year && left.week === right.week;
}

function plannerDraftId(promotionId: string, year: number, week: number): string {
  return `alpha-show:${promotionId}:Y${year}:W${week}`;
}

export async function loadAlphaPlayerPlanner(
  repository: ApplicationWorldRepository,
  worldId: string,
  playerId: string,
): Promise<PlayerSixWeekPlannerView> {
  return buildPlayerSixWeekPlannerView(await repository.load(worldId), playerId);
}

export async function saveAlphaPlannerShowPlan(
  repository: ApplicationWorldRepository,
  worldId: string,
  playerId: string,
  request: AlphaPlannerShowPlanRequest,
): Promise<PlayerSixWeekPlannerView> {
  const requestId = requireRequestId(request.requestId);
  const expectedRevision = requireNonNegativeInteger(request.expectedRevision, "expectedRevision");
  const expectedPlanVersion = requireNonNegativeInteger(request.expectedPlanVersion, "expectedPlanVersion");
  const year = requirePositiveInteger(request.year, "year");
  const week = requirePositiveInteger(request.week, "week");
  const day = requireShowDay(request.day);
  if (!TICKET_STRATEGIES.has(request.ticketStrategy)) throw new Error("unsupported ticket strategy");
  if (!Array.isArray(request.participantIds)) throw new Error("participantIds must be an array");

  const draftRequestId = `${requestId}:draft`;
  const reservationRequestId = `${requestId}:reserve`;

  await repository.transact(worldId, null, (aggregate) => {
    const control = activePromotionControlForPlayer(aggregate.ownership, playerId);
    if (!control) throw new Error("Alpha player must control a promotion before planning a show");

    const draftReceipt = aggregate.commands.receipts.find((receipt) => receipt.requestId === draftRequestId);
    const reservationReceipt = aggregate.commands.receipts.find((receipt) => receipt.requestId === reservationRequestId);
    const completeRetry = Boolean(draftReceipt && reservationReceipt);
    if (!completeRetry && aggregate.runtime.revision !== expectedRevision) {
      throw new Error(
        `stale World revision for ${worldId}: expected ${expectedRevision}, current ${aggregate.runtime.revision}`,
      );
    }

    if (week > aggregate.state.ruleset.weeksPerYear) {
      throw new Error(`week must be between 1 and ${aggregate.state.ruleset.weeksPerYear}`);
    }

    const targetDate = { year, week, day };
    const workspaceBefore = aggregate.planning.workspaces.find(
      (candidate) => candidate.promotionId === control.promotionId,
    ) ?? null;
    const draftsInWeek = (workspaceBefore?.detailedShowDrafts ?? []).filter((draft) => sameWeek(draft.targetDate, targetDate));
    if (draftsInWeek.length > 1) {
      throw new Error("planner cannot edit a week containing multiple show drafts");
    }
    const existing = draftsInWeek[0] ?? null;
    const draftId = existing?.draftId ?? plannerDraftId(control.promotionId, year, week);
    const draft: DetailedShowDraft = {
      draftId,
      promotionId: control.promotionId,
      targetDate,
      marketId: request.marketId,
      venueId: request.venueId,
      ticketStrategy: request.ticketStrategy,
      participantIds: [...request.participantIds],
      matches: existing?.matches.map((match) => ({
        ...match,
        sideAIds: [...match.sideAIds],
        sideBIds: [...match.sideBIds],
      })) ?? [],
      championshipAssignments: existing?.championshipAssignments.map((assignment) => ({ ...assignment })) ?? [],
    };

    const workspace = upsertDetailedShowDraftCommand(
      aggregate.state,
      aggregate.ownership,
      aggregate.planning,
      aggregate.commands,
      aggregate.runtime,
      {
        requestId: draftRequestId,
        worldId,
        playerId,
        commandType: "UPSERT_DETAILED_SHOW_DRAFT",
        payload: {
          promotionId: control.promotionId,
          expectedPlanVersion,
          draft,
        },
      },
    );

    reserveDetailedShowDraftCommand(
      aggregate.state,
      aggregate.ownership,
      aggregate.planning,
      aggregate.commands,
      aggregate.runtime,
      {
        requestId: reservationRequestId,
        worldId,
        playerId,
        commandType: "RESERVE_DETAILED_SHOW_DRAFT",
        payload: {
          promotionId: control.promotionId,
          expectedPlanVersion: workspace.version,
          draftId,
        },
      },
    );
  });

  return loadAlphaPlayerPlanner(repository, worldId, playerId);
}
