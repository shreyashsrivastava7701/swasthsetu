"use client";
// Step 1 of a case: read the summary back to the patient in their language.
// "Yes" confirms it. "Something is wrong" lets them correct it by voice or typing;
// the note is updated and read back again.
import { useState } from "react";
import { useRouter } from "next/navigation";
import MicButton from "@/components/MicButton";
import { getProvider } from "@/lib/provider";
import { slowAnswer } from "@/lib/slow";

type Props = {
  id: string;
  language: "hi" | "en";
  readback: string;
  readbackEnglish: string;
  status: string;
  rounds: number;
};

// Every button and question is shown in both Hindi and English.
const T = {
  q: "क्या यह सही है? / Is this correct?",
  yes: "हाँ, सही है / Yes, correct",
  no: "कुछ गलत है / Something is wrong",
  fix: "क्या गलत है? बोलें या लिखें / What is wrong? Speak or type",
  send: "सुधारें / Correct it",
};

export default function ReadBack({ id, language, readback, readbackEnglish, status, rounds }: Props) {
  const router = useRouter();
  const t = T;
  const [mode, setMode] = useState<"ask" | "correct">("ask");
  const [correction, setCorrection] = useState("");
  const [changes, setChanges] = useState<string[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [voiceNote, setVoiceNote] = useState("");
  // Set as soon as the server saves "Yes", so the buttons go away at once
  // instead of waiting for the page to reload.
  const [confirmed, setConfirmed] = useState(false);
  const done = confirmed || status !== "draft";

  // Read the text aloud with the browser's own voice.
  function speak(text: string, lang: "hi" | "en") {
    if (!("speechSynthesis" in window)) return setVoiceNote("This browser cannot read aloud. Please read the text to the patient.");
    const voice = speechSynthesis.getVoices().find((v) => v.lang.toLowerCase().startsWith(lang));
    if (!voice && lang === "hi") setVoiceNote("No Hindi voice on this device. Please read the text to the patient.");
    const u = new SpeechSynthesisUtterance(text);
    u.lang = lang === "hi" ? "hi-IN" : "en-IN";
    if (voice) u.voice = voice;
    u.rate = 0.9;
    speechSynthesis.cancel();
    speechSynthesis.speak(u);
  }

  async function confirm() {
    if (busy || done) return; // ignore a second tap
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/encounters/${id}/confirm-patient`, { method: "POST" });
      if (!res.ok) throw new Error();
      setConfirmed(true);
      window.dispatchEvent(new CustomEvent("ss-tab", { detail: 1 })); // move on to 2 · Reports
      router.refresh();
    } catch {
      setError("Could not save. Try again.");
    } finally {
      setBusy(false);
    }
  }

  async function sendCorrection() {
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/encounters/${id}/patch`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: correction, provider: getProvider() }),
      });
      const data = await res.json().catch(slowAnswer);
      if (!res.ok) throw new Error(data.error);
      setChanges(data.changes);
      setCorrection("");
      setMode("ask");
      router.refresh(); // reload the note and the new read-back
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  // No read-back when the AI was unavailable (section 10).
  if (!readback) {
    return (
      <div className="rounded border border-amber-300 bg-amber-50 p-4 text-amber-900">
        <p>Read-back skipped because the AI was unavailable. Check the note with the patient yourself.</p>
        <p className="mt-1">AI उपलब्ध नहीं था, इसलिए रीड-बैक नहीं बना। नोट मरीज़ के साथ खुद जाँचें।</p>
        {done ? (
          <p className="mt-3 font-medium text-green-800">✓ मरीज़ ने पुष्टि की / Patient confirmed the note.</p>
        ) : (
          <button onClick={confirm} disabled={busy} className="mt-3 rounded bg-teal-700 px-5 py-3 font-medium text-white disabled:opacity-50">
            {busy ? "सेव हो रहा है... / Saving..." : "मरीज़ सहमत है / Patient agrees with the note"}
          </button>
        )}
      </div>
    );
  }

  return (
    <div>
      <div className="rounded-lg border border-gray-200 bg-white p-5">
        {language === "hi" && (
          <>
            <p className="text-xs font-semibold uppercase text-gray-500">हिन्दी</p>
            <p className="mt-1 text-xl leading-relaxed">{readback}</p>
            <button onClick={() => speak(readback, "hi")} type="button" className="mt-3 rounded border border-teal-700 px-4 py-2 font-medium text-teal-800">
              🔊 हिन्दी में सुनाएँ
            </button>
            <hr className="my-4 border-gray-200" />
          </>
        )}
        <p className="text-xs font-semibold uppercase text-gray-500">English</p>
        <p className="mt-1 text-lg">{language === "hi" ? readbackEnglish || "(English version not available for this note)" : readback}</p>
        <button
          onClick={() => speak(language === "hi" ? readbackEnglish : readback, "en")}
          disabled={language === "hi" && !readbackEnglish}
          type="button"
          className="mt-3 rounded border border-teal-700 px-4 py-2 font-medium text-teal-800 disabled:opacity-40"
        >
          🔊 Read aloud in English
        </button>
        {voiceNote && <p className="mt-2 text-sm text-gray-600">{voiceNote}</p>}
      </div>

      {changes && (
        <div className="mt-4 rounded border border-blue-200 bg-blue-50 p-4">
          <p className="font-medium text-blue-900">बदलाव / Changes made:</p>
          {changes.length === 0 ? (
            <p className="text-sm text-blue-900">कुछ नहीं बदला / Nothing changed. The AI may have asked a question above.</p>
          ) : (
            <ul className="mt-1 list-disc pl-5 text-sm text-blue-900">
              {changes.map((c, i) => <li key={i}>{c}</li>)}
            </ul>
          )}
        </div>
      )}

      {done ? (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded border border-green-300 bg-green-50 p-3">
          <p className="font-medium text-green-800">
            ✓ मरीज़ ने पुष्टि की / Patient confirmed the summary{rounds > 0 ? ` after ${rounds} correction${rounds > 1 ? "s" : ""}` : ""}.
          </p>
          <button
            type="button"
            onClick={() => window.dispatchEvent(new CustomEvent("ss-tab", { detail: 1 }))}
            className="rounded bg-teal-700 px-4 py-2 font-medium text-white"
          >
            आगे / Next: Reports →
          </button>
        </div>
      ) : mode === "ask" ? (
        <div className="mt-4">
          <p className="mb-2 font-medium">{t.q}</p>
          <div className="flex gap-3">
            <button onClick={confirm} disabled={busy} className="flex-1 rounded bg-green-700 px-4 py-4 text-lg font-semibold text-white disabled:opacity-50">
              {busy ? "सेव हो रहा है... / Saving..." : t.yes}
            </button>
            <button onClick={() => setMode("correct")} disabled={busy} className="flex-1 rounded bg-amber-600 px-4 py-4 text-lg font-semibold text-white disabled:opacity-50">
              {t.no}
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-4 rounded-lg border border-gray-200 bg-white p-4">
          <p className="mb-2 font-medium">{t.fix}</p>
          <MicButton lang={language} onText={(x) => setCorrection((p) => (p ? `${p} ${x}` : x))} />
          <textarea value={correction} onChange={(e) => setCorrection(e.target.value)} rows={3} className="mt-3 w-full rounded border border-gray-300 p-3" />
          <div className="mt-3 flex gap-3">
            <button onClick={sendCorrection} disabled={busy || !correction.trim()} className="rounded bg-teal-700 px-5 py-3 font-medium text-white disabled:opacity-50">
              {busy ? "नोट बदल रहा है... / Updating the note..." : t.send}
            </button>
            <button onClick={() => setMode("ask")} disabled={busy} className="rounded border border-gray-300 px-5 py-3">
              रद्द करें / Cancel
            </button>
          </div>
        </div>
      )}

      {error && <p className="mt-3 text-red-700">{error}</p>}
    </div>
  );
}
