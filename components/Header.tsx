// The bar at the top of every page. Links depend on who is logged in:
// a patient, a hospital, or nobody.
import Link from "next/link";
import ProviderSelect from "@/components/ProviderSelect";
import LogoutButton from "@/components/LogoutButton";
import { getMe } from "@/lib/auth";

export default async function Header() {
  const me = await getMe();
  const links =
    me?.role === "patient"
      ? [
          { href: "/intake", label: "New case / नया केस" },
          { href: "/case", label: "My cases / मेरे केस" },
          { href: "/dashboard", label: "Dashboard" },
        ]
      : me?.role === "hospital"
        ? [
            { href: "/facility", label: "Incoming patients" },
            { href: "/dashboard", label: "Dashboard" },
          ]
        : [
            { href: "/login/patient", label: "Patient login" },
            { href: "/login/hospital", label: "Hospital login" },
            { href: "/dashboard", label: "Dashboard" },
          ];

  return (
    <header className="border-b-4 border-saffron bg-teal-700 text-white print:hidden">
      <div className="mx-auto flex max-w-3xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
        <Link href="/" className="text-lg font-semibold text-white">
          SwasthSetu
        </Link>
        <nav className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
          {links.map((link) => (
            <Link key={link.href} href={link.href} className="text-blue-100 hover:text-white hover:underline">
              {link.label}
            </Link>
          ))}
        </nav>
        {me && (
          <div className="ml-auto flex items-center gap-3">
            <span className="text-sm text-blue-100">{me.name}</span>
            {me.role === "patient" && <ProviderSelect />}
            <LogoutButton />
          </div>
        )}
      </div>
    </header>
  );
}
