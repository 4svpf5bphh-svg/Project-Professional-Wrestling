/**
 * Read-only, ledger-backed memory of significant on-screen wrestling angles.
 *
 * An authored story beat is NOT evidence that a real stable membership, contract,
 * relationship or match outcome has changed. Talent consequences will be
 * evaluated in a separate World Lock system once their rules are established.
 */
import type { Id, LedgerEvent, WorldState } from "../../domain/src/types.js";
import type { DetailedShowSegmentType } from "./planning.js";

const MEMORABLE_TYPES = new Set<DetailedShowSegmentType>([
  "CONFRONTATION", "INTERRUPTION", "CHALLENGE", "CONTRACT_SIGNING",
  "STABLE_INVITATION", "STABLE_EXIT", "STABLE_RECONCILIATION",
  "ATTACK", "RESCUE", "POST_MATCH_ASSAULT", "TURN",
]);

export type TalentStoryMemoryRole =
  | "PARTICIPANT" | "INITIATOR" | "TARGET"
  | "RECRUITER" | "INVITEE" | "STABLE_REPRESENTATIVE"
  | "DEPARTING_MEMBER" | "FORMER_MEMBER"
  | "ATTACKER" | "VICTIM" | "RESCUER"
  | "TURNING_WRESTLER" | "BETRAYED_WRESTLER";

export interface TalentStoryMemory {
  ledgerId: Id;
  personId: Id;
  eventId: Id;
  promotionId: Id;
  date: LedgerEvent["date"];
  segmentType: DetailedShowSegmentType;
  role: TalentStoryMemoryRole;
  counterpartPersonId: Id | null;
  stableId: Id | null;
  /** Frozen at show resolution, not read from the live stable roster. */
  stableName: string | null;
  /** The booker's chosen beat, never a simulated acceptance/refusal. */
  scriptedOutcome: string | null;
  /** Simulated delivery is separate from the story decision. */
  executionQuality: number | null;
  crowdResponse: number | null;
}

type Payload = LedgerEvent["payload"];

function payloadString(payload: Payload, key: string): string | null {
  const value = payload[key];
  return typeof value === "string" ? value : null;
}

function memoryRole(type: DetailedShowSegmentType, payload: Payload, personId: Id): TalentStoryMemoryRole {
  if (type === "TURN") {
    if (payloadString(payload, "turnPersonId") === personId) return "TURNING_WRESTLER";
    if (payloadString(payload, "betrayedPersonId") === personId) return "BETRAYED_WRESTLER";
  }
  if (type === "ATTACK" || type === "RESCUE" || type === "POST_MATCH_ASSAULT") {
    if (payloadString(payload, "attackerPersonId") === personId) return "ATTACKER";
    if (payloadString(payload, "victimPersonId") === personId) return "VICTIM";
    if (payloadString(payload, "rescuerPersonId") === personId) return "RESCUER";
  }
  const initiator = payloadString(payload, "initiatorPersonId");
  const target = payloadString(payload, "targetPersonId");
  if (type === "STABLE_INVITATION") {
    if (initiator === personId) return "RECRUITER";
    if (target === personId) return "INVITEE";
  }
  if (type === "STABLE_EXIT" || type === "STABLE_RECONCILIATION") {
    if (initiator === personId) return "STABLE_REPRESENTATIVE";
    if (target === personId) return type === "STABLE_EXIT" ? "DEPARTING_MEMBER" : "FORMER_MEMBER";
  }
  if (initiator === personId) return "INITIATOR";
  if (target === personId) return "TARGET";
  return "PARTICIPANT";
}

function scriptedBeat(type: DetailedShowSegmentType, payload: Payload): string | null {
  switch (type) {
    case "STABLE_INVITATION": return payloadString(payload, "stableInvitationOutcome");
    case "STABLE_EXIT": return payloadString(payload, "stableExitOutcome");
    case "STABLE_RECONCILIATION": return payloadString(payload, "stableReconciliationOutcome");
    case "CONTRACT_SIGNING": return payloadString(payload, "signingOutcome");
    case "CHALLENGE": return payloadString(payload, "challengeResponse");
    case "INTERRUPTION": return payloadString(payload, "interruptionOutcome");
    case "ATTACK": return payloadString(payload, "attackPresentation");
    case "TURN": return payloadString(payload, "turnTargetAlignment");
    default: return null;
  }
}

function counterpart(payload: Payload, personId: Id, participants: Id[]): Id | null {
  const actors = [
    payloadString(payload, "initiatorPersonId"),
    payloadString(payload, "targetPersonId"),
    payloadString(payload, "attackerPersonId"),
    payloadString(payload, "victimPersonId"),
    payloadString(payload, "rescuerPersonId"),
    payloadString(payload, "turnPersonId"),
    payloadString(payload, "betrayedPersonId"),
  ].filter((value): value is Id => value !== null && participants.includes(value));
  return actors.find((value) => value !== personId) ?? participants.find((value) => value !== personId) ?? null;
}

/**
 * The newest resolved story beats for one wrestler, without materializing a
 * second persistent memory store. Ledger entries are append-ordered at World
 * Lock; the scan is bounded by the requested number of matching memories.
 */
export function talentStoryMemoriesForPerson(
  state: WorldState,
  personId: Id,
  limit = 12,
): TalentStoryMemory[] {
  if (!Number.isInteger(limit) || limit < 1 || limit > 50) {
    throw new Error("talent story memory limit must be an integer from 1 to 50");
  }
  const memories: TalentStoryMemory[] = [];
  for (let index = state.ledger.length - 1; index >= 0 && memories.length < limit; index -= 1) {
    const entry = state.ledger[index]!;
    if (entry.type !== "SHOW_SEGMENT_COMPLETED") continue;
    const type = payloadString(entry.payload, "segmentType");
    if (!type || !MEMORABLE_TYPES.has(type as DetailedShowSegmentType)) continue;
    const participants = (payloadString(entry.payload, "participantIds") ?? "").split(",").filter(Boolean);
    if (!participants.includes(personId)) continue;
    const eventId = payloadString(entry.payload, "eventId");
    const promotionId = payloadString(entry.payload, "promotionId");
    if (!eventId || !promotionId) continue;

    const segmentType = type as DetailedShowSegmentType;
    const quality = entry.payload.segmentExecutionQuality;
    const crowd = entry.payload.segmentCrowdResponse;
    memories.push({
      ledgerId: entry.id,
      personId,
      eventId,
      promotionId,
      date: { ...entry.date },
      segmentType,
      role: memoryRole(segmentType, entry.payload, personId),
      counterpartPersonId: counterpart(entry.payload, personId, participants),
      stableId: payloadString(entry.payload, "stableId"),
      stableName: payloadString(entry.payload, "stableName"),
      scriptedOutcome: scriptedBeat(segmentType, entry.payload),
      executionQuality: typeof quality === "number" && Number.isFinite(quality) ? quality : null,
      crowdResponse: typeof crowd === "number" && Number.isFinite(crowd) ? crowd : null,
    });
  }
  return memories;
}
