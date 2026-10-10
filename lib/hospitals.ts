// Hospital suggestions for a patient (server only).
//  1. Hospitals registered on SwasthSetu: ranked by what the case needs and
//     distance, then Gemini with Google Search re-orders them and writes a reason.
//  2. If no hospital is registered: Gemini with Google Maps finds one near the
//     patient's block. The patient is told to go there with the summary.
// The AI never gets the patient's name or phone. Only age, sex, complaint and needs.
import { GoogleGenAI } from "@google/genai";
import { distanceKm, type Facility } from "@/lib/match";
import { findBlock } from "@/lib/blocks";
import { extractJson, geminiChain, errorText } from "@/lib/ai";
import { CAPABILITY_LABELS } from "@/lib/rules";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export type RegisteredOption = {
  facility_id: string;
  name: string;
  block: string;
  address: string | null;
  phone: string | null;
  distance_km: number;
  eta_minutes: number;
  missing: string[];
  reason: string;
};

export type GoogleOption = { name: string; address: string; reason: string; url: string | null };

export type Suggestions =
  | { mode: "registered"; source: "google" | "rules"; options: RegisteredOption[]; note: string | null }
  | { mode: "google"; options: GoogleOption[]; note: string | null }
  | { mode: "none"; options: []; note: string };

export type CaseInfo = { age: number | null; sex: string | null; block: string; complaint: string; urgency: string; needed: string[] };

// Hospitals are placed at their block centre, so the same block shows as 0 km.
const where = (km: number) => (km < 1 ? "in your block" : `${Math.round(km * 10) / 10} km away`);

const needsText = (needed: string[]) => needed.map((c) => (CAPABILITY_LABELS[c] ?? c).split(" / ")[0]).join(", ");

// Ask Gemini with a Google tool. Returns the text answer and any place links.
// Stops at the deadline (a time in ms), so the server always answers before
// the host (Vercel) cuts the request off.
async function askWithGoogle(input: string, tool: Record<string, unknown>, deadline: number) {
  const perModel = Number(process.env.AI_TIMEOUT_SECONDS || 60) * 1000;
  const errors: string[] = [];
  for (const model of geminiChain()) {
    const left = deadline - Date.now();
    if (left < 5000) {
      errors.push("out of time");
      break;
    }
    try {
      const call = ai.interactions.create({ model, input, tools: [tool] } as Parameters<typeof ai.interactions.create>[0]);
      const timeout = new Promise<never>((_, reject) => setTimeout(() => reject(new Error("timed out")), Math.min(perModel, left)));
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result: any = await Promise.race([call, timeout]);
      const links: { name: string; url: string }[] = [];
      for (const step of result.steps ?? []) {
        for (const block of step.content ?? []) {
          for (const a of block.annotations ?? []) {
            if (a.url) links.push({ name: a.name ?? a.title ?? "", url: a.url });
          }
        }
      }
      console.log(`[ai] ${model} with ${String(tool.type)} OK`);
      return { text: String(result.output_text ?? ""), links };
    } catch (err) {
      console.log(`[ai] ${model} with ${String(tool.type)} failed: ${errorText(err)}`);
      errors.push(`${model}: ${errorText(err)}`);
    }
  }
  throw new Error(errors.join(" | "));
}

// Registered hospitals, best first: those with everything needed (nearest
// first), then the ones missing the fewest things.
export function rankRegistered(facilities: Facility[], blockName: string, needed: string[]): RegisteredOption[] {
  const block = findBlock(blockName);
  return facilities
    .map((f) => {
      const km = block ? distanceKm(block, f) : 0;
      const missing = needed.filter((c) => !f.capabilities.includes(c));
      const f2 = f as Facility & { address?: string | null; phone?: string | null };
      return {
        facility_id: f.id,
        name: f.name,
        block: f.block,
        address: f2.address ?? null,
        phone: f2.phone ?? null,
        distance_km: Math.round(km * 10) / 10,
        eta_minutes: Math.ceil((km / 30) * 60),
        missing,
        reason: missing.length
          ? `Closest match, ${where(km)}. Does not list: ${needsText(missing)}.`
          : `Has everything this case needs (${needsText(needed)}), ${where(km)}.`,
      };
    })
    .sort((a, b) => a.missing.length - b.missing.length || a.distance_km - b.distance_km)
    .slice(0, 5);
}

