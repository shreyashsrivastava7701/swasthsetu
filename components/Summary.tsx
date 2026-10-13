// The one-page clinician summary ("Quick Glance" layout). Same layout on
// screen, on paper and in the hospital's inbox. The most important things come
// first: urgency score, patient, visit, then a "Needs attention" box with every
// red flag and out-of-range result. Arrows (▲ ▼) and words (HIGH, LOW) are used
// next to colours, so it still reads when printed in black and white.
import type { Packet } from "@/lib/packet";
import type { LabRow, XrayReport } from "@/lib/schemas";
import { CAPABILITY_LABELS } from "@/lib/rules";
import { labNumber, parseRange } from "@/lib/labs";
import { BAND_TEXT, borderlineVitals, labRows, outOfRange, urgencyScore } from "@/lib/score";

const none = (items: string[]) => (items.length ? items.join(", ") : "None");

export function when(iso: string): string {
  return new Date(iso).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short" });
}

// Colours for each urgency level.
const URGENCY_STYLE = {
  routine: { box: "border-green-600 bg-green-50", text: "text-green-800" },
  soon: { box: "border-amber-500 bg-amber-50", text: "text-amber-800" },
  urgent: { box: "border-red-700 bg-red-50", text: "text-red-800" },
};

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="mb-1.5 mt-3 border-b-2 border-teal-800 pb-0.5 text-xs font-bold uppercase tracking-wider text-teal-800">
      {children}
    </h3>
  );
}

function Card({ title, className = "", children }: { title: string; className?: string; children: React.ReactNode }) {
  return (
    <div className={`rounded-md border border-gray-300 px-3 py-2 ${className}`}>
      <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">{title}</p>
      {children}
    </div>
  );
}

// 10 small blocks: green for 0-3, amber for 4-6, red for 7-10.
function ScoreMeter({ total }: { total: number }) {
  return (
    <div className="mt-1 flex gap-0.5">
      {Array.from({ length: 10 }, (_, i) => {
        const on = i < total;
        const colour = i < 3 ? "bg-green-600" : i < 6 ? "bg-amber-500" : "bg-red-700";
        return <i key={i} className={`h-2 flex-1 rounded-sm ${on ? colour : "bg-gray-200"}`} />;
      })}
    </div>
  );
}

// Where a value falls against its normal range: green zone = normal, dot = this result.
function RangeBar({ row }: { row: LabRow }) {
  const value = labNumber(row.value);
  const range = parseRange(row.ref_range);
  if (value === null || !range) return null;
  const low = range.low ?? 0;
  const high = range.high ?? low * 2;
  const span = high - low || Math.abs(high) || 1;
  const start = low === 0 ? 0 : low - span * 0.6;
  const end = high + span * 0.6;
  const at = (n: number) => ((n - start) / (end - start)) * 100;
  const dot = Math.min(97, Math.max(3, at(value)));
  const bad = outOfRange(row);
  return (
    <div className="relative h-1.5 w-full rounded bg-gray-100">
      <div className="absolute inset-y-0 rounded bg-green-200" style={{ left: `${at(low)}%`, width: `${at(high) - at(low)}%` }} />
      <div
        className={`absolute -top-1 h-3.5 w-3.5 -translate-x-1/2 rounded-full border-2 border-white ${bad ? "bg-red-700" : "bg-green-700"}`}
        style={{ left: `${dot}%` }}
      />
    </div>
  );
}

function FlagTag({ flag }: { flag: LabRow["flag"] }) {
  if (flag === "low") return <span className="whitespace-nowrap rounded bg-red-700 px-1.5 text-[10px] font-bold text-white">▼ LOW</span>;
  if (flag === "high") return <span className="whitespace-nowrap rounded bg-red-700 px-1.5 text-[10px] font-bold text-white">▲ HIGH</span>;
  if (flag === "normal") return <span className="rounded bg-green-100 px-1.5 text-[10px] font-bold text-green-800">Normal</span>;
  return <span className="text-[10px] text-gray-500">?</span>;
}

