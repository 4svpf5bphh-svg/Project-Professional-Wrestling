import type { PlayerShowMatchView, PlayerShowSegmentView, PlayerShowResultView } from "../../application/src/results-view.js";

/** Editorial voice for player-booked results, not a new simulation or invented move log.
 * Output is deterministic from the immutable resolved event, so old shows stay readable. */
export type ReviewTone = "GREAT" | "GOOD" | "MIXED" | "ROUGH";
export type SlotReview = { headline: string; recap: string; verdict: string; tone: ReviewTone };

function pick<T>(items: readonly T[], key: string, salt: number): T {
  let hash = 2166136261 ^ salt;
  for (const char of key) { hash ^= char.charCodeAt(0); hash = Math.imul(hash, 16777619); }
  return items[(hash >>> 0) % items.length]!;
}
function matchTone(match: PlayerShowMatchView): ReviewTone {
  const stars = Number.isFinite(match.criticalRatingStars) ? match.criticalRatingStars : 0;
  return stars >= 4.2 ? "GREAT" : stars >= 3.4 ? "GOOD" : stars >= 2.45 ? "MIXED" : "ROUGH";
}
function crowdSentence(crowd: number, id: string): string {
  if (!Number.isFinite(crowd)) return "";
  if (crowd >= 78) return pick(["The place was rocking.", "The audience ate it up.", "The room was all in."], id, 1);
  if (crowd >= 65) return pick(["The crowd was with them.", "A healthy reaction from the room."], id, 2);
  if (crowd < 43) return pick(["The crowd was not buying it.", "The room went decidedly cold."], id, 3);
  if (crowd < 57) return pick(["The audience never quite warmed to it.", "A decidedly muted response."], id, 4);
  return "";
}
function verdict(tone: ReviewTone, id: string): string {
  if (tone === "GREAT") return pick(["Now THAT was wrestling.", "A real highlight of the night.", "The kind of bout fans remember."], id, 5);
  if (tone === "GOOD") return pick(["A good bit of business.", "Solid entertainment and worth a watch.", "No complaints about this one."], id, 6);
  if (tone === "MIXED") return pick(["Passable rather than memorable.", "Some things clicked, others did not.", "It did its job. Just."], id, 7);
  return pick(["A rough night at the office.", "One to forget.", "The fans deserved a little better.", "That was a clunker."], id, 8);
}
function matchOpening(match: PlayerShowMatchView): string {
  switch (match.intent) {
    case "TECHNICAL": return pick(["A technical contest that put the craft front and centre.", "The focus was firmly on wrestling technique."], match.matchId, 10);
    case "HIGH_RISK": return "A high-risk contest with plenty of ambition.";
    case "EPIC": return "A big-match approach with plenty of expectation riding on it.";
    case "STORY": return "A rivalry-driven encounter where the result mattered.";
    case "PROTECTIVE": return "A contest with reputations to protect.";
    case "DOMINANT": return "This bout set out to make a statement.";
    case "SHOWCASE": return "An opportunity to put the talent in the spotlight.";
    default: return "A straight wrestling contest with pride at stake.";
  }
}
function finishSentence(match: PlayerShowMatchView): string {
  const winners = match.winnerNames.join(" & ");
  const actor = match.finishCheater?.name ?? null;
  switch (match.actualFinish) {
    case "CLEAN_PIN": return winners ? winners + " won cleanly by pinfall." : "The referee counted three.";
    case "SUBMISSION": return winners ? winners + " forced the submission victory." : "The contest ended by submission.";
    case "FLASH_PIN": return winners ? winners + " caught the opposition with a sudden pin." : "A flash pin decided it.";
    case "PROTECTED_FINISH": return winners ? winners + " took the decision in a protected finish." : "A protected finish decided matters; its exact mechanism was not recorded.";
    case "DISQUALIFICATION": return actor
      ? actor + " was caught cheating and disqualified. " + (winners || "The opposing side") + " won by DQ."
      : "The losing side was disqualified" + (winners ? ", handing " + winners + " the victory." : ".");
    case "FOREIGN_OBJECT": return actor
      ? actor + " used a foreign object outside the referee's sight" + (winners ? ", and " + winners + " stole the decision." : ".")
      : "A foreign object decided the bout behind the referee's back" + (winners ? ", with " + winners + " victorious." : ".");
    case "INJURY_STOPPAGE": return "The referee stopped the match after an injury. The planned finish was abandoned.";
    default: return winners ? winners + " emerged victorious; the exact finish wasn't recorded." : "The precise finish was not recorded.";
  }
}
export function reviewPlayerMatch(match: PlayerShowMatchView): SlotReview {
  const tone = matchTone(match);
  const title = match.titleOutcomes.find((entry) => entry.titleChanged);
  const winner = match.winnerNames.join(" & ");
  const finish = match.actualFinish;
  let headline = winner ? winner + " takes the win" : "The result is in";
  if (title) headline = "NEW CHAMPION: " + title.winnerHolderName;
  else if (finish === "INJURY_STOPPAGE") headline = "A match cut brutally short";
  else if (finish === "FOREIGN_OBJECT") headline = pick(["Stolen! A dirty finish decides it", "A victory with a very large asterisk"], match.matchId, 20);
  else if (finish === "DISQUALIFICATION") headline = "The referee has seen enough!";
  else if (match.interference?.outcome === "SUCCESS") headline = "Outside help tips the scales";
  else if (tone === "GREAT") headline = pick(["They tore the house down", "Now THAT was wrestling", "The night's standout bout"], match.matchId, 21);
  else if (tone === "ROUGH") headline = pick(["One to forget", "The wheels came off", "Not their finest hour"], match.matchId, 22);

  let after = "";
  if (match.interference?.outcome === "SUCCESS") after += " " + match.interference.name + " interfered successfully on behalf of the winning side.";
  if (match.interference?.outcome === "THWARTED") after += " An attempted run-in by " + match.interference.name + " was thwarted.";
  if (match.interference?.outcome === "ABORTED") after += " A planned run-in by " + match.interference.name + " never materialised.";
  if (title) after += " The " + title.championshipName + " changed hands.";
  if (match.injuries.length && finish !== "INJURY_STOPPAGE") after += " " + match.injuries.map((x) => x.personName).join(" and ") + " also suffered an injury.";
  const recap = [matchOpening(match), finishSentence(match) + after, crowdSentence(match.crowdResponse, match.matchId)].filter(Boolean).join(" ");
  return { headline, recap, verdict: verdict(tone, match.matchId), tone };
}

