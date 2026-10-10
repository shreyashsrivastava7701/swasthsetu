// Fixed lists for the intake form (section 10), with English and Hindi labels.

export const SYMPTOM_CHIPS = [
  { key: "fever", en: "Fever", hi: "बुखार" },
  { key: "cough", en: "Cough", hi: "खांसी" },
  { key: "sore throat", en: "Sore throat", hi: "गले में दर्द" },
  { key: "breathlessness", en: "Breathlessness", hi: "सांस फूलना" },
  { key: "chest pain", en: "Chest pain", hi: "सीने में दर्द" },
  { key: "vomiting", en: "Vomiting", hi: "उल्टी" },
  { key: "diarrhoea", en: "Diarrhoea", hi: "दस्त" },
  { key: "abdominal pain", en: "Abdominal pain", hi: "पेट दर्द" },
  { key: "headache", en: "Headache", hi: "सिरदर्द" },
  { key: "body ache", en: "Body ache", hi: "बदन दर्द" },
  { key: "weakness", en: "Weakness", hi: "कमज़ोरी" },
  { key: "rash", en: "Rash", hi: "दाने" },
  { key: "injury", en: "Injury or wound", hi: "चोट" },
  { key: "bleeding", en: "Bleeding", hi: "खून बहना" },
  { key: "burning urination", en: "Burning urination", hi: "पेशाब में जलन" },
  { key: "jaundice", en: "Jaundice", hi: "पीलिया" },
];

// Duration choices, with an approximate number of days used by the rules.
export const DURATIONS = [
  { key: "under 1 day", hi: "1 दिन से कम", days: 0.5 },
  { key: "1 to 2 days", hi: "1-2 दिन", days: 2 },
  { key: "3 to 5 days", hi: "3-5 दिन", days: 4 },
  { key: "more than 5 days", hi: "5 दिन से ज़्यादा", days: 6 },
  { key: "more than 2 weeks", hi: "2 हफ़्ते से ज़्यादा", days: 15 },
];

export const SEVERITIES = [
  { key: "mild", hi: "हल्का" },
  { key: "moderate", hi: "मध्यम" },
  { key: "severe", hi: "गंभीर" },
];

export const PAST_ILLNESS = [
  { key: "Diabetes", hi: "शुगर / मधुमेह" },
  { key: "High blood pressure", hi: "हाई बीपी" },
  { key: "Asthma", hi: "दमा" },
  { key: "Heart disease", hi: "दिल की बीमारी" },
  { key: "TB", hi: "टीबी" },
  { key: "Epilepsy", hi: "मिर्गी" },
  { key: "Thyroid", hi: "थायराइड" },
  { key: "Kidney disease", hi: "किडनी की बीमारी" },
  { key: "None", hi: "कोई नहीं" },
];

export const ENTERED_BY = [
  { key: "Patient", hi: "मरीज़" },
  { key: "Health worker", hi: "स्वास्थ्य कार्यकर्ता" },
  { key: "ANM", hi: "एएनएम" },
  { key: "ASHA", hi: "आशा" },
];

export const VITALS_FIELDS = [
  { key: "temp_c", en: "Temperature (C)", hi: "तापमान" },
  { key: "pulse", en: "Pulse", hi: "नाड़ी" },
  { key: "bp_sys", en: "BP systolic", hi: "बीपी ऊपर" },
  { key: "bp_dia", en: "BP diastolic", hi: "बीपी नीचे" },
  { key: "spo2", en: "SpO2 (%)", hi: "ऑक्सीजन" },
  { key: "rr", en: "Breaths per min", hi: "साँस प्रति मिनट" },
];

// One tapped symptom chip.
export type ChipSymptom = {
  key: string;
  present: boolean; // false = the patient said they do NOT have it
  duration: string | null;
  severity: string | null;
};

// Everything the form collects, saved as encounters.form_data.
export type FormData = {
  entered_by: string;
  age_unit: "years" | "months";
  pregnant: boolean;
  pregnancy_weeks: number | null;
  weight_kg: number | null;
  symptoms: ChipSymptom[];
  past_illness: string[];
  past_other: string;
  medicines: string;
  allergies: string;
};

export type Vitals = {
  temp_c?: number | null;
  pulse?: number | null;
  bp_sys?: number | null;
  bp_dia?: number | null;
  spo2?: number | null;
  rr?: number | null;
};

export function durationDays(key: string | null): number | null {
  return DURATIONS.find((d) => d.key === key)?.days ?? null;
}
