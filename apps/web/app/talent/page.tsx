import Link from "next/link";
import TalentClient from "./talent-client";

const DIRECTORY_LINK_STYLE = {
  display: "block",
  maxWidth: 900,
  margin: "0 auto",
  color: "#72ead3",
  fontWeight: 900,
  textDecoration: "none",
} as const;

export default function TalentPage(): React.JSX.Element {
  return (
    <>
      <div style={{ background: "#071014", padding: "14px 16px 0" }}>
        <Link href="/talent/directory" style={DIRECTORY_LINK_STYLE}>Browse wrestler profiles →</Link>
      </div>
      <TalentClient />
    </>
  );
}
