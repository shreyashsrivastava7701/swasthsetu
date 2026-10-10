// /facility: a logged-in hospital sees the patients sent to it.
import FacilityInbox from "@/components/FacilityInbox";
import { requireMe } from "@/lib/auth";
import { supabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export default async function FacilityPage() {
  const me = await requireMe("hospital");
  if (!me.facility_id) return <p>This account is not linked to a hospital. Register the hospital again.</p>;
  const { data: f } = await supabase.from("facilities").select("name").eq("id", me.facility_id).single();
  return <FacilityInbox facilityId={me.facility_id} facilityName={f?.name ?? me.name} />;
}
