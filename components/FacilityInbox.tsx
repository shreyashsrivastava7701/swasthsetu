"use client";
// The hospital's dashboard: patients who booked a visit here, with their
// summary and visit time. Refreshes every 5 seconds and shows a banner when a
// new patient books.
import { useEffect, useRef, useState } from "react";
import type { Packet } from "@/lib/packet";
import Summary, { when } from "@/components/Summary";
import UrgencyChip from "@/components/UrgencyChip";

type Referral = { id: string; created_at: string; status: string; visit_at: string | null; packet: Packet };

// Dates in India as "YYYY-MM-DD", so "today" is right for the hospital.
const dayOf = (iso: string) => new Date(iso).toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
const timeOf = (iso: string | null) =>
  iso ? new Date(iso).toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata", hour: "numeric", minute: "2-digit" }) : "No time";
const dateOf = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", weekday: "short", day: "numeric", month: "short" }) : "";

const STATUS: Record<string, { text: string; style: string }> = {
  sent: { text: "NEW", style: "bg-teal-700 text-white" },
  seen: { text: "Summary read", style: "bg-gray-200 text-gray-800" },
  arrived: { text: "Arrived", style: "bg-green-700 text-white" },
};

function StatCard({ title, value }: { title: string; value: number }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <p className="text-sm text-gray-600">{title}</p>
      <p className="mt-1 text-3xl font-semibold">{value}</p>
    </div>
  );
}

