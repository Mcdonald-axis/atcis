import "server-only";

import { createClient } from "@supabase/supabase-js";

import { supabaseConfig } from "@/lib/supabase/config";

export function createAdminClient() {
  const secret = process.env.SUPABASE_SECRET_KEY;
  if (!secret) throw new Error("SUPABASE_SECRET_KEY is not configured");
  if (secret.startsWith("sbp_")) {
    throw new Error(
      "SUPABASE_SECRET_KEY cannot be a personal access token ('sbp_...'). Use your project service_role secret key from Supabase Dashboard > Project Settings > API.",
    );
  }
  return createClient(supabaseConfig().url, secret, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
