import { createClient } from "@supabase/supabase-js";

// Try Vite-style env vars first (for local dev), then fall back to Vercel env vars
export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY
);
