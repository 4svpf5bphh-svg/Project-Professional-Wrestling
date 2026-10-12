import type { Id, WorldState } from "../../domain/src/types.js";
import type { StaffEmployment, WorldStaffMember } from "../../domain/src/staff.js";

/** A small, deterministic starter pool. No shared genesis RNG is consumed.
 * Names are fictional, and staff are never cloned separately per promotion. */
export function seedWorldStaffPool(worldId: Id, seed: number): WorldStaffMember[] {
  const first = ["Morgan", "Jamie", "Casey", "Rowan", "Riley", "Taylor", "Avery", "Drew"];
  const last = ["Keane", "Mercer", "Hartley", "Vale", "Cross", "Sutton", "Bennett", "Shaw"];
  const offset = (Math.abs(Math.trunc(seed)) % first.length);
  return first.map((_, index) => {
    const insight = 40 + ((index * 7 + offset * 3) % 46);
    return {
      id: `staff-${String(index + 1).padStart(3, "0")}`,
      worldId,
      name: `${first[(index + offset) % first.length]} ${last[(index * 3 + offset) % last.length]}`,
      specialty: "TALENT_MANAGER" as const,
      insight,
      requestedWeeklySalary: 250 + insight * 9,
    };
  });
}

export function activeTalentManager(state: WorldState, promotionId: Id): {
  member: WorldStaffMember; employment: StaffEmployment;
} | null {
  const employment = (state.staffEmployments ?? []).find(row =>
    row.promotionId === promotionId && row.role === "TALENT_MANAGER" && row.status === "ACTIVE");
  if (!employment) return null;
  const member = (state.staffMembers ?? []).find(row => row.id === employment.staffId);
  return member ? { member, employment } : null;
}

/** Validate all World staff, including currently unemployed members.
 * Duplicate or cross-promotion employment is a release blocker. */
export function validateWorldStaff(state: WorldState): string[] {
  const errors: string[] = [];
  const ids = new Set<Id>();
  const employmentIds = new Set<Id>();
  const occupiedMembers = new Set<Id>();
  const occupiedRoles = new Set<string>();
  const promotions = new Set(state.promotions.map(row => row.id));
  for (const member of state.staffMembers ?? []) {
    if (ids.has(member.id)) errors.push(`duplicate World staff member ${member.id}`);
    ids.add(member.id);
    if (member.worldId !== state.world.id) errors.push(`staff member ${member.id} crosses World`);
    if (member.specialty !== "TALENT_MANAGER") errors.push(`unknown operational staff role for ${member.id}`);
    if (!Number.isSafeInteger(member.insight) || member.insight < 0 || member.insight > 100) errors.push(`invalid staff insight ${member.id}`);
    if (!Number.isSafeInteger(member.requestedWeeklySalary) || member.requestedWeeklySalary < 0) errors.push(`invalid staff salary request ${member.id}`);
  }
  for (const employment of state.staffEmployments ?? []) {
    if (employmentIds.has(employment.id)) errors.push(`duplicate staff employment ${employment.id}`);
    employmentIds.add(employment.id);
    if (employment.worldId !== state.world.id) errors.push(`staff employment ${employment.id} crosses World`);
    if (!ids.has(employment.staffId)) errors.push(`staff employment ${employment.id} references unknown staff`);
    if (!promotions.has(employment.promotionId)) errors.push(`staff employment ${employment.id} references missing promotion`);
    if (employment.role !== "TALENT_MANAGER") errors.push(`unsupported staff employment role ${employment.id}`);
    if (!Number.isSafeInteger(employment.weeklySalary) || employment.weeklySalary < 0) errors.push(`invalid negotiated salary ${employment.id}`);
    if (employment.status === "ACTIVE") {
      if (employment.endedDate !== null) errors.push(`active staff employment ${employment.id} has ended date`);
      if (occupiedMembers.has(employment.staffId)) errors.push(`staff member ${employment.staffId} simultaneously works for multiple promotions`);
      occupiedMembers.add(employment.staffId);
      const roleKey = `${employment.promotionId}:${employment.role}`;
      if (occupiedRoles.has(roleKey)) errors.push(`promotion has multiple active ${employment.role} staff`);
      occupiedRoles.add(roleKey);
    } else if (employment.status !== "ENDED" || employment.endedDate === null) {
      errors.push(`invalid ended staff employment ${employment.id}`);
    }
  }
  return errors;
}
