// A coloured label for urgency. The word is always written out, so it still
// reads correctly in black-and-white print.
const STYLES: Record<string, string> = {
  urgent: "bg-red-100 text-red-800 border-red-300",
  soon: "bg-amber-100 text-amber-900 border-amber-300",
  routine: "bg-green-100 text-green-800 border-green-300",
};

export default function UrgencyChip({ urgency }: { urgency: string }) {
  return (
    <span className={`inline-block rounded border px-2 py-0.5 text-xs font-semibold uppercase ${STYLES[urgency] ?? "bg-gray-100"}`}>
      {urgency}
    </span>
  );
}
