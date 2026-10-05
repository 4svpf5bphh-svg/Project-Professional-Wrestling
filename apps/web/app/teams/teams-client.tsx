"use client";

import { useEffect, useMemo, useState } from "react";
import type {
  PlayerTeamChampionshipReignView,
  PlayerTeamHistoryEntryView,
  PlayerTeamHistoryView,
} from "../../../../dist/packages/application/src/team-history-view.js";
import styles from "./teams.module.css";

type ErrorPayload = { error?: string };
type StatusFilter = "ALL" | PlayerTeamHistoryEntryView["status"];

function isErrorPayload(payload: PlayerTeamHistoryView | ErrorPayload): payload is ErrorPayload {
  return "error" in payload;
}

function label(value: string): string {
  return value.replaceAll("_", " ");
}

function ppwDate(date: { year: number; week: number; day: number }): string {
  return `Y${date.year} W${date.week}`;
}

function reignStatus(reign: PlayerTeamChampionshipReignView): string {
  if (reign.isCurrent) return "CURRENT REIGN";
  if (reign.endReason) return label(reign.endReason);
  return label(reign.status);
}

export default function TeamsClient(): React.JSX.Element {
  const [view, setView] = useState<PlayerTeamHistoryView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<StatusFilter>("ALL");
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);

  async function refresh(): Promise<void> {
    setError(null);
    const response = await fetch("/api/teams", { cache: "no-store" });
    const payload = await response.json() as PlayerTeamHistoryView | ErrorPayload;
    if (!response.ok || isErrorPayload(payload)) {
      throw new Error(isErrorPayload(payload) && payload.error ? payload.error : "Unable to load tag-team history");
    }
    setView(payload);
  }

  useEffect(() => {
    setSelectedTeamId(new URLSearchParams(window.location.search).get("teamId"));
    refresh().catch((reason: unknown) => {
      setError(reason instanceof Error ? reason.message : "Unable to load tag-team history");
    });
  }, []);

  const visible = useMemo(() => {
    if (!view) return [];
    const normalized = query.trim().toLowerCase();
    return view.teams.filter((team) => {
      if (status !== "ALL" && team.status !== status) return false;
      if (!normalized) return true;
      return team.name.toLowerCase().includes(normalized)
        || team.memberHistory.some((member) => member.name.toLowerCase().includes(normalized))
        || team.championshipReigns.some((reign) => (
          reign.championshipName.toLowerCase().includes(normalized)
          || reign.promotionName.toLowerCase().includes(normalized)
        ));
    });
  }, [query, status, view]);

  if (!view) {
    return (
      <main className={styles.shell}>
        <a className={styles.backLink} href="/industry">← Industry</a>
        <section className={styles.panel}>
          <p>{error ?? "Loading tag-team history…"}</p>
          {error ? <button className={styles.button} onClick={() => refresh().catch(() => undefined)}>Retry</button> : null}
        </section>
      </main>
    );
  }

  const activeCount = view.teams.filter((team) => team.status === "ACTIVE").length;
  const reignCount = view.teams.reduce((total, team) => total + team.totalTitleReigns, 0);

  return (
    <main className={styles.shell}>
      <header className={styles.header}>
        <div>
          <a className={styles.backLink} href="/industry">← Industry</a>
          <div className={styles.eyebrow}>WORLD HISTORY</div>
          <h1>Tag-team history</h1>
          <p>{view.world.name} · Year {view.world.currentDate.year}, Week {view.world.currentDate.week}</p>
          <a className={styles.relatedLink} href="/championships">Championship lineage →</a>
        </div>
        <button className={styles.button} onClick={() => refresh().catch((reason: unknown) => setError(reason instanceof Error ? reason.message : "Unable to refresh"))}>Refresh</button>
      </header>

      {error ? <div className={styles.error}>{error}</div> : null}

      <section className={styles.intro}>
        <div><span>Recorded teams</span><strong>{view.teams.length}</strong></div>
        <div><span>Active teams</span><strong>{activeCount}</strong></div>
        <div><span>Tag-title reigns</span><strong>{reignCount}</strong></div>
      </section>

      <section className={styles.filters}>
        <label>
          <span>Search team, wrestler, title or promotion</span>
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search tag-team history" />
        </label>
        <label>
          <span>Status</span>
          <select value={status} onChange={(event) => setStatus(event.target.value as StatusFilter)}>
            <option value="ALL">All teams</option>
            <option value="ACTIVE">Active</option>
            <option value="DISBANDED">Disbanded</option>
          </select>
        </label>
      </section>

      <section className={styles.list}>
        {visible.map((team) => (
          <details className={styles.teamCard} key={team.teamId} open={selectedTeamId === team.teamId ? true : undefined}>
            <summary className={styles.summary}>
              <div className={styles.identity}>
                <div className={styles.nameLine}>
                  <strong>{team.name}</strong>
                  <span className={`${styles.status} ${team.status === "ACTIVE" ? styles.active : styles.inactive}`}>{label(team.status)}</span>
                </div>
                <span>Formed {ppwDate(team.formedDate)}{team.disbandedDate ? ` · ended ${ppwDate(team.disbandedDate)}` : ""}</span>
              </div>
              <div className={styles.current}>
                <strong>{team.currentMembers.length > 0 ? team.currentMembers.map((member) => member.name).join(" & ") : "No active members"}</strong>
                <span>{team.totalTitleReigns} title reign{team.totalTitleReigns === 1 ? "" : "s"} · {team.totalDefenses} defenses</span>
              </div>
            </summary>

            <div className={styles.body}>
              <section>
                <div className={styles.sectionTitle}><span>CURRENT MEMBERS</span><b>{team.currentMembers.length}</b></div>
                <div className={styles.memberGrid}>
                  {team.currentMembers.map((member) => (
                    <a className={styles.member} href={`/talent/profile?personId=${encodeURIComponent(member.personId)}`} key={member.membershipId}>
                      <strong>{member.name}</strong>
                      <span>Since {ppwDate(member.joinedDate)}</span>
                    </a>
                  ))}
                  {team.currentMembers.length === 0 ? <p className={styles.muted}>No active members.</p> : null}
                </div>
              </section>

              <section>
                <div className={styles.sectionTitle}><span>MEMBERSHIP HISTORY</span><b>{team.memberHistory.length}</b></div>
                <div className={styles.stack}>
                  {team.memberHistory.map((member) => (
                    <article className={styles.row} key={member.membershipId}>
                      <a href={`/talent/profile?personId=${encodeURIComponent(member.personId)}`}>{member.name}</a>
                      <div className={styles.right}>
                        <strong>{member.active ? "CURRENT" : "FORMER"}</strong>
                        <span>{ppwDate(member.joinedDate)} → {member.leftDate ? ppwDate(member.leftDate) : "present"}</span>
                      </div>
                    </article>
                  ))}
                  {team.memberHistory.length === 0 ? <p className={styles.muted}>No membership records.</p> : null}
                </div>
              </section>

              <section>
                <div className={styles.sectionTitle}><span>TAG CHAMPIONSHIP HISTORY</span><b>{team.championshipReigns.length}</b></div>
                <div className={styles.stack}>
                  {team.championshipReigns.map((reign) => (
                    <article className={`${styles.row} ${reign.isCurrent ? styles.currentReign : ""}`} key={reign.reignId}>
                      <div>
                        <a href="/championships">{reign.championshipName}</a>
                        <span>{reign.promotionName}</span>
                      </div>
                      <div className={styles.right}>
                        <strong>{reignStatus(reign)}</strong>
                        <span>{ppwDate(reign.startDate)} → {reign.endDate ? ppwDate(reign.endDate) : "present"}</span>
                        <span>{reign.defenses} defense{reign.defenses === 1 ? "" : "s"}</span>
                      </div>
                    </article>
                  ))}
                  {team.championshipReigns.length === 0 ? <p className={styles.muted}>No tag-title reigns recorded for this team.</p> : null}
                </div>
              </section>
            </div>
          </details>
        ))}
        {visible.length === 0 ? <section className={styles.panel}>No teams match those filters.</section> : null}
      </section>

      <p className={styles.privacy}>Team identity, membership and tag-title lineage are shared wrestling history. PPW does not yet persist a direct named-team link on match records, so this view does not infer team match histories from wrestler pairings.</p>
    </main>
  );
}
