/**
 * A wrestler's *fictional creative interests* derived from existing priorities
 * and persona. These values only rank optional Backstage ideas and indicate who
 * might approach the booker. They DO NOT modify scripted match outcomes, ratings,
 * chemistry, real-world personality, contract bargaining or wrestler strength.
 *
 * Deterministic across World reloads and shared controllers. No new gameplay
 * currency, random draws, or duplicate permanent attributes.
 */
import type { Person } from "../../domain/src/types.js";
import { wrestlerPersonalityFor } from "./wrestler-personality.js";

export const CREATIVE_INTERESTS = [
  "TEAM_PARTNERSHIPS", "STORY_RIVALRIES",
  "CHARACTER_REINVENTION", "PROMO_SPOTLIGHT",
] as const;
export type WrestlerCreativeInterest = (typeof CREATIVE_INTERESTS)[number];

export interface WrestlerCreativeInterestView {
  /** Top two fictional interests, not a real wrestler's stated preferences. */
  topInterests: WrestlerCreativeInterest[];
  origin: "DERIVED";
}

export function wrestlerCreativeInterestScores(person: Person): Record<WrestlerCreativeInterest, number> {
  const personality = wrestlerPersonalityFor(person);
  const { priorities, skills } = person;
  const bonuses = (interest: WrestlerCreativeInterest): number => {
    switch (personality.temperament) {
      case "COLLABORATIVE": return interest === "TEAM_PARTNERSHIPS" ? 18 : 0;
      case "AMBITIOUS": return interest === "STORY_RIVALRIES" ? 14 : interest === "PROMO_SPOTLIGHT" ? 7 : 0;
      case "INDEPENDENT": return interest === "CHARACTER_REINVENTION" ? 16 : 0;
      case "METHODICAL": return interest === "TEAM_PARTNERSHIPS" ? 8 : interest === "STORY_RIVALRIES" ? 8 : 0;
      case "SHOWMAN": return interest === "PROMO_SPOTLIGHT" ? 18 : interest === "CHARACTER_REINVENTION" ? 9 : 0;
      case "STEADY": return interest === "TEAM_PARTNERSHIPS" ? 13 : 0;
    }
  };
  const scores: Record<WrestlerCreativeInterest, number> = {
    TEAM_PARTNERSHIPS: priorities.loyalty * .45 + priorities.schedule * .24
      + skills.matchCraft * .12 + bonuses("TEAM_PARTNERSHIPS"),
    STORY_RIVALRIES: priorities.prestige * .32 + priorities.role * .35
      + skills.matchCraft * .13 + bonuses("STORY_RIVALRIES"),
    CHARACTER_REINVENTION: priorities.exposure * .38 + priorities.role * .17
      + skills.presentation * .20 + bonuses("CHARACTER_REINVENTION"),
    PROMO_SPOTLIGHT: priorities.exposure * .34 + priorities.prestige * .15
      + personality.microphoneAbility * .29 + bonuses("PROMO_SPOTLIGHT"),
  };
  return scores;
}

export function wrestlerCreativeInterestFor(person: Person): WrestlerCreativeInterestView {
  const scores = wrestlerCreativeInterestScores(person);
  return {
    topInterests: [...CREATIVE_INTERESTS].sort((a,b) => scores[b]-scores[a] || a.localeCompare(b)).slice(0,2),
    origin: "DERIVED",
  };
}

/**
 * Speakership is not consent or a wrestler taking autonomous creative control;
 * merely which fictional character sends a suggestion to their booker.
 */
export function chooseCreativePitchSpeaker(
  a: Person, b: Person, interest: WrestlerCreativeInterest,
): Person {
  const left = wrestlerCreativeInterestScores(a)[interest];
  const right = wrestlerCreativeInterestScores(b)[interest];
  return left > right ? a : right > left ? b : a.id.localeCompare(b.id) <= 0 ? a : b;
}
