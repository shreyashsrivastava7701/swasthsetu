// POST /api/encounters/[id]/report
//  - { action: "read", kind: "lab" | "xray", image } : the AI reads the photo. Nothing is saved.
//  - { action: "save", kind, data }                 : saves the (possibly edited) result to the case.
// The photo itself is never stored.
import { supabase } from "@/lib/supabase";
import { getMe, caseAccess, notAllowed } from "@/lib/auth";
import { runAiJson, errorText } from "@/lib/ai";
import { LAB_SYSTEM, XRAY_SYSTEM } from "@/lib/prompts";
import { LabSchema, XraySchema } from "@/lib/schemas";
import { withFlags, hasOutOfRange } from "@/lib/labs";

export const maxDuration = 60;

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!(await caseAccess(await getMe(), id))?.owner) return notAllowed();
  const body = await request.json();
  const kind = body.kind === "xray" ? "xray" : "lab";

  if (body.action === "read") {
    // One or more photos or PDFs. They are read together as one report.
    const images: { mimeType: string; base64: string }[] = (body.images ?? (body.image ? [body.image] : [])).slice(0, 5);
    if (images.length === 0) return Response.json({ error: "Add a photo or PDF first." }, { status: 400 });
    // Gemma reads text and images only, so PDFs always go to Gemini.
    const provider = images.some((f) => f.mimeType === "application/pdf") ? "gemini" : body.provider;
    const many =
      images.length > 1
        ? ` There are ${images.length} files or pages. Combine every test row from all of them into one list.`
        : "";
    try {
      if (kind === "lab") {
        const { data } = await runAiJson(LabSchema, {
          system: LAB_SYSTEM,
          prompt: `Read this laboratory report.${many}`,
          images,
          provider,
        });
        return Response.json({ data: { ...data, rows: withFlags(data.rows) } });
      }
      const { data } = await runAiJson(XraySchema, {
        system: XRAY_SYSTEM,
        prompt: `Describe this X-ray photo.${many}`,
        images,
        provider,
      });
      return Response.json({ data: { ...data, needs_radiologist_review: true } });
    } catch (err) {
      return Response.json({ error: `The AI could not read this photo. ${errorText(err)}` }, { status: 502 });
    }
  }

  // Save: check the data again (flags recomputed in code), store, update needs.
  let data;
  if (kind === "lab") {
    const lab = LabSchema.parse(body.data);
    data = { ...lab, rows: withFlags(lab.rows.filter((r) => r.test.trim() || r.value.trim())) };
  } else {
    data = { ...XraySchema.parse(body.data), needs_radiologist_review: true };
  }

  const { error } = await supabase.from("reports").insert({ encounter_id: id, kind, data });
  if (error) return Response.json({ error: `Could not save: ${error.message}` }, { status: 500 });

  // An out-of-range lab value means the next facility needs a blood-test lab.
  if (kind === "lab" && "rows" in data && hasOutOfRange(data.rows)) {
    const { data: e } = await supabase.from("encounters").select("needed_capabilities").eq("id", id).single();
    const caps: string[] = e?.needed_capabilities ?? [];
    if (!caps.includes("lab_blood")) {
      await supabase.from("encounters").update({ needed_capabilities: [...caps, "lab_blood"] }).eq("id", id);
    }
  }
  return Response.json({ ok: true });
}
