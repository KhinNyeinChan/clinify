import { supabase } from '@/services/supabase';

export type NewMedicalRecord = {
  patient_id: string;
  symptoms: string;
  vitals: string;
  diagnosis: string;
  notes: string;
};

export type MedicalRecord = NewMedicalRecord & {
  id: string;
};

export async function createMedicalRecord(record: NewMedicalRecord): Promise<MedicalRecord> {
  const { data, error } = await supabase
    .from('medical_records')
    .insert(record)
    .select('id, patient_id, symptoms, vitals, diagnosis, notes')
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data as MedicalRecord;
}
