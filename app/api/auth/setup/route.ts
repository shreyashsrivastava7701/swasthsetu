// POST /api/auth/setup: right after sign-up, save the profile.
// A hospital account also creates (or links) its hospital.
import { supabase } from "@/lib/supabase";
import { getUserId } from "@/lib/auth";
import { findBlock } from "@/lib/blocks";
import { CAPABILITIES } from "@/lib/rules";

export async function POST(request: Request) {
  const id = await getUserId(request);
  if (!id) return Response.json({ error: "Not logged in." }, { status: 401 });
  const body = await request.json();
  const role = body.role === "hospital" ? "hospital" : "patient";
  const name = String(body.name ?? "").trim();
  if (!name) return Response.json({ error: "Name is required." }, { status: 400 });

  let facility_id: string | null = null;
  if (role === "hospital") {
    const block = findBlock(body.block);
    if (!block) return Response.json({ error: "Choose the block." }, { status: 400 });
    const { data: existing } = await supabase.from("facilities").select("id").ilike("name", name).limit(1);
    if (existing?.length) {
      facility_id = existing[0].id;
    } else {
      const capabilities = (body.capabilities ?? []).filter((c: string) => (CAPABILITIES as readonly string[]).includes(c));
      const { data, error } = await supabase
        .from("facilities")
        .insert({
          name,
          block: block.name,
          lat: block.lat,
          lng: block.lng,
          capabilities: capabilities.length ? capabilities : ["general_doctor"],
          doctor_today: true,
          address: String(body.address ?? "").trim() || null,
          phone: String(body.phone ?? "").trim() || null,
        })
        .select("id")
        .single();
      if (error) return Response.json({ error: error.message }, { status: 500 });
      facility_id = data.id;
    }
  }

  const { error } = await supabase.from("profiles").upsert({
    id,
    role,
    name,
    phone: String(body.phone ?? "").trim() || null,
    facility_id,
  });
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ ok: true, role });
}
