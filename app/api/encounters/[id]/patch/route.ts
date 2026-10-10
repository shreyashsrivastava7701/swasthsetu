// POST /api/encounters/[id]/patch: the patient said the read-back was wrong.
// The AI applies only their correction, then the rules run again.
import { supabase } from "@/lib/supabase";
import { getMe, caseAccess, notAllowed } from "@/lib/auth";
import { runAiJson, errorText } from "@/lib/ai";
import { PATCH_SYSTEM, patchUser } from "@/lib/prompts";
import { NoteSchema, type History } from "@/lib/schemas";
import { assess } from "@/lib/encounter";
import type { FormData, Vitals } from "@/lib/form";

export const maxDuration = 60;

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!(await caseAccess(await getMe(), id))?.owner) return notAllowed();
  const body = await request.json();
  const correction = String(body.text ?? "").trim();
  if (!correction) return Response.json({ error: "Say or type what is wrong." }, { status: 400 });

  const { data: e } = await supabase.from("encounters").select("*").eq("id", id).single();
  if (!e) return Response.json({ error: "Case not found." }, { status: 404 });

  // 1. Ask the AI to apply only the correction.
  let note;
  try {
    const result = await runAiJson(NoteSchema, {
      system: PATCH_SYSTEM,
      prompt: patchUser({ language: e.language, history: e.history as History, text: correction }),
      provider: body.provider,
    });
    note = result.data;
  } catch (err) {
    return Response.json({ error: `The AI could not apply the correction. ${errorText(err)}` }, { status: 502 });
  }

  // 2. Run the rules again on the corrected history.
  const form = e.form_data as FormData & { age_months?: number | null };
  const a = assess({
    history: note.history,
    form,
    vitals: e.vitals as Vitals,
    ageYears: e.age,
    ageMonths: form.age_months ?? null,
    aiUrgency: note.suggested_urgency,
    aiCapabilities: note.suggested_capabilities,
  });

  // 3. Save. Keep a log of every correction and what changed.
  const oldSoap = e.soap as Record<string, unknown>;
  const corrections = [...((oldSoap.corrections as unknown[]) ?? []), { text: correction, changes: note.changes }];
  const update = {
    history: note.history,
    soap: { ...note.soap, ai_ok: true, ai_error: null, urgency_reason: note.urgency_reason, readback_english: note.readback_english, corrections },
    readback_text: note.readback_text,
    teachback_rounds: (e.teachback_rounds ?? 0) + 1,
    rule_flags: a.flags,
    ai_urgency: note.suggested_urgency,
    // If a clinician already overrode urgency, keep their choice.
    urgency: e.urgency_overridden ? e.urgency : a.urgency,
    needed_capabilities: a.capabilities,
    syndrome: a.syndrome,
    status: "draft", // the patient must confirm again
  };
  const { error } = await supabase.from("encounters").update(update).eq("id", id);
  if (error) return Response.json({ error: `Could not save: ${error.message}` }, { status: 500 });

  return Response.json({ changes: note.changes, readback_text: note.readback_text, readback_english: note.readback_english, urgency: update.urgency });
}
