import { supabase } from '@/services/supabase';

export type Medicine = {
  id: string;
  name: string;
  stock: number;
  price: number;
  supplier_id: string;
  box_unit_name: string;
  units_per_box: number;
};

export type NewMedicine = Omit<Medicine, 'id'>;

const MEDICINE_COLUMNS = 'id, name, stock, price, supplier_id, box_unit_name, units_per_box';
const MEDICINE_COLUMNS_BASIC = 'id, name, stock, price, supplier_id';

function isMissingColumn(message: string) {
  return /does not exist|schema cache/i.test(message);
}

function asMedicine(row: Medicine): Medicine {
  const perBox = Number(row.units_per_box);
  return {
    ...row,
    stock: Number(row.stock),
    price: Number(row.price),
    box_unit_name: row.box_unit_name?.trim() || 'Unit',
    units_per_box: Number.isInteger(perBox) && perBox > 0 ? perBox : 1,
  };
}

async function readMedicines(id?: string) {
  const run = (columns: string) => {
    const query = supabase.from('medicines').select(columns);
    return id ? query.eq('id', id).maybeSingle() : query.order('name', { ascending: true });
  };

  let result = await run(MEDICINE_COLUMNS);
  if (result.error && isMissingColumn(result.error.message)) {
    result = await run(MEDICINE_COLUMNS_BASIC);
  }
  return result;
}

export async function listMedicines(): Promise<Medicine[]> {
  const { data, error } = await readMedicines();

  if (error) {
    throw new Error(error.message);
  }

  return ((data ?? []) as unknown as Medicine[]).map((row) => asMedicine(row));
}

export async function createMedicine(medicine: NewMedicine): Promise<Medicine> {
  const { data, error } = await supabase
    .from('medicines')
    .insert(medicine)
    .select(MEDICINE_COLUMNS)
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return asMedicine(data as unknown as Medicine);
}

export async function getMedicine(id: string): Promise<Medicine> {
  const { data, error } = await readMedicines(id);

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    throw new Error('Medicine not found.');
  }

  return asMedicine(data as unknown as Medicine);
}

export async function updateMedicine(id: string, medicine: NewMedicine): Promise<Medicine> {
  const { data, error } = await supabase
    .from('medicines')
    .update(medicine)
    .eq('id', id)
    .select(MEDICINE_COLUMNS)
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return asMedicine(data as unknown as Medicine);
}

export type MedicineBatch = {
  id: string;
  medicine_id: string;
  batch_number: string;
  expiry_date: string;
  quantity: number;
  original_price: number;
  sale_price: number;
};

const BATCH_COLUMNS = 'id, medicine_id, batch_number, expiry_date, quantity, original_price, sale_price';
const BATCH_COLUMNS_BASIC = 'id, medicine_id, batch_number, expiry_date, quantity';

function asBatch(row: MedicineBatch): MedicineBatch {
  return {
    id: String(row.id),
    medicine_id: String(row.medicine_id ?? ''),
    batch_number: row.batch_number,
    expiry_date: String(row.expiry_date).slice(0, 10),
    quantity: Number(row.quantity ?? 0),
    original_price: Number(row.original_price ?? 0),
    sale_price: Number(row.sale_price ?? 0),
  };
}

async function readBatches(medicineId?: string) {
  const run = (columns: string) => {
    let query = supabase.from('medicine_batches').select(columns).order('expiry_date', { ascending: true });
    if (medicineId) {
      query = query.eq('medicine_id', medicineId);
    } else {
      query = query.gt('quantity', 0);
    }
    return query;
  };

  let result = await run(BATCH_COLUMNS);
  if (result.error && isMissingColumn(result.error.message)) {
    result = await run(BATCH_COLUMNS_BASIC);
  }
  return result;
}

export async function listMedicineBatches(medicineId: string): Promise<MedicineBatch[]> {
  const { data, error } = await readBatches(medicineId);

  if (error) {
    throw new Error(error.message);
  }

  return ((data ?? []) as unknown as MedicineBatch[]).map((row) => asBatch(row));
}

export async function listAllMedicineBatches(): Promise<MedicineBatch[]> {
  const { data, error } = await readBatches();

  if (error) {
    throw new Error(error.message);
  }

  return ((data ?? []) as unknown as MedicineBatch[]).map((row) => asBatch(row));
}

export async function deleteMedicine(id: string): Promise<void> {
  const { error } = await supabase.from('medicines').delete().eq('id', id);

  if (error) {
    throw new Error(error.message);
  }
}
