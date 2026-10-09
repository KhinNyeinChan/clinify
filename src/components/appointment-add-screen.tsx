import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';

import {
  ErrorBanner,
  Field,
  firstSearchParam,
  LoadingMark,
  PrimaryButton,
  ScreenNavHeader,
  ScreenScroll,
  SelectField,
  TimePickerField,
} from '@/components/clinic-ui';
import { createAppointment, getAppointment, updateAppointment } from '@/services/appointments';
import { listPatients, type Patient } from '@/services/patients';

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

type AppointmentErrors = {
  patient?: string;
  date?: string;
  time?: string;
};

function formatAppointmentTime(date: Date) {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

function todayIsoDate() {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}

function formatTime(value: string) {
  if (!value) {
    return '';
  }

  const time = value.includes('T') ? value.split('T')[1] ?? value : value;
  return time.slice(0, 5);
}

function isRealDate(value: string) {
  if (!DATE_PATTERN.test(value)) {
    return false;
  }

  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
}

function timeToDate(dateValue: string, timeValue: string): Date | null {
  const datePart = dateValue.slice(0, 10);
  const timePart = formatTime(timeValue || dateValue);
  if (!isRealDate(datePart) || !/^\d{2}:\d{2}$/.test(timePart)) {
    return null;
  }

  const [year, month, day] = datePart.split('-').map(Number);
  const [hours, minutes] = timePart.split(':').map(Number);
  return new Date(year, month - 1, day, hours, minutes);
}

function validateAppointment(
  patientId: string | null,
  date: string,
  time: Date | null,
): AppointmentErrors {
  const errors: AppointmentErrors = {};

  if (!patientId) {
    errors.patient = 'Select a patient.';
  }

  if (!date.trim()) {
    errors.date = 'Enter an appointment date.';
  } else if (!isRealDate(date)) {
    errors.date = 'Use a real date in YYYY-MM-DD format.';
  }

  if (isRealDate(date) && !time) {
    errors.time = 'Choose an appointment time.';
  }

  return errors;
}

export function AppointmentAddScreen() {
  const { id } = useLocalSearchParams<{ id?: string | string[] }>();
  const recordId = firstSearchParam(id);
  const isEditing = Boolean(recordId);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);
  const [appointmentDate, setAppointmentDate] = useState(todayIsoDate);
  const [appointmentTime, setAppointmentTime] = useState<Date | null>(null);
  const [fieldErrors, setFieldErrors] = useState<AppointmentErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [patientRows, appointment] = await Promise.all([
        listPatients(),
        recordId ? getAppointment(recordId) : Promise.resolve(null),
      ]);
      setPatients(patientRows);
      if (appointment) {
        const date = appointment.appointment_date.slice(0, 10);
        setAppointmentDate(date);
        setAppointmentTime(timeToDate(date, appointment.appointment_time || appointment.appointment_date));
        setSelectedPatientId(
          patientRows.some((patient) => patient.id === appointment.patient_id)
            ? appointment.patient_id
            : null,
        );
      } else {
        setSelectedPatientId((current) =>
          current && patientRows.some((patient) => patient.id === current) ? current : null,
        );
      }
      setFormError(null);
    } catch (error) {
      setFormError(
        error instanceof Error
          ? error.message
          : isEditing
            ? 'Could not load the appointment.'
            : 'Could not load patients.',
      );
    } finally {
      setLoading(false);
    }
  }, [isEditing, recordId]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  function clearFieldError(field: keyof AppointmentErrors) {
    setFieldErrors((current) => ({ ...current, [field]: undefined }));
    setFormError(null);
  }

  async function saveAppointment() {
    const nextErrors = validateAppointment(selectedPatientId, appointmentDate, appointmentTime);
    setFieldErrors(nextErrors);
    setFormError(null);

    if (!selectedPatientId || !appointmentTime || Object.keys(nextErrors).length > 0) {
      return;
    }

    const payload = {
      patient_id: selectedPatientId,
      appointment_date: appointmentDate,
      appointment_time: formatAppointmentTime(appointmentTime),
    };

    setSaving(true);
    try {
      if (recordId) {
        await updateAppointment(recordId, payload);
      } else {
        await createAppointment(payload);
      }
      router.back();
    } catch (error) {
      setFormError(
        error instanceof Error
          ? error.message
          : isEditing
            ? 'Could not update the appointment.'
            : 'Could not book the appointment.',
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <ScreenScroll withTabBar={false}>
      <ScreenNavHeader
        title={isEditing ? 'Edit appointment' : 'Add appointment'}
        onBack={() => router.back()}
      />
      {loading ? (
        <LoadingMark />
      ) : (
        <>
          <SelectField
            label="Patient"
            placeholder={
              patients.length === 0 ? 'Register a patient first' : 'Choose patient'
            }
            value={selectedPatientId}
            options={patients.map((patient) => ({
              value: patient.id,
              label: `${patient.name} · ${patient.phone}`,
            }))}
            error={fieldErrors.patient}
            disabled={saving || patients.length === 0}
            onChange={(value) => {
              setSelectedPatientId(value);
              clearFieldError('patient');
            }}
          />
          <Field
            label="Date"
            value={appointmentDate}
            error={fieldErrors.date}
            editable={!saving}
            autoCapitalize="none"
            placeholder="YYYY-MM-DD"
            onChangeText={(value) => {
              setAppointmentDate(value);
              setFieldErrors((current) => ({ ...current, date: undefined, time: undefined }));
              setFormError(null);
            }}
          />
          {isRealDate(appointmentDate) ? (
            <TimePickerField
              label="Time"
              placeholder="Choose time"
              value={appointmentTime}
              error={fieldErrors.time}
              disabled={saving}
              onChange={(value) => {
                setAppointmentTime(value);
                clearFieldError('time');
              }}
            />
          ) : null}
          {formError ? <ErrorBanner message={formError} /> : null}
          <PrimaryButton
            label={isEditing ? 'Save appointment' : 'Book appointment'}
            loading={saving}
            disabled={patients.length === 0}
            onPress={() => {
              void saveAppointment();
            }}
          />
        </>
      )}
    </ScreenScroll>
  );
}
