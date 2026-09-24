import type { CookieOptions } from "@supabase/ssr";

export function sessionCookieOptions(options: CookieOptions, remember: boolean): CookieOptions {
  if (options.maxAge === 0) return options;
  const { maxAge: _maxAge, expires: _expires, ...rest } = options;
  return remember ? { ...rest, maxAge: 60 * 60 * 24 * 7 } : rest;
}
