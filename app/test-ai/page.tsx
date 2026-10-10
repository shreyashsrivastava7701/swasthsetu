"use client";
// Builder's test page: type a prompt, optionally add a photo, press Run,
// and see the model's raw answer and timing. Switch Gemma / Gemini in the header.
import { useState } from "react";
import { compressImage } from "@/lib/image";
import { getProvider } from "@/lib/provider";

type Result = { text?: string; error?: string; provider: string; model: string; ms: number };

export default function TestAiPage() {
  const [prompt, setPrompt] = useState("Say hello in Hindi");
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Result | null>(null);

  async function run() {
    setLoading(true);
    setResult(null);
    try {
      const image = file ? await compressImage(file) : undefined;
      const res = await fetch("/api/ai/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, image, provider: getProvider() }),
      });
      setResult(await res.json());
    } catch (err) {
      setResult({ error: String(err), provider: getProvider(), model: "", ms: 0 });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold">Test the AI</h1>
      <p className="mt-1 text-sm text-gray-600">Choose Gemma or Gemini with the AI switch at the top.</p>

      <label className="mt-4 block text-sm font-medium">Prompt</label>
      <textarea
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        rows={4}
        className="mt-1 w-full rounded border border-gray-300 bg-white p-3"
      />

      <label className="mt-4 block text-sm font-medium">Photo (optional)</label>
      <input
        type="file"
        accept="image/*"
        onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        className="mt-1 block text-sm"
      />

      <button
        onClick={run}
        disabled={loading || !prompt.trim()}
        className="mt-4 rounded bg-teal-700 px-6 py-3 font-medium text-white disabled:opacity-50"
      >
        {loading ? "Running..." : "Run"}
      </button>

      {result && (
        <div className="mt-6 rounded border border-gray-200 bg-white p-4">
          <p className="text-xs text-gray-500">
            {result.provider} · {result.model} · {(result.ms / 1000).toFixed(1)} s
          </p>
          {result.error ? (
            <p className="mt-2 text-red-700">Error: {result.error}</p>
          ) : (
            <pre className="mt-2 whitespace-pre-wrap text-sm">{result.text}</pre>
          )}
        </div>
      )}
    </div>
  );
}
