import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import {
  ErrorBanner,
  QuickAction,
  ScreenHeader,
  ScreenScroll,
  SectionTitle,
  StatCard,
} from '@/components/clinic-ui';
import { Palette, Spacing } from '@/constants/theme';
import { useI18n } from '@/constants/i18n';
import { useLanguage, type AppLanguage } from '@/hooks/use-language';
import { useTheme } from '@/hooks/use-theme';
import { listAppointmentsForDate } from '@/services/appointments';
import { listPatients } from '@/services/patients';
import { listTransactions, summarizeTransactions } from '@/services/transactions';

function todayIsoDate() {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}

function greeting(copy: ReturnType<typeof useI18n>['home']) {
  const hour = new Date().getHours();
  if (hour < 12) return copy.morning;
  if (hour < 17) return copy.afternoon;
  return copy.evening;
}

function LanguageToggle() {
  const theme = useTheme();
  const { language, setLanguage } = useLanguage();
  const options: { value: AppLanguage; label: string }[] = [
    { value: 'en', label: 'English' },
    { value: 'my', label: 'မြန်မာ' },
  ];

  return (
    <View style={[styles.toggle, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
      {options.map((option) => {
        const selected = language === option.value;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            accessibilityLabel={option.value === 'en' ? 'English' : 'Myanmar'}
            onPress={() => setLanguage(option.value)}
            style={[styles.toggleOption, selected && styles.toggleOptionSelected]}>
            <Text style={[styles.toggleLabel, { color: selected ? Palette.white : theme.text }]}>
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function formatMoney(value: number) {
  return value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function DashboardScreen() {
  const copy = useI18n().home;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [patientCount, setPatientCount] = useState(0);
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
      setPatientCount(patientRows.length);
      setTodayCount(appointments.length);
      setIncome(summary.income);
      setExpense(summary.expense);
      setProfit(summary.profit);
      setError(null);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : copy.loadError);
    } finally {
      setLoading(false);
    }
  }, [copy.loadError]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  return (
    <ScreenScroll>
      <ScreenHeader title={greeting(copy)} subtitle={copy.subtitle} right={<LanguageToggle />} />

      {error ? <ErrorBanner message={error} /> : null}

      <View style={styles.stats}>
        <StatCard label={copy.patients} value={loading ? '—' : String(patientCount)} hint={copy.onFile} />
        <StatCard label={copy.today} value={loading ? '—' : String(todayCount)} hint={copy.appointments} />
      </View>
      <View style={styles.stats}>
        <StatCard label={copy.income} value={loading ? '—' : formatMoney(income)} hint={copy.recorded} />
        <StatCard label={copy.expense} value={loading ? '—' : formatMoney(expense)} hint={copy.recorded} />
        <StatCard label={copy.profit} value={loading ? '—' : formatMoney(profit)} hint={copy.profitHint} />
      </View>

      <SectionTitle>{copy.quickActions}</SectionTitle>
      <View style={styles.actions}>
        <QuickAction
          label={copy.register}
          caption={copy.addPatient}
          onPress={() => router.push('/clinic')}
        />
        <QuickAction
          label={copy.visit}
          caption={copy.recordNotes}
          onPress={() => router.push('/visits')}
        />
        <QuickAction
          label={copy.stock}
          caption={copy.medicines}
          onPress={() => router.push('/inventory?section=medicines')}
        />
        <QuickAction
          label={copy.suppliers}
          caption={copy.directory}
          onPress={() => router.push('/inventory?section=suppliers')}
        />
      </View>
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
  toggle: {
    alignItems: 'center',
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: 'row',
    padding: 3,
  },
  toggleOption: {
    alignItems: 'center',
    borderRadius: 999,
    justifyContent: 'center',
    minHeight: 32,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  toggleOptionSelected: {
    backgroundColor: Palette.primary,
  },
  toggleLabel: {
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 22,
    textAlignVertical: 'center',
  },
});
