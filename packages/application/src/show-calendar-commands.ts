import type {
  Id,
  PromotionShowSeries,
  PromotionShowSeriesRole,
  WorldState,
  WrestlingEventType,
} from "../../domain/src/types.js";
import { LedgerWriter } from "../../sim-core/src/ledger.js";
import { seedWorldPromotionShowSeries, validatePromotionShowSeriesState } from "../../sim-core/src/show-calendar.js";
import {
  executeIdempotentCommand,
  type ApplicationCommandEnvelope,
  type WorldCommandState,
} from "./commands.js";
import {
  activeWorldMembership,
  playerControlsPromotion,
  type WorldOwnershipState,
} from "./ownership.js";
import type { WorldRuntimeState } from "./runtime.js";

export interface UpsertPromotionShowSeriesPayload {
  promotionId: Id;
  showSeriesId?: Id | null;
  name: string;
  role: PromotionShowSeriesRole;
  eventType: WrestlingEventType;
  cadenceWeeks: number;
  anchorWeek: number;
  eventImportance: number;
}

export interface ArchivePromotionShowSeriesPayload {
  promotionId: Id;
  showSeriesId: Id;
}

function normalizeName(value: string): string {
  const normalized = value.trim();
  if (normalized.length === 0) throw new Error("show name must not be empty");
  if (normalized.length > 80) throw new Error("show name must contain at most 80 characters");
  return normalized;
}

function authorize(
  state: WorldState,
  ownership: WorldOwnershipState,
  playerId: string,
  promotionId: Id,
): void {
  if (ownership.worldId !== state.world.id) throw new Error("show-calendar ownership state does not belong to this World");
  if (!activeWorldMembership(ownership, playerId)) throw new Error(`${playerId} is not an active member of ${state.world.id}`);
  if (!playerControlsPromotion(ownership, playerId, promotionId)) throw new Error(`${playerId} does not control ${promotionId}`);
}

function ensureShowSeries(state: WorldState): PromotionShowSeries[] {
  if (!state.showSeries) state.showSeries = seedWorldPromotionShowSeries(state.world.id, state.promotions, state.ruleset);
  return state.showSeries;
}

function validateSchedule(cadenceWeeks: number, anchorWeek: number, eventImportance: number): void {
  if (!Number.isSafeInteger(cadenceWeeks) || cadenceWeeks < 1 || cadenceWeeks > 260) {
    throw new Error("show cadence must be a whole number from 1 to 260 PPW weeks");
  }
  if (!Number.isSafeInteger(anchorWeek) || anchorWeek < 0 || anchorWeek >= cadenceWeeks) {
    throw new Error("show anchor week must fall inside its recurrence cycle");
  }
  if (!Number.isFinite(eventImportance) || eventImportance < 1 || eventImportance > 100) {
    throw new Error("show importance must be from 1 to 100");
  }
}

function nextCustomSeriesId(series: readonly PromotionShowSeries[], promotionId: Id): Id {
  let counter = 1;
  while (series.some((candidate) => candidate.id === `show-series:${promotionId}:custom:${counter}`)) counter += 1;
  return `show-series:${promotionId}:custom:${counter}`;
}

function assertUniqueActiveName(
  series: readonly PromotionShowSeries[],
  promotionId: Id,
  name: string,
  excludingId: Id | null,
): void {
  const normalized = name.toLocaleLowerCase("en-GB");
  if (series.some((candidate) => (
    candidate.active
    && candidate.promotionId === promotionId
    && candidate.id !== excludingId
    && candidate.name.trim().toLocaleLowerCase("en-GB") === normalized
  ))) throw new Error("this promotion already has an active show using that name");
}

function assertCalendarValid(state: WorldState, nextSeries: PromotionShowSeries[]): void {
  const errors = validatePromotionShowSeriesState({ world: state.world, promotions: state.promotions, showSeries: nextSeries });
  if (errors.length > 0) throw new Error(errors[0]);
}

