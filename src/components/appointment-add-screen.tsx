import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, Switch, Text, View } from 'react-native';

import {
  DatePickerField,
  ErrorBanner,
  firstSearchParam,
  LoadingMark,
  PrimaryButton,
  ScreenNavHeader,
  ScreenScroll,
  SelectField,
  TimePickerField,
} from '@/components/clinic-ui';
import { createAppointment, getAppointment, updateAppointment, type AppointmentStatus } from '@/services/appointments';
import { listPatients, type Patient } from '@/services/patients';
import { Palette, Spacing } from '@/constants/theme';
import { useI18n } from '@/constants/i18n';
import { useTheme } from '@/hooks/use-theme';

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
  copy: ReturnType<typeof useI18n>['appointment'],
): AppointmentErrors {
  const errors: AppointmentErrors = {};

  if (!patientId) {
    errors.patient = copy.selectPatient;
  }

  if (!date.trim()) {
    errors.date = copy.dateError;
  } else if (!isRealDate(date)) {
    errors.date = copy.dateInvalid;
  }

  if (isRealDate(date) && !time) {
    errors.time = copy.timeError;
  }

  return errors;
}

export function AppointmentAddScreen() {
  const theme = useTheme();
  const copy = useI18n().appointment;
  const common = useI18n().common;
  const { id } = useLocalSearchParams<{ id?: string | string[] }>();
  const recordId = firstSearchParam(id);
  const isEditing = Boolean(recordId);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);
  const [appointmentDate, setAppointmentDate] = useState(todayIsoDate);
  const [appointmentTime, setAppointmentTime] = useState<Date | null>(null);
  const [completed, setCompleted] = useState(false);
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
        setCompleted(appointment.status === 'completed');
        setSelectedPatientId(
          patientRows.some((patient) => patient.id === appointment.patient_id)
            ? appointment.patient_id
            : null,
        );
      } else {
        setCompleted(false);
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
            ? copy.loadError
            : copy.patientsError,
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
    const nextErrors = validateAppointment(selectedPatientId, appointmentDate, appointmentTime, copy);
    setFieldErrors(nextErrors);
    setFormError(null);

    if (!selectedPatientId || !appointmentTime || Object.keys(nextErrors).length > 0) {
      return;
    }

    const status: AppointmentStatus = completed ? 'completed' : 'pending';
    const payload = {
      patient_id: selectedPatientId,
      appointment_date: appointmentDate,
      appointment_time: formatAppointmentTime(appointmentTime),
      status,
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
            ? copy.updateError
            : copy.createError,
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <ScreenScroll withTabBar={false}>
      <ScreenNavHeader
        title={isEditing ? copy.edit : copy.add}
        onBack={() => router.back()}
      />
      {loading ? (
        <LoadingMark />
      ) : (
        <>
          <SelectField
            label={common.patient}
            required
            searchable
            pageSizes={[10, 20, 30, 50, 100]}
            placeholder={patients.length === 0 ? copy.registerFirst : copy.choosePatient}
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
          <DatePickerField
            label={common.date}
            required
            placeholder={common.chooseDate}
            value={appointmentDate}
            error={fieldErrors.date}
            disabled={saving}
            onChange={(value) => {
              setAppointmentDate(value);
              setFieldErrors((current) => ({ ...current, date: undefined, time: undefined }));
              setFormError(null);
            }}
          />
          {isRealDate(appointmentDate) ? (
            <TimePickerField
              label={common.time}
              required
              placeholder={common.chooseTime}
              value={appointmentTime}
              error={fieldErrors.time}
              disabled={saving}
              onChange={(value) => {
                setAppointmentTime(value);
                clearFieldError('time');
              }}
            />
          ) : null}
          <View style={styles.statusRow}>
            <View style={styles.statusCopy}>
              <Text style={[styles.statusLabel, { color: theme.text }]}>{common.status}</Text>
              <Text style={[styles.statusValue, { color: theme.textSecondary }]}>
                {completed ? common.completed : common.pending}
              </Text>
            </View>
            <Switch
              accessibilityLabel={common.status}
              value={completed}
              disabled={saving}
              onValueChange={setCompleted}
              trackColor={{ false: theme.border, true: Palette.primary }}
              thumbColor={Palette.white}
            />
          </View>
          {formError ? <ErrorBanner message={formError} /> : null}
          <PrimaryButton
            label={isEditing ? copy.save : copy.book}
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

const styles = StyleSheet.create({
  statusRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 52,
  },
  statusCopy: {
    gap: Spacing.one,
  },
  statusLabel: {
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
  },
  statusValue: {
    fontSize: 16,
    lineHeight: 22,
  },
});
