-- Edit and delete purchase vouchers.
-- Run this after supabase/medicine_packaging.sql.
-- Saving or deleting a voucher puts the previous batch quantities back into stock,
-- then applies the new lines. A linked expense is removed and written again when payment is above 0.

alter table public.medicine_purchases
  add column if not exists transaction_id text;

create or replace function public.apply_purchase_items(
  p_purchase_id uuid,
  p_items jsonb
) returns numeric
language plpgsql
security invoker
set search_path = public
as $$
declare
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
  v_batch_number text;
  v_expiry_date date;
begin
  if p_items is null or jsonb_array_length(p_items) = 0 then
    raise exception 'Add at least one medicine.';
  end if;

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
      p_purchase_id,
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
      p_purchase_id
    );

    update public.medicines
    set stock = coalesce(stock, 0) + v_base_quantity,
        price = v_sale_price
    where id = v_medicine_id;
  end loop;

  return v_total;
end;
$$;

create or replace function public.reverse_purchase_stock(p_purchase_id uuid)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_batch record;
begin
  for v_batch in
    select medicine_id, quantity
    from public.medicine_batches
    where purchase_id = p_purchase_id
  loop
    update public.medicines
    set stock = greatest(coalesce(stock, 0) - v_batch.quantity, 0)
    where id = v_batch.medicine_id;
  end loop;
end;
$$;

create or replace function public.remove_purchase_expense(p_purchase_id uuid)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_tx text;
  v_date date;
  v_amount numeric;
begin
  select transaction_id, purchase_date, payment_amount
    into v_tx, v_date, v_amount
  from public.medicine_purchases
  where id = p_purchase_id;

  if v_tx is not null and btrim(v_tx) <> '' then
    begin
      execute 'delete from public.transactions where id::text = $1' using v_tx;
    exception
      when undefined_table then
        null;
    end;
    return;
  end if;

  if coalesce(v_amount, 0) <= 0 then
    return;
  end if;

  begin
    execute $sql$
      delete from public.transactions
      where id = (
        select id
        from public.transactions
        where type = 'expense'
          and description = 'Medicine purchase'
          and occurred_on = $1
          and amount = $2
        limit 1
      )
    $sql$ using v_date, v_amount;
  exception
    when undefined_table or undefined_column then
      null;
  end;
end;
$$;

create or replace function public.record_purchase_expense(
  p_purchase_id uuid,
  p_supplier_id text,
  p_purchase_date date,
  p_payment numeric
) returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_category_id uuid;
  v_supplier_id public.suppliers.id%type;
  v_tx text;
begin
  if coalesce(p_payment, 0) <= 0 then
    update public.medicine_purchases
    set transaction_id = null
    where id = p_purchase_id;
    return;
  end if;

  v_supplier_id := p_supplier_id;

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
    execute $sql$
      insert into public.transactions (
        amount,
        type,
        description,
        occurred_on,
        supplier_id,
        category_id
      )
      values ($1, 'expense', 'Medicine purchase', $2, $3, $4)
      returning id::text
    $sql$ into v_tx using p_payment, p_purchase_date, v_supplier_id, v_category_id;
  exception
    when undefined_column then
      execute $sql$
        insert into public.transactions (amount, type, description, occurred_on)
        values ($1, 'expense', 'Medicine purchase', $2)
        returning id::text
      $sql$ into v_tx using p_payment, p_purchase_date;
    when undefined_table then
      v_tx := null;
  end;

  update public.medicine_purchases
  set transaction_id = v_tx
  where id = p_purchase_id;
end;
$$;

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
  v_total numeric(12, 2);
  v_payment numeric(12, 2);
begin
  if p_payment_status not in ('Paid', 'Pending', 'Partial') then
    raise exception 'Choose Paid, Pending, or Partial.';
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

  v_total := public.apply_purchase_items(v_purchase_id, p_items);

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

  perform public.record_purchase_expense(v_purchase_id, p_supplier_id, p_purchase_date, v_payment);

  return v_purchase_id;
end;
$$;

create or replace function public.update_medicine_purchase(
  p_purchase_id uuid,
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
  v_supplier_id public.suppliers.id%type;
  v_total numeric(12, 2);
  v_payment numeric(12, 2);
begin
  if p_payment_status not in ('Paid', 'Pending', 'Partial') then
    raise exception 'Choose Paid, Pending, or Partial.';
  end if;

  if not exists (select 1 from public.medicine_purchases where id = p_purchase_id) then
    raise exception 'This purchase voucher could not be found.';
  end if;

  v_supplier_id := p_supplier_id;

  perform public.remove_purchase_expense(p_purchase_id);
  perform public.reverse_purchase_stock(p_purchase_id);

  delete from public.medicine_batches
  where purchase_id = p_purchase_id;

  delete from public.medicine_purchase_items
  where purchase_id = p_purchase_id;

  update public.medicine_purchases
  set supplier_id = v_supplier_id,
      purchase_date = p_purchase_date,
      transaction_id = null
  where id = p_purchase_id;

  v_total := public.apply_purchase_items(p_purchase_id, p_items);

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
  where id = p_purchase_id;

  perform public.record_purchase_expense(p_purchase_id, p_supplier_id, p_purchase_date, v_payment);

  return p_purchase_id;
end;
$$;

create or replace function public.delete_medicine_purchase(p_purchase_id uuid)
returns void
language plpgsql
security invoker
set search_path = public
as $$
begin
  if not exists (select 1 from public.medicine_purchases where id = p_purchase_id) then
    raise exception 'This purchase voucher could not be found.';
  end if;

  perform public.remove_purchase_expense(p_purchase_id);
  perform public.reverse_purchase_stock(p_purchase_id);

  delete from public.medicine_purchases
  where id = p_purchase_id;
end;
$$;

grant execute on function public.apply_purchase_items(uuid, jsonb) to authenticated;
grant execute on function public.reverse_purchase_stock(uuid) to authenticated;
grant execute on function public.remove_purchase_expense(uuid) to authenticated;
grant execute on function public.record_purchase_expense(uuid, text, date, numeric) to authenticated;
grant execute on function public.create_medicine_purchase(text, date, numeric, text, jsonb) to authenticated;
grant execute on function public.update_medicine_purchase(uuid, text, date, numeric, text, jsonb) to authenticated;
grant execute on function public.delete_medicine_purchase(uuid) to authenticated;
