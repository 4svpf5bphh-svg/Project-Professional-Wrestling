import type { Id, LedgerEvent, LedgerSignificance, PpwDate } from "../../domain/src/types.js";

export class LedgerWriter {
  constructor(private readonly worldId: Id, private readonly target: LedgerEvent[]) {}

  append(input: {
    date: PpwDate;
    type: string;
    significance?: LedgerSignificance;
    entityIds?: Id[];
    payload?: Record<string, string | number | boolean | null>;
  }): LedgerEvent {
    // Allocate from the live target length so multiple subsystems can safely
    // append through independent LedgerWriter instances during one resolution.
    const order = this.target.length + 1;
    const event: LedgerEvent = {
      id: `ledger-${String(order).padStart(6, "0")}`,
      worldId: this.worldId,
      date: { ...input.date },
      order,
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
