// One case, in three tabs: 1 Read-back (patient confirms), 2 Reports,
// 3 Review and refer (the note for the clinician).
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireMe, caseAccess } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import UrgencyChip from "@/components/UrgencyChip";
import SafetyFooter from "@/components/SafetyFooter";
import Tabs from "@/components/Tabs";
import ReadBack from "@/components/ReadBack";
import DeleteCaseButton from "@/components/DeleteCaseButton";
import Reports from "@/components/Reports";
import HospitalPanel, { type Booked } from "@/components/HospitalPanel";
import type { LabReport, XrayReport } from "@/lib/schemas";
import { vitalsText } from "@/lib/encounter";
import type { History } from "@/lib/schemas";
import { CAPABILITY_LABELS, type RuleFlag } from "@/lib/rules";

export const dynamic = "force-dynamic";

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500">{title}</h3>
      <div className="mt-1 whitespace-pre-wrap">{children}</div>
    </div>
  );
}

const list = (items: string[]) => (items.length ? items.join(", ") : "None");

export default async function CasePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  // Only the patient who made the case may open and change it.
  // A hospital it was sent to sees the read-only summary instead.
  const access = await caseAccess(await requireMe(), id);
  if (!access) notFound();
  if (!access.owner) redirect(`/case/${id}/summary`);
  const { data: e } = await supabase.from("encounters").select("*").eq("id", id).single();
  if (!e) notFound();
  const { data: reportRows } = await supabase.from("reports").select("id, kind, data").eq("encounter_id", id).order("created_at");
  const { data: sentRows } = await supabase
    .from("referrals")
    .select("status, visit_at, facility_id, hospital, facilities(name)")
    .eq("encounter_id", id)
    .order("created_at", { ascending: false })
    .limit(1);
  const s0 = sentRows?.[0] as
    | { status: string; visit_at: string | null; facility_id: string | null; hospital: { name: string } | null; facilities: { name: string } | { name: string }[] | null }
    | undefined;
  const booked: Booked | null = s0
    ? {
        hospital: (Array.isArray(s0.facilities) ? s0.facilities[0]?.name : s0.facilities?.name) ?? s0.hospital?.name ?? "Hospital",
        visit_at: s0.visit_at,
        status: s0.status,
        onApp: Boolean(s0.facility_id),
      }
    : null;
  const reports = (reportRows ?? []) as { id: string; kind: string; data: LabReport | XrayReport }[];

  // Saved reports as text lines for the O (findings) section.
  const reportLines = reports.flatMap((r) =>
    r.kind === "lab"
      ? (r.data as LabReport).rows.map(
          (row) => `${row.test} ${row.value} ${row.unit}${row.flag === "high" || row.flag === "low" ? ` ${row.flag.toUpperCase()}` : ""} (${row.ref_range || "no range"})`
        )
      : [`X-ray: ${(r.data as XrayReport).description} [Not a diagnosis. Needs radiologist review.]`]
  );

  const history = e.history as History;
  const flags = e.rule_flags as RuleFlag[];
  const soap = e.soap as Record<string, string | boolean | null>;

  const review = (
    <div>
      {/* Red flags from the fixed rules */}
      <div className="mt-4">
        <h2 className="font-semibold">Red flags</h2>
        {flags.length === 0 ? (
          <p className="text-sm text-gray-600">None found by the rules.</p>
        ) : (
          <div className="mt-1 flex flex-wrap gap-2">
            {flags.map((f, i) => (
              <span key={i} className="rounded-full border border-red-300 bg-red-50 px-3 py-1 text-sm text-red-800">
                {f.rule}: {f.evidence}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Original words next to the English version */}
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <Block title="Patient's words">{e.raw_text || "(form only)"}</Block>
        <Block title="English">{history.english_text || "None"}</Block>
      </div>

      <h2 className="mt-6 font-semibold">SOAP note</h2>
      <div className="mt-2 space-y-3">
        <Block title="S · Subjective">{String(soap.subjective ?? "")}</Block>
        <Block title="O · Objective">
          {String(soap.objective || vitalsText(e.vitals) || "No objective findings entered")}
          {reportLines.length > 0 && `\n\nReports:\n${reportLines.join("\n")}`}
        </Block>
        <Block title="A · Assessment (suggested, not a diagnosis)">{String(soap.assessment_suggested ?? "")}</Block>
        <Block title="P · Plan (suggested)">{String(soap.plan_suggested ?? "")}</Block>
      </div>

      <h2 className="mt-6 font-semibold">History details</h2>
      <div className="mt-2 grid gap-3 sm:grid-cols-2">
        <Block title="Symptoms">
          {history.symptoms.length
            ? history.symptoms
                .map((s) => [s.name, s.duration_days != null ? `${s.duration_days} days` : null, s.severity].filter(Boolean).join(", "))
                .join("\n")
            : "None"}
        </Block>
        <Block title="Denied">{list(history.negated_symptoms)}</Block>
        <Block title="Past illness · Medicines · Allergies">
          {`${list(history.past_history)}\n${list(history.medicines)}\n${list(history.allergies)}`}
        </Block>
        <Block title="Missing information">{list(history.missing_info)}</Block>
      </div>

      <div className="mt-4">
        <Block title="Needs at the hospital">
          {(e.needed_capabilities as string[]).map((c) => CAPABILITY_LABELS[c] ?? c).join("\n") || "None"}
        </Block>
      </div>

      <SafetyFooter />
    </div>
  );

  return (
    <div>
      <div className="flex items-center justify-between">
        <Link href="/case" className="text-sm text-teal-800 hover:underline">← My cases</Link>
        <DeleteCaseButton id={e.id} />
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold">{e.patient_name || e.alias}</h1>
        <UrgencyChip urgency={e.urgency} />
      </div>
      <p className="text-sm text-gray-600">
        {e.patient_name ? `${e.alias} · ` : ""}
        {e.patient_phone ? `📞 ${e.patient_phone} · ` : ""}
        {e.age} y · {e.sex} · {e.block} · {e.language === "hi" ? "Hindi" : "English"} · entered by {e.entered_by ?? "?"}
      </p>
      <p className="mt-1 text-xs text-gray-500">
        Urgency: rules decided at least the band shown; AI suggested {e.ai_urgency ?? "nothing"}.
        {soap.urgency_reason ? ` AI reason: ${soap.urgency_reason}` : ""}
      </p>

      {soap.ai_ok === false && (
        <p className="mt-3 rounded border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
          The AI could not read this. Reason: {String(soap.ai_error ?? "unknown")}. This note was built from the form. Assessment and plan were not generated.
        </p>
      )}

      <div className="mt-6">
        <Tabs
          start={e.status === "draft" ? 0 : 2}
          tabs={[
            {
              label: "1 · Read-back",
              content: (
                <ReadBack id={e.id} language={e.language} readback={e.readback_text} readbackEnglish={String(soap.readback_english ?? "")} status={e.status} rounds={e.teachback_rounds} />
              ),
            },
            { label: "2 · Reports", content: <Reports id={e.id} saved={reports} /> },
            { label: "3 · Hospital / अस्पताल", content: <HospitalPanel id={e.id} booked={booked} /> },
            { label: "4 · Doctor's note", content: review },
          ]}
        />
      </div>
    </div>
  );
}
