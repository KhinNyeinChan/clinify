import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { type ComponentProps, useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import {
  ConfirmDialog,
  deleteErrorMessage,
  EmptyState,
  ErrorBanner,
  firstSearchParam,
  IconButton,
  ListRowActions,
  LoadingMark,
  myanmarText,
  ScreenScroll,
} from '@/components/clinic-ui';
import { useI18n } from '@/constants/i18n';
import { CardShadow, Palette, Radius, Spacing } from '@/constants/theme';
import { useLanguage } from '@/hooks/use-language';
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

type ClinicSection = 'patients' | 'appointments';
type PendingDelete =
  | { kind: 'patient'; id: string }
  | { kind: 'appointment'; id: string };

function asSection(value: string | undefined): ClinicSection | null {
  if (value === 'patients' || value === 'appointments') {
    return value;
  }
  return null;
}

const STATUS_PENDING = '#F57C00';
const STATUS_COMPLETED = '#1565C0';

export function ClinicScreen() {
  const theme = useTheme();
  const { language } = useLanguage();
  const copy = useI18n().clinic;
  const common = useI18n().common;
  const params = useLocalSearchParams<{ section?: string | string[] }>();
  const requestedSection = firstSearchParam(params.section);
  const [section, setSection] = useState<ClinicSection | null>(asSection(requestedSection));
  const [patients, setPatients] = useState<Patient[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<PendingDelete | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [patientQuery, setPatientQuery] = useState('');
  const [appointmentQuery, setAppointmentQuery] = useState('');

  useEffect(() => {
    setSection(asSection(requestedSection));
  }, [requestedSection]);

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
      setListError(error instanceof Error ? error.message : copy.loadError);
    } finally {
      setLoading(false);
    }
  }, [copy.loadError]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const visiblePatients = useMemo(() => {
    const query = patientQuery.trim().toLowerCase();
    if (!query) {
      return patients;
    }
    return patients.filter((patient) => patient.name.toLowerCase().includes(query));
  }, [patientQuery, patients]);

  function patientName(patientId: string) {
    return patients.find((patient) => patient.id === patientId)?.name ?? copy.unknownPatient;
  }

  const visibleAppointments = useMemo(() => {
    const query = appointmentQuery.trim().toLowerCase();
    if (!query) {
      return appointments;
    }
    return appointments.filter((appointment) =>
      patientName(appointment.patient_id).toLowerCase().includes(query),
    );
  }, [appointmentQuery, appointments, patients, copy.unknownPatient]);

  function openSection(next: ClinicSection) {
    setSection(next);
    router.setParams({ section: next });
  }

  function closeSection() {
    setSection(null);
    router.setParams({ section: '' });
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
          pendingDelete.kind === 'patient' ? copy.deletePatientError : copy.deleteAppointmentError,
          common.inUse,
        ),
      );
    } finally {
      setDeleting(false);
    }
  }

  return (
    <ScreenScroll>
      {section == null ? (
        <View style={styles.menu}>
          <MenuCard
            icon="people-outline"
            title={copy.patients}
            caption={copy.patientRecords}
            onPress={() => openSection('patients')}
          />
          <MenuCard
            icon="calendar-outline"
            title={copy.appointment}
            caption={copy.scheduledVisits}
            onPress={() => openSection('appointments')}
          />
        </View>
      ) : section === 'patients' ? (
        <>
          <View style={styles.heading}>
            <IconButton name="arrow-back" accessibilityLabel="Go back" onPress={closeSection} />
            <Text style={[styles.title, myanmarText(language, 22), { color: theme.text }]}>
              {copy.patientList} ( {patients.length} )
            </Text>
            <IconButton
              name="add"
              variant="accent"
              accessibilityLabel={copy.addPatient}
              onPress={() => router.push('/patient/new')}
            />
          </View>
          <View style={styles.searchRow}>
            <TextInput
              value={patientQuery}
              onChangeText={setPatientQuery}
              placeholder={common.searchByName}
              placeholderTextColor={theme.textSecondary}
              autoCapitalize="words"
              autoCorrect={false}
              style={[
                styles.search,
                {
                  color: theme.text,
                  backgroundColor: theme.backgroundElement,
                  borderColor: theme.border,
                },
              ]}
            />
          </View>
          {loading ? (
            <LoadingMark />
          ) : (
            <>
              {listError ? <ErrorBanner message={listError} /> : null}
              {patients.length === 0 ? (
                listError ? null : <EmptyState message={copy.noPatients} />
              ) : visiblePatients.length === 0 ? (
                <EmptyState message={copy.noPatientMatch} />
              ) : (
                <View>
                  {visiblePatients.map((patient) => (
                    <View
                      key={patient.id}
                      style={[styles.item, { borderBottomColor: theme.border }]}>
                      <View style={styles.itemBody}>
                        <Text style={[styles.itemTitle, { color: theme.text }]}>{patient.name}</Text>
                        <Text style={[styles.itemMeta, { color: theme.textSecondary }]}>
                          {patient.age} {copy.years} · {patient.phone}
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
            <IconButton name="arrow-back" accessibilityLabel="Go back" onPress={closeSection} />
            <Text style={[styles.title, myanmarText(language, 22), { color: theme.text }]}>
              {copy.appointmentList} ( {appointments.length} )
            </Text>
            <IconButton
              name="add"
              variant="accent"
              accessibilityLabel={copy.addAppointment}
              onPress={() => router.push('/appointment/new')}
            />
          </View>
          <View style={styles.searchRow}>
            <TextInput
              value={appointmentQuery}
              onChangeText={setAppointmentQuery}
              placeholder={common.searchByName}
              placeholderTextColor={theme.textSecondary}
              autoCapitalize="words"
              autoCorrect={false}
              style={[
                styles.search,
                {
                  color: theme.text,
                  backgroundColor: theme.backgroundElement,
                  borderColor: theme.border,
                },
              ]}
            />
          </View>
          {loading ? (
            <LoadingMark />
          ) : (
            <>
              {listError ? <ErrorBanner message={listError} /> : null}
              {appointments.length === 0 ? (
                listError ? null : <EmptyState message={copy.noAppointments} />
              ) : visibleAppointments.length === 0 ? (
                <EmptyState message={copy.noAppointmentMatch} />
              ) : (
                <View>
                  {visibleAppointments.map((appointment) => {
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
                            {' · '}
                            <Text
                              style={{
                                color:
                                  appointment.status === 'completed'
                                    ? STATUS_COMPLETED
                                    : STATUS_PENDING,
                                fontWeight: '700',
                              }}>
                              {appointment.status === 'completed' ? common.completed : common.pending}
                            </Text>
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
          pendingDelete?.kind === 'appointment' ? copy.deleteAppointment : copy.deletePatient
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

function MenuCard({
  icon,
  title,
  caption,
  onPress,
}: {
  icon: ComponentProps<typeof Ionicons>['name'];
  title: string;
  caption: string;
  onPress: () => void;
}) {
  const theme = useTheme();

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        CardShadow,
        { backgroundColor: theme.backgroundElement, opacity: pressed ? 0.86 : 1 },
      ]}>
      <View style={styles.cardIcon}>
        <Ionicons name={icon} size={22} color={Palette.primary} />
      </View>
      <View style={styles.cardBody}>
        <Text style={[styles.cardTitle, { color: theme.text }]}>{title}</Text>
        <Text style={[styles.cardCaption, { color: theme.textSecondary }]}>{caption}</Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={theme.textSecondary} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  menu: {
    gap: Spacing.three,
  },
  card: {
    alignItems: 'center',
    borderRadius: Radius.md,
    flexDirection: 'row',
    gap: Spacing.three,
    padding: Spacing.four,
  },
  cardIcon: {
    alignItems: 'center',
    backgroundColor: Palette.accent,
    borderRadius: Radius.pill,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  cardBody: {
    flex: 1,
    gap: 2,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  cardCaption: {
    fontSize: 13,
  },
  heading: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: Spacing.one,
  },
  searchRow: {
    alignItems: 'flex-end',
    marginBottom: Spacing.two,
  },
  search: {
    borderRadius: Radius.sm,
    borderWidth: 1,
    fontSize: 15,
    minHeight: 40,
    paddingHorizontal: Spacing.three,
    paddingVertical: 8,
    width: '58%',
  },
  title: {
    flex: 1,
    fontSize: 22,
    fontWeight: '700',
    lineHeight: 28,
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
