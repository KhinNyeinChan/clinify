-- Allow signed-in clinic staff to read and write Clinify tables.
-- Run this once in Supabase: SQL Editor → New query → Run.

alter table if exists public.patients enable row level security;
alter table if exists public.appointments enable row level security;
alter table if exists public.medical_records enable row level security;
alter table if exists public.suppliers enable row level security;
alter table if exists public.medicines enable row level security;
alter table if exists public.transactions enable row level security;

drop policy if exists "clinify_authenticated_patients" on public.patients;
create policy "clinify_authenticated_patients"
on public.patients
for all
to authenticated
using (true)
with check (true);

drop policy if exists "clinify_authenticated_appointments" on public.appointments;
create policy "clinify_authenticated_appointments"
on public.appointments
for all
to authenticated
using (true)
with check (true);

drop policy if exists "clinify_authenticated_medical_records" on public.medical_records;
create policy "clinify_authenticated_medical_records"
on public.medical_records
for all
to authenticated
using (true)
with check (true);

drop policy if exists "clinify_authenticated_suppliers" on public.suppliers;
create policy "clinify_authenticated_suppliers"
on public.suppliers
for all
to authenticated
using (true)
with check (true);

drop policy if exists "clinify_authenticated_medicines" on public.medicines;
create policy "clinify_authenticated_medicines"
on public.medicines
for all
to authenticated
using (true)
with check (true);

drop policy if exists "clinify_authenticated_transactions" on public.transactions;
create policy "clinify_authenticated_transactions"
on public.transactions
for all
to authenticated
using (true)
with check (true);

alter table if exists public.appointments
  add column if not exists appointment_time time;

alter table if exists public.appointments
  add column if not exists status text not null default 'pending';

alter table if exists public.transactions
  add column if not exists type text,
  add column if not exists description text,
  add column if not exists occurred_on date;

update public.transactions
set type = case when coalesce(amount, 0) < 0 then 'expense' else 'income' end
where type is null;

update public.transactions
set occurred_on = current_date
where occurred_on is null;

create table if not exists public.expense_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.expense_categories enable row level security;

drop policy if exists "clinify_authenticated_expense_categories" on public.expense_categories;
create policy "clinify_authenticated_expense_categories"
on public.expense_categories
for all
to authenticated
using (true)
with check (true);

alter table if exists public.transactions
  add column if not exists category_id uuid references public.expense_categories(id) on delete set null;

create index if not exists transactions_category_id_idx
  on public.transactions (category_id);

insert into public.expense_categories (name)
values
  ('Medical Supplies'),
  ('Rent'),
  ('Utilities'),
  ('Salaries')
on conflict (name) do nothing;

alter table if exists public.patients
  add column if not exists note text;

