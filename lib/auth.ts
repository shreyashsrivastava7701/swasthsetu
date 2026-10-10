// Who is asking? Reads the login token (cookie or Authorization header),
// checks it with Supabase, and loads the person's profile.
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { supabase } from "@/lib/supabase";

export type Me = {
  id: string;
  role: "patient" | "hospital";
  name: string;
  phone: string | null;
  facility_id: string | null;
};

// The logged-in user's id, or null. (Account exists, profile may not yet.)
export async function getUserId(request?: Request): Promise<string | null> {
  const header = request?.headers.get("authorization");
  const token = header?.startsWith("Bearer ") ? header.slice(7) : (await cookies()).get("ss-token")?.value;
  if (!token) return null;
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) return null;
  return data.user.id;
}

export async function getMe(request?: Request): Promise<Me | null> {
  const id = await getUserId(request);
  if (!id) return null;
  const { data } = await supabase.from("profiles").select("id, role, name, phone, facility_id").eq("id", id).single();
  return (data as Me) ?? null;
}

// For pages: send people who are not logged in (or have the wrong role) to a login page.
export async function requireMe(role?: Me["role"]): Promise<Me> {
  const me = await getMe();
  if (!me || (role && me.role !== role)) redirect(role === "hospital" ? "/login/hospital" : "/login/patient");
  return me;
}

export const notAllowed = () => Response.json({ error: "Please log in with the right account." }, { status: 401 });

// May this person open this case?
//  - the patient who made it: yes, and may change it (owner = true)
//  - a hospital the case was sent to: yes, read only
export async function caseAccess(me: Me | null, encounterId: string): Promise<{ owner: boolean } | null> {
  if (!me) return null;
  const { data: e } = await supabase.from("encounters").select("owner_id").eq("id", encounterId).single();
  if (!e) return null;
  if (me.role === "patient") return e.owner_id === me.id ? { owner: true } : null;
  if (!me.facility_id) return null;
  const { data: r } = await supabase
    .from("referrals")
    .select("id")
    .eq("encounter_id", encounterId)
    .eq("facility_id", me.facility_id)
    .limit(1);
  return r?.length ? { owner: false } : null;
}
