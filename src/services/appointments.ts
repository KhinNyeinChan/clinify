import { supabase } from '@/services/supabase';

export type NewAppointment = {
  patient_id: string;
  appointment_date: string;
  appointment_time: string;
};

export type Appointment = NewAppointment & {
  id: string;
};

function isMissingTimeColumn(message: string) {
  return /appointment_time|schema cache|could not find/i.test(message);
}

export async function listAppointments(): Promise<Appointment[]> {
  const withTime = await supabase
    .from('appointments')
    .select('id, patient_id, appointment_date, appointment_time')
    .order('appointment_date', { ascending: false });

  if (!withTime.error) {
    return (withTime.data ?? []) as Appointment[];
  }

  if (!isMissingTimeColumn(withTime.error.message)) {
    throw new Error(withTime.error.message);
  }

  const { data, error } = await supabase
    .from('appointments')
    .select('id, patient_id, appointment_date')
    .order('appointment_date', { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return ((data ?? []) as Omit<Appointment, 'appointment_time'>[]).map((row) => ({
    ...row,
    appointment_time: '',
  }));
}

export async function listAppointmentsForDate(date: string): Promise<Appointment[]> {
  const withTime = await supabase
    .from('appointments')
    .select('id, patient_id, appointment_date, appointment_time')
    .eq('appointment_date', date)
    .order('appointment_time', { ascending: true });

  if (!withTime.error) {
    return (withTime.data ?? []) as Appointment[];
  }

  if (!isMissingTimeColumn(withTime.error.message)) {
    throw new Error(withTime.error.message);
  }

  const { data, error } = await supabase
    .from('appointments')
    .select('id, patient_id, appointment_date')
    .eq('appointment_date', date)
    .order('appointment_date', { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return ((data ?? []) as Omit<Appointment, 'appointment_time'>[]).map((row) => ({
    ...row,
    appointment_time: '',
  }));
}

function asAppointment(
  row: Omit<Appointment, 'appointment_time'> & { appointment_time?: string | null },
  fallbackTime = '',
): Appointment {
  return {
    id: row.id,
    patient_id: row.patient_id,
    appointment_date: row.appointment_date,
    appointment_time: row.appointment_time || fallbackTime,
  };
}

export async function getAppointment(id: string): Promise<Appointment> {
  const withTime = await supabase
    .from('appointments')
    .select('id, patient_id, appointment_date, appointment_time')
    .eq('id', id)
    .single();

  if (!withTime.error) {
    return asAppointment(withTime.data as Appointment);
  }

  if (!isMissingTimeColumn(withTime.error.message)) {
    throw new Error(withTime.error.message);
  }

  const { data, error } = await supabase
    .from('appointments')
    .select('id, patient_id, appointment_date')
    .eq('id', id)
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return asAppointment(data as Omit<Appointment, 'appointment_time'>);
}

export async function createAppointment(appointment: NewAppointment): Promise<Appointment> {
  const withTime = await supabase
    .from('appointments')
    .insert(appointment)
    .select('id, patient_id, appointment_date, appointment_time')
    .single();

  if (!withTime.error) {
    return asAppointment(withTime.data as Appointment);
  }

  if (!isMissingTimeColumn(withTime.error.message)) {
    throw new Error(withTime.error.message);
  }

  const { data, error } = await supabase
    .from('appointments')
    .insert({
      patient_id: appointment.patient_id,
      appointment_date: `${appointment.appointment_date}T${appointment.appointment_time}:00`,
    })
    .select('id, patient_id, appointment_date')
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return asAppointment(data as Omit<Appointment, 'appointment_time'>, appointment.appointment_time);
}

export async function updateAppointment(id: string, appointment: NewAppointment): Promise<Appointment> {
  const withTime = await supabase
    .from('appointments')
    .update(appointment)
    .eq('id', id)
    .select('id, patient_id, appointment_date, appointment_time')
    .single();

  if (!withTime.error) {
    return asAppointment(withTime.data as Appointment);
  }

  if (!isMissingTimeColumn(withTime.error.message)) {
    throw new Error(withTime.error.message);
  }

  const { data, error } = await supabase
    .from('appointments')
    .update({
      patient_id: appointment.patient_id,
      appointment_date: `${appointment.appointment_date}T${appointment.appointment_time}:00`,
    })
    .eq('id', id)
    .select('id, patient_id, appointment_date')
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return asAppointment(data as Omit<Appointment, 'appointment_time'>, appointment.appointment_time);
}

export async function deleteAppointment(id: string): Promise<void> {
  const { error } = await supabase.from('appointments').delete().eq('id', id);

  if (error) {
    throw new Error(error.message);
  }
}
