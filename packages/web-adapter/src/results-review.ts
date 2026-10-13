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

/** An angle is not a match: never describe a promo or debut as a 'bout'. */
function angleVerdict(segment: PlayerShowSegmentView, tone: ReviewTone): string {
  const id = segment.segmentId;
  const microphone = segment.type === "PROMO" || segment.type === "INTERVIEW";
  const physical = ["ATTACK", "RESCUE", "POST_MATCH_ASSAULT"].includes(segment.type);
  const arrival = segment.type === "LIVE_APPEARANCE" || segment.type === "VIDEO_PACKAGE";
  if (tone === "GREAT") {
    if (microphone) return pick(["The mic work landed. That is how you hold a crowd.", "They got the audience listening. Job done.", "That was a promo people won't be forgetting immediately."], id, 31);
    if (physical) return pick(["Now that is how you get some heat.", "The angle landed — and the fans reacted accordingly.", "That's the kind of chaos a wrestling crowd turns up for."], id, 32);
    if (arrival) return pick(["A reveal worth the build-up.", "The audience bought right into the presentation.", "There was real excitement for this moment."], id, 33);
    return pick(["That got people talking.", "A strong bit of business for the show.", "The audience was hooked."], id, 34);
  }
  if (tone === "ROUGH") {
    if (microphone) return pick(["That promo died a death out there.", "Tough room — they couldn't get the audience onside.", "Somebody find a better hook for the next microphone segment."], id, 35);
    if (physical) return pick(["Plenty of commotion, not much crowd response.", "The angle fell flat. Hard to get heat from a cold room.", "An attack that failed to catch fire with the fans."], id, 36);
    if (arrival) return pick(["The build-up promised more than the reaction delivered.", "Not quite the big arrival the booker had in mind.", "The crowd gave the reveal a cold shoulder."], id, 37);
    return pick(["This one fell flat.", "The segment went over like a lead balloon.", "The audience was unmoved."], id, 38);
  }
  if (tone === "GOOD") return pick([
    "The segment moved the show along nicely.", "A worthwhile beat, well received.",
    "Good crowd response. Worth following up on.", "A useful piece of business on the card.",
  ], id, 39);
  return pick([
    "A serviceable angle, if not one for the history books.",
    "A quieter moment on the card.", "It got through without setting the world on fire.",
    "Not every segment can steal the show.", 
  ], id, 40);
}

