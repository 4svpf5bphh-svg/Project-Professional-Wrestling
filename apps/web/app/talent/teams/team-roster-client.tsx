"use client";

import { useEffect, useMemo, useState } from "react";
import type {
  PlayerTeamHistoryEntryView,
  PlayerTeamHistoryView,
} from "../../../../../dist/packages/application/src/team-history-view.js";
import type { PlayerTalentManagementView } from "../../../../../dist/packages/application/src/talent-view.js";
import styles from "../talent.module.css";

type ErrorPayload = { error?: string };

function isErrorPayload(payload: unknown): payload is ErrorPayload {
  return typeof payload === "object" && payload !== null && "error" in payload;
}

function ppwDate(date: { year: number; week: number }): string {
  return `Y${date.year} W${date.week}`;
}

function label(value: string): string {
  return value.replaceAll("_", " ");
}

function currentTitles(team: PlayerTeamHistoryEntryView) {
  return team.championshipReigns.filter((reign) => reign.isCurrent);
}

export default function TeamRosterClient(): React.JSX.Element {
  const [teams, setTeams] = useState<PlayerTeamHistoryView | null>(null);
  const [talent, setTalent] = useState<PlayerTalentManagementView | null>(null);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function refresh(): Promise<void> {
    setLoading(true);
    setError(null);
    try {
      const [teamsResponse, talentResponse] = await Promise.all([
        fetch("/api/teams", { cache: "no-store" }),
        fetch("/api/talent", { cache: "no-store" }),
      ]);
      const teamsPayload = await teamsResponse.json() as PlayerTeamHistoryView | ErrorPayload;
      const talentPayload = await talentResponse.json() as PlayerTalentManagementView | ErrorPayload;
      if (!teamsResponse.ok || isErrorPayload(teamsPayload)) {
        throw new Error(isErrorPayload(teamsPayload) && teamsPayload.error ? teamsPayload.error : "Unable to load tag teams");
      }
      if (!talentResponse.ok || isErrorPayload(talentPayload)) {
        throw new Error(isErrorPayload(talentPayload) && talentPayload.error ? talentPayload.error : "Unable to load your roster");
      }
      setTeams(teamsPayload);
      setTalent(talentPayload);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to load tag-team roster");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void refresh(); }, []);

  const rosterById = useMemo(
    () => new Map((talent?.roster ?? []).map((entry) => [entry.personId, entry])),
    [talent],
  );

  const rosterTeams = useMemo(() => {
    const rosterIds = new Set((talent?.roster ?? []).map((entry) => entry.personId));
    return (teams?.teams ?? [])
      .filter((team) => (
        team.status === "ACTIVE"
        && team.currentMembers.length >= 2
        && team.currentMembers.every((member) => rosterIds.has(member.personId))
      ))
      .sort((left, right) => (
        currentTitles(right).length - currentTitles(left).length
        || right.totalTitleReigns - left.totalTitleReigns
        || left.name.localeCompare(right.name)
      ));
  }, [teams, talent]);

  const filteredTeams = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return rosterTeams;
    return rosterTeams.filter((team) => (
      team.name.toLowerCase().includes(needle)
      || team.currentMembers.some((member) => member.name.toLowerCase().includes(needle))
    ));
  }, [rosterTeams, query]);

  const wrestlersInTeams = useMemo(
    () => new Set(rosterTeams.flatMap((team) => team.currentMembers.map((member) => member.personId))).size,
    [rosterTeams],
  );
  const currentTagTitles = useMemo(
    () => rosterTeams.reduce((total, team) => total + currentTitles(team).length, 0),
    [rosterTeams],
  );

  return (
    <main className={styles.shell}>
      <a className={styles.backLink} href="/">← Promotion home</a>
      <header className={styles.header}>
        <div>
          <span className={styles.eyebrow}>ROSTER · TAG TEAMS</span>
          <h1>{talent?.promotion?.name ?? "Tag-team roster"}</h1>
          <p>{teams ? `${teams.world.name} · ${ppwDate(teams.world.currentDate)}` : "Loading your World…"}</p>
        </div>
        <button className={styles.button} disabled={loading} onClick={() => void refresh()}>{loading ? "Loading…" : "Refresh"}</button>
      </header>

      {error ? <div className={styles.error}>{error}</div> : null}
      {talent && !talent.promotion ? <section className={styles.panel}><p>Take control of a promotion before managing your roster.</p></section> : null}

      {talent?.promotion ? (
        <>
          <section className={styles.overview}>
            <div><span>Active tag teams</span><strong>{rosterTeams.length}</strong></div>
            <div><span>Wrestlers in teams</span><strong>{wrestlersInTeams}</strong></div>
            <div><span>Current tag titles</span><strong>{currentTagTitles}</strong></div>
          </section>

          <label className={styles.search}>
            <span>Search your tag teams</span>
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Team or wrestler name" />
          </label>

          <section className={styles.list}>
            {filteredTeams.map((team) => {
              const titles = currentTitles(team);
              return (
                <article className={styles.card} key={team.teamId}>
                  <div className={styles.marketTop}>
                    <div>
                      <div className={styles.nameLine}>
                        <strong>{team.name}</strong>
                        {titles.map((reign) => (
                          <span className={styles.availability} key={reign.reignId}>{reign.championshipName}</span>
                        ))}
                      </div>
                      <span>Active team · formed {ppwDate(team.formedDate)}</span>
                    </div>
                    <span className={styles.availability}>{team.currentMembers.length} members</span>
                  </div>

                  <div className={styles.metricGrid}>
                    {team.currentMembers.map((member) => {
                      const wrestler = rosterById.get(member.personId);
                      return (
                        <div key={member.membershipId}>
                          <span>{wrestler ? label(wrestler.alignment) : "Roster"}</span>
                          <strong>{member.name}</strong>
                          <small style={{ color: "#8da5a2" }}>{wrestler ? `POP ${Math.round(wrestler.popularity)} · MOM ${Math.round(wrestler.momentum)}` : "Active member"}</small>
                        </div>
                      );
                    })}
                  </div>

                  <div className={styles.marketBottom}>
                    <span>{titles.length > 0 ? titles.map((reign) => `${reign.championshipName} · ${reign.promotionName}`).join(" · ") : "No current tag championship"}</span>
                    <span>{team.totalTitleReigns} title reigns · {team.totalDefenses} defenses</span>
                  </div>
                </article>
              );
            })}
            {filteredTeams.length === 0 ? (
              <div className={styles.empty}>{rosterTeams.length === 0 ? "No active team currently has its full membership on your roster." : "Nothing matches this search."}</div>
            ) : null}
          </section>

          <p className={styles.footerNote}>A team appears here only when it is active and every current member is on your roster. Team identity remains shared World history; this screen does not create, break up or modify teams.</p>
        </>
      ) : null}
    </main>
  );
}
