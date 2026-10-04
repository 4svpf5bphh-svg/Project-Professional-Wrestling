import AlphaHome from "./alpha-home";

const linkStyle = {
  border: "1px solid rgba(93, 233, 206, .38)",
  borderRadius: 999,
  background: "rgba(12, 22, 27, .96)",
  color: "#5de9ce",
  padding: "10px 14px",
  fontSize: 12,
  fontWeight: 900,
  textDecoration: "none",
  boxShadow: "0 10px 32px rgba(0, 0, 0, .28)",
} as const;

export default function Page(): React.JSX.Element {
  return (
    <>
      <AlphaHome />
      <nav
        aria-label="Quick game navigation"
        style={{
          position: "fixed",
          right: 16,
          bottom: "calc(78px + env(safe-area-inset-bottom))",
          zIndex: 30,
          display: "flex",
          flexWrap: "wrap",
          justifyContent: "flex-end",
          gap: 8,
          maxWidth: "calc(100vw - 32px)",
        }}
      >
        <a href="/talent" style={linkStyle}>Roster & talent</a>
        <a href="/results" style={linkStyle}>Results</a>
        <a href="/card" style={linkStyle}>Book / review card →</a>
      </nav>
    </>
  );
}
