// POST /api/encounters: create a new patient note from the intake form.
// GET  /api/encounters: recent notes for the case list.
import { supabase } from "@/lib/supabase";
import { runAiJson, errorText } from "@/lib/ai";
import { STRUCTURE_SYSTEM, structureUser } from "@/lib/prompts";
import { NoteSchema, type Note } from "@/lib/schemas";
import { assess, templateNote } from "@/lib/encounter";
import { BLOCKS } from "@/lib/blocks";
import { getMe, notAllowed } from "@/lib/auth";
import type { FormData, Vitals } from "@/lib/form";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const me = await getMe();
  if (me?.role !== "patient") return notAllowed();
  const body = await request.json();
  const language: string = body.language === "hi" ? "hi" : "en";
  const block: string = body.block;
  const ageYears: number | null = body.age_years ?? null;
  const ageMonths: number | null = body.age_months ?? null;
  const sex: string | null = body.sex ?? null;
  const vitals: Vitals = body.vitals ?? {};
  const form: FormData = body.form;
  const rawText: string = String(body.raw_text ?? "").trim();

  // Required: age, sex, block, and at least one symptom or some free text.
  if (!BLOCKS.some((b) => b.name === block)) return Response.json({ error: "Choose a block." }, { status: 400 });
  if (ageYears === null || !sex) return Response.json({ error: "Age and sex are required." }, { status: 400 });
  if (!rawText && !form?.symptoms?.length) {
    return Response.json({ error: "Tap at least one symptom or type what the patient said." }, { status: 400 });
  }

  // 1. Ask the AI for the structured note. If it fails, build a plain note in code.
  let note: Note;
  let aiOk = true;
  let aiError: string | null = null;
  try {
    const result = await runAiJson(NoteSchema, {
      system: STRUCTURE_SYSTEM,
      prompt: structureUser({ language, age: ageYears, sex, vitals, form, text: rawText }),
      provider: body.provider,
    });
    note = result.data;
  } catch (err) {
    aiOk = false;
    aiError = errorText(err);
    note = templateNote({ form, vitals, rawText, language });
  }

  // 2. Rules, urgency, needed capabilities, syndrome.
  const a = assess({
    history: note.history,
    form,
    vitals,
    ageYears,
    ageMonths,
    aiUrgency: aiOk ? note.suggested_urgency : null,
    aiCapabilities: note.suggested_capabilities,
  });

  // 3. Save. Only a made-up alias is stored, never a name.
  const alias = `Patient A-${Math.floor(1000 + Math.random() * 9000)}`;
  const { data, error } = await supabase
    .from("encounters")
    .insert({
      owner_id: me.id,
      alias,
      // Name and phone stay on this record only. They are never sent to the AI
      // and never shown on the district dashboard.
      patient_name: String(body.patient_name ?? "").trim() || null,
      patient_phone: String(body.patient_phone ?? "").trim() || null,
      language,
      block,
      age: ageYears,
      sex,
      vitals,
      raw_text: rawText,
      history: note.history,
      soap: { ...note.soap, ai_ok: aiOk, ai_error: aiError, urgency_reason: note.urgency_reason, readback_english: note.readback_english },
      readback_text: note.readback_text,
      rule_flags: a.flags,
      ai_urgency: aiOk ? note.suggested_urgency : null,
      urgency: a.urgency,
      needed_capabilities: a.capabilities,
      syndrome: a.syndrome,
      status: "draft",
      form_data: { ...form, age_months: ageMonths },
      entered_by: form?.entered_by ?? null,
      weight_kg: form?.weight_kg ?? null,
    })
    .select("id")
    .single();

  if (error) return Response.json({ error: `Could not save: ${error.message}` }, { status: 500 });
  return Response.json({ id: data.id, ai_ok: aiOk });
}

export async function GET() {
  const me = await getMe();
  if (me?.role !== "patient") return notAllowed();
  const { data, error } = await supabase
    .from("encounters")
    .select("id, created_at, alias, block, age, sex, urgency, status")
    .eq("owner_id", me.id)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ encounters: data });
}
