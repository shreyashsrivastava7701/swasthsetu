"use client";
// Log in or create an account. Patients use phone number + password;
// hospitals use email + password and say which hospital they are.
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabaseBrowser, saveToken, phoneToEmail } from "@/lib/supabase-browser";
import { BLOCKS } from "@/lib/blocks";
import { CAPABILITIES, CAPABILITY_LABELS } from "@/lib/rules";

const box = "mt-1 w-full rounded border border-gray-300 bg-white px-3 py-2";
const lbl = "mt-3 block text-sm font-medium text-gray-700";

export default function LoginForm({ role }: { role: "patient" | "hospital" }) {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [block, setBlock] = useState("");
  const [address, setAddress] = useState("");
  const [caps, setCaps] = useState<string[]>(["general_doctor"]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const patient = role === "patient";
  const home = patient ? "/case" : "/facility";

  async function submit(ev: React.FormEvent) {
    ev.preventDefault();
    setError("");
    if (patient && phone.replace(/\D/g, "").length < 10) return setError("Enter a 10-digit mobile number.");
    if (password.length < 6) return setError("The password needs at least 6 characters.");
    if (mode === "signup" && !name.trim()) return setError(patient ? "Enter your name." : "Enter the hospital name.");
    if (mode === "signup" && !patient && !block) return setError("Choose the block.");

    setBusy(true);
    const loginEmail = patient ? phoneToEmail(phone) : email.trim();
    try {
      if (mode === "signup") {
        const { data, error } = await supabaseBrowser.auth.signUp({ email: loginEmail, password });
        if (error) throw new Error(error.message);
        const token = data.session?.access_token;
        if (!token) throw new Error("Account made, but email confirmation is on in Supabase. Turn off 'Confirm email' and try logging in.");
        const res = await fetch("/api/auth/setup", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ role, name, phone: patient ? phone : null, block, address, capabilities: caps }),
        });
        const d = await res.json();
        if (!res.ok) throw new Error(d.error);
        saveToken(token);
      } else {
        const { data, error } = await supabaseBrowser.auth.signInWithPassword({ email: loginEmail, password });
        if (error) throw new Error(error.message === "Invalid login credentials" ? "Wrong number/email or password." : error.message);
        const token = data.session.access_token;
        const res = await fetch("/api/auth/me", { headers: { Authorization: `Bearer ${token}` } });
        const { me } = await res.json();
        if (!me || me.role !== role) {
          await supabaseBrowser.auth.signOut();
          throw new Error(patient ? "This is not a patient account. Use the hospital login." : "This is not a hospital account. Use the patient login.");
        }
        saveToken(token);
      }
      router.push(home);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-md">
      <h1 className="text-2xl font-semibold">{patient ? "Patient login / मरीज़ लॉगिन" : "Hospital login"}</h1>
      <div className="mt-4 flex gap-1 border-b border-gray-200">
        {(["login", "signup"] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m)}
            className={`flex-1 px-2 py-3 text-sm font-medium ${mode === m ? "border-b-2 border-teal-700 text-teal-800" : "text-gray-500"}`}
          >
            {m === "login" ? (patient ? "Log in / लॉगिन" : "Log in") : patient ? "New account / नया खाता" : "Register hospital"}
          </button>
        ))}
      </div>

      <form onSubmit={submit} className="mt-2">
        {mode === "signup" && (
          <label className={lbl}>
            {patient ? "Your name / आपका नाम" : "Hospital name (as on Google Maps)"}
            <input value={name} onChange={(e) => setName(e.target.value)} className={box} />
          </label>
        )}

        {patient ? (
          <label className={lbl}>
            Mobile number / मोबाइल नंबर
            <input type="tel" inputMode="numeric" value={phone} onChange={(e) => setPhone(e.target.value)} className={box} placeholder="10 digits" />
          </label>
        ) : (
          <label className={lbl}>
            Email
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={box} />
          </label>
        )}

        <label className={lbl}>
          Password / पासवर्ड
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className={box} placeholder="At least 6 characters" />
        </label>

        {mode === "signup" && !patient && (
          <>
            <label className={lbl}>
              Block
              <select value={block} onChange={(e) => setBlock(e.target.value)} className={box}>
                <option value="">Choose</option>
                {BLOCKS.map((b) => (
                  <option key={b.name}>{b.name}</option>
                ))}
              </select>
            </label>
            <label className={lbl}>
              Address (optional)
              <input value={address} onChange={(e) => setAddress(e.target.value)} className={box} />
            </label>
            <p className={lbl}>What the hospital has</p>
            <div className="mt-1 grid grid-cols-1 gap-1 sm:grid-cols-2">
              {CAPABILITIES.map((c) => (
                <label key={c} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={caps.includes(c)}
                    onChange={() => setCaps(caps.includes(c) ? caps.filter((x) => x !== c) : [...caps, c])}
                  />
                  {CAPABILITY_LABELS[c]}
                </label>
              ))}
            </div>
          </>
        )}

        {error && <p className="mt-3 text-sm text-red-700">{error}</p>}
        <button type="submit" disabled={busy} className="mt-5 w-full rounded bg-teal-700 px-5 py-3 font-medium text-white disabled:opacity-50">
          {busy ? "Please wait..." : mode === "login" ? "Log in" : "Create account"}
        </button>
      </form>

      <div className="mt-6 space-y-1 text-sm">
        <p>
          {patient ? "Are you a hospital? " : "Are you a patient? "}
          <Link href={patient ? "/login/hospital" : "/login/patient"} className="text-teal-800 underline">
            {patient ? "Hospital login" : "Patient login"}
          </Link>
        </p>
        <p>
          <Link href="/dashboard" className="text-teal-800 underline">
            District dashboard (no login needed)
          </Link>
        </p>
      </div>
    </div>
  );
}
