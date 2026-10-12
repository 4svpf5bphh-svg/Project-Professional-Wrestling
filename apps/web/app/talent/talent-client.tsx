"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type {
  PlayerPendingContractOfferView,
  PlayerRosterContractView,
  PlayerTalentManagementView,
  PlayerTalentMarketView,
} from "../../../../dist/packages/application/src/talent-view.js";
import type {
  AlphaRosterAlignmentResult,
  AlphaTalentOfferRequest,
  AlphaTalentOfferResult,
  AlphaDatesAddendumRequest,
  AlphaDatesAddendumResult,
  AlphaTalentWatchResult,
} from "../../../../dist/packages/web-adapter/src/talent-service.js";
import RosterNav from "./roster-nav";
import styles from "./talent.module.css";

type ErrorPayload = { error?: string };
export type TalentTab = "ROSTER" | "MARKET" | "OFFERS" | "CONTRACTS";
type OfferFamily = AlphaTalentOfferRequest["family"];
type OfferRole = AlphaTalentOfferRequest["roleExpectation"];
type OfferCreative = NonNullable<AlphaTalentOfferRequest["creativeControl"]>;
type RosterSort = "POPULARITY" | "RECOGNITION" | "DATES_ASC" | "DATES_DESC" | "EXPIRY" | "WAGE_HIGH" | "WAGE_LOW" | "FEE_HIGH" | "FEE_LOW" | "NAME";
type RosterGroupKey = OfferRole | "ALL_ROLES";
type RosterContractFilter = "ALL" | "EXCLUSIVE" | "NON_EXCLUSIVE";
type RosterDivisionFilter = "ALL" | "MEN" | "WOMEN";
type MarketSort = "INTEREST" | "POPULARITY" | "RECOGNITION" | "VALUE_HIGH" | "VALUE_LOW" | "NAME";
type MarketAvailabilityFilter = "ALL" | "FREE_AGENT" | "NON_EXCLUSIVE";
type MarketDivisionFilter = "ALL" | "MEN" | "WOMEN";
type MarketInterestFilter = "ALL" | "OPEN_PLUS" | "INTERESTED_PLUS";
type Alignment = PlayerRosterContractView["alignment"];

type OfferTarget = {
  requestId: string;
  personId: string;
  personName: string;
  sourceContractId: string | null;
  referenceValue: number;
  suggestedRoleExpectation: OfferRole;
  interest: PlayerTalentMarketView["interest"] | null;
  trust: number | null;
  currentContract: PlayerRosterContractView["contract"] | null;
  renewalMode: "SAME_TERMS" | "NEGOTIATE";
};

type OfferDraft = Omit<AlphaTalentOfferRequest, "requestId" | "personId" | "sourceContractId">;

const CREATIVE_CHOICES: {
  value: OfferCreative;
  title: string;
  explanation: string;
  tradeoff: string;
}[] = [
  { value: "NONE", title: "Standard terms",
    explanation: "Normal booking authority. Existing wrestler-owned gimmick resistance still applies.",
    tradeoff: "No additional creative bargaining value." },
  { value: "CONSULTATION", title: "Consultation",
    explanation: "Discuss major losses or changes. The wrestler may object, but has no contractual veto.",
    tradeoff: "A modest concession with no match-approval blocker." },
  { value: "PROTECTED_FINISHES", title: "Protected finishes",
    explanation: "A clean pin or submission loss needs agreement. Other finishes and match assignments remain bookable.",
    tradeoff: "Stronger bargaining value; some finishes require consent." },
  { value: "FULL_APPROVAL", title: "Full creative approval",
    explanation: "Match assignments and major presentation changes need wrestler consent. Refusal can force a rewrite.",
    tradeoff: "Strongest bargaining concession and the greatest booking restriction." },
];

const ROLE_OPTIONS: OfferRole[] = [
  "DEVELOPMENTAL",
  "REGULAR",
  "FEATURED",
  "UPPER_CARD",
  "MAIN_EVENT",
  "SPECIAL_ATTRACTION",
];

const INTEREST_RANK: Record<PlayerTalentMarketView["interest"], number> = {
  NOT_INTERESTED: 0,
  LONG_SHOT: 1,
  OPEN_TO_TALKS: 2,
  INTERESTED: 3,
  KEEN: 4,
};

const MARKET_MIN_OPTIONS = [0, 40, 50, 60, 70, 80, 90] as const;

const ROSTER_ROLE_ORDER: OfferRole[] = [
  "MAIN_EVENT",
  "SPECIAL_ATTRACTION",
  "UPPER_CARD",
  "FEATURED",
  "REGULAR",
  "DEVELOPMENTAL",
];

function isErrorPayload(payload: PlayerTalentManagementView | AlphaTalentOfferResult | AlphaDatesAddendumResult | AlphaRosterAlignmentResult | AlphaTalentWatchResult | ErrorPayload): payload is ErrorPayload {
  return "error" in payload;
}

function money(value: number): string {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatMoneyInput(value: number): string {
  return new Intl.NumberFormat("en-GB", {
    maximumFractionDigits: 0,
    useGrouping: true,
  }).format(Math.max(0, Math.round(value)));
}

function parseMoneyInput(value: string): number | null {
  const normalized = value.replace(/[\s,£$]/g, "");
  if (normalized === "") return null;
  if (!/^\d+$/.test(normalized)) return null;
  const parsed = Number(normalized);
  return Number.isSafeInteger(parsed) ? parsed : null;
}

function MoneyInput({
  value,
  disabled = false,
  onChange,
}: {
  value: number;
  disabled?: boolean;
  onChange: (value: number) => void;
}): React.JSX.Element {
  const [text, setText] = useState(() => formatMoneyInput(value));
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    if (!focused) setText(formatMoneyInput(value));
  }, [value, focused]);

  return (
    <input
      type="text"
      inputMode="numeric"
      autoComplete="off"
      value={text}
      disabled={disabled}
      onFocus={() => setFocused(true)}
      onBlur={() => {
        setFocused(false);
        setText(formatMoneyInput(value));
      }}
      onChange={(event) => {
        const next = event.target.value;
        if (!/^[\d\s,£$]*$/.test(next)) return;
        setText(next);
        onChange(parseMoneyInput(next) ?? 0);
      }}
    />
  );
}

function IntegerInput({
  value,
  min,
  max,
  disabled = false,
  onChange,
}: {
  value: number;
  min: number;
  max: number;
  disabled?: boolean;
  onChange: (value: number) => void;
}): React.JSX.Element {
  const [text, setText] = useState(() => String(value));
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    if (!focused) setText(String(value));
  }, [value, focused]);

  function commit(raw: string): void {
    const parsed = /^\d+$/.test(raw) ? Number(raw) : value;
    const bounded = Math.min(max, Math.max(min, Number.isSafeInteger(parsed) ? parsed : value));
    onChange(bounded);
    setText(String(bounded));
  }

  return (
    <input
      type="text"
      inputMode="numeric"
      autoComplete="off"
      value={text}
      disabled={disabled}
      onFocus={() => setFocused(true)}
      onBlur={() => {
        setFocused(false);
        commit(text);
      }}
      onChange={(event) => {
        const next = event.target.value;
        if (!/^\d*$/.test(next)) return;
        setText(next);
        if (next !== "") {
          const parsed = Number(next);
          if (Number.isSafeInteger(parsed) && parsed >= min && parsed <= max) onChange(parsed);
        }
      }}
    />
  );
}

function ppwDate(date: { year: number; week: number }): string {
  return `Y${date.year} W${date.week}`;
}

function label(value: string): string {
  return value.replaceAll("_", " ");
}

function interestLabel(value: PlayerTalentMarketView["interest"]): string {
  if (value === "OPEN_TO_TALKS") return "Open to talks";
  if (value === "LONG_SHOT") return "Long shot";
  if (value === "NOT_INTERESTED") return "Not interested";
  return label(value).replace(/^./, (character) => character.toUpperCase());
}

function interestClass(value: PlayerTalentMarketView["interest"]): string {
  if (value === "KEEN" || value === "INTERESTED") return styles.interestPositive;
  if (value === "OPEN_TO_TALKS") return styles.interestNeutral;
  return styles.interestLow;
}

function averageSkill(entry: { skills: { inRingQuality: number; matchCraft: number; presentation: number } }): number {
  return Math.round((entry.skills.inRingQuality + entry.skills.matchCraft + entry.skills.presentation) / 3);
}

function matchesQuery(name: string, query: string): boolean {
  return name.toLowerCase().includes(query.trim().toLowerCase());
}

function requestIdFor(personId: string): string {
  const suffix = typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `talent-offer:${personId}:${suffix}`;
}

function defaultDraft(target: OfferTarget): OfferDraft {
  const contract = target.currentContract;
  if (contract) {
    if (target.renewalMode === "SAME_TERMS" && contract.sameTermsRenewal) {
      return { ...contract.sameTermsRenewal };
    }
    const family = contract.family;
    return {
      family,
      roleExpectation: contract.roleExpectation,
      creativeControl: contract.creativeControl,
      termWeeks: contract.sameTermsRenewal?.termWeeks ?? (family === "EXCLUSIVE" ? 26 : family === "ONE_OFF" ? 1 : 13),
      dateEntitlement: family === "EXCLUSIVE" ? (contract.sameTermsRenewal?.termWeeks ?? 26) : family === "ONE_OFF" ? 1 : Math.max(1, contract.dateEntitlement),
      weeklyGuarantee: family === "ONE_OFF" ? 0
        : family === "EXCLUSIVE" ? Math.max(contract.weeklyGuarantee, Math.ceil(target.referenceValue * 0.5))
          : contract.weeklyGuarantee,
      appearanceFee: family === "EXCLUSIVE" ? 0 : contract.appearanceFee,
      signingBonus: 0, // Previous signing bonuses were one-time payments, not standing renewal terms.
    };
  }

  const value = Math.max(1_000, Math.round(target.referenceValue));
  return {
    family: "LIMITED_NON_EXCLUSIVE",
    roleExpectation: target.suggestedRoleExpectation,
    creativeControl: "NONE",
    termWeeks: 13,
    dateEntitlement: 5,
    weeklyGuarantee: Math.round(value * 0.2),
    appearanceFee: value,
    signingBonus: value,
  };
}

