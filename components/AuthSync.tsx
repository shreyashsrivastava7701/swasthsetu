"use client";
// Keeps the login cookie fresh. Supabase renews the login token about every
// hour; this copies the new token into the cookie the server reads.
import { useEffect } from "react";
import { supabaseBrowser, saveToken } from "@/lib/supabase-browser";

export default function AuthSync() {
  useEffect(() => {
    supabaseBrowser.auth.getSession().then(({ data }) => {
      if (data.session) saveToken(data.session.access_token);
    });
    const { data } = supabaseBrowser.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT") saveToken(null);
      else if (session) saveToken(session.access_token);
    });
    return () => data.subscription.unsubscribe();
  }, []);
  return null;
}
