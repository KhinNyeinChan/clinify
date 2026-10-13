import { supabase } from '@/services/supabase';

export type AppointmentStatus = 'pending' | 'completed';

export type NewAppointment = {
  patient_id: string;
  appointment_date: string;
  appointment_time: string;
  status: AppointmentStatus;
};

export type Appointment = NewAppointment & {
  id: string;
};

function isMissingColumn(message: string) {
  return /appointment_time|status|schema cache|could not find/i.test(message);
}

function asStatus(value: unknown): AppointmentStatus {
  return value === 'completed' ? 'completed' : 'pending';
}

const FULL_SELECT = 'id, patient_id, appointment_date, appointment_time, status';
const TIME_SELECT = 'id, patient_id, appointment_date, appointment_time';
const BASIC_SELECT = 'id, patient_id, appointment_date';

async function selectRows(
  build: (columns: string) => PromiseLike<{ data: unknown; error: { message: string } | null }>,
) {
  for (const columns of [FULL_SELECT, TIME_SELECT, BASIC_SELECT]) {
    const result = await build(columns);
    if (!result.error) {
      const rows = Array.isArray(result.data) ? result.data : result.data ? [result.data] : [];
      return rows.map((row) => asAppointment(row as Appointment));
    }
    if (!isMissingColumn(result.error.message)) {
      throw new Error(result.error.message);
    }
  }

  throw new Error('Could not load appointments.');
}

export async function listAppointments(): Promise<Appointment[]> {
  return selectRows((columns) =>
    supabase.from('appointments').select(columns).order('appointment_date', { ascending: false }),
  );
}

export async function listAppointmentsForDate(date: string): Promise<Appointment[]> {
  return selectRows((columns) => {
    const query = supabase.from('appointments').select(columns).eq('appointment_date', date);
    return columns === BASIC_SELECT
      ? query.order('appointment_date', { ascending: true })
      : query.order('appointment_time', { ascending: true });
  });
}

function asAppointment(
  row: Omit<Appointment, 'appointment_time' | 'status'> & {
    appointment_time?: string | null;
    status?: string | null;
  },
  fallbackTime = '',
): Appointment {
  return {
    id: row.id,
    patient_id: row.patient_id,
    appointment_date: row.appointment_date,
    appointment_time: row.appointment_time || fallbackTime,
    status: asStatus(row.status),
  };
}

export async function getAppointment(id: string): Promise<Appointment> {
  const rows = await selectRows((columns) =>
    supabase.from('appointments').select(columns).eq('id', id).single(),
  );
  const appointment = rows[0];
  if (!appointment) {
    throw new Error('Could not load the appointment.');
  }
  return appointment;
}

function withoutStatus(appointment: NewAppointment) {
  return {
    patient_id: appointment.patient_id,
    appointment_date: appointment.appointment_date,
    appointment_time: appointment.appointment_time,
  };
}

async function writeAppointment(appointment: NewAppointment, id?: string): Promise<Appointment> {
  const attempts: { payload: Record<string, unknown>; select: string }[] = [
    { payload: appointment, select: FULL_SELECT },
    { payload: withoutStatus(appointment), select: TIME_SELECT },
    {
      payload: {
        patient_id: appointment.patient_id,
        appointment_date: `${appointment.appointment_date}T${appointment.appointment_time}:00`,
      },
      select: BASIC_SELECT,
    },
  ];

  for (const attempt of attempts) {
    const query = id
      ? supabase.from('appointments').update(attempt.payload).eq('id', id)
      : supabase.from('appointments').insert(attempt.payload);
    const result = await query.select(attempt.select).single();

    if (!result.error) {
      return asAppointment(result.data as unknown as Appointment, appointment.appointment_time);
    }

    if (/status/i.test(result.error.message) && appointment.status === 'completed') {
      throw new Error(
        'Add the appointments.status column in Supabase before marking an appointment completed.',
      );
    }

    if (!isMissingColumn(result.error.message)) {
      throw new Error(result.error.message);
    }
  }

  throw new Error(id ? 'Could not update the appointment.' : 'Could not book the appointment.');
}

export async function createAppointment(appointment: NewAppointment): Promise<Appointment> {
  return writeAppointment(appointment);
}

export async function updateAppointment(id: string, appointment: NewAppointment): Promise<Appointment> {
  return writeAppointment(appointment, id);
}

export async function deleteAppointment(id: string): Promise<void> {
  const { error } = await supabase.from('appointments').delete().eq('id', id);

  if (error) {
    throw new Error(error.message);
  }
}
