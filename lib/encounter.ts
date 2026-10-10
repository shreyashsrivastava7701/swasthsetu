// Shared logic for building and checking a patient note. Used when a note is
// created (step 2) and when the patient corrects it (step 3).
import { durationDays, type FormData, type Vitals } from "@/lib/form";
import { runRules, maxUrgency, neededCapabilities, type RuleFlag } from "@/lib/rules";
import { syndromeFor } from "@/lib/syndrome";
import type { History, Note, Urgency } from "@/lib/schemas";

// Vitals as one readable line, e.g. "Temp 38.9 C | Pulse 112 | SpO2 97%".
export function vitalsText(v: Vitals): string {
  const parts: string[] = [];
  if (v.temp_c != null) parts.push(`Temp ${v.temp_c} C`);
  if (v.pulse != null) parts.push(`Pulse ${v.pulse}`);
  if (v.bp_sys != null) parts.push(`BP ${v.bp_sys}/${v.bp_dia ?? "--"}`);
  if (v.spo2 != null) parts.push(`SpO2 ${v.spo2}%`);
  if (v.rr != null) parts.push(`RR ${v.rr}`);
  return parts.join(" | ");
}

// Tapped chips as English sentences, e.g. "fever (3 to 5 days, moderate)".
export function chipText(form: FormData): string {
  const present = form.symptoms
    .filter((s) => s.present)
    .map((s) => {
      const extra = [s.duration, s.severity].filter(Boolean).join(", ");
      return extra ? `${s.key} (${extra})` : s.key;
    });
  const absent = form.symptoms.filter((s) => !s.present).map((s) => s.key);
  const lines: string[] = [];
  if (present.length) lines.push(`Symptoms: ${present.join("; ")}.`);
  if (absent.length) lines.push(`Denies: ${absent.join(", ")}.`);
  if (form.pregnant) lines.push(`Pregnant${form.pregnancy_weeks ? `, ${form.pregnancy_weeks} weeks` : ""}.`);
  return lines.join(" ");
}

// The English text the rules read. Symptoms the patient denies are removed,
// so "no cough" does not count as a cough.
export function ruleText(history: History, form: FormData): string {
  let english = history.english_text.toLowerCase();
  for (const n of history.negated_symptoms) english = english.split(n.toLowerCase()).join(" ");

  const parts = [
    history.chief_complaint ?? "",
    english,
    ...history.symptoms.map((s) => `${s.name} ${s.notes ?? ""}`),
    ...form.symptoms.filter((s) => s.present).map((s) => s.key),
    form.pregnant ? "pregnant" : "",
  ];
  return parts.join(" ").toLowerCase();
}

// Run the rules and work out urgency, needed capabilities and syndrome.
export function assess(input: {
  history: History;
  form: FormData;
  vitals: Vitals;
  ageYears: number | null;
  ageMonths: number | null;
  aiUrgency: Urgency | null;
  aiCapabilities: string[];
  reportOutOfRange?: boolean;
}) {
  const text = ruleText(input.history, input.form);

  // Symptoms from the AI plus symptoms tapped on the form (with their durations).
  const symptoms = [
    ...input.history.symptoms,
    ...input.form.symptoms
      .filter((s) => s.present)
      .map((s) => ({ name: s.key, duration_days: durationDays(s.duration), severity: s.severity })),
  ];

  const rules = runRules({
    text,
    ageYears: input.ageYears,
    ageMonths: input.ageMonths,
    vitals: input.vitals,
    symptoms,
  });

  // Final band = the higher of rules and AI. The AI can raise it, never lower it.
  const urgency = input.aiUrgency ? maxUrgency(rules.band, input.aiUrgency) : rules.band;

  const capabilities = neededCapabilities({
    band: urgency,
    ageYears: input.ageYears,
    text,
    spo2: input.vitals.spo2,
    aiCapabilities: input.aiCapabilities,
    reportOutOfRange: input.reportOutOfRange,
  });

  return {
    flags: rules.flags as RuleFlag[],
    rulesBand: rules.band,
    urgency,
    capabilities,
    syndrome: syndromeFor(text),
  };
}

// A plain note built in code, used when the AI is unavailable (section 10).
export function templateNote(input: { form: FormData; vitals: Vitals; rawText: string; language: string }): Note {
  const chips = chipText(input.form);
  const present = input.form.symptoms.filter((s) => s.present);
  const pastHistory = [...input.form.past_illness.filter((p) => p !== "None"), input.form.past_other].filter(
    Boolean
  );

  return {
    history: {
      language: input.language,
      english_text: [chips, input.language === "en" ? input.rawText : ""].filter(Boolean).join(" "),
      chief_complaint: present.map((s) => s.key).join(", ") || null,
      symptoms: present.map((s) => ({
        name: s.key,
        duration_days: durationDays(s.duration),
        severity: s.severity,
        notes: s.duration,
      })),
      negated_symptoms: input.form.symptoms.filter((s) => !s.present).map((s) => s.key),
      past_history: pastHistory,
      medicines: input.form.medicines ? [input.form.medicines] : [],
      allergies: input.form.allergies ? [input.form.allergies] : [],
      missing_info: [],
    },
    soap: {
      subjective: [chips, input.rawText ? `Patient's words: "${input.rawText}"` : ""].filter(Boolean).join(" "),
      objective: vitalsText(input.vitals) || "No objective findings entered",
      assessment_suggested: "Not generated (AI unavailable).",
      plan_suggested: "Not generated (AI unavailable).",
    },
    readback_text: "",
    readback_english: "",
    suggested_urgency: "routine",
    urgency_reason: null,
    suggested_capabilities: [],
    changes: [],
  };
}
