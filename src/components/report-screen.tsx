import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { type ComponentProps, useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import {
  ConfirmDialog,
  deleteErrorMessage,
  EmptyState,
  ErrorBanner,
  firstSearchParam,
  IconButton,
  ListRowActions,
  LoadingMark,
  NameSearch,
  ScreenScroll,
  myanmarText,
} from '@/components/clinic-ui';
import { useI18n } from '@/constants/i18n';
import { CardShadow, Palette, Radius, Spacing } from '@/constants/theme';
import { useLanguage } from '@/hooks/use-language';
import { useTheme } from '@/hooks/use-theme';
import {
  deleteTransaction,
  listTransactions,
  type ClinicTransaction,
  type TransactionKind,
} from '@/services/transactions';

function matchesName(name: string, query: string) {
  const needle = query.trim().toLowerCase();
  return needle.length === 0 || name.toLowerCase().includes(needle);
}

function formatMoney(value: number) {
  return value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

type ReportSection = TransactionKind;

function asSection(value: string | undefined): ReportSection | null {
  if (value === 'income' || value === 'expense') {
    return value;
  }
  return null;
}

export function ReportScreen() {
  const theme = useTheme();
  const { language } = useLanguage();
  const copy = useI18n().report;
  const common = useI18n().common;
  const params = useLocalSearchParams<{ section?: string | string[] }>();
  const requestedSection = firstSearchParam(params.section);
  const [section, setSection] = useState<ReportSection | null>(asSection(requestedSection));
  const [transactions, setTransactions] = useState<ClinicTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [nameQuery, setNameQuery] = useState('');

  useEffect(() => {
    setSection(asSection(requestedSection));
    setNameQuery('');
  }, [requestedSection]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setTransactions(await listTransactions());
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

  function openSection(next: ReportSection) {
    setSection(next);
    router.setParams({ section: next });
  }

  function closeSection() {
    setSection(null);
    router.setParams({ section: '' });
  }

  const rows = transactions.filter((row) => row.type === section);
  const visibleRows = rows.filter((row) =>
    matchesName(row.category_name || row.description, nameQuery),
  );

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
      setListError(deleteErrorMessage(error, copy.deleteError, common.inUse));
    } finally {
      setDeleting(false);
    }
  }

  return (
    <ScreenScroll>
      {section == null ? (
        <View style={styles.menu}>
          <MenuCard
            icon="trending-up-outline"
            title={copy.income}
            caption={copy.incomeCaption}
            onPress={() => openSection('income')}
          />
          <MenuCard
            icon="trending-down-outline"
            title={copy.expense}
            caption={copy.expenseCaption}
            onPress={() => openSection('expense')}
          />
        </View>
      ) : (
        <>
          <View style={styles.heading}>
            <IconButton name="arrow-back" accessibilityLabel="Go back" onPress={closeSection} />
            <Text style={[styles.title, myanmarText(language, 22), { color: theme.text }]}>
              {section === 'income' ? copy.incomeList : copy.expenseList} ( {rows.length} )
            </Text>
            <IconButton
              name="add"
              variant="accent"
              accessibilityLabel={section === 'income' ? copy.addIncome : copy.addExpense}
              onPress={() => router.push(`/transaction/new?type=${section}`)}
            />
          </View>
          <NameSearch value={nameQuery} onChangeText={setNameQuery} />

          {loading ? (
            <LoadingMark />
          ) : (
            <>
              {listError ? <ErrorBanner message={listError} /> : null}
              {rows.length === 0 ? (
                listError ? null : (
                  <EmptyState message={section === 'income' ? copy.noIncome : copy.noExpense} />
                )
              ) : visibleRows.length === 0 ? (
                <EmptyState message={common.noNameMatch} />
              ) : (
                <View>
                  {visibleRows.map((row) => (
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
        </>
      )}

      <ConfirmDialog
        visible={pendingDeleteId != null}
        message={copy.deleteConfirm}
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
