export default function IndustryLayout({ children }: Readonly<{ children: React.ReactNode }>): React.JSX.Element {
  return (
    <>
      <div style={{ background: "#071014", padding: "12px 16px 0" }}>
        <div style={{ maxWidth: 900, margin: "0 auto" }}>
          <a href="/championships" style={{ color: "#5de9ce", fontWeight: 850, textDecoration: "none" }}>
            Championship history →
          </a>
        </div>
      </div>
      {children}
    </>
  );
}
