import { REAL_WORLD_ALPHA_RULESET } from "../../config/src/real-world-ruleset.js";
import { calibratedRealActiveMixedRosterSource } from "../../content/src/real-active-mixed-roster.js";
import { realPromotionEcosystemSource } from "../../content/src/real-promotions.js";
import { realPromotionShowSeriesSource } from "../../content/src/real-show-series.js";
import { realWorldInitialRosterAssignmentSource } from "../../content/src/real-aew-roh-cmll-rosters.js";
import { seedRealActiveTagTeams } from "../../content/src/real-active-tag-teams.js";
import { seedRealWrestlerRelationships } from "../../content/src/real-wrestler-relationships.js";
import type { Promotion, PromotionShowSeries, TicketStrategy } from "../../domain/src/types.js";
import {
  activePromotionControlForPlayer,
  alphaCurrentWeekShowDraftId,
  buildAlphaPlayerWorldView,
  buildPlayerAttention,
  buildPlayerShowHistory,
  claimIndependentPromotionCommand,
  createWorldCommandState,
  createWorldEngagementState,
  createWorldOwnershipState,
  createWorldPlanningState,
  createWorldRuntimeState,
  dismissAttention,
  joinPlayerToWorld,
  incrementWorldRevision,
  lockPersistedWorldForResolution,
  materializePersistedCurrentWeekReservations,
  reserveDetailedShowDraftCommand,
  resolvePersistedWorldWeek,
  upsertDetailedShowDraftCommand,
  type AlphaPlayerWorldView,
  type ApplicationWorldAggregate,
  type ApplicationWorldRepository,
  type DetailedShowDraft,
  type PlayerShowHistoryView,
} from "../../application/src/index.js";
import { ensureWorldChampionships } from "../../sim-core/src/competition.js";
import { createWorld } from "../../sim-core/src/genesis.js";
import {
  defaultPromotionShowSeries,
  primaryPromotionShowSeriesForDate,
} from "../../sim-core/src/show-calendar.js";

export interface AlphaWorldBootstrapOptions {
  seed: number;
  playerId: string;
  worldName?: string;
}

export interface AlphaClaimRequest {
  promotionId: string;
  requestId: string;
  takeoverMode?: "CONTINUE" | "REBRAND";
  name?: string;
}

export interface AlphaAdvanceWeekRequest {
  expectedRevision: number;
}

export interface AlphaDismissAttentionRequest {
  attentionId: string;
}

export interface AlphaShowPlanRequest {
  requestId: string;
  expectedRevision: number;
  expectedPlanVersion: number;
  day: number;
  marketId: string;
  venueId: string;
  ticketStrategy: TicketStrategy;
  participantIds: string[];
}

const TICKET_STRATEGIES = new Set<TicketStrategy>(["ACCESSIBLE", "STANDARD", "PREMIUM", "PRESTIGE"]);

function normalizedSeed(seed: number): number {
  if (!Number.isSafeInteger(seed)) throw new Error("Alpha World seed must be an integer");
  return seed >>> 0;
}

function requireExpectedRevision(revision: number): number {
  if (!Number.isSafeInteger(revision) || revision < 0) {
    throw new Error("expectedRevision must be a non-negative integer");
  }
  return revision;
}

function requirePlanVersion(version: number): number {
  if (!Number.isSafeInteger(version) || version < 0) {
    throw new Error("expectedPlanVersion must be a non-negative integer");
  }
  return version;
}

function requireRequestId(value: string): string {
  const normalized = value.trim();
  if (!normalized) throw new Error("requestId must not be empty");
  if (normalized.length > 220) throw new Error("requestId is too long");
  return normalized;
}

function requireAttentionId(value: string): string {
  const normalized = value.trim();
  if (!normalized) throw new Error("attentionId must not be empty");
  if (normalized.length > 240) throw new Error("attentionId is too long");
  return normalized;
}

function requireShowDay(day: number): number {
  if (!Number.isSafeInteger(day) || day < 1 || day > 7) throw new Error("show day must be an integer from 1 to 7");
  return day;
}

export function alphaWorldId(seed: number): string {
  return `world-${normalizedSeed(seed)}`;
}


function sameSeries(left: PromotionShowSeries, right: PromotionShowSeries): boolean {
  return left.id === right.id
    && left.worldId === right.worldId
    && left.promotionId === right.promotionId
    && left.name === right.name
    && left.role === right.role
    && left.eventType === right.eventType
    && left.cadenceWeeks === right.cadenceWeeks
    && left.anchorWeek === right.anchorWeek
    && left.eventImportance === right.eventImportance
    && left.active === right.active;
}

