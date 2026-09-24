import { createBrowserClient, parseCookieHeader, serializeCookieHeader } from "@supabase/ssr";

import { supabaseConfig } from "@/lib/supabase/config";

import { sessionCookieOptions } from "./cookie-policy";

let client: ReturnType<typeof createBrowserClient> | undefined;

export function createClient() {
  client ??= createBrowserClient(supabaseConfig().url, supabaseConfig().key, {
    cookies: {
      getAll: () => parseCookieHeader(document.cookie),
      setAll(values) {
        const remember = parseCookieHeader(document.cookie).some(
          (cookie) => cookie.name === "atcis_remember" && cookie.value === "1",
        );
        for (const { name, value, options } of values) {
          document.cookie = serializeCookieHeader(name, value, sessionCookieOptions(options, remember));
        }
      },
    },
  });
  return client;
}
