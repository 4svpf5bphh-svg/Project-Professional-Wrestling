import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";

/**
 * Temporary single-player Alpha perimeter, NOT multiplayer identity.
 * Fail closed if a strong password is not configured.
 * Protects all player-facing routes, including mutation APIs.
 */
export function middleware(request: NextRequest): NextResponse {
  const password = process.env.PPW_ALPHA_ACCESS_PASSWORD;
  if (!password || password.length < 16) {
    return new NextResponse("Alpha access is not configured", { status: 503 });
  }

  const authorization = request.headers.get("authorization") ?? "";
  let suppliedPassword = "";
  try {
    if (authorization.startsWith("Basic ")) {
      const decoded = atob(authorization.slice(6));
      const separator = decoded.indexOf(":");
      if (separator !== -1 && decoded.slice(0, separator) === "ppw") {
        suppliedPassword = decoded.slice(separator + 1);
      }
    }
  } catch {
    // Invalid Basic authorization is unauthenticated.
  }

  const actual = Buffer.from(suppliedPassword, "utf8");
  const expected = Buffer.from(password, "utf8");
  const authorized = actual.length === expected.length && timingSafeEqual(actual, expected);
  if (!authorized) {
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
  matcher: ["/((?!api/internal/|_next/static/|_next/image/|favicon.ico).*)"],
};
