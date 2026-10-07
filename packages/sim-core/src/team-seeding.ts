import type { Id, Team, WrestlerRelationshipTag, WorldState } from "../../domain/src/types.js";
import { indexNewTeamState, indexedActiveTeamForPair } from "./competition-indexes.js";
import { nextEntityId } from "./id-allocator.js";
import { LedgerWriter } from "./ledger.js";
import { upsertWrestlerRelationship } from "./relationships.js";
import { requireSameWrestlerDivision } from "./wrestler-division.js";

export interface EstablishedTagTeamSeedInput {
  name: string;
  personAId: Id;
  personBId: Id;
  relationshipTags?: WrestlerRelationshipTag[];
  professionalTrust?: number;
  familiarity?: number;
}

function teamName(value: string): string {
  const normalized = value.trim();
  if (!normalized) throw new Error("established tag-team name must not be empty");
  if (normalized.length > 80) throw new Error("established tag-team name must contain at most 80 characters");
  return normalized;
}

export function seedEstablishedTagTeam(
  state: WorldState,
  input: EstablishedTagTeamSeedInput,
): Team {
  if (input.personAId === input.personBId) throw new Error("established tag team requires two different wrestlers");
  const name = teamName(input.name);
  const a = state.people.find((person) => person.id === input.personAId);
  const b = state.people.find((person) => person.id === input.personBId);
  if (!a || !b) throw new Error(`established tag team ${name} references a missing wrestler`);
  if (a.status === "RETIRED" || b.status === "RETIRED") {
    throw new Error(`established tag team ${name} requires active wrestlers`);
  }
  requireSameWrestlerDivision([a, b], "established tag teams cannot mix men's and women's divisions");

  state.teams ??= [];
  state.teamMemberships ??= [];

  const existingPair = indexedActiveTeamForPair(state, a.id, b.id);
  if (existingPair) {
    if (existingPair.name !== name) {
      throw new Error(`${a.name} and ${b.name} already form the active team ${existingPair.name}`);
    }
    return existingPair;
  }

  const duplicateName = state.teams.find(
    (team) => team.status === "ACTIVE" && team.name.trim().toLocaleLowerCase("en") === name.toLocaleLowerCase("en"),
  );
  if (duplicateName) throw new Error(`an active tag team already uses the name ${name}`);

  const team: Team = {
    id: nextEntityId(state, "team"),
    worldId: state.world.id,
    name,
    status: "ACTIVE",
    formedDate: { ...state.world.currentDate },
    disbandedDate: null,
  };
  state.teams.push(team);
  for (const person of [a, b]) {
    state.teamMemberships.push({
      id: nextEntityId(state, "teamMembership"),
      worldId: state.world.id,
      teamId: team.id,
      personId: person.id,
      joinedDate: { ...state.world.currentDate },
      leftDate: null,
      active: true,
    });
  }
  indexNewTeamState(state);

  upsertWrestlerRelationship(state, {
    personAId: a.id,
    personBId: b.id,
    professionalTrust: input.professionalTrust ?? 70,
    familiarity: input.familiarity ?? 80,
    tags: [...new Set(["TAG_PARTNERS", ...(input.relationshipTags ?? [])] as WrestlerRelationshipTag[])],
  });

  new LedgerWriter(state.world.id, state.ledger).append({
    date: state.world.currentDate,
    type: "TAG_TEAM_PRESENT_AT_GENESIS",
    significance: "ROUTINE",
    entityIds: [team.id, a.id, b.id],
    payload: { teamName: team.name },
  });

  return team;
}
