import { NextResponse, type NextRequest } from "next/server";

import { hasSupabase } from "@/lib/env";
import { checkRateLimit, RATE_LIMITS } from "@/lib/server/rate-limit";

function getClientIp(request: NextRequest): string {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    ?? request.headers.get("x-real-ip")
    ?? "unknown";
}

export async function middleware(request: NextRequest) {
  if (!hasSupabase()) {
    return NextResponse.next();
  }

  // Rate limiting for sensitive endpoints
  const { pathname } = request.nextUrl;
  for (const { pattern, limit, windowMs } of RATE_LIMITS) {
    if (pattern.test(pathname)) {
      const ip = getClientIp(request);
      const result = checkRateLimit(ip, limit, windowMs);
      if (!result.allowed) {
        return new NextResponse("Too Many Requests", {
          status: 429,
          headers: {
            "Retry-After": String(Math.ceil((result.resetAt - Date.now()) / 1000)),
          },
        });
      }
      break;
    }
  }

  return NextResponse.next({ request });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
