"use client";
// Delete a case after asking "Are you sure?". Then go back to the case list.
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function DeleteCaseButton({ id }: { id: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function remove() {
    if (!confirm("Delete this case? This cannot be undone. / यह केस हटाएँ?")) return;
    setBusy(true);
    const res = await fetch(`/api/encounters/${id}`, { method: "DELETE" });
    if (!res.ok) {
      setBusy(false);
      alert("Could not delete. Try again.");
      return;
    }
    router.push("/case");
    router.refresh();
  }

  return (
    <button onClick={remove} disabled={busy} className="rounded border border-red-300 px-3 py-1 text-sm text-red-700 hover:bg-red-50 disabled:opacity-50">
      {busy ? "Deleting..." : "Delete case / हटाएँ"}
    </button>
  );
}