function draftForFamily(family: OfferFamily, referenceValue: number, current: OfferDraft, isRenewal: boolean): OfferDraft {
  const value = Math.max(1_000, Math.round(referenceValue));
  if (family === "ONE_OFF") {
    return {
      ...current,
      family,
      termWeeks: 1,
      dateEntitlement: 1,
      weeklyGuarantee: 0,
      appearanceFee: Math.max(current.appearanceFee, Math.round(value * 1.35)),
      signingBonus: 0,
    };
  }
  if (family === "EXCLUSIVE") {
    return {
      ...current,
      family,
      termWeeks: 26,
      dateEntitlement: 26, // retained for transport; exclusive appearances have no cap
      weeklyGuarantee: Math.max(current.weeklyGuarantee, Math.round(value * 1.3)),
      appearanceFee: 0,
      signingBonus: isRenewal ? current.signingBonus : Math.max(current.signingBonus, value * 4),
    };
  }
  return {
    ...current,
    family,
    termWeeks: 13,
    dateEntitlement: 5,
    weeklyGuarantee: Math.max(0, Math.round(value * 0.2)),
    appearanceFee: Math.max(current.appearanceFee, value),
    signingBonus: isRenewal ? current.signingBonus : Math.max(current.signingBonus, value),
  };
}


const ROLE_RANK: Record<OfferRole, number> = {
  DEVELOPMENTAL: 0,
  REGULAR: 1,
  FEATURED: 2,
  UPPER_CARD: 3,
  MAIN_EVENT: 4,
  SPECIAL_ATTRACTION: 4,
};

function moneyRange(low: number, high: number): string {
  return low === high ? money(low) : `${money(low)}–${money(high)}`;
}

function effectiveWeeklyPackage(draft: OfferDraft): number {
  const weeks = Math.max(1, draft.termWeeks);
  return draft.weeklyGuarantee
    + draft.signingBonus / weeks
    + (draft.appearanceFee * draft.dateEntitlement) / weeks;
}

function negotiationGuide(target: OfferTarget, draft: OfferDraft): {
  relationship: string;
  roleRead: string;
  cashRead: string;
  scheduleRead: string;
  structure: string;
  effectiveWeekly: number;
} {
  const reference = Math.max(1_000, target.referenceValue);
  const weeks = Math.max(1, draft.termWeeks);
  const density = draft.family === "EXCLUSIVE" ? 1 : draft.dateEntitlement / weeks;
  const actualWeekly = effectiveWeeklyPackage(draft);

  let typicalWeeklyLow = 0;
  let typicalWeeklyHigh = 0;
  let typicalAppearanceLow = 0;
  let typicalAppearanceHigh = 0;
  let typicalSigningLow = 0;
  let typicalSigningHigh = 0;
  let densityLow = 0;
  let densityHigh = 1;

  if (draft.family === "ONE_OFF") {
    typicalAppearanceLow = reference * 1.2;
    typicalAppearanceHigh = reference * 1.8;
    densityLow = 1;
    densityHigh = 1;
  } else if (draft.family === "EXCLUSIVE") {
    typicalWeeklyLow = reference;
    typicalWeeklyHigh = reference * 1.25;
    typicalSigningLow = reference * 3;
    typicalSigningHigh = reference * 8;
    densityLow = 0;
    densityHigh = 2;
  } else {
    typicalWeeklyLow = reference * 0.12;
    typicalWeeklyHigh = reference * 0.26;
    typicalAppearanceLow = reference * 0.8;
    typicalAppearanceHigh = reference * 1.15;
    typicalSigningLow = reference * 0.5;
    typicalSigningHigh = reference * 2;
    densityLow = 0.22;
    densityHigh = 0.42;
  }

  const midpointWeekly = (typicalWeeklyLow + typicalWeeklyHigh) / 2;
  const midpointAppearance = (typicalAppearanceLow + typicalAppearanceHigh) / 2;
  const midpointSigning = (typicalSigningLow + typicalSigningHigh) / 2;
  const typicalEquivalent = Math.max(
    1,
    midpointWeekly + (midpointAppearance * draft.dateEntitlement) / weeks + midpointSigning / weeks,
  );
  const packageRatio = actualWeekly / typicalEquivalent;
  const cashRead = packageRatio < 0.8
    ? "Below the normal PPW structure for this deal"
    : packageRatio > 1.2
      ? "Above the normal PPW structure for this deal"
      : "Around the normal PPW structure for this deal";

  const selectedRole = ROLE_RANK[draft.roleExpectation];
  const suggestedRole = ROLE_RANK[target.suggestedRoleExpectation];
  const roleRead = selectedRole < suggestedRole
    ? `Below profile · ${label(target.suggestedRoleExpectation)} is the current guide`
    : selectedRole > suggestedRole
      ? `Above profile · stronger promise than the current ${label(target.suggestedRoleExpectation)} guide`
      : `Aligned with current ${label(target.suggestedRoleExpectation)} profile`;

  const scheduleRead = draft.family === "EXCLUSIVE"
    ? `Unlimited contracted appearances across ${weeks} weeks (fitness and workload still apply)`
    : draft.family === "ONE_OFF"
      ? "Single appearance"
    : density < densityLow
      ? `Light commitment · ${draft.dateEntitlement} dates across ${weeks} weeks`
      : density > densityHigh
        ? `Heavy commitment · ${draft.dateEntitlement} dates across ${weeks} weeks`
        : `Normal commitment · ${draft.dateEntitlement} dates across ${weeks} weeks`;

  const relationship = target.interest
    ? `Recruitment interest: ${interestLabel(target.interest)}`
    : target.trust !== null
      ? target.trust >= 65
        ? `Relationship: strong · Trust ${Math.round(target.trust)}`
        : target.trust >= 45
          ? `Relationship: steady · Trust ${Math.round(target.trust)}`
          : `Relationship: fragile · Trust ${Math.round(target.trust)}`
      : "Relationship: no established read";

  const structure = draft.family === "ONE_OFF"
    ? `One-off guide: appearance ${moneyRange(Math.round(typicalAppearanceLow), Math.round(typicalAppearanceHigh))}; no weekly guarantee or signing bonus.`
    : draft.family === "EXCLUSIVE"
      ? `Exclusive guide: weekly ${moneyRange(Math.round(typicalWeeklyLow), Math.round(typicalWeeklyHigh))}; minimum ${money(Math.ceil(reference * 0.5))}/wk; signing ${moneyRange(Math.round(typicalSigningLow), Math.round(typicalSigningHigh))}; no separate appearance fee; unlimited appearances during the term.`
      : `Non-exclusive guide: weekly ${moneyRange(Math.round(typicalWeeklyLow), Math.round(typicalWeeklyHigh))}; appearance ${moneyRange(Math.round(typicalAppearanceLow), Math.round(typicalAppearanceHigh))}; signing ${moneyRange(Math.round(typicalSigningLow), Math.round(typicalSigningHigh))}; roughly 22–42% of the term purchased.`;

  return {
    relationship,
    roleRead,
    cashRead,
    scheduleRead,
    structure,
    effectiveWeekly: Math.round(actualWeekly),
  };
}

function InjuryBadge({ injury }: { injury: { severity: string; weeksRemaining: number } | null }): React.JSX.Element | null {
  if (!injury) return null;
  return <span className={styles.injury}>{label(injury.severity)} · {injury.weeksRemaining}w</span>;
}

