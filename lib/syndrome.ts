// Syndrome tag for the dashboard (section 5). Rule-based on English text,
// first match wins.
export const SYNDROMES = ["fever_rash", "jaundice", "gastro", "resp", "fever", "injury", "other"] as const;
export type Syndrome = (typeof SYNDROMES)[number];

const has = (text: string, words: string[]) => words.some((w) => text.includes(w));

export function syndromeFor(englishText: string): Syndrome {
  const t = englishText.toLowerCase();
  if (has(t, ["fever"]) && has(t, ["rash", "spots", "blisters"])) return "fever_rash";
  if (has(t, ["jaundice", "yellow eyes"])) return "jaundice";
  if (has(t, ["diarrhoea", "diarrhea", "loose motion", "vomiting"])) return "gastro";
  if (has(t, ["cough", "breathless", "sore throat", "cold"])) return "resp";
  if (has(t, ["fever"])) return "fever";
  if (has(t, ["injury", "fall", "fracture", "wound", "burn"])) return "injury";
  return "other";
}