function person(segment: PlayerShowSegmentView, id: string | null): string | null {
  return segment.participants.find((x) => x.personId === id)?.name ?? null;
}
export function reviewPlayerSegment(segment: PlayerShowSegmentView): SlotReview {
  const who = segment.participants[0]?.name ?? "The featured wrestler";
  const from = person(segment, segment.initiatorPersonId) ?? who;
  const to = person(segment, segment.targetPersonId) ?? "the opposition";
  const attacker = person(segment, segment.attackerPersonId) ?? who;
  const victim = person(segment, segment.victimPersonId) ?? "the victim";
  const rescuer = person(segment, segment.rescuerPersonId) ?? "The rescuer";
  let headline = "The spotlight moves";
  let recap = "The segment played out in front of the audience.";
  switch (segment.type) {
    case "PROMO":
      headline = who + " grabs the microphone";
      recap = ({ BOAST: who + " wasn't short of confidence.", RALLY_FANS: who + " appealed directly to the fans.",
        AIR_GRIEVANCE: who + " aired their grievances.", ISSUE_WARNING: who + " issued a warning.",
        STATEMENT_OF_INTENT: who + " laid out their intentions." } as Record<string, string>)[segment.promoPurpose ?? ""]
        ?? who + " addressed the audience."; break;
    case "INTERVIEW":
      headline = who + " faces the questions";
      recap = segment.interviewResponse === "WALKOUT" ? who + " walked out of the interview. Message received."
        : segment.interviewResponse === "EVASIVE" ? who + " dodged the question."
        : segment.interviewResponse === "DEFIANT" ? who + " answered defiantly."
        : segment.interviewResponse === "CANDID" ? who + " gave a candid answer."
        : who + " was interviewed."; break;
    case "CHALLENGE":
      headline = from + " calls out " + to;
      recap = segment.challengeResponse === "ACCEPTED" ? to + " accepted the challenge."
        : segment.challengeResponse === "REFUSED" ? to + " refused to take the challenge."
        : "The challenge was left unanswered."; break;
    case "CONFRONTATION":
      headline = from + " faces " + to;
      recap = segment.confrontationEnding === "STAREDOWN" ? "Neither wrestler backed down."
        : segment.confrontationEnding === "INITIATOR_BACKS_DOWN" ? from + " backed away."
        : segment.confrontationEnding === "TARGET_BACKS_DOWN" ? to + " backed away."
        : segment.confrontationEnding === "RELUCTANT_HANDSHAKE" ? "The encounter ended in a reluctant handshake."
        : "The wrestlers came face to face."; break;
    case "INTERRUPTION":
      headline = from + " interrupts " + to;
      recap = segment.interruptionOutcome === "BRAWL" ? "The interruption ended in a brawl."
        : segment.interruptionOutcome === "INTERRUPTER_PREVAILS" ? from + " got the better of the exchange."
        : segment.interruptionOutcome === "SPEAKER_PREVAILS" ? to + " turned the interruption back on its instigator."
        : "An exchange of words followed."; break;
    case "ATTACK": case "POST_MATCH_ASSAULT":
      headline = attacker + " goes after " + victim + "!";
      recap = attacker + " attacked " + victim + (segment.type === "POST_MATCH_ASSAULT" ? " after the match." : ".");
      if (segment.postMatchAssaultEnding === "ATTACKER_STANDS_TALL") recap += " The attacker was left standing.";
      if (segment.postMatchAssaultEnding === "VICTIM_FIGHTS_BACK") recap += " The victim fought back.";
      if (segment.postMatchAssaultEnding === "OFFICIALS_SEPARATE") recap += " Officials separated the wrestlers."; break;
    case "RESCUE":
      headline = rescuer + " to the rescue!";
      recap = rescuer + " intervened as " + attacker + " attacked " + victim + ".";
      if (segment.rescueOutcome === "RESCUER_STANDS_TALL") recap += " The rescue succeeded.";
      if (segment.rescueOutcome === "ATTACKER_ESCAPES") recap += " The attacker escaped.";
      if (segment.rescueOutcome === "RESCUE_OVERWHELMED") recap += " The rescue failed."; break;
    case "TURN": {
      const turning = person(segment, segment.turnPersonId) ?? who;
      headline = turning + " turns " + (segment.turnTargetAlignment?.toLowerCase() ?? "on the crowd") + "!";
      recap = segment.turnPresentation === "BETRAYAL"
        ? turning + " betrayed " + (person(segment, segment.betrayedPersonId) ?? "an ally") + "."
        : turning + " revealed a new allegiance."; break;
    }
    case "VIDEO_PACKAGE":
      headline = segment.videoReveal === "CRYPTIC" ? "Who's behind the mystery footage?" : (segment.videoSubjectName ?? "A featured wrestler") + " in focus";
      recap = segment.videoReveal === "CRYPTIC" ? "Cryptic footage aired without publicly identifying its subject."
        : "A pre-recorded " + (segment.videoKind ?? "spotlight").toLowerCase().replaceAll("_", " ") + " showcased " + (segment.videoSubjectName ?? "the wrestler") + "."; break;
    case "LIVE_APPEARANCE":
      headline = segment.liveAppearanceKind === "DEBUT" ? who + " has arrived!"
        : segment.liveAppearanceKind === "RETURN" ? who + " is back!"
        : segment.liveAppearanceKind === "SURPRISE_REVEAL" ? "Surprise! " + who + " appears!"
        : who + " enters the spotlight";
      recap = segment.liveAppearanceKind === "DEBUT" ? who + " made their first live appearance for the promotion."
        : segment.liveAppearanceKind === "RETURN" ? who + " returned in person."
        : segment.liveAppearanceKind === "SURPRISE_REVEAL" ? who + " was revealed in a surprise appearance."
        : who + " was introduced in person."; break;
    case "CELEBRATION":
      headline = who + " celebrates";
      recap = segment.celebrationOccasion === "SELF_CORONATION" ? who + " crowned themselves. All bravado, no official title change."
        : segment.celebrationOccasion === "RIVALRY_TAUNT" ? who + " taunted a rival."
        : segment.celebrationOccasion === "VICTORY_LAP" ? who + " celebrated a recent win."
        : who + " thanked the fans."; break;
    case "CONTRACT_SIGNING":
      headline = segment.signingOutcome === "BRAWL" ? "The signing erupts!"
        : segment.signingOutcome === "WALKOUT" ? "Someone walks away from the table" : "A deal on the line";
      recap = segment.signingOutcome === "SIGNED" ? from + " and " + to + " signed the on-screen agreement."
        : segment.signingOutcome === "REJECTED" ? to + " rejected the on-screen proposal."
        : segment.signingOutcome === "WALKOUT" ? "The meeting ended in a walkout."
        : segment.signingOutcome === "BRAWL" ? "Negotiations descended into a brawl."
        : "The signing segment took place."; break;
    case "STABLE_INVITATION": case "STABLE_EXIT": case "STABLE_RECONCILIATION":
      headline = (segment.stableName ?? "The stable") + ": trouble in the ranks";
      recap = segment.type === "STABLE_INVITATION" ? from + " invited " + to + " to join. " + (segment.stableInvitationOutcome === "ACCEPTED" ? "Accepted." : "Refused.")
        : segment.type === "STABLE_EXIT" ? to + (segment.stableExitOutcome === "EXPELLED" ? " was expelled." : " walked out.")
        : segment.stableReconciliationOutcome === "RECONCILED" ? from + " and " + to + " reconciled on screen."
        : to + " rebuffed the reconciliation attempt."; break;
  }
  const tone: ReviewTone = segment.outcomeBand === "HOT" ? "GREAT"
    : segment.outcomeBand === "POOR" ? "ROUGH"
    : segment.crowdResponse !== null && segment.crowdResponse >= 70 ? "GOOD" : "MIXED";
  return { headline, recap, verdict: verdict(tone, segment.segmentId), tone };
}