function Vital({ label, value, unit, alert }: { label: string; value: number | null | undefined; unit: string; alert?: boolean }) {
  const missing = value == null;
  return (
    <div className={`rounded-md border px-2 py-1 text-center ${alert ? "border-red-700 bg-red-50" : "border-gray-300"}`}>
      <p className="text-[10px] uppercase tracking-wider text-gray-500">{label}</p>
      <p className={missing ? "text-gray-400" : alert ? "font-bold text-red-800" : "font-bold"}>
        {missing ? "—" : <>{value} <span className="text-xs font-normal">{unit}</span>{alert ? " ▲" : ""}</>}
      </p>
    </div>
  );
}

export default function Summary({ packet: p, referred }: { packet: Packet; referred: boolean }) {
  const h = p.history;
  const soap = p.soap as Record<string, string | boolean | null>;
  const aiOk = soap.ai_ok !== false;
  const score = urgencyScore(p);
  const style = URGENCY_STYLE[p.urgency] ?? URGENCY_STYLE.routine;

  const symptoms = h.symptoms.length
    ? h.symptoms
        .map((s) => {
          const extra = [s.duration_days != null ? `${s.duration_days} days` : null, s.severity].filter(Boolean).join(", ");
          return extra ? `${s.name} (${extra})` : s.name;
        })
        .join("; ")
    : "None";

  // Lab results, out-of-range ones first.
  const labs = labRows(p).sort((a, b) => Number(outOfRange(b)) - Number(outOfRange(a)));
  const badLabs = labs.filter(outOfRange);
  const labDates = [...new Set(labs.map((r) => r.report_date).filter(Boolean))].join(", ");
  const xrays = p.reports.filter((r) => r.kind === "xray").map((r) => (r.data as XrayReport).description);

  // Everything the doctor should look at first.
  const attention: React.ReactNode[] = [
    ...p.red_flags.map((f) => (
      <>
        <b>{f.rule}:</b> {f.evidence}
      </>
    )),
    ...badLabs.map((r) => (
      <>
        <b>
          {r.test} {r.flag === "low" ? "low ▼" : "high ▲"}:
        </b>{" "}
        {r.value} {r.unit}
        {r.ref_range ? ` (normal ${r.ref_range})` : ""}
      </>
    )),
    ...borderlineVitals(p).map((b) => (
      <>
        <b>{b.text}:</b> {b.value}
      </>
    )),
    ...(h.missing_info.length ? [<><b>Missing:</b> {h.missing_info.join(", ")}</>] : []),
  ];

  // Red when something is out of range; amber when only information is missing.
  const serious = attention.length > (h.missing_info.length ? 1 : 0);
  const box = serious
    ? { wrap: "border-red-700 bg-red-50", title: "text-red-800", dot: "text-red-700", text: "Needs attention" }
    : attention.length
      ? { wrap: "border-amber-500 bg-amber-50", title: "text-amber-800", dot: "text-amber-600", text: "Please check" }
      : { wrap: "border-green-600 bg-green-50", title: "text-green-800", dot: "", text: "Nothing out of range found" };

  const v = p.vitals;
  const flagged = (rule: string) => p.red_flags.some((f) => f.rule === rule);
  const to = p.facility?.name ?? p.hospital?.name ?? null;

  return (
    <article className="rounded-lg border border-gray-300 bg-white p-5 text-sm leading-snug text-gray-900 [print-color-adjust:exact] print:w-full print:rounded-none print:border-0 print:p-[10mm] print:text-[10pt] [&_*]:min-w-0">
      <header className="flex flex-wrap items-end justify-between gap-2 border-b-[3px] border-teal-800 pb-1.5">
        <div>
          <h2 className="text-lg font-extrabold text-teal-800">SwasthSetu</h2>
          <p className="text-xs text-gray-600">Triage summary for the doctor · AI-assisted, please verify</p>
        </div>
        <p className="text-right text-xs text-gray-700">
          <b>{p.label}</b>
          <br />
          {when(p.created_at)} · Entered by {p.entered_by ?? "not recorded"}
        </p>
      </header>

      {/* Urgency, patient, visit */}
      <div className="mt-2.5 grid gap-2 sm:grid-cols-3 print:grid-cols-3">
        <div className={`rounded-md border-2 px-3 py-2 ${style.box}`}>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-600">Urgency</p>
          <p className={`text-2xl font-extrabold leading-none ${style.text}`}>{p.urgency.toUpperCase()}</p>
          <p className="mt-1 text-xs">
            Score <b>{score.total} / 10</b> · {BAND_TEXT[p.urgency]}
          </p>
          <ScoreMeter total={score.total} />
          <div className="flex justify-between text-[9px] text-gray-600">
            <span>0–3 Routine</span>
            <span>4–6 Soon</span>
            <span>7–10 Urgent</span>
          </div>
          <p className="mt-1 text-[9px] leading-tight text-gray-600">
            {score.lines.length
              ? score.lines.map((l) => `${l.label} ${l.points >= 0 ? "+" : ""}${l.points}`).join(" · ")
              : "No red flags or abnormal results"}
            <br />
            Rules: {p.rules_urgency} · AI: {p.ai_urgency ?? "none"}
            {p.urgency_overridden ? " · changed by clinician" : ""}
          </p>
        </div>
        <Card title="Patient">
          <p className="text-base font-bold">{p.patient.name ?? p.patient.alias}</p>
          <p>
            {p.patient.age ?? "?"} years · {p.patient.sex ?? "?"} · {p.patient.language === "hi" ? "Hindi" : "English"}
          </p>
          <p>
            {p.patient.block} block{p.patient.phone ? ` · ${p.patient.phone}` : ""}
          </p>
          {p.patient.name && <p className="text-xs text-gray-500">{p.patient.alias}</p>}
        </Card>
        <Card title={referred ? "Visit booked" : "Visit (not booked yet)"}>
          <p className="text-base font-bold">{p.visit_at ? when(p.visit_at) : "No time chosen"}</p>
          <p>{to ?? "Hospital not chosen"}</p>
          {p.facility && p.distance_km != null && (
            <p>
              {p.distance_km} km · about {p.eta_minutes} min (estimate)
            </p>
          )}
          {!p.facility && p.hospital && <p className="text-xs text-gray-600">Found on Google Maps, not on SwasthSetu</p>}
        </Card>
      </div>

      {/* Needs attention */}
      <div
        className={`mt-2.5 break-inside-avoid rounded-md border-2 px-3 py-2 ${box.wrap}`}
      >
        <p className={`text-xs font-bold uppercase tracking-wider ${box.title}`}>{box.text}</p>
        {attention.length > 0 && (
          <ul className={`mt-1 gap-x-6 ${attention.length > 2 ? "sm:columns-2 print:columns-2" : ""}`}>
            {attention.map((item, i) => (
              <li key={i} className="break-inside-avoid py-px">
                <span className={box.dot}>● </span>
                {item}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Vitals */}
      <div className="mt-2.5 grid grid-cols-3 gap-1.5 sm:grid-cols-6 print:grid-cols-6">
        <Vital label="Temp" value={v.temp_c} unit="°C" alert={v.temp_c != null && v.temp_c >= 38} />
        <Vital label="Pulse" value={v.pulse} unit="/min" alert={flagged("Vitals: pulse")} />
        <Vital label="SpO2" value={v.spo2} unit="%" alert={v.spo2 != null && v.spo2 < 95} />
        <div className={`rounded-md border px-2 py-1 text-center ${flagged("Vitals: blood pressure") ? "border-red-700 bg-red-50" : "border-gray-300"}`}>
          <p className="text-[10px] uppercase tracking-wider text-gray-500">BP</p>
          <p className={v.bp_sys == null ? "text-gray-400" : "font-bold"}>{v.bp_sys == null ? "—" : `${v.bp_sys}/${v.bp_dia ?? "--"}`}</p>
        </div>
        <Vital label="Resp. rate" value={v.rr} unit="/min" />
        <Vital label="Weight" value={p.weight_kg} unit="kg" />
      </div>

      {/* Lab results */}
      <SectionTitle>
        Blood report{labDates ? ` · ${labDates}` : ""}
        {labs.length ? ` · ${badLabs.length} of ${labs.length} out of range` : ""}
      </SectionTitle>
      {labs.length ? (
        <div className="overflow-x-auto">
        <table className="w-full border-collapse text-[13px] print:text-[9pt]">
          <thead>
            <tr className="text-left text-[10px] uppercase tracking-wider text-gray-500">
              <th className="px-1.5 py-0.5 font-semibold">Test</th>
              <th className="px-1.5 py-0.5 font-semibold">Result</th>
              <th className="px-1.5 py-0.5 font-semibold">Flag</th>
              <th className="hidden w-1/4 px-1.5 py-0.5 font-semibold sm:table-cell print:table-cell">Where it falls</th>
              <th className="px-1.5 py-0.5 font-semibold">Normal range</th>
            </tr>
          </thead>
          <tbody>
            {labs.map((r, i) => (
              <tr key={i} className={`border-t border-gray-100 ${outOfRange(r) ? "bg-red-50 font-semibold" : ""}`}>
                <td className="px-1.5 py-1">{r.test}</td>
                <td className="whitespace-nowrap px-1.5 py-1">
                  {r.value} <span className="text-xs font-normal text-gray-500">{r.unit}</span>
                </td>
                <td className="px-1.5 py-1">
                  <FlagTag flag={r.flag} />
                </td>
                <td className="hidden px-1.5 py-1 sm:table-cell print:table-cell">
                  <RangeBar row={r} />
                </td>
                <td className="whitespace-nowrap px-1.5 py-1 text-xs font-normal text-gray-600">{r.ref_range || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      ) : (
        <p className="text-gray-600">No lab report added.</p>
      )}
      {xrays.length > 0 && (
        <p className="mt-1.5">
          <b>X-ray:</b> {xrays.join(" ")} <i className="text-xs">[Not a diagnosis. Needs radiologist review.]</i>
        </p>
      )}

      {/* History, assessment and plan */}
      <div className="grid gap-x-5 sm:grid-cols-2 print:grid-cols-2">
        <div className="space-y-0.5">
          <SectionTitle>History</SectionTitle>
          <p>
            <b>Reason:</b> {h.chief_complaint || h.english_text || p.raw_text || "None"}
          </p>
          <p>
            <b>Symptoms:</b> {symptoms}
          </p>
          <p>
            <b>Denied:</b> {none(h.negated_symptoms)}
          </p>
          <p>
            <b>Past illness:</b> {none(h.past_history)} · <b>Medicines:</b> {none(h.medicines)} · <b>Allergies:</b>{" "}
            {none(h.allergies)}
          </p>
          <p>
            <b>Patient&apos;s words:</b> {p.raw_text ? `"${p.raw_text}"` : "(form only)"}
            {p.patient.language === "hi" && h.english_text ? ` / ${h.english_text}` : ""}
          </p>
          <p>
            <b>Read-back confirmed:</b> {p.teachback.confirmed ? "Yes" : "No"}
            {p.teachback.rounds > 0 ? ` (${p.teachback.rounds} correction${p.teachback.rounds > 1 ? "s" : ""})` : ""}
          </p>
        </div>
        <div className="space-y-1">
          <SectionTitle>Assessment and plan</SectionTitle>
          <div className="rounded-md bg-teal-50 px-2 py-1.5">
            <p className="text-[10px] uppercase text-gray-500">Suggested assessment (not a diagnosis)</p>
            <p>{aiOk ? String(soap.assessment_suggested || "None") : "Not generated (AI unavailable)."}</p>
          </div>
          <div className="rounded-md bg-teal-50 px-2 py-1.5">
            <p className="text-[10px] uppercase text-gray-500">Suggested plan</p>
            <p>{aiOk ? String(soap.plan_suggested || "None") : "Not generated (AI unavailable)."}</p>
          </div>
          <p>
            <b>Why this hospital:</b> {p.reason_for_choice || "Not chosen"}
          </p>
          {p.partial_match && (
            <p>
              <b>Missing at this hospital:</b> {p.missing_capabilities.map((c) => CAPABILITY_LABELS[c] ?? c).join(", ")}
            </p>
          )}
          <p>
            <b>Needs:</b> {p.needed_capabilities.map((c) => (CAPABILITY_LABELS[c] ?? c).split(" / ")[0]).join(", ") || "None"}
          </p>
        </div>
      </div>

      {/* Sign-off */}
      <div className="mt-3 grid break-inside-avoid grid-cols-3 gap-3 rounded-md border border-dashed border-gray-400 px-3 py-2 text-xs">
        {["Doctor's name", "Final urgency", "Signature and time"].map((t) => (
          <div key={t}>
            {t}
            <div className="h-5 border-b border-gray-600" />
          </div>
        ))}
      </div>

      <p className="mt-3 border-t border-gray-300 pt-1 text-[10px] text-gray-500">
        Score and rules are illustrative and not clinically validated. Not a diagnosis.
      </p>
    </article>
  );
}
