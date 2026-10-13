-- Boxes and base units, plus original and sale prices on each batch.
-- Run this after supabase/medicine_batches.sql.
-- Stock and batch quantity are always stored in base units (the unit named on the medicine).
-- A box adds quantity × units_per_box. The voucher subtotal is quantity × original price
-- of the pack being bought (one box, or one base unit).

alter table public.medicines
  add column if not exists box_unit_name text;

alter table public.medicines
  add column if not exists units_per_box integer;

update public.medicines
set box_unit_name = 'Unit'
where box_unit_name is null or btrim(box_unit_name) = '';

update public.medicines
set units_per_box = 1
where units_per_box is null or units_per_box < 1;

alter table public.medicines
  alter column box_unit_name set default 'Unit';

alter table public.medicines
  alter column box_unit_name set not null;

alter table public.medicines
  alter column units_per_box set default 1;

alter table public.medicines
  alter column units_per_box set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'medicines_units_per_box_check'
      and conrelid = 'public.medicines'::regclass
  ) then
    alter table public.medicines
      add constraint medicines_units_per_box_check check (units_per_box > 0);
  end if;
end $$;

alter table public.medicine_batches
  add column if not exists original_price numeric(12, 2);

alter table public.medicine_batches
  add column if not exists sale_price numeric(12, 2);

update public.medicine_batches
set original_price = 0
where original_price is null;

update public.medicine_batches
set sale_price = 0
where sale_price is null;

alter table public.medicine_batches
  alter column original_price set default 0;

alter table public.medicine_batches
  alter column original_price set not null;

alter table public.medicine_batches
  alter column sale_price set default 0;

alter table public.medicine_batches
  alter column sale_price set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'medicine_batches_original_price_check'
      and conrelid = 'public.medicine_batches'::regclass
  ) then
    alter table public.medicine_batches
      add constraint medicine_batches_original_price_check check (original_price >= 0);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'medicine_batches_sale_price_check'
      and conrelid = 'public.medicine_batches'::regclass
  ) then
    alter table public.medicine_batches
      add constraint medicine_batches_sale_price_check check (sale_price >= 0);
  end if;
end $$;

alter table public.medicine_purchase_items
  add column if not exists pack_type text;

alter table public.medicine_purchase_items
  add column if not exists base_quantity integer;

update public.medicine_purchase_items
set pack_type = 'unit'
where pack_type is null or pack_type not in ('box', 'unit');

update public.medicine_purchase_items
set base_quantity = quantity
where base_quantity is null;

alter table public.medicine_purchase_items
  alter column pack_type set default 'unit';

alter table public.medicine_purchase_items
  alter column pack_type set not null;

alter table public.medicine_purchase_items
  alter column base_quantity set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'medicine_purchase_items_pack_type_check'
      and conrelid = 'public.medicine_purchase_items'::regclass
  ) then
    alter table public.medicine_purchase_items
      add constraint medicine_purchase_items_pack_type_check
      check (pack_type in ('box', 'unit'));
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'medicine_purchase_items_base_quantity_check'
      and conrelid = 'public.medicine_purchase_items'::regclass
  ) then
    alter table public.medicine_purchase_items
      add constraint medicine_purchase_items_base_quantity_check
      check (base_quantity > 0);
  end if;
end $$;

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
  v_pack_type text;
  v_quantity integer;
  v_per_box integer;
  v_base_quantity integer;
  v_original_price numeric(12, 2);
  v_sale_price numeric(12, 2);
  v_subtotal numeric(12, 2);
  v_total numeric(12, 2) := 0;
  v_payment numeric(12, 2);
  v_category_id uuid;
  v_batch_number text;
  v_expiry_date date;
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
    v_pack_type := lower(coalesce(nullif(btrim(v_item ->> 'pack_type'), ''), 'unit'));
    v_quantity := (v_item ->> 'quantity')::integer;
    v_original_price := round((v_item ->> 'original_price')::numeric, 2);
    v_sale_price := round((v_item ->> 'sale_price')::numeric, 2);
    v_batch_number := nullif(btrim(v_item ->> 'batch_number'), '');
    v_expiry_date := nullif(v_item ->> 'expiry_date', '')::date;

    if v_pack_type not in ('box', 'unit') then
      raise exception 'Choose Boxes or Units for each medicine.';
    end if;

    if v_medicine_id is null
      or v_quantity is null
      or v_quantity <= 0
      or v_original_price is null
      or v_original_price < 0
      or v_sale_price is null
      or v_sale_price < 0 then
      raise exception 'Each medicine needs a quantity above 0, an original price of 0 or more, and a sale price of 0 or more.';
    end if;

    if v_batch_number is null or v_expiry_date is null then
      raise exception 'Each medicine needs a batch number and expiry date.';
    end if;

    select units_per_box
      into v_per_box
    from public.medicines
    where id = v_medicine_id;

    if not found then
      raise exception 'One of the medicines could not be found.';
    end if;

    if v_per_box is null or v_per_box < 1 then
      v_per_box := 1;
    end if;

    if v_pack_type = 'box' then
      v_base_quantity := v_quantity * v_per_box;
    else
      v_base_quantity := v_quantity;
    end if;

    if v_base_quantity is null or v_base_quantity <= 0 then
      raise exception 'The stock quantity must be above 0.';
    end if;

    v_subtotal := round(v_quantity * v_original_price, 2);
    v_total := v_total + v_subtotal;

    insert into public.medicine_purchase_items (
      purchase_id,
      medicine_id,
      quantity,
      unit_price,
      subtotal,
      pack_type,
      base_quantity
    )
    values (
      v_purchase_id,
      v_medicine_id,
      v_quantity,
      v_original_price,
      v_subtotal,
      v_pack_type,
      v_base_quantity
    );

    insert into public.medicine_batches (
      medicine_id,
      batch_number,
      expiry_date,
      quantity,
      original_price,
      sale_price,
      purchase_id
    )
    values (
      v_medicine_id,
      v_batch_number,
      v_expiry_date,
      v_base_quantity,
      v_original_price,
      v_sale_price,
      v_purchase_id
    );

    update public.medicines
    set stock = coalesce(stock, 0) + v_base_quantity,
        price = v_sale_price
    where id = v_medicine_id;
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
