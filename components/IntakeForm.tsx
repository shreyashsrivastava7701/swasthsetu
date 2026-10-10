"use client";
// New case form, filled by the patient (or someone helping them). Every field is optional except age, sex, block,
// and at least one symptom or some free text. Voice is optional: the form
// works fully with taps and typing.
import { useState } from "react";
import { useRouter } from "next/navigation";
import { BLOCKS } from "@/lib/blocks";
import { SYMPTOM_CHIPS, DURATIONS, SEVERITIES, PAST_ILLNESS, ENTERED_BY, VITALS_FIELDS, type ChipSymptom, type Vitals } from "@/lib/form";
import { getProvider } from "@/lib/provider";
import MicButton from "@/components/MicButton";

// Small helpers for consistent styling.
const box = "w-full rounded border border-gray-300 bg-white px-3 py-2";
const label = "block text-sm font-medium text-gray-700";
const toNum = (v: string) => (v.trim() === "" ? null : Number(v));

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-6 rounded-lg border border-gray-200 bg-white p-4">
      <h2 className="mb-3 font-semibold">{title}</h2>
      {children}
    </section>
  );
}

export default function IntakeForm({ defaultName, defaultPhone }: { defaultName: string; defaultPhone: string }) {
  const router = useRouter();

  // Who and where
  const [language, setLanguage] = useState<"en" | "hi">("hi");
  const [enteredBy, setEnteredBy] = useState("Patient");
  const [name, setName] = useState(defaultName);
  const [phone, setPhone] = useState(defaultPhone);
  const [block, setBlock] = useState("");
  const [age, setAge] = useState("");
  const [ageUnit, setAgeUnit] = useState<"years" | "months">("years");
  const [sex, setSex] = useState("");
  const [pregnant, setPregnant] = useState(false);
  const [weeks, setWeeks] = useState("");
  const [weight, setWeight] = useState("");

  // Symptoms, history, vitals, own words
  const [symptoms, setSymptoms] = useState<ChipSymptom[]>([]);
  const [pastIllness, setPastIllness] = useState<string[]>([]);
  const [pastOther, setPastOther] = useState("");
  const [medicines, setMedicines] = useState("");
  const [allergies, setAllergies] = useState("");
  const [vitals, setVitals] = useState<Record<string, string>>({});
  const [text, setText] = useState("");

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const ageNumber = toNum(age);
  const ageYears = ageNumber === null ? null : ageUnit === "months" ? Math.floor(ageNumber / 12) : ageNumber;

  // Tapping a chip cycles: not selected -> has it -> does NOT have it -> not selected.
  function tapChip(key: string) {
    const current = symptoms.find((s) => s.key === key);
    if (!current) setSymptoms([...symptoms, { key, present: true, duration: null, severity: null }]);
    else if (current.present) setSymptoms(symptoms.map((s) => (s.key === key ? { ...s, present: false } : s)));
    else setSymptoms(symptoms.filter((s) => s.key !== key));
  }

  function updateChip(key: string, field: "duration" | "severity", value: string) {
    setSymptoms(symptoms.map((s) => (s.key === key ? { ...s, [field]: value || null } : s)));
  }

  function togglePast(item: string) {
    setPastIllness(pastIllness.includes(item) ? pastIllness.filter((p) => p !== item) : [...pastIllness, item]);
  }

  async function submit() {
    setError("");
    if (!block || ageNumber === null || !sex) return setError("Please fill age, sex and block.");
    if (!text.trim() && symptoms.length === 0) return setError("Tap at least one symptom or type what the patient said.");

    const v: Vitals = {
      temp_c: toNum(vitals.temp_c ?? ""),
      pulse: toNum(vitals.pulse ?? ""),
      bp_sys: toNum(vitals.bp_sys ?? ""),
      bp_dia: toNum(vitals.bp_dia ?? ""),
      spo2: toNum(vitals.spo2 ?? ""),
      rr: toNum(vitals.rr ?? ""),
    };

    setSaving(true);
    try {
      const res = await fetch("/api/encounters", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          language,
          block,
          patient_name: name,
          patient_phone: phone,
          age_years: ageYears,
          age_months: ageUnit === "months" ? ageNumber : null,
          sex,
          vitals: v,
          raw_text: text,
          provider: getProvider(),
          form: {
            entered_by: enteredBy,
            age_unit: ageUnit,
            pregnant: sex === "F" && pregnant,
            pregnancy_weeks: sex === "F" && pregnant ? toNum(weeks) : null,
            weight_kg: ageYears !== null && ageYears < 12 ? toNum(weight) : null,
            symptoms,
            past_illness: pastIllness,
            past_other: pastOther,
            medicines,
            allergies,
          },
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Something went wrong.");
      router.push(`/case/${data.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setSaving(false);
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold">New case / नया केस</h1>
      <p className="mt-2 rounded border border-amber-300 bg-amber-50 p-2 text-sm text-amber-900">
        Demo: use made-up names and numbers only. / डेमो: केवल काल्पनिक नाम और नंबर डालें।
      </p>

      {/* Language toggle */}
      <div className="mt-4 flex gap-2">
        {(["hi", "en"] as const).map((l) => (
          <button
            key={l}
            type="button"
            onClick={() => setLanguage(l)}
            className={`flex-1 rounded border px-4 py-3 font-medium ${language === l ? "border-teal-700 bg-teal-700 text-white" : "border-gray-300 bg-white"}`}
          >
            {l === "hi" ? "हिन्दी Hindi" : "English"}
          </button>
        ))}
      </div>

      <Section title="Who and where / कौन और कहाँ">
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className={label}>Patient name / मरीज़ का नाम</label>
            <input value={name} onChange={(e) => setName(e.target.value)} className={box} />
          </div>
          <div>
            <label className={label}>Phone number / फ़ोन नंबर</label>
            <input type="tel" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} className={box} />
          </div>
          <div>
            <label className={label}>Entered by / किसने भरा</label>
            <select value={enteredBy} onChange={(e) => setEnteredBy(e.target.value)} className={box}>
              {ENTERED_BY.map((x) => <option key={x.key} value={x.key}>{x.key} / {x.hi}</option>)}
            </select>
          </div>
          <div>
            <label className={label}>Block / ब्लॉक *</label>
            <select value={block} onChange={(e) => setBlock(e.target.value)} className={box}>
              <option value="">Choose / चुनें</option>
              {BLOCKS.map((b) => <option key={b.name}>{b.name}</option>)}
            </select>
          </div>
          <div>
            <label className={label}>Age / उम्र *</label>
            <div className="flex gap-2">
              <input type="number" inputMode="numeric" value={age} onChange={(e) => setAge(e.target.value)} className={box} />
              <select value={ageUnit} onChange={(e) => setAgeUnit(e.target.value as "years" | "months")} className="rounded border border-gray-300 bg-white px-2">
                <option value="years">years / साल</option>
                <option value="months">months / महीने</option>
              </select>
            </div>
          </div>
          <div>
            <label className={label}>Sex / लिंग *</label>
            <div className="flex gap-2">
              {[["F", "Female / महिला"], ["M", "Male / पुरुष"], ["O", "Other / अन्य"]].map(([v, t]) => (
                <button key={v} type="button" onClick={() => setSex(v)} className={`flex-1 rounded border px-2 py-2 ${sex === v ? "border-teal-700 bg-teal-50 font-medium" : "border-gray-300 bg-white"}`}>
                  {t}
                </button>
              ))}
            </div>
          </div>
          {sex === "F" && (
            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
                <input type="checkbox" checked={pregnant} onChange={(e) => setPregnant(e.target.checked)} className="h-5 w-5" />
                Pregnant / गर्भवती
              </label>
              {pregnant && <input placeholder="Weeks / हफ़्ते (optional)" type="number" value={weeks} onChange={(e) => setWeeks(e.target.value)} className={`${box} mt-2`} />}
            </div>
          )}
          {ageYears !== null && ageYears < 12 && (
            <div>
              <label className={label}>Weight in kg / वज़न</label>
              <input type="number" inputMode="decimal" value={weight} onChange={(e) => setWeight(e.target.value)} className={box} />
            </div>
          )}
        </div>
      </Section>

      <Section title="Symptoms / लक्षण">
        <p className="mb-3 text-xs text-gray-500">Tap once = has it. Tap again = does NOT have it. Tap a third time to clear. / एक बार दबाएँ = है, दोबारा = नहीं है।</p>
        <div className="flex flex-wrap gap-2">
          {SYMPTOM_CHIPS.map((c) => {
            const s = symptoms.find((x) => x.key === c.key);
            const style = !s ? "border-gray-300 bg-white" : s.present ? "border-teal-700 bg-teal-700 text-white" : "border-gray-400 bg-gray-100 text-gray-500 line-through";
            return (
              <button key={c.key} type="button" onClick={() => tapChip(c.key)} className={`rounded-full border px-3 py-2 text-sm ${style}`}>
                {c.en} · {c.hi}
              </button>
            );
          })}
        </div>

        {/* Duration and severity for each symptom the patient has */}
        {symptoms.filter((s) => s.present).map((s) => (
          <div key={s.key} className="mt-3 grid grid-cols-3 items-center gap-2 text-sm">
            <span className="font-medium capitalize">{s.key}</span>
            <select value={s.duration ?? ""} onChange={(e) => updateChip(s.key, "duration", e.target.value)} className="rounded border border-gray-300 bg-white px-2 py-2">
              <option value="">How long? / कब से?</option>
              {DURATIONS.map((d) => <option key={d.key} value={d.key}>{d.key} / {d.hi}</option>)}
            </select>
            <select value={s.severity ?? ""} onChange={(e) => updateChip(s.key, "severity", e.target.value)} className="rounded border border-gray-300 bg-white px-2 py-2">
              <option value="">How bad? / कितना?</option>
              {SEVERITIES.map((x) => <option key={x.key} value={x.key}>{x.key} / {x.hi}</option>)}
            </select>
          </div>
        ))}
      </Section>

      <Section title="Patient's own words / मरीज़ के शब्दों में">
        <MicButton lang={language} onText={(t) => setText((prev) => (prev ? `${prev} ${t}` : t))} />
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={4}
          placeholder={language === "hi" ? "यहाँ लिखें या बोलें..." : "Type or speak here..."}
          className={`${box} mt-3`}
        />
      </Section>

      <Section title="Vitals (optional) / जाँच">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {VITALS_FIELDS.map((f) => (
            <div key={f.key}>
              <label className={label}>{f.en} / {f.hi}</label>
              <input type="number" inputMode="decimal" value={vitals[f.key] ?? ""} onChange={(e) => setVitals({ ...vitals, [f.key]: e.target.value })} className={box} />
            </div>
          ))}
        </div>
      </Section>

      <Section title="Past illness, medicines, allergies / पुरानी बीमारी, दवाइयाँ">
        <div className="flex flex-wrap gap-2">
          {PAST_ILLNESS.map((p) => (
            <button key={p.key} type="button" onClick={() => togglePast(p.key)} className={`rounded-full border px-3 py-2 text-sm ${pastIllness.includes(p.key) ? "border-teal-700 bg-teal-700 text-white" : "border-gray-300 bg-white"}`}>
              {p.key} · {p.hi}
            </button>
          ))}
        </div>
        <input placeholder="Other illness / अन्य बीमारी" value={pastOther} onChange={(e) => setPastOther(e.target.value)} className={`${box} mt-3`} />
        <input placeholder="Medicines being taken / चल रही दवाइयाँ" value={medicines} onChange={(e) => setMedicines(e.target.value)} className={`${box} mt-3`} />
        <input placeholder="Known allergies / एलर्जी (or: none known)" value={allergies} onChange={(e) => setAllergies(e.target.value)} className={`${box} mt-3`} />
      </Section>

      {error && <p className="mt-4 text-red-700">{error}</p>}
      <button
        type="button"
        onClick={submit}
        disabled={saving}
        className="mt-6 w-full rounded bg-teal-700 px-6 py-4 text-lg font-semibold text-white disabled:opacity-50"
      >
        {saving ? "Writing the note... / नोट बन रहा है..." : "Create note / नोट बनाएँ"}
      </button>
    </div>
  );
}
