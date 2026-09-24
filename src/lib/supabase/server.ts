import { supabaseConfig } from "@/lib/supabase/config";
import "server-only";

import { cookies } from "next/headers";

import { createServerClient } from "@supabase/ssr";

import { sessionCookieOptions } from "./cookie-policy";

export async function createClient() {
  const store = await cookies();
  return createServerClient(supabaseConfig().url, supabaseConfig().key, {
    cookies: {
      getAll: () => store.getAll(),
      setAll(values) {
        try {
          for (const { name, value, options } of values)
            store.set(name, value, sessionCookieOptions(options, store.get("atcis_remember")?.value === "1"));
        } catch {
          // Server Components cannot set cookies; proxy refreshes them.
        }
      },
    },
  });
}

export async function requireUser() {
  const client = await createClient();
  const {
    data: { user },
    error,
  } = await client.auth.getUser();
  if (error || !user) throw new Error("Authentication required");
  const { data: profile, error: profileError } = await client
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .eq("active", true)
    .single();
  if (profileError || !profile) throw new Error("An active ATCIS profile is required");
  return { client, user, profile };
}