/** Full editorial verdict is intentionally private to the player's own show.
 * AI-owned public results stay as a compact factual scoreboard. */
export function reviewPlayerShow(show: Pick<PlayerShowResultView,
  "eventId" | "averageMatchRating" | "crowdResponse" | "titleChangeCount" |
  "injuryCount" | "matchCount" | "segmentCount">): SlotReview {
  const crowd = Number.isFinite(show.crowdResponse) ? show.crowdResponse : 50;
  const average = Number.isFinite(show.averageMatchRating) ? show.averageMatchRating : 2.5;
  const tone: ReviewTone = crowd >= 76 && average >= 3.5 ? "GREAT"
    : crowd >= 62 && average >= 2.9 ? "GOOD"
    : crowd < 46 || average < 2.15 ? "ROUGH" : "MIXED";
  const headline = tone === "GREAT" ? pick([
    "A night they won't forget", "The promotion delivers the goods",
    "The crowd got its money's worth", "A proper night of professional wrestling",
  ], show.eventId, 101) : tone === "GOOD" ? pick([
    "A show with plenty to cheer", "A solid night between the ropes",
    "The good comfortably outweighed the bad",
  ], show.eventId, 102) : tone === "ROUGH" ? pick([
    "Back to the drawing board", "A tough night under the lights",
    "Well, that didn't go to plan", "Not one for the highlight reel",
  ], show.eventId, 103) : pick([
    "Some cheers, some groans", "A mixed bag under the lights",
    "A show of two halves", "Plenty happened. Not all of it worked.",
  ], show.eventId, 104);
  const audience = crowd >= 78 ? "The crowd responded in a big way."
    : crowd >= 62 ? "The audience gave the show a solid reception."
    : crowd < 43 ? "The crowd struggled to get behind the card."
    : crowd < 57 ? "The room was a difficult one to win over."
    : "The show drew a mixed reaction.";
  const matches = average >= 4 ? "The wrestling itself provided a genuine standout performance."
    : average >= 3.4 ? "The in-ring work gave the audience plenty to enjoy."
    : average < 2.3 ? "The matches never really found their footing."
    : "There were bright spots and bouts that will need another look.";
  const consequences = [
    show.titleChangeCount > 0
      ? show.titleChangeCount === 1 ? "There was a championship change." : "Multiple championships changed hands."
      : "",
    show.injuryCount > 0
      ? show.injuryCount === 1 ? "An injury cast a shadow over the night." : "Injuries added to the fallout."
      : "",
  ].filter(Boolean).join(" ");
  const verdict = tone === "GREAT" ? "A show that reminds you why you booked the card in the first place."
    : tone === "GOOD" ? "Plenty here to build on next week."
    : tone === "ROUGH" ? "The booker has some explaining to do."
    : "The next card has a chance to put the pieces together.";
  return { headline, recap: [audience, matches, consequences].filter(Boolean).join(" "), verdict, tone };
}
