import type { WorldState } from "../../domain/src/types.js";

/** Validate stables without imposing tag-team rules or granting simulation power. */
export function validateStableState(state: WorldState): void {
  const promotions = new Set(state.promotions.map((promotion) => promotion.id));
  const people = new Set(state.people.map((person) => person.id));
  const stables = new Map((state.stables ?? []).map((stable) => [stable.id, stable]));
  if (stables.size !== (state.stables ?? []).length) throw new Error("duplicate stable identities");
  const memberships = new Set<string>();
  const activeByPromotionAndPerson = new Set<string>();
  const activeNames = new Set<string>();
  for (const stable of state.stables ?? []) {
    if (stable.worldId !== state.world.id || !promotions.has(stable.promotionId)) {
      throw new Error("stable must belong to an existing promotion in its World");
    }
    if (!stable.name.trim()) throw new Error("stable name must not be empty");
    if (stable.status === "ACTIVE" && stable.disbandedDate !== null) {
      throw new Error("active stable cannot have a disband date");
    }
    if (stable.status === "DISBANDED" && stable.disbandedDate === null) {
      throw new Error("disbanded stable must have a disband date");
    }
    if (stable.status === "ACTIVE") {
      const key = stable.promotionId + ":" + stable.name.trim().toLocaleLowerCase("en-GB");
      if (activeNames.has(key)) throw new Error("duplicate active stable name within promotion");
      activeNames.add(key);
    }
  }
  for (const membership of state.stableMemberships ?? []) {
    const stable = stables.get(membership.stableId);
    if (!stable || !people.has(membership.personId) || membership.worldId !== state.world.id) {
      throw new Error("stable membership references missing or cross-World entity");
    }
    if (memberships.has(membership.id)) throw new Error("duplicate stable membership identity");
    memberships.add(membership.id);
    if (membership.active !== (membership.leftDate === null)) {
      throw new Error("stable membership active flag contradicts departure date");
    }
    if (membership.active) {
      if (stable.status !== "ACTIVE") throw new Error("disbanded stable still has active members");
      const key = stable.promotionId + ":" + membership.personId;
      if (activeByPromotionAndPerson.has(key)) throw new Error("wrestler belongs to multiple active stables in one promotion");
      activeByPromotionAndPerson.add(key);
    }
  }
}