function matchOpening(match: PlayerShowMatchView): string {
  switch (match.intent) {
    case "TECHNICAL": return pick(["The mat work was the selling point here.", "An old-school technical contest. The grappling took centre stage.", "A wrestling-first contest, with the emphasis firmly on technique."], match.matchId, 10);
    case "HIGH_RISK": return pick(["An ambitious, high-risk contest. Not for the faint-hearted.", "The wrestlers chased spectacle, for better or worse.", "A contest with an appetite for risk."], match.matchId, 11);
    case "EPIC": return pick(["Big-match expectations hung over this one.", "This had the atmosphere of a match with something to prove.", "An epic was the ambition — no small task under those lights."], match.matchId, 12);
    case "STORY": return pick(["There was more emotion to this contest than a simple win and loss.", "The personalities mattered as much as the holds.", "The drama was as important as the wrestling."], match.matchId, 13);
    case "PROTECTIVE": return pick(["A carefully judged contest with reputations at stake.", "There was a delicate balance between winning and saving face.", "Neither side could afford to look foolish here."], match.matchId, 14);
    case "DOMINANT": return pick(["A contest with one clear ambition: make a statement.", "The atmosphere suggested somebody wanted to prove a point.", "An emphatic impression was the aim here."], match.matchId, 15);
    case "SHOWCASE": return pick(["Time in the spotlight — and a chance to justify it.", "The stage was theirs, and the audience was ready to judge.", "An opportunity to make a name between the ropes."], match.matchId, 16);
    default: return pick(["A straight contest, with bragging rights on the line.", "No elaborate premise. Just two sides settling it between the ropes.", "The simplest question in wrestling: who came out on top?"], match.matchId, 17);
  }
}
function finishSentence(match: PlayerShowMatchView): string {
  const winners = match.winnerNames.join(" & ");
  const actor = match.finishCheater?.name ?? null;
  switch (match.actualFinish) {
    case "CLEAN_PIN": return winners ? winners + " won cleanly by pinfall." : "The referee counted three.";
    case "SUBMISSION": return winners ? winners + " forced the submission victory." : "The contest ended by submission.";
    case "FLASH_PIN": return winners ? winners + " caught the opposition with a sudden pin." : "A flash pin decided it.";
    case "PROTECTED_FINISH": return winners ? winners + " got the decision in a protected ending; the exact details weren't recorded." : "The finish was designed to protect the participants, but its details weren't recorded.";
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
  else if (tone === "GREAT") headline = pick(["They tore the house down", "Now THAT was wrestling", "This one earned its applause", "A performance to remember"], match.matchId, 21);
  else if (tone === "ROUGH") headline = pick(["One to forget", "The wheels came off", "Not their finest hour"], match.matchId, 22);

  let after = "";
  if (match.interference?.outcome === "SUCCESS") after += " " + match.interference.name + " interfered successfully on behalf of the winning side.";
  if (match.interference?.outcome === "THWARTED") after += " An attempted run-in by " + match.interference.name + " was thwarted.";
  if (match.interference?.outcome === "ABORTED") after += " A planned run-in by " + match.interference.name + " never materialised.";
  if (title) after += " The " + title.championshipName + " changed hands.";
  else if (match.titleOutcomes.length) {
    const retained = match.titleOutcomes.filter((entry) => !entry.titleChanged);
    if (retained.length === 1) after += " " + retained[0]!.winnerHolderName + " retained the " + retained[0]!.championshipName + ".";
  }
  if (match.injuries.length && finish !== "INJURY_STOPPAGE") after += " " + match.injuries.map((x) => x.personName).join(" and ") + " also suffered an injury.";
  const performance = match.styleResult?.delivery === "MISSED"
    ? "The ambitious approach never quite came together."
    : match.styleResult?.delivery === "STRETCHED"
      ? "The demanding pace exposed a few rough edges."
      : "";
  const recap = [matchOpening(match), finishSentence(match) + after, crowdSentence(match.crowdResponse, match.matchId), performance].filter(Boolean).join(" ");
  const opinion = Number.isFinite(match.crowdResponse) && match.crowdResponse < 46 && match.criticalRatingStars >= 3.5
    ? pick(["Good wrestling met a stubbornly cold crowd.", "Technically strong, but the room wasn't buying it."], match.matchId, 41)
    : Number.isFinite(match.crowdResponse) && match.crowdResponse >= 78 && match.criticalRatingStars < 2.5
      ? pick(["The fans loved this more than the wrestling justified. That's showbusiness.", "Not exactly a technical classic, but the audience had other ideas."], match.matchId, 42)
      : match.styleResult?.delivery === "MISSED"
        ? pick(["Big ideas, shaky delivery. Back to the drawing board.", "The ambition was there; the execution wasn't."], match.matchId, 43)
        : verdict(tone, match.matchId);
  return { headline, recap, verdict: opinion, tone };
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
    case "INTERVIEW": {
      headline = who + " faces the questions";
      const topic = ({
        CAREER_STORY: "their career",
        RIVALRY_PRESSURE: "the pressure of their rivalry",
        RECENT_FORM: "their recent form",
        NEXT_STEPS: "what comes next",
      } as Record<string, string>)[segment.interviewTopic ?? ""] ?? "the situation";
      const answer = segment.interviewResponse === "WALKOUT" ? who + " walked out. Message received."
        : segment.interviewResponse === "EVASIVE" ? who + " gave very little away."
        : segment.interviewResponse === "DEFIANT" ? who + " answered defiantly."
        : segment.interviewResponse === "CANDID" ? who + " gave a candid answer."
        : "The response wasn't recorded.";
      recap = "The interviewer asked about " + topic + ". " + answer;
      break;
    }
    case "CHALLENGE":
      headline = from + " calls out " + to;
      recap = segment.challengeResponse === "ACCEPTED" ? to + " accepted the challenge."
        : segment.challengeResponse === "REFUSED" ? to + " refused to take the challenge."
        : segment.challengeResponse === "LEFT_OPEN" ? "The challenge remains open. Plenty to settle."
        : "The challenge was made, but no answer was recorded."; break;
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
    case "ATTACK": case "POST_MATCH_ASSAULT": {
      headline = attacker + " goes after " + victim + "!";
      const format = segment.attackPresentation === "BLINDSIDE"
        ? attacker + " blindsided " + victim + "."
        : segment.attackPresentation === "BEATDOWN"
          ? attacker + " laid a beatdown on " + victim + "."
          : segment.attackPresentation === "PULL_APART_BRAWL"
            ? attacker + " and " + victim + " were involved in a pull-apart brawl."
            : attacker + " attacked " + victim + ".";
      recap = segment.type === "POST_MATCH_ASSAULT" ? "After the bell: " + format : format;
      if (segment.postMatchAssaultEnding === "ATTACKER_STANDS_TALL") recap += " " + attacker + " was left standing.";
      if (segment.postMatchAssaultEnding === "VICTIM_FIGHTS_BACK") recap += " " + victim + " fought back.";
      if (segment.postMatchAssaultEnding === "OFFICIALS_SEPARATE") recap += " Officials separated the wrestlers.";
      break;
    }
    case "RESCUE":
      headline = rescuer + " to the rescue!";
      recap = rescuer + " intervened as " + attacker + " attacked " + victim + ".";
      if (segment.rescueOutcome === "RESCUER_STANDS_TALL") recap += " " + rescuer + " fought the attacker off and stood tall.";
      if (segment.rescueOutcome === "ATTACKER_ESCAPES") recap += " " + attacker + " escaped the attempted save.";
      if (segment.rescueOutcome === "RESCUE_OVERWHELMED") recap += " The rescue failed; the attacker overwhelmed them."; break;
    case "TURN": {
      const turning = person(segment, segment.turnPersonId) ?? who;
      headline = turning + (segment.turnTargetAlignment ? " turns " + segment.turnTargetAlignment.toLowerCase() : " changes course") + "!";
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
    case "CELEBRATION": {
      headline = who + " celebrates";
      recap = segment.celebrationOccasion === "SELF_CORONATION" ? who + " crowned themselves. All bravado, no official title change."
        : segment.celebrationOccasion === "RIVALRY_TAUNT" ? who + " taunted a rival."
        : segment.celebrationOccasion === "VICTORY_LAP" ? who + " celebrated a recent win."
        : segment.celebrationOccasion === "FAN_APPRECIATION" ? who + " thanked the fans."
        : who + " had a celebration in the ring.";
      if (segment.celebrationEnding === "SALUTE_CROWD") recap += " A salute to the crowd closed it out.";
      if (segment.celebrationEnding === "POSE") recap += " " + who + " struck a pose to finish.";
      if (segment.celebrationEnding === "TAUNT_RIVALS") recap += " One last taunt was aimed at the opposition.";
      if (segment.celebrationEnding === "WALK_OFF") recap += " Then " + who + " walked off.";
      break;
    }
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
      recap = segment.type === "STABLE_INVITATION"
        ? from + " invited " + to + " to join. " + (segment.stableInvitationOutcome === "ACCEPTED" ? "The offer was accepted on screen." : segment.stableInvitationOutcome === "REFUSED" ? "The offer was refused on screen." : "The response was not recorded.")
        : segment.type === "STABLE_EXIT"
          ? to + (segment.stableExitOutcome === "EXPELLED" ? " was expelled on screen." : segment.stableExitOutcome === "WALKED_OUT" ? " walked out on screen." : " appeared in the stable story; the departure wasn't recorded.")
          : segment.stableReconciliationOutcome === "RECONCILED" ? from + " and " + to + " reconciled on screen."
          : segment.stableReconciliationOutcome === "REBUFFED" ? to + " rebuffed the reconciliation attempt." : "A reunion was discussed, but no outcome was recorded."; break;
  }
  const tone: ReviewTone = segment.outcomeBand === "HOT" ? "GREAT"
    : segment.outcomeBand === "POOR" ? "ROUGH"
    : segment.crowdResponse !== null && segment.crowdResponse >= 70 ? "GOOD" : "MIXED";
  const commentary = segment.outcomeBand === null && segment.crowdResponse === null
    ? "The crowd's verdict wasn't preserved with this result."
    : angleVerdict(segment, tone);
  return { headline, recap, verdict: commentary, tone };
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


/** Editorial chapter breaks turn a long booked card into a beginning, middle and end.
 * Boundaries use performed running-order slots, never unperformed planned angles.
 * This is a presentation-only reading of the completed World ledger. */
export interface ShowReviewChapter {
  startOrder: number;
  chapter: "OPENING BELL" | "MIDDLE STRETCH" | "FINAL BELL";
  headline: string;
  recap: string;
}
export function reviewPlayerShowChapters(
  show: Pick<PlayerShowResultView, "eventId" | "runningOrder">,
): ShowReviewChapter[] {
  const slots = show.runningOrder;
  const count = slots.length;
  // Don't pad a very short show with artificial "acts".
  if (count < 4) return [];
  const divisions = count >= 8 ? 3 : 2;
  const chapterNames: ShowReviewChapter["chapter"][] = divisions === 3
    ? ["OPENING BELL", "MIDDLE STRETCH", "FINAL BELL"]
    : ["OPENING BELL", "FINAL BELL"];
  return chapterNames.map((chapter, chapterIndex) => {
    const start = Math.floor((chapterIndex * count) / divisions);
    const end = Math.floor(((chapterIndex + 1) * count) / divisions);
    const part = slots.slice(start, end);
    const opener = part[0]!;
    const titleMatch = part.find((slot) => slot.kind === "MATCH" &&
      slot.match.titleOutcomes.some((title) => title.titleChanged));
    const injuredMatch = part.find((slot) => slot.kind === "MATCH" && slot.match.injuries.length > 0);
    const majorAngle = part.find((slot) => slot.kind === "SEGMENT" &&
      ((slot.segment.type === "TURN" && Boolean(slot.segment.turnTargetAlignment))
        || (slot.segment.type === "LIVE_APPEARANCE"
          && ["DEBUT", "RETURN", "SURPRISE_REVEAL"].includes(slot.segment.liveAppearanceKind ?? ""))));
    const dirtyMatch = part.find((slot) => slot.kind === "MATCH" &&
      ["FOREIGN_OBJECT", "DISQUALIFICATION"].includes(slot.match.actualFinish ?? ""));
    const featuredMatch = part.filter((slot) => slot.kind === "MATCH")
      .sort((a, b) => (
        (b.kind === "MATCH" ? b.match.criticalRatingStars : 0) -
        (a.kind === "MATCH" ? a.match.criticalRatingStars : 0)
      ))[0];
    let headline: string;
    let recap: string;
    if (titleMatch?.kind === "MATCH") {
      const title = titleMatch.match.titleOutcomes.find((entry) => entry.titleChanged)!;
      headline = "Gold changes hands!";
      recap = title.winnerHolderName + " captured the " + title.championshipName + ". The card had a title change to remember.";
    } else if (injuredMatch?.kind === "MATCH") {
      const injury = injuredMatch.match.injuries[0]!;
      headline = "A night with a price";
      recap = injury.personName + " suffered an injury during this part of the card. A reminder that not every result ends at the bell.";
    } else if (majorAngle?.kind === "SEGMENT") {
      const angle = majorAngle.segment;
      const star = angle.participants.find((person) => person.personId === angle.turnPersonId)?.name
        ?? angle.participants[0]?.name ?? "A featured wrestler";
      if (angle.type === "TURN") {
        headline = "A change of allegiance";
        recap = star + " turned " + angle.turnTargetAlignment?.toLowerCase() + ". That's a talking point from this part of the show.";
      } else {
        headline = angle.liveAppearanceKind === "RETURN" ? "Look who's back" : "A new face in the spotlight";
        recap = star + (angle.liveAppearanceKind === "RETURN"
          ? " returned in front of the audience."
          : angle.liveAppearanceKind === "DEBUT"
            ? " made a live debut for the promotion."
            : " was unveiled in a surprise live appearance.");
      }
    } else if (dirtyMatch?.kind === "MATCH") {
      headline = "Controversy at the bell";
      recap = dirtyMatch.match.actualFinish === "FOREIGN_OBJECT"
        ? "A foreign object played a decisive part in one of the results. Hardly a clean night's work."
        : "One contest ended in disqualification. The referee had the last word.";
    } else if (featuredMatch?.kind === "MATCH" && featuredMatch.match.criticalRatingStars >= 4) {
      headline = pick(["This stretch delivers", "Some serious in-ring quality", "The wrestling does the talking"],
        show.eventId + ":" + opener.order, 71);
      const winners = featuredMatch.match.winnerNames.join(" & ");
      recap = winners
        ? winners + " won a highly rated contest in this stretch of the show."
        : "A highly rated contest gave this part of the card a genuine lift.";
    } else {
      const anyMatch = part.find((slot) => slot.kind === "MATCH");
      const anySegment = part.find((slot) => slot.kind === "SEGMENT");
      const label = chapter === "OPENING BELL" ? "The show gets underway"
        : chapter === "FINAL BELL" ? "The closing stretch" : "The card rolls on";
      headline = label;
      if (anyMatch?.kind === "MATCH" && anyMatch.match.winnerNames.length > 0) {
        recap = anyMatch.match.winnerNames.join(" & ") + " went over in this stretch of the card.";
      } else if (anySegment?.kind === "SEGMENT") {
        const subject = anySegment.segment.videoReveal === "CRYPTIC"
          ? "A mystery video"
          : anySegment.segment.participants[0]?.name ?? "A featured segment";
        recap = subject + " featured as the running order progressed.";
      } else {
        recap = "The show continued with the results recorded below.";
      }
    }
    return { startOrder: opener.order, chapter, headline, recap };
  });
}


/** "Final Bell" is an editorial selection from actual completed show history.
 * Its cards are recaps, never new incidents, wrestler ratings or World events. */
export type FinalBellMoment = {
  slotOrder: number;
  label: string;
  headline: string;
  detail: string;
  kind: "MATCH" | "SEGMENT";
};
export interface FinalBellReview {
  standout: FinalBellMoment | null;
  disappointment: FinalBellMoment | null;
  consequence: FinalBellMoment | null;
  lastWord: string;
}

export function reviewPlayerShowFinalBell(
  show: Pick<PlayerShowResultView, "eventId" | "runningOrder" | "crowdResponse" | "averageMatchRating">,
): FinalBellReview {
  const matches = show.runningOrder.filter(
    (slot): slot is Extract<PlayerShowResultView["runningOrder"][number], { kind: "MATCH" }> =>
      slot.kind === "MATCH",
  );
  const angles = show.runningOrder.filter(
    (slot): slot is Extract<PlayerShowResultView["runningOrder"][number], { kind: "SEGMENT" }> =>
      slot.kind === "SEGMENT",
  );
  const rankedMatches = [...matches]
    .filter((slot) => Number.isFinite(slot.match.criticalRatingStars))
    .sort((a, b) => b.match.criticalRatingStars - a.match.criticalRatingStars || a.order - b.order);
  const best = rankedMatches[0];
  const standout = best ? {
    slotOrder: best.order, kind: "MATCH" as const,
    label: "MATCH OF THE NIGHT",
    headline: best.match.winnerNames.length
      ? best.match.winnerNames.join(" & ") + " leads the way"
      : "The highest-rated contest",
    detail: "★ " + best.match.criticalRatingStars.toFixed(1) + " · " +
      (best.match.criticalRatingStars >= 4.2
        ? pick(["The pick of the bunch — and then some.", "A performance that earned its applause."], best.match.matchId, 81)
        : best.match.criticalRatingStars >= 3.3
          ? "The evening's most convincing in-ring display."
          : "The best available on this card, even if the show never found a classic."),
  } : null;

  // Never manufacture a "stinker" in a good show. An actually poor angle can
  // be a worse disappointment than an average-quality match.
  const poorMatch = [...matches]
    .filter((slot) => Number.isFinite(slot.match.criticalRatingStars)
      && slot.match.criticalRatingStars < 2.45)
    .sort((a, b) => a.match.criticalRatingStars - b.match.criticalRatingStars || a.order - b.order)[0];
  const poorAngle = angles.find((slot) => slot.segment.outcomeBand === "POOR");
  let disappointment: FinalBellMoment | null = null;
  if (poorAngle && (!poorMatch || (
    poorAngle.segment.crowdResponse !== null && poorAngle.segment.crowdResponse < 42
  ))) {
    const first = poorAngle.segment.participants[0]?.name;
    disappointment = {
      slotOrder: poorAngle.order, kind: "SEGMENT",
      label: "WHAT MISSED THE MARK",
      headline: first ? first + "'s segment fell flat" : "An angle that didn't land",
      detail: "The recorded segment response was poor. The booker might want a different approach next time.",
    };
  } else if (poorMatch) {
    const names = poorMatch.match.participants.map((person) => person.name);
    disappointment = {
      slotOrder: poorMatch.order, kind: "MATCH",
      label: "WHAT MISSED THE MARK",
      headline: names.length >= 2
        ? names[0] + " vs " + names[names.length - 1]
        : "A match that missed its mark",
      detail: "★ " + poorMatch.match.criticalRatingStars.toFixed(1)
        + " · " + pick([
          "The card's toughest watch. There's work to do.",
          "Plenty of room for improvement, and that's putting it politely.",
          "Not the performance the booker was hoping for.",
        ], poorMatch.match.matchId, 82),
    };
  }

  // This is an ordered shortlist of REAL fallout. Never generate a title
  // change or debut merely because a slot has a high rating.
  const title = matches.flatMap((slot) => slot.match.titleOutcomes
    .filter((x) => x.titleChanged)
    .map((x) => ({
      slotOrder: slot.order, kind: "MATCH" as const, label: "THE BIGGEST FALLOUT",
      headline: "We have a new champion!",
      detail: x.winnerHolderName + " captured the " + x.championshipName + ".",
    })))[0];
  const injury = matches.flatMap((slot) => slot.match.injuries.map((x) => ({
    slotOrder: slot.order, kind: "MATCH" as const, label: "THE BIGGEST FALLOUT",
    headline: x.personName + " leaves with an injury",
    detail: x.weeksOut + " PPW week" + (x.weeksOut === 1 ? "" : "s") + " out.",
  })))[0];
  const turn = angles.find((slot) =>
    slot.segment.type === "TURN" && slot.segment.turnTargetAlignment !== null);
  const turnMoment = turn ? {
    slotOrder: turn.order, kind: "SEGMENT" as const, label: "THE BIGGEST FALLOUT",
    headline: (turn.segment.participants.find((person) =>
      person.personId === turn.segment.turnPersonId)?.name
      ?? turn.segment.participants[0]?.name ?? "A wrestler") + " changes sides",
    detail: "An on-screen turn to " + turn.segment.turnTargetAlignment!.toLowerCase()
      + " gives the promotion a new story to tell.",
  } : null;
  const arrival = angles.find((slot) => slot.segment.type === "LIVE_APPEARANCE"
    && ["DEBUT", "RETURN", "SURPRISE_REVEAL"].includes(slot.segment.liveAppearanceKind ?? ""));
  const arrivalMoment = arrival ? {
    slotOrder: arrival.order, kind: "SEGMENT" as const, label: "THE BIGGEST FALLOUT",
    headline: (arrival.segment.participants[0]?.name ?? "A wrestler")
      + (arrival.segment.liveAppearanceKind === "RETURN" ? " returns" : " arrives"),
    detail: arrival.segment.liveAppearanceKind === "RETURN"
      ? "A live return gave the audience something to talk about."
      : arrival.segment.liveAppearanceKind === "DEBUT"
        ? "A live promotion debut is now in the books."
        : "A surprise appearance was revealed to the crowd.",
  } : null;
  const consequence: FinalBellMoment | null = title ?? injury ?? turnMoment ?? arrivalMoment ?? null;

  const crowd = Number.isFinite(show.crowdResponse) ? show.crowdResponse : 50;
  const average = Number.isFinite(show.averageMatchRating) ? show.averageMatchRating : 2.5;
  const lastWord = standout === null
    ? "No completed matches were recorded. What happened on the show is preserved above."
    : disappointment && consequence
      ? pick([
        "The highs mattered, the lows stung, and the fallout gives next week's show something to work with.",
        "Not every call worked, but the consequences are real. That's wrestling.",
      ], show.eventId, 90)
      : consequence
        ? "The bell has rung. The results are settled, but that fallout will travel."
        : disappointment
          ? "There's a standout to build around — and at least one decision to revisit."
          : crowd >= 76 && average >= 3.5
            ? "A strong night in the books. Enjoy it — the next card still needs booking."
            : "The final bell has sounded. The next show is another chance to win them over.";
  return { standout, disappointment, consequence, lastWord };
}


/** A complete-show copy desk. Individual fact-based recaps remain untouched;
 * repeated stock verdicts are rotated before readers encounter several copies
 * in one card. This does not feed back into the multiplayer World simulation.
 */
export interface RunningOrderReview {
  order: number;
  kind: "MATCH" | "SEGMENT";
  review: SlotReview;
}
function replacementVerdicts(
  kind: "MATCH" | "SEGMENT",
  tone: ReviewTone,
  type: string,
): readonly string[] {
  if (kind === "MATCH") {
    if (tone === "GREAT") return [
      "A fine advertisement for this promotion.", "That one belongs on the rewatch list.",
      "The work between the ropes deserved its flowers.", "A very good night to be a wrestling fan.",
      "The fans got a proper match for their money.",
    ];
    if (tone === "GOOD") return [
      "Worth the ticket price.", "They kept it lively without stealing the entire show.",
      "Good stuff, and a job well done.", "A bout the promoter can be happy with.",
      "No masterpiece, but plenty to like.",
    ];
    if (tone === "ROUGH") return [
      "Some nights the chemistry just isn't there.", "Not a match anyone will be demanding to see again.",
      "The bell couldn't come soon enough.", "A night they'll want to put behind them.",
      "The idea may need another outing — after some serious work.",
    ];
    return [
      "There was something here, even if it never fully came together.",
      "More workmanlike than memorable.", "A mixed bag, though not a total write-off.",
      "The audience got an uneven contest.", "This had its moments but left plenty on the table.",
    ];
  }
  // Avoid insulting a genuinely successful scripted moment or calling an
  // interview a 'match'. Promo and physical angles need different vocabulary.
  if (type === "PROMO" || type === "INTERVIEW") {
    if (tone === "GREAT") return [
      "A microphone segment with a pulse. The fans listened.",
      "The delivery struck a chord with the room.", "That's how you get a wrestling crowd engaged.",
      "A good night for talking people into the building next week.",
    ];
    if (tone === "ROUGH") return [
      "They lost the room on this one.", "That needed a stronger hook.",
      "The words never found their audience.", "The delivery didn't connect.",
    ];
  }
  if (type === "ATTACK" || type === "POST_MATCH_ASSAULT" || type === "RESCUE") {
    if (tone === "GREAT") return [
      "The trouble got the reaction it deserved.", "That made for a lively bit of wrestling theatre.",
      "A well-received piece of chaos.", "The crowd was all over that one.",
    ];
    if (tone === "ROUGH") return [
      "All that commotion for very little reward.", "The crowd response was much colder than the action.",
      "The physical angle never really clicked.", "Chaos is only fun when somebody cares.",
    ];
  }
  if (type === "VIDEO_PACKAGE" || type === "LIVE_APPEARANCE") {
    if (tone === "GREAT") return [
      "The presentation got the reaction it was after.", "A genuine spark from the audience.",
      "A memorable piece of showmanship.", "The build-up paid off with the crowd.",
    ];
    if (tone === "ROUGH") return [
      "The audience never truly bought the moment.", "That presentation needed more of a spark.",
      "The room barely stirred.", "Not quite the reaction the show was chasing.",
    ];
  }
  if (tone === "GREAT") return [
    "That one earned its applause.", "The crowd responded exactly as a promoter would hope.",
    "A well-received moment on the card.", "Plenty of life in that segment.",
  ];
  if (tone === "GOOD") return [
    "A nice little bit of business.", "The audience was on board.",
    "A positive step in the show's flow.", "That worked well enough for this crowd.",
  ];
  if (tone === "ROUGH") return [
    "The segment sank without a trace.", "A swing and a miss from the booking team.",
    "That wasn't the crowd reaction anyone wanted.", "This one missed the mark.",
  ];
  return [
    "A fairly quiet moment of the evening.", "It served its purpose without stealing the headlines.",
    "Fine, though hardly a show-stealer.", "It didn't move the needle much.",
  ];
}

export function reviewPlayerShowRunningOrder(
  show: Pick<PlayerShowResultView, "eventId" | "runningOrder">,
): RunningOrderReview[] {
  const recent: string[] = [];
  return show.runningOrder.map((slot) => {
    const type = slot.kind === "MATCH" ? slot.match.type : slot.segment.type;
    const id = slot.kind === "MATCH" ? slot.match.matchId : slot.segment.segmentId;
    const baseline = slot.kind === "MATCH"
      ? reviewPlayerMatch(slot.match)
      : reviewPlayerSegment(slot.segment);
    let result = baseline;
    if (recent.includes(baseline.verdict)) {
      // This pool is keyed to the actual *kind* and evaluated tone, not the
      // outcome of another unrelated segment. Fact-heavy verdicts are preserved.
      const isSpecificMatchOpinion = slot.kind === "MATCH" &&
        ((Number.isFinite(slot.match.crowdResponse) && slot.match.crowdResponse < 46
          && slot.match.criticalRatingStars >= 3.5)
        || (Number.isFinite(slot.match.crowdResponse) && slot.match.crowdResponse >= 78
          && slot.match.criticalRatingStars < 2.5)
        || slot.match.styleResult?.delivery === "MISSED");
      const noRecordedAngleReaction = slot.kind === "SEGMENT"
        && slot.segment.outcomeBand === null && slot.segment.crowdResponse === null;
      if (!isSpecificMatchOpinion && !noRecordedAngleReaction) {
        const alternatives = replacementVerdicts(slot.kind, baseline.tone, type);
        const choiceStart = Math.abs((id + ":" + show.eventId).split("").reduce(
          (total, letter) => (Math.imul(total, 33) ^ letter.charCodeAt(0)) | 0, 5381,
        )) % alternatives.length;
        for (let attempt = 0; attempt < alternatives.length; attempt += 1) {
          const candidate = alternatives[(choiceStart + attempt) % alternatives.length]!;
          if (!recent.includes(candidate)) {
            result = { ...baseline, verdict: candidate };
            break;
          }
        }
      }
    }
    recent.push(result.verdict);
    if (recent.length > 4) recent.shift();
    return { order: slot.order, kind: slot.kind, review: result };
  });
}
