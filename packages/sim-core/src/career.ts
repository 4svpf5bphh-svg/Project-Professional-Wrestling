import type { InjurySeverity, Match, Person, WorldState } from "../../domain/src/types.js";
import { LedgerWriter } from "./ledger.js";

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function applyMatchLoad(person: Person, fatigue: number, wear: number): void {
  person.fatigue = Math.round(clamp(person.fatigue + fatigue, 0, 100) * 10) / 10;
  person.wear = Math.round(clamp(person.wear + wear, 0, 100) * 10) / 10;
}

export function createInjury(
  state: WorldState,
  person: Person,
  match: Match,
  severity: InjurySeverity,
  weeksOut: number,
): void {
  const existing = state.injuries.find((injury) => injury.personId === person.id && injury.status === "ACTIVE");
  if (existing) return;
  const eventDate = state.events.find((event) => event.id === match.eventId)?.date ?? state.world.currentDate;
  const injury = {
    id: `injury-${String(state.injuries.length + 1).padStart(7, "0")}`,
    worldId: state.world.id,
    personId: person.id,
    matchId: match.id,
    eventId: match.eventId,
    date: { ...eventDate },
    severity,
    weeksOut,
    weeksRemaining: weeksOut,
    status: "ACTIVE" as const,
  };
  state.injuries.push(injury);
  person.status = "INJURED";
  person.fatigue = Math.max(person.fatigue, severity === "SEVERE" ? 80 : severity === "MAJOR" ? 65 : severity === "MODERATE" ? 50 : 35);
  person.wear = Math.round(clamp(person.wear + (severity === "SEVERE" ? 5 : severity === "MAJOR" ? 3 : severity === "MODERATE" ? 1.5 : 0.5), 0, 100) * 10) / 10;

  new LedgerWriter(state.world.id, state.ledger).append({
    date: eventDate,
    type: "WRESTLER_INJURED",
    significance: severity === "SEVERE" ? "MAJOR" : severity === "MAJOR" ? "NOTABLE" : "ROUTINE",
    entityIds: [person.id, match.id, injury.id],
    payload: { severity, weeksOut, eventId: match.eventId },
  });
}

export function recoverWrestlersForNewWeek(state: WorldState): void {
  for (const person of state.people) {
    const recovery = state.ruleset.fatigueRecoveryBase + person.skills.stamina / 12;
    person.fatigue = Math.round(Math.max(0, person.fatigue - recovery) * 10) / 10;
  }

  for (const injury of state.injuries) {
    if (injury.status !== "ACTIVE") continue;
    injury.weeksRemaining = Math.max(0, injury.weeksRemaining - 1);
    if (injury.weeksRemaining > 0) continue;
    injury.status = "RECOVERED";
    const person = state.people.find((candidate) => candidate.id === injury.personId);
    if (!person) continue;
    person.status = "ACTIVE";
    new LedgerWriter(state.world.id, state.ledger).append({
      date: state.world.currentDate,
      type: "WRESTLER_CLEARED_TO_RETURN",
      significance: injury.severity === "SEVERE" || injury.severity === "MAJOR" ? "NOTABLE" : "ROUTINE",
      entityIds: [person.id, injury.id],
      payload: { severity: injury.severity, weeksOut: injury.weeksOut },
    });
  }
}
