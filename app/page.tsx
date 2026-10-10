// Home page. Logged out: choose patient login, hospital login or the public
// dashboard. Logged in: go straight to your own area.
import Link from "next/link";
import { redirect } from "next/navigation";
import { getMe } from "@/lib/auth";

export const dynamic = "force-dynamic";

const CARDS = [
  { href: "/login/patient", title: "I am a patient / मैं मरीज़ हूँ", text: "Tell us how you feel, get a summary for the doctor, and book a hospital visit." },
  { href: "/login/hospital", title: "I am a hospital", text: "See patients who are coming to you, with their summary and visit time." },
  { href: "/dashboard", title: "District dashboard", text: "Anonymous case counts and cluster alerts. No login needed." },
];

export default async function Home() {
  const me = await getMe();
  if (me?.role === "patient") redirect("/case");
  if (me?.role === "hospital") redirect("/facility");

  return (
    <div>
      <span className="inline-block rounded bg-orange-50 px-2 py-0.5 text-xs font-semibold text-orange-800">स्वास्थ्य सेतु · Health bridge</span>
      <h1 className="mt-2 text-2xl font-semibold">SwasthSetu</h1>
      <p className="mt-1 text-gray-600">
        Listens to the patient, prepares a note for the doctor, and helps the patient reach the right hospital.
        A doctor always decides.
      </p>

      <div className="mt-6 grid gap-4">
        {CARDS.map((card) => (
          <Link key={card.href} href={card.href} className="block rounded border border-teal-200 bg-teal-50 p-5 hover:border-teal-700">
            <h2 className="text-lg font-semibold text-teal-800">{card.title}</h2>
            <p className="mt-1 text-sm text-gray-600">{card.text}</p>
          </Link>
        ))}
      </div>

      <p className="mt-8 text-xs text-gray-500">Prototype. Not a diagnosis. A clinician always decides.</p>
    </div>
  );
}
