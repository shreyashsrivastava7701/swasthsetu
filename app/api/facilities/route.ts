// GET /api/facilities: all facilities, for dropdowns.
import { supabase } from "@/lib/supabase";
import { getMe, notAllowed } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await getMe())) return notAllowed();
  const { data, error } = await supabase.from("facilities").select("*").order("name");
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ facilities: data });
}
