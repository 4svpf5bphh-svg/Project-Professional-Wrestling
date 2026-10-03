export type Id = string;

export type PromotionTier = "GLOBAL" | "NATIONAL" | "RISING" | "INDEPENDENT" | "LOCAL";
export type PromotionLifecycle = "FOUNDING" | "ACTIVE" | "DISTRESSED" | "STEWARDED" | "DORMANT" | "CLOSED";
export type ControllerType = "AI" | "HUMAN";
export type CareerStage = "PROSPECT" | "PRIME" | "VETERAN" | "SPECIAL_ATTRACTION";
export type PersonStatus = "ACTIVE" | "INJURED" | "RETIRED";
export type LedgerSignificance = "ROUTINE" | "NOTABLE" | "MAJOR" | "HISTORIC";
export type FinancialDistressState = "HEALTHY" | "WATCH" | "DISTRESSED" | "CRISIS";
export type FinancialTransactionCategory =
  | "MEDIA_INCOME"
  | "SPONSOR_INCOME"
  | "FIXED_OVERHEAD"
  | "CONTRACT_GUARANTEE"
  | "CONTRACT_SIGNING_BONUS"
  | "GATE_REVENUE"
  | "VENUE_COST"
  | "PRODUCTION_COST"
  | "TRAVEL_COST"
  | "APPEARANCE_FEE"
  | "RESTRUCTURING_SETTLEMENT";

export type ContractFamily = "ONE_OFF" | "LIMITED_NON_EXCLUSIVE" | "EXCLUSIVE";
export type ExclusivityType = "OPEN" | "NON_EXCLUSIVE" | "EXCLUSIVE";
export type ContractStatus = "SIGNED" | "EXPIRED" | "TERMINATED";
export type ContractOfferStatus = "PENDING" | "ACCEPTED" | "REJECTED" | "WITHDRAWN";
export type RoleExpectation = "MAIN_EVENT" | "UPPER_CARD" | "FEATURED" | "REGULAR" | "DEVELOPMENTAL" | "SPECIAL_ATTRACTION";
export type TicketStrategy = "ACCESSIBLE" | "STANDARD" | "PREMIUM" | "PRESTIGE";
export type WrestlingEventType = "REGULAR" | "MAJOR";
export type WrestlingEventStatus = "SCHEDULED" | "COMPLETED" | "CANCELLED";
export type ScheduledAppearanceStatus = "COMMITTED" | "COMPLETED" | "CANCELLED";
export type MatchType = "SINGLES" | "TAG";
export type MatchIntent = "COMPETITIVE" | "SHOWCASE" | "DOMINANT" | "TECHNICAL" | "HIGH_RISK" | "STORY" | "PROTECTIVE" | "EPIC";
export type MatchStatus = "SCHEDULED" | "COMPLETED" | "CANCELLED";
export type MatchSide = "A" | "B";
export type InjurySeverity = "MINOR" | "MODERATE" | "MAJOR" | "SEVERE";
export type InjuryStatus = "ACTIVE" | "RECOVERED";
export type ChemistryContext = "SINGLES" | "TAG";
export type TeamStatus = "ACTIVE" | "DISBANDED";
export type ChampionshipDivision = "SINGLES" | "TAG";
export type ChampionshipStatus = "ACTIVE" | "INACTIVE";
export type ChampionshipHolderType = "PERSON" | "TEAM";
export type ChampionshipReignStatus = "ACTIVE" | "ENDED";
export type ChampionshipReignEndReason = "LOST" | "VACATED" | "PROMOTION_DORMANT" | "CONTRACT_ENDED" | "RETIRED" | "TEAM_INACTIVE";

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
  renewalWindowWeeks: number;
  maxRecruitmentOffersPerPromotionPerWeek: number;
  offerAcceptanceThreshold: number;
  majorEventIntervalWeeks: number;
  minEventParticipants: number;
  injuryRateMultiplier: number;
  fatigueRecoveryBase: number;
  developmentRate: number;
  retirementBaseAge: number;
  talentGenerationFloorRatio: number;
  maxProspectsGeneratedPerWeek: number;
  survivalEvaluationIntervalWeeks: number;
  survivalDistressThresholdWeeks: number;
  survivalCrisisDormancyWeeks: number;
  survivalUnderstaffedDormancyWeeks: number;
  survivalRecoveryWeeks: number;
  survivalMinimumRosterRatio: number;
  survivalEmergencyRecruitmentPerCycle: number;
  survivalRestructureIntervalWeeks: number;
  teamRecognitionMatches: number;
  singlesTitleDefenseIntervalWeeks: number;
  tagTitleDefenseIntervalWeeks: number;
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

