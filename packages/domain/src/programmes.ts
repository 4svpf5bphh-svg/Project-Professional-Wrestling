import type { Id, PpwDate } from "./types.js";

export type ProgrammeStatus = "ACTIVE" | "ENDED";
export type ProgrammeParticipantKind = "PERSON" | "TEAM";
export type ProgrammeSide = "A" | "B";
export type ProgrammeActivityKind = "MATCH" | "SEGMENT" | "INTERFERENCE" | "BETRAYAL" | "TITLE_CHANGE" | "OTHER";

export interface ProgrammeParticipantRef {
  kind: ProgrammeParticipantKind;
  entityId: Id;
}

export interface Programme {
  id: Id;
  worldId: Id;
  promotionId: Id;
  status: ProgrammeStatus;
  sideA: ProgrammeParticipantRef[];
  sideB: ProgrammeParticipantRef[];
  championshipId: Id | null;
  startedDate: PpwDate;
  endedDate: PpwDate | null;
  heat: number | null;
  repetition: number;
  activityCount: number;
  matchCount: number;
  segmentCount: number;
  sideAWins: number;
  sideBWins: number;
  draws: number;
  lastActivityDate: PpwDate | null;
}

export interface ProgrammeActivity {
  id: Id;
  worldId: Id;
  promotionId: Id;
  programmeId: Id;
  date: PpwDate;
  kind: ProgrammeActivityKind;
  participantEntityIds: Id[];
  eventId: Id | null;
  matchId: Id | null;
  winnerSide: ProgrammeSide | null;
}
