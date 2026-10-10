import styles from "./talent.module.css";

export type RosterSection = "SINGLES" | "TAG_TEAMS" | "STABLES";

export default function RosterNav({ active }: { active: RosterSection }): React.JSX.Element {
  return (
    <nav className={styles.rosterModes} aria-label="Roster type">
      <a className={active === "SINGLES" ? styles.rosterModeActive : styles.rosterMode} href="/talent">
        <strong>Singles</strong>
        <span>Individual roster</span>
      </a>
      <a className={active === "TAG_TEAMS" ? styles.rosterModeActive : styles.rosterMode} href="/talent/teams">
        <strong>Tag teams</strong>
        <span>Established pairs</span>
      </a>
      <span className={styles.rosterModeDisabled} aria-disabled="true">
        <strong>Trios</strong>
        <span>Planned</span>
      </span>
      <a className={active === "STABLES" ? styles.rosterModeActive : styles.rosterMode} href="/talent/stables">
        <strong>Stables</strong>
        <span>Groups & membership</span>
      </a>
    </nav>
  );
}
