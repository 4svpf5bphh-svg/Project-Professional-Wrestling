import { NextRequest, NextResponse } from "next/server";

/**
 * Temporary single-player Alpha access gate.
 * This is NOT the eventual multiplayer authentication system.
 * Do not enable until PPW_ALPHA_ACCESS_PASSWORD is configured in Vercel.
 */
export function middleware(request: NextRequest): NextResponse {
  const password = process.env.PPW_ALPHA_ACCESS_PASSWORD;
  if (!password || password.length < 16) {
    return new NextResponse("Alpha access is not configured", { status: 503 });
  }

  const supplied = request.headers.get("authorization");
  const expected = "Basic " + btoa("ppw:" + password);
  if (supplied !== expected) {
    return new NextResponse("Authentication required", {
      status: 401,
      headers: {
        "WWW-Authenticate": 'Basic realm="PPW Alpha", charset="UTF-8"',
        "Cache-Control": "no-store",
      },
    });
  }
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!api/internal/|_next/static/|_next/image/|favicon.ico).*)",
  ],
};
