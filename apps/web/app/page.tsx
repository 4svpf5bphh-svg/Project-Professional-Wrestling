import AlphaHome from "./alpha-home";

export default function Page(): React.JSX.Element {
  return (
    <>
      <AlphaHome />
      <a
        href="/card"
        style={{
          position: "fixed",
          right: 16,
          bottom: "calc(78px + env(safe-area-inset-bottom))",
          zIndex: 30,
          border: "1px solid rgba(93, 233, 206, .38)",
          borderRadius: 999,
          background: "rgba(12, 22, 27, .96)",
          color: "#5de9ce",
          padding: "10px 14px",
          fontSize: 12,
          fontWeight: 900,
          textDecoration: "none",
          boxShadow: "0 10px 32px rgba(0, 0, 0, .28)",
        }}
      >
        Book / review card →
      </a>
    </>
  );
}