function RosterCard({
  wrestler,
  rosterSort,
  pending,
  alignmentSaving,
  onAlignment,
  onRenew,
  onAddDates,
}: {
  wrestler: PlayerRosterContractView;
  rosterSort: RosterSort;
  pending: boolean;
  alignmentSaving: boolean;
  onAlignment: (alignment: Alignment) => void;
  onRenew: (mode: "SAME_TERMS" | "NEGOTIATE") => void;
  onAddDates: () => void;
}): React.JSX.Element {
  const contract = wrestler.contract;
  return (
    <details className={`${styles.card} ${styles.rosterCard}`}>
      <summary className={styles.summary}>
        <div>
          <div className={styles.nameLine}>
            <strong>{wrestler.name}</strong>
            <span className={styles.divisionBadge}>{wrestler.division === "WOMEN" ? "Women" : "Men"}</span>
            <span className={styles.availability}>{label(wrestler.alignment)}</span>
            <InjuryBadge injury={wrestler.injury} />
            <span className={styles.availability}>{contract.exclusivity === "EXCLUSIVE" ? "Exclusive" : "Non-exclusive"}</span>
            {pending ? <span className={styles.pending}>Offer pending</span> : contract.renewalWindowOpen ? <span className={styles.pending}>Contract decision</span> : null}
          </div>
          <span>{label(wrestler.careerStage)} · {label(contract.family)} · {contract.exclusivity === "EXCLUSIVE" ? "Exclusive" : "Non-exclusive"}</span>
        </div>
        <div className={styles.scoreBlock}>
          <b>{rosterSort.startsWith("WAGE_")
            ? `${money(contract.weeklyGuarantee)}/week`
            : rosterSort.startsWith("FEE_")
              ? `${money(contract.appearanceFee)}/show`
              : `POP ${Math.round(wrestler.popularity)}`}</b>
          <small>{pending ? "Offer pending · " : contract.renewalWindowOpen ? "Contract action needed · " : ""}{contract.unlimitedAppearances ? "Unlimited dates" : `${contract.datesRemaining}/${contract.dateEntitlement} dates`} · {contract.weeksToExpiry}w left</small>
        </div>
      </summary>
      <div className={styles.cardBody}>
        <div className={styles.metricGrid}>
          <div><span>Trust</span><strong>{Math.round(wrestler.trust)}</strong></div>
          <div><span>Morale</span><strong>{Math.round(wrestler.morale)}</strong></div>
          <div><span>Momentum</span><strong>{Math.round(wrestler.momentum)}</strong></div>
          <div><span>Recognition</span><strong>{Math.round(wrestler.recognition)}</strong></div>
          <div><span>In-ring</span><strong>{Math.round(wrestler.skills.inRingQuality)}</strong></div>
          <div><span>Presentation</span><strong>{Math.round(wrestler.skills.presentation)}</strong></div>
        </div>
        <div className={styles.contractBox}>
          <div>
            <span>{label(contract.exclusivity)} · expires {ppwDate(contract.endDate)}</span>
            <strong>
              {contract.renewalReason === "DATES_EXHAUSTED"
                ? "All purchased dates used · renegotiation open"
                : contract.renewalWindowOpen
                  ? "Renewal window open"
                  : `${contract.weeksToExpiry} weeks to expiry`}
            </strong>
          </div>
          <div className={styles.moneyRows}>
            <span>Weekly guarantee <b>{money(contract.weeklyGuarantee)}</b></span>
            <span>Appearance fee <b>{money(contract.appearanceFee)}</b></span>
            <span>Signing bonus <b>{money(contract.signingBonus)}</b></span>
            {contract.creativeControl !== "NONE" ? (
              <span>Creative rights <b>{label(contract.creativeControl)}</b></span>
            ) : null}
          </div>
        </div>
        <div className={styles.presentationBox}>
          <div>
            <span>Promotion alignment</span>
            <small>
              {wrestler.alignmentNaturalReset
                ? wrestler.alignmentChangeMode === "INITIAL_PRESENTATION"
                  ? "Establish their initial presentation in your promotion. No turn is needed yet."
                  : wrestler.alignmentChangeMode === "JUST_SIGNED"
                    ? "New signing window: you can establish a fresh presentation cleanly."
                    : "Return window: a fresh presentation can make sense after the layoff."
                : "Changing this here is an unexplained off-screen switch. It is allowed, but the crowd may lose confidence. For a proper change, book a Turn segment."}
            </small>
          </div>
          <div className={styles.alignmentChoices} role="group" aria-label={`Alignment for ${wrestler.name}`}>
            {(["FACE", "HEEL", "TWEENER"] as const).map((alignment) => (
              <button
                key={alignment}
                type="button"
                className={wrestler.alignment === alignment ? styles.alignmentActive : styles.alignmentChoice}
                disabled={alignmentSaving}
                onClick={() => onAlignment(alignment)}
              >
                {label(alignment)}
              </button>
            ))}
          </div>
        </div>
        <div className={styles.cardActions}>
          <a className={styles.actionButton}
            href={`/talent/profile?personId=${encodeURIComponent(wrestler.personId)}&from=talent`}>
            Gimmick, moves &amp; profile →
          </a>
          <p className={styles.subtle}>Age {wrestler.biologicalAge.toFixed(1)} · Fatigue {Math.round(wrestler.fatigue)} · Wear {Math.round(wrestler.wear)} · Skill {averageSkill(wrestler)}</p>
          {pending ? <span className={styles.pending}>Your offer pending</span> : (
            <>
              {contract.family === "LIMITED_NON_EXCLUSIVE" ? (
                <button className={styles.actionButton} type="button" onClick={onAddDates}>Negotiate more dates</button>
              ) : null}
              {contract.renewalWindowOpen && contract.renewalReason === "EXPIRY_WINDOW" ? (
                <>
                  {contract.sameTermsRenewal
                    && (contract.family !== "EXCLUSIVE" || contract.weeklyGuarantee >= Math.ceil(wrestler.estimatedWeeklyValue * 0.5)) ? (
                    <button className={styles.actionButton} type="button"
                      onClick={() => onRenew("SAME_TERMS")}>Renew on current terms</button>
                  ) : null}
                  <button className={styles.actionButton} type="button"
                    onClick={() => onRenew("NEGOTIATE")}>Negotiate renewal</button>
                </>
              ) : null}
            </>
          )}
        </div>
      </div>
    </details>
  );
}

function MarketCard({
  wrestler,
  watchSaving,
  onWatch,
  onOffer,
}: {
  wrestler: PlayerTalentMarketView;
  watchSaving: boolean;
  onWatch: () => void;
  onOffer: () => void;
}): React.JSX.Element {
  const publicHome = wrestler.rosterAffiliations[0]?.promotionName
    ?? wrestler.employmentPromotions[0]?.promotionName
    ?? "Free agent";
  return (
    <details className={`${styles.card} ${styles.marketCard}`}>
      <summary className={styles.marketSummary}>
        <div className={styles.marketIdentity}>
          <div className={styles.nameLine}>
            <strong>{wrestler.name}</strong>
            <span className={styles.divisionBadge}>{wrestler.division === "WOMEN" ? "Women" : "Men"}</span>
            <InjuryBadge injury={wrestler.injury} />
          </div>
          <span>{publicHome} · {label(wrestler.careerStage)}</span>
        </div>
        <div className={styles.marketQuick}>
          <b>POP {Math.round(wrestler.popularity)}</b>
          <span className={interestClass(wrestler.interest)}>{interestLabel(wrestler.interest)}</span>
          <span className={styles.availability}>{wrestler.availability === "FREE_AGENT" ? "Free agent" : "Non-exclusive"}</span>
        </div>
      </summary>
      <div className={styles.marketDetails}>
        <div className={styles.marketFacts}>
          <span>Recognition <b>{Math.round(wrestler.recognition)}</b></span>
          <span>Momentum <b>{Math.round(wrestler.momentum)}</b></span>
          <span>In-ring <b>{Math.round(wrestler.skills.inRingQuality)}</b></span>
          <span>Craft <b>{Math.round(wrestler.skills.matchCraft)}</b></span>
          <span>Presentation <b>{Math.round(wrestler.skills.presentation)}</b></span>
          <span>Age <b>{wrestler.biologicalAge.toFixed(1)}</b></span>
        </div>
        {wrestler.employmentPromotions.length > 0 ? (
          <p className={styles.marketAffiliation}>
            Employed by {wrestler.employmentPromotions.map((entry) => entry.promotionName).join(", ")}
            {wrestler.rosterAffiliations.length > 0
              ? ` · Roster: ${wrestler.rosterAffiliations.map((entry) => entry.promotionName).join(", ")}`
              : ""}
          </p>
        ) : null}
        <div className={styles.marketBottom}>
          <span>Estimated market value <b>{money(wrestler.estimatedWeeklyValue)}/wk</b></span>
          <div className={styles.marketActions}>
            <button
              className={wrestler.watched ? styles.watchButtonActive : styles.watchButton}
              type="button"
              disabled={watchSaving}
              onClick={onWatch}
            >
              {watchSaving ? "Saving…" : wrestler.watched ? "★ Watching" : "☆ Watch"}
            </button>
            {wrestler.hasOurPendingOffer ? <span className={styles.pending}>Your offer pending</span> : (
              <button className={styles.actionButton} type="button" onClick={onOffer}>Make offer</button>
            )}
          </div>
        </div>
      </div>
    </details>
  );
}

function OfferCard({ offer, focused = false }: { offer: PlayerPendingContractOfferView; focused?: boolean }): React.JSX.Element {
  return (
    <article
      id={`pending-contract-${offer.offerId}`}
      className={`${styles.card} ${focused ? styles.focusedOffer : ""}`}
      tabIndex={focused ? -1 : undefined}
      aria-label={focused ? `Pending contract offer for ${offer.personName}` : undefined}
    >
      <div className={styles.marketTop}>
        <div>
          <strong>{offer.personName}</strong>
          <span>{label(offer.offerKind)} · submitted {ppwDate(offer.submittedDate)}</span>
        </div>
        <span className={styles.pending}>Pending</span>
      </div>
      <div className={styles.contractBox}>
        <div>
          <span>{offer.offerKind === "DATES_ADDENDUM" ? "Additional-dates proposal · same contract" : `${label(offer.family)} · ${label(offer.exclusivity)}`}</span>
          <strong>{label(offer.roleExpectation)} · {offer.family === "EXCLUSIVE" ? "Unlimited dates" : `${offer.dateEntitlement} ${offer.offerKind === "DATES_ADDENDUM" ? "total dates proposed" : "dates"}`} · to {ppwDate(offer.endDate)}</strong>
        </div>
        <div className={styles.moneyRows}>
          <span>Weekly <b>{money(offer.weeklyGuarantee)}</b></span>
          <span>Appearance <b>{money(offer.appearanceFee)}</b></span>
          <span>{offer.offerKind === "DATES_ADDENDUM" ? "Extra payment" : "Signing"} <b>{money(offer.signingBonus)}</b></span>
          {offer.creativeControl !== "NONE" && offer.offerKind !== "DATES_ADDENDUM" ? (
            <span>Creative rights <b>{label(offer.creativeControl)}</b></span>
          ) : null}
        </div>
      </div>
    </article>
  );
}

