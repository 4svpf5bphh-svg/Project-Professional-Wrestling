import Link from "next/link";
import TalentClient from "./talent-client";

const TOP_BAR_STYLE = {
  maxWidth: 900,
  margin: "0 auto",
  display: "flex",
  flexWrap: "wrap",
  alignItems: "center",
  gap: 8,
} as const;

const ACTIVE_ROSTER_LINK_STYLE = {
  border: "1px solid rgba(93, 233, 206, .7)",
  borderRadius: 999,
  background: "rgba(93, 233, 206, .12)",
  color: "#72ead3",
  padding: "8px 12px",
  fontWeight: 900,
  textDecoration: "none",
} as const;

const ROSTER_LINK_STYLE = {
  border: "1px solid rgba(93, 233, 206, .22)",
  borderRadius: 999,
  color: "#a8c2bd",
  padding: "8px 12px",
  fontWeight: 900,
  textDecoration: "none",
} as const;

const DIRECTORY_LINK_STYLE = {
  marginLeft: "auto",
  color: "#72ead3",
  fontWeight: 900,
  textDecoration: "none",
} as const;

export default function TalentPage(): React.JSX.Element {
  return (
    <>
      <div style={{ background: "#071014", padding: "14px 16px 0" }}>
        <nav style={TOP_BAR_STYLE} aria-label="Roster views">
          <Link href="/talent" style={ACTIVE_ROSTER_LINK_STYLE} aria-current="page">Singles roster</Link>
          <Link href="/talent/teams" style={ROSTER_LINK_STYLE}>Tag teams</Link>
          <Link href="/talent/directory" style={DIRECTORY_LINK_STYLE}>Browse wrestler profiles →</Link>
        </nav>
      </div>
      <TalentClient />
    </>
  );
}
