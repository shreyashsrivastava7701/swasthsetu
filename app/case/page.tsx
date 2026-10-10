// My cases: the logged-in patient's own cases only.
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import UrgencyChip from "@/components/UrgencyChip";
import { requireMe } from "@/lib/auth";

export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<string, string> = {
  draft: "Note created",
  patient_confirmed: "Patient confirmed",
  referred: "Referred",
};

export default async function CaseListPage() {
  const me = await requireMe("patient");
  const { data, error } = await supabase
    .from("encounters")
    .select("id, created_at, alias, patient_name, block, age, sex, urgency, status")
    .eq("owner_id", me.id)
    .order("created_at", { ascending: false })
    .limit(50);

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">My cases / मेरे केस</h1>
        <Link href="/intake" className="rounded bg-teal-700 px-4 py-2 text-sm font-medium text-white">
          + New case / नया केस
        </Link>
      </div>

      {error && <p className="mt-4 text-red-700">Could not load cases: {error.message}</p>}
      {data && data.length === 0 && <p className="mt-6 text-gray-600">No cases yet.</p>}

      <ul className="mt-4 space-y-2">
        {data?.map((e) => (
          <li key={e.id}>
            <Link href={`/case/${e.id}`} className="flex items-center gap-3 rounded-lg border border-gray-200 bg-white p-4 hover:border-teal-700">
              <UrgencyChip urgency={e.urgency} />
              <div className="flex-1">
                <p className="font-medium">{e.patient_name || e.alias}</p>
                <p className="text-sm text-gray-600">
                  {e.age} y · {e.sex} · {e.block} · {STATUS_LABEL[e.status] ?? e.status}
                </p>
              </div>
              <span className="text-xs text-gray-500">
                {new Date(e.created_at).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
