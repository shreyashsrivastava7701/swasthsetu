// PATCH /api/referrals/[id]: the hospital updates a patient's status.
// Body: { status: "seen" } (summary read) or { status: "arrived" } (patient came).
import { supabase } from "@/lib/supabase";
import { getMe, notAllowed } from "@/lib/auth";

const ALLOWED = ["seen", "arrived"];

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const me = await getMe();
  if (me?.role !== "hospital" || !me.facility_id) return notAllowed();
  const body = await request.json().catch(() => ({}));
  const status = ALLOWED.includes(body.status) ? body.status : "seen";
  const { error } = await supabase.from("referrals").update({ status }).eq("id", id).eq("facility_id", me.facility_id);
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ ok: true });
}