function ContractCostSummary({ draft }: { draft: OfferDraft }): React.JSX.Element {
  const guaranteedPay = draft.weeklyGuarantee * draft.termWeeks;
  const possibleAppearanceFees = draft.family === "EXCLUSIVE" ? 0 : draft.appearanceFee * draft.dateEntitlement;
  const totalPotential = draft.signingBonus + guaranteedPay + possibleAppearanceFees;
  return (
    <div className={styles.contractBox} aria-label="Contract financial exposure">
      <strong>What this offer could cost</strong>
      <div className={styles.moneyRows}>
        <span>One-time bonus if accepted <b>{money(draft.signingBonus)}</b></span>
        <span>Guaranteed pay over {draft.termWeeks} weeks <b>{money(guaranteedPay)}</b></span>
        <span>Appearance fees if all dates used <b>{money(possibleAppearanceFees)}</b></span>
        <span>Potential total contractual outlay <b>{money(totalPotential)}</b></span>
      </div>
      <small>Only the bonus is due on acceptance. Weekly guarantees accrue during the contract;
        appearance fees are paid for appearances actually worked. This is not an acceptance promise or an immediate cash charge.</small>
    </div>
  );
}

function OfferEditor({
  target,
  draft,
  submitting,
  onChange,
  onCancel,
  onSubmit,
  onEdit,
}: {
  target: OfferTarget;
  draft: OfferDraft;
  submitting: boolean;
  onChange: (next: OfferDraft) => void;
  onCancel: () => void;
  onSubmit: () => void;
  onEdit: () => void;
}): React.JSX.Element {
  const terms = draft.family === "ONE_OFF" ? [1] : draft.family === "EXCLUSIVE" ? [13, 26, 52] : [4, 13, 26];
  const guide = negotiationGuide(target, draft);
  // Mirrors the server's minimum market-value guarantee for exclusive work.
  const exclusiveWeeklyFloor = Math.max(1, Math.ceil(target.referenceValue * 0.5));
  const invalidExclusivePay = draft.family === "EXCLUSIVE"
    && (draft.weeklyGuarantee < exclusiveWeeklyFloor || draft.appearanceFee !== 0);
  if (target.renewalMode === "SAME_TERMS") {
    return (
      <section className={styles.editor} aria-label={`Authorise contract renewal for ${target.personName}`}>
        <div className={styles.editorHeader}>
          <div><span className={styles.eyebrow}>RENEWAL PROPOSAL</span><h2>{target.personName}</h2>
            <p>Offer the same ongoing terms for another {draft.termWeeks} PPW weeks.
              The previous one-time signing bonus is not repeated. The wrestler can still refuse.</p></div>
          <button className={styles.button} type="button" onClick={onCancel} disabled={submitting}>Cancel</button>
        </div>
        <div className={styles.editorBody}>
          <div className={styles.contractBox}>
            <strong>{label(draft.family)} · {label(draft.roleExpectation)} · {draft.family === "EXCLUSIVE" ? "Unlimited contracted appearances" : `${draft.dateEntitlement} dates`}</strong>
            <div className={styles.moneyRows}>
              <span>Weekly guarantee <b>{money(draft.weeklyGuarantee)}</b></span>
              <span>Appearance fee <b>{money(draft.appearanceFee)}</b></span>
              <span>Creative rights <b>{label(draft.creativeControl ?? "NONE")}</b></span>
              <span>New signing bonus <b>{money(0)}</b></span>
            </div>
          </div>
          <ContractCostSummary draft={draft} />
          <p className={styles.subtle}>You are authorising an offer, not signing the wrestler. Acceptance, competing commitments and service limits are decided by the normal World resolver.</p>
        </div>
        <div className={styles.editorFooter}>
          <button className={styles.button} type="button" onClick={onEdit} disabled={submitting}>Change terms</button>
          <button className={styles.primaryButton} type="button" disabled={submitting || invalidExclusivePay}
            onClick={onSubmit}>{submitting ? "Submitting…" : "Authorise renewal offer"}</button>
        </div>
      </section>
    );
  }
  return (
    <section className={styles.editor} aria-label={`Contract offer for ${target.personName}`}>
      <div className={styles.editorHeader}>
        <div>
          <span className={styles.eyebrow}>{target.sourceContractId ? "RENEWAL NEGOTIATION" : "CONTRACT OFFER"}</span>
          <h2>{target.personName}</h2>
          <p>
            {target.sourceContractId
              ? target.currentContract?.renewalReason === "DATES_EXHAUSTED"
                ? draft.family === "ONE_OFF"
                  ? "All purchased dates are used. If accepted, the one-off replaces the exhausted deal at resolution and covers your next scheduled show within six PPW weeks."
                  : "All purchased dates are used. If accepted, the old deal is superseded at resolution and the new paid term starts next PPW week."
                : "New terms begin after the current deal expires."
              : draft.family === "ONE_OFF"
                ? "If accepted at the next World Resolution, this one-show appearance covers your next scheduled show within six PPW weeks. Offers without a show in that window cannot be submitted."
                : "Offer enters the normal PPW negotiation queue. If accepted, the paid term begins next PPW week; acceptance is not guaranteed."}
          </p>
        </div>
        <button className={styles.button} type="button" onClick={onCancel} disabled={submitting}>Cancel</button>
      </div>

      <div className={styles.editorBody}>
        <section className={styles.negotiationGuide} aria-label="Negotiation guidance">
          <div className={styles.negotiationGuideHeader}>
            <div>
              <span>NEGOTIATION READ</span>
              <strong>Use this as context, not an acceptance guarantee.</strong>
            </div>
            <b>{money(target.referenceValue)}/wk market value</b>
          </div>
          <div className={styles.negotiationGuideGrid}>
            <div><span>Relationship</span><strong>{guide.relationship}</strong></div>
            <div><span>Role promise</span><strong>{guide.roleRead}</strong></div>
            <div><span>Cash package</span><strong>{guide.cashRead} · {money(guide.effectiveWeekly)}/wk effective</strong></div>
            <div><span>Dates</span><strong>{guide.scheduleRead}</strong></div>
            <div><span>Creative control</span><strong>{
              CREATIVE_CHOICES.find((choice) => choice.value === (draft.creativeControl ?? "NONE"))?.title
              ?? "Standard terms"
            } · negotiated with the cash package, not instead of it</strong></div>
          </div>
          <p>{guide.structure}</p>
          <small>Acceptance can still move with wrestler priorities, promotion standing, competing offers, Service Capacity and normal PPW uncertainty. Rival contract terms remain private.</small>
        </section>
        <ContractCostSummary draft={draft} />
        <div className={styles.formGrid}>
        <label>
          <span>Contract</span>
          <select value={draft.family} onChange={(event) => onChange(draftForFamily(event.target.value as OfferFamily, target.referenceValue, draft, target.sourceContractId !== null))}>
            <option value="ONE_OFF">One-off date</option>
            <option value="LIMITED_NON_EXCLUSIVE">Limited non-exclusive</option>
            <option value="EXCLUSIVE">Exclusive</option>
          </select>
        </label>
        <label>
          <span>Role promised</span>
          <select value={draft.roleExpectation} onChange={(event) => onChange({ ...draft, roleExpectation: event.target.value as OfferRole })}>
            {ROLE_OPTIONS.map((role) => <option key={role} value={role}>{label(role)}</option>)}
          </select>
        </label>
        <label>
          <span>Term</span>
          <select value={draft.termWeeks} onChange={(event) => {
              const termWeeks = Number(event.target.value);
              onChange({ ...draft, termWeeks, dateEntitlement: draft.family === "EXCLUSIVE" ? termWeeks : draft.dateEntitlement });
            }}>
            {terms.map((weeks) => <option key={weeks} value={weeks}>{weeks === 1 ? "1 PPW week" : `${weeks} PPW weeks`}</option>)}
          </select>
        </label>
        {draft.family === "EXCLUSIVE" ? (
          <div className={styles.contractBox}>
            <strong>Unlimited appearances</strong>
            <small>Included for the full exclusive term, subject to health and scheduling. Minimum guaranteed salary {money(exclusiveWeeklyFloor)}/week; appearance fees are not charged separately.</small>
          </div>
        ) : <label>
          <span>Purchased dates</span>
          <IntegerInput
            value={draft.dateEntitlement}
            min={1}
            max={104}
            disabled={draft.family === "ONE_OFF"}
            onChange={(value) => onChange({ ...draft, dateEntitlement: value })}
          />
        </label>}
        <label>
          <span>Weekly guarantee</span>
          <MoneyInput
            value={draft.weeklyGuarantee}
            disabled={draft.family === "ONE_OFF"}
            onChange={(value) => onChange({ ...draft, weeklyGuarantee: value })}
          />
        </label>
        <label>
          <span>Appearance fee</span>
          <MoneyInput
            value={draft.appearanceFee}
            disabled={draft.family === "EXCLUSIVE"}
            onChange={(value) => onChange({ ...draft, appearanceFee: value })}
          />
        </label>
        <label>
          <span>New one-time bonus</span>
          <MoneyInput
            value={draft.signingBonus}
            onChange={(value) => onChange({ ...draft, signingBonus: value })}
          />
        </label>
        </div>
        <fieldset className={styles.creativeSection} disabled={submitting}>
          <legend>Creative control</legend>
          <p className={styles.creativeIntro}>
            Optional contract concession. Stronger rights may help some wrestlers accept a credible offer,
            but cannot compensate for unrealistic pay. Any agreed veto applies to your future bookings.
          </p>
          <div className={styles.creativeGrid}>
            {CREATIVE_CHOICES.map((choice) => {
              const active = (draft.creativeControl ?? "NONE") === choice.value;
              return (
                <button
                  type="button"
                  key={choice.value}
                  aria-pressed={active}
                  className={active ? styles.creativeSelected : styles.creativeChoice}
                  onClick={() => onChange({ ...draft, creativeControl: choice.value })}
                >
                  <span className={styles.creativeChoiceHeading}>
                    <strong>{choice.title}</strong>
                    <span aria-hidden="true">{active ? "✓" : "○"}</span>
                  </span>
                  <span className={styles.creativeDescription}>{choice.explanation}</span>
                  <span className={styles.creativeTradeoff}>{choice.tradeoff}</span>
                </button>
              );
            })}
          </div>
          <p className={styles.creativeWarning}>
            {draft.creativeControl === "FULL_APPROVAL"
              ? "High restriction: this wrestler can decline individual bookings. A Programme agreement can reduce repeat requests, but never overrides its negotiated limits."
              : draft.creativeControl === "PROTECTED_FINISHES"
                ? "Booking restriction: get permission before a clean pin or submission loss. A protected finish or different winner remains your scripted choice."
                : draft.creativeControl === "CONSULTATION"
                  ? "Consultation creates meaningful dialogue about major changes, not a right to veto a match."
                  : "Standard terms preserve normal promoter booking control. Creative rights can be negotiated if this wrestler values autonomy."}
          </p>
        </fieldset>
      </div>

      <div className={styles.editorFooter}>
        <span>{invalidExclusivePay
          ? `Exclusive employment needs at least ${money(exclusiveWeeklyFloor)} guaranteed per week and no separate appearance fee.`
          : "PPW enforces signed creative rights, exclusivity, Service Capacity and wrestler acceptance. These choices do not guarantee a deal."}</span>
        <button className={styles.primaryButton} type="button" disabled={submitting || invalidExclusivePay} onClick={onSubmit}>{submitting ? "Submitting…" : "Submit offer"}</button>
      </div>
    </section>
  );
}

