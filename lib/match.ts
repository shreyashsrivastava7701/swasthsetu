// Facility matching (section 5): find the nearest facility, with a doctor
// today, that has everything the patient needs.
import { findBlock } from "@/lib/blocks";

export type Facility = {
  id: string;
  name: string;
  block: string;
  lat: number;
  lng: number;
  capabilities: string[];
  doctor_today: boolean;
};

export type Match = {
  facility: Facility;
  distance_km: number;
  eta_minutes: number;
  reason_for_choice: string;
  partial_match: boolean;
  missing: string[];
};

// Straight-line distance in km between two points on the earth (haversine).
export function distanceKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371;
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

// Short plain-English names used in the reason sentence.
const SHORT: Record<string, string> = {
  general_doctor: "a doctor",
  pediatrician: "a children's doctor",
  lab_blood: "a blood-test lab",
  xray: "X-ray",
  oxygen: "oxygen",
  ambulance: "an ambulance",
  obstetrics: "pregnancy care",
  emergency_24x7: "24x7 emergency",
  surgeon: "a surgeon",
  icu: "an ICU",
};

function joinWords(items: string[]): string {
  if (items.length <= 1) return items.join("");
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

// The result for one facility: distance, travel time at 30 km/h, reason.
function result(f: Facility, km: number, needed: string[], missing: string[]): Match {
  const distance_km = Math.round(km * 10) / 10;
  const eta_minutes = Math.ceil((km / 30) * 60);
  // "general_doctor" is always needed, so it is left out of the sentence unless it is the only need.
  const shown = needed.filter((c) => c !== "general_doctor");
  const has = joinWords((shown.length ? shown : needed).filter((c) => !missing.includes(c)).map((c) => SHORT[c] ?? c));
  const reason_for_choice =
    missing.length === 0
      ? `Nearest facility with ${has}, ${distance_km} km away.`
      : `No facility has everything needed. This is the closest best match, ${distance_km} km away. Missing: ${joinWords(
          missing.map((c) => SHORT[c] ?? c)
        )}.`;
  return { facility: f, distance_km, eta_minutes, reason_for_choice, partial_match: missing.length > 0, missing };
}

// Pick a facility. Returns null if no facility has a doctor today
// (then the user chooses one by hand).
export function matchFacility(facilities: Facility[], blockName: string, needed: string[]): Match | null {
  const block = findBlock(blockName);
  if (!block) return null;

  const open = facilities
    .filter((f) => f.doctor_today)
    .map((f) => ({ f, km: distanceKm(block, f), missing: needed.filter((c) => !f.capabilities.includes(c)) }))
    .sort((a, b) => a.km - b.km);
  if (open.length === 0) return null;

  // 1. Nearest facility that has everything.
  const full = open.find((x) => x.missing.length === 0);
  if (full) return result(full.f, full.km, needed, []);

  // 2. Otherwise the one missing the fewest things, nearest on ties.
  const best = [...open].sort((a, b) => a.missing.length - b.missing.length || a.km - b.km)[0];
  return result(best.f, best.km, needed, best.missing);
}

// The result when the user chose the facility by hand.
export function manualMatch(f: Facility, blockName: string, needed: string[]): Match {
  const block = findBlock(blockName) ?? { lat: f.lat, lng: f.lng };
  const m = result(f, distanceKm(block, f), needed, needed.filter((c) => !f.capabilities.includes(c)));
  return { ...m, reason_for_choice: `Chosen by hand. ${m.distance_km} km away.` };
}
