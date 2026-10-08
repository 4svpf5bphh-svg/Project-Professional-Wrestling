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
  const [creating, setCreating] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [teamName, setTeamName] = useState("");
  const [firstPersonId, setFirstPersonId] = useState("");
  const [secondPersonId, setSecondPersonId] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
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

  async function createTeam(): Promise<void> {
    if (!teams || !teamName.trim() || !firstPersonId || !secondPersonId) return;
    setCreating(true);
    setError(null);
    setNotice(null);
    try {
      const response = await fetch("/api/teams", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requestId: crypto.randomUUID(),
          expectedRevision: teams.world.revision,
          name: teamName,
          personIds: [firstPersonId, secondPersonId],
        }),
      });
      const payload = await response.json() as PlayerTeamHistoryView | ErrorPayload;
      if (!response.ok || isErrorPayload(payload)) {
        throw new Error(isErrorPayload(payload) && payload.error ? payload.error : "Unable to create tag team");
      }
      setTeams(payload);
      setTeamName("");
      setFirstPersonId("");
      setSecondPersonId("");
      setCreateOpen(false);
      setNotice("Tag team created. Chemistry and familiarity will develop only by working together.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to create tag team");
    } finally {
      setCreating(false);
    }
  }

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
        <div className={styles.cardActions}>
          <button
            className={styles.primaryButton}
            disabled={loading || !teams?.canEdit || (talent?.roster.length ?? 0) < 2}
            onClick={() => setCreateOpen(true)}
          >
            + Create team
          </button>
          <button className={styles.button} disabled={loading} onClick={() => void refresh()}>{loading ? "Loading…" : "Refresh"}</button>
        </div>
      </header>

      {error ? <div className={styles.error}>{error}</div> : null}
      {notice ? <div className={styles.notice}>{notice}</div> : null}
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
                    <span>
                      {team.experience
                        ? `${label(team.experience.band)} · ${team.experience.matchesTogether} tag match${team.experience.matchesTogether === 1 ? "" : "es"} together`
                        : "Team experience unavailable"}
                    </span>
                    <span>{team.totalTitleReigns} title reigns · {team.totalDefenses} defenses</span>
                  </div>
                </article>
              );
            })}
            {filteredTeams.length === 0 ? (
              <div className={styles.empty}>{rosterTeams.length === 0 ? "No active team currently has its full membership on your roster." : "Nothing matches this search."}</div>
            ) : null}
          </section>

          <p className={styles.footerNote}>Creating a team declares its World identity; it does not create chemistry or make the pairing instantly good. Familiarity develops through tag matches. Breakups and reformations remain a later layer.</p>

          {createOpen ? (
            <section className={styles.editor}>
              <div className={styles.editorHeader}>
                <div>
                  <span className={styles.eyebrow}>CREATE TAG TEAM</span>
                  <h2>Name the team</h2>
                  <p>Choose two wrestlers from your current roster. The pair keeps its existing hidden compatibility and starts with only the familiarity it has actually earned.</p>
                </div>
                <button className={styles.button} disabled={creating} onClick={() => setCreateOpen(false)}>Close</button>
              </div>
              <div className={styles.editorBody}>
                <div className={styles.formGrid}>
                  <label>
                    <span>Team name</span>
                    <input maxLength={60} value={teamName} onChange={(event) => setTeamName(event.target.value)} placeholder="e.g. United Empire" />
                  </label>
                  <label>
                    <span>Wrestler one</span>
                    <select value={firstPersonId} onChange={(event) => setFirstPersonId(event.target.value)}>
                      <option value="">Choose wrestler</option>
                      {(talent?.roster ?? []).map((wrestler) => (
                        <option key={wrestler.personId} value={wrestler.personId} disabled={wrestler.personId === secondPersonId}>
                          {wrestler.name} · {label(wrestler.alignment)}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    <span>Wrestler two</span>
                    <select value={secondPersonId} onChange={(event) => setSecondPersonId(event.target.value)}>
                      <option value="">Choose wrestler</option>
                      {(talent?.roster ?? []).map((wrestler) => (
                        <option key={wrestler.personId} value={wrestler.personId} disabled={wrestler.personId === firstPersonId}>
                          {wrestler.name} · {label(wrestler.alignment)}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              </div>
              <div className={styles.editorFooter}>
                <span>No chemistry boost is granted. The team gets better only by working together.</span>
                <button
                  className={styles.primaryButton}
                  disabled={creating || !teamName.trim() || !firstPersonId || !secondPersonId || firstPersonId === secondPersonId}
                  onClick={() => void createTeam()}
                >
                  {creating ? "Creating…" : "Create tag team"}
                </button>
              </div>
            </section>
          ) : null}
        </>
      ) : null}
    </main>
  );
}
