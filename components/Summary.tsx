// The one-page clinician summary (section 10). Same layout on screen, on
// paper and in the facility inbox. Every section is always shown; empty ones
// say "None". Urgency is written as a word so it reads in black and white.
import type { Packet } from "@/lib/packet";
import type { LabReport, XrayReport } from "@/lib/schemas";
import { vitalsText } from "@/lib/encounter";
import { CAPABILITY_LABELS } from "@/lib/rules";

const none = (items: string[]) => (items.length ? items.join(", ") : "None");

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-3 break-inside-avoid">
      <h3 className="border-b border-gray-400 text-xs font-bold uppercase tracking-wide">{title}</h3>
      <div className="mt-1 space-y-0.5">{children}</div>
    </section>
  );
}

export function when(iso: string): string {
  return new Date(iso).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short" });
}

export default function Summary({ packet: p, referred }: { packet: Packet; referred: boolean }) {
  const h = p.history;
  const soap = p.soap as Record<string, string | boolean | null>;

  const symptoms = h.symptoms.length
    ? h.symptoms
        .map((s) => {
          const extra = [s.duration_days != null ? `${s.duration_days} days` : null, s.severity].filter(Boolean).join(", ");
          return extra ? `${s.name} (${extra})` : s.name;
        })
        .join("; ")
    : "None";

  const labLines = p.reports
    .filter((r) => r.kind === "lab")
    .flatMap((r) => (r.data as LabReport).rows)
    .map((row) => {
      const flag = row.flag === "high" || row.flag === "low" ? ` ${row.flag.toUpperCase()}` : "";
      return `${row.test} ${row.value} ${row.unit}${flag}${row.ref_range ? ` (${row.ref_range})` : ""}`;
    });
  const xrays = p.reports.filter((r) => r.kind === "xray").map((r) => (r.data as XrayReport).description);

  const vitals = [vitalsText(p.vitals) || "None entered", p.weight_kg != null ? `Weight ${p.weight_kg} kg` : ""]
    .filter(Boolean)
    .join(" | ");
  const reason = h.chief_complaint || h.english_text || p.raw_text || "None";
  const aiOk = soap.ai_ok !== false;

  return (
    <article className="rounded-lg border border-gray-300 bg-white p-5 text-sm leading-snug print:rounded-none print:border-0 print:p-0 print:text-[11pt]">
      <header className="flex flex-wrap items-start justify-between gap-2 border-b-2 border-gray-800 pb-2">
        <h2 className="text-base font-bold">SWASTHSETU TRIAGE SUMMARY</h2>
        <p className="text-xs italic">{p.label}</p>
      </header>

      <div className="mt-2 space-y-0.5">
        <p>
          <b>Patient:</b> {p.patient.name ? `${p.patient.name} (${p.patient.alias})` : p.patient.alias} | {p.patient.age ?? "?"} y |{" "}
          {p.patient.sex ?? "?"} | {p.patient.language === "hi" ? "Hindi" : "English"}
          {p.patient.phone ? ` | Phone ${p.patient.phone}` : ""}
        </p>
        <p>
          <b>Date and time:</b> {when(p.created_at)} | <b>Entered by:</b> {p.entered_by ?? "Not recorded"}
        </p>
        <p>
          <b>From:</b> {p.patient.block} block | <b>To:</b> {p.facility?.name ?? p.hospital?.name ?? "Not chosen"}
          {!referred && " (not booked yet)"}
        </p>
        {p.visit_at && (
          <p>
            <b>Visit planned:</b> {when(p.visit_at)}
          </p>
        )}
        <p className="text-base">
          <b>URGENCY: {p.urgency.toUpperCase()}</b>{" "}
          <span className="text-xs">
            (rules: {p.rules_urgency} | AI: {p.ai_urgency ?? "none"} | {p.urgency_overridden ? "changed by clinician" : "final set by clinician"})
          </span>
        </p>
      </div>

      <Section title="Reason for visit">
        <p>{reason}</p>
      </Section>

      <Section title="Red flags">
        {p.red_flags.length ? p.red_flags.map((f, i) => <p key={i}>- {f.rule}: {f.evidence}</p>) : <p>None found</p>}
      </Section>

      <Section title="S  History">
        <p><b>Symptoms:</b> {symptoms}</p>
        <p><b>Denied:</b> {none(h.negated_symptoms)}</p>
        <p>
          <b>Past illness:</b> {none(h.past_history)} | <b>Medicines:</b> {none(h.medicines)} | <b>Allergies:</b> {none(h.allergies)}
        </p>
        <p>
          <b>Patient&apos;s words:</b> {p.raw_text ? `"${p.raw_text}"` : "(form only)"}
          {p.patient.language === "hi" && h.english_text ? ` / ${h.english_text}` : ""}
        </p>
        <p>
          <b>Read-back confirmed by patient:</b>{" "}
          {p.teachback.confirmed ? "Yes" : "No"}
          {p.teachback.rounds > 0 ? ` (${p.teachback.rounds} correction${p.teachback.rounds > 1 ? "s" : ""})` : ""}
        </p>
      </Section>

      <Section title="O  Findings">
        <p><b>Vitals:</b> {vitals}</p>
        <p><b>Reports:</b> {labLines.length ? labLines.join("; ") : "None"}</p>
        <p>
          <b>X-ray:</b> {xrays.length ? `${xrays.join(" ")} [Not a diagnosis. Needs radiologist review.]` : "None"}
        </p>
      </Section>

      <Section title="A  Assessment (suggested, not a diagnosis)">
        <p>{aiOk ? String(soap.assessment_suggested || "None") : "Not generated (AI unavailable)."}</p>
      </Section>

      <Section title="P  Plan (suggested)">
        <p>{aiOk ? String(soap.plan_suggested || "None") : "Not generated (AI unavailable)."}</p>
      </Section>

      <Section title="Referral">
        <p>
          <b>To:</b>{" "}
          {p.facility
            ? `${p.facility.name}, ${p.distance_km} km, about ${p.eta_minutes} min (estimate)`
            : p.hospital
              ? `${p.hospital.name}${p.hospital.address ? `, ${p.hospital.address}` : ""} (found on Google Maps, not on SwasthSetu)`
              : "Not chosen"}
        </p>
        <p><b>Why:</b> {p.reason_for_choice}</p>
        {p.partial_match && <p><b>Missing at this facility:</b> {p.missing_capabilities.map((c) => CAPABILITY_LABELS[c] ?? c).join(", ")}</p>}
        <p><b>Needs:</b> {p.needed_capabilities.map((c) => (CAPABILITY_LABELS[c] ?? c).split(" / ")[0]).join(", ")}</p>
        <p><b>Missing information:</b> {none(h.missing_info)}</p>
      </Section>

      <Section title="Sign-off">
        <p>Clinician: ______________________ &nbsp; Decision: confirmed / changed</p>
        <p>
          Final urgency: <span className="print:hidden">{p.urgency.toUpperCase()}{p.urgency_overridden ? " (changed by clinician)" : ""}</span>
          <span className="hidden print:inline">__________</span> &nbsp; Signature and time: ______________________
        </p>
      </Section>

      <p className="mt-4 border-t border-gray-400 pt-1 text-xs">Demo rules, to be validated by clinicians. Not a diagnosis.</p>
    </article>
  );
}
