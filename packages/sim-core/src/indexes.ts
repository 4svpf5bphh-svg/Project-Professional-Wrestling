import type { Contract, Id, WorldState } from "../../domain/src/types.js";
import { ppwDateToWeekIndex } from "./clock.js";

interface ContractIndex {
  syncedLength: number;
  byId: Map<Id, Contract>;
  byPerson: Map<Id, Contract[]>;
  byPromotion: Map<Id, Contract[]>;
  byEndWeek: Map<number, Contract[]>;
}

interface PersonIndex {
  syncedLength: number;
  byId: Map<Id, WorldState["people"][number]>;
}

const contractIndexes = new WeakMap<WorldState, ContractIndex>();
const personIndexes = new WeakMap<WorldState, PersonIndex>();

function ensureContractIndex(state: WorldState): ContractIndex {
  let index = contractIndexes.get(state);
  if (!index || index.syncedLength > state.contracts.length) {
    index = { syncedLength: 0, byId: new Map(), byPerson: new Map(), byPromotion: new Map(), byEndWeek: new Map() };
    contractIndexes.set(state, index);
  }
  for (let i = index.syncedLength; i < state.contracts.length; i += 1) {
    const contract = state.contracts[i]!;
    index.byId.set(contract.id, contract);
    const personContracts = index.byPerson.get(contract.personId) ?? [];
    personContracts.push(contract);
    index.byPerson.set(contract.personId, personContracts);

    const promotionContracts = index.byPromotion.get(contract.promotionId) ?? [];
    promotionContracts.push(contract);
    index.byPromotion.set(contract.promotionId, promotionContracts);

    const endWeek = ppwDateToWeekIndex(contract.endDate, state.ruleset.weeksPerYear);
    const ending = index.byEndWeek.get(endWeek) ?? [];
    ending.push(contract);
    index.byEndWeek.set(endWeek, ending);
  }
  index.syncedLength = state.contracts.length;
  return index;
}

export function contractsForPerson(state: WorldState, personId: Id): readonly Contract[] {
  return ensureContractIndex(state).byPerson.get(personId) ?? [];
}

export function contractsForPromotion(state: WorldState, promotionId: Id): readonly Contract[] {
  return ensureContractIndex(state).byPromotion.get(promotionId) ?? [];
}

export function contractsEndingInWeek(state: WorldState, weekIndex: number): readonly Contract[] {
  return ensureContractIndex(state).byEndWeek.get(weekIndex) ?? [];
}

export function contractById(state: WorldState, contractId: Id): Contract | undefined {
  return ensureContractIndex(state).byId.get(contractId);
}

export function personById(state: WorldState, personId: Id): WorldState["people"][number] | undefined {
  let index = personIndexes.get(state);
  if (!index || index.syncedLength > state.people.length) {
    index = { syncedLength: 0, byId: new Map() };
    personIndexes.set(state, index);
  }
  for (let i = index.syncedLength; i < state.people.length; i += 1) {
    const person = state.people[i]!;
    index.byId.set(person.id, person);
  }
  index.syncedLength = state.people.length;
  return index.byId.get(personId);
}
