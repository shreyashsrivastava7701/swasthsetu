// Urgency score out of 10 for the one-page summary. It is worked out from the
// packet each time the summary is shown, so old cases get a score too.
// Points: urgent red flag +3, other red flag +2, borderline vital +1,
// each out-of-range lab result +1 (at most +3). The score is then kept inside
// the final urgency level (Routine 0-3, Soon 4-6, Urgent 7-10), so it never
// disagrees with the level the rules or the clinician set.
// These points are illustrative, NOT a validated clinical score.
import type { Packet } from "@/lib/packet";
import type { LabReport, LabRow, Urgency } from "@/lib/schemas";

export type ScoreLine = { label: string; points: number };
export type Score = { total: number; lines: ScoreLine[] };

const BAND: Record<Urgency, [number, number]> = { routine: [0, 3], soon: [4, 6], urgent: [7, 10] };

// Red flags that only raise a case to "soon" (see lib/rules.ts). All others are urgent.
const SOON_RULES = ["Severe symptom", "Long fever", "Vitals: temperature"];

export const BAND_TEXT: Record<Urgency, string> = {
  routine: "routine visit",
  soon: "see within 24 hours",
  urgent: "see now",
};

export function labRows(p: Packet): (LabRow & { report_date: string | null })[] {
  return p.reports
    .filter((r) => r.kind === "lab")
    .flatMap((r) => (r.data as LabReport).rows.map((row) => ({ ...row, report_date: (r.data as LabReport).report_date })));
}

export const outOfRange = (row: LabRow) => row.flag === "low" || row.flag === "high";

// Vitals that are worth a look but did not trip a red-flag rule.
export function borderlineVitals(p: Packet): { text: string; value: string }[] {
  const v = p.vitals;
  const flagged = (rule: string) => p.red_flags.some((f) => f.rule === rule);
  const out: { text: string; value: string }[] = [];
  if (v.temp_c != null && v.temp_c >= 38 && !flagged("Vitals: temperature"))
    out.push({ text: "Temperature high", value: `${v.temp_c} °C` });
  if (v.spo2 != null && v.spo2 >= 92 && v.spo2 < 95) out.push({ text: "Oxygen a little low", value: `SpO2 ${v.spo2}%` });
  if (v.bp_sys != null && ((v.bp_sys >= 160 && v.bp_sys <= 180) || (v.bp_sys >= 90 && v.bp_sys < 100)))
    out.push({ text: "Blood pressure borderline", value: `BP ${v.bp_sys}/${v.bp_dia ?? "--"}` });
  return out;
}

export function urgencyScore(p: Packet): Score {
  const lines: ScoreLine[] = [];
  for (const f of p.red_flags) {
    lines.push({ label: `${f.rule}: ${f.evidence} (red flag)`, points: SOON_RULES.includes(f.rule) ? 2 : 3 });
  }
  for (const b of borderlineVitals(p)) lines.push({ label: `${b.text} (${b.value})`, points: 1 });

  const bad = labRows(p).filter(outOfRange);
  bad.slice(0, 3).forEach((r) => lines.push({ label: `${r.test} ${r.flag}`, points: 1 }));

  const raw = lines.reduce((sum, l) => sum + l.points, 0);
  const [min, max] = BAND[p.urgency] ?? BAND.routine;
  const total = Math.min(max, Math.max(min, raw));
  if (total !== raw) {
    lines.push({ label: `Kept inside the ${p.urgency.toUpperCase()} level (${min}-${max})`, points: total - raw });
  }
  return { total, lines };
}
