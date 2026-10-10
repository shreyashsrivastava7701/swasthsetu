// GET /api/encounters/[id]/hospitals: hospital suggestions for this case.
// The answer is saved on the case, so opening the tab again is instant.
// Add ?refresh=1 to search again.
import { supabase } from "@/lib/supabase";
import { getMe, caseAccess, notAllowed } from "@/lib/auth";
import { loadCase, buildPacket } from "@/lib/packet";
import { suggestHospitals } from "@/lib/hospitals";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!(await caseAccess(await getMe(), id))?.owner) return notAllowed();

  const { e, reports, facilities } = await loadCase(id);
  if (!e) return Response.json({ error: "Case not found." }, { status: 404 });
  const soap = e.soap as Record<string, unknown>;
  const refresh = new URL(request.url).searchParams.get("refresh") === "1";
  if (soap.hospital_suggestions && !refresh) return Response.json(soap.hospital_suggestions);

  // What this case needs (from the rules), without any name or phone.
  const p = buildPacket(e, reports, facilities, null, null);
  const suggestions = await suggestHospitals(
    {
      age: e.age,
      sex: e.sex,
      block: e.block,
      complaint: p.history.chief_complaint || p.history.english_text || "not stated",
      urgency: p.urgency,
      needed: p.needed_capabilities,
    },
    facilities.filter((f) => f.doctor_today)
  );

  await supabase.from("encounters").update({ soap: { ...soap, hospital_suggestions: suggestions } }).eq("id", id);
  return Response.json(suggestions);
}
