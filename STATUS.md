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

## Next

- [ ] Full rehearsal of the demo
- [ ] Deploy to Vercel with all environment variables set

## Setup notes

- Run `supabase/schema.sql`, then `supabase/accounts.sql`, in Supabase.
- Environment variables: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SECRET_KEY`, `GEMINI_API_KEY`, `AI_PROVIDER`, `GEMMA_MODEL`, `GEMINI_MODEL`, `AI_AUTO_FALLBACK` (optional: `GEMINI_BACKUP_MODELS`, `AI_TIMEOUT_SECONDS`).
- Working models: `gemma-4-31b-it` and `gemini-flash-latest`.

## Known limits

- Hospital locations use block centres, so distances are approximate.
- Map tiles need internet access.
- Google Search and Maps grounding work only with Gemini models.
- Danger-sign rules are illustrative and not clinically validated.
