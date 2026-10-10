/**
 * Promotion-owned character presentation.
 *
 * The World shares the person and their underlying athletic attributes; each
 * promotion owns the fictional character it presents. Nothing in this module
 * changes match results, wrestler skills, contracts, or online activity power.
 */
import type { Id, Person, PpwDate, WorldState } from "../../domain/src/types.js";
import { currentRosterPersonIds } from "../../sim-core/src/contracts.js";
import { deterministicSeedFromText } from "../../sim-core/src/rng.js";
import {
  executeIdempotentCommand, type ApplicationCommandEnvelope, type WorldCommandState,
} from "./commands.js";
import {
  activeWorldMembership, playerControlsPromotion, type WorldOwnershipState,
} from "./ownership.js";
import type { WorldRuntimeState } from "./runtime.js";
import type { WorldEngagementState } from "./engagement.js";

export const WRESTLING_STYLES = [
  "ALL_ROUNDER", "TECHNICAL", "BRAWLER", "HIGH_FLYER",
  "POWERHOUSE", "STRIKER", "SUBMISSION", "LUCHA", "STRONG_STYLE",
] as const;
export type WrestlingStyle = (typeof WRESTLING_STYLES)[number];

import { GIMMICK_ARCHETYPES } from "./gimmick-catalog.js";
import type { GimmickId } from "./gimmick-catalog.js";
import { curatedCharacterFor } from "../../content/src/real-wrestler-characters.js";

export { GIMMICK_ARCHETYPES };
export type GimmickArchetype = GimmickId;

export const MOVE_CATEGORIES = ["STRIKE","GRAPPLE","SUBMISSION","AERIAL","POWER","OTHER"] as const;
export type MoveCategory = (typeof MOVE_CATEGORIES)[number];

export interface NamedWrestlingMove {
  name: string;
  category: MoveCategory;
}
export interface WrestlerCreativeFields {
  ringName: string;
  gimmickArchetype: GimmickArchetype;
  gimmickDescription: string;
  primaryStyle: WrestlingStyle;
  secondaryStyle: WrestlingStyle | null;
  signatureMove: NamedWrestlingMove | null;
  finishingMove: NamedWrestlingMove | null;
}

export interface WrestlerCreativeChange {
  date: PpwDate;
  revision: number;
  previous: WrestlerCreativeFields;
  next: WrestlerCreativeFields;
}
export interface WrestlerCreativeRecord {
  worldId: Id;
  promotionId: Id;
  personId: Id;
  fields: WrestlerCreativeFields;
  changedDate: PpwDate;
  history: WrestlerCreativeChange[];
}

/** Non-competitive legacy fallback. It is not a scouting claim or rating. */
export function baselineWrestlingStyle(person: Person): WrestlingStyle {
  const hash = deterministicSeedFromText("ppw-style:" + person.id);
  const scores: Array<{ style: WrestlingStyle; score: number }> = [
    { style:"ALL_ROUNDER",score:person.skills.inRingQuality * 0.4 + person.skills.matchCraft * 0.3 + 13 },
    { style:"TECHNICAL",score:person.skills.matchCraft * 0.58 + person.skills.safety * 0.2 + 12 },
    { style:"BRAWLER",score:person.skills.presentation * 0.42 + person.skills.stamina * 0.18 + 14 },
    { style:"HIGH_FLYER",score:person.skills.stamina * 0.45 + person.skills.inRingQuality * 0.26 + 8 },
    { style:"POWERHOUSE",score:person.skills.presentation * 0.46 + person.skills.inRingQuality * 0.19 + 10 },
    { style:"STRIKER",score:person.skills.inRingQuality * 0.39 + person.skills.stamina * 0.28 + 9 },
    { style:"SUBMISSION",score:person.skills.matchCraft * 0.56 + person.skills.safety * 0.16 + 11 },
    { style:"LUCHA",score:person.skills.stamina * 0.48 + person.skills.inRingQuality * 0.25 + 8 },
    { style:"STRONG_STYLE",score:person.skills.inRingQuality * 0.40 + person.skills.matchCraft * 0.27 + 11 },
  ];
  return [...scores].sort((a,b) => (b.score + ((hash >>> (WRESTLING_STYLES.indexOf(b.style) % 16)) & 15) * 0.9)
    - (a.score + ((hash >>> (WRESTLING_STYLES.indexOf(a.style) % 16)) & 15) * 0.9)
    || a.style.localeCompare(b.style))[0]!.style;
}

export function defaultWrestlerCreativeFields(person: Person): WrestlerCreativeFields {
  const real = curatedCharacterFor(person.name);
  return {
    ringName: person.name,
    gimmickArchetype: real?.gimmickArchetype ?? "AUTHENTIC",
    gimmickDescription: "",
    primaryStyle: real?.primaryStyle ?? baselineWrestlingStyle(person),
    secondaryStyle: real?.secondaryStyle ?? null,
    signatureMove: real?.signatureMove ? {...real.signatureMove} : null,
    finishingMove: real?.finishingMove ? {...real.finishingMove} : null,
  };
}

