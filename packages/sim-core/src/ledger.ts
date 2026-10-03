import type { Id, LedgerEvent, LedgerSignificance, PpwDate } from "../../domain/src/types.js";
import { formatEntityId, nextLedgerSequence } from "./id-allocator.js";

export class LedgerWriter {
  constructor(private readonly worldId: Id, private readonly target: LedgerEvent[]) {}

  append(input: {
    date: PpwDate;
    type: string;
    significance?: LedgerSignificance;
    entityIds?: Id[];
    payload?: Record<string, string | number | boolean | null>;
  }): LedgerEvent {
    const order = nextLedgerSequence(this.target);
    const event: LedgerEvent = {
      id: formatEntityId("ledger", order),
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
