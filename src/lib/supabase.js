import { createClient } from "@supabase/supabase-js";

/**
 * Vite exposes ONLY vars that start with VITE_ to the browser build.
 * So set these in Vercel as:
 *  - VITE_SUPABASE_URL
 *  - VITE_SUPABASE_ANON_KEY
 */
export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);
