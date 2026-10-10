-- SwasthSetu database. Run this once in Supabase > SQL Editor > New query > Run.
-- Do not turn on row-level security for this build.

create extension if not exists pgcrypto;

create table facilities (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  block text not null,
  lat double precision not null,
  lng double precision not null,
  capabilities text[] not null default '{}',
  doctor_today boolean not null default true
);

create table encounters (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  alias text not null,
  language text not null default 'en',
  block text not null,
  age int,
  sex text,
  vitals jsonb not null default '{}',
  raw_text text not null default '',
  history jsonb not null,
  soap jsonb not null,
  readback_text text not null,
  teachback_rounds int not null default 0,
  rule_flags jsonb not null default '[]',
  ai_urgency text,
  urgency text not null,
  urgency_overridden boolean not null default false,
  needed_capabilities text[] not null default '{}',
  syndrome text,
  status text not null default 'draft',
  -- extra columns from section 10 (manual form)
  form_data jsonb not null default '{}',
  entered_by text,
  weight_kg numeric,
  -- patient name and phone (added on request; never sent to the AI or the dashboard)
  patient_name text,
  patient_phone text
);

create table reports (
  id uuid primary key default gen_random_uuid(),
  encounter_id uuid references encounters(id) on delete cascade,
  kind text not null,
  data jsonb not null,
  created_at timestamptz not null default now()
);

create table referrals (
  id uuid primary key default gen_random_uuid(),
  encounter_id uuid references encounters(id) on delete cascade,
  facility_id uuid references facilities(id),
  packet jsonb not null,
  distance_km numeric,
  eta_minutes int,
  status text not null default 'sent',
  created_at timestamptz not null default now()
);

create table public_cases (
  id uuid primary key default gen_random_uuid(),
  block text not null,
  syndrome text not null,
  urgency text not null,
  day date not null default current_date,
  is_demo boolean not null default false
);

-- After this file, run supabase/accounts.sql (logins, privacy and visits).
