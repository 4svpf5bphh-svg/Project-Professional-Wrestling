import Link from "next/link";
import ResultsClient from "./results-client";

const INDUSTRY_LINK_STYLE = {
  display: "block",
  maxWidth: 900,
  margin: "0 auto",
  color: "#72ead3",
  fontWeight: 900,
  textDecoration: "none",
} as const;

export default function ResultsPage(): React.JSX.Element {
  return (
    <>
      <div style={{ background: "#071014", padding: "14px 16px 0" }}>
        <Link href="/industry" style={INDUSTRY_LINK_STYLE}>Open Industry & rankings →</Link>
      </div>
      <ResultsClient />
    </>
  );
}
