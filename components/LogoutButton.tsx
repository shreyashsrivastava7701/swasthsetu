"use client";
// Log out and go back to the home page.
import { useRouter } from "next/navigation";
import { supabaseBrowser, saveToken } from "@/lib/supabase-browser";

export default function LogoutButton() {
  const router = useRouter();
  async function logout() {
    await supabaseBrowser.auth.signOut();
    saveToken(null);
    router.push("/");
    router.refresh();
  }
  return (
    <button type="button" onClick={logout} className="text-sm text-blue-100 hover:text-white hover:underline">
      Log out / लॉग आउट
    </button>
  );
}
