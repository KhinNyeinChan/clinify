-- Medicine purchase vouchers (inventory restock).
-- Run this in Supabase: SQL Editor → New query → Run.
-- supplier_id and medicine_id match the id types already used by suppliers and medicines.

do $$
declare
  supplier_id_type text;
  medicine_id_type text;
begin
  select format_type(a.atttypid, a.atttypmod)
    into supplier_id_type
  from pg_attribute a
  where a.attrelid = 'public.suppliers'::regclass
    and a.attname = 'id'
    and not a.attisdropped;

  select format_type(a.atttypid, a.atttypmod)
    into medicine_id_type
  from pg_attribute a
  where a.attrelid = 'public.medicines'::regclass
    and a.attname = 'id'
    and not a.attisdropped;

  execute format($sql$
    create table if not exists public.medicine_purchases (
      id uuid primary key default gen_random_uuid(),
      supplier_id %1$s not null references public.suppliers(id),
      purchase_date date not null default current_date,
      total_amount numeric(12, 2) not null default 0,
      payment_amount numeric(12, 2) not null default 0,
      payment_status text not null default 'Pending',
      created_at timestamptz not null default now(),
      constraint medicine_purchases_status_check
        check (payment_status in ('Paid', 'Pending', 'Partial')),
      constraint medicine_purchases_payment_check
        check (payment_amount >= 0 and payment_amount <= total_amount)
    )
  $sql$, supplier_id_type);

  execute format($sql$
    create table if not exists public.medicine_purchase_items (
      id uuid primary key default gen_random_uuid(),
      purchase_id uuid not null references public.medicine_purchases(id) on delete cascade,
      medicine_id %1$s not null references public.medicines(id),
      quantity integer not null check (quantity > 0),
      unit_price numeric(12, 2) not null check (unit_price >= 0),
      subtotal numeric(12, 2) not null check (subtotal >= 0)
    )
  $sql$, medicine_id_type);
end $$;

create index if not exists medicine_purchases_supplier_id_idx
  on public.medicine_purchases (supplier_id);

create index if not exists medicine_purchase_items_purchase_id_idx
  on public.medicine_purchase_items (purchase_id);

alter table public.medicine_purchases enable row level security;
alter table public.medicine_purchase_items enable row level security;

drop policy if exists "clinify_authenticated_medicine_purchases" on public.medicine_purchases;
create policy "clinify_authenticated_medicine_purchases"
on public.medicine_purchases
for all
to authenticated
using (true)
with check (true);

drop policy if exists "clinify_authenticated_medicine_purchase_items" on public.medicine_purchase_items;
create policy "clinify_authenticated_medicine_purchase_items"
on public.medicine_purchase_items
for all
to authenticated
using (true)
with check (true);

create or replace function public.create_medicine_purchase(
  p_supplier_id text,
  p_purchase_date date,
  p_payment_amount numeric,
  p_payment_status text,
  p_items jsonb
) returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_purchase_id uuid;
  v_supplier_id public.suppliers.id%type;
  v_item jsonb;
  v_medicine_id public.medicines.id%type;
  v_quantity integer;
  v_unit_price numeric(12, 2);
  v_subtotal numeric(12, 2);
  v_total numeric(12, 2) := 0;
  v_payment numeric(12, 2);
  v_category_id uuid;
begin
  if p_payment_status not in ('Paid', 'Pending', 'Partial') then
    raise exception 'Choose Paid, Pending, or Partial.';
  end if;

  if p_items is null or jsonb_array_length(p_items) = 0 then
    raise exception 'Add at least one medicine.';
  end if;

  v_supplier_id := p_supplier_id;

  insert into public.medicine_purchases (
    supplier_id,
    purchase_date,
    total_amount,
    payment_amount,
    payment_status
  )
  values (v_supplier_id, p_purchase_date, 0, 0, 'Pending')
  returning id into v_purchase_id;

  for v_item in
    select elem
    from jsonb_array_elements(p_items) as elems(elem)
  loop
    v_medicine_id := v_item ->> 'medicine_id';
    v_quantity := (v_item ->> 'quantity')::integer;
    v_unit_price := round((v_item ->> 'unit_price')::numeric, 2);

    if v_medicine_id is null or v_quantity is null or v_quantity <= 0 or v_unit_price is null or v_unit_price < 0 then
      raise exception 'Each medicine needs a quantity above 0 and a unit price of 0 or more.';
    end if;

    v_subtotal := round(v_quantity * v_unit_price, 2);
    v_total := v_total + v_subtotal;

    insert into public.medicine_purchase_items (
      purchase_id,
      medicine_id,
      quantity,
      unit_price,
      subtotal
    )
    values (v_purchase_id, v_medicine_id, v_quantity, v_unit_price, v_subtotal);

    update public.medicines
    set stock = coalesce(stock, 0) + v_quantity
    where id = v_medicine_id;

    if not found then
      raise exception 'One of the medicines could not be found.';
    end if;
  end loop;

  if p_payment_status = 'Paid' then
    v_payment := v_total;
  elsif p_payment_status = 'Pending' then
    v_payment := 0;
  else
    v_payment := round(coalesce(p_payment_amount, 0), 2);
    if v_payment <= 0 or v_payment > v_total then
      raise exception 'Partial payment must be greater than 0 and no more than the total.';
    end if;
  end if;

  update public.medicine_purchases
  set total_amount = v_total,
      payment_amount = v_payment,
      payment_status = p_payment_status
  where id = v_purchase_id;

  if v_payment > 0 then
    begin
      select id into v_category_id
      from public.expense_categories
      where name = 'Medical Supplies'
      limit 1;
    exception
      when undefined_table then
        v_category_id := null;
    end;

    begin
      insert into public.transactions (
        amount,
        type,
        description,
        occurred_on,
        supplier_id,
        category_id
      )
      values (
        v_payment,
        'expense',
        'Medicine purchase',
        p_purchase_date,
        v_supplier_id,
        v_category_id
      );
    exception
      when undefined_column then
        insert into public.transactions (amount, type, description, occurred_on)
        values (v_payment, 'expense', 'Medicine purchase', p_purchase_date);
    end;
  end if;

  return v_purchase_id;
end;
$$;

grant execute on function public.create_medicine_purchase(text, date, numeric, text, jsonb) to authenticated;
