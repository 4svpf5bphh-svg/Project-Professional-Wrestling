import { NextRequest, NextResponse } from "next/server";

/**
 * Temporary single-player Alpha perimeter. Not multiplayer authentication.
 * Web Crypto is supported by the Next.js Edge middleware runtime.
 */
async function digest(value: string): Promise<Uint8Array> {
  const bytes = new TextEncoder().encode(value);
  return new Uint8Array(await crypto.subtle.digest("SHA-256", bytes));
}

function equalDigest(a: Uint8Array, b: Uint8Array): boolean {
  let difference = a.length ^ b.length;
  for (let index = 0; index < Math.max(a.length, b.length); index++) {
    difference |= (a[index] ?? 0) ^ (b[index] ?? 0);
  }
  return difference === 0;
}

export async function middleware(request: NextRequest): Promise<NextResponse> {
  const password = process.env.PPW_ALPHA_ACCESS_PASSWORD;
  if (!password || password.length < 16) {
    return new NextResponse("Alpha access is not configured", {
      status: 503,
      headers: { "Cache-Control": "no-store" },
    });
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
    // Malformed Basic credentials are treated as unauthenticated.
  }

  const authorized = equalDigest(await digest(suppliedPassword), await digest(password));
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
