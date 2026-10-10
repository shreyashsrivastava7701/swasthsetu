"use client";
// Step 3 for the patient: see the suggested hospitals, pick one, choose when
// to visit, and book. The hospital sees the case at once. Then log out.
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Suggestions } from "@/lib/hospitals";
import { supabaseBrowser, saveToken } from "@/lib/supabase-browser";

export type Booked = { hospital: string; visit_at: string | null; status: string; onApp: boolean };

const visitText = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "full", timeStyle: "short" }) : "Not set";

// The earliest time that can be picked (now), in the format the date box needs.
function nowLocal(): string {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
}

export default function HospitalPanel({ id, booked }: { id: string; booked: Booked | null }) {
  const router = useRouter();
  const [data, setData] = useState<Suggestions | null>(null);
  const [choice, setChoice] = useState("");
  const [visitAt, setVisitAt] = useState("");
  const [loadError, setLoadError] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const [minTime] = useState(nowLocal);

  useEffect(() => {
    if (booked) return;
    let alive = true;
    fetch(`/api/encounters/${id}/hospitals${refresh ? "?refresh=1" : ""}`)
      .then(async (r) => {
        const d = await r.json();
        if (!alive) return;
        if (!r.ok) return setLoadError(d.error ?? "Could not load hospitals.");
        setLoadError("");
        setData(d);
        if (d.options?.length) setChoice(d.mode === "registered" ? d.options[0].facility_id : "0");
      })
      .catch(() => alive && setLoadError("Could not reach the server. Try again."));
    return () => {
      alive = false;
    };
  }, [id, booked, refresh]);

  async function book() {
    setError("");
    if (!visitAt) return setError("Choose the date and time of your visit. / आने की तारीख और समय चुनें।");
    setBusy(true);
    const res = await fetch(`/api/encounters/${id}/visit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        visit_at: new Date(visitAt).toISOString(),
        ...(data?.mode === "registered" ? { facility_id: choice } : { google_index: Number(choice) }),
      }),
    });
    const d = await res.json();
    setBusy(false);
    if (!res.ok) return setError(d.error ?? "Could not book.");
    router.refresh();
  }

  async function logout() {
    await supabaseBrowser.auth.signOut();
    saveToken(null);
    router.push("/");
    router.refresh();
  }

  // Booked: confirmation, summary download, log out.
  if (booked) {
    return (
      <div className="rounded-lg border border-green-300 bg-green-50 p-5">
        <p className="text-lg font-semibold text-green-900">✓ विज़िट बुक हो गई / Visit booked</p>
        <p className="mt-2">
          <b>Hospital:</b> {booked.hospital}
        </p>
        <p>
          <b>When / कब:</b> {visitText(booked.visit_at)}
        </p>
        {booked.onApp ? (
          <p className="mt-2 text-sm text-green-900">
            The hospital has your summary already{booked.status === "seen" ? " and has seen it" : ""}. Please still carry it.
            <br />
            अस्पताल के पास आपकी जानकारी पहुँच गई है। फिर भी अपनी रिपोर्ट साथ लाएँ।
          </p>
        ) : (
          <p className="mt-2 text-sm font-medium text-amber-900">
            This hospital is not on SwasthSetu. Print or save your summary and carry it with you.
            <br />
            यह अस्पताल SwasthSetu पर नहीं है। अपनी रिपोर्ट प्रिंट करके साथ ले जाएँ।
          </p>
        )}
        <div className="mt-4 flex flex-wrap gap-3">
          <Link href={`/case/${id}/summary`} className="rounded border border-teal-700 bg-white px-4 py-3 font-medium text-teal-800">
            📄 Summary report (PDF) / रिपोर्ट
          </Link>
          <button type="button" onClick={logout} className="rounded bg-teal-700 px-5 py-3 font-medium text-white">
            Finish and log out / लॉग आउट
          </button>
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="rounded border border-red-300 bg-red-50 p-4 text-red-800">
        <p>{loadError}</p>
        <button type="button" onClick={() => setRefresh((n) => n + 1)} className="mt-2 underline">
          Try again
        </button>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-5 text-gray-700">
        Finding the best hospitals for you on Google... This can take up to a minute.
        <br />
        आपके लिए सबसे अच्छे अस्पताल खोजे जा रहे हैं...
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <h2 className="font-semibold">Choose a hospital / अस्पताल चुनें</h2>
      {data.mode === "registered" && (
        <p className="mt-1 text-xs text-gray-500">
          {data.source === "google" ? "Ranked with Google Search for your problem." : "Ranked by what you need and distance."} Only hospitals on SwasthSetu
          are shown, so they get your summary straight away.
        </p>
      )}
      {data.note && <p className="mt-2 rounded border border-amber-300 bg-amber-50 p-2 text-sm text-amber-900">{data.note}</p>}

      <div className="mt-3 space-y-2">
        {data.mode === "registered" &&
          data.options.map((o, i) => (
            <label
              key={o.facility_id}
              className={`block cursor-pointer rounded-lg border p-3 ${choice === o.facility_id ? "border-teal-700 bg-teal-50" : "border-gray-200"}`}
            >
              <div className="flex items-start gap-3">
                <input type="radio" name="hospital" checked={choice === o.facility_id} onChange={() => setChoice(o.facility_id)} className="mt-1" />
                <div>
                  <p className="font-semibold">
                    {o.name} {i === 0 && <span className="ml-1 rounded bg-teal-700 px-2 py-0.5 text-xs text-white">Best match</span>}
                  </p>
                  <p className="text-sm text-gray-600">
                    {o.block} · {o.distance_km < 1 ? "in your block" : `${o.distance_km} km · about ${o.eta_minutes} min`}
                    {o.phone ? ` · 📞 ${o.phone}` : ""}
                  </p>
                  {o.address && <p className="text-sm text-gray-600">{o.address}</p>}
                  <p className="mt-1 text-sm">{o.reason}</p>
                </div>
              </div>
            </label>
          ))}
        {data.mode === "google" &&
          data.options.map((o, i) => (
            <label
              key={i}
              className={`block cursor-pointer rounded-lg border p-3 ${choice === String(i) ? "border-teal-700 bg-teal-50" : "border-gray-200"}`}
            >
              <div className="flex items-start gap-3">
                <input type="radio" name="hospital" checked={choice === String(i)} onChange={() => setChoice(String(i))} className="mt-1" />
                <div>
                  <p className="font-semibold">{o.name}</p>
                  {o.address && <p className="text-sm text-gray-600">{o.address}</p>}
                  <p className="mt-1 text-sm">{o.reason}</p>
                  {o.url && (
                    <a href={o.url} target="_blank" rel="noreferrer" className="text-sm text-teal-800 underline">
                      Open in Google Maps
                    </a>
                  )}
                </div>
              </div>
            </label>
          ))}
      </div>

      {data.mode !== "none" && (
        <>
          <label className="mt-4 block text-sm font-medium">
            When will you visit? / आप कब जाएँगे?
            <input
              type="datetime-local"
              min={minTime}
              value={visitAt}
              onChange={(e) => setVisitAt(e.target.value)}
              className="mt-1 block w-full rounded border border-gray-300 bg-white px-3 py-2"
            />
          </label>
          {error && <p className="mt-2 text-sm text-red-700">{error}</p>}
          <button type="button" onClick={book} disabled={busy || !choice} className="mt-4 w-full rounded bg-teal-700 px-5 py-3 font-medium text-white disabled:opacity-50">
            {busy ? "Booking..." : "Book visit / विज़िट बुक करें"}
          </button>
        </>
      )}

      <div className="mt-3 flex flex-wrap justify-between gap-2 text-sm">
        <Link href={`/case/${id}/summary`} className="text-teal-800 underline">
          📄 Summary report (PDF)
        </Link>
        <button type="button" onClick={() => { setData(null); setRefresh((n) => n + 1); }} className="text-gray-600 underline">
          Search again
        </button>
      </div>
    </div>
  );
}
