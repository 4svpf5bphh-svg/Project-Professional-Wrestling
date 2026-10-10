/**
 * Deterministic fictional Backstage voice. The simulation decides whether real,
 * verified evidence warrants a conversation; this layer merely phrases it.
 * An inferred/curated temperament is a game descriptor, never a real-life claim.
 *
 * Contractual details, completed bouts, shared teams and presented gimmicks
 * originate in the frozen conversation. No wins, betrayals, turns, contract
 * terms or scripted actions are inferred. No effects or random draws.
 */
import type { Person, Id } from "../../domain/src/types.js";
import { deterministicSeedFromText } from "../../sim-core/src/rng.js";
import type { BackstageConversation } from "./engagement.js";
import {
  wrestlerPersonalityFor,
  type BackstageTemperament,
  type PersonalityMotivation,
} from "./wrestler-personality.js";

export interface BackstageDialogue {
  speech: string;
  /** Describes fictional dialogue treatment, not a factual trait. */
  voice: BackstageTemperament | "NEUTRAL";
}

/** Safe helper: all context is a display value from known, frozen match data. */
function printableName(name: string | undefined): string {
  return name?.trim().slice(0, 80) || "that wrestler";
}
function title(value: string | undefined): string {
  return value?.replaceAll("_", " ").toLowerCase() || "a new character";
}
function scene(
  entry: BackstageConversation,
  names: Map<Id,string>,
): string {
  switch (entry.kind) {
    case "ROLE_USAGE_CONCERN":
      return `My deal was for a ${entry.promisedRole === "MAIN_EVENT" ? "main-event" : "featured upper-card"} spot, and I've worked ${entry.observedMatchShows} matches without getting that position. What's the plan for me?`;
    case "TAG_TEAM_PITCH":
      return `I've worked ${entry.sharedTagMatches ?? 0} tag matches with ${printableName(names.get(entry.partnerPersonId ?? ""))}, and the crowd's been responding. Could we try building us as a proper team?`;
    case "RIVALRY_PITCH":
      return `${printableName(names.get(entry.rivalPersonId ?? ""))} and I have had ${entry.sharedSinglesMatches ?? 0} singles matches the crowd got into. I reckon there's a programme there, if you want to book it.`;
    case "TEAM_MOMENT":
      return `The tag matches with ${printableName(names.get(entry.partnerPersonId ?? ""))} are clicking. We've got ${entry.sharedTagMatches ?? 0} good recent outings together. Feels like we're finding our rhythm.`;
    case "GIMMICK_CHANGE_PITCH":
      return `It's been ${entry.observedMatchShows} matches and the crowds aren't connecting as much as we'd hoped. I wonder if a ${title(entry.suggestedGimmickArchetype)} direction could work better than the current ${title(entry.currentGimmickArchetype)} character. What do you think?`;
  }
}
const openings: Record<BackstageTemperament, readonly [string,string]> = {
  COLLABORATIVE: [
    "Got a minute? I'd like to work something through with you.",
    "I've been thinking about what we can do together here.",
  ],
  AMBITIOUS: [
    "I'm here to make an impact, not just fill a spot on the card.",
    "I want to move this thing forward and earn a bigger moment.",
  ],
  INDEPENDENT: [
    "I'll tell you what I'm thinking, straight up.",
    "I've got an idea of my own. Hear me out.",
  ],
  METHODICAL: [
    "I've looked at how the last few shows went.",
    "Let's talk through what the work in the ring is telling us.",
  ],
  SHOWMAN: [
    "You know when something gets the building buzzing?",
    "This business is about making the people care, right?",
  ],
  STEADY: [
    "No drama, but can we talk about how things are going?",
    "I know the long game matters. I've got a thought.",
  ],
};
const endings: Record<PersonalityMotivation, string> = {
  TOP_BILLING: "I want to earn a meaningful place on the card.",
  MONEY: "Let's make the dates we're working count.",
  PRESTIGE: "I'd like to make it something worth remembering.",
  ROUTINE: "A clear plan from week to week would help.",
  LOYALTY: "I want this promotion to get something good out of it.",
  EXPOSURE: "It's a chance to connect with more of the crowd.",
};

export function buildBackstageDialogue(
  entry: BackstageConversation,
  person: Person | undefined,
  names: Map<Id,string>,
): BackstageDialogue {
  const evidence = scene(entry,names);
  if (!person) return {speech:evidence,voice:"NEUTRAL"};
  const personality = wrestlerPersonalityFor(person);
  const tone = personality.temperament;
  const variant = deterministicSeedFromText("ppw:backstage-voice:v1:" + entry.conversationId) % 2;
  const prefix = openings[tone][variant];
  const motivation = personality.motivations[0] ?? "PRESTIGE";
  // Positive news isn't a request for anything and should not end with
  // an implied demand for a reward or push.
  const suffix = entry.kind === "TEAM_MOMENT" ? "" : " " + endings[motivation];
  return {speech:`${prefix} ${evidence}${suffix}`,voice:tone};
}
