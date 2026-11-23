/** Supabase settings from `.env`. Only the public anon key is used in request code. */
export function supabaseConfig() {
  const url = process.env.SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error("SUPABASE_URL and SUPABASE_ANON_KEY must be set. See .env.example.");
  }
  return { url, anonKey };
}
