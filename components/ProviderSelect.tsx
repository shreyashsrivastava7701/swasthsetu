"use client";
// The small Gemma / Gemini switch in the header. The choice is remembered in
// the browser and sent with every AI request.
import { useEffect, useRef } from "react";
import { getProvider, setProvider, type Provider } from "@/lib/provider";

export default function ProviderSelect() {
  const selectRef = useRef<HTMLSelectElement>(null);

  // Show the saved choice once the page is open in the browser.
  useEffect(() => {
    if (selectRef.current) selectRef.current.value = getProvider();
  }, []);

  return (
    <label className="flex items-center gap-2 text-sm text-blue-100">
      AI
      <select
        ref={selectRef}
        defaultValue="gemma"
        onChange={(e) => setProvider(e.target.value as Provider)}
        className="rounded border border-gray-300 bg-white px-2 py-1 text-gray-900"
      >
        <option value="gemma">Gemma</option>
        <option value="gemini">Gemini</option>
      </select>
    </label>
  );
}
