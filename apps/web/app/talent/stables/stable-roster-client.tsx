"use client";

import { useEffect, useMemo, useState } from "react";
import type {
  PlayerStableEntryView, PlayerStableRosterView,
} from "../../../../../dist/packages/application/src/stable-view.js";
import type { AlphaStableMutationRequest } from "../../../../../dist/packages/web-adapter/src/stable-service.js";
import RosterNav from "../roster-nav";
import styles from "../talent.module.css";

type StableAction =
  | { action: "CREATE"; name: string; personIds: string[] }
  | { action: "ADD" | "REMOVE"; stableId: string; personId: string }
  | { action: "DISBAND"; stableId: string };

type ErrorPayload = { error?: string };
function isError(value: unknown): value is ErrorPayload {
  return typeof value === "object" && value !== null && "error" in value;
}
function ppwDate(date: { year: number; week: number }): string {
  return `Y${date.year} W${date.week}`;
}

export default function StableRosterClient(): React.JSX.Element {
  const [view, setView] = useState<PlayerStableRosterView | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [stableName, setStableName] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [addByStable, setAddByStable] = useState<Record<string, string>>({});

  async function refresh(): Promise<void> {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/stables", { cache: "no-store" });
      const result = await response.json() as PlayerStableRosterView | ErrorPayload;
      if (!response.ok || isError(result)) {
        throw new Error(isError(result) ? result.error ?? "Unable to load your stables" : "Unable to load your stables");
      }
      setView(result);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to load your stables");
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { void refresh(); }, []);

  async function act(action: StableAction, success: string): Promise<boolean> {
    if (!view || saving || !view.canEdit) return false;
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const request = {
        ...action, requestId: crypto.randomUUID(), expectedRevision: view.world.revision,
      } as AlphaStableMutationRequest;
      const response = await fetch("/api/stables", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(request),
      });
      const result = await response.json() as PlayerStableRosterView | ErrorPayload;
      if (!response.ok || isError(result)) {
        throw new Error(isError(result) ? result.error ?? "Unable to manage stables" : "Unable to manage stables");
      }
      setView(result);
      setNotice(success);
      return true;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Stable change failed");
      return false;
    } finally {
      setSaving(false);
    }
  }

  const freeRoster = useMemo(() => (view?.roster ?? []).filter((person) => !person.stableId), [view]);
  const activeStables = useMemo(() => (view?.stables ?? []).filter((stable) => stable.status === "ACTIVE"), [view]);
  const visible = useMemo(() => activeStables.filter((stable) =>
    !query.trim() || [stable.name, ...stable.currentMembers.map((member) => member.name)]
      .some((name) => name.toLowerCase().includes(query.trim().toLowerCase()))), [activeStables, query]);

  async function createStable(): Promise<void> {
    if (selectedIds.length < 3 || selectedIds.length > 12 || !stableName.trim()) return;
    const created = await act({ action: "CREATE", name: stableName, personIds: selectedIds }, "Stable created. Membership is now part of permanent World history.");
    if (created) {
      setCreateOpen(false);
      setStableName("");
      setSelectedIds([]);
    }
  }
  async function disband(stable: PlayerStableEntryView): Promise<void> {
    if (!window.confirm(`Disband ${stable.name}? Membership history will remain, but the stable will become inactive.`)) return;
    await act({ action: "DISBAND", stableId: stable.stableId }, `${stable.name} disbanded. Its history is preserved.`);
  }
  return (
    <main className={styles.shell}>
      <a className={styles.backLink} href="/talent">← Roster</a>
      <header className={styles.header}>
        <div>
          <span className={styles.eyebrow}>ROSTER · STABLES</span>
          <h1>Stables</h1>
          <p>{view ? `${view.world.name} · ${ppwDate(view.world.currentDate)}` : "Loading World roster…"}</p>
        </div>
        <div className={styles.cardActions}>
          <button className={styles.primaryButton} disabled={!view?.canEdit || saving || freeRoster.length < 3}
            onClick={() => setCreateOpen(true)}>+ Create stable</button>
          <button className={styles.button} disabled={loading} onClick={() => void refresh()}>
            {loading ? "Loading…" : "Refresh"}
          </button>
        </div>
      </header>
      {error ? <div className={styles.error} role="alert">{error}</div> : null}
      {notice ? <div className={styles.notice} role="status">{notice}</div> : null}
      {view ? (
        <>
          <RosterNav active="STABLES" />
          {!view.player.promotionId ? (
            <section className={styles.panel}><p>Take control of a promotion to create stables.</p></section>
          ) : (
            <>
              <section className={styles.overview}>
                <div><span>Active stables</span><strong>{activeStables.length}</strong></div>
                <div><span>Stable members</span><strong>{activeStables.reduce((sum, stable) => sum + stable.currentMembers.length, 0)}</strong></div>
                <div><span>Unassigned roster</span><strong>{freeRoster.length}</strong></div>
              </section>
              <label className={styles.search}>
                <span>Search your stables</span>
                <input value={query} onChange={(event) => setQuery(event.target.value)}
                  placeholder="Stable or wrestler name" />
              </label>
              <section className={styles.list}>
                {visible.map((stable) => {
                  const eligible = freeRoster.filter((person) => person.stableId !== stable.stableId);
                  const choice = addByStable[stable.stableId] ?? "";
                  return (
                    <article className={styles.card} key={stable.stableId}>
                      <div className={styles.marketTop}>
                        <div>
                          <div className={styles.nameLine}><strong>{stable.name}</strong></div>
                          <span>Formed {ppwDate(stable.formedDate)}</span>
                        </div>
                        <span className={styles.availability}>{stable.currentMembers.length} members</span>
                      </div>
                      <div className={styles.metricGrid}>
                        {stable.currentMembers.map((member) => (
                          <div key={member.membershipId}>
                            <span>Member · since {ppwDate(member.joinedDate)}</span>
                            <strong>{member.name}</strong>
                            <small>{member.currentlyOnRoster ? "On your roster" : "No longer on your roster"}</small>
                            <button className={styles.actionButton} disabled={!view.canEdit || saving}
                              onClick={() => void act({
                                action: "REMOVE", stableId: stable.stableId, personId: member.personId,
                              }, `${member.name} removed from ${stable.name}.`)}>
                              Remove member
                            </button>
                          </div>
                        ))}
                      </div>
                      <div className={styles.editorFooter}>
                        <label style={{ display: "grid", gap: 5, flex: 1, minWidth: 0 }}>
                          <span>Add a roster wrestler</span>
                          <select value={choice} disabled={!view.canEdit || saving || stable.currentMembers.length >= 12}
                            onChange={(event) => setAddByStable((current) => ({
                              ...current, [stable.stableId]: event.target.value,
                            }))}>
                            <option value="">Choose wrestler</option>
                            {eligible.map((person) => (
                              <option key={person.personId} value={person.personId}>{person.name}</option>
                            ))}
                          </select>
                        </label>
                        <button className={styles.primaryButton}
                          disabled={!view.canEdit || saving || !choice || stable.currentMembers.length >= 12}
                          onClick={() => void act({ action: "ADD", stableId: stable.stableId, personId: choice },
                            "Wrestler added to stable.").then((ok) => {
                            if (ok) setAddByStable((current) => ({ ...current, [stable.stableId]: "" }));
                          })}>Add</button>
                      </div>
                      <details>
                        <summary>Membership history and administration</summary>
                        {stable.memberHistory.map((member) => (
                          <p key={member.membershipId} className={styles.subtle}>
                            {member.name}: joined {ppwDate(member.joinedDate)}
                            {member.leftDate ? ` · left ${ppwDate(member.leftDate)}` : " · current"}
                          </p>
                        ))}
                        <button className={styles.actionButton} disabled={!view.canEdit || saving}
                          onClick={() => void disband(stable)}>Disband stable</button>
                      </details>
                    </article>
                  );
                })}
                {visible.length === 0 ? (
                  <section className={styles.panel}><p>
                    {activeStables.length ? "No stables match that search." : "No active stables yet. Create a group from at least three wrestlers on your roster."}
                  </p></section>
                ) : null}
              </section>
              {(view.stables.some((entry) => entry.status === "DISBANDED")) ? (
                <details className={styles.panel}>
                  <summary>Disbanded stables and history</summary>
                  {view.stables.filter((entry) => entry.status === "DISBANDED").map((stable) => (
                    <p key={stable.stableId}>{stable.name} · formed {ppwDate(stable.formedDate)} · disbanded {stable.disbandedDate ? ppwDate(stable.disbandedDate) : ""} · {stable.memberHistory.length} membership record(s)</p>
                  ))}
                </details>
              ) : null}
              <p className={styles.footerNote}>Stable membership is an on-roster identity, not a free contract, morale boost or match advantage. Tag-team identities remain independent. Scripted recruitment and expulsions are a later storytelling layer.</p>
            </>
          )}
        </>
      ) : null}
      {createOpen ? (
        <section className={styles.editor} role="dialog" aria-modal="true" aria-label="Create stable">
          <div className={styles.editorHeader}>
            <div>
              <span className={styles.eyebrow}>CREATE STABLE</span>
              <h2>Form a faction</h2>
              <p>Give it a name and select 3–12 wrestlers from your current roster.</p>
            </div>
            <button className={styles.button} disabled={saving} onClick={() => setCreateOpen(false)}>Close</button>
          </div>
          <div className={styles.editorBody}>
            <div className={styles.formGrid}>
              <label>
                <span>Stable name</span>
                <input maxLength={60} value={stableName} onChange={(event) => setStableName(event.target.value)}
                  placeholder="Your new stable" />
              </label>
            </div>
            <p className={styles.subtle}>{selectedIds.length} of 3–12 wrestlers selected</p>
            <div className={styles.list}>
              {freeRoster.map((person) => {
                const checked = selectedIds.includes(person.personId);
                return (
                  <label className={styles.panel} key={person.personId}
                    style={{ display: "flex", gap: 10, alignItems: "center", margin: 0 }}>
                    <input type="checkbox" checked={checked} disabled={saving || (!checked && selectedIds.length >= 12)}
                      onChange={(event) => setSelectedIds((current) =>
                        event.target.checked ? [...current, person.personId] : current.filter((id) => id !== person.personId))}
                    />
                    <span>{person.name}</span>
                  </label>
                );
              })}
            </div>
          </div>
          <div className={styles.editorFooter}>
            <span>Creating a stable makes its World identity official. No simulation bonus is awarded.</span>
            <button className={styles.primaryButton}
              disabled={saving || !stableName.trim() || selectedIds.length < 3 || selectedIds.length > 12}
              onClick={() => void createStable()}>{saving ? "Creating…" : "Create stable"}</button>
          </div>
        </section>
      ) : null}
    </main>
  );
}
