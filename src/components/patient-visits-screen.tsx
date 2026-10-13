import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import {
  Card,
  EmptyState,
  ErrorBanner,
  firstSearchParam,
  LoadingMark,
  NameSearch,
  ScreenNavHeader,
  ScreenScroll,
} from '@/components/clinic-ui';
import { Spacing } from '@/constants/theme';
import { useI18n } from '@/constants/i18n';
import { useTheme } from '@/hooks/use-theme';
import { listMedicalRecords, type MedicalRecord } from '@/services/medical-records';
import { getPatient } from '@/services/patients';

function matchesName(name: string, query: string) {
  const needle = query.trim().toLowerCase();
  return needle.length === 0 || name.toLowerCase().includes(needle);
}

function formatVisitDate(value: string | null) {
  if (!value) {
    return 'Visit';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value.slice(0, 10);
  }

  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function Detail({ label, value }: { label: string; value: string }) {
  const theme = useTheme();
  const text = value.trim();
  if (!text) {
    return null;
  }

  return (
    <View style={styles.detail}>
      <Text style={[styles.detailLabel, { color: theme.textSecondary }]}>{label}</Text>
      <Text style={[styles.detailValue, { color: theme.text }]}>{text}</Text>
    </View>
  );
}

function VisitCard({ record, index }: { record: MedicalRecord; index: number }) {
  const theme = useTheme();
  const copy = useI18n().patient;

  return (
    <Card>
      <Text style={[styles.visitTitle, { color: theme.text }]}>
        {record.created_at ? formatVisitDate(record.created_at) : `${copy.visit} ${index}`}
      </Text>
      <Detail label={copy.symptoms} value={record.symptoms} />
      <Detail label={copy.vitals} value={record.vitals} />
      <Detail label={copy.diagnosis} value={record.diagnosis} />
      <Detail label={copy.notes} value={record.notes} />
    </Card>
  );
}

export function PatientVisitsScreen() {
  const copy = useI18n().patient;
  const { id } = useLocalSearchParams<{ id?: string | string[] }>();
  const patientId = firstSearchParam(id);
  const [patientName, setPatientName] = useState('');
  const [records, setRecords] = useState<MedicalRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nameQuery, setNameQuery] = useState('');
  const common = useI18n().common;

  useEffect(() => {
    if (!patientId) {
      setLoading(false);
      setError(copy.notFound);
      return;
    }

    let active = true;
    setLoading(true);
    Promise.all([getPatient(patientId), listMedicalRecords(patientId)])
      .then(([patient, visits]) => {
        if (!active) {
          return;
        }
        setPatientName(patient.name);
        setRecords(visits);
        setError(null);
      })
      .catch((nextError) => {
        if (active) {
          setError(nextError instanceof Error ? nextError.message : copy.visitsError);
        }
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [patientId, copy.notFound, copy.visitsError]);

  const visibleRecords = records
    .map((record, index) => ({ record, displayIndex: records.length - index }))
    .filter(({ record }) => matchesName(record.diagnosis, nameQuery));

  return (
    <ScreenScroll withTabBar={false}>
      <ScreenNavHeader
        title={patientName ? `${patientName} ${copy.visitsOf}` : copy.visitsTitle}
        onBack={() => router.back()}
      />
      <NameSearch value={nameQuery} onChangeText={setNameQuery} />
      {error ? <ErrorBanner message={error} /> : null}
      {loading ? (
        <LoadingMark />
      ) : records.length === 0 ? (
        <EmptyState message={copy.noVisits} />
      ) : visibleRecords.length === 0 ? (
        <EmptyState message={common.noNameMatch} />
      ) : (
        <View style={styles.list}>
          {visibleRecords.map(({ record, displayIndex }) => (
            <VisitCard key={record.id} record={record} index={displayIndex} />
          ))}
        </View>
      )}
    </ScreenScroll>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: Spacing.three,
  },
  visitTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  detail: {
    gap: 2,
  },
  detailLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  detailValue: {
    fontSize: 15,
    lineHeight: 22,
  },
});
