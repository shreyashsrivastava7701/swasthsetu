"use client";
// Step 2 of a case: add a lab report or X-ray. Take or upload a photo, the AI
// reads it, you check or edit the result, then Save to case. Lab rows can also
// be typed by hand. The photo itself is never stored.
import { useState } from "react";
import { useRouter } from "next/navigation";
import { prepareFile } from "@/lib/image";
import { getProvider } from "@/lib/provider";
import { computeFlag } from "@/lib/labs";
import type { LabReport, LabRow, XrayReport } from "@/lib/schemas";

const FLAG_STYLE: Record<string, string> = {
  high: "bg-red-50 text-red-800 font-semibold",
  low: "bg-blue-50 text-blue-800 font-semibold",
  normal: "",
  unknown: "text-gray-500",
};

const emptyRow = (): LabRow => ({ test: "", value: "", unit: "", ref_range: "", flag: "unknown" });

export default function Reports({ id, saved }: { id: string; saved: { id: string; kind: string; data: LabReport | XrayReport }[] }) {
  const router = useRouter();
  const [kind, setKind] = useState<"lab" | "xray">("lab");
  const [files, setFiles] = useState<File[]>([]);
  const [lab, setLab] = useState<LabReport | null>(null);
  const [xray, setXray] = useState<XrayReport | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  function reset(k: "lab" | "xray") {
    setKind(k);
    setLab(null);
    setXray(null);
    setFiles([]);
    setError("");
    setMessage("");
  }

  async function read() {
    if (files.length === 0) return;
    if (files.some((f) => f.size > 10 * 1024 * 1024)) return setError("Each file must be under 10 MB.");
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const images = await Promise.all(files.slice(0, 5).map(prepareFile));
      const res = await fetch(`/api/encounters/${id}/report`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "read", kind, images, provider: getProvider() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      if (kind === "lab") setLab(data.data);
      else setXray(data.data);
    } catch (err) {
      setError(`${err instanceof Error ? err.message : String(err)} You can type the rows by hand instead.`);
    } finally {
      setBusy(false);
    }
  }

  // Edit one cell; the flag is re-checked in code right away.
  function editCell(i: number, field: keyof LabRow, value: string) {
    if (!lab) return;
    const rows = lab.rows.map((r, j) => {
      if (j !== i) return r;
      const updated = { ...r, [field]: value } as LabRow;
      return { ...updated, flag: computeFlag({ ...updated, flag: "unknown" }) };
    });
    setLab({ ...lab, rows });
  }

  async function save() {
    setBusy(true);
    setError("");
    const res = await fetch(`/api/encounters/${id}/report`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "save", kind, data: kind === "lab" ? lab : xray }),
    });
    setBusy(false);
    if (!res.ok) return setError((await res.json()).error ?? "Could not save.");
    reset(kind);
    setMessage("Saved to case ✓");
    router.refresh();
  }

  const input = "w-full rounded border border-gray-300 px-2 py-1 text-sm";

  return (
    <div>
      {/* Lab or X-ray */}
      <div className="flex gap-2">
        {(["lab", "xray"] as const).map((k) => (
          <button key={k} type="button" onClick={() => reset(k)} className={`flex-1 rounded border px-4 py-3 font-medium ${kind === k ? "border-teal-700 bg-teal-700 text-white" : "border-gray-300 bg-white"}`}>
            {k === "lab" ? "Lab report / जाँच रिपोर्ट" : "X-ray / एक्स-रे"}
          </button>
        ))}
      </div>

      {/* Photo */}
      <div className="mt-4 rounded-lg border border-gray-200 bg-white p-4">
        <label className="block text-sm font-medium">Photos or PDFs, up to 5 / फ़ोटो या PDF</label>
        <input
          type="file"
          multiple
          accept={kind === "lab" ? "image/*,application/pdf" : "image/*"}
          onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
          className="mt-2 block text-sm"
        />
        {files.length > 0 && (
          <ul className="mt-2 text-xs text-gray-600">
            {files.map((f, i) => <li key={i}>• {f.name} ({Math.round(f.size / 1024)} KB)</li>)}
          </ul>
        )}
        <div className="mt-3 flex flex-wrap gap-3">
          <button onClick={read} disabled={files.length === 0 || busy} className="rounded bg-teal-700 px-5 py-3 font-medium text-white disabled:opacity-50">
            {busy && !lab && !xray ? "Reading..." : files.length > 1 ? `Read ${files.length} files` : "Read"}
          </button>
          {kind === "lab" && !lab && (
            <button onClick={() => setLab({ kind: "lab", report_date: null, rows: [emptyRow()], notes: null, confidence: "typed" })} className="rounded border border-gray-300 px-5 py-3">
              Type rows by hand
            </button>
          )}
        </div>
        <p className="mt-2 text-xs text-gray-500">Several pages or files are combined into one table. PDFs are read by Gemini. Use sample reports only; files are not saved.</p>
      </div>

      {/* Lab result: editable table */}
      {lab && (
        <div className="mt-4 rounded-lg border border-gray-200 bg-white p-4">
          <p className="text-sm text-gray-600">
            Check every row against the paper. Edit any mistake. <span className="text-red-700">Red = high</span>, <span className="text-blue-700">blue = low</span>.
            {lab.confidence && lab.confidence !== "typed" ? ` Legibility: ${lab.confidence}.` : ""}
          </p>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[520px] text-sm">
              <thead>
                <tr className="text-left text-gray-500">
                  <th className="p-1">Test</th><th className="p-1">Value</th><th className="p-1">Unit</th><th className="p-1">Normal range</th><th className="p-1">Flag</th><th />
                </tr>
              </thead>
              <tbody>
                {lab.rows.map((r, i) => (
                  <tr key={i} className={FLAG_STYLE[r.flag]}>
                    <td className="p-1"><input value={r.test} onChange={(e) => editCell(i, "test", e.target.value)} className={input} /></td>
                    <td className="p-1"><input value={r.value} onChange={(e) => editCell(i, "value", e.target.value)} className={input} /></td>
                    <td className="p-1"><input value={r.unit} onChange={(e) => editCell(i, "unit", e.target.value)} className={input} /></td>
                    <td className="p-1"><input value={r.ref_range} onChange={(e) => editCell(i, "ref_range", e.target.value)} className={input} /></td>
                    <td className="p-1 uppercase">{r.flag === "unknown" ? "?" : r.flag}</td>
                    <td className="p-1">
                      <button onClick={() => setLab({ ...lab, rows: lab.rows.filter((_, j) => j !== i) })} className="text-gray-400" title="Remove row">✕</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {lab.notes && <p className="mt-2 text-sm text-gray-600">Notes: {lab.notes}</p>}
          <div className="mt-3 flex gap-3">
            <button onClick={() => setLab({ ...lab, rows: [...lab.rows, emptyRow()] })} className="rounded border border-gray-300 px-4 py-2 text-sm">+ Add row</button>
            <button onClick={save} disabled={busy} className="rounded bg-teal-700 px-5 py-2 font-medium text-white disabled:opacity-50">Save to case</button>
          </div>
        </div>
      )}

      {/* X-ray result: description only */}
      {xray && (
        <div className="mt-4 rounded-lg border border-gray-200 bg-white p-4">
          <p className="rounded border border-red-300 bg-red-50 p-2 font-semibold text-red-800">Not a diagnosis. Needs radiologist review.</p>
          <p className="mt-3">{xray.description}</p>
          {xray.visible_features.length > 0 && (
            <ul className="mt-2 list-disc pl-5 text-sm">{xray.visible_features.map((f, i) => <li key={i}>{f}</li>)}</ul>
          )}
          <p className="mt-2 text-sm text-gray-600">Limitations: {xray.limitations}</p>
          <button onClick={save} disabled={busy} className="mt-3 rounded bg-teal-700 px-5 py-2 font-medium text-white disabled:opacity-50">Save to case</button>
        </div>
      )}

      {error && <p className="mt-3 text-red-700">{error}</p>}
      {message && <p className="mt-3 font-medium text-green-700">{message}</p>}

      {/* Already saved */}
      <h3 className="mt-6 font-semibold">Saved reports / सहेजी गई रिपोर्ट</h3>
      {saved.length === 0 ? (
        <p className="text-sm text-gray-600">None yet.</p>
      ) : (
        <ul className="mt-2 space-y-2 text-sm">
          {saved.map((r) => (
            <li key={r.id} className="rounded border border-gray-200 bg-white p-3">
              {r.kind === "lab" ? (
                (r.data as LabReport).rows.map((row, i) => (
                  <span key={i} className={`mr-3 inline-block ${row.flag === "high" ? "text-red-700 font-semibold" : row.flag === "low" ? "text-blue-700 font-semibold" : ""}`}>
                    {row.test} {row.value} {row.unit}{row.flag === "high" || row.flag === "low" ? ` ${row.flag.toUpperCase()}` : ""}
                  </span>
                ))
              ) : (
                <span>X-ray: {(r.data as XrayReport).description} <b className="text-red-700">(needs radiologist review)</b></span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
