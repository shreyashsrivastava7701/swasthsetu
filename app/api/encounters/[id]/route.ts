// GET /api/encounters/[id]: one note with its reports and referral (if any).
import { supabase } from "@/lib/supabase";
import { getMe, caseAccess, notAllowed } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!(await caseAccess(await getMe(), id))) return notAllowed();
  const { data: encounter, error } = await supabase.from("encounters").select("*").eq("id", id).single();
  if (error || !encounter) return Response.json({ error: "Case not found." }, { status: 404 });

  const { data: reports } = await supabase
    .from("reports")
    .select("*")
    .eq("encounter_id", id)
    .order("created_at");
  const { data: referral } = await supabase
    .from("referrals")
    .select("*, facilities(name)")
    .eq("encounter_id", id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return Response.json({ encounter, reports: reports ?? [], referral });
}

// DELETE /api/encounters/[id]: remove a case. Its reports and referral are
// removed with it (the database does this automatically).
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!(await caseAccess(await getMe(), id))?.owner) return notAllowed();
  const { error } = await supabase.from("encounters").delete().eq("id", id);
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ ok: true });
}
