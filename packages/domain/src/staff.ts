import type { Id, PpwDate } from "./types.js";

/**
 * Staff are unique inhabitants of a shared PPW World, not attributes on
 * promotions. Only TALENT_MANAGER is operational in this wave. Other roles
 * may be added here when their complete gameplay systems exist.
 */
export type StaffRole = "TALENT_MANAGER";

export interface WorldStaffMember {
  id: Id;
  worldId: Id;
  name: string;
  specialty: StaffRole;
  /** Quality of advance warning and administrative insight, never a consent bonus. */
  insight: number;
  /** Public weekly minimum request; the actual agreement is private. */
  requestedWeeklySalary: number;
}

export interface StaffEmployment {
  id: Id;
  worldId: Id;
  staffId: Id;
  promotionId: Id;
  role: StaffRole;
  status: "ACTIVE" | "ENDED";
  startDate: PpwDate;
  endedDate: PpwDate | null;
  weeklySalary: number;
}

/** Future staff decisions use the same authenticated player authorisation and
 * source-contract command as direct promoter negotiation. */
export interface StaffRenewalAuthorisation {
  worldId: Id;
  promotionId: Id;
  staffEmploymentId: Id;
  sourceContractId: Id;
  playerId: string;
  authorisedDate: PpwDate;
}
