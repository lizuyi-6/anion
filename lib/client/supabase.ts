"use client";

import { createBrowserClient } from "@supabase/ssr";

/**
 * Browser-side Supabase client.
 *
 * Used only for flows that don't set session cookies client-side:
 * magic link (sends email), OAuth (redirects to provider), password reset (sends email).
 *
 * Password login and registration go through server API routes
 * (/api/auth/login, /api/auth/register) so that cookies are set
 * server-side with the correct name derived from SUPABASE_URL.
 */
export function createMobiusBrowserClient(url: string, anonKey: string) {
  return createBrowserClient(url, anonKey, {
    cookies: {
      getAll() {
        if (typeof document === "undefined") return [];
        return document.cookie.split("; ").map((pair) => {
          const [name, ...rest] = pair.split("=");
          return { name, value: rest.join("=") };
        });
      },
      setAll(cookiesToSet) {
        if (typeof document === "undefined") return;
        for (const { name, value, options } of cookiesToSet) {
          const parts = [`${name}=${value}`, `path=${options.path ?? "/"}`];
          if (options.maxAge) parts.push(`max-age=${options.maxAge}`);
          if (options.domain) parts.push(`domain=${options.domain}`);
          if (options.sameSite) parts.push(`samesite=${options.sameSite}`);
          if (options.secure) parts.push("secure");
          document.cookie = parts.join("; ");
        }
      },
    },
  });
}
