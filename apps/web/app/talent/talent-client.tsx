"use client";

import { useEffect, useMemo, useState } from "react";
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
  AlphaTalentWatchResult,
} from "../../../../dist/packages/web-adapter/src/talent-service.js";
import styles from "./talent.module.css";

type ErrorPayload = { error?: string };
export type TalentTab = "ROSTER" | "MARKET" | "OFFERS";
type OfferFamily = AlphaTalentOfferRequest["family"];
type OfferRole = AlphaTalentOfferRequest["roleExpectation"];
type RosterSort = "POPULARITY" | "RECOGNITION" | "DATES_ASC" | "DATES_DESC" | "EXPIRY" | "NAME";
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
  currentContract: PlayerRosterContractView["contract"] | null;
};

type OfferDraft = Omit<AlphaTalentOfferRequest, "requestId" | "personId" | "sourceContractId">;

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

const ROSTER_ROLE_ORDER: OfferRole[] = [
  "MAIN_EVENT",
  "SPECIAL_ATTRACTION",
  "UPPER_CARD",
  "FEATURED",
  "REGULAR",
  "DEVELOPMENTAL",
];

function isErrorPayload(payload: PlayerTalentManagementView | AlphaTalentOfferResult | AlphaRosterAlignmentResult | AlphaTalentWatchResult | ErrorPayload): payload is ErrorPayload {
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
    const family = contract.family;
    return {
      family,
      roleExpectation: contract.roleExpectation,
      termWeeks: family === "EXCLUSIVE" ? 26 : family === "ONE_OFF" ? 1 : 13,
      dateEntitlement: family === "ONE_OFF" ? 1 : Math.max(1, contract.dateEntitlement),
      weeklyGuarantee: family === "ONE_OFF" ? 0 : contract.weeklyGuarantee,
      appearanceFee: contract.appearanceFee,
      signingBonus: contract.signingBonus,
    };
  }

  const value = Math.max(1_000, Math.round(target.referenceValue));
  return {
    family: "LIMITED_NON_EXCLUSIVE",
    roleExpectation: "REGULAR",
    termWeeks: 13,
    dateEntitlement: 5,
    weeklyGuarantee: Math.round(value * 0.2),
    appearanceFee: value,
    signingBonus: value,
  };
}

function draftForFamily(family: OfferFamily, referenceValue: number, current: OfferDraft): OfferDraft {
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
      dateEntitlement: 14,
      weeklyGuarantee: Math.max(current.weeklyGuarantee, value),
      appearanceFee: 0,
      signingBonus: Math.max(current.signingBonus, value * 4),
    };
  }
  return {
    ...current,
    family,
    termWeeks: 13,
    dateEntitlement: 5,
    weeklyGuarantee: Math.max(0, Math.round(value * 0.2)),
    appearanceFee: Math.max(current.appearanceFee, value),
    signingBonus: Math.max(current.signingBonus, value),
  };
}

function InjuryBadge({ injury }: { injury: { severity: string; weeksRemaining: number } | null }): React.JSX.Element | null {
  if (!injury) return null;
  return <span className={styles.injury}>{label(injury.severity)} · {injury.weeksRemaining}w</span>;
}

