"use client";
// Opens the browser's print box. Choose "Save as PDF" there to get a PDF file.
export default function PrintButton() {
  return (
    <button type="button" onClick={() => window.print()} className="rounded bg-teal-700 px-4 py-2 font-medium text-white print:hidden">
      🖨 Print / Save as PDF
    </button>
  );
}
