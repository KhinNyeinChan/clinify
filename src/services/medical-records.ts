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
  created_at: string | null;
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

  return { ...(data as MedicalRecord), created_at: null };
}

const RECORD_SELECT = 'id, patient_id, symptoms, vitals, diagnosis, notes, created_at';
const BASIC_RECORD_SELECT = 'id, patient_id, symptoms, vitals, diagnosis, notes';

function isMissingCreatedAt(message: string) {
  return /created_at|schema cache|could not find|column/i.test(message);
}

function parseRecord(row: unknown): MedicalRecord {
  const data = (row ?? {}) as Record<string, unknown>;
  return {
    id: String(data.id ?? ''),
    patient_id: String(data.patient_id ?? ''),
    symptoms: String(data.symptoms ?? ''),
    vitals: String(data.vitals ?? ''),
    diagnosis: String(data.diagnosis ?? ''),
    notes: String(data.notes ?? ''),
    created_at: typeof data.created_at === 'string' ? data.created_at : null,
  };
}

export async function listMedicalRecords(patientId: string): Promise<MedicalRecord[]> {
  const attempts = [
    { columns: RECORD_SELECT, ordered: true },
    { columns: BASIC_RECORD_SELECT, ordered: false },
  ];

  for (const attempt of attempts) {
    let query = supabase.from('medical_records').select(attempt.columns).eq('patient_id', patientId);
    if (attempt.ordered) {
      query = query.order('created_at', { ascending: false });
    }

    const result = await query;
    if (!result.error) {
      return ((result.data ?? []) as unknown[]).map(parseRecord);
    }

    if (!isMissingCreatedAt(result.error.message)) {
      throw new Error(result.error.message);
    }
  }

  throw new Error('Could not load visit records.');
}