function hasExactUntouchedGenericCalendar(
  aggregate: ApplicationWorldAggregate,
  promotion: Promotion,
): boolean {
  const current = (aggregate.state.showSeries ?? [])
    .filter((series) => series.promotionId === promotion.id)
    .sort((left, right) => left.id.localeCompare(right.id));
  const expected = defaultPromotionShowSeries(
    aggregate.state.world.id,
    promotion,
    aggregate.state.ruleset,
  ).sort((left, right) => left.id.localeCompare(right.id));
  return current.length === expected.length
    && current.every((series, index) => sameSeries(series, expected[index]!));
}

function hasLiveLegacyCalendarDependency(
  aggregate: ApplicationWorldAggregate,
  promotionId: string,
): boolean {
  if (aggregate.state.events.some((event) => (
    event.promotionId === promotionId && event.status === "SCHEDULED"
  ))) return true;

  if (aggregate.planning.showReservations.some((reservation) => (
    reservation.promotionId === promotionId
  ))) return true;

  return aggregate.planning.workspaces.some((workspace) => (
    workspace.promotionId === promotionId && workspace.detailedShowDrafts.length > 0
  ));
}

/**
 * Safely upgrades only untouched generic calendars belonging to real-world
 * promotions. Existing generic identities are archived rather than replaced,
 * preserving completed-event lineage. Any edit or live planning dependency
 * causes that promotion to be skipped entirely.
 */
export function upgradeLegacyRealPromotionCalendarsSafely(
  aggregate: ApplicationWorldAggregate,
): string[] {
  const upgraded: string[] = [];
  const curated = realPromotionShowSeriesSource(
    aggregate.state.world.id,
    aggregate.state.promotions,
    aggregate.state.ruleset,
  );

  for (const promotion of aggregate.state.promotions) {
    if (promotion.identity?.origin !== "REAL_WORLD") continue;
    if (!hasExactUntouchedGenericCalendar(aggregate, promotion)) continue;
    if (hasLiveLegacyCalendarDependency(aggregate, promotion.id)) continue;

    const legacy = (aggregate.state.showSeries ?? [])
      .filter((series) => series.promotionId === promotion.id)
      .map((series) => ({ ...series, active: false }));
    const replacement = curated.filter((series) => series.promotionId === promotion.id);
    if (replacement.length === 0) continue;

    aggregate.state.showSeries = [
      ...(aggregate.state.showSeries ?? []).filter((series) => series.promotionId !== promotion.id),
      ...legacy,
      ...replacement,
    ];
    upgraded.push(promotion.id);
  }

  return upgraded;
}

async function upgradePersistedLegacyRealPromotionCalendars(
  repository: ApplicationWorldRepository,
  worldId: string,
): Promise<void> {
  const aggregate = await repository.load(worldId);
  const hasCandidate = aggregate.state.promotions.some((promotion) => (
    promotion.identity?.origin === "REAL_WORLD"
    && hasExactUntouchedGenericCalendar(aggregate, promotion)
    && !hasLiveLegacyCalendarDependency(aggregate, promotion.id)
  ));
  if (!hasCandidate) return;

  await repository.transact(worldId, null, (current) => {
    const upgraded = upgradeLegacyRealPromotionCalendarsSafely(current);
    if (upgraded.length > 0) incrementWorldRevision(current.runtime);
  });
}

export function createAlphaWorldAggregate(options: AlphaWorldBootstrapOptions): ApplicationWorldAggregate {
  const seed = normalizedSeed(options.seed);
  const state = createWorld(
    seed,
    REAL_WORLD_ALPHA_RULESET,
    options.worldName ?? "PPW Alpha World",
    calibratedRealActiveMixedRosterSource,
    realPromotionEcosystemSource,
    realWorldInitialRosterAssignmentSource,
    realPromotionShowSeriesSource,
  );
  seedRealActiveTagTeams(state);
  seedRealWrestlerRelationships(state);
  ensureWorldChampionships(state);
  const ownership = createWorldOwnershipState(state.world.id, 1);
  joinPlayerToWorld(ownership, options.playerId, state.world.currentDate);
  return {
    state,
    ownership,
    commands: createWorldCommandState(state.world.id),
    runtime: createWorldRuntimeState(state.world.id),
    planning: createWorldPlanningState(state.world.id),
  };
}

export async function ensureAlphaWorld(
  repository: ApplicationWorldRepository,
  options: AlphaWorldBootstrapOptions,
): Promise<string> {
  const worldId = alphaWorldId(options.seed);
  try {
    await repository.load(worldId);
    await upgradePersistedLegacyRealPromotionCalendars(repository, worldId);
    return worldId;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!message.includes("was not found")) throw error;
  }

  try {
    await repository.initialize(createAlphaWorldAggregate(options));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!message.includes("already exists")) throw error;
  }
  return worldId;
}

export async function loadAlphaPlayerSession(
  repository: ApplicationWorldRepository,
  worldId: string,
  playerId: string,
): Promise<AlphaPlayerWorldView> {
  return buildAlphaPlayerWorldView(await repository.load(worldId), playerId);
}

