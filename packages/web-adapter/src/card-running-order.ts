import type { AlphaCardSegmentView, AlphaCardSlotView } from "./card-service.js";

/** Keep a post-match assault with the match it follows when the running order changes. */
export function runningOrderBlocks(
  order: readonly AlphaCardSlotView[],
  segments: readonly Pick<AlphaCardSegmentView, "draftSegmentId" | "type" | "sourceDraftMatchId">[],
): AlphaCardSlotView[][] {
  const assaults = new Map(segments.filter((segment) => segment.type === "POST_MATCH_ASSAULT")
    .map((segment) => [segment.draftSegmentId, segment.sourceDraftMatchId] as const));
  const blocks: AlphaCardSlotView[][] = [];
  for (let i = 0; i < order.length; i += 1) {
    const current = order[i]!;
    const following = order[i + 1];
    if (current.kind === "MATCH"
      && following?.kind === "SEGMENT"
      && assaults.get(following.refId) === current.refId) {
      blocks.push([current, following]);
      i += 1;
    } else {
      blocks.push([current]);
    }
  }
  return blocks;
}

export function moveRunningOrderSlot(
  order: readonly AlphaCardSlotView[],
  segments: readonly Pick<AlphaCardSegmentView, "draftSegmentId" | "type" | "sourceDraftMatchId">[],
  index: number,
  direction: -1 | 1,
): AlphaCardSlotView[] | null {
  if (index < 0 || index >= order.length) return null;
  const blocks = runningOrderBlocks(order, segments);
  const source = blocks.findIndex((block) => block.some((slot) => slot === order[index]
    || (slot.kind === order[index]!.kind && slot.refId === order[index]!.refId)));
  const destination = source + direction;
  if (source < 0 || destination < 0 || destination >= blocks.length) return null;
  const next = [...blocks];
  [next[source], next[destination]] = [next[destination]!, next[source]!];
  return next.flat();
}

export function canMoveRunningOrderSlot(
  order: readonly AlphaCardSlotView[],
  segments: readonly Pick<AlphaCardSegmentView, "draftSegmentId" | "type" | "sourceDraftMatchId">[],
  index: number,
  direction: -1 | 1,
): boolean {
  if (index < 0 || index >= order.length) return false;
  const blocks = runningOrderBlocks(order, segments);
  const source = blocks.findIndex((block) => block.some((slot) => slot.kind === order[index]!.kind && slot.refId === order[index]!.refId));
  return source >= 0 && source + direction >= 0 && source + direction < blocks.length;
}
