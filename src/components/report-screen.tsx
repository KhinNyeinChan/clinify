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
import {
  deleteTransaction,
  listTransactions,
  type ClinicTransaction,
  type TransactionKind,
} from '@/services/transactions';

function formatMoney(value: number) {
  return value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function ReportScreen() {
  const theme = useTheme();
  const [reportTab, setReportTab] = useState<TransactionKind>('income');
  const [transactions, setTransactions] = useState<ClinicTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setTransactions(await listTransactions());
      setListError(null);
    } catch (error) {
      setListError(error instanceof Error ? error.message : 'Could not load the report.');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const rows = transactions.filter((row) => row.type === reportTab);

  async function confirmDelete() {
    if (!pendingDeleteId) {
      return;
    }

    setDeleting(true);
    try {
      await deleteTransaction(pendingDeleteId);
      setPendingDeleteId(null);
      setListError(null);
      await load();
    } catch (error) {
      setPendingDeleteId(null);
      setListError(deleteErrorMessage(error, 'Could not delete the record.'));
    } finally {
      setDeleting(false);
    }
  }

  return (
    <ScreenScroll>
      <TopTabs
        value={reportTab}
        onChange={(value) => setReportTab(value as TransactionKind)}
        tabs={[
          { value: 'income', label: 'Income' },
          { value: 'expense', label: 'Expense' },
        ]}
      />

      <View style={styles.heading}>
        <Text style={[styles.title, { color: theme.text }]}>
          {reportTab === 'income' ? 'Income' : 'Expense'} list ( {rows.length} )
        </Text>
        <IconButton
          name="add"
          variant="accent"
          accessibilityLabel={reportTab === 'income' ? 'Add income' : 'Add expense'}
          onPress={() => router.push(`/transaction/new?type=${reportTab}`)}
        />
      </View>

      {loading ? (
        <LoadingMark />
      ) : (
        <>
          {listError ? <ErrorBanner message={listError} /> : null}
          {rows.length === 0 ? (
            listError ? null : (
              <EmptyState
                message={
                  reportTab === 'income' ? 'No income records yet.' : 'No expense records yet.'
                }
              />
            )
          ) : (
            <View>
              {rows.map((row) => (
                <View key={row.id} style={[styles.item, { borderBottomColor: theme.border }]}>
                  <View style={styles.itemBody}>
                    <Text style={[styles.itemTitle, { color: theme.text }]}>
                      {row.category_name || row.description}
                    </Text>
                    <Text style={[styles.itemMeta, { color: theme.textSecondary }]}>
                      {row.category_name && row.category_name !== row.description
                        ? `${row.description} · ${row.occurred_on} · ${formatMoney(row.amount)}`
                        : `${row.occurred_on} · ${formatMoney(row.amount)}`}
                    </Text>
                  </View>
                  <ListRowActions
                    disabled={deleting}
                    onEdit={() => router.push(`/transaction/new?id=${row.id}`)}
                    onDelete={() => setPendingDeleteId(row.id)}
                  />
                </View>
              ))}
            </View>
          )}
        </>
      )}

      <ConfirmDialog
        visible={pendingDeleteId != null}
        message={
          reportTab === 'income'
            ? 'Are you sure you want to delete this income record?'
            : 'Are you sure you want to delete this expense record?'
        }
        loading={deleting}
        onNo={() => {
          if (!deleting) {
            setPendingDeleteId(null);
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
