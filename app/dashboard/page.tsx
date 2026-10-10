"use client";
// /dashboard: anonymous district view for the health officer. Only block,
// syndrome, urgency and date are shown. Refreshes every 10 seconds.
import { useEffect, useState } from "react";
import { SYNDROME_LABELS, type Cluster, type PublicCase } from "@/lib/dashboard";
import UrgencyChip from "@/components/UrgencyChip";
import DistrictMap from "@/components/DistrictMap";

type Data = {
  today: string;
  today_count: number;
  last3_count: number;
  alert_count: number;
  clusters: Cluster[];
  by_syndrome: { syndrome: string; count: number }[];
  by_block: Record<string, number>;
  has_demo: boolean;
  recent: PublicCase[];
};

const label = (s: string) => SYNDROME_LABELS[s] ?? s;
const shortDay = (d: string) => new Date(`${d}T00:00:00`).toLocaleDateString("en-IN", { day: "numeric", month: "short" });

function Card({ title, value, tone = "" }: { title: string; value: number; tone?: string }) {
  return (
    <div className={`rounded-lg border bg-white p-4 ${tone || "border-gray-200"}`}>
      <p className="text-sm text-gray-600">{title}</p>
      <p className="mt-1 text-3xl font-semibold">{value}</p>
    </div>
  );
}

export default function Dashboard() {
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    const load = () =>
      fetch("/api/dashboard")
        .then((r) => r.json())
        .then((d) => {
          if (!alive) return;
          if (d.error) setError(d.error);
          else {
            setError("");
            setData(d);
          }
        })
        .catch(() => alive && setError("Could not reach the server. Retrying..."));
    load();
    const timer = setInterval(load, 10000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, []);

  if (!data) return <p className="text-gray-600">{error || "Loading the dashboard..."}</p>;

  const max = Math.max(1, ...data.by_syndrome.map((s) => s.count));

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold">District dashboard</h1>
        {data.has_demo && (
          <span className="rounded-full border border-gray-400 bg-gray-100 px-3 py-1 text-xs font-medium text-gray-700">
            includes simulated cases
          </span>
        )}
      </div>
      <p className="mt-1 text-sm text-gray-600">
        Anonymous referred cases, Hamirpur district. No names or addresses. Refreshes every 10 seconds.
      </p>
      {error && <p className="mt-2 text-sm text-red-700">{error}</p>}

      <div className="mt-4 grid grid-cols-3 gap-3">
        <Card title="Cases today" value={data.today_count} />
        <Card title="Last 3 days" value={data.last3_count} />
        <Card title="Alerts" value={data.alert_count} tone={data.alert_count ? "border-red-400" : ""} />
      </div>

      <h2 className="mt-6 font-semibold">Clusters (last 3 days)</h2>
      {data.clusters.length === 0 ? (
        <p className="mt-1 text-sm text-gray-600">No clusters. A cluster is 3 or more cases of the same kind in one block.</p>
      ) : (
        <ul className="mt-2 space-y-2">
          {data.clusters.map((c) => (
            <li
              key={`${c.block}-${c.syndrome}`}
              className={`flex flex-wrap items-center gap-3 rounded-lg border p-3 ${c.level === "alert" ? "border-red-300 bg-red-50" : "border-amber-300 bg-amber-50"}`}
            >
              <span
                className={`rounded px-2 py-0.5 text-xs font-bold uppercase text-white ${c.level === "alert" ? "bg-red-700" : "bg-amber-600"}`}
              >
                {c.level}
              </span>
              <span className="font-medium">{c.block}</span>
              <span className="flex-1">{label(c.syndrome)}</span>
              <span className="text-sm">
                <b>{c.count}</b> cases · {shortDay(c.from)} to {shortDay(c.to)}
              </span>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-1 text-xs text-gray-500">Alert = 5 or more cases, Watch = 3 or 4. A simple count rule, not an outbreak finding.</p>

      <div className="mt-6 grid gap-6">
        <div>
          <h2 className="font-semibold">Cases by kind (last 7 days)</h2>
          <div className="mt-2 space-y-2">
            {data.by_syndrome.length === 0 && <p className="text-sm text-gray-600">No cases yet.</p>}
            {data.by_syndrome.map((s) => (
              <div key={s.syndrome}>
                <div className="flex justify-between text-sm">
                  <span>{label(s.syndrome)}</span>
                  <span className="font-medium">{s.count}</span>
                </div>
                <div className="mt-0.5 h-3 rounded bg-gray-200">
                  <div className="h-3 rounded bg-teal-700" style={{ width: `${(s.count / max) * 100}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
        <div>
          <h2 className="font-semibold">Hamirpur district map (last 3 days)</h2>
          <div className="mt-2">
            <DistrictMap byBlock={data.by_block} clusters={data.clusters} />
          </div>
          <p className="mt-1 text-xs text-gray-500">Circles sit at approximate block centres. Red = Alert, amber = Watch.</p>
        </div>
      </div>

      <h2 className="mt-6 font-semibold">Recent cases</h2>
      <div className="mt-2 overflow-x-auto rounded-lg border border-gray-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-gray-50 text-gray-600">
            <tr>
              <th className="p-2">Day</th>
              <th className="p-2">Block</th>
              <th className="p-2">Kind</th>
              <th className="p-2">Urgency</th>
            </tr>
          </thead>
          <tbody>
            {data.recent.length === 0 && (
              <tr>
                <td colSpan={4} className="p-2 text-gray-600">
                  No cases yet.
                </td>
              </tr>
            )}
            {data.recent.map((c, i) => (
              <tr key={i} className="border-t border-gray-100">
                <td className="p-2">{shortDay(c.day)}</td>
                <td className="p-2">{c.block}</td>
                <td className="p-2">{label(c.syndrome).split(" / ")[0]}</td>
                <td className="p-2">
                  <UrgencyChip urgency={c.urgency} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
