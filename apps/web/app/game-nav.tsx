"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import styles from "./game-nav.module.css";

type NavItem = {
  href: string;
  label: string;
  shortLabel: string;
  matches: (pathname: string) => boolean;
};

const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "World", shortLabel: "W", matches: (pathname) => pathname === "/" },
  { href: "/talent", label: "Talent", shortLabel: "T", matches: (pathname) => pathname.startsWith("/talent") },
  { href: "/planner", label: "Plan", shortLabel: "P", matches: (pathname) => pathname.startsWith("/planner") || pathname.startsWith("/card") },
  { href: "/business", label: "Business", shortLabel: "B", matches: (pathname) => pathname.startsWith("/business") },
  { href: "/results", label: "Results", shortLabel: "R", matches: (pathname) => pathname.startsWith("/results") },
];

export default function GameNav(): React.JSX.Element {
  const pathname = usePathname();

  return (
    <>
      <div className={styles.spacer} aria-hidden="true" />
      <nav className={styles.nav} aria-label="Game navigation">
        {NAV_ITEMS.map((item) => {
          const active = item.matches(pathname);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`${styles.item} ${active ? styles.active : ""}`}
              aria-current={active ? "page" : undefined}
            >
              <span className={styles.icon} aria-hidden="true">{item.shortLabel}</span>
              <span className={styles.label}>{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </>
  );
}
