"use client";
// Simple tabs: big buttons on top, one panel shown at a time.
// Any part of the page can switch tab with:
//   window.dispatchEvent(new CustomEvent("ss-tab", { detail: tabNumber }))
import { useEffect, useState } from "react";

export default function Tabs({ tabs, start = 0 }: { tabs: { label: string; content: React.ReactNode }[]; start?: number }) {
  const [active, setActive] = useState(start);
  // Tabs stay mounted once opened, so what happened in them (like "confirmed")
  // is not lost when switching back. Unopened tabs load nothing yet.
  const [opened, setOpened] = useState<number[]>([start]);
  if (!opened.includes(active)) setOpened([...opened, active]);
  useEffect(() => {
    const go = (e: Event) => setActive(Number((e as CustomEvent).detail) || 0);
    window.addEventListener("ss-tab", go);
    return () => window.removeEventListener("ss-tab", go);
  }, []);
  return (
    <div>
      <div className="flex gap-1 border-b border-gray-200">
        {tabs.map((t, i) => (
          <button
            key={t.label}
            type="button"
            onClick={() => setActive(i)}
            className={`flex-1 rounded-t px-2 py-3 text-sm font-medium ${i === active ? "border-x border-t border-gray-200 bg-white text-teal-800" : "text-gray-500"}`}
          >
            {t.label}
          </button>
        ))}
      </div>
      {tabs.map((t, i) =>
        opened.includes(i) ? (
          <div key={t.label} className={i === active ? "pt-4" : "hidden"}>
            {t.content}
          </div>
        ) : null
      )}
    </div>
  );
}
