// Fixed danger-sign rules (section 5). Plain code, same result every time.
// These are illustrative demo rules and thresholds, NOT validated clinical standards.
import type { Urgency } from "@/lib/schemas";
import type { Vitals } from "@/lib/form";

export type RuleFlag = { rule: string; evidence: string };

export type RuleInput = {
  text: string; // English text: complaint, symptoms, free text
  ageYears: number | null;
  ageMonths: number | null; // only known for babies
  vitals: Vitals;
  symptoms: { name: string; duration_days: number | null; severity: string | null }[];
};

const RANK: Record<Urgency, number> = { routine: 0, soon: 1, urgent: 2 };

// The higher of two urgency bands.
export function maxUrgency(a: Urgency, b: Urgency): Urgency {
  return RANK[a] >= RANK[b] ? a : b;
}

// Danger words: any one of these phrases in the text makes the case urgent.
const WORD_RULES: { rule: string; words: string[] }[] = [
  { rule: "Chest pain", words: ["chest pain", "chest tightness", "pain in chest"] },
  {
    rule: "Breathing difficulty",
    words: ["breathless", "shortness of breath", "difficulty breathing", "cannot breathe"],
  },
  {
    rule: "Altered consciousness",
    words: ["unconscious", "fainted", "not responding", "seizure", "convulsion", "confused"],
  },
  {
    rule: "Stroke signs",
    words: ["face droop", "slurred speech", "weakness on one side", "sudden weakness"],
  },
  { rule: "Heavy bleeding", words: ["heavy bleeding", "vomiting blood", "coughing blood", "black stool"] },
  { rule: "Poisoning or bite", words: ["poison", "overdose", "snake bite"] },
];

export function runRules(input: RuleInput): { flags: RuleFlag[]; band: Urgency } {
  const t = input.text.toLowerCase();
  const flags: { rule: string; evidence: string; band: Urgency }[] = [];
  const add = (rule: string, evidence: string, band: Urgency) => flags.push({ rule, evidence, band });

  for (const r of WORD_RULES) {
    const hit = r.words.find((w) => t.includes(w));
    if (hit) add(r.rule, hit, "urgent");
  }

  // Pregnancy danger signs.
  if (t.includes("pregnan")) {
    if (t.includes("bleeding")) add("Pregnancy danger", "pregnant with bleeding", "urgent");
    else if (t.includes("severe headache")) add("Pregnancy danger", "pregnant with severe headache", "urgent");
  }
  if (t.includes("reduced fetal movement")) add("Pregnancy danger", "reduced fetal movement", "urgent");

  // Fever in a baby under 3 months.
  const hasFever = t.includes("fever");
  if (hasFever && input.ageMonths !== null && input.ageMonths < 3) {
    add("Infant fever", `fever at age ${input.ageMonths} months`, "urgent");
  }

  // Vitals.
  const v = input.vitals;
  if (v.spo2 != null && v.spo2 < 92) add("Vitals: oxygen", `SpO2 ${v.spo2}`, "urgent");
  if (v.pulse != null && (v.pulse > 130 || v.pulse < 40)) add("Vitals: pulse", `pulse ${v.pulse}`, "urgent");
  if (v.bp_sys != null && (v.bp_sys < 90 || v.bp_sys > 180))
    add("Vitals: blood pressure", `systolic ${v.bp_sys}`, "urgent");
  if (v.temp_c != null && v.temp_c >= 39.5) {
    const young = input.ageYears !== null && input.ageYears < 5;
    add("Vitals: temperature", `temperature ${v.temp_c} C`, young ? "urgent" : "soon");
  }

  // Severe symptom, and long fever.
  const severe = input.symptoms.find((s) => (s.severity ?? "").toLowerCase() === "severe");
  if (severe) add("Severe symptom", `${severe.name} marked severe`, "soon");
  const longFever = input.symptoms.find(
    (s) => s.name.toLowerCase().includes("fever") && (s.duration_days ?? 0) >= 5
  );
  if (longFever) add("Long fever", `fever for ${longFever.duration_days} days`, "soon");

  const band = flags.reduce<Urgency>((acc, f) => maxUrgency(acc, f.band), "routine");
  return { flags: flags.map(({ rule, evidence }) => ({ rule, evidence })), band };
}

// ---------- Needed capabilities (section 5) ----------

export const CAPABILITIES = [
  "general_doctor",
  "pediatrician",
  "lab_blood",
  "xray",
  "oxygen",
  "ambulance",
  "obstetrics",
  "emergency_24x7",
  "surgeon",
  "icu",
] as const;

export const CAPABILITY_LABELS: Record<string, string> = {
  general_doctor: "General doctor / सामान्य डॉक्टर",
  pediatrician: "Children's doctor / बच्चों के डॉक्टर",
  lab_blood: "Blood-test lab / खून की जाँच",
  xray: "X-ray / एक्स-रे",
  oxygen: "Oxygen / ऑक्सीजन",
  ambulance: "Ambulance / एम्बुलेंस",
  obstetrics: "Pregnancy care / प्रसूति",
  emergency_24x7: "24x7 emergency / 24 घंटे इमरजेंसी",
  surgeon: "Surgeon / सर्जन",
  icu: "ICU / आईसीयू",
};

export function neededCapabilities(input: {
  band: Urgency;
  ageYears: number | null;
  text: string;
  spo2: number | null | undefined;
  aiCapabilities: string[];
  reportOutOfRange?: boolean;
}): string[] {
  const t = input.text.toLowerCase();
  const caps = new Set<string>(["general_doctor"]);

  if (input.ageYears !== null && input.ageYears < 12 && input.band !== "routine") caps.add("pediatrician");
  if (input.band === "urgent") caps.add("emergency_24x7");
  const breathing = ["breathless", "shortness of breath", "difficulty breathing", "cannot breathe"].some((w) =>
    t.includes(w)
  );
  if (breathing || (input.spo2 != null && input.spo2 < 92)) caps.add("oxygen");
  if (["chest pain", "chest tightness", "pain in chest"].some((w) => t.includes(w))) {
    caps.add("oxygen");
    caps.add("emergency_24x7");
  }
  if (t.includes("pregnan")) caps.add("obstetrics");
  if (["injury", "fall", "fracture", "accident"].some((w) => t.includes(w))) caps.add("xray");
  if ((t.includes("fever") && t.includes("rash")) || input.reportOutOfRange) caps.add("lab_blood");

  // Add the AI's suggestions, keeping only tags from the fixed list.
  for (const c of input.aiCapabilities) {
    if ((CAPABILITIES as readonly string[]).includes(c)) caps.add(c);
  }
  return [...caps];
}
