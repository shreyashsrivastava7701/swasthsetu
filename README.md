# SwasthSetu (स्वास्थ्यसेतु)

**A bilingual (Hindi and English) health triage and referral web app for Hamirpur district, Himachal Pradesh.**

A patient describes their problem in Hindi or English, by typing or by voice. SwasthSetu turns it into a clear, structured case and checks it for danger signs. It suggests the best registered hospital nearby and lets the patient book a visit time. The hospital receives a one-page summary straight away. A public district dashboard shows anonymous case counts on a map, so clusters of illness stand out early.

> Prototype built for a hackathon. The danger-sign rules are illustrative and are not validated clinical standards. Every AI-written summary is for a clinician to review.

## Features

**For patients**
- Log in with a mobile number and a password.
- Fill in a bilingual intake form with age, sex, block, symptoms and vitals. Speak instead of typing with the mic button.
- The app reads the case back in Hindi and English so the patient can confirm it.
- Add lab or X-ray report photos. The AI reads the key values.
- See the urgency (routine, soon or urgent) and any red flags from fixed rules.
- Get hospital suggestions ranked by what the case needs and by distance, refined with Google Search. If no hospital nearby is registered, Google Maps suggests real hospitals.
- Book a visit date and time, then download a one-page A4 summary (PDF).
- Patients can see and edit only their own cases.

**For hospitals**
- Log in with an email and a password, and register the hospital and what it offers.
- See an incoming patients dashboard grouped into Today, Upcoming and Earlier, which refreshes every 5 seconds.
- Get a banner when a new patient books.
- Open the full summary for each patient, mark it as read, and mark the patient as arrived.
- Turn off "Doctor available today" to stop new suggestions to the hospital.

**For everyone (no login)**
- The district dashboard shows cases today and over the last 3 days, and alerts.
- It lists cases by kind and shows a live Hamirpur map with circles per block.
- Cluster alerts: 3 or 4 similar cases in one block in 3 days is a **Watch**, and 5 or more is an **Alert**.
- It shows no names, phones or addresses.

## Tech stack

| Part | Tool |
| --- | --- |
| Web framework | Next.js 16 (App Router), React 19, TypeScript |
| Styling | Tailwind CSS v4 ("Government Blue" theme) |
| Database and logins | Supabase (Postgres + Auth, row-level security on) |
| AI | Google Gemma 4 (main), Gemini Flash (backup), through `@google/genai` |
| Hospital search | Gemini with Google Search and Google Maps grounding |
| Map | Leaflet + OpenStreetMap |
| Checking AI output | zod |
| Hosting | Vercel |

## How it works

```
Browser pages  ──►  Next.js server (API routes)  ──►  Supabase (data + logins)
                      │ login check                 ──►  Google AI (Gemma / Gemini)
                      │ rules engine
                      │ AI layer
                      └ hospital ranking
```

- The browser never reads the database or calls the AI directly. Every request goes through the server's API routes.
- The server holds the secret keys. It checks who is logged in before it returns any case.
- Urgency and red flags come from plain rules in `lib/rules.ts`, so the same case always gets the same result. The AI writes summaries and reads reports, but it never decides urgency on its own.
- The AI never receives the patient's name or phone, only age, sex, block, symptoms and needs.
- When a model is busy or fails, the app retries and moves down the chain from Gemma to Gemini to a template note. It keeps working without AI.

## Project layout

```
app/           pages and API routes
  login/       patient and hospital login pages
  intake/      new case form
  case/[id]/   a patient's case (tabs) and the printable summary
  facility/    hospital dashboard
  dashboard/   public district dashboard
  api/         server routes (encounters, facilities, referrals, dashboard, auth)
components/    UI pieces (forms, tabs, hospital panel, map, summary)
lib/           logic: rules, AI, matching, hospitals, auth, database clients
supabase/      SQL to create the tables (schema.sql, then accounts.sql)
```

## Run it locally

You need Node.js 20 or later, a Supabase project and a Google AI Studio API key.

1. Install the packages:
   ```bash
   npm install
   ```
2. In the Supabase SQL editor, run `supabase/schema.sql` and then `supabase/accounts.sql`.
3. Create a file called `.env.local` in the project folder:
   ```
   NEXT_PUBLIC_SUPABASE_URL=
   NEXT_PUBLIC_SUPABASE_ANON_KEY=
   SUPABASE_SECRET_KEY=
   GEMINI_API_KEY=
   AI_PROVIDER=gemma
   GEMMA_MODEL=gemma-4-31b-it
   GEMINI_MODEL=gemini-flash-latest
   AI_AUTO_FALLBACK=true
   ```
   You can also set `GEMINI_BACKUP_MODELS` (a comma-separated list of models) and `AI_TIMEOUT_SECONDS` (60 if not set).
4. Start the app:
   ```bash
   npm run dev
   ```
   Then open http://localhost:3000.

Never commit `.env.local`. The `.gitignore` already blocks it.

## Deploy

1. Import the GitHub repository into Vercel.
2. In Vercel, add the same variables as in `.env.local` under **Settings > Environment Variables**.
3. Deploy.

## Limits

- This is a prototype. It is not a medical device and does not give a diagnosis.
- Hospitals are placed at their block centre, so distances are approximate.
- The district covers 5 blocks: Hamirpur, Nadaun, Bhoranj, Sujanpur and Barsar.