export function upsertPromotionShowSeriesCommand(
  state: WorldState,
  ownership: WorldOwnershipState,
  commandState: WorldCommandState,
  runtime: WorldRuntimeState,
  envelope: ApplicationCommandEnvelope<UpsertPromotionShowSeriesPayload>,
): PromotionShowSeries {
  if (envelope.commandType !== "UPSERT_PROMOTION_SHOW_SERIES") {
    throw new Error(`expected UPSERT_PROMOTION_SHOW_SERIES command, received ${envelope.commandType}`);
  }

  return executeIdempotentCommand(commandState, runtime, envelope, state.world.currentDate, () => {
    authorize(state, ownership, envelope.playerId, envelope.payload.promotionId);
    const promotion = state.promotions.find((candidate) => candidate.id === envelope.payload.promotionId);
    if (!promotion) throw new Error(`unknown promotion ${envelope.payload.promotionId}`);

    const series = ensureShowSeries(state);
    const name = normalizeName(envelope.payload.name);
    validateSchedule(envelope.payload.cadenceWeeks, envelope.payload.anchorWeek, envelope.payload.eventImportance);

    const existing = envelope.payload.showSeriesId
      ? series.find((candidate) => candidate.id === envelope.payload.showSeriesId) ?? null
      : null;

    if (envelope.payload.showSeriesId && !existing) throw new Error(`unknown show series ${envelope.payload.showSeriesId}`);
    if (existing && existing.promotionId !== promotion.id) throw new Error("cannot edit another promotion's show identity");
    if (existing && !existing.active) throw new Error("archived show identities cannot be edited");
    if (!existing && envelope.payload.role === "FLAGSHIP") throw new Error("a promotion's flagship identity is edited rather than duplicated");
    if (existing?.role === "FLAGSHIP" && envelope.payload.role !== "FLAGSHIP") throw new Error("the promotion must retain its flagship show identity");
    if (existing?.role !== "FLAGSHIP" && envelope.payload.role === "FLAGSHIP") throw new Error("another show identity cannot replace the flagship through a normal edit");

    const specialRole = envelope.payload.role === "SPECIAL" || envelope.payload.role === "PREMIUM";
    if (specialRole && envelope.payload.eventType !== "MAJOR") {
      throw new Error("Special and Premium identities must use Major event level");
    }
    if (!specialRole && envelope.payload.eventType !== "REGULAR") {
      throw new Error("Flagship, Secondary and Developmental identities must use Regular event level");
    }

    assertUniqueActiveName(series, promotion.id, name, existing?.id ?? null);

    const next: PromotionShowSeries = {
      id: existing?.id ?? nextCustomSeriesId(series, promotion.id),
      worldId: state.world.id,
      promotionId: promotion.id,
      name,
      role: envelope.payload.role,
      eventType: envelope.payload.eventType,
      cadenceWeeks: envelope.payload.cadenceWeeks,
      anchorWeek: envelope.payload.anchorWeek,
      eventImportance: envelope.payload.eventImportance,
      active: true,
    };

    const nextSeries = existing
      ? series.map((candidate) => candidate.id === existing.id ? next : candidate)
      : [...series, next];
    assertCalendarValid(state, nextSeries);
    state.showSeries = nextSeries;

    new LedgerWriter(state.world.id, state.ledger).append({
      date: state.world.currentDate,
      type: existing ? "SHOW_SERIES_UPDATED" : "SHOW_SERIES_CREATED",
      significance: envelope.payload.eventType === "MAJOR" ? "NOTABLE" : "ROUTINE",
      entityIds: [promotion.id, next.id],
      payload: {
        name: next.name,
        role: next.role,
        eventType: next.eventType,
        cadenceWeeks: next.cadenceWeeks,
        anchorWeek: next.anchorWeek,
        eventImportance: next.eventImportance,
      },
    });

    return next;
  });
}

export function archivePromotionShowSeriesCommand(
  state: WorldState,
  ownership: WorldOwnershipState,
  commandState: WorldCommandState,
  runtime: WorldRuntimeState,
  envelope: ApplicationCommandEnvelope<ArchivePromotionShowSeriesPayload>,
): PromotionShowSeries {
  if (envelope.commandType !== "ARCHIVE_PROMOTION_SHOW_SERIES") {
    throw new Error(`expected ARCHIVE_PROMOTION_SHOW_SERIES command, received ${envelope.commandType}`);
  }

  return executeIdempotentCommand(commandState, runtime, envelope, state.world.currentDate, () => {
    authorize(state, ownership, envelope.playerId, envelope.payload.promotionId);
    const series = ensureShowSeries(state);
    const existing = series.find((candidate) => candidate.id === envelope.payload.showSeriesId);
    if (!existing) throw new Error(`unknown show series ${envelope.payload.showSeriesId}`);
    if (existing.promotionId !== envelope.payload.promotionId) throw new Error("cannot archive another promotion's show identity");
    if (!existing.active) throw new Error("show identity is already archived");
    if (existing.role === "FLAGSHIP") throw new Error("the promotion's flagship show identity cannot be archived");

    const archived: PromotionShowSeries = { ...existing, active: false };
    const nextSeries = series.map((candidate) => candidate.id === existing.id ? archived : candidate);
    assertCalendarValid(state, nextSeries);
    state.showSeries = nextSeries;

    new LedgerWriter(state.world.id, state.ledger).append({
      date: state.world.currentDate,
      type: "SHOW_SERIES_ARCHIVED",
      significance: existing.eventType === "MAJOR" ? "NOTABLE" : "ROUTINE",
      entityIds: [existing.promotionId, existing.id],
      payload: { name: existing.name, role: existing.role },
    });

    return archived;
  });
}
