// The database client for the SERVER only (API routes and pages).
// It uses the secret key, so it must never be imported by a "use client" file.
// The tables are locked (row-level security), so only this client can use them.
// The URL and key come from .env.local (and Vercel's Environment Variables).
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SECRET_KEY;

if (!url || !key) {
  throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SECRET_KEY. Check .env.local.");
}

export const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
