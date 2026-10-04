import type { Id, PpwDate } from "../../domain/src/types.js";

export type PlayerActivityStatus = "ACTIVE" | "WARNING" | "STEWARDED";
export type OpportunityCategory = "TALENT" | "MARKET" | "BUSINESS" | "WORLD";
export type StewardshipExitRequestStatus = "OPEN" | "SETTLED" | "WITHDRAWN";

export interface PlayerActivityRecord {
  playerId: string;
  lastActivePpwDate: PpwDate;
  lastActiveRevision: number;
  lastActiveCycleKey: string | null;
  status: PlayerActivityStatus;
  statusSinceCycleKey: string | null;
}

export interface AttentionDismissalRecord {
  playerId: string;
  attentionId: string;
  dismissedAtRevision: number;
}

export interface OpportunityRecord {
  opportunityId: string;
  worldId: Id;
  category: OpportunityCategory;
  title: string;
  summary: string;
  createdDate: PpwDate;
  opensDate: PpwDate;
  closesDate: PpwDate;
  eligiblePlayerIds: string[];
  eligiblePromotionIds: Id[];
  deepLink: string | null;
}

export interface StewardshipExitRequest {
  requestId: string;
  worldId: Id;
  promotionId: Id;
  personId: Id;
  contractId: Id;
  requestedDate: PpwDate;
  requestedCycleKey: string;
  trustAtRequest: number;
  status: StewardshipExitRequestStatus;
}

export interface WorldEngagementState {
  worldId: Id;
  playerActivity: PlayerActivityRecord[];
  attentionDismissals: AttentionDismissalRecord[];
  opportunities: OpportunityRecord[];
  stewardshipExitRequests: StewardshipExitRequest[];
}

export interface InactivityThresholds {
  warningAfterDays: number;
  stewardshipAfterDays: number;
}

export const DEFAULT_INACTIVITY_THRESHOLDS: InactivityThresholds = {
  warningAfterDays: 7,
  stewardshipAfterDays: 14,
};

function cloneDate(date: PpwDate): PpwDate {
  return { ...date };
}

function normalizedNonEmpty(value: string, label: string, maxLength = 256): string {
  const normalized = value.trim();
  if (!normalized) throw new Error(`${label} must not be empty`);
  if (normalized.length > maxLength) throw new Error(`${label} is too long`);
  return normalized;
}

