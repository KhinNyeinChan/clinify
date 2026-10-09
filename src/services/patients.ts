import { supabase } from '@/services/supabase';

export type Patient = {
  id: string;
  name: string;
  age: number;
  phone: string;
  address: string;
};

export type NewPatient = Omit<Patient, 'id'>;

export async function listPatients(): Promise<Patient[]> {
  const { data, error } = await supabase
    .from('patients')
    .select('id, name, age, phone, address')
    .order('name', { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as Patient[];
}

export async function createPatient(patient: NewPatient): Promise<Patient> {
  const { data, error } = await supabase
    .from('patients')
    .insert(patient)
    .select('id, name, age, phone, address')
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data as Patient;
}

export async function getPatient(id: string): Promise<Patient> {
  const { data, error } = await supabase
    .from('patients')
    .select('id, name, age, phone, address')
    .eq('id', id)
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data as Patient;
}

export async function updatePatient(id: string, patient: NewPatient): Promise<Patient> {
  const { data, error } = await supabase
    .from('patients')
    .update(patient)
    .eq('id', id)
    .select('id, name, age, phone, address')
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data as Patient;
}

export async function deletePatient(id: string): Promise<void> {
  const { error } = await supabase.from('patients').delete().eq('id', id);

  if (error) {
    throw new Error(error.message);
  }
}
