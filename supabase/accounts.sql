-- Logins and privacy. Run ONCE in Supabase > SQL Editor > New query > Run.
-- It deletes all test data, adds accounts, and locks the tables so that only
-- the app's server (with the secret key) can read or write them.

-- 1. Remove all old test and demo data.
delete from referrals;
delete from reports;
delete from encounters;
delete from public_cases;
delete from facilities;

-- 2. Accounts: one profile per login. role is 'patient' or 'hospital'.
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('patient', 'hospital')),
  name text not null,
  phone text,
  facility_id uuid references facilities(id) on delete set null,
  created_at timestamptz not null default now()
);

-- 3. Every case belongs to the patient who made it.
alter table encounters add column if not exists owner_id uuid references auth.users(id) on delete cascade;

-- 4. Hospitals: extra details entered at sign-up.
alter table facilities add column if not exists address text;
alter table facilities add column if not exists phone text;

-- 5. Visits (used in the next step): when the patient will come, and the
--    hospital's details if it is not on SwasthSetu.
alter table referrals alter column facility_id drop not null;
alter table referrals add column if not exists visit_at timestamptz;
alter table referrals add column if not exists hospital jsonb;

-- 6. Lock every table. With row-level security on and no policies, the public
--    key in the browser can read nothing. The server uses the secret key.
alter table facilities enable row level security;
alter table encounters enable row level security;
alter table reports enable row level security;
alter table referrals enable row level security;
alter table public_cases enable row level security;
alter table profiles enable row level security;
