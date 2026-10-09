"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import styles from "./game-nav.module.css";

type RootKey = "WORLD" | "TALENT" | "PLAN" | "BUSINESS" | "RESULTS";

type NavDestination = {
  href: string;
  label: string;
  description: string;
};

type NavItem = {
  key: RootKey;
  href: string;
  label: string;
  shortLabel: string;
  matches: (pathname: string) => boolean;
  destinations: NavDestination[];
};

const NAV_ITEMS: NavItem[] = [
  {
    key: "WORLD",
    href: "/",
    label: "World",
    shortLabel: "W",
    matches: (pathname) => pathname === "/" || pathname.startsWith("/industry") || pathname.startsWith("/championships"),
    destinations: [
      { href: "/", label: "World overview", description: "Your promotion and the shared World." },
      { href: "/industry", label: "Promotions", description: "Rivals and the wider industry." },
      { href: "/championships", label: "Championships", description: "World title landscape and history." },
    ],
  },
  {
    key: "TALENT",
    href: "/talent",
    label: "Talent",
    shortLabel: "T",
    matches: (pathname) => pathname.startsWith("/talent") || pathname.startsWith("/teams"),
    destinations: [
      { href: "/talent", label: "Roster", description: "Manage your contracted wrestlers, roles, alignment and renewals." },
      { href: "/talent?view=market", label: "Talent market", description: "Search and filter wrestlers currently available to recruit." },
      { href: "/talent/teams", label: "Tag teams", description: "Manage established teams on your roster." },
      { href: "/talent?view=offers", label: "Offers", description: "Review your pending contract offers." },
      { href: "/talent/directory", label: "Wrestler directory", description: "Search everyone in the shared World." },
    ],
  },
  {
    key: "PLAN",
    href: "/planner",
    label: "Plan",
    shortLabel: "P",
    matches: (pathname) => pathname.startsWith("/planner") || pathname.startsWith("/calendar") || pathname.startsWith("/card") || pathname.startsWith("/programmes"),
    destinations: [
      { href: "/planner", label: "Shows", description: "Six-week schedule, markets and venues." },
      { href: "/calendar", label: "Calendar", description: "Upcoming public shows across the shared World." },
      { href: "/programmes", label: "Programmes", description: "Create and follow ongoing rivalries and stories." },
      { href: "/card", label: "Current booking", description: "Open the show card you are working on." },
    ],
  },
  {
    key: "BUSINESS",
    href: "/business",
    label: "Business",
    shortLabel: "B",
    matches: (pathname) => pathname.startsWith("/business"),
    destinations: [
      { href: "/business", label: "Business overview", description: "Cash, operating position and recent performance." },
    ],
  },
  {
    key: "RESULTS",
    href: "/results",
    label: "Results",
    shortLabel: "R",
    matches: (pathname) => pathname.startsWith("/results"),
    destinations: [
      { href: "/results", label: "My shows", description: "Completed cards and crowd stories." },
    ],
  },
];

function rootForPath(pathname: string): RootKey {
  return NAV_ITEMS.find((item) => item.matches(pathname))?.key ?? "WORLD";
}

export default function GameNav(): React.JSX.Element {
  const pathname = usePathname();
  const router = useRouter();
  const activeRoot = useMemo(() => rootForPath(pathname), [pathname]);
  const [expanded, setExpanded] = useState(false);
  const [section, setSection] = useState<RootKey>(activeRoot);

  useEffect(() => {
    setSection(activeRoot);
    setExpanded(false);
  }, [pathname, activeRoot]);

  const selected = NAV_ITEMS.find((item) => item.key === section) ?? NAV_ITEMS[0]!;

  function chooseRoot(item: NavItem): void {
    if (expanded) {
      setSection(item.key);
      return;
    }
    if (item.matches(pathname)) {
      setSection(item.key);
      setExpanded(true);
      return;
    }
    router.push(item.href);
  }

  return (
    <>
      <div className={styles.spacer} aria-hidden="true" />
      {expanded ? <button className={styles.backdrop} aria-label="Close navigation menu" onClick={() => setExpanded(false)} /> : null}
      <nav className={`${styles.nav} ${expanded ? styles.expanded : ""}`} aria-label="Game navigation">
        <button
          className={styles.handle}
          type="button"
          aria-expanded={expanded}
          aria-label={expanded ? "Collapse game navigation" : "Expand game navigation"}
          onClick={() => {
            if (!expanded) setSection(activeRoot);
            setExpanded((value) => !value);
          }}
        >
          <span />
        </button>

        <div className={`${styles.drawer} ${expanded ? styles.drawerOpen : ""}`} aria-hidden={!expanded}>
          <div className={styles.drawerHeading}>
            <span>{selected.label.toUpperCase()}</span>
            <strong>{selected.label}</strong>
          </div>
          <div className={styles.destinations}>
            {selected.destinations.map((destination) => (
              <button
                key={destination.href}
                className={styles.destination}
                type="button"
                onClick={() => {
                  setExpanded(false);
                  router.push(destination.href);
                }}
              >
                <strong>{destination.label}</strong>
                <span>{destination.description}</span>
              </button>
            ))}
          </div>
        </div>

        <div className={styles.roots}>
          {NAV_ITEMS.map((item) => {
            const active = item.matches(pathname);
            const selectedRoot = expanded ? section === item.key : active;
            return (
              <button
                key={item.key}
                type="button"
                className={`${styles.item} ${selectedRoot ? styles.active : ""}`}
                aria-current={active ? "page" : undefined}
                onClick={() => chooseRoot(item)}
              >
                <span className={styles.icon} aria-hidden="true">{item.shortLabel}</span>
                <span className={styles.label}>{item.label}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </>
  );
}
