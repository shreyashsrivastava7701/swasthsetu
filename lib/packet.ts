// The referral packet (section 5 + section 10): everything the receiving
// doctor needs, in one object. Also used for the one-page summary.
import { supabase } from "@/lib/supabase";
import { assess, ruleText } from "@/lib/encounter";
import { neededCapabilities, type RuleFlag } from "@/lib/rules";
import { matchFacility, manualMatch, type Facility, type Match } from "@/lib/match";
import { URGENCIES, type History, type LabReport, type Urgency, type XrayReport } from "@/lib/schemas";
import type { FormData, Vitals } from "@/lib/form";

export type SavedReport = { kind: string; data: LabReport | XrayReport };

export type Packet = {
  encounter_id: string;
  created_at: string;
  patient: {
    alias: string;
    name: string | null;
    phone: string | null;
    age: number | null;
    sex: string | null;
    language: string;
    block: string;
  };
  urgency: Urgency;
  rules_urgency: Urgency;
  ai_urgency: string | null;
  urgency_overridden: boolean;
  red_flags: RuleFlag[];
  history: History;
  soap: Record<string, unknown>;
  raw_text: string;
  reports: SavedReport[];
  vitals: Vitals;
  weight_kg: number | null;
  form_data: Record<string, unknown>;
  entered_by: string | null;
  teachback: { confirmed: boolean; rounds: number };
  needed_capabilities: string[];
  facility: { id: string; name: string; block: string } | null;
  distance_km: number | null;
  eta_minutes: number | null;
  reason_for_choice: string;
  partial_match: boolean;
  missing_capabilities: string[];
  syndrome: string;
  // Step B: a hospital found on Google (not on SwasthSetu), and the visit time.
  hospital: { name: string; address: string; url: string | null } | null;
  visit_at: string | null;
  label: string;
};

// Tags that come from the urgency band. They are worked out again when the
// clinician changes the band.
const BAND_TAGS = ["pediatrician", "emergency_24x7"];

// Load a case with its reports, and all facilities.
export async function loadCase(id: string) {
  const [{ data: e }, { data: reports }, { data: facilities }] = await Promise.all([
    supabase.from("encounters").select("*").eq("id", id).single(),
    supabase.from("reports").select("kind, data").eq("encounter_id", id).order("created_at"),
    supabase.from("facilities").select("*"),
  ]);
  return { e, reports: (reports ?? []) as SavedReport[], facilities: (facilities ?? []) as Facility[] };
}

// Work out urgency, needs and the facility, then build the packet.
// urgency: the clinician's choice (null = keep the case's band).
// facilityId: a facility chosen by hand (null = pick automatically).
export function buildPacket(
  e: any, // eslint-disable-line @typescript-eslint/no-explicit-any
  reports: SavedReport[],
  facilities: Facility[],
  urgency: string | null,
  facilityId: string | null,
  extra: { reason?: string; hospital?: Packet["hospital"]; visit_at?: string | null } = {}
) {
  const history = e.history as History;
  const form = e.form_data as FormData & { age_months?: number | null };
  const vitals = (e.vitals ?? {}) as Vitals;

  // Rules again on the latest data (the note may have been corrected).
  const a = assess({
    history,
    form,
    vitals,
    ageYears: e.age,
    ageMonths: form.age_months ?? null,
    aiUrgency: null,
    aiCapabilities: [],
  });

  const chosen = URGENCIES.includes(urgency as Urgency) ? (urgency as Urgency) : (e.urgency as Urgency);
  const overridden = Boolean(e.urgency_overridden) || chosen !== e.urgency;

  const outOfRange = reports.some(
    (r) => r.kind === "lab" && (r.data as LabReport).rows.some((row) => row.flag === "high" || row.flag === "low")
  );
  const needed = neededCapabilities({
    band: chosen,
    ageYears: e.age,
    text: ruleText(history, form),
    spo2: vitals.spo2,
    // Keep the AI's suggestions and earlier report needs, but let the band decide its own tags.
    aiCapabilities: (e.needed_capabilities as string[]).filter((c) => !BAND_TAGS.includes(c)),
    reportOutOfRange: outOfRange,
  });

  let match: Match | null = null;
  const manual = facilityId ? facilities.find((f) => f.id === facilityId) : undefined;
  if (extra.hospital) match = null; // a hospital not on SwasthSetu
  else if (manual) match = manualMatch(manual, e.block, needed);
  else match = matchFacility(facilities, e.block, needed);
  if (match && extra.reason) match = { ...match, reason_for_choice: extra.reason };

  const packet: Packet = {
    encounter_id: e.id,
    created_at: new Date().toISOString(),
    patient: {
      alias: e.alias,
      name: e.patient_name ?? null,
      phone: e.patient_phone ?? null,
      age: e.age,
      sex: e.sex,
      language: e.language,
      block: e.block,
    },
    urgency: chosen,
    rules_urgency: a.rulesBand,
    ai_urgency: e.ai_urgency ?? null,
    urgency_overridden: overridden,
    red_flags: e.rule_flags as RuleFlag[],
    history,
    soap: e.soap,
    raw_text: e.raw_text ?? "",
    reports,
    vitals,
    weight_kg: e.weight_kg ?? null,
    form_data: form,
    entered_by: e.entered_by ?? null,
    teachback: { confirmed: e.status !== "draft", rounds: e.teachback_rounds ?? 0 },
    needed_capabilities: needed,
    facility: match ? { id: match.facility.id, name: match.facility.name, block: match.facility.block } : null,
    distance_km: match?.distance_km ?? null,
    eta_minutes: match?.eta_minutes ?? null,
    reason_for_choice: match?.reason_for_choice ?? extra.reason ?? "No hospital chosen yet.",
    partial_match: match?.partial_match ?? false,
    missing_capabilities: match?.missing ?? [],
    syndrome: a.syndrome,
    hospital: extra.hospital ?? null,
    visit_at: extra.visit_at ?? null,
    label: "AI-generated summary, for clinician review",
  };
  return packet;
}
