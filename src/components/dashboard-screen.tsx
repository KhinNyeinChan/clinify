import { useFocusEffect, router } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import {
  Card,
  EmptyState,
  ErrorBanner,
  ListRow,
  LoadingMark,
  QuickAction,
  ScreenHeader,
  ScreenScroll,
  SectionTitle,
  StatCard,
} from '@/components/clinic-ui';
import { Spacing } from '@/constants/theme';
import { listAppointmentsForDate } from '@/services/appointments';
import { listPatients, type Patient } from '@/services/patients';
import { listTransactions, summarizeTransactions } from '@/services/transactions';

function todayIsoDate() {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}

function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

function formatMoney(value: number) {
  return value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function DashboardScreen() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [todayCount, setTodayCount] = useState(0);
  const [income, setIncome] = useState(0);
  const [expense, setExpense] = useState(0);
  const [profit, setProfit] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const today = todayIsoDate();
      const [patientRows, appointments, transactions] = await Promise.all([
        listPatients(),
        listAppointmentsForDate(today),
        listTransactions(),
      ]);
      const summary = summarizeTransactions(transactions);
      setPatients(patientRows);
      setTodayCount(appointments.length);
      setIncome(summary.income);
      setExpense(summary.expense);
      setProfit(summary.profit);
      setError(null);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Could not load the dashboard.');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const recentPatients = patients.slice(0, 4);

  return (
    <ScreenScroll>
      <ScreenHeader title={greeting()} subtitle="A quiet view of today’s clinic." />

      {error ? <ErrorBanner message={error} /> : null}

      <View style={styles.stats}>
        <StatCard label="Patients" value={loading ? '—' : String(patients.length)} hint="On file" />
        <StatCard label="Today" value={loading ? '—' : String(todayCount)} hint="Appointments" />
      </View>
      <View style={styles.stats}>
        <StatCard label="Income" value={loading ? '—' : formatMoney(income)} hint="Recorded" />
        <StatCard label="Expense" value={loading ? '—' : formatMoney(expense)} hint="Recorded" />
        <StatCard label="Profit" value={loading ? '—' : formatMoney(profit)} hint="Income − expense" />
      </View>

      <SectionTitle>Quick actions</SectionTitle>
      <View style={styles.actions}>
        <QuickAction
          label="Register"
          caption="Add a patient"
          onPress={() => router.push('/clinic')}
        />
        <QuickAction
          label="Visit"
          caption="Record notes"
          onPress={() => router.push('/visits')}
        />
        <QuickAction
          label="Stock"
          caption="Medicines"
          onPress={() => router.push('/inventory?tab=medicines')}
        />
        <QuickAction
          label="Suppliers"
          caption="Directory"
          onPress={() => router.push('/inventory?tab=suppliers')}
        />
      </View>

      <Card>
        <SectionTitle>Recent patients</SectionTitle>
        {loading ? (
          <LoadingMark />
        ) : recentPatients.length === 0 ? (
          <EmptyState message="No patients yet. Register the first from Clinic." />
        ) : (
          <View style={styles.list}>
            {recentPatients.map((patient) => (
              <ListRow
                key={patient.id}
                title={patient.name}
                subtitle={`${patient.age} years · ${patient.phone}`}
                meta={patient.address}
              />
            ))}
          </View>
        )}
      </Card>
    </ScreenScroll>
  );
}

const styles = StyleSheet.create({
  stats: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  list: {
    gap: Spacing.two,
  },
});
