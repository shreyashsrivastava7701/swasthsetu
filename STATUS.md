# Status

**Stage:** prototype complete, ready for demo and deployment.

## Done

- [x] Bilingual intake form with voice input and Hindi/English read-back
- [x] Rules engine for urgency and red flags
- [x] AI case summary and doctor's note (Gemma, with Gemini backup and a template fallback)
- [x] Lab and X-ray report reading from photos
- [x] Patient and hospital logins; patients see only their own cases
- [x] Hospital suggestions: registered hospitals ranked by needs, distance and Google Search; Google Maps when none are registered
- [x] Visit booking with date and time, then log out
- [x] One-page A4 summary (print or PDF)
- [x] Hospital dashboard: Today, Upcoming and Earlier, new-booking banner, read and arrived status, doctor-available toggle
- [x] Public district dashboard with a Hamirpur map and Watch/Alert clusters
- [x] Government Blue interface
- [x] Demo data removed
- [x] Hospital tab loads in two steps: an instant list first, then the Google-checked list (Google has a 45-second limit, so the page never times out on Vercel); patients can also type another hospital's name
- [x] Deployed to Vercel
- [x] New "Quick Glance" one-page summary: urgency score out of 10, a "Needs attention" box, vitals tiles, and a blood report table with range bars (lib/score.ts); prints the same with any print-margin setting
- [x] Hospital tab also lists real hospitals near the block, even ones not on SwasthSetu (OpenStreetMap, free, no key; lib/nearby.ts)
- [x] Read-back: one tap on "Yes" confirms and moves to the Reports tab

## Next

- [ ] Full rehearsal of the demo

## Setup notes

- Run `supabase/schema.sql`, then `supabase/accounts.sql`, in Supabase.
- Environment variables: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SECRET_KEY`, `GEMINI_API_KEY`, `AI_PROVIDER`, `GEMMA_MODEL`, `GEMINI_MODEL`, `AI_AUTO_FALLBACK` (optional: `GEMINI_BACKUP_MODELS`, `AI_TIMEOUT_SECONDS`, `GOOGLE_MAPS_API_KEY`).
- Working models: `gemma-4-31b-it` and `gemini-flash-latest`.

## Known limits

- Hospital locations use block centres, so distances are approximate.
- Map tiles need internet access.
- Google Search and Maps grounding work only with Gemini models.
- The urgency score points are illustrative and not clinically validated.
- Danger-sign rules are illustrative and not clinically validated.
