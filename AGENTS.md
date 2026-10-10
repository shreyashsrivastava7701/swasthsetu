<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Working on SwasthSetu

Guidelines for anyone, human or coding assistant, who changes this code.

## Checks before every commit

```bash
npx eslint .
npx tsc --noEmit
npm run build
```

All three must pass. If `tsc` complains about a page that no longer exists, delete `.next` and build again.

## Rules that must not break

1. **Secrets stay on the server.** `SUPABASE_SECRET_KEY` and `GEMINI_API_KEY` are read only in server code (`lib/supabase.ts`, `lib/ai.ts`, `lib/hospitals.ts`). Never put a key in code, in a `NEXT_PUBLIC_` variable, or in a commit.
2. **The browser never reads tables.** Row-level security is on with no policies. The browser Supabase client (`lib/supabase-browser.ts`) is used only for logging in. All data goes through `app/api/*` routes.
3. **Every case route checks access.** Use `requireMe(role)` and `caseAccess(me, id)` from `lib/auth.ts`. Patients see only their own cases. Hospitals see only cases booked with them.
4. **The AI never gets the patient's name or phone.** Send age, sex, block, symptoms and needs only.
5. **Urgency comes from rules, not the AI.** `lib/rules.ts` is plain code with the same result every time. The AI can only raise urgency, never lower it.
6. **Check AI output with zod** (`lib/schemas.ts`) and always have a fallback. A failed model call must not break a page.
7. **The public dashboard is anonymous.** The `public_cases` table and `/api/dashboard` hold block, kind of illness, urgency and day only.
8. **Bilingual UI.** Anything a patient reads is shown in Hindi and English.

## Conventions

- Next.js 16 App Router. Route `params` arrive as a Promise, so `await` them. `next.config.ts` sets `cacheComponents: false`.
- Dates and times are shown in India time (`Asia/Kolkata`).
- Styling is Tailwind v4. The theme lives in `app/globals.css`, where the `@theme` block maps `teal-*` to the Government Blue navy. Change colours there, not in each component.
- Keep the UI plain and readable: large text, clear buttons and no decoration.
- Do not define React components inside another component's render (lint rule `react-hooks/static-components`). Use small render helpers instead.
- Google AI calls use `@google/genai`. Check the installed package's docs before changing call syntax. Grounding uses `ai.interactions.create` with the `google_search` or `google_maps` tool.

## Where things are

| Need to change | Look in |
| --- | --- |
| Danger-sign rules | `lib/rules.ts` |
| AI prompts | `lib/prompts.ts` |
| Model choice and fallback chain | `lib/ai.ts` |
| Hospital ranking and Google search | `lib/hospitals.ts`, `lib/match.ts` |
| Blocks and their coordinates | `lib/blocks.ts` |
| Summary PDF layout | `components/Summary.tsx`, `lib/packet.ts` |
| Cluster thresholds | `lib/dashboard.ts` |
| Login and access checks | `lib/auth.ts` |
| Database tables | `supabase/schema.sql`, `supabase/accounts.sql` |
