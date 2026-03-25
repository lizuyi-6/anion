"use client";

import { createBrowserClient } from "@supabase/ssr";

export function createMobiusBrowserClient(url: string, anonKey: string) {
  return createBrowserClient(url, anonKey);
}
