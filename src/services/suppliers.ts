import { supabase } from '@/services/supabase';

export type Supplier = {
  id: string;
  name: string;
  phone: string;
  address: string;
};

export type NewSupplier = Omit<Supplier, 'id'>;

export async function listSuppliers(): Promise<Supplier[]> {
  const { data, error } = await supabase
    .from('suppliers')
    .select('id, name, phone, address')
    .order('name', { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as Supplier[];
}

export async function createSupplier(supplier: NewSupplier): Promise<Supplier> {
  const { data, error } = await supabase
    .from('suppliers')
    .insert(supplier)
    .select('id, name, phone, address')
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data as Supplier;
}

export async function getSupplier(id: string): Promise<Supplier> {
  const { data, error } = await supabase
    .from('suppliers')
    .select('id, name, phone, address')
    .eq('id', id)
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data as Supplier;
}

export async function updateSupplier(id: string, supplier: NewSupplier): Promise<Supplier> {
  const { data, error } = await supabase
    .from('suppliers')
    .update(supplier)
    .eq('id', id)
    .select('id, name, phone, address')
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data as Supplier;
}

export async function deleteSupplier(id: string): Promise<void> {
  const { error } = await supabase.from('suppliers').delete().eq('id', id);

  if (error) {
    throw new Error(error.message);
  }
}