export interface Venue {
  id: Id;
  worldId: Id;
  marketId: Id;
  name: string;
  capacity: number;
  weeklyHireCost: number;
  prestige: number;
  productionSuitability: number;
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
  weeklyMediaIncome: number;
  weeklySponsorIncome: number;
  weeklyFixedOverhead: number;
  lastWeeklyNet: number;
  runwayWeeks: number | null;
  financialDistress: FinancialDistressState;
  eventCadenceWeeks: number;
  aiProfile: AiProfile;
}

export interface PromotionStanding {
  worldId: Id;
  promotionId: Id;
  prestige: number;
  fanReputation: number;
  businessReputation: number;
  lastEvaluatedYear: number;
}

export interface PromotionSurvivalState {
  worldId: Id;
  promotionId: Id;
  baselineWeeklyFixedOverhead: number;
  baselineEventCadenceWeeks: number;
  stressWeeks: number;
  crisisWeeks: number;
  understaffedWeeks: number;
  healthyWeeks: number;
  restructuringCount: number;
  lastRestructureWeekIndex: number | null;
  dormantSince: PpwDate | null;
}

export interface PromotionMarketState {
  worldId: Id;
  promotionId: Id;
  marketId: Id;
  awareness: number;
  liveStrength: number;
  loyalty: number;
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
  biologicalAge: number;
  careerExperience: number;
  developmentAptitude: number;
  debutDate: PpwDate;
  generatedTalent: boolean;
  fatigue: number;
  wear: number;
  morale: number;
  momentum: number;
  recognition: number;
  popularity: number;
  skills: WrestlerSkills;
  priorities: WrestlerPriorities;
}

export interface ContractTerms {
  family: ContractFamily;
  exclusivity: ExclusivityType;
  roleExpectation: RoleExpectation;
  startDate: PpwDate;
  endDate: PpwDate;
  dateEntitlement: number;
  weeklyGuarantee: number;
  appearanceFee: number;
  signingBonus: number;
}

export interface Contract extends ContractTerms {
  id: Id;
  worldId: Id;
  personId: Id;
  promotionId: Id;
  status: ContractStatus;
  datesUsed: number;
  signedDate: PpwDate;
  sourceOfferId: Id | null;
}

export interface ContractOffer extends ContractTerms {
  id: Id;
  worldId: Id;
  personId: Id;
  promotionId: Id;
  submittedDate: PpwDate;
  status: ContractOfferStatus;
  offerKind: "RECRUITMENT" | "RENEWAL";
  resolvedUtility: number | null;
  rejectionReason: string | null;
}

export interface WrestlingEvent {
  id: Id;
  worldId: Id;
  promotionId: Id;
  marketId: Id;
  venueId: Id;
  date: PpwDate;
  type: WrestlingEventType;
  status: WrestlingEventStatus;
  ticketStrategy: TicketStrategy;
  expectedDemand: number;
  attendance: number;
  ticketYield: number;
  gateRevenue: number;
  totalCost: number;
  netResult: number;
  eventImportance: number;
  matchCount: number;
  averageMatchRating: number;
  bestMatchRating: number;
  crowdResponse: number;
}

