import type { Id, PpwDate } from "../../domain/src/types.js";

export type PlayerActivityStatus = "ACTIVE" | "WARNING" | "STEWARDED";
export type OpportunityCategory = "TALENT" | "MARKET" | "BUSINESS" | "WORLD";
export type StewardshipExitRequestStatus = "OPEN" | "SETTLED" | "WITHDRAWN";
export type BackstageConversationStatus = "OPEN" | "ANSWERED";
export type BackstageResponse = "HEAR_OUT" | "EXPLAIN_PLAN" | "STAND_FIRM" | "PROMISE_FEATURED_BOOKING" | "CONSIDER_TAG_TEAM" | "PASS_TAG_TEAM" | "CONSIDER_RIVALRY" | "PASS_RIVALRY";

export type BackstagePromiseStatus = "PENDING" | "FULFILLED" | "NOT_DELIVERED" | "NO_OPPORTUNITY" | "EXCUSED";

export type BackstagePromiseReason =
  | "COMMITMENT_KEPT" | "COMMITMENT_BROKEN" | "NO_COMPLETED_SHOW"
  | "WRESTLER_INJURED" | "CONTRACT_TERMINATED"
  | "OWNER_STEWARDED" | "PROMOTION_UNCONTROLLED" | "WRESTLER_UNAVAILABLE";

export interface BackstagePromiseConsequence {
  assessedDate: PpwDate;
  reason: BackstagePromiseReason;
  /** Actual applied score change, after clamping. No free bonus for a fulfilled promise. */
  trustDelta: number;
  moraleDelta: number;
}

export interface BackstageBookingPromise {
  kind: "FEATURED_MATCH";
  madeDate: PpwDate;
  dueDate: PpwDate;
  expectedPosition: "MAIN_EVENT" | "UPPER_CARD";
  status: BackstagePromiseStatus;
  resolvedDate: PpwDate | null;
  fulfilledEventId: Id | null;
  /** Missing on historical snapshots; assessment is applied once. */
  consequence?: BackstagePromiseConsequence | null;
}

export interface BackstageConversation {
  conversationId: string;
  worldId: Id;
  promotionId: Id;
  wrestlerId: Id;
  sourceContractId: Id;
  kind: "ROLE_USAGE_CONCERN" | "TAG_TEAM_PITCH" | "RIVALRY_PITCH";
  createdDate: PpwDate;
  status: BackstageConversationStatus;
  response: BackstageResponse | null;
  responseDate: PpwDate | null;
  /** The evidence at creation is frozen for an intelligible historical conversation. */
  promisedRole: "MAIN_EVENT" | "UPPER_CARD" | null;
  observedMatchShows: number;
  observedFeaturedShows: number;
  /** Positive pitch facts, absent on older concerns. */
  partnerPersonId?: Id | null;
  sharedTagMatches?: number;
  averageCrowdResponse?: number;
  rivalPersonId?: Id | null;
  sharedSinglesMatches?: number;
  professionalTrustAtPitch?: number;
  /** Optional for snapshots created before promise tracking existed. */
  promise?: BackstageBookingPromise | null;
}

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

