// POST /api/encounters/[id]/confirm-patient: the patient said the read-back is correct.
import { supabase } from "@/lib/supabase";
import { getMe, caseAccess, notAllowed } from "@/lib/auth";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!(await caseAccess(await getMe(), id))?.owner) return notAllowed();
  const { error } = await supabase
    .from("encounters")
    .update({ status: "patient_confirmed" })
    .eq("id", id)
    .eq("status", "draft"); // never move a referred case backwards
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ ok: true });
}
