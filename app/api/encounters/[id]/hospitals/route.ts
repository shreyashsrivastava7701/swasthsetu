// GET /api/encounters/[id]/hospitals: hospital suggestions for this case.
//   ?quick=1   instant list with no AI (needs and distance), shown first.
//   (nothing)  the full list checked with Google. Saved on the case, so
//              opening the tab again is instant.
//   ?refresh=1 ask Google again.
// Always answers with JSON, even if something fails.
import { supabase } from "@/lib/supabase";
import { getMe, caseAccess, notAllowed } from "@/lib/auth";
import { loadCase, buildPacket } from "@/lib/packet";
import { suggestHospitals, quickSuggestions, type CaseInfo } from "@/lib/hospitals";
import { errorText } from "@/lib/ai";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    if (!(await caseAccess(await getMe(), id))?.owner) return notAllowed();

    const { e, reports, facilities } = await loadCase(id);
    if (!e) return Response.json({ error: "Case not found." }, { status: 404 });
    const soap = (e.soap ?? {}) as Record<string, unknown>;
    const url = new URL(request.url);
    const refresh = url.searchParams.get("refresh") === "1";
    if (soap.hospital_suggestions && !refresh) return Response.json({ ...soap.hospital_suggestions, final: true });

    // What this case needs (from the rules), without any name or phone.
    const p = buildPacket(e, reports, facilities, null, null);
    const info: CaseInfo = {
      age: e.age,
      sex: e.sex,
      block: e.block,
      complaint: p.history.chief_complaint || p.history.english_text || "not stated",
      urgency: p.urgency,
      needed: p.needed_capabilities,
    };
    const open = facilities.filter((f) => f.doctor_today);

    if (url.searchParams.get("quick") === "1") return Response.json({ ...quickSuggestions(info, open), final: false });

    let suggestions;
    try {
      suggestions = await suggestHospitals(info, open);
    } catch (err) {
      console.log(`[hospitals] ${errorText(err)}`);
      suggestions = quickSuggestions(info, open);
    }
    // Save only answers Google helped with; the quick list is cheap to rebuild.
    const fromGoogle = suggestions.mode === "google" || (suggestions.mode === "registered" && suggestions.source === "google");
    if (fromGoogle) {
      await supabase.from("encounters").update({ soap: { ...soap, hospital_suggestions: suggestions } }).eq("id", id);
    }
    return Response.json({ ...suggestions, final: true });
  } catch (err) {
    console.log(`[hospitals] route failed: ${errorText(err)}`);
    return Response.json({ error: "Could not load hospitals. Try again." }, { status: 500 });
  }
}
