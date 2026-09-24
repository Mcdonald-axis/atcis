export function supabaseConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error("Supabase URL and publishable key must be configured");
  if (key.startsWith("sbp_") || key.startsWith("sb_secret_")) {
    throw new Error("Use a Supabase project publishable key, not an account token or secret key");
  }
  return { url, key };
}
