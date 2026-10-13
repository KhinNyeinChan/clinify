import { supabase } from '@/services/supabase';

export type Patient = {
  id: string;
  name: string;
  age: number;
  phone: string;
  address: string;
  note: string;
};

export type NewPatient = Omit<Patient, 'id'>;

const FULL_SELECT = 'id, name, age, phone, address, note';
const BASIC_SELECT = 'id, name, age, phone, address';

function isMissingNote(message: string) {
  return /note|schema cache|could not find|column/i.test(message);
}

function parsePatient(row: unknown, note?: string | null): Patient {
  const data = (row ?? {}) as Record<string, unknown>;
  return {
    id: String(data.id ?? ''),
    name: String(data.name ?? ''),
    age: Number(data.age ?? 0),
    phone: String(data.phone ?? ''),
    address: String(data.address ?? ''),
    note: note ?? (typeof data.note === 'string' ? data.note : ''),
  };
}

function withoutNote(patient: NewPatient) {
  return {
    name: patient.name,
    age: patient.age,
    phone: patient.phone,
    address: patient.address,
  };
}

async function selectPatients(filter?: { id: string }) {
  for (const columns of [FULL_SELECT, BASIC_SELECT]) {
    const query = supabase.from('patients').select(columns);
    const result = filter ? await query.eq('id', filter.id).single() : await query.order('name', { ascending: true });

    if (!result.error) {
      return result.data;
    }

    if (!isMissingNote(result.error.message)) {
      throw new Error(result.error.message);
    }
  }

  throw new Error(filter ? 'Could not load the patient.' : 'Could not load patients.');
}

async function writePatient(patient: NewPatient, id?: string) {
  const attempts = [
    { payload: patient, select: FULL_SELECT },
    { payload: withoutNote(patient), select: BASIC_SELECT },
  ];

  for (const attempt of attempts) {
    const query = id
      ? supabase.from('patients').update(attempt.payload).eq('id', id)
      : supabase.from('patients').insert(attempt.payload);
    const result = await query.select(attempt.select).single();

    if (!result.error) {
      return parsePatient(result.data, patient.note);
    }

    if (!isMissingNote(result.error.message)) {
      throw new Error(result.error.message);
    }

    if (patient.note.trim()) {
      throw new Error('Add the patients.note column in Supabase before saving a note.');
    }
  }

  throw new Error(id ? 'Could not update the patient.' : 'Could not register the patient.');
}

export async function listPatients(): Promise<Patient[]> {
  const data = await selectPatients();
  return ((data ?? []) as unknown[]).map((row) => parsePatient(row));
}

export async function createPatient(patient: NewPatient): Promise<Patient> {
  return writePatient(patient);
}

export async function getPatient(id: string): Promise<Patient> {
  return parsePatient(await selectPatients({ id }));
}

export async function updatePatient(id: string, patient: NewPatient): Promise<Patient> {
  return writePatient(patient, id);
}

export async function deletePatient(id: string): Promise<void> {
  const { error } = await supabase.from('patients').delete().eq('id', id);

  if (error) {
    throw new Error(error.message);
  }
}
