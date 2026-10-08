"use client";

import { useState } from "react";
import type { AlphaPlayerWorldView } from "../../../dist/packages/application/src/player-view.js";

type ErrorPayload = { error?: string };

function isErrorPayload(payload: AlphaPlayerWorldView | ErrorPayload): payload is ErrorPayload {
  return "error" in payload;
}

export default function AlphaTestControls(): React.JSX.Element {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function advanceOneWeek(): Promise<void> {
    if (busy) return;
    setBusy(true);
    setError(null);

    try {
      const sessionResponse = await fetch("/api/session", { cache: "no-store" });
      const sessionPayload = await sessionResponse.json() as AlphaPlayerWorldView | ErrorPayload;
      if (!sessionResponse.ok || isErrorPayload(sessionPayload)) {
        throw new Error(isErrorPayload(sessionPayload) && sessionPayload.error ? sessionPayload.error : "Unable to load current World state");
      }
      if (!sessionPayload.promotion) throw new Error("Take control of a promotion before advancing the World");

      const confirmed = window.confirm(
        `Resolve Year ${sessionPayload.world.year}, Week ${sessionPayload.world.week} now?\n\nAll promotions will resolve and the World will advance one PPW week.`,
      );
      if (!confirmed) return;

      const response = await fetch("/api/advance-week", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ expectedRevision: sessionPayload.world.revision }),
      });
      const payload = await response.json() as AlphaPlayerWorldView | ErrorPayload;
      if (!response.ok || isErrorPayload(payload)) {
        throw new Error(isErrorPayload(payload) && payload.error ? payload.error : "Unable to advance the World");
      }

      window.location.reload();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to advance the World");
    } finally {
      setBusy(false);
    }
  }

  return (
    <aside style={{ maxWidth: 960, margin: "0 auto", padding: "0 16px 110px" }}>
      <section className="panel" style={{ borderColor: "#4f4130", background: "#17130e" }}>
        <div className="section-heading">
          <div>
            <span className="eyebrow">ALPHA TEST CONTROLS</span>
            <h2>World clock</h2>
          </div>
          <span className="revision">TEST ONLY</span>
        </div>
        <p className="muted body-copy">
          The normal Alpha World advances on its server schedule. Use this only when you deliberately want to resolve one extra PPW week during testing.
        </p>
        {error ? <div className="error-card" style={{ marginBottom: 12 }}>{error}</div> : null}
        <button className="primary-button" disabled={busy} onClick={() => void advanceOneWeek()}>
          {busy ? "Resolving World…" : "Advance World One Week"}
        </button>
        <p className="micro-copy" style={{ marginTop: 10 }}>
          One week at a time. Manual advances do not pretend that extra real-world days have passed for inactivity tracking.
        </p>
      </section>
    </aside>
  );
}
