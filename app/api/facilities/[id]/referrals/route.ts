// GET /api/facilities/[id]/referrals: patients booked at this hospital.
// Only the hospital's own account may read it.
import { supabase } from "@/lib/supabase";
import { getMe, notAllowed } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const me = await getMe();
  if (me?.role !== "hospital" || me.facility_id !== id) return notAllowed();
  const [{ data, error }, { data: f }] = await Promise.all([
    supabase
      .from("referrals")
      .select("id, created_at, status, packet, visit_at")
      .eq("facility_id", id)
      .order("created_at", { ascending: false })
      .limit(200),
    supabase.from("facilities").select("doctor_today").eq("id", id).single(),
  ]);
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ referrals: data, doctor_today: f?.doctor_today ?? true });
}

// PATCH /api/facilities/[id]/referrals { doctor_today }: the hospital says whether
// a doctor is available today. Hospitals without a doctor are not suggested.
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const me = await getMe();
  if (me?.role !== "hospital" || me.facility_id !== id) return notAllowed();
  const body = await request.json();
  const { error } = await supabase.from("facilities").update({ doctor_today: Boolean(body.doctor_today) }).eq("id", id);
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ ok: true });
}
