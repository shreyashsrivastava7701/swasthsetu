# STATUS
Step completed: E of the final changes (Government Blue interface). All final-change steps A-E done.
Next step: full rehearsal, then GitHub + Vercel deploy
Final-change plan: A logins/privacy, B patient hospital + visit, C hospital dashboard, D public dashboard with real district map, E interface options
Accounts: patients log in with mobile number + password (stored as <10 digits>@patient.swasthsetu.app in Supabase Auth); hospitals with email + password and register their hospital (creates a facilities row). profiles table holds role, name, phone, facility_id.
Privacy: tables have row-level security ON with no policies. Only the server reads them, using SUPABASE_SECRET_KEY. The browser key is used only to log in. Every case route checks the owner (lib/auth.ts caseAccess). A hospital can read only cases sent to it.
Demo data: removed (no seed route; supabase/accounts.sql deletes old test data)
Working: everything from steps 0 to 6 for logged-in patients; hospital inbox shows only its own patients; dashboard is public
AI provider in use: gemma, auto-fallback to the Gemini chain
Gemma model name that worked: gemma-4-31b-it
Gemini model name that worked: gemini-flash-latest
Environment variables: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SECRET_KEY (new, server only), GEMINI_API_KEY, AI_PROVIDER, GEMMA_MODEL, GEMINI_MODEL, AI_AUTO_FALLBACK
Hospital suggestions (lib/hospitals.ts, /api/encounters/[id]/hospitals): only hospitals registered on SwasthSetu are suggested, ranked by needs + distance, then re-ranked by Gemini with Google Search (Interactions API, tools google_search). If none are registered: Gemini with Google Maps (tools google_maps at the block centre) suggests up to 3; patient is told to carry the summary. If the AI fails: rules ranking, or a "go to nearest government hospital" note. Suggestions are cached in encounters.soap.hospital_suggestions.
Visit booking (/api/encounters/[id]/visit): saves a referral with visit_at (facility_id, or hospital json for a Google hospital), one public_cases row, status referred. The patient tab 3 shows confirmation, the PDF summary link and "Finish and log out". The old Review-and-refer panel and refer route were removed; the doctor's note is now tab 4.
Hospital dashboard (/facility, components/FacilityInbox.tsx): patients grouped Today / Upcoming / Earlier by visit time (India time), cards, new-booking banner, 5 s refresh, full summary per patient, Mark summary as read, Patient arrived (referrals.status sent -> seen -> arrived), Doctor available today toggle (facilities.doctor_today; hospitals without a doctor are not suggested).
Public dashboard: /dashboard needs no login (linked from home and both login pages). Map: components/DistrictMap.tsx uses Leaflet + OpenStreetMap tiles (needs internet), circles at block centres sized by cases in the last 3 days, red Alert / amber Watch.
Style: "Government Blue" chosen by Shreyash. app/globals.css maps Tailwind teal-* to navy (one place to change the look); header is navy with a saffron line.
