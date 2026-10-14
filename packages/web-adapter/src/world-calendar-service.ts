import type {
  PromotionShowSeriesRole,
  WrestlingEventType,
} from "../../domain/src/types.js";
import {
  transactWithReceiptIds,
  activePromotionControlForPlayer,
  archivePromotionShowSeriesCommand,
  buildPlayerWorldCalendarView,
  upsertPromotionShowSeriesCommand,
  type ApplicationWorldRepository,
  type PlayerWorldCalendarView,
} from "../../application/src/index.js";

export interface AlphaCalendarSeriesRequest {
  requestId: string;
  expectedRevision: number;
  showSeriesId?: string | null;
  name: string;
  role: PromotionShowSeriesRole;
  eventType: WrestlingEventType;
  cadenceWeeks: number;
  anchorWeek: number;
  eventImportance: number;
}

export interface AlphaCalendarArchiveRequest {
  requestId: string;
  expectedRevision: number;
  showSeriesId: string;
}

function requiredText(value: string, label: string, maxLength = 220): string {
  const normalized = value.trim();
  if (!normalized) throw new Error(`${label} must not be empty`);
  if (normalized.length > maxLength) throw new Error(`${label} is too long`);
  return normalized;
}

function revision(value: number): number {
  if (!Number.isSafeInteger(value) || value < 0) throw new Error("expectedRevision must be a non-negative integer");
  return value;
}

function assertOpen(phase: string): void {
  if (phase !== "OPEN") throw new Error("show calendar can only be edited while the World is OPEN");
}

export async function loadAlphaWorldCalendar(
  repository: ApplicationWorldRepository,
  worldId: string,
  playerId: string,
  weeks = 12,
): Promise<PlayerWorldCalendarView> {
  return buildPlayerWorldCalendarView(await repository.load(worldId), playerId, weeks);
}

export async function saveAlphaWorldCalendarSeries(
  repository: ApplicationWorldRepository,
  worldId: string,
  playerId: string,
  request: AlphaCalendarSeriesRequest,
): Promise<PlayerWorldCalendarView> {
  const requestId = requiredText(request.requestId, "requestId");
  revision(request.expectedRevision);

  await transactWithReceiptIds(repository, worldId, null, [requestId], (aggregate) => {
    const control = activePromotionControlForPlayer(aggregate.ownership, playerId);
    if (!control) throw new Error("Take control of a promotion before editing its calendar");
    assertOpen(aggregate.runtime.phase);
    const receipt = aggregate.commands.receipts.find((candidate) => candidate.requestId === requestId);
    if (!receipt && aggregate.runtime.revision !== request.expectedRevision) {
      throw new Error(`stale World revision for ${worldId}: expected ${request.expectedRevision}, current ${aggregate.runtime.revision}`);
    }

    upsertPromotionShowSeriesCommand(
      aggregate.state,
      aggregate.ownership,
      aggregate.commands,
      aggregate.runtime,
      {
        requestId,
        worldId,
        playerId,
        commandType: "UPSERT_PROMOTION_SHOW_SERIES",
        payload: {
          promotionId: control.promotionId,
          showSeriesId: request.showSeriesId ?? null,
          name: request.name,
          role: request.role,
          eventType: request.eventType,
          cadenceWeeks: request.cadenceWeeks,
          anchorWeek: request.anchorWeek,
          eventImportance: request.eventImportance,
        },
      },
    );
  });

  return loadAlphaWorldCalendar(repository, worldId, playerId, 12);
}

export async function archiveAlphaWorldCalendarSeries(
  repository: ApplicationWorldRepository,
  worldId: string,
  playerId: string,
  request: AlphaCalendarArchiveRequest,
): Promise<PlayerWorldCalendarView> {
  const requestId = requiredText(request.requestId, "requestId");
  const showSeriesId = requiredText(request.showSeriesId, "showSeriesId", 180);
  revision(request.expectedRevision);

  await transactWithReceiptIds(repository, worldId, null, [requestId], (aggregate) => {
    const control = activePromotionControlForPlayer(aggregate.ownership, playerId);
    if (!control) throw new Error("Take control of a promotion before editing its calendar");
    assertOpen(aggregate.runtime.phase);
    const receipt = aggregate.commands.receipts.find((candidate) => candidate.requestId === requestId);
    if (!receipt && aggregate.runtime.revision !== request.expectedRevision) {
      throw new Error(`stale World revision for ${worldId}: expected ${request.expectedRevision}, current ${aggregate.runtime.revision}`);
    }

    archivePromotionShowSeriesCommand(
      aggregate.state,
      aggregate.ownership,
      aggregate.commands,
      aggregate.runtime,
      {
        requestId,
        worldId,
        playerId,
        commandType: "ARCHIVE_PROMOTION_SHOW_SERIES",
        payload: {
          promotionId: control.promotionId,
          showSeriesId,
        },
      },
    );
  });

  return loadAlphaWorldCalendar(repository, worldId, playerId, 12);
}
