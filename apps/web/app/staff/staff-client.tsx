"use client";

import { useEffect, useState } from "react";
import type { PlayerStaffView } from "../../../../dist/packages/application/src/staff-view.js";
import styles from "./staff.module.css";

type Action = "POST" | "DELETE" | "PATCH";
type Result = { view: PlayerStaffView; offerId?: string; error?: string };
function money(value: number): string { return "£" + Math.round(value).toLocaleString("en-GB"); }

export default function StaffClient(): React.JSX.Element {
  const [view, setView] = useState<PlayerStaffView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [releaseConfirm, setReleaseConfirm] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const response = await fetch("/api/staff", { cache: "no-store" });
        const payload = await response.json() as PlayerStaffView & { error?: string };
        if (!response.ok) throw new Error(payload.error ?? "Unable to load your staff");
        if (!cancelled) setView(payload);
      } catch (reason) {
        if (!cancelled) setError(reason instanceof Error ? reason.message : "Unable to load staff");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  async function act(method: Action, fields: Record<string, string>, message: string): Promise<void> {
    if (busy) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const requestId = `ppw-staff-${crypto.randomUUID()}`;
      const response = await fetch("/api/staff", {
        method, headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestId, ...fields }),
      });
      const result = await response.json() as Result;
      if (!response.ok || result.error) throw new Error(result.error ?? "Staff action failed");
      setView(result.view);
      setReleaseConfirm(false);
      setNotice(message);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Staff action failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className={styles.shell}>
      <div className={styles.content}>
        <a className={styles.back} href="/talent">← Talent</a>
        <header className={styles.heading}>
          <span className={styles.eyebrow}>PROMOTION OPERATIONS</span>
          <h1>Staff</h1>
          <p>Keep control of your talent. Delegate the administration, never the decision to recruit.</p>
        </header>
        {loading ? <p className={styles.muted}>Loading your staff…</p> : null}
        {error ? <p role="alert" className={styles.error}>{error}</p> : null}
        {notice ? <p role="status" className={styles.notice}>{notice}</p> : null}
        {!loading && view && !view.promotion ? (
          <p className={styles.muted}>Take control of a promotion before hiring staff.</p>
        ) : null}

        {view?.promotion ? (
          <>
            <section className={styles.panel}>
              <span className={styles.eyebrow}>TALENT MANAGER</span>
              {view.talentManager ? (
                <>
                  <h2>{view.talentManager.name}</h2>
                  <p>Your manager can send renewals you explicitly authorise. A wrestler can still reject the offer.</p>
                  <div className={styles.stats}>
                    <div><small>Weekly salary</small><strong>{money(view.talentManager.weeklySalary)}</strong></div>
                    <div><small>Insight</small><strong>{view.talentManager.insight}/100</strong></div>
                  </div>
                  {releaseConfirm ? (
                    <div className={styles.actions}>
                      <p>Release this manager? Their weekly salary stops with their employment. Pending wrestler offers remain independent.</p>
                      <button disabled={busy} onClick={() => void act("DELETE", { employmentId: view.talentManager!.employmentId }, "Talent Manager released.")}>Confirm release</button>
                      <button disabled={busy} className={styles.secondary} onClick={() => setReleaseConfirm(false)}>Keep manager</button>
                    </div>
                  ) : (
                    <button disabled={busy} className={styles.secondary} onClick={() => setReleaseConfirm(true)}>Release Talent Manager</button>
                  )}
                </>
              ) : (
                <>
                  <h2>No Talent Manager hired</h2>
                  <p>Manual contracts remain available without staff. Hire a manager to authorise same-terms renewal attempts more easily.</p>
                  <div className={styles.candidates}>
                    {view.availableManagers.map(manager => (
                      <div className={styles.candidate} key={manager.staffId}>
                        <div><strong>{manager.name}</strong><small>Insight {manager.insight}/100 · {money(manager.weeklySalary)}/week</small></div>
                        <button disabled={busy} onClick={() => void act("POST", { staffId: manager.staffId }, `${manager.name} hired.`)}>Hire</button>
                      </div>
                    ))}
                    {view.availableManagers.length === 0 ? <p className={styles.muted}>No free managers in this World right now.</p> : null}
                  </div>
                </>
              )}
            </section>

            {view.talentManager ? (
              <section className={styles.panel}>
                <span className={styles.eyebrow}>RENEWAL DESK</span>
                <h2>Ready for your authorisation</h2>
                <p>Each offer matches the existing recurring terms. You must approve each attempt. Wrestlers respond during normal World resolution.</p>
                {view.renewals.length === 0 ? (
                  <p className={styles.muted}>No eligible same-terms renewals. Others can still be negotiated manually through Talent.</p>
                ) : (
                  <div className={styles.candidates}>
                    {view.renewals.map(renewal => (
                      <div className={styles.renewal} key={renewal.contractId}>
                        <strong>{renewal.personName}</strong>
                        <small>{renewal.weeksToExpiry} weeks left · {renewal.termWeeks}-week proposal · {renewal.dates} contracted dates</small>
                        <small>{money(renewal.weeklyGuarantee)}/week · {money(renewal.appearanceFee)}/appearance · {renewal.creativeControl.replaceAll("_", " ").toLowerCase()}</small>
                        <small>Maximum potential pay: {money(renewal.totalPotential)} · no repeat signing bonus</small>
                        <button disabled={busy} onClick={() => void act("PATCH",
                          { sourceContractId: renewal.contractId },
                          `Your Talent Manager submitted ${renewal.personName}'s renewal offer. Acceptance is not guaranteed.`)}>
                          {busy ? "Submitting…" : "Authorise renewal offer"}
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            ) : null}
          </>
        ) : null}
      </div>
    </main>
  );
}
