import type { WrestlerAlignment } from "./alignment.js";
import type { Id, PpwDate } from "./types.js";

export interface PromotionWrestlerPresentation {
  worldId: Id;
  promotionId: Id;
  personId: Id;
  alignment: WrestlerAlignment;
  changedDate: PpwDate;
}

declare module "./types.js" {
  interface WorldState {
    promotionWrestlerPresentations?: PromotionWrestlerPresentation[];
  }
}
