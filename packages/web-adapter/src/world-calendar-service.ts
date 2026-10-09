import {
  buildPlayerWorldCalendarView,
  type ApplicationWorldRepository,
  type PlayerWorldCalendarView,
} from "../../application/src/index.js";

export async function loadAlphaWorldCalendar(
  repository: ApplicationWorldRepository,
  worldId: string,
  playerId: string,
  weeks = 12,
): Promise<PlayerWorldCalendarView> {
  return buildPlayerWorldCalendarView(await repository.load(worldId), playerId, weeks);
}