export default function TalentClient({ initialTab = "ROSTER", focusPersonId = "" }: { initialTab?: TalentTab; focusPersonId?: string }): React.JSX.Element {
  const [view, setView] = useState<PlayerTalentManagementView | null>(null);
  const handledFocus = useRef<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [tab, setTab] = useState<TalentTab>(initialTab);
  const [query, setQuery] = useState("");
  const [rosterSort, setRosterSort] = useState<RosterSort>("POPULARITY");
  const [rosterContractFilter, setRosterContractFilter] = useState<RosterContractFilter>("ALL");
  const [rosterDivisionFilter, setRosterDivisionFilter] = useState<RosterDivisionFilter>("ALL");
  const [collapsedRosterRoles, setCollapsedRosterRoles] = useState<Set<RosterGroupKey>>(() => new Set());
  const [marketSort, setMarketSort] = useState<MarketSort>("INTEREST");
  const [marketAvailabilityFilter, setMarketAvailabilityFilter] = useState<MarketAvailabilityFilter>("ALL");
  const [marketDivisionFilter, setMarketDivisionFilter] = useState<MarketDivisionFilter>("ALL");
  const [marketInterestFilter, setMarketInterestFilter] = useState<MarketInterestFilter>("ALL");
  const [marketWatchOnly, setMarketWatchOnly] = useState(false);
  const [marketAdvancedOpen, setMarketAdvancedOpen] = useState(false);
  const [marketMinPopularity, setMarketMinPopularity] = useState(0);
  const [marketMinRecognition, setMarketMinRecognition] = useState(0);
  const [marketMinMomentum, setMarketMinMomentum] = useState(0);
  const [marketMinInRing, setMarketMinInRing] = useState(0);
  const [marketMinCraft, setMarketMinCraft] = useState(0);
  const [marketMinPresentation, setMarketMinPresentation] = useState(0);
  const [marketLimit, setMarketLimit] = useState(25);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [alignmentSaving, setAlignmentSaving] = useState<string | null>(null);
  const [watchSaving, setWatchSaving] = useState<string | null>(null);
  const [target, setTarget] = useState<OfferTarget | null>(null);
  const [draft, setDraft] = useState<OfferDraft | null>(null);
  const [dateAddendum, setDateAddendum] = useState<{ wrestler: PlayerRosterContractView; requestId: string; extraDates: number; payment: number } | null>(null);
  const offerOpen = Boolean((target && draft) || dateAddendum);

  useEffect(() => {
    if (!offerOpen || typeof window === "undefined") return;
    const body = document.body;
    const scrollY = window.scrollY;
    const previous = {
      position: body.style.position,
      top: body.style.top,
      width: body.style.width,
      overflow: body.style.overflow,
    };
    body.style.position = "fixed";
    body.style.top = `-${scrollY}px`;
    body.style.width = "100%";
    body.style.overflow = "hidden";
    return () => {
      body.style.position = previous.position;
      body.style.top = previous.top;
      body.style.width = previous.width;
      body.style.overflow = previous.overflow;
      window.scrollTo(0, scrollY);
    };
  }, [offerOpen]);

  async function refresh(): Promise<void> {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/talent", { cache: "no-store" });
      const payload = await response.json() as PlayerTalentManagementView | ErrorPayload;
      if (!response.ok || isErrorPayload(payload)) {
        throw new Error(isErrorPayload(payload) && payload.error ? payload.error : "Unable to load talent management");
      }
      setView(payload);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to load talent management");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void refresh(); }, []);
  useEffect(() => {
    setTab(initialTab);
    setQuery("");
    setMarketLimit(25);
  }, [initialTab]);

  function openMarketOffer(wrestler: PlayerTalentMarketView): void {
    setDateAddendum(null);
    const next: OfferTarget = {
      requestId: requestIdFor(wrestler.personId),
      personId: wrestler.personId,
      personName: wrestler.name,
      sourceContractId: null,
      referenceValue: wrestler.estimatedWeeklyValue,
      suggestedRoleExpectation: wrestler.suggestedRoleExpectation,
      interest: wrestler.interest,
      trust: null,
      currentContract: null,
      renewalMode: "NEGOTIATE",
    };
    setTarget(next);
    setDraft(defaultDraft(next));
    setError(null);
    setNotice(null);
  }

  function openRenewal(wrestler: PlayerRosterContractView, renewalMode: "SAME_TERMS" | "NEGOTIATE"): void {
    setDateAddendum(null);
    const next: OfferTarget = {
      requestId: requestIdFor(wrestler.personId),
      personId: wrestler.personId,
      personName: wrestler.name,
      sourceContractId: wrestler.contractId,
      referenceValue: wrestler.estimatedWeeklyValue,
      suggestedRoleExpectation: wrestler.suggestedRoleExpectation,
      interest: null,
      trust: wrestler.trust,
      currentContract: wrestler.contract,
      renewalMode,
    };
    setTarget(next);
    setDraft(defaultDraft(next));
    setError(null);
    setNotice(null);
  }

  function openMoreDates(wrestler: PlayerRosterContractView): void {
    if (wrestler.contract.family !== "LIMITED_NON_EXCLUSIVE") return;
    setTarget(null);
    setDraft(null);
    setDateAddendum({
      wrestler,
      requestId: requestIdFor(wrestler.personId),
      extraDates: 3,
      payment: Math.round(wrestler.estimatedWeeklyValue * 2),
    });
    setError(null);
    setNotice(null);
  }

  useEffect(() => {
    if (tab !== "CONTRACTS" || !view?.promotion || !focusPersonId || handledFocus.current === focusPersonId) return;
    handledFocus.current = focusPersonId;
    const pending = view.pendingOffers.find((offer) => offer.personId === focusPersonId);
    if (pending) {
      const card = document.getElementById(`pending-contract-${pending.offerId}`);
      card?.scrollIntoView({ block: "center" });
      card?.focus({ preventScroll: true });
      return;
    }
    const wrestler = view.roster.find((entry) => entry.personId === focusPersonId);
    if (!wrestler) return;
    if (wrestler.contract.renewalReason === "DATES_EXHAUSTED") openMoreDates(wrestler);
    else if (wrestler.contract.renewalWindowOpen) openRenewal(wrestler, "NEGOTIATE");
  }, [tab, view, focusPersonId]);

  async function submitMoreDates(): Promise<void> {
    if (!dateAddendum || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const body: AlphaDatesAddendumRequest = {
        requestId: dateAddendum.requestId,
        personId: dateAddendum.wrestler.personId,
        contractId: dateAddendum.wrestler.contractId,
        additionalDates: dateAddendum.extraDates,
        additionalPayment: dateAddendum.payment,
      };
      const response = await fetch("/api/talent/dates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const payload = await response.json() as AlphaDatesAddendumResult | ErrorPayload;
      if (!response.ok || isErrorPayload(payload)) {
        throw new Error(isErrorPayload(payload) && payload.error ? payload.error : "Unable to negotiate additional dates");
      }
      setView(payload.view);
      setNotice(`${dateAddendum.wrestler.name}: additional-dates offer submitted. The wrestler can accept or reject it.`);
      setDateAddendum(null);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to negotiate additional dates");
    } finally {
      setSubmitting(false);
    }
  }

  async function changeAlignment(wrestler: PlayerRosterContractView, alignment: Alignment): Promise<void> {
    if (alignment === wrestler.alignment || alignmentSaving) return;
    setAlignmentSaving(wrestler.personId);
    setError(null);
    setNotice(null);
    try {
      const suffix = typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const response = await fetch("/api/talent", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requestId: `talent-alignment:${wrestler.personId}:${suffix}`,
          personId: wrestler.personId,
          alignment,
        }),
      });
      const payload = await response.json() as AlphaRosterAlignmentResult | ErrorPayload;
      if (!response.ok || isErrorPayload(payload)) {
        throw new Error(isErrorPayload(payload) && payload.error ? payload.error : "Unable to update wrestler alignment");
      }
      setView(payload.view);
      setNotice(
        payload.naturalReset
          ? `${wrestler.name} is now presented as ${label(payload.alignment).toLowerCase()} in your promotion.`
          : `${wrestler.name} was switched to ${label(payload.alignment).toLowerCase()} off-screen. The crowd may question the unexplained change.`,
      );
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to update wrestler alignment");
    } finally {
      setAlignmentSaving(null);
    }
  }

  async function changeWatch(wrestler: PlayerTalentMarketView): Promise<void> {
    if (watchSaving) return;
    setWatchSaving(wrestler.personId);
    setError(null);
    try {
      const response = await fetch("/api/talent", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          personId: wrestler.personId,
          watched: !wrestler.watched,
        }),
      });
      const payload = await response.json() as AlphaTalentWatchResult | ErrorPayload;
      if (!response.ok || isErrorPayload(payload)) {
        throw new Error(isErrorPayload(payload) && payload.error ? payload.error : "Unable to update Watchlist");
      }
      setView(payload.view);
      setNotice(`${wrestler.name} ${payload.watched ? "added to" : "removed from"} Watchlist.`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to update Watchlist");
    } finally {
      setWatchSaving(null);
    }
  }

  async function submitOffer(): Promise<void> {
    if (!target || !draft) return;
    setSubmitting(true);
    setError(null);
    setNotice(null);
    try {
      const body: AlphaTalentOfferRequest = {
        requestId: target.requestId,
        personId: target.personId,
        sourceContractId: target.sourceContractId,
        ...draft,
      };
      const response = await fetch("/api/talent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const payload = await response.json() as AlphaTalentOfferResult | ErrorPayload;
      if (!response.ok || isErrorPayload(payload)) {
        throw new Error(isErrorPayload(payload) && payload.error ? payload.error : "Unable to submit contract offer");
      }
      setView(payload.view);
      setNotice(`${target.personName}: ${payload.offerKind === "RENEWAL" ? "renewal" : "recruitment"} offer submitted.`);
      setTarget(null);
      setDraft(null);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to submit contract offer");
    } finally {
      setSubmitting(false);
    }
  }

  const roster = useMemo(() => {
    const entries = (view?.roster ?? [])
      .filter((entry) => matchesQuery(entry.name, query))
      .filter((entry) => rosterDivisionFilter === "ALL" || entry.division === rosterDivisionFilter)
      .filter((entry) => rosterContractFilter === "ALL" || entry.contract.exclusivity === rosterContractFilter);
    return [...entries].sort((left, right) => {
      if (rosterSort === "RECOGNITION") return right.recognition - left.recognition || left.name.localeCompare(right.name);
      if (rosterSort === "DATES_ASC") return (left.contract.unlimitedAppearances ? Number.MAX_SAFE_INTEGER : left.contract.datesRemaining) - (right.contract.unlimitedAppearances ? Number.MAX_SAFE_INTEGER : right.contract.datesRemaining) || left.name.localeCompare(right.name);
      if (rosterSort === "DATES_DESC") return (right.contract.unlimitedAppearances ? Number.MAX_SAFE_INTEGER : right.contract.datesRemaining) - (left.contract.unlimitedAppearances ? Number.MAX_SAFE_INTEGER : left.contract.datesRemaining) || left.name.localeCompare(right.name);
      if (rosterSort === "EXPIRY") return left.contract.weeksToExpiry - right.contract.weeksToExpiry || left.name.localeCompare(right.name);
      if (rosterSort === "WAGE_HIGH") return right.contract.weeklyGuarantee - left.contract.weeklyGuarantee || left.name.localeCompare(right.name);
      if (rosterSort === "WAGE_LOW") return left.contract.weeklyGuarantee - right.contract.weeklyGuarantee || left.name.localeCompare(right.name);
      if (rosterSort === "FEE_HIGH") return right.contract.appearanceFee - left.contract.appearanceFee || left.name.localeCompare(right.name);
      if (rosterSort === "FEE_LOW") return left.contract.appearanceFee - right.contract.appearanceFee || left.name.localeCompare(right.name);
      if (rosterSort === "NAME") return left.name.localeCompare(right.name);
      return right.popularity - left.popularity || right.recognition - left.recognition || left.name.localeCompare(right.name);
    });
  }, [view, query, rosterContractFilter, rosterDivisionFilter, rosterSort]);
  const rosterGroups = useMemo(() => {
    // Compare pay globally rather than hiding high earners under card roles.
    if (rosterSort.startsWith("WAGE_") || rosterSort.startsWith("FEE_")) {
      return [{ role: "ALL_ROLES" as const, entries: roster }];
    }
    return ROSTER_ROLE_ORDER
      .map((role) => ({
        role,
        entries: roster.filter((entry) => entry.contract.roleExpectation === role),
      }))
      .filter((group) => group.entries.length > 0);
  }, [roster, rosterSort]);
  const market = useMemo(() => {
    const entries = (view?.market ?? [])
      .filter((entry) => matchesQuery(entry.name, query))
      .filter((entry) => marketDivisionFilter === "ALL" || entry.division === marketDivisionFilter)
      .filter((entry) => marketAvailabilityFilter === "ALL" || entry.availability === marketAvailabilityFilter)
      .filter((entry) => !marketWatchOnly || entry.watched)
      .filter((entry) => entry.popularity >= marketMinPopularity)
      .filter((entry) => entry.recognition >= marketMinRecognition)
      .filter((entry) => entry.momentum >= marketMinMomentum)
      .filter((entry) => entry.skills.inRingQuality >= marketMinInRing)
      .filter((entry) => entry.skills.matchCraft >= marketMinCraft)
      .filter((entry) => entry.skills.presentation >= marketMinPresentation)
      .filter((entry) => {
        if (marketInterestFilter === "INTERESTED_PLUS") return INTEREST_RANK[entry.interest] >= INTEREST_RANK.INTERESTED;
        if (marketInterestFilter === "OPEN_PLUS") return INTEREST_RANK[entry.interest] >= INTEREST_RANK.OPEN_TO_TALKS;
        return true;
      });
    return [...entries].sort((left, right) => {
      if (marketSort === "INTEREST") return INTEREST_RANK[right.interest] - INTEREST_RANK[left.interest] || right.popularity - left.popularity || left.name.localeCompare(right.name);
      if (marketSort === "POPULARITY") return right.popularity - left.popularity || left.name.localeCompare(right.name);
      if (marketSort === "RECOGNITION") return right.recognition - left.recognition || left.name.localeCompare(right.name);
      if (marketSort === "VALUE_LOW") return left.estimatedWeeklyValue - right.estimatedWeeklyValue || left.name.localeCompare(right.name);
      if (marketSort === "NAME") return left.name.localeCompare(right.name);
      return right.estimatedWeeklyValue - left.estimatedWeeklyValue || right.popularity - left.popularity || left.name.localeCompare(right.name);
    });
  }, [
    view,
    query,
    marketAvailabilityFilter,
    marketDivisionFilter,
    marketInterestFilter,
    marketWatchOnly,
    marketMinPopularity,
    marketMinRecognition,
    marketMinMomentum,
    marketMinInRing,
    marketMinCraft,
    marketMinPresentation,
    marketSort,
  ]);
  const visibleMarket = useMemo(() => market.slice(0, marketLimit), [market, marketLimit]);
  const offers = useMemo(
    () => (view?.pendingOffers ?? []).filter((entry) => matchesQuery(entry.personName, query)),
    [view, query],
  );
  const pendingPeople = useMemo(() => new Set((view?.pendingOffers ?? []).map((offer) => offer.personId)), [view]);
  const contractDeskActionable = useMemo(() => (view?.roster ?? [])
    .filter((entry) => entry.contract.renewalWindowOpen && !pendingPeople.has(entry.personId))
    .filter((entry) => matchesQuery(entry.name, query))
    .sort((left, right) => (
      Number(right.contract.renewalReason === "DATES_EXHAUSTED") - Number(left.contract.renewalReason === "DATES_EXHAUSTED")
      || left.contract.weeksToExpiry - right.contract.weeksToExpiry
      || left.name.localeCompare(right.name)
    )), [view, pendingPeople, query]);
  const contractDeskPending = useMemo(() => (view?.pendingOffers ?? [])
    .filter((offer) => matchesQuery(offer.personName, query)), [view, query]);
  const focusedPendingOffer = view?.pendingOffers.find((offer) => offer.personId === focusPersonId) ?? null;

  useEffect(() => {
    setMarketLimit(25);
  }, [
    query,
    marketAvailabilityFilter,
    marketDivisionFilter,
    marketInterestFilter,
    marketWatchOnly,
    marketMinPopularity,
    marketMinRecognition,
    marketMinMomentum,
    marketMinInRing,
    marketMinCraft,
    marketMinPresentation,
    marketSort,
  ]);

  function toggleRosterRole(role: RosterGroupKey): void {
    setCollapsedRosterRoles((current) => {
      const next = new Set(current);
      if (next.has(role)) next.delete(role);
      else next.add(role);
      return next;
    });
  }

  const marketAdvancedCount = [
    marketMinPopularity,
    marketMinRecognition,
    marketMinMomentum,
    marketMinInRing,
    marketMinCraft,
    marketMinPresentation,
  ].filter((value) => value > 0).length;

  function resetMarketAdvanced(): void {
    setMarketMinPopularity(0);
    setMarketMinRecognition(0);
    setMarketMinMomentum(0);
    setMarketMinInRing(0);
    setMarketMinCraft(0);
    setMarketMinPresentation(0);
  }

  const rosterMen = view?.roster.filter((entry) => entry.division === "MEN").length ?? 0;
  const rosterWomen = view?.roster.filter((entry) => entry.division === "WOMEN").length ?? 0;
  const watchedMarket = view?.market.filter((entry) => entry.watched).length ?? 0;
  const recruitmentOffers = view?.pendingOffers.filter((offer) => offer.offerKind === "RECRUITMENT").length ?? 0;
  const renewalOffers = view?.pendingOffers.filter((offer) => offer.offerKind === "RENEWAL").length ?? 0;
  const pageEyebrow = tab === "ROSTER" ? "YOUR ROSTER" : tab === "MARKET" ? "TALENT MARKET" : tab === "CONTRACTS" ? "TALENT CONTRACTS" : "CONTRACT OFFERS";
  const pageTitle = tab === "ROSTER"
    ? view?.promotion?.name ?? "Your roster"
    : tab === "MARKET"
      ? "Find talent"
      : tab === "CONTRACTS"
        ? "Contracts"
        : "Pending offers";
  const pageDescription = tab === "ROSTER"
    ? "Your contracted wrestlers and roster structure."
    : tab === "MARKET"
      ? "Search wrestlers currently available to approach."
      : tab === "CONTRACTS"
        ? "Renewal decisions, purchased dates and pending offers in one place."
        : "Recruitment and renewal offers awaiting resolution.";

  return (
    <main className={styles.shell}>
      <header className={styles.header}>
        <div>
          <span className={styles.eyebrow}>{pageEyebrow}</span>
          <h1>{pageTitle}</h1>
          <p>{view ? `${view.world.name} · ${ppwDate(view.world.currentDate)} · ${pageDescription}` : "Loading your World…"}</p>
        </div>
        <button className={styles.button} disabled={loading || submitting} onClick={() => void refresh()}>{loading ? "Loading…" : "Refresh"}</button>
      </header>

      {view?.promotion && tab === "ROSTER" ? (
        <div className={styles.contractNavLinks}>
          <a className={styles.backLink} href="/talent/contracts">Manage contracts &amp; pending offers →</a>
          <a className={styles.backLink} href="/staff">Talent Manager · Staff &amp; renewals →</a>
        </div>
      ) : null}
      {view?.promotion && tab === "CONTRACTS" ? <a className={styles.backLink} href="/talent">← Back to roster</a> : null}
      {error ? <div className={styles.error}>{error}</div> : null}
      {notice ? <div className={styles.notice}>{notice}</div> : null}
      {view && !view.promotion ? <section className={styles.panel}><p>Take control of a promotion before managing talent.</p></section> : null}

      {dateAddendum ? (
        <section className={styles.editor} aria-label={`Additional dates for ${dateAddendum.wrestler.name}`}>
          <div className={styles.editorHeader}>
            <div>
              <span className={styles.eyebrow}>ADD DATES · SAME CONTRACT</span>
              <h2>{dateAddendum.wrestler.name}</h2>
              <p>{dateAddendum.wrestler.contract.datesRemaining} dates left · expires {ppwDate(dateAddendum.wrestler.contract.endDate)} · weekly wage unchanged.</p>
            </div>
            <button className={styles.button} type="button" disabled={submitting} onClick={() => setDateAddendum(null)}>Cancel</button>
          </div>
          <div className={styles.formGrid}>
            <label>
              <span>Additional appearances</span>
              <IntegerInput value={dateAddendum.extraDates} min={1} max={104} disabled={submitting}
                onChange={(extraDates) => setDateAddendum(current => current ? { ...current, extraDates } : null)} />
            </label>
            <label>
              <span>One-time extra payment</span>
              <MoneyInput value={dateAddendum.payment} disabled={submitting}
                onChange={(payment) => setDateAddendum(current => current ? { ...current, payment } : null)} />
            </label>
          </div>
          <div className={styles.editorFooter}>
            <span>Wrestler acceptance is not guaranteed. Expiry, exclusivity, regular wage and appearance fee stay unchanged.</span>
            <button className={styles.primaryButton} type="button" disabled={submitting}
              onClick={() => void submitMoreDates()}>{submitting ? "Submitting…" : "Offer more dates"}</button>
          </div>
        </section>
      ) : null}
      {target && draft ? (
        <OfferEditor
          target={target}
          draft={draft}
          submitting={submitting}
          onChange={setDraft}
          onCancel={() => { setTarget(null); setDraft(null); }}
          onSubmit={() => void submitOffer()}
          onEdit={() => setTarget(current => current ? { ...current, renewalMode: "NEGOTIATE" } : null)}
        />
      ) : null}

      {view?.promotion ? (
        <>
          {tab === "ROSTER" ? (
            <>
              <section className={styles.overview}>
                <div><span>Roster contracts</span><strong>{view.roster.length}</strong></div>
                <div><span>Men</span><strong>{rosterMen}</strong></div>
                <div><span>Women</span><strong>{rosterWomen}</strong></div>
              </section>
              <RosterNav active="SINGLES" />
            </>
          ) : tab === "CONTRACTS" ? (
            <section className={styles.overview}>
              <div><span>Decisions needed</span><strong>{contractDeskActionable.length}</strong></div>
              <div><span>Offers pending</span><strong>{view.pendingOffers.length}</strong></div>
              <div><span>Roster contracts</span><strong>{view.roster.length}</strong></div>
            </section>
          ) : tab === "MARKET" ? (
            <section className={styles.overview}>
              <div><span>Available talent</span><strong>{view.market.length}</strong></div>
              <div><span>Watching</span><strong>{watchedMarket}</strong></div>
              <div><span>Pending offers</span><strong>{view.pendingOffers.length}</strong></div>
            </section>
          ) : (
            <section className={styles.overview}>
              <div><span>Pending offers</span><strong>{view.pendingOffers.length}</strong></div>
              <div><span>Recruitment</span><strong>{recruitmentOffers}</strong></div>
              <div><span>Renewals</span><strong>{renewalOffers}</strong></div>
            </section>
          )}

          {tab === "ROSTER" ? (
            <section className={styles.rosterToolbar} aria-label="Roster search and filters">
              <label className={styles.rosterSearch}>
                <span>Search roster</span>
                <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Find wrestler…" />
              </label>
              <div className={styles.divisionToggle} role="group" aria-label="Roster division">
                {(["ALL", "MEN", "WOMEN"] as const).map((division) => (
                  <button
                    key={division}
                    type="button"
                    className={rosterDivisionFilter === division ? styles.divisionButtonActive : styles.divisionButton}
                    onClick={() => setRosterDivisionFilter(division)}
                  >
                    {division === "ALL" ? "All" : division === "MEN" ? "Men" : "Women"}
                  </button>
                ))}
              </div>
              <div className={styles.rosterSelects}>
                <label>
                  <span>Sort</span>
                  <select value={rosterSort} onChange={(event) => setRosterSort(event.target.value as RosterSort)}>
                    <option value="POPULARITY">Popularity</option>
                    <option value="RECOGNITION">Recognition</option>
                    <option value="DATES_ASC">Dates low</option>
                    <option value="DATES_DESC">Dates high</option>
                    <option value="EXPIRY">Expiry</option>
                    <option value="WAGE_HIGH">Weekly wage: highest</option>
                    <option value="WAGE_LOW">Weekly wage: lowest</option>
                    <option value="FEE_HIGH">Appearance fee: highest</option>
                    <option value="FEE_LOW">Appearance fee: lowest</option>
                    <option value="NAME">Name</option>
                  </select>
                </label>
                <label>
                  <span>Deal</span>
                  <select value={rosterContractFilter} onChange={(event) => setRosterContractFilter(event.target.value as RosterContractFilter)}>
                    <option value="ALL">All deals</option>
                    <option value="EXCLUSIVE">Exclusive</option>
                    <option value="NON_EXCLUSIVE">Non-exclusive</option>
                  </select>
                </label>
              </div>
            </section>
          ) : tab === "CONTRACTS" ? (
            <label className={styles.search}>
              <span>Find a contract or offer</span>
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search wrestlers…" />
            </label>
          ) : tab === "OFFERS" ? (
            <label className={styles.search}>
              <span>Search pending offers</span>
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Wrestler name" />
            </label>
          ) : null}

          {tab === "MARKET" ? (
            <section className={styles.marketToolbar} aria-label="Talent market search and filters">
              <label className={styles.marketSearch}>
                <span>Search market</span>
                <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Find wrestler…" />
              </label>
              <div className={styles.marketQuickFilters}>
                <div className={styles.divisionToggle} role="group" aria-label="Talent market division">
                  {(["ALL", "MEN", "WOMEN"] as const).map((division) => (
                    <button
                      key={division}
                      type="button"
                      className={marketDivisionFilter === division ? styles.divisionButtonActive : styles.divisionButton}
                      onClick={() => setMarketDivisionFilter(division)}
                    >
                      {division === "ALL" ? "All" : division === "MEN" ? "Men" : "Women"}
                    </button>
                  ))}
                </div>
                <button
                  className={marketWatchOnly ? styles.watchFilterActive : styles.watchFilter}
                  type="button"
                  aria-pressed={marketWatchOnly}
                  onClick={() => setMarketWatchOnly((current) => !current)}
                >
                  ★ Watchlist
                </button>
                <button
                  className={marketAdvancedOpen || marketAdvancedCount > 0 ? styles.advancedFilterActive : styles.advancedFilter}
                  type="button"
                  aria-expanded={marketAdvancedOpen}
                  onClick={() => setMarketAdvancedOpen((current) => !current)}
                >
                  Advanced{marketAdvancedCount > 0 ? ` · ${marketAdvancedCount}` : ""}
                </button>
              </div>
              <div className={styles.marketSelects}>
                <label>
                  <span>Availability</span>
                  <select value={marketAvailabilityFilter} onChange={(event) => setMarketAvailabilityFilter(event.target.value as MarketAvailabilityFilter)}>
                    <option value="ALL">All available</option>
                    <option value="FREE_AGENT">Free agents</option>
                    <option value="NON_EXCLUSIVE">Non-exclusive</option>
                  </select>
                </label>
                <label>
                  <span>Interest</span>
                  <select value={marketInterestFilter} onChange={(event) => setMarketInterestFilter(event.target.value as MarketInterestFilter)}>
                    <option value="ALL">Any interest</option>
                    <option value="OPEN_PLUS">Open to talks+</option>
                    <option value="INTERESTED_PLUS">Interested+</option>
                  </select>
                </label>
                <label>
                  <span>Sort</span>
                  <select value={marketSort} onChange={(event) => setMarketSort(event.target.value as MarketSort)}>
                    <option value="INTEREST">Interest</option>
                    <option value="VALUE_HIGH">Value high</option>
                    <option value="VALUE_LOW">Value low</option>
                    <option value="POPULARITY">Popularity</option>
                    <option value="RECOGNITION">Recognition</option>
                    <option value="NAME">Name</option>
                  </select>
                </label>
              </div>
              {marketAdvancedOpen ? (
                <section className={styles.marketAdvanced} aria-label="Advanced talent market filters">
                  <div className={styles.marketAdvancedHeading}>
                    <div>
                      <strong>Minimum attributes</strong>
                      <span>Combine thresholds, then use Value low to find the cheapest wrestler who clears them.</span>
                    </div>
                    <button type="button" onClick={resetMarketAdvanced} disabled={marketAdvancedCount === 0}>Reset</button>
                  </div>
                  <div className={styles.marketAdvancedGrid}>
                    {([
                      ["Popularity", marketMinPopularity, setMarketMinPopularity],
                      ["Recognition", marketMinRecognition, setMarketMinRecognition],
                      ["Momentum", marketMinMomentum, setMarketMinMomentum],
                      ["In-ring", marketMinInRing, setMarketMinInRing],
                      ["Craft", marketMinCraft, setMarketMinCraft],
                      ["Presentation", marketMinPresentation, setMarketMinPresentation],
                    ] as const).map(([name, value, setter]) => (
                      <label key={name}>
                        <span>{name}</span>
                        <select value={value} onChange={(event) => setter(Number(event.target.value))}>
                          {MARKET_MIN_OPTIONS.map((minimum) => (
                            <option key={minimum} value={minimum}>{minimum === 0 ? "Any" : `${minimum}+`}</option>
                          ))}
                        </select>
                      </label>
                    ))}
                  </div>
                </section>
              ) : null}
              <div className={styles.marketCount}>
                Showing <b>{Math.min(marketLimit, market.length)}</b> of <b>{market.length}</b> matching wrestlers
              </div>
            </section>
          ) : null}

          <section className={styles.list}>
            {tab === "ROSTER" ? (
              <div className={styles.rosterGroups}>
                {rosterGroups.map((group) => {
                  const collapsed = query.trim().length === 0 && collapsedRosterRoles.has(group.role);
                  return (
                    <section className={styles.rosterGroup} key={group.role}>
                      <button
                        className={styles.rosterGroupHeader}
                        type="button"
                        aria-expanded={!collapsed}
                        onClick={() => toggleRosterRole(group.role)}
                      >
                        <span className={styles.rosterGroupTitle}>{group.role === "ALL_ROLES" ? "All roster · pay comparison" : label(group.role)}</span>
                        <span className={styles.rosterGroupMeta}>{group.entries.length} {group.entries.length === 1 ? "wrestler" : "wrestlers"} · {collapsed ? "Show" : "Hide"}</span>
                      </button>
                      {!collapsed ? (
                        <div className={styles.rosterGroupList}>
                          {group.entries.map((entry) => (
                            <RosterCard
                              key={entry.contractId}
                              wrestler={entry}
                              rosterSort={rosterSort}
                              pending={pendingPeople.has(entry.personId)}
                              alignmentSaving={alignmentSaving === entry.personId}
                              onAlignment={(alignment) => void changeAlignment(entry, alignment)}
                              onRenew={(mode) => openRenewal(entry, mode)}
                              onAddDates={() => openMoreDates(entry)}
                            />
                          ))}
                        </div>
                      ) : null}
                    </section>
                  );
                })}
              </div>
            ) : null}
            {tab === "MARKET" ? (
              <>
                <div className={styles.marketList}>
                  {visibleMarket.map((entry) => (
                    <MarketCard
                      key={entry.personId}
                      wrestler={entry}
                      watchSaving={watchSaving === entry.personId}
                      onWatch={() => void changeWatch(entry)}
                      onOffer={() => openMarketOffer(entry)}
                    />
                  ))}
                </div>
                {visibleMarket.length < market.length ? (
                  <button
                    className={styles.loadMore}
                    type="button"
                    onClick={() => setMarketLimit((current) => current + 25)}
                  >
                    Load 25 more · {market.length - visibleMarket.length} remaining
                  </button>
                ) : null}
              </>
            ) : null}

            {tab === "CONTRACTS" ? (
              <div className={styles.contractDesk}>
                {focusedPendingOffer ? (
                  <a className={styles.pendingFocusLink}
                    href={`#pending-contract-${focusedPendingOffer.offerId}`}>
                    <strong>{focusedPendingOffer.personName}: offer awaiting a response</strong>
                    <span>Submitted {ppwDate(focusedPendingOffer.submittedDate)}. View the existing proposal below; there is no need to send another.</span>
                  </a>
                ) : null}
                <section aria-label="Contract decisions needed">
                  <h2>Needs a decision · {contractDeskActionable.length}</h2>
                  <p className={styles.subtle}>Deal with each wrestler here. You stay on this page after sending an offer; their response is decided by the World.</p>
                  {contractDeskActionable.map((entry) => {
                    const contract = entry.contract;
                    return (
                      <article className={styles.contractDeskCard} key={entry.contractId}>
                        <div className={styles.contractDeskHeader}>
                          <div>
                            <strong>{entry.name}</strong>
                            <span>{label(contract.family)} · {contract.unlimitedAppearances ? "Unlimited dates" : contract.datesRemaining + " dates remaining"} · expires {ppwDate(contract.endDate)}</span>
                          </div>
                          <span className={styles.pending}>{contract.renewalReason === "DATES_EXHAUSTED" ? "Dates exhausted" : contract.weeksToExpiry <= 1 ? "Urgent renewal" : "Renewal open"}</span>
                        </div>
                        <div className={styles.contractDeskActions}>
                          <a className={styles.actionButton} href={"/talent/profile?personId=" + encodeURIComponent(entry.personId) + "&from=contracts"}>Wrestler profile</a>
                          {contract.renewalReason === "DATES_EXHAUSTED" ? (
                            <button className={styles.primaryButton} type="button" onClick={() => openMoreDates(entry)}>Negotiate more dates</button>
                          ) : (
                            <>
                              {contract.sameTermsRenewal
                                && (contract.family !== "EXCLUSIVE" || contract.weeklyGuarantee >= Math.ceil(entry.estimatedWeeklyValue * 0.5)) ? (
                                <button className={styles.actionButton} type="button" onClick={() => openRenewal(entry, "SAME_TERMS")}>Renew same terms</button>
                              ) : null}
                              <button className={styles.primaryButton} type="button" onClick={() => openRenewal(entry, "NEGOTIATE")}>Negotiate renewal</button>
                            </>
                          )}
                        </div>
                      </article>
                    );
                  })}
                  {contractDeskActionable.length === 0 ? <p className={styles.empty}>No outstanding contract decisions match your search.</p> : null}
                </section>
                <section aria-label="Pending contract offers">
                  <h2>Waiting for response · {contractDeskPending.length}</h2>
                  <p className={styles.subtle}>Pending recruitment, renewals and additional-dates proposals. Responses resolve through the usual World contract rules.</p>
                  {contractDeskPending.map((offer) => <OfferCard key={offer.offerId} offer={offer} focused={offer.personId === focusPersonId} />)}
                  {contractDeskPending.length === 0 ? <p className={styles.empty}>No pending offers match your search.</p> : null}
                </section>
              </div>
            ) : null}
            {tab === "OFFERS" ? offers.map((entry) => <OfferCard key={entry.offerId} offer={entry} />) : null}
            {(tab === "ROSTER" && roster.length === 0) || (tab === "MARKET" && market.length === 0) || (tab === "OFFERS" && offers.length === 0) ? (
              <div className={styles.empty}>Nothing matches this view right now.</div>
            ) : null}
          </section>

          {tab === "MARKET" ? <p className={styles.footerNote}>Exclusive wrestlers are unavailable to recruit and are not listed here. Market values are PPW estimates; rival salary, bonus, role and pending-offer details remain private. Submitted offers resolve through the same World contract system used by AI promotions.</p> : null}
        </>
      ) : null}
    </main>
  );
}
