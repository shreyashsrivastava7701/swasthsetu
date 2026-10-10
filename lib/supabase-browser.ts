// The client used in the browser, ONLY for logging in and out.
// It has the public key, which can read no tables (they are locked).
import { createClient } from "@supabase/supabase-js";

export const supabaseBrowser = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ""
);

export const TOKEN_COOKIE = "ss-token";

// Keep a copy of the login token in a cookie, so the server knows who is asking.
export function saveToken(token: string | null) {
  document.cookie = token
    ? `${TOKEN_COOKIE}=${token}; path=/; max-age=604800; samesite=lax`
    : `${TOKEN_COOKIE}=; path=/; max-age=0; samesite=lax`;
}

// Patients log in with a phone number. Behind the scenes it becomes an email
// address, because that is what Supabase logins use.
export function phoneToEmail(phone: string): string {
  const digits = phone.replace(/\D/g, "").slice(-10);
  return `${digits}@patient.swasthsetu.app`;
}