function RosterCard({
  wrestler,
  pending,
  alignmentSaving,
  onAlignment,
  onRenew,
}: {
  wrestler: PlayerRosterContractView;
  pending: boolean;
  alignmentSaving: boolean;
  onAlignment: (alignment: Alignment) => void;
  onRenew: () => void;
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
          </div>
          <span>{label(wrestler.careerStage)} · {label(contract.family)} · {contract.exclusivity === "EXCLUSIVE" ? "Exclusive" : "Non-exclusive"}</span>
        </div>
        <div className={styles.scoreBlock}>
          <b>POP {Math.round(wrestler.popularity)}</b>
          <small>{contract.datesRemaining}/{contract.dateEntitlement} dates</small>
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
          <p className={styles.subtle}>Age {wrestler.biologicalAge.toFixed(1)} · Fatigue {Math.round(wrestler.fatigue)} · Wear {Math.round(wrestler.wear)} · Skill {averageSkill(wrestler)}</p>
          {pending ? <span className={styles.pending}>Your offer pending</span> : contract.renewalWindowOpen ? (
            <button className={styles.actionButton} type="button" onClick={onRenew}>
              {contract.renewalReason === "DATES_EXHAUSTED" ? "Renegotiate dates" : "Negotiate renewal"}
            </button>
          ) : null}
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

function OfferCard({ offer }: { offer: PlayerPendingContractOfferView }): React.JSX.Element {
  return (
    <article className={styles.card}>
      <div className={styles.marketTop}>
        <div>
          <strong>{offer.personName}</strong>
          <span>{label(offer.offerKind)} · submitted {ppwDate(offer.submittedDate)}</span>
        </div>
        <span className={styles.pending}>Pending</span>
      </div>
      <div className={styles.contractBox}>
        <div>
          <span>{label(offer.family)} · {label(offer.exclusivity)}</span>
          <strong>{label(offer.roleExpectation)} · {offer.dateEntitlement} dates · to {ppwDate(offer.endDate)}</strong>
        </div>
        <div className={styles.moneyRows}>
          <span>Weekly <b>{money(offer.weeklyGuarantee)}</b></span>
          <span>Appearance <b>{money(offer.appearanceFee)}</b></span>
          <span>Signing <b>{money(offer.signingBonus)}</b></span>
        </div>
      </div>
    </article>
  );
}

function OfferEditor({
  target,
  draft,
  submitting,
  onChange,
  onCancel,
  onSubmit,
}: {
  target: OfferTarget;
  draft: OfferDraft;
  submitting: boolean;
  onChange: (next: OfferDraft) => void;
  onCancel: () => void;
  onSubmit: () => void;
}): React.JSX.Element {
  const terms = draft.family === "ONE_OFF" ? [1] : draft.family === "EXCLUSIVE" ? [13, 26, 52] : [4, 13, 26];
  return (
    <section className={styles.editor} aria-label={`Contract offer for ${target.personName}`}>
      <div className={styles.editorHeader}>
        <div>
          <span className={styles.eyebrow}>{target.sourceContractId ? "RENEWAL NEGOTIATION" : "CONTRACT OFFER"}</span>
          <h2>{target.personName}</h2>
          <p>
            {target.sourceContractId
              ? target.currentContract?.renewalReason === "DATES_EXHAUSTED"
                ? "All purchased dates are used. If accepted, these terms replace the exhausted deal immediately."
                : "New terms begin after the current deal expires."
              : "Offer enters the normal PPW negotiation queue; acceptance is not guaranteed."}
          </p>
        </div>
        <button className={styles.button} type="button" onClick={onCancel} disabled={submitting}>Cancel</button>
      </div>

      <div className={styles.editorBody}>
        <div className={styles.formGrid}>
        <label>
          <span>Contract</span>
          <select value={draft.family} onChange={(event) => onChange(draftForFamily(event.target.value as OfferFamily, target.referenceValue, draft))}>
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
          <select value={draft.termWeeks} onChange={(event) => onChange({ ...draft, termWeeks: Number(event.target.value) })}>
            {terms.map((weeks) => <option key={weeks} value={weeks}>{weeks === 1 ? "1 PPW week" : `${weeks} PPW weeks`}</option>)}
          </select>
        </label>
        <label>
          <span>Purchased dates</span>
          <IntegerInput
            value={draft.dateEntitlement}
            min={1}
            max={104}
            disabled={draft.family === "ONE_OFF"}
            onChange={(value) => onChange({ ...draft, dateEntitlement: value })}
          />
        </label>
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
            onChange={(value) => onChange({ ...draft, appearanceFee: value })}
          />
        </label>
        <label>
          <span>Signing bonus</span>
          <MoneyInput
            value={draft.signingBonus}
            onChange={(value) => onChange({ ...draft, signingBonus: value })}
          />
        </label>
        </div>
      </div>

      <div className={styles.editorFooter}>
        <span>PPW will still enforce exclusivity, Service Capacity and wrestler acceptance when this is submitted/resolved.</span>
        <button className={styles.primaryButton} type="button" disabled={submitting} onClick={onSubmit}>{submitting ? "Submitting…" : "Submit offer"}</button>
      </div>
    </section>
  );
}

export default function TalentClient({ initialTab = "ROSTER" }: { initialTab?: TalentTab }): React.JSX.Element {
  const [view, setView] = useState<PlayerTalentManagementView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [tab, setTab] = useState<TalentTab>(initialTab);
  const [query, setQuery] = useState("");
  const [rosterSort, setRosterSort] = useState<RosterSort>("POPULARITY");
  const [rosterContractFilter, setRosterContractFilter] = useState<RosterContractFilter>("ALL");
  const [rosterDivisionFilter, setRosterDivisionFilter] = useState<RosterDivisionFilter>("ALL");
  const [collapsedRosterRoles, setCollapsedRosterRoles] = useState<Set<OfferRole>>(() => new Set());
  const [marketSort, setMarketSort] = useState<MarketSort>("INTEREST");
  const [marketAvailabilityFilter, setMarketAvailabilityFilter] = useState<MarketAvailabilityFilter>("ALL");
  const [marketDivisionFilter, setMarketDivisionFilter] = useState<MarketDivisionFilter>("ALL");
  const [marketInterestFilter, setMarketInterestFilter] = useState<MarketInterestFilter>("ALL");
  const [marketWatchOnly, setMarketWatchOnly] = useState(false);
  const [marketLimit, setMarketLimit] = useState(25);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [alignmentSaving, setAlignmentSaving] = useState<string | null>(null);
  const [watchSaving, setWatchSaving] = useState<string | null>(null);
  const [target, setTarget] = useState<OfferTarget | null>(null);
  const [draft, setDraft] = useState<OfferDraft | null>(null);
  const offerOpen = Boolean(target && draft);

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

  function openMarketOffer(wrestler: PlayerTalentMarketView): void {
    const next: OfferTarget = {
      requestId: requestIdFor(wrestler.personId),
      personId: wrestler.personId,
      personName: wrestler.name,
      sourceContractId: null,
      referenceValue: wrestler.estimatedWeeklyValue,
      currentContract: null,
    };
    setTarget(next);
    setDraft(defaultDraft(next));
    setError(null);
    setNotice(null);
  }

  function openRenewal(wrestler: PlayerRosterContractView): void {
    const next: OfferTarget = {
      requestId: requestIdFor(wrestler.personId),
      personId: wrestler.personId,
      personName: wrestler.name,
      sourceContractId: wrestler.contractId,
      referenceValue: Math.max(wrestler.contract.weeklyGuarantee, wrestler.contract.appearanceFee, 1_000),
      currentContract: wrestler.contract,
    };
    setTarget(next);
    setDraft(defaultDraft(next));
    setError(null);
    setNotice(null);
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
      setTab("OFFERS");
      setQuery("");
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
      if (rosterSort === "DATES_ASC") return left.contract.datesRemaining - right.contract.datesRemaining || left.name.localeCompare(right.name);
      if (rosterSort === "DATES_DESC") return right.contract.datesRemaining - left.contract.datesRemaining || left.name.localeCompare(right.name);
      if (rosterSort === "EXPIRY") return left.contract.weeksToExpiry - right.contract.weeksToExpiry || left.name.localeCompare(right.name);
      if (rosterSort === "NAME") return left.name.localeCompare(right.name);
      return right.popularity - left.popularity || right.recognition - left.recognition || left.name.localeCompare(right.name);
    });
  }, [view, query, rosterContractFilter, rosterDivisionFilter, rosterSort]);
  const rosterGroups = useMemo(
    () => ROSTER_ROLE_ORDER
      .map((role) => ({
        role,
        entries: roster.filter((entry) => entry.contract.roleExpectation === role),
      }))
      .filter((group) => group.entries.length > 0),
    [roster],
  );
  const market = useMemo(() => {
    const entries = (view?.market ?? [])
      .filter((entry) => matchesQuery(entry.name, query))
      .filter((entry) => marketDivisionFilter === "ALL" || entry.division === marketDivisionFilter)
      .filter((entry) => marketAvailabilityFilter === "ALL" || entry.availability === marketAvailabilityFilter)
      .filter((entry) => !marketWatchOnly || entry.watched)
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
  }, [view, query, marketAvailabilityFilter, marketDivisionFilter, marketInterestFilter, marketWatchOnly, marketSort]);
  const visibleMarket = useMemo(() => market.slice(0, marketLimit), [market, marketLimit]);
  const offers = useMemo(
    () => (view?.pendingOffers ?? []).filter((entry) => matchesQuery(entry.personName, query)),
    [view, query],
  );
  const pendingPeople = useMemo(() => new Set((view?.pendingOffers ?? []).map((offer) => offer.personId)), [view]);

  useEffect(() => {
    setMarketLimit(25);
  }, [query, marketAvailabilityFilter, marketDivisionFilter, marketInterestFilter, marketWatchOnly, marketSort]);

  function selectTab(nextTab: TalentTab): void {
    setTab(nextTab);
    setQuery("");
    setMarketLimit(25);
    if (typeof window !== "undefined") {
      const url = nextTab === "ROSTER"
        ? "/talent"
        : `/talent?view=${nextTab.toLowerCase()}`;
      window.history.replaceState(window.history.state, "", url);
    }
  }

  function toggleRosterRole(role: OfferRole): void {
    setCollapsedRosterRoles((current) => {
      const next = new Set(current);
      if (next.has(role)) next.delete(role);
      else next.add(role);
      return next;
    });
  }

  return (
    <main className={styles.shell}>
      <a className={styles.backLink} href="/">← Promotion home</a>
      <header className={styles.header}>
        <div>
          <span className={styles.eyebrow}>ROSTER & TALENT MARKET</span>
          <h1>{view?.promotion?.name ?? "Talent management"}</h1>
          <p>{view ? `${view.world.name} · ${ppwDate(view.world.currentDate)}` : "Loading your World…"}</p>
        </div>
        <button className={styles.button} disabled={loading || submitting} onClick={() => void refresh()}>{loading ? "Loading…" : "Refresh"}</button>
      </header>

      {error ? <div className={styles.error}>{error}</div> : null}
      {notice ? <div className={styles.notice}>{notice}</div> : null}
      {view && !view.promotion ? <section className={styles.panel}><p>Take control of a promotion before managing talent.</p></section> : null}

      {target && draft ? (
        <OfferEditor
          target={target}
          draft={draft}
          submitting={submitting}
          onChange={setDraft}
          onCancel={() => { setTarget(null); setDraft(null); }}
          onSubmit={() => void submitOffer()}
        />
      ) : null}

      {view?.promotion ? (
        <>
          <section className={styles.overview}>
            <div><span>Roster contracts</span><strong>{view.roster.length}</strong></div>
            <div><span>Available talent</span><strong>{view.market.length}</strong></div>
            <div><span>Pending offers</span><strong>{view.pendingOffers.length}</strong></div>
          </section>

          <div className={styles.tabs} role="tablist" aria-label="Talent management views">
            {(["ROSTER", "MARKET", "OFFERS"] as const).map((candidate) => (
              <button
                key={candidate}
                role="tab"
                aria-selected={tab === candidate}
                className={tab === candidate ? styles.activeTab : styles.tab}
                onClick={() => selectTab(candidate)}
              >
                {candidate === "MARKET" ? "Talent market" : candidate[0] + candidate.slice(1).toLowerCase()}
              </button>
            ))}
          </div>

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
                        <span className={styles.rosterGroupTitle}>{label(group.role)}</span>
                        <span className={styles.rosterGroupMeta}>{group.entries.length} {group.entries.length === 1 ? "wrestler" : "wrestlers"} · {collapsed ? "Show" : "Hide"}</span>
                      </button>
                      {!collapsed ? (
                        <div className={styles.rosterGroupList}>
                          {group.entries.map((entry) => (
                            <RosterCard
                              key={entry.contractId}
                              wrestler={entry}
                              pending={pendingPeople.has(entry.personId)}
                              alignmentSaving={alignmentSaving === entry.personId}
                              onAlignment={(alignment) => void changeAlignment(entry, alignment)}
                              onRenew={() => openRenewal(entry)}
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
