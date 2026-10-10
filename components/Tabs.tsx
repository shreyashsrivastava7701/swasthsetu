"use client";
// Simple tabs: big buttons on top, one panel shown at a time.
import { useState } from "react";

export default function Tabs({ tabs, start = 0 }: { tabs: { label: string; content: React.ReactNode }[]; start?: number }) {
  const [active, setActive] = useState(start);
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
      <div className="pt-4">{tabs[active].content}</div>
    </div>
  );
}
