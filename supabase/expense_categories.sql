-- Expense categories for the Report → Expense form.
-- Run this in Supabase: SQL Editor → New query → Run.

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
