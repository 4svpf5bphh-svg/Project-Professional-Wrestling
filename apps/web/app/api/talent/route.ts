import { NextResponse } from "next/server";
import {
  loadAlphaTalentSession,
  setAlphaRosterAlignment,
  submitAlphaTalentOffer,
  type AlphaRosterAlignmentRequest,
  type AlphaTalentOfferRequest,
} from "../../../../../dist/packages/web-adapter/src/talent-service.js";
import { withAlphaServerContext } from "../../../../../dist/packages/web-adapter/src/server-world.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function playerFacingOfferError(message: string): string {
  if (message === "service capacity exceeded") {
    return "This wrestler already has too many contracted dates across overlapping deals to accept these terms. Try fewer purchased dates, a longer term, or wait for existing commitments to expire.";
  }
  if (message === "date entitlement exceeds the contract term's service-capacity guardrail") {
    return "This offer asks for too many dates within the selected contract term. Reduce the purchased dates or choose a longer term.";
  }
  if (message === "existing exclusive contract blocks outside work") {
    return "This wrestler is already under an exclusive contract during the proposed period and cannot accept outside work.";
  }
  if (message === "exclusive offer overlaps another signed contract") {
    return "An exclusive offer cannot overlap this wrestler's existing signed contract. Wait until that commitment ends or offer non-exclusive terms where available.";
  }
  return message;
}

export async function GET(): Promise<NextResponse> {
  try {
    const view = await withAlphaServerContext(({ repository, worldId, playerId }) => (
      loadAlphaTalentSession(repository, worldId, playerId)
    ));
    return NextResponse.json(view, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load PPW talent management";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const body = await request.json() as AlphaTalentOfferRequest;
    const result = await withAlphaServerContext(({ repository, worldId, playerId }) => (
      submitAlphaTalentOffer(repository, worldId, playerId, body)
    ));
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const rawMessage = error instanceof Error ? error.message : "Unable to submit PPW contract offer";
    return NextResponse.json({ error: playerFacingOfferError(rawMessage) }, { status: 400 });
  }
}

export async function PATCH(request: Request): Promise<NextResponse> {
  try {
    const body = await request.json() as AlphaRosterAlignmentRequest;
    const result = await withAlphaServerContext(({ repository, worldId, playerId }) => (
      setAlphaRosterAlignment(repository, worldId, playerId, body)
    ));
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to update wrestler alignment";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
