// District dashboard numbers and the cluster rule (section 5).
// Clusters: cases in the last 3 days (today and the 2 days before), grouped by
// block and syndrome. 5 or more = Alert, 3 or 4 = Watch. "other" is never a cluster.
// This is a simple count rule, not epidemiology.

export type PublicCase = { block: string; syndrome: string; urgency: string; day: string; is_demo: boolean };

export type Cluster = { block: string; syndrome: string; count: number; level: "alert" | "watch"; from: string; to: string };

// Today's date in India as "YYYY-MM-DD", moved by `offset` days.
export function istDay(offset = 0): string {
  const ist = new Date(Date.now() + 5.5 * 60 * 60 * 1000);
  ist.setUTCDate(ist.getUTCDate() + offset);
  return ist.toISOString().slice(0, 10);
}

export const SYNDROME_LABELS: Record<string, string> = {
  fever_rash: "Fever with rash / बुखार और दाने",
  jaundice: "Jaundice / पीलिया",
  gastro: "Diarrhoea or vomiting / दस्त या उल्टी",
  resp: "Cough or breathing / खांसी या साँस",
  fever: "Fever / बुखार",
  injury: "Injury / चोट",
  other: "Other / अन्य",
};

export function summarise(cases: PublicCase[], today: string) {
  const from3 = shift(today, -2);
  const last3 = cases.filter((c) => c.day >= from3 && c.day <= today);

  // Group the last 3 days by block + syndrome.
  const groups = new Map<string, PublicCase[]>();
  for (const c of last3) {
    if (c.syndrome === "other") continue;
    const key = `${c.block}|${c.syndrome}`;
    groups.set(key, [...(groups.get(key) ?? []), c]);
  }
  const clusters: Cluster[] = [];
  for (const [key, list] of groups) {
    if (list.length < 3) continue;
    const [block, syndrome] = key.split("|");
    const days = list.map((c) => c.day).sort();
    clusters.push({ block, syndrome, count: list.length, level: list.length >= 5 ? "alert" : "watch", from: days[0], to: days[days.length - 1] });
  }
  clusters.sort((a, b) => (a.level === b.level ? b.count - a.count : a.level === "alert" ? -1 : 1));

  // Cases per syndrome over the whole period shown (7 days).
  const bySyndrome: Record<string, number> = {};
  for (const c of cases) bySyndrome[c.syndrome] = (bySyndrome[c.syndrome] ?? 0) + 1;

  // Cases per block in the last 3 days (for the map).
  const byBlock: Record<string, number> = {};
  for (const c of last3) byBlock[c.block] = (byBlock[c.block] ?? 0) + 1;

  return {
    today,
    today_count: cases.filter((c) => c.day === today).length,
    last3_count: last3.length,
    alert_count: clusters.filter((c) => c.level === "alert").length,
    clusters,
    by_syndrome: Object.entries(bySyndrome)
      .map(([syndrome, count]) => ({ syndrome, count }))
      .sort((a, b) => b.count - a.count),
    by_block: byBlock,
    has_demo: cases.some((c) => c.is_demo),
  };
}

// "YYYY-MM-DD" moved by n days.
export function shift(day: string, n: number): string {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
