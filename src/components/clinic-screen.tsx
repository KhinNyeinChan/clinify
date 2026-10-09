import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import {
  ConfirmDialog,
  deleteErrorMessage,
  EmptyState,
  ErrorBanner,
  IconButton,
  ListRowActions,
  LoadingMark,
  ScreenScroll,
  TopTabs,
} from '@/components/clinic-ui';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { deleteAppointment, listAppointments, type Appointment } from '@/services/appointments';
import { deletePatient, listPatients, type Patient } from '@/services/patients';

function formatDate(value: string) {
  return value.slice(0, 10);
}

function formatTime(value: string) {
  if (!value) {
    return '';
  }

  const time = value.includes('T') ? value.split('T')[1] ?? value : value;
  return time.slice(0, 5);
}

type PendingDelete =
  | { kind: 'patient'; id: string }
  | { kind: 'appointment'; id: string };

export function ClinicScreen() {
  const theme = useTheme();
  const [clinicTab, setClinicTab] = useState<'patients' | 'appointment'>('patients');
  const [patients, setPatients] = useState<Patient[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<PendingDelete | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [patientRows, appointmentRows] = await Promise.all([
        listPatients(),
        listAppointments(),
      ]);
      setPatients(patientRows);
      setAppointments(appointmentRows);
      setListError(null);
    } catch (error) {
      setListError(error instanceof Error ? error.message : 'Could not load clinic data.');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  function patientName(patientId: string) {
    return patients.find((patient) => patient.id === patientId)?.name ?? 'Unknown patient';
  }

  async function confirmDelete() {
    if (!pendingDelete) {
      return;
    }

    setDeleting(true);
    try {
      if (pendingDelete.kind === 'patient') {
        await deletePatient(pendingDelete.id);
      } else {
        await deleteAppointment(pendingDelete.id);
      }
      setPendingDelete(null);
      setListError(null);
      await load();
    } catch (error) {
      setPendingDelete(null);
      setListError(
        deleteErrorMessage(
          error,
          pendingDelete.kind === 'patient'
            ? 'Could not delete the patient.'
            : 'Could not delete the appointment.',
        ),
      );
    } finally {
      setDeleting(false);
    }
  }

  return (
    <ScreenScroll>
      <TopTabs
        value={clinicTab}
        onChange={(value) => setClinicTab(value as 'patients' | 'appointment')}
        tabs={[
          { value: 'patients', label: 'Patients' },
          { value: 'appointment', label: 'Appointment' },
        ]}
      />

      {clinicTab === 'patients' ? (
        <>
          <View style={styles.heading}>
            <Text style={[styles.title, { color: theme.text }]}>
              Patient list ( {patients.length} )
            </Text>
            <IconButton
              name="add"
              variant="accent"
              accessibilityLabel="Add patient"
              onPress={() => router.push('/patient/new')}
            />
          </View>
          {loading ? (
            <LoadingMark />
          ) : (
            <>
              {listError ? <ErrorBanner message={listError} /> : null}
              {patients.length === 0 ? (
                listError ? null : <EmptyState message="No patients yet." />
              ) : (
                <View>
                  {patients.map((patient) => (
                    <View
                      key={patient.id}
                      style={[styles.item, { borderBottomColor: theme.border }]}>
                      <View style={styles.itemBody}>
                        <Text style={[styles.itemTitle, { color: theme.text }]}>{patient.name}</Text>
                        <Text style={[styles.itemMeta, { color: theme.textSecondary }]}>
                          {patient.age} years · {patient.phone}
                        </Text>
                        <Text style={[styles.itemMeta, { color: theme.textSecondary }]}>
                          {patient.address}
                        </Text>
                      </View>
                      <ListRowActions
                        disabled={deleting}
                        onEdit={() => router.push(`/patient/new?id=${patient.id}`)}
                        onDelete={() => setPendingDelete({ kind: 'patient', id: patient.id })}
                      />
                    </View>
                  ))}
                </View>
              )}
            </>
          )}
        </>
      ) : (
        <>
          <View style={styles.heading}>
            <Text style={[styles.title, { color: theme.text }]}>
              Appointment list ( {appointments.length} )
            </Text>
            <IconButton
              name="add"
              variant="accent"
              accessibilityLabel="Add appointment"
              onPress={() => router.push('/appointment/new')}
            />
          </View>
          {loading ? (
            <LoadingMark />
          ) : (
            <>
              {listError ? <ErrorBanner message={listError} /> : null}
              {appointments.length === 0 ? (
                listError ? null : <EmptyState message="No appointments yet." />
              ) : (
                <View>
                  {appointments.map((appointment) => {
                    const time = formatTime(appointment.appointment_time || appointment.appointment_date);
                    return (
                      <View
                        key={appointment.id}
                        style={[styles.item, { borderBottomColor: theme.border }]}>
                        <View style={styles.itemBody}>
                          <Text style={[styles.itemTitle, { color: theme.text }]}>
                            {patientName(appointment.patient_id)}
                          </Text>
                          <Text style={[styles.itemMeta, { color: theme.textSecondary }]}>
                            {formatDate(appointment.appointment_date)}
                            {time ? ` · ${time}` : ''}
                          </Text>
                        </View>
                        <ListRowActions
                          disabled={deleting}
                          onEdit={() => router.push(`/appointment/new?id=${appointment.id}`)}
                          onDelete={() => setPendingDelete({ kind: 'appointment', id: appointment.id })}
                        />
                      </View>
                    );
                  })}
                </View>
              )}
            </>
          )}
        </>
      )}

      <ConfirmDialog
        visible={pendingDelete != null}
        message={
          pendingDelete?.kind === 'appointment'
            ? 'Are you sure you want to delete this appointment?'
            : 'Are you sure you want to delete this patient?'
        }
        loading={deleting}
        onNo={() => {
          if (!deleting) {
            setPendingDelete(null);
          }
        }}
        onYes={() => {
          void confirmDelete();
        }}
      />
    </ScreenScroll>
  );
}

const styles = StyleSheet.create({
  heading: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: Spacing.one,
  },
  title: {
    flex: 1,
    fontSize: 28,
    fontWeight: '700',
    lineHeight: 34,
    paddingRight: Spacing.two,
  },
  item: {
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: Spacing.two,
    paddingVertical: 14,
  },
  itemBody: {
    flex: 1,
  },
  itemTitle: {
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 22,
  },
  itemMeta: {
    fontSize: 13,
    lineHeight: 19,
    marginTop: 2,
  },
});