const NO_HOSPITAL_NOTE =
  "No hospital near you is on SwasthSetu yet. Go to your nearest government hospital and carry your summary. You can type its name below to book.";

// Instant answer with no AI: registered hospitals by needs and distance, or a
// note when none are registered. The page shows this first, so the patient can
// always book even if Google is slow or down.
export function quickSuggestions(c: CaseInfo, facilities: Facility[]): Suggestions {
  const ranked = rankRegistered(facilities, c.block, c.needed);
  if (ranked.length > 0) return { mode: "registered", source: "rules", options: ranked, note: null };
  return { mode: "none", options: [], note: NO_HOSPITAL_NOTE };
}

// The full answer with Google. budgetMs is the most time it may take.
export async function suggestHospitals(c: CaseInfo, facilities: Facility[], budgetMs = 45000): Promise<Suggestions> {
  const deadline = Date.now() + budgetMs;
  const caseText = `Patient: ${c.age ?? "?"} years, ${c.sex ?? "?"}, from ${c.block} block, Hamirpur district, Himachal Pradesh, India. Problem: ${c.complaint}. Urgency: ${c.urgency}. Needs: ${needsText(c.needed)}.`;

  // 1. Registered hospitals.
  const ranked = rankRegistered(facilities, c.block, c.needed);
  if (ranked.length > 0) {
    try {
      const list = ranked
        .map((r) => `- id ${r.facility_id}: ${r.name}, ${r.block} block, ${r.distance_km} km away, missing: ${r.missing.join(", ") || "nothing"}`)
        .join("\n");
      const { text } = await askWithGoogle(
        `${caseText}\n\nThese hospitals are registered on our app:\n${list}\n\nUse Google Search to check what each hospital offers and how good it is for this problem. Rank ONLY these hospitals, best for this patient first. Do not add any other hospital. Return only JSON: {"ranking": [{"id": "...", "reason": "one short plain-English sentence for the patient"}]}`,
        { type: "google_search" },
        deadline
      );
      const parsed = extractJson(text) as { ranking?: { id: string; reason: string }[] };
      const order = (parsed.ranking ?? []).filter((x) => ranked.some((r) => r.facility_id === x.id));
      if (order.length) {
        const options = order.map((x) => {
          const r = ranked.find((y) => y.facility_id === x.id)!;
          return { ...r, reason: x.reason || r.reason };
        });
        // Any the AI left out go at the end, unchanged.
        for (const r of ranked) if (!options.some((o) => o.facility_id === r.facility_id)) options.push(r);
        return { mode: "registered", source: "google", options, note: null };
      }
    } catch (err) {
      console.log(`[hospitals] Google ranking failed, using distance and needs: ${errorText(err)}`);
    }
    return { mode: "registered", source: "rules", options: ranked, note: null };
  }

  // 2. Nobody registered: find a real hospital near the block on Google Maps.
  const block = findBlock(c.block);
  try {
    const { text, links } = await askWithGoogle(
      `${caseText}\n\nFind up to 3 hospitals near this patient that can best handle this problem. Return only JSON: {"hospitals": [{"name": "...", "address": "...", "reason": "one short plain-English sentence for the patient"}]}`,
      { type: "google_maps", latitude: block?.lat, longitude: block?.lng },
      deadline
    );
    const parsed = extractJson(text) as { hospitals?: { name: string; address?: string; reason?: string }[] };
    const options = (parsed.hospitals ?? []).slice(0, 3).map((h) => ({
      name: String(h.name),
      address: String(h.address ?? ""),
      reason: String(h.reason ?? ""),
      url: links.find((l) => l.name && (h.name.includes(l.name) || l.name.includes(h.name)))?.url ?? null,
    }));
    if (options.length) {
      return {
        mode: "google",
        options,
        note: "No hospital near you is on SwasthSetu yet. These were found on Google Maps. Carry your summary report.",
      };
    }
  } catch (err) {
    console.log(`[hospitals] Google Maps search failed: ${errorText(err)}`);
  }
  return { mode: "none", options: [], note: NO_HOSPITAL_NOTE };
}
