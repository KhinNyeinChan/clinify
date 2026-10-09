import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import {
  ConfirmDialog,
  deleteErrorMessage,
  EmptyState,
  ErrorBanner,
  firstSearchParam,
  IconButton,
  ListRowActions,
  LoadingMark,
  ScreenScroll,
  TopTabs,
} from '@/components/clinic-ui';
import { Palette, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { deleteMedicine, listMedicines, type Medicine } from '@/services/medicines';
import { deleteSupplier, listSuppliers, type Supplier } from '@/services/suppliers';

function formatPrice(price: number) {
  return Number.isFinite(price) ? price.toFixed(2) : '0.00';
}

type InventoryTab = 'suppliers' | 'medicines';
type PendingDelete =
  | { kind: 'supplier'; id: string }
  | { kind: 'medicine'; id: string };

export function InventoryScreen() {
  const theme = useTheme();
  const { tab } = useLocalSearchParams<{ tab?: string | string[] }>();
  const requestedTab = firstSearchParam(tab);
  const [inventoryTab, setInventoryTab] = useState<InventoryTab>(
    requestedTab === 'medicines' ? 'medicines' : 'suppliers',
  );
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<PendingDelete | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (requestedTab === 'suppliers' || requestedTab === 'medicines') {
      setInventoryTab(requestedTab);
    }
  }, [requestedTab]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [supplierRows, medicineRows] = await Promise.all([listSuppliers(), listMedicines()]);
      setSuppliers(supplierRows);
      setMedicines(medicineRows);
      setListError(null);
    } catch (error) {
      setListError(error instanceof Error ? error.message : 'Could not load inventory.');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  function supplierName(supplierId: string) {
    return suppliers.find((supplier) => supplier.id === supplierId)?.name ?? 'Unknown supplier';
  }

  async function confirmDelete() {
    if (!pendingDelete) {
      return;
    }

    setDeleting(true);
    try {
      if (pendingDelete.kind === 'supplier') {
        await deleteSupplier(pendingDelete.id);
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
            ? 'Could not delete the supplier.'
            : 'Could not delete the medicine.',
        ),
      );
    } finally {
      setDeleting(false);
    }
  }

  return (
    <ScreenScroll>
      <TopTabs
        value={inventoryTab}
        onChange={(value) => setInventoryTab(value as InventoryTab)}
        tabs={[
          { value: 'suppliers', label: 'Suppliers' },
          { value: 'medicines', label: 'Medicines' },
        ]}
      />

      {inventoryTab === 'suppliers' ? (
        <>
          <View style={styles.heading}>
            <Text style={[styles.title, { color: theme.text }]}>
              Supplier list ( {suppliers.length} )
            </Text>
            <IconButton
              name="add"
              variant="accent"
              accessibilityLabel="Add supplier"
              onPress={() => router.push('/supplier/new')}
            />
          </View>
          {loading ? (
            <LoadingMark />
          ) : (
            <>
              {listError ? <ErrorBanner message={listError} /> : null}
              {suppliers.length === 0 ? (
                listError ? null : <EmptyState message="No suppliers yet." />
              ) : (
                <View>
                  {suppliers.map((supplier) => (
                    <View
                      key={supplier.id}
                      style={[styles.item, { borderBottomColor: theme.border }]}>
                      <View style={styles.itemBody}>
                        <Text style={[styles.itemTitle, { color: theme.text }]}>{supplier.name}</Text>
                        <Text style={[styles.itemMeta, { color: theme.textSecondary }]}>
                          {supplier.phone}
                        </Text>
                        <Text style={[styles.itemMeta, { color: theme.textSecondary }]}>
                          {supplier.address}
                        </Text>
                      </View>
                      <ListRowActions
                        disabled={deleting}
                        onEdit={() => router.push(`/supplier/new?id=${supplier.id}`)}
                        onDelete={() => setPendingDelete({ kind: 'supplier', id: supplier.id })}
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
              Medicine list ( {medicines.length} )
            </Text>
            <IconButton
              name="add"
              variant="accent"
              accessibilityLabel="Add medicine"
              onPress={() => router.push('/medicine/new')}
            />
          </View>
          {loading ? (
            <LoadingMark />
          ) : (
            <>
              {listError ? <ErrorBanner message={listError} /> : null}
              {medicines.length === 0 ? (
                listError ? null : <EmptyState message="No medicines yet." />
              ) : (
                <View>
                  {medicines.map((medicine) => (
                    <View
                      key={medicine.id}
                      style={[styles.item, { borderBottomColor: theme.border }]}>
                      <View style={styles.itemBody}>
                        <View style={styles.itemHeader}>
                          <Text style={[styles.itemTitle, { color: theme.text }]}>{medicine.name}</Text>
                          {medicine.stock <= 5 ? (
                            <Text style={styles.lowStock}>Low stock</Text>
                          ) : null}
                        </View>
                        <Text style={[styles.itemMeta, { color: theme.textSecondary }]}>
                          Stock {medicine.stock} · {formatPrice(medicine.price)}
                        </Text>
                        <Text style={[styles.itemMeta, { color: theme.textSecondary }]}>
                          {supplierName(medicine.supplier_id)}
                        </Text>
                      </View>
                      <ListRowActions
                        disabled={deleting}
                        onEdit={() => router.push(`/medicine/new?id=${medicine.id}`)}
                        onDelete={() => setPendingDelete({ kind: 'medicine', id: medicine.id })}
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
        visible={pendingDelete != null}
        message={
          pendingDelete?.kind === 'medicine'
            ? 'Are you sure you want to delete this medicine?'
            : 'Are you sure you want to delete this supplier?'
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
});
