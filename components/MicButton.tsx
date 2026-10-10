"use client";
// A big mic button. Uses the browser's own speech recognition (Chrome).
// Each finished sentence is passed to onText. If the browser has no speech
// support, the button explains that typing still works.
import { useRef, useState } from "react";

// Minimal types for the browser speech API (not included in TypeScript).
type SpeechResultEvent = {
  resultIndex: number;
  results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }>;
};
type Recognition = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((e: SpeechResultEvent) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};

export default function MicButton({ lang, onText }: { lang: "hi" | "en"; onText: (text: string) => void }) {
  const [listening, setListening] = useState(false);
  const [message, setMessage] = useState("");
  const recRef = useRef<Recognition | null>(null);

  function toggle() {
    if (listening) {
      recRef.current?.stop();
      return;
    }
    const w = window as unknown as { SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition };
    const SR = w.SpeechRecognition ?? w.webkitSpeechRecognition;
    if (!SR) {
      setMessage("Voice input needs Chrome. You can type instead.");
      return;
    }
    const rec = new SR();
    rec.lang = lang === "hi" ? "hi-IN" : "en-IN";
    rec.continuous = true;
    rec.interimResults = false;
    rec.onresult = (e) => {
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) onText(e.results[i][0].transcript.trim());
      }
    };
    rec.onerror = (e) => setMessage(e.error === "not-allowed" ? "Microphone blocked. Allow it, or type instead." : `Mic error: ${e.error}`);
    rec.onend = () => setListening(false);
    recRef.current = rec;
    setMessage("");
    rec.start();
    setListening(true);
  }

  return (
    <div>
      <button
        type="button"
        onClick={toggle}
        className={`rounded-full px-5 py-3 font-medium text-white ${listening ? "bg-red-600" : "bg-teal-700"}`}
      >
        {listening ? "● Stop" : "🎤 Speak"}
      </button>
      {listening && <span className="ml-3 text-sm text-gray-600">Listening in {lang === "hi" ? "Hindi" : "English"}...</span>}
      {message && <p className="mt-1 text-sm text-red-700">{message}</p>}
    </div>
  );
}
