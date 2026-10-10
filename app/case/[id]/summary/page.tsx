// /case/[id]/summary: the one-page clinician summary, ready to print or save as PDF.
// After referral it shows the packet that was sent; before that, a preview.
import Link from "next/link";
import { notFound } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { loadCase, buildPacket, type Packet } from "@/lib/packet";
import Summary from "@/components/Summary";
import PrintButton from "@/components/PrintButton";
import { requireMe, caseAccess } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function SummaryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const me = await requireMe();
  const access = await caseAccess(me, id);
  if (!access) notFound();
  const { e, reports } = await loadCase(id);
  if (!e) notFound();

  const { data: sent } = await supabase
    .from("referrals")
    .select("packet")
    .eq("encounter_id", id)
    .order("created_at", { ascending: false })
    .limit(1);
  const packet: Packet = sent?.[0]?.packet ?? buildPacket(e, reports, [], null, null); // preview: no hospital chosen yet

  return (
    <div>
      <div className="mb-4 flex items-center justify-between print:hidden">
        <Link href={access.owner ? `/case/${id}` : "/facility"} className="text-sm text-teal-800 hover:underline">
          {access.owner ? "← Back to case" : "← Incoming patients"}
        </Link>
        <PrintButton />
      </div>
      <Summary packet={packet} referred={Boolean(sent?.length)} />
    </div>
  );
}