function cycleKey(value: string | null): string | null {
  if (value === null) return null;
  const normalized = value.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) throw new Error("activity cycle key must use YYYY-MM-DD format");
  const parsed = new Date(`${normalized}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== normalized) {
    throw new Error("activity cycle key is not a valid UTC date");
  }
  return normalized;
}

function daysBetween(left: string, right: string): number {
  const leftMs = Date.parse(`${left}T00:00:00.000Z`);
  const rightMs = Date.parse(`${right}T00:00:00.000Z`);
  return Math.max(0, Math.floor((rightMs - leftMs) / 86_400_000));
}

function validatedThresholds(input: InactivityThresholds): InactivityThresholds {
  if (!Number.isSafeInteger(input.warningAfterDays) || input.warningAfterDays < 1) {
    throw new Error("warningAfterDays must be a positive integer");
  }
  if (!Number.isSafeInteger(input.stewardshipAfterDays) || input.stewardshipAfterDays <= input.warningAfterDays) {
    throw new Error("stewardshipAfterDays must be greater than warningAfterDays");
  }
  return { ...input };
}

export function createWorldEngagementState(worldId: Id): WorldEngagementState {
  return {
    worldId,
    playerActivity: [],
    attentionDismissals: [],
    opportunities: [],
    stewardshipExitRequests: [],
  };
}

export function normalizeWorldEngagementState(
  input: WorldEngagementState | undefined,
  worldId: Id,
): WorldEngagementState {
  if (!input) return createWorldEngagementState(worldId);
  if (input.worldId !== worldId) throw new Error("engagement state crosses World boundary");
  return {
    worldId,
    playerActivity: (input.playerActivity ?? []).map((record) => ({
      ...record,
      lastActivePpwDate: cloneDate(record.lastActivePpwDate),
      lastActiveCycleKey: record.lastActiveCycleKey ?? null,
      statusSinceCycleKey: record.statusSinceCycleKey ?? null,
    })),
    attentionDismissals: (input.attentionDismissals ?? []).map((record) => ({ ...record })),
    opportunities: (input.opportunities ?? []).map((record) => ({
      ...record,
      createdDate: cloneDate(record.createdDate),
      opensDate: cloneDate(record.opensDate),
      closesDate: cloneDate(record.closesDate),
      eligiblePlayerIds: [...(record.eligiblePlayerIds ?? [])],
      eligiblePromotionIds: [...(record.eligiblePromotionIds ?? [])],
      deepLink: record.deepLink ?? null,
    })),
    stewardshipExitRequests: (input.stewardshipExitRequests ?? []).map((record) => ({
      ...record,
      requestedDate: cloneDate(record.requestedDate),
    })),
  };
}

export function recordPlayerActivity(
  engagement: WorldEngagementState,
  playerId: string,
  ppwDate: PpwDate,
  worldRevision: number,
  rawCycleKey: string | null,
): PlayerActivityRecord {
  const normalizedPlayerId = normalizedNonEmpty(playerId, "playerId");
  if (!Number.isSafeInteger(worldRevision) || worldRevision < 0) throw new Error("activity World revision is invalid");
  const normalizedCycleKey = cycleKey(rawCycleKey);
  const existing = engagement.playerActivity.find((record) => record.playerId === normalizedPlayerId);
  if (existing) {
    const returningToActive = existing.status !== "ACTIVE";
    existing.lastActivePpwDate = cloneDate(ppwDate);
    existing.lastActiveRevision = worldRevision;
    existing.lastActiveCycleKey = normalizedCycleKey;
    existing.status = "ACTIVE";
    if (returningToActive) existing.statusSinceCycleKey = normalizedCycleKey;
    return existing;
  }

  const created: PlayerActivityRecord = {
    playerId: normalizedPlayerId,
    lastActivePpwDate: cloneDate(ppwDate),
    lastActiveRevision: worldRevision,
    lastActiveCycleKey: normalizedCycleKey,
    status: "ACTIVE",
    statusSinceCycleKey: normalizedCycleKey,
  };
  engagement.playerActivity.push(created);
  return created;
}

export function evaluatePlayerInactivity(
  engagement: WorldEngagementState,
  playerId: string,
  rawCurrentCycleKey: string,
  thresholds: InactivityThresholds = DEFAULT_INACTIVITY_THRESHOLDS,
): PlayerActivityStatus {
  const normalizedPlayerId = normalizedNonEmpty(playerId, "playerId");
  const currentCycleKey = cycleKey(rawCurrentCycleKey)!;
  const checkedThresholds = validatedThresholds(thresholds);
  const record = engagement.playerActivity.find((candidate) => candidate.playerId === normalizedPlayerId);
  if (!record || record.lastActiveCycleKey === null) return "ACTIVE";

  const inactiveDays = daysBetween(record.lastActiveCycleKey, currentCycleKey);
  const nextStatus: PlayerActivityStatus = inactiveDays >= checkedThresholds.stewardshipAfterDays
    ? "STEWARDED"
    : inactiveDays >= checkedThresholds.warningAfterDays
      ? "WARNING"
      : "ACTIVE";
  if (record.status !== nextStatus) {
    record.status = nextStatus;
    record.statusSinceCycleKey = currentCycleKey;
  }
  return record.status;
}

export function activityForPlayer(
  engagement: WorldEngagementState,
  playerId: string,
): PlayerActivityRecord | null {
  const normalizedPlayerId = normalizedNonEmpty(playerId, "playerId");
  return engagement.playerActivity.find((record) => record.playerId === normalizedPlayerId) ?? null;
}

export function addOpportunity(
  engagement: WorldEngagementState,
  opportunity: OpportunityRecord,
): OpportunityRecord {
  if (opportunity.worldId !== engagement.worldId) throw new Error("opportunity crosses World boundary");
  const opportunityId = normalizedNonEmpty(opportunity.opportunityId, "opportunityId", 220);
  if (engagement.opportunities.some((record) => record.opportunityId === opportunityId)) {
    throw new Error(`opportunity ${opportunityId} already exists`);
  }
  const normalized: OpportunityRecord = {
    ...opportunity,
    opportunityId,
    title: normalizedNonEmpty(opportunity.title, "opportunity title", 160),
    summary: normalizedNonEmpty(opportunity.summary, "opportunity summary", 800),
    createdDate: cloneDate(opportunity.createdDate),
    opensDate: cloneDate(opportunity.opensDate),
    closesDate: cloneDate(opportunity.closesDate),
    eligiblePlayerIds: [...opportunity.eligiblePlayerIds],
    eligiblePromotionIds: [...opportunity.eligiblePromotionIds],
    deepLink: opportunity.deepLink ? normalizedNonEmpty(opportunity.deepLink, "opportunity deepLink", 300) : null,
  };
  engagement.opportunities.push(normalized);
  return normalized;
}

export function opportunityVisibleToPlayer(
  opportunity: OpportunityRecord,
  playerId: string,
  promotionId: Id | null,
): boolean {
  const normalizedPlayerId = normalizedNonEmpty(playerId, "playerId");
  if (opportunity.eligiblePlayerIds.length > 0 && !opportunity.eligiblePlayerIds.includes(normalizedPlayerId)) return false;
  if (opportunity.eligiblePromotionIds.length > 0) {
    if (promotionId === null || !opportunity.eligiblePromotionIds.includes(promotionId)) return false;
  }
  return true;
}

export function dismissAttention(
  engagement: WorldEngagementState,
  playerId: string,
  attentionId: string,
  worldRevision: number,
): void {
  const normalizedPlayerId = normalizedNonEmpty(playerId, "playerId");
  const normalizedAttentionId = normalizedNonEmpty(attentionId, "attentionId", 240);
  if (!Number.isSafeInteger(worldRevision) || worldRevision < 0) throw new Error("dismissal World revision is invalid");
  const existing = engagement.attentionDismissals.find((record) => (
    record.playerId === normalizedPlayerId && record.attentionId === normalizedAttentionId
  ));
  if (existing) {
    existing.dismissedAtRevision = worldRevision;
    return;
  }
  engagement.attentionDismissals.push({
    playerId: normalizedPlayerId,
    attentionId: normalizedAttentionId,
    dismissedAtRevision: worldRevision,
  });
}

export function attentionIsDismissed(
  engagement: WorldEngagementState,
  playerId: string,
  attentionId: string,
): boolean {
  return engagement.attentionDismissals.some((record) => (
    record.playerId === playerId && record.attentionId === attentionId
  ));
}
