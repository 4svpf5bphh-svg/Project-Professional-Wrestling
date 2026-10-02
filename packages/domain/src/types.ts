export type Id = string;

export type PromotionTier = "GLOBAL" | "NATIONAL" | "RISING" | "INDEPENDENT" | "LOCAL";
export type PromotionLifecycle = "FOUNDING" | "ACTIVE" | "DISTRESSED" | "STEWARDED" | "DORMANT" | "CLOSED";
export type ControllerType = "AI" | "HUMAN";
export type CareerStage = "PROSPECT" | "PRIME" | "VETERAN" | "SPECIAL_ATTRACTION";
export type PersonStatus = "ACTIVE" | "INJURED" | "RETIRED";
export type LedgerSignificance = "ROUTINE" | "NOTABLE" | "MAJOR" | "HISTORIC";

export interface PpwDate {
  year: number;
  week: number;
  day: number;
}

export interface Ruleset {
  version: string;
  weeksPerYear: number;
  markets: number;
  promotions: number;
  wrestlers: number;
  initialContractedTalentRatio: number;
  careerTimeFactor: number;
}

export interface World {
  id: Id;
  name: string;
  seed: number;
  rulesetVersion: string;
  currentDate: PpwDate;
  createdAtIso: string;
}

export interface Market {
  id: Id;
  worldId: Id;
  name: string;
  audiencePotential: number;
  wrestlingInterest: number;
  spendingIndex: number;
  maturity: number;
}

export interface AiProfile {
  financialCaution: number;
  starPreference: number;
  developmentPreference: number;
  matchQualityPreference: number;
  expansionAggression: number;
  loyalty: number;
  riskTolerance: number;
}

export interface Promotion {
  id: Id;
  worldId: Id;
  name: string;
  tier: PromotionTier;
  lifecycle: PromotionLifecycle;
  controllerType: ControllerType;
  homeMarketId: Id;
  cash: number;
  debt: number;
  mediaReach: number;
  aiProfile: AiProfile;
  rosterPersonIds: Id[];
}

export interface WrestlerSkills {
  inRingQuality: number;
  matchCraft: number;
  safety: number;
  stamina: number;
  presentation: number;
}

export interface WrestlerPriorities {
  money: number;
  role: number;
  prestige: number;
  schedule: number;
  loyalty: number;
  exposure: number;
}

export interface Person {
  id: Id;
  worldId: Id;
  name: string;
  careerStage: CareerStage;
  status: PersonStatus;
  homeMarketId: Id;
  fatigue: number;
  wear: number;
  morale: number;
  momentum: number;
  recognition: number;
  popularity: number;
  skills: WrestlerSkills;
  priorities: WrestlerPriorities;
  contractedPromotionId: Id | null;
}

export interface LedgerEvent {
  id: Id;
  worldId: Id;
  date: PpwDate;
  order: number;
  type: string;
  significanceAtTime: LedgerSignificance;
  historicalSignificance: LedgerSignificance;
  entityIds: Id[];
  payload: Record<string, string | number | boolean | null>;
}

export interface WorldState {
  world: World;
  ruleset: Ruleset;
  markets: Market[];
  promotions: Promotion[];
  people: Person[];
  ledger: LedgerEvent[];
}
