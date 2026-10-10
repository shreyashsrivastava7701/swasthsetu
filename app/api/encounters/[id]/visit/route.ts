// POST /api/encounters/[id]/visit: the patient books a visit.
// Body: { facility_id } for a hospital on SwasthSetu, { google_index } for
// one found on Google Maps, or { custom_name } for a hospital the patient
// typed in; plus visit_at (date and time).
// Saves the referral (the hospital sees it at once), adds one anonymous row to
// the district dashboard, and marks the case as referred.
import { supabase } from "@/lib/supabase";
import { getMe, caseAccess, notAllowed } from "@/lib/auth";
import { loadCase, buildPacket } from "@/lib/packet";
import { istDay } from "@/lib/dashboard";
import type { Suggestions } from "@/lib/hospitals";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!(await caseAccess(await getMe(), id))?.owner) return notAllowed();
  const body = await request.json();

  const visitAt = new Date(body.visit_at);
  if (Number.isNaN(visitAt.getTime())) return Response.json({ error: "Choose the date and time of your visit." }, { status: 400 });
  if (visitAt.getTime() < Date.now() - 60 * 60 * 1000) return Response.json({ error: "The visit time is in the past." }, { status: 400 });

  const { e, reports, facilities } = await loadCase(id);
  if (!e) return Response.json({ error: "Case not found." }, { status: 404 });
  if (e.status === "referred") return Response.json({ error: "A visit is already booked for this case." }, { status: 409 });

  const saved = (e.soap as { hospital_suggestions?: Suggestions }).hospital_suggestions;
  let packet;
  if (body.facility_id) {
    const option = saved?.mode === "registered" ? saved.options.find((o) => o.facility_id === body.facility_id) : undefined;
    if (!facilities.some((f) => f.id === body.facility_id)) return Response.json({ error: "Hospital not found." }, { status: 400 });
    packet = buildPacket(e, reports, facilities, null, body.facility_id, { reason: option?.reason, visit_at: visitAt.toISOString() });
  } else if (typeof body.custom_name === "string") {
    const name = body.custom_name.trim().slice(0, 120);
    if (name.length < 3) return Response.json({ error: "Type the hospital's name." }, { status: 400 });
    packet = buildPacket(e, reports, facilities, null, null, {
      reason: "Chosen by the patient.",
      hospital: { name, address: "", url: null },
      visit_at: visitAt.toISOString(),
    });
  } else {
    const option = saved?.mode === "google" ? saved.options[Number(body.google_index)] : undefined;
    if (!option) return Response.json({ error: "Choose a hospital first." }, { status: 400 });
    packet = buildPacket(e, reports, facilities, null, null, {
      reason: option.reason,
      hospital: { name: option.name, address: option.address, url: option.url },
      visit_at: visitAt.toISOString(),
    });
  }

  const { error } = await supabase.from("referrals").insert({
    encounter_id: id,
    facility_id: packet.facility?.id ?? null,
    hospital: packet.hospital,
    visit_at: packet.visit_at,
    packet,
    distance_km: packet.distance_km,
    eta_minutes: packet.eta_minutes,
    status: "sent",
  });
  if (error) return Response.json({ error: `Could not save: ${error.message}` }, { status: 500 });

  // One anonymous row for the district dashboard. No name, phone or alias.
  await supabase.from("public_cases").insert({ block: e.block, syndrome: packet.syndrome, urgency: packet.urgency, day: istDay(), is_demo: false });

  await supabase
    .from("encounters")
    .update({ status: "referred", needed_capabilities: packet.needed_capabilities, syndrome: packet.syndrome })
    .eq("id", id);

  return Response.json({ ok: true, hospital: packet.facility?.name ?? packet.hospital?.name, visit_at: packet.visit_at });
}
