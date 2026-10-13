import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { type ComponentProps, type ReactNode, useCallback, useEffect, useMemo, useState } from 'react';
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
import { CardShadow, Palette, Radius, Spacing } from '@/constants/theme';
import { useI18n } from '@/constants/i18n';
import { useLanguage } from '@/hooks/use-language';
import { useTheme } from '@/hooks/use-theme';
import { deleteMedicinePurchase, listMedicinePurchases, type MedicinePurchase } from '@/services/medicine-purchases';
import { deleteMedicine, listAllMedicineBatches, listMedicines, type Medicine, type MedicineBatch } from '@/services/medicines';
import { deleteSupplier, listSuppliers, type Supplier } from '@/services/suppliers';

function formatPrice(price: number) {
  return Number.isFinite(price) ? price.toFixed(2) : '0.00';
}

function matchesName(name: string, query: string) {
  const needle = query.trim().toLowerCase();
  return needle.length === 0 || name.toLowerCase().includes(needle);
}

function formatMoney(value: number) {
  return value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

type InventorySection = 'suppliers' | 'purchases' | 'medicines';
type PendingDelete =
  | { kind: 'supplier'; id: string }
  | { kind: 'medicine'; id: string }
  | { kind: 'purchase'; id: string };

function asSection(value: string | undefined): InventorySection | null {
  if (value === 'suppliers' || value === 'purchases' || value === 'medicines') {
    return value;
  }
  return null;
}

const EXPIRY_RED = '#C62828';
const EXPIRY_RED_BG = '#FFEBEE';
const EXPIRY_YELLOW = '#E65100';
const EXPIRY_YELLOW_BG = '#FFF8E1';

function startOfToday() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

function addMonths(date: Date, months: number) {
  const next = new Date(date);
  next.setMonth(next.getMonth() + months);
  return next;
}

function expiryAlert(isoDate: string): 'soon' | 'watch' | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(isoDate);
  if (!match) {
    return null;
  }
  const expiry = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  const today = startOfToday();
  if (expiry <= addMonths(today, 3)) {
    return 'soon';
  }
  if (expiry <= addMonths(today, 6)) {
    return 'watch';
  }
  return null;
}

const STATUS_COLOR = {
  Paid: '#1565C0',
  Pending: '#F57C00',
  Partial: Palette.primary,
} as const;