export interface TalentWatchRecord {
  playerId: string;
  personId: Id;
  addedAtRevision: number;
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
  talentWatchlist: TalentWatchRecord[];
  opportunities: OpportunityRecord[];
  stewardshipExitRequests: StewardshipExitRequest[];
  backstageConversations: BackstageConversation[];
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
    talentWatchlist: [],
    opportunities: [],
    stewardshipExitRequests: [],
    backstageConversations: [],
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
    talentWatchlist: (input.talentWatchlist ?? []).map((record) => ({ ...record })),
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
    backstageConversations: (input.backstageConversations ?? []).map((record) => ({
      ...record,
      createdDate: cloneDate(record.createdDate),
      responseDate: record.responseDate ? cloneDate(record.responseDate) : null,
      promise: record.promise ? {
        ...record.promise,
        madeDate: cloneDate(record.promise.madeDate),
        dueDate: cloneDate(record.promise.dueDate),
        resolvedDate: record.promise.resolvedDate ? cloneDate(record.promise.resolvedDate) : null,
        consequence: record.promise.consequence ? {
          ...record.promise.consequence,
          assessedDate: cloneDate(record.promise.consequence.assessedDate),
        } : null,
      } : null,
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


export function talentWatchlistForPlayer(
  engagement: WorldEngagementState,
  playerId: string,
): TalentWatchRecord[] {
  const normalizedPlayerId = normalizedNonEmpty(playerId, "playerId");
  return engagement.talentWatchlist.filter((record) => record.playerId === normalizedPlayerId);
}

export function talentIsWatched(
  engagement: WorldEngagementState | undefined,
  playerId: string,
  personId: Id,
): boolean {
  if (!engagement) return false;
  const normalizedPlayerId = normalizedNonEmpty(playerId, "playerId");
  return engagement.talentWatchlist.some((record) => (
    record.playerId === normalizedPlayerId && record.personId === personId
  ));
}

export function setTalentWatched(
  engagement: WorldEngagementState,
  playerId: string,
  personId: Id,
  watched: boolean,
  worldRevision: number,
): void {
  const normalizedPlayerId = normalizedNonEmpty(playerId, "playerId");
  const normalizedPersonId = normalizedNonEmpty(personId, "personId");
  if (!Number.isSafeInteger(worldRevision) || worldRevision < 0) throw new Error("watchlist World revision is invalid");

  const index = engagement.talentWatchlist.findIndex((record) => (
    record.playerId === normalizedPlayerId && record.personId === normalizedPersonId
  ));

  if (!watched) {
    if (index >= 0) engagement.talentWatchlist.splice(index, 1);
    return;
  }

  if (index >= 0) {
    engagement.talentWatchlist[index]!.addedAtRevision = worldRevision;
    return;
  }

  engagement.talentWatchlist.push({
    playerId: normalizedPlayerId,
    personId: normalizedPersonId,
    addedAtRevision: worldRevision,
  });
}

export function openBackstageConversation(
  engagement: WorldEngagementState,
  conversation: BackstageConversation,
): BackstageConversation {
  if (conversation.worldId !== engagement.worldId) throw new Error("Backstage conversation crosses World boundary");
  const conversationId = normalizedNonEmpty(conversation.conversationId, "conversationId", 240);
  if (engagement.backstageConversations.some((entry) => entry.conversationId === conversationId)) {
    throw new Error("Backstage conversation already exists");
  }
  if (conversation.status !== "OPEN" || conversation.response !== null || conversation.responseDate !== null) {
    throw new Error("new Backstage conversation must be unanswered");
  }
  if (conversation.kind === "ROLE_USAGE_CONCERN") {
    if (!["MAIN_EVENT", "UPPER_CARD"].includes(conversation.promisedRole ?? "")
      || !Number.isSafeInteger(conversation.observedMatchShows) || conversation.observedMatchShows < 4
      || !Number.isSafeInteger(conversation.observedFeaturedShows) || conversation.observedFeaturedShows !== 0) {
      throw new Error("Backstage concern requires eligible role-usage evidence");
    }
  } else if (conversation.kind === "TAG_TEAM_PITCH") {
    if (conversation.promisedRole !== null || !conversation.partnerPersonId
      || conversation.partnerPersonId === conversation.wrestlerId
      || !Number.isSafeInteger(conversation.sharedTagMatches) || (conversation.sharedTagMatches ?? 0) < 2
      || typeof conversation.averageCrowdResponse !== "number"
      || conversation.averageCrowdResponse < 65 || conversation.averageCrowdResponse > 100) {
      throw new Error("Backstage tag pitch requires grounded positive team evidence");
    }
  } else if (conversation.kind === "RIVALRY_PITCH") {
    if (conversation.promisedRole !== null || !conversation.rivalPersonId
      || conversation.rivalPersonId === conversation.wrestlerId
      || !Number.isSafeInteger(conversation.sharedSinglesMatches)
      || (conversation.sharedSinglesMatches ?? 0) < 2
      || typeof conversation.averageCrowdResponse !== "number"
      || conversation.averageCrowdResponse < 70 || conversation.averageCrowdResponse > 100
      || typeof conversation.professionalTrustAtPitch !== "number"
      || conversation.professionalTrustAtPitch < 60 || conversation.professionalTrustAtPitch > 100) {
      throw new Error("Backstage rivalry pitch requires verified match and trust evidence");
    }
  } else throw new Error("unsupported Backstage conversation kind");
  const stored = { ...conversation, conversationId, createdDate: cloneDate(conversation.createdDate), promise: null };
  engagement.backstageConversations.push(stored);
  return stored;
}

export function answerBackstageConversation(
  engagement: WorldEngagementState,
  conversationId: string,
  response: BackstageResponse,
  date: PpwDate,
  promise: BackstageBookingPromise | null = null,
): BackstageConversation {
  const id = normalizedNonEmpty(conversationId, "conversationId", 240);
  const concernReplies: BackstageResponse[] = ["HEAR_OUT", "EXPLAIN_PLAN", "STAND_FIRM", "PROMISE_FEATURED_BOOKING"];
  const pitchReplies: BackstageResponse[] = ["CONSIDER_TAG_TEAM", "PASS_TAG_TEAM"];
  const rivalryReplies: BackstageResponse[] = ["CONSIDER_RIVALRY", "PASS_RIVALRY"];
  if (![...concernReplies, ...pitchReplies, ...rivalryReplies].includes(response)) throw new Error("unsupported Backstage response");
  if ((response === "PROMISE_FEATURED_BOOKING") !== (promise !== null)) {
    throw new Error("a booking promise must have an explicit, tracked commitment");
  }
  if (promise && (promise.kind !== "FEATURED_MATCH" || promise.status !== "PENDING"
    || promise.resolvedDate !== null || promise.fulfilledEventId !== null)) {
    throw new Error("invalid Backstage promise");
  }
  const conversation = engagement.backstageConversations.find((entry) => entry.conversationId === id);
  if (!conversation) throw new Error("Backstage conversation not found");
  if (conversation.status !== "OPEN") throw new Error("Backstage conversation already answered");
  if (!(conversation.kind === "TAG_TEAM_PITCH" ? pitchReplies : conversation.kind === "RIVALRY_PITCH" ? rivalryReplies : concernReplies).includes(response)) {
    throw new Error("response does not match Backstage conversation type");
  }
  conversation.status = "ANSWERED";
  conversation.response = response;
  conversation.responseDate = cloneDate(date);
  conversation.promise = promise ? {
    ...promise, madeDate: cloneDate(promise.madeDate), dueDate: cloneDate(promise.dueDate),
  } : null;
  return conversation;
}