export interface ScheduledAppearance {
  id: Id;
  worldId: Id;
  eventId: Id;
  promotionId: Id;
  personId: Id;
  contractId: Id;
  date: PpwDate;
  serviceCapacityAtBooking: number;
  status: ScheduledAppearanceStatus;
}

export interface Match {
  id: Id;
  worldId: Id;
  eventId: Id;
  promotionId: Id;
  order: number;
  type: MatchType;
  status: MatchStatus;
  intent: MatchIntent;
  plannedLengthMinutes: number;
  actualLengthMinutes: number;
  intendedWinnerSide: MatchSide;
  actualWinnerSide: MatchSide | null;
  finishChangedDueToInjury: boolean;
  executionQuality: number;
  criticalRatingStars: number;
  crowdResponse: number;
}

export interface MatchParticipant {
  id: Id;
  worldId: Id;
  matchId: Id;
  eventId: Id;
  personId: Id;
  side: MatchSide;
  won: boolean;
}

export interface Injury {
  id: Id;
  worldId: Id;
  personId: Id;
  matchId: Id;
  eventId: Id;
  date: PpwDate;
  severity: InjurySeverity;
  weeksOut: number;
  weeksRemaining: number;
  status: InjuryStatus;
}

export interface WorkingChemistry {
  id: Id;
  worldId: Id;
  personAId: Id;
  personBId: Id;
  context: ChemistryContext;
  compatibility: number;
  familiarity: number;
  matchesTogether: number;
}

export interface Team {
  id: Id;
  worldId: Id;
  name: string;
  status: TeamStatus;
  formedDate: PpwDate;
  disbandedDate: PpwDate | null;
}

export interface TeamMembership {
  id: Id;
  worldId: Id;
  teamId: Id;
  personId: Id;
  joinedDate: PpwDate;
  leftDate: PpwDate | null;
  active: boolean;
}

export interface Championship {
  id: Id;
  worldId: Id;
  promotionId: Id;
  name: string;
  division: ChampionshipDivision;
  status: ChampionshipStatus;
  prestige: number;
  currentReignId: Id | null;
  createdDate: PpwDate;
}

export interface ChampionshipReign {
  id: Id;
  worldId: Id;
  championshipId: Id;
  holderType: ChampionshipHolderType;
  holderId: Id;
  status: ChampionshipReignStatus;
  startDate: PpwDate;
  endDate: PpwDate | null;
  wonMatchId: Id | null;
  lostMatchId: Id | null;
  defenses: number;
  endReason: ChampionshipReignEndReason | null;
}

export interface ChampionshipContest {
  id: Id;
  worldId: Id;
  championshipId: Id;
  matchId: Id;
  eventId: Id;
  date: PpwDate;
  previousHolderId: Id | null;
  winnerHolderId: Id;
  titleChanged: boolean;
}

export interface FinancialTransaction {
  id: Id;
  worldId: Id;
  promotionId: Id;
  date: PpwDate;
  category: FinancialTransactionCategory;
  amount: number;
  source: string;
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
  venues: Venue[];
  promotions: Promotion[];
  promotionMarketStates: PromotionMarketState[];
  promotionStandings?: PromotionStanding[];
  promotionSurvivalStates?: PromotionSurvivalState[];
  people: Person[];
  contracts: Contract[];
  contractOffers: ContractOffer[];
  events: WrestlingEvent[];
  scheduledAppearances: ScheduledAppearance[];
  matches: Match[];
  matchParticipants: MatchParticipant[];
  injuries: Injury[];
  workingChemistry: WorkingChemistry[];
  teams?: Team[];
  teamMemberships?: TeamMembership[];
  championships?: Championship[];
  championshipReigns?: ChampionshipReign[];
  championshipContests?: ChampionshipContest[];
  financialTransactions: FinancialTransaction[];
  ledger: LedgerEvent[];
}
