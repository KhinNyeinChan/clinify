import { supabase } from '@/services/supabase';

export type Medicine = {
  id: string;
  name: string;
  stock: number;
  price: number;
  supplier_id: string;
};

export type NewMedicine = Omit<Medicine, 'id'>;

function asMedicine(row: Medicine): Medicine {
  return {
    ...row,
    stock: Number(row.stock),
    price: Number(row.price),
  };
}

export async function listMedicines(): Promise<Medicine[]> {
  const { data, error } = await supabase
    .from('medicines')
    .select('id, name, stock, price, supplier_id')
    .order('name', { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []).map((row) => asMedicine(row as Medicine));
}

export async function createMedicine(medicine: NewMedicine): Promise<Medicine> {
  const { data, error } = await supabase
    .from('medicines')
    .insert(medicine)
    .select('id, name, stock, price, supplier_id')
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return asMedicine(data as Medicine);
}

export async function getMedicine(id: string): Promise<Medicine> {
  const { data, error } = await supabase
    .from('medicines')
    .select('id, name, stock, price, supplier_id')
    .eq('id', id)
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return asMedicine(data as Medicine);
}

export async function updateMedicine(id: string, medicine: NewMedicine): Promise<Medicine> {
  const { data, error } = await supabase
    .from('medicines')
    .update(medicine)
    .eq('id', id)
    .select('id, name, stock, price, supplier_id')
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return asMedicine(data as Medicine);
}

export async function deleteMedicine(id: string): Promise<void> {
  const { error } = await supabase.from('medicines').delete().eq('id', id);

  if (error) {
    throw new Error(error.message);
  }
}
