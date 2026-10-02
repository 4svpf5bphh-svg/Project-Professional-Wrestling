import type { Id, LedgerEvent, LedgerSignificance, PpwDate } from "../../domain/src/types.js";

export class LedgerWriter {
  private counter: number;

  constructor(private readonly worldId: Id, private readonly target: LedgerEvent[]) {
    this.counter = target.length;
  }

  append(input: {
    date: PpwDate;
    type: string;
    significance?: LedgerSignificance;
    entityIds?: Id[];
    payload?: Record<string, string | number | boolean | null>;
  }): LedgerEvent {
    this.counter += 1;
    const event: LedgerEvent = {
      id: `ledger-${String(this.counter).padStart(6, "0")}`,
      worldId: this.worldId,
      date: { ...input.date },
      order: this.counter,
      type: input.type,
      significanceAtTime: input.significance ?? "ROUTINE",
      historicalSignificance: input.significance ?? "ROUTINE",
      entityIds: input.entityIds ?? [],
      payload: input.payload ?? {},
    };
    this.target.push(event);
    return event;
  }
}
