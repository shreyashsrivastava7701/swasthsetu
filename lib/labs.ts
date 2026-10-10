// Lab flags are re-checked in code whenever the value and the range are numbers.
// Examples of ranges understood: "12-16", "12.0 - 16.0", "4,000 - 11,000", "< 5.7", "> 40".
import type { LabRow } from "@/lib/schemas";

const toNumber = (s: string) => {
  const n = parseFloat(s.replace(/,/g, "").trim());
  return Number.isNaN(n) ? null : n;
};

export function computeFlag(row: LabRow): LabRow["flag"] {
  const value = toNumber(row.value);
  const range = row.ref_range.replace(/,/g, "").trim();
  if (value === null || !range) return row.flag;

  const between = range.match(/^(-?\d+(?:\.\d+)?)\s*(?:-|–|to)\s*(-?\d+(?:\.\d+)?)/i);
  if (between) {
    const [low, high] = [Number(between[1]), Number(between[2])];
    return value < low ? "low" : value > high ? "high" : "normal";
  }
  const less = range.match(/^(?:<|<=|up to|upto)\s*(-?\d+(?:\.\d+)?)/i);
  if (less) return value > Number(less[1]) ? "high" : "normal";
  const more = range.match(/^(?:>|>=)\s*(-?\d+(?:\.\d+)?)/);
  if (more) return value < Number(more[1]) ? "low" : "normal";

  return row.flag; // could not read the range: keep the model's flag
}

export function withFlags(rows: LabRow[]): LabRow[] {
  return rows.map((r) => ({ ...r, flag: computeFlag(r) }));
}

export function hasOutOfRange(rows: LabRow[]): boolean {
  return rows.some((r) => r.flag === "low" || r.flag === "high");
}