export function wrestlerCreativeProfileFor(
  engagement: WorldEngagementState | undefined,
  promotionId: Id,
  person: Person,
): WrestlerCreativeFields {
  const entry = (engagement?.wrestlerCreativeProfiles ?? [])
    .find((record) => record.promotionId === promotionId && record.personId === person.id);
  const baseline=defaultWrestlerCreativeFields(person);
  if (!entry) return baseline;
  // Read-only legacy enrichment: older Worlds may have saved the previous
  // blank/default character. Explicit player changes always take precedence.
  // No existing historical revision is altered by an updated curation file.
  const edited=<K extends keyof WrestlerCreativeFields>(key:K):boolean =>
    (entry.history??[]).some(change=>JSON.stringify(change.previous[key])!==JSON.stringify(change.next[key]));
  return structuredClone({
    ...entry.fields,
    gimmickArchetype:entry.fields.gimmickArchetype==="AUTHENTIC" && !edited("gimmickArchetype")
      ? baseline.gimmickArchetype:entry.fields.gimmickArchetype,
    primaryStyle:!edited("primaryStyle") ? baseline.primaryStyle:entry.fields.primaryStyle,
    signatureMove:entry.fields.signatureMove===null && !edited("signatureMove")
      ? baseline.signatureMove:entry.fields.signatureMove,
    finishingMove:entry.fields.finishingMove===null && !edited("finishingMove")
      ? baseline.finishingMove:entry.fields.finishingMove,
  });
}

function bounded(value: unknown, field: string, max: number, required = false): string {
  if (typeof value !== "string") throw new Error(field + " must be text");
  const text = value.trim();
  if ((required && !text) || text.length > max) throw new Error(field + " must contain " + (required ? "1–" : "0–") + max + " characters");
  return text;
}
function member<T extends string>(value: unknown, choices: readonly T[], field: string): T {
  if (!choices.includes(value as T)) throw new Error("unsupported " + field);
  return value as T;
}
function namedMove(value: NamedWrestlingMove | null, field: string): NamedWrestlingMove | null {
  if (value === null) return null;
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(field + " must be a named move or null");
  return {
    name: bounded(value.name, field + " name", 80, true),
    category: member(value.category, MOVE_CATEGORIES, field + " type"),
  };
}
export function normalizeWrestlerCreativeFields(fields: WrestlerCreativeFields): WrestlerCreativeFields {
  if (!fields || typeof fields !== "object" || Array.isArray(fields)) throw new Error("creative profile must be an object");
  const primaryStyle = member(fields.primaryStyle, WRESTLING_STYLES, "primary wrestling style");
  const secondaryStyle = fields.secondaryStyle === null ? null
    : member(fields.secondaryStyle, WRESTLING_STYLES, "secondary wrestling style");
  if (primaryStyle === secondaryStyle) throw new Error("secondary wrestling style must differ from primary");
  return {
    ringName: bounded(fields.ringName, "ring name", 60, true),
    gimmickArchetype: member(fields.gimmickArchetype, GIMMICK_ARCHETYPES, "gimmick archetype"),
    gimmickDescription: bounded(fields.gimmickDescription, "gimmick description", 240),
    primaryStyle,
    secondaryStyle,
    signatureMove: namedMove(fields.signatureMove, "signature move"),
    finishingMove: namedMove(fields.finishingMove, "finishing move"),
  };
}

export interface SetWrestlerCreativeProfilePayload {
  promotionId: Id;
  personId: Id;
  fields: WrestlerCreativeFields;
}

export function setWrestlerCreativeProfileCommand(
  state: WorldState,
  engagement: WorldEngagementState,
  ownership: WorldOwnershipState,
  commands: WorldCommandState,
  runtime: WorldRuntimeState,
  envelope: ApplicationCommandEnvelope<SetWrestlerCreativeProfilePayload>,
): WrestlerCreativeRecord | null {
  if (envelope.commandType !== "SET_WRESTLER_CREATIVE_PROFILE") throw new Error("incorrect wrestler creative command");
  return executeIdempotentCommand(commands, runtime, envelope, state.world.currentDate, () => {
    const { promotionId, personId } = envelope.payload;
    if (envelope.worldId !== state.world.id || engagement.worldId !== state.world.id
      || ownership.worldId !== state.world.id) throw new Error("creative profile crosses World boundary");
    if (!activeWorldMembership(ownership, envelope.playerId)
      || !playerControlsPromotion(ownership, envelope.playerId, promotionId)) {
      throw new Error("you do not control this promotion");
    }
    if (!state.people.some((person) => person.id === personId)) throw new Error("unknown wrestler");
    if (!currentRosterPersonIds(state,promotionId).includes(personId)) {
      throw new Error("creative presentation requires a wrestler on your active roster");
    }
    const next = normalizeWrestlerCreativeFields(envelope.payload.fields);
    const record = (engagement.wrestlerCreativeProfiles ??= [])
      .find((candidate) => candidate.promotionId === promotionId && candidate.personId === personId);
    const person = state.people.find((entry) => entry.id === personId)!;
    const previous = wrestlerCreativeProfileFor(engagement,promotionId,person);
    if (JSON.stringify(previous) === JSON.stringify(next)) return record ? structuredClone(record) : null;
    const update: WrestlerCreativeChange = {
      date: { ...state.world.currentDate },
      revision: runtime.revision + 1,
      previous: structuredClone(previous),
      next: structuredClone(next),
    };
    if (record) {
      record.fields = next;
      record.changedDate = { ...state.world.currentDate };
      record.history.push(update);
      return structuredClone(record);
    }
    const created: WrestlerCreativeRecord = {
      worldId: state.world.id,promotionId,personId,
      fields: next,changedDate: { ...state.world.currentDate },
      history: [update],
    };
    engagement.wrestlerCreativeProfiles!.push(created);
    return structuredClone(created);
  });
}
