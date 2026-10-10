// zod checks for every AI answer. They are forgiving: missing lists become
// empty lists, numbers written as text become numbers, odd values become null.
import { z } from "zod";

// A number, or null if missing or not a number (e.g. "3" -> 3, "" -> null).
const num = z.preprocess((v) => {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isNaN(n) ? null : n;
}, z.number().nullable());

// Text, or null if missing.
const text = z.preprocess((v) => (v === undefined || v === null ? null : String(v)), z.string().nullable());

// A list of strings. Objects inside are turned into readable text.
const strList = z.preprocess(
  (v) =>
    Array.isArray(v)
      ? v.map((x) => (typeof x === "string" ? x : Object.values(x ?? {}).filter(Boolean).join(" ")))
      : [],
  z.array(z.string())
);

export const URGENCIES = ["routine", "soon", "urgent"] as const;
export type Urgency = (typeof URGENCIES)[number];
const urgency = z.preprocess(
  (v) => String(v ?? "").toLowerCase().trim(),
  z.enum(URGENCIES).catch("soon")
);

export const SymptomSchema = z.object({
  name: z.preprocess((v) => String(v ?? ""), z.string()),
  duration_days: num.optional().default(null),
  severity: text.optional().default(null),
  notes: text.optional().default(null),
});

export const HistorySchema = z.object({
  language: text.optional().default(null),
  english_text: z.preprocess((v) => String(v ?? ""), z.string()),
  chief_complaint: text.optional().default(null),
  symptoms: z.preprocess((v) => (Array.isArray(v) ? v : []), z.array(SymptomSchema)),
  negated_symptoms: strList,
  past_history: strList,
  medicines: strList,
  allergies: strList,
  missing_info: strList,
});

export const SoapSchema = z.object({
  subjective: z.preprocess((v) => String(v ?? ""), z.string()),
  objective: z.preprocess((v) => String(v ?? ""), z.string()),
  assessment_suggested: z.preprocess((v) => String(v ?? ""), z.string()),
  plan_suggested: z.preprocess((v) => String(v ?? ""), z.string()),
});

// Output of the structure and patch AI calls.
export const NoteSchema = z.object({
  history: HistorySchema,
  soap: SoapSchema,
  readback_text: z.preprocess((v) => String(v ?? ""), z.string()),
  readback_english: z.preprocess((v) => String(v ?? ""), z.string()),
  suggested_urgency: urgency,
  urgency_reason: text.optional().default(null),
  suggested_capabilities: strList,
  changes: strList,
});

export type History = z.infer<typeof HistorySchema>;
export type Soap = z.infer<typeof SoapSchema>;
export type Note = z.infer<typeof NoteSchema>;

// ---------- Report reader (lab photo, X-ray photo) ----------

const flag = z.preprocess(
  (v) => String(v ?? "unknown").toLowerCase().trim(),
  z.enum(["low", "high", "normal", "unknown"]).catch("unknown")
);

export const LabRowSchema = z.object({
  test: z.preprocess((v) => String(v ?? ""), z.string()),
  value: z.preprocess((v) => String(v ?? ""), z.string()),
  unit: z.preprocess((v) => String(v ?? ""), z.string()),
  ref_range: z.preprocess((v) => String(v ?? ""), z.string()),
  flag,
});

export const LabSchema = z.object({
  kind: z.literal("lab").catch("lab"),
  report_date: text.optional().default(null),
  rows: z.preprocess((v) => (Array.isArray(v) ? v : []), z.array(LabRowSchema)),
  notes: text.optional().default(null),
  confidence: text.optional().default(null),
});

export const XraySchema = z.object({
  kind: z.literal("xray").catch("xray"),
  description: z.preprocess((v) => String(v ?? ""), z.string()),
  visible_features: strList,
  limitations: z.preprocess((v) => String(v ?? ""), z.string()),
  needs_radiologist_review: z.literal(true).catch(true),
});

export type LabRow = z.infer<typeof LabRowSchema>;
export type LabReport = z.infer<typeof LabSchema>;
export type XrayReport = z.infer<typeof XraySchema>;