export default function FacilityInbox({ facilityId, facilityName }: { facilityId: string; facilityName: string }) {
  const [referrals, setReferrals] = useState<Referral[] | null>(null);
  const [doctorToday, setDoctorToday] = useState(true);
  const [openId, setOpenId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [banner, setBanner] = useState("");
  const [tick, setTick] = useState(0); // bump to reload at once
  const known = useRef<Set<string> | null>(null);

  // Poll every 5 seconds.
  useEffect(() => {
    let alive = true;
    const load = () =>
      fetch(`/api/facilities/${facilityId}/referrals`)
        .then((r) => r.json())
        .then((d) => {
          if (!alive) return;
          if (d.error) return setError(d.error);
          setError("");
          const list: Referral[] = d.referrals;
          // A booking we have not seen before: show a banner.
          if (known.current) {
            const fresh = list.filter((r) => !known.current!.has(r.id));
            if (fresh.length) {
              const r = fresh[0];
              setBanner(`New patient booked: ${r.packet.patient.name || r.packet.patient.alias}, ${dateOf(r.visit_at)} ${timeOf(r.visit_at)}`);
            }
          }
          known.current = new Set(list.map((r) => r.id));
          setReferrals(list);
          setDoctorToday(d.doctor_today);
        })
        .catch(() => alive && setError("Could not reach the server. Retrying..."));
    load();
    const timer = setInterval(load, 5000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [facilityId, tick]);

  async function setStatus(id: string, status: "seen" | "arrived") {
    await fetch(`/api/referrals/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    setTick((t) => t + 1);
  }

  async function toggleDoctor() {
    const next = !doctorToday;
    setDoctorToday(next);
    await fetch(`/api/facilities/${facilityId}/referrals`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ doctor_today: next }),
    });
  }

  if (!referrals) return <p className="text-gray-600">{error || "Loading your patients..."}</p>;

  const open = referrals.find((r) => r.id === openId);

  // Full summary of one patient.
  if (open) {
    return (
      <div>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2 print:hidden">
          <button type="button" onClick={() => setOpenId(null)} className="text-sm text-teal-800 hover:underline">
            ← All patients
          </button>
          <div className="flex flex-wrap gap-2">
            {open.status === "sent" && (
              <button type="button" onClick={() => setStatus(open.id, "seen")} className="rounded border border-teal-700 px-4 py-2 font-medium text-teal-800">
                Mark summary as read
              </button>
            )}
            {open.status !== "arrived" ? (
              <button type="button" onClick={() => setStatus(open.id, "arrived")} className="rounded bg-green-700 px-4 py-2 font-medium text-white">
                Patient arrived
              </button>
            ) : (
              <span className="rounded border border-green-300 bg-green-50 px-4 py-2 text-sm text-green-800">✓ Arrived</span>
            )}
            <button type="button" onClick={() => window.print()} className="rounded border border-gray-400 px-4 py-2 font-medium text-gray-800">
              🖨 Print / PDF
            </button>
          </div>
        </div>
        <p className="mb-3 rounded border border-teal-200 bg-teal-50 p-3 print:hidden">
          <b>Visit:</b> {open.visit_at ? `${dateOf(open.visit_at)}, ${timeOf(open.visit_at)}` : "No time given"}
          {open.packet.patient.phone && (
            <>
              {" "}
              · <b>Phone:</b> <a href={`tel:${open.packet.patient.phone}`} className="underline">{open.packet.patient.phone}</a>
            </>
          )}
        </p>
        <Summary packet={open.packet} referred />
      </div>
    );
  }

  // Group by visit day.
  const today = dayOf(new Date().toISOString());
  const byTime = (a: Referral, b: Referral) => (a.visit_at ?? a.created_at).localeCompare(b.visit_at ?? b.created_at);
  const day = (r: Referral) => dayOf(r.visit_at ?? r.created_at);
  const todays = referrals.filter((r) => day(r) === today).sort(byTime);
  const upcoming = referrals.filter((r) => day(r) > today).sort(byTime);
  const earlier = referrals.filter((r) => day(r) < today).sort(byTime).reverse();
  const unread = referrals.filter((r) => r.status === "sent").length;

  const row = (r: Referral) => (
    <li key={r.id}>
      <button
        type="button"
        onClick={() => {
          setOpenId(r.id);
          if (r.status === "sent") setStatus(r.id, "seen");
        }}
        className={`flex w-full items-center gap-3 rounded-lg border bg-white p-3 text-left hover:border-teal-700 ${r.status === "sent" ? "border-teal-600" : "border-gray-200"}`}
      >
        <div className="w-20 shrink-0 text-center">
          <p className="text-lg font-semibold">{timeOf(r.visit_at)}</p>
          <p className="text-xs text-gray-500">{dateOf(r.visit_at)}</p>
        </div>
        <div className="flex-1">
          <p className="font-medium">
            {r.packet.patient.name || r.packet.patient.alias} · {r.packet.patient.age ?? "?"} y · {r.packet.patient.sex ?? "?"}
          </p>
          <p className="text-sm text-gray-600">{r.packet.history.chief_complaint || r.packet.history.english_text || "No complaint recorded"}</p>
          <p className="text-xs text-gray-500">From {r.packet.patient.block} · booked {when(r.created_at)}</p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <UrgencyChip urgency={r.packet.urgency} />
          <span className={`rounded px-2 py-0.5 text-xs font-semibold ${STATUS[r.status]?.style ?? ""}`}>{STATUS[r.status]?.text ?? r.status}</span>
        </div>
      </button>
    </li>
  );

  const group = (title: string, list: Referral[], empty: string) => (
    <section className="mt-6">
      <h2 className="font-semibold">
        {title} <span className="text-gray-500">({list.length})</span>
      </h2>
      {list.length === 0 ? <p className="mt-1 text-sm text-gray-600">{empty}</p> : <ul className="mt-2 space-y-2">{list.map(row)}</ul>}
    </section>
  );

  return (
    <div>
      <h1 className="text-2xl font-semibold">Incoming patients</h1>
      <p className="mt-1 text-gray-600">{facilityName}</p>

      {banner && (
        <div className="mt-3 flex items-center justify-between gap-2 rounded border border-teal-300 bg-teal-50 p-3 text-teal-900">
          <span>🔔 {banner}</span>
          <button type="button" onClick={() => setBanner("")} className="text-sm underline">
            OK
          </button>
        </div>
      )}
      {error && <p className="mt-2 text-sm text-red-700">{error}</p>}

      <label className="mt-3 flex items-center gap-2 text-sm">
        <input type="checkbox" checked={doctorToday} onChange={toggleDoctor} />
        Doctor available today (if unticked, patients are not sent here)
      </label>

      <div className="mt-4 grid grid-cols-3 gap-3">
        <StatCard title="Coming today" value={todays.length} />
        <StatCard title="Upcoming" value={upcoming.length} />
        <StatCard title="Not read yet" value={unread} />
      </div>

      {group("Today", todays, "No patients booked for today.")}
      {group("Upcoming", upcoming, "No upcoming visits.")}
      {group("Earlier", earlier, "None.")}
      <p className="mt-6 text-xs text-gray-500">Refreshes every 5 seconds. AI-generated summaries, for clinician review.</p>
    </div>
  );
}
