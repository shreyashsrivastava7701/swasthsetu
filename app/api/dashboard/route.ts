// GET /api/dashboard: anonymous counts for the district dashboard.
// Reads only public_cases (block, syndrome, urgency, day). No names, phones or aliases.
import { supabase } from "@/lib/supabase";
import { istDay, shift, summarise, type PublicCase } from "@/lib/dashboard";

export const dynamic = "force-dynamic";

export async function GET() {
  const today = istDay();
  const { data, error } = await supabase
    .from("public_cases")
    .select("block, syndrome, urgency, day, is_demo")
    .gte("day", shift(today, -6))
    .order("day", { ascending: false })
    .limit(1000);
  if (error) return Response.json({ error: error.message }, { status: 500 });

  const cases = (data ?? []) as PublicCase[];
  return Response.json({ ...summarise(cases, today), recent: cases.slice(0, 15) });
}