export function InventoryScreen() {
  const theme = useTheme();
  const { language } = useLanguage();
  const copy = useI18n().inventory;
  const common = useI18n().common;
  const params = useLocalSearchParams<{ section?: string | string[]; tab?: string | string[] }>();
  const requestedSection = firstSearchParam(params.section) ?? firstSearchParam(params.tab);
  const [section, setSection] = useState<InventorySection | null>(asSection(requestedSection));
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [purchases, setPurchases] = useState<MedicinePurchase[]>([]);
  const [batches, setBatches] = useState<MedicineBatch[]>([]);
  const [expandedIds, setExpandedIds] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<PendingDelete | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [nameQuery, setNameQuery] = useState('');

  useEffect(() => {
    setSection(asSection(requestedSection));
    setNameQuery('');
  }, [requestedSection]);

  const load = useCallback(async () => {
    setLoading(true);
    const [supplierResult, medicineResult, purchaseResult, batchResult] = await Promise.allSettled([
      listSuppliers(),
      listMedicines(),
      listMedicinePurchases(),
      listAllMedicineBatches(),
    ]);

    let nextError: string | null = null;
    if (supplierResult.status === 'fulfilled') {
      setSuppliers(supplierResult.value);
    } else {
      nextError =
        supplierResult.reason instanceof Error
          ? supplierResult.reason.message
          : copy.suppliersError;
    }

    if (medicineResult.status === 'fulfilled') {
      setMedicines(medicineResult.value);
    } else if (!nextError) {
      nextError =
        medicineResult.reason instanceof Error
          ? medicineResult.reason.message
          : copy.medicinesError;
    }

    if (purchaseResult.status === 'fulfilled') {
      setPurchases(purchaseResult.value);
    } else {
      setPurchases([]);
      if (section === 'purchases') {
        nextError =
          purchaseResult.reason instanceof Error
            ? purchaseResult.reason.message
            : copy.purchasesError;
      }
    }

    if (batchResult.status === 'fulfilled') {
      setBatches(batchResult.value);
    } else {
      setBatches([]);
      if (section === 'medicines' && !nextError) {
        nextError =
          batchResult.reason instanceof Error ? batchResult.reason.message : copy.batchesError;
      }
    }

    setListError(nextError);
    setLoading(false);
  }, [section, copy.suppliersError, copy.medicinesError, copy.purchasesError, copy.batchesError]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  function supplierName(supplierId: string) {
    return suppliers.find((supplier) => supplier.id === supplierId)?.name ?? copy.unknownSupplier;
  }

  const visibleSuppliers = suppliers.filter((supplier) => matchesName(supplier.name, nameQuery));
  const visibleMedicines = medicines.filter((medicine) => matchesName(medicine.name, nameQuery));
  const visiblePurchases = purchases.filter((purchase) =>
    matchesName(supplierName(purchase.supplier_id), nameQuery),
  );
  const batchesByMedicine = useMemo(() => {
    const grouped = new Map<string, MedicineBatch[]>();
    for (const batch of batches) {
      const rows = grouped.get(batch.medicine_id) ?? [];
      rows.push(batch);
      grouped.set(batch.medicine_id, rows);
    }
    return grouped;
  }, [batches]);

  function toggleMedicine(id: string) {
    setExpandedIds((current) => ({ ...current, [id]: !current[id] }));
  }

  function openSection(next: InventorySection) {
    setSection(next);
    router.setParams({ section: next, tab: '' });
  }

  function closeSection() {
    setSection(null);
    router.setParams({ section: '', tab: '' });
  }

  async function confirmDelete() {
    if (!pendingDelete) {
      return;
    }

    setDeleting(true);
    try {
      if (pendingDelete.kind === 'supplier') {
        await deleteSupplier(pendingDelete.id);
      } else if (pendingDelete.kind === 'purchase') {
        await deleteMedicinePurchase(pendingDelete.id);
      } else {
        await deleteMedicine(pendingDelete.id);
      }
      setPendingDelete(null);
      setListError(null);
      await load();
    } catch (error) {
      setPendingDelete(null);
      setListError(
        deleteErrorMessage(
          error,
          pendingDelete.kind === 'supplier'
            ? copy.deleteSupplierError
            : pendingDelete.kind === 'purchase'
              ? copy.deletePurchaseError
              : copy.deleteMedicineError,
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
            title={copy.suppliers}
            caption={copy.supplierDirectory}
            onPress={() => openSection('suppliers')}
          />
          <MenuCard
            icon="receipt-outline"
            title={copy.purchase}
            caption={copy.restock}
            onPress={() => openSection('purchases')}
          />
          <MenuCard
            icon="medkit-outline"
            title={copy.medicines}
            caption={copy.stockPrices}
            onPress={() => openSection('medicines')}
          />
        </View>
      ) : section === 'suppliers' ? (
        <>
          <View style={styles.heading}>
            <IconButton name="arrow-back" accessibilityLabel="Go back" onPress={closeSection} />
            <Text style={[styles.title, myanmarText(language, 28), { color: theme.text }]}>
              {copy.supplierList} ( {suppliers.length} )
            </Text>
            <IconButton
              name="add"
              variant="accent"
              accessibilityLabel={copy.addSupplier}
              onPress={() => router.push('/supplier/new')}
            />
          </View>
          <NameSearch value={nameQuery} onChangeText={setNameQuery} />
          <ListBody
            loading={loading}
            error={listError}
            empty={visibleSuppliers.length === 0}
            emptyMessage={suppliers.length === 0 ? copy.noSuppliers : common.noNameMatch}>
            {visibleSuppliers.map((supplier) => (
              <View key={supplier.id} style={[styles.item, { borderBottomColor: theme.border }]}>
                <View style={styles.itemBody}>
                  <Text style={[styles.itemTitle, { color: theme.text }]}>{supplier.name}</Text>
                  <Text style={[styles.itemMeta, { color: theme.textSecondary }]}>{supplier.phone}</Text>
                  <Text style={[styles.itemMeta, { color: theme.textSecondary }]}>{supplier.address}</Text>
                </View>
                <ListRowActions
                  disabled={deleting}
                  onEdit={() => router.push(`/supplier/new?id=${supplier.id}`)}
                  onDelete={() => setPendingDelete({ kind: 'supplier', id: supplier.id })}
                />
              </View>
            ))}
          </ListBody>
        </>
      ) : section === 'purchases' ? (
        <>
          <View style={styles.heading}>
            <IconButton name="arrow-back" accessibilityLabel="Go back" onPress={closeSection} />
            <Text style={[styles.title, myanmarText(language, 28), { color: theme.text }]}>
              {copy.purchaseList} ( {purchases.length} )
            </Text>
            <IconButton
              name="add"
              variant="accent"
              accessibilityLabel={copy.addPurchase}
              onPress={() => router.push('/purchase/new')}
            />
          </View>
          <NameSearch value={nameQuery} onChangeText={setNameQuery} />
          <ListBody
            loading={loading}
            error={listError}
            empty={visiblePurchases.length === 0}
            emptyMessage={purchases.length === 0 ? copy.noPurchases : common.noNameMatch}>
            {visiblePurchases.map((purchase) => (
              <View key={purchase.id} style={[styles.item, { borderBottomColor: theme.border }]}>
                <View style={styles.itemBody}>
                  <Text style={[styles.itemTitle, { color: theme.text }]}>
                    {supplierName(purchase.supplier_id)}
                  </Text>
                  <Text style={[styles.itemMeta, { color: theme.textSecondary }]}>
                    {purchase.purchase_date.slice(0, 10)} · {formatMoney(purchase.total_amount)}
                  </Text>
                  <Text style={[styles.itemMeta, { color: STATUS_COLOR[purchase.payment_status], fontWeight: '700' }]}>
                    {purchase.payment_status === 'Paid'
                      ? common.paid
                      : purchase.payment_status === 'Partial'
                        ? common.partial
                        : common.pending}
                  </Text>
                </View>
                <ListRowActions
                  disabled={deleting}
                  onEdit={() => router.push(`/purchase/new?id=${purchase.id}`)}
                  onDelete={() => setPendingDelete({ kind: 'purchase', id: purchase.id })}
                />
              </View>
            ))}
          </ListBody>
        </>
      ) : (
        <>
          <View style={styles.heading}>
            <IconButton name="arrow-back" accessibilityLabel="Go back" onPress={closeSection} />
            <Text style={[styles.title, myanmarText(language, 28), { color: theme.text }]}>
              {copy.medicineList} ( {medicines.length} )
            </Text>
            <IconButton
              name="add"
              variant="accent"
              accessibilityLabel={copy.addMedicine}
              onPress={() => router.push('/medicine/new')}
            />
          </View>
          <NameSearch value={nameQuery} onChangeText={setNameQuery} />
          <ListBody
            loading={loading}
            error={listError}
            empty={visibleMedicines.length === 0}
            emptyMessage={medicines.length === 0 ? copy.noMedicines : common.noNameMatch}>
            {visibleMedicines.map((medicine) => {
              const medicineBatches = batchesByMedicine.get(String(medicine.id)) ?? [];
              const expanded = expandedIds[String(medicine.id)] === true;
              return (
                <View key={medicine.id} style={[styles.medicineCard, { borderBottomColor: theme.border }]}>
                  <View style={[styles.item, styles.medicineHeader]}>
                    <Pressable
                      accessibilityRole="button"
                      onPress={() => toggleMedicine(String(medicine.id))}
                      style={styles.itemBody}>
                      <View style={styles.itemHeader}>
                        <Text style={[styles.itemTitle, { color: theme.text }]}>{medicine.name}</Text>
                        {medicine.stock <= 5 ? <Text style={styles.lowStock}>{copy.lowStock}</Text> : null}
                        <Ionicons
                          name={expanded ? 'chevron-up' : 'chevron-down'}
                          size={18}
                          color={theme.textSecondary}
                        />
                      </View>
                      <Text style={[styles.itemMeta, { color: theme.textSecondary }]}>
                        {copy.stock} {medicine.stock} {medicine.box_unit_name} · {medicine.units_per_box}{' '}
                        {copy.perBox} · {formatPrice(medicine.price)}
                      </Text>
                      <Text style={[styles.itemMeta, { color: theme.textSecondary }]}>
                        {supplierName(medicine.supplier_id)}
                      </Text>
                    </Pressable>
                    <ListRowActions
                      disabled={deleting}
                      onEdit={() => router.push(`/medicine/new?id=${medicine.id}`)}
                      onDelete={() => setPendingDelete({ kind: 'medicine', id: medicine.id })}
                    />
                  </View>
                  {expanded ? (
                    medicineBatches.length === 0 ? (
                      <Text style={[styles.batchEmpty, { color: theme.textSecondary }]}>{copy.noBatches}</Text>
                    ) : (
                      <View style={styles.batchList}>
                        {medicineBatches.map((batch) => {
                          const alert = expiryAlert(batch.expiry_date);
                          return (
                            <View
                              key={batch.id}
                              style={[styles.batchRow, { backgroundColor: theme.background, borderColor: theme.border }]}>
                              <Text style={[styles.batchNumber, { color: theme.text }]}>{batch.batch_number}</Text>
                              <Text style={[styles.batchMeta, { color: theme.textSecondary }]}>
                                {common.quantity} {batch.quantity} {medicine.box_unit_name}
                              </Text>
                              <Text style={[styles.batchMeta, { color: theme.textSecondary }]}>
                                {copy.salePrice} {formatPrice(batch.sale_price)}
                              </Text>
                              <Text style={[styles.batchMeta, { color: theme.textSecondary }]}>
                                {batch.expiry_date}
                              </Text>
                              {alert ? (
                                <Text
                                  style={[
                                    styles.expiryBadge,
                                    alert === 'soon'
                                      ? { color: EXPIRY_RED, backgroundColor: EXPIRY_RED_BG }
                                      : { color: EXPIRY_YELLOW, backgroundColor: EXPIRY_YELLOW_BG },
                                  ]}>
                                  {alert === 'soon' ? copy.expirySoon : copy.expiryWatch}
                                </Text>
                              ) : null}
                            </View>
                          );
                        })}
                      </View>
                    )
                  ) : null}
                </View>
              );
            })}
          </ListBody>
        </>
      )}

      <ConfirmDialog
        visible={pendingDelete != null}
        message={
          pendingDelete?.kind === 'medicine'
            ? copy.deleteMedicine
            : pendingDelete?.kind === 'purchase'
              ? copy.deletePurchase
              : copy.deleteSupplier
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

function ListBody({
  loading,
  error,
  empty,
  emptyMessage,
  children,
}: {
  loading: boolean;
  error: string | null;
  empty: boolean;
  emptyMessage: string;
  children: ReactNode;
}) {
  if (loading) {
    return <LoadingMark />;
  }

  return (
    <>
      {error ? <ErrorBanner message={error} /> : null}
      {empty ? (error ? null : <EmptyState message={emptyMessage} />) : <View>{children}</View>}
    </>
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
  itemHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: Spacing.two,
  },
  itemTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 22,
  },
  itemMeta: {
    fontSize: 13,
    lineHeight: 19,
    marginTop: 2,
  },
  lowStock: {
    color: Palette.primary,
    fontSize: 12,
    fontWeight: '700',
  },
  medicineCard: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingBottom: 4,
  },
  medicineHeader: {
    borderBottomWidth: 0,
  },
  batchList: {
    gap: Spacing.two,
    paddingBottom: Spacing.three,
    paddingLeft: Spacing.two,
  },
  batchEmpty: {
    fontSize: 13,
    paddingBottom: Spacing.three,
    paddingLeft: Spacing.two,
  },
  batchRow: {
    alignItems: 'center',
    borderRadius: Radius.sm,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: 10,
  },
  batchNumber: {
    fontSize: 14,
    fontWeight: '700',
  },
  batchMeta: {
    fontSize: 13,
  },
  expiryBadge: {
    borderRadius: Radius.pill,
    fontSize: 12,
    fontWeight: '700',
    overflow: 'hidden',
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
});
