// A quick check that the app can reach the database.
// Open /api/health in the browser: it shows how many facilities exist (0 is fine for now).
import { supabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function GET() {
  const { count, error } = await supabase
    .from("facilities")
    .select("*", { count: "exact", head: true });

  if (error) {
    return Response.json({ ok: false, error: error.message }, { status: 500 });
  }
  return Response.json({ ok: true, facilities: count ?? 0 });
}