export async function loadAlphaPlayerResults(
  repository: ApplicationWorldRepository,
  worldId: string,
  playerId: string,
): Promise<PlayerShowHistoryView> {
  return buildPlayerShowHistory(await repository.load(worldId), playerId);
}

export async function dismissAlphaAttention(
  repository: ApplicationWorldRepository,
  worldId: string,
  playerId: string,
  request: AlphaDismissAttentionRequest,
): Promise<AlphaPlayerWorldView> {
  const attentionId = requireAttentionId(request.attentionId);
  await repository.transact(worldId, null, (aggregate) => {
    const visibleItem = buildPlayerAttention(aggregate, playerId)
      .find((item) => item.attentionId === attentionId);
    if (!visibleItem) {
      const alreadyDismissed = aggregate.engagement?.attentionDismissals.some((record) => (
        record.playerId === playerId && record.attentionId === attentionId
      ));
      if (alreadyDismissed) return;
      throw new Error("Attention item is not currently visible");
    }
    if (!visibleItem.dismissible) throw new Error("Attention item cannot be dismissed");

    const engagement = aggregate.engagement ?? createWorldEngagementState(worldId);
    aggregate.engagement = engagement;
    dismissAttention(engagement, playerId, attentionId, aggregate.runtime.revision);
  });
  return loadAlphaPlayerSession(repository, worldId, playerId);
}

export async function claimAlphaPromotion(
  repository: ApplicationWorldRepository,
  worldId: string,
  playerId: string,
  request: AlphaClaimRequest,
): Promise<AlphaPlayerWorldView> {
  await repository.transact(worldId, null, (aggregate) => {
    claimIndependentPromotionCommand(
      aggregate.state,
      aggregate.ownership,
      aggregate.commands,
      aggregate.runtime,
      {
        requestId: request.requestId,
        worldId,
        playerId,
        commandType: "CLAIM_INDEPENDENT_PROMOTION",
        payload: {
          promotionId: request.promotionId,
          options: request.takeoverMode === undefined && request.name === undefined
            ? undefined
            : { takeoverMode: request.takeoverMode, name: request.name },
        },
      },
    );
  });
  return loadAlphaPlayerSession(repository, worldId, playerId);
}

export async function saveAlphaCurrentWeekShowPlan(
  repository: ApplicationWorldRepository,
  worldId: string,
  playerId: string,
  request: AlphaShowPlanRequest,
): Promise<AlphaPlayerWorldView> {
  const expectedRevision = requireExpectedRevision(request.expectedRevision);
  const expectedPlanVersion = requirePlanVersion(request.expectedPlanVersion);
  const requestId = requireRequestId(request.requestId);
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

    const currentDate = aggregate.state.world.currentDate;
    const showSeries = primaryPromotionShowSeriesForDate(
      aggregate.state,
      control.promotionId,
      currentDate,
    );
    if (!showSeries) throw new Error("controlled promotion has no show identity due this PPW week");
    const draftId = alphaCurrentWeekShowDraftId(control.promotionId, currentDate);
    const draft: DetailedShowDraft = {
      draftId,
      promotionId: control.promotionId,
      showSeriesId: showSeries.id,
      targetDate: { year: currentDate.year, week: currentDate.week, day },
      marketId: request.marketId,
      venueId: request.venueId,
      ticketStrategy: request.ticketStrategy,
      participantIds: [...request.participantIds],
      matches: [],
      championshipAssignments: [],
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

  return loadAlphaPlayerSession(repository, worldId, playerId);
}

export async function advanceAlphaWorldWeek(
  repository: ApplicationWorldRepository,
  worldId: string,
  playerId: string,
  request: AlphaAdvanceWeekRequest,
): Promise<AlphaPlayerWorldView> {
  const expectedRevision = requireExpectedRevision(request.expectedRevision);
  const before = await repository.load(worldId);
  const control = activePromotionControlForPlayer(before.ownership, playerId);
  if (!control) throw new Error("Alpha player must control a promotion before finishing a PPW week");

  if (before.runtime.phase === "RESOLVING") {
    throw new Error(`World ${worldId} is resolving and cannot accept another Alpha week request`);
  }

  if (before.runtime.phase === "LOCKING") {
    await resolvePersistedWorldWeek(repository, worldId, before.runtime.revision);
    return loadAlphaPlayerSession(repository, worldId, playerId);
  }

  if (before.runtime.revision !== expectedRevision) {
    throw new Error(
      `stale World revision for ${worldId}: expected ${expectedRevision}, current ${before.runtime.revision}`,
    );
  }

  const materialized = await materializePersistedCurrentWeekReservations(
    repository,
    worldId,
    expectedRevision,
  );
  const lockedRevision = await lockPersistedWorldForResolution(
    repository,
    worldId,
    materialized.revision,
  );
  await resolvePersistedWorldWeek(repository, worldId, lockedRevision);
  return loadAlphaPlayerSession(repository, worldId, playerId);
}
