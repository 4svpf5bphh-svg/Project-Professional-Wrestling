import type { Id } from "./types.js";

export interface PromotionTalentTrust {
  worldId: Id;
  promotionId: Id;
  personId: Id;
  trust: number;
  lastEvaluatedYear: number;
}

declare module "./types.js" {
  interface WorldState {
    promotionTalentTrust?: PromotionTalentTrust[];
  }
}
