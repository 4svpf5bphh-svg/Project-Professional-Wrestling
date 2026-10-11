/**
 * Auditable public real-world persona references, independent of PPW chronology.
 * These are NOT real-time active-character claims, in-game unlocks, or wrestler
 * attitudes. Documented real-world personas MUST NOT be inserted into a saved
 * World's active identity or history until an authorised player decision.
 *
 * Historical/alternate entries intentionally have no PPW dates and no imagined
 * moves: a real-world debut year is not a week in an alternate PPW World.
 * The cited source describes the name/character but does not establish that
 * it is the subject's currently active presentation in this game's fiction.
 */
export const VERIFIED_ALTERNATE_PERSONAS = [
  {
    "personName": "Finn Bálor",
    "personaName": "The Demon",
    "kind": "RECURRING_ALTER_EGO",
    "gimmickId": "DEMON",
    "sourceUrl": "https://www.wwe.com/shows/raw/2016-08-15"
  },
  {
    "personName": "Cody Rhodes",
    "personaName": "Stardust",
    "kind": "HISTORICAL_CHARACTER",
    "gimmickId": "ECCENTRIC",
    "sourceUrl": "https://www.wwe.com/shows/raw/2015-02-16/dusty-rhodes-family-retrospective"
  },
  {
    "personName": "Jack Perry",
    "personaName": "Jungle Boy",
    "kind": "HISTORICAL_CHARACTER",
    "gimmickId": "FAN_FAVOURITE",
    "sourceUrl": "https://www.allelitewrestling.com/post/aew-collision-preview-for-september-14-2024"
  },
  {
    "personName": "Matt Hardy",
    "personaName": "Broken Matt Hardy",
    "kind": "RECURRING_ALTER_EGO",
    "gimmickId": "ECCENTRIC",
    "sourceUrl": "https://www.allelitewrestling.com/post/aew-dynamite-results-for-june-24-2020"
  },
  {
    "personName": "Adam Copeland",
    "personaName": "Edge",
    "kind": "FORMER_RING_NAME",
    "gimmickId": "OPPORTUNIST",
    "sourceUrl": "https://www.wwe.com/classics/wwe-hall-of-fame/edge-career-history"
  },
  {
    "personName": "Matt Cardona",
    "personaName": "Zack Ryder",
    "kind": "FORMER_RING_NAME",
    "gimmickId": "FAN_FAVOURITE",
    "sourceUrl": "https://www.wwe.com/superstars/matt-cardona"
  },
  {
    "personName": "Chris Jericho",
    "personaName": "The Painmaker",
    "kind": "RECURRING_ALTER_EGO",
    "gimmickId": "DARK_ANTI_HERO",
    "sourceUrl": "https://www.allelitewrestling.com/post/aew-dynamite-preview-for-june-28-2023"
  },
  {
    "personName": "Luchasaurus",
    "personaName": "Killswitch",
    "kind": "HISTORICAL_CHARACTER",
    "gimmickId": "MONSTER",
    "sourceUrl": "https://www.allelitewrestling.com/post/aew-dynamite-preview-for-may-29-2024"
  },
  {
    "personName": "Nic Nemeth",
    "personaName": "Dolph Ziggler",
    "kind": "FORMER_RING_NAME",
    "gimmickId": "SHOW_OFF",
    "sourceUrl": "https://www.wwe.com/superstars/dolph-ziggler"
  }
] as const;

export type VerifiedAlternatePersona = (typeof VERIFIED_ALTERNATE_PERSONAS)[number];
/** A read-only list for exact seeded identities; returns a detached copy. */
export function alternatePersonaReferencesFor(name:string): VerifiedAlternatePersona[] {
  const normalized=name.trim().toLocaleLowerCase("en-GB");
  return VERIFIED_ALTERNATE_PERSONAS.filter(entry=>
    entry.personName.toLocaleLowerCase("en-GB")===normalized
  ).map(entry=>({...entry}));
}
