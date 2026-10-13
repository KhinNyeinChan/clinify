import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import {
  AmountField,
  DatePickerField,
  ErrorBanner,
  Field,
  FieldLabel,
  firstSearchParam,
  IconButton,
  LoadingMark,
  PrimaryButton,
  ScreenNavHeader,
  ScreenScroll,
  SelectField,
} from '@/components/clinic-ui';
import { Palette, Spacing } from '@/constants/theme';
import { useI18n } from '@/constants/i18n';
import { useTheme } from '@/hooks/use-theme';
import { listMedicines, type Medicine } from '@/services/medicines';
import {
  createMedicinePurchase,
  getMedicinePurchase,
  updateMedicinePurchase,
  type PurchasePackType,
  type PurchasePaymentStatus,
} from '@/services/medicine-purchases';
import { listSuppliers, type Supplier } from '@/services/suppliers';

type ItemRow = {
  key: string;
  medicineId: string;
  packType: PurchasePackType;
  quantity: string;
  originalPrice: string;
  salePrice: string;
  batchNumber: string;
  expiryDate: string;
};

type PurchaseErrors = {
  supplier?: string;
  date?: string;
  items?: string;
  payment?: string;
};

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function todayIsoDate() {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}

function moneyInput(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}

function formatMoney(value: number) {
  return value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function priceIsValid(value: string) {
  const amount = Number(value);
  return value.trim().length > 0 && Number.isFinite(amount) && amount >= 0;
}

function lineIsComplete(row: ItemRow) {
  const quantity = Number(row.quantity);
  return (
    Boolean(row.medicineId) &&
    (row.packType === 'box' || row.packType === 'unit') &&
    row.batchNumber.trim().length > 0 &&
    DATE_PATTERN.test(row.expiryDate) &&
    Number.isInteger(quantity) &&
    quantity > 0 &&
    priceIsValid(row.originalPrice) &&
    priceIsValid(row.salePrice)
  );
}

function lineSubtotal(row: ItemRow) {
  const quantity = Number(row.quantity);
  const originalPrice = Number(row.originalPrice);
  if (!Number.isInteger(quantity) || quantity <= 0 || !Number.isFinite(originalPrice) || originalPrice < 0) {
    return 0;
  }
  return quantity * originalPrice;
}

function baseQuantity(quantity: number, packType: PurchasePackType, unitsPerBox: number) {
  const perBox = Number.isInteger(unitsPerBox) && unitsPerBox > 0 ? unitsPerBox : 1;
  return packType === 'box' ? quantity * perBox : quantity;
}

export function PurchaseAddScreen() {
  const theme = useTheme();
  const copy = useI18n().purchase;
  const common = useI18n().common;
  const { id } = useLocalSearchParams<{ id?: string | string[] }>();
  const recordId = firstSearchParam(id);
  const isEditing = Boolean(recordId);
  const itemKey = useRef(1);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [loading, setLoading] = useState(true);
  const [supplierId, setSupplierId] = useState<string | null>(null);
  const [purchaseDate, setPurchaseDate] = useState(todayIsoDate);
  const [paymentStatus, setPaymentStatus] = useState<PurchasePaymentStatus>('Pending');
  const [paymentAmount, setPaymentAmount] = useState('0');
  const [items, setItems] = useState<ItemRow[]>([]);
  const [medicineOpen, setMedicineOpen] = useState(false);
  const [draftMedicineId, setDraftMedicineId] = useState<string | null>(null);
  const [draftPackType, setDraftPackType] = useState<PurchasePackType>('box');
  const [draftQuantity, setDraftQuantity] = useState('1');
  const [draftOriginalPrice, setDraftOriginalPrice] = useState('');
  const [draftSalePrice, setDraftSalePrice] = useState('');
  const [draftBatch, setDraftBatch] = useState('');
  const [draftExpiry, setDraftExpiry] = useState('');
  const [draftError, setDraftError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<PurchaseErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [supplierRows, medicineRows] = await Promise.all([listSuppliers(), listMedicines()]);
      setSuppliers(supplierRows);
      setMedicines(medicineRows);
      if (recordId) {
        const purchase = await getMedicinePurchase(recordId);
        setSupplierId(purchase.supplier_id);
        setPurchaseDate(purchase.purchase_date);
        setPaymentStatus(purchase.payment_status);
        setPaymentAmount(moneyInput(purchase.payment_amount));
        setItems(
          purchase.items.map((item, index) => ({
            key: String(index + 1),
            medicineId: item.medicineId,
            packType: item.packType,
            quantity: String(item.quantity),
            originalPrice: moneyInput(item.originalPrice),
            salePrice: moneyInput(item.salePrice),
            batchNumber: item.batchNumber,
            expiryDate: item.expiryDate,
          })),
        );
        itemKey.current = purchase.items.length;
      }
      setFormError(null);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : copy.loadError);
    } finally {
      setLoading(false);
    }
  }, [copy.loadError, recordId]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const total = items.reduce((sum, row) => sum + lineSubtotal(row), 0);
  const draftMedicine = medicines.find((item) => item.id === draftMedicineId) ?? null;
  const draftQuantityNumber = Number(draftQuantity);
  const draftBase =
    Number.isInteger(draftQuantityNumber) && draftQuantityNumber > 0
      ? baseQuantity(draftQuantityNumber, draftPackType, draftMedicine?.units_per_box ?? 1)
      : 0;
  const draftSubtotal = lineSubtotal({
    key: 'draft',
    medicineId: draftMedicineId ?? '',
    packType: draftPackType,
    quantity: draftQuantity,
    originalPrice: draftOriginalPrice,
    salePrice: draftSalePrice,
    batchNumber: draftBatch,
    expiryDate: draftExpiry,
  });
  const draftUnitName = draftMedicine?.box_unit_name || copy.unit;

  useEffect(() => {
    if (paymentStatus === 'Paid') {
      setPaymentAmount(moneyInput(total));
    } else if (paymentStatus === 'Pending') {
      setPaymentAmount('0');
    }
  }, [paymentStatus, total]);

  function openMedicineDialog() {
    setDraftMedicineId(null);
    setDraftPackType('box');
    setDraftQuantity('1');
    setDraftOriginalPrice('');
    setDraftSalePrice('');
    setDraftBatch('');
    setDraftExpiry('');
    setDraftError(null);
    setMedicineOpen(true);
  }

  function closeMedicineDialog() {
    setMedicineOpen(false);
  }

  function confirmMedicine() {
    const quantity = Number(draftQuantity);
    if (
      !draftMedicineId ||
      !draftBatch.trim() ||
      !DATE_PATTERN.test(draftExpiry) ||
      !Number.isInteger(quantity) ||
      quantity <= 0 ||
      !priceIsValid(draftOriginalPrice) ||
      !priceIsValid(draftSalePrice)
    ) {
      setDraftError(copy.draftError);
      return;
    }

    itemKey.current += 1;
    setItems((current) => [
      ...current,
      {
        key: String(itemKey.current),
        medicineId: draftMedicineId,
        packType: draftPackType,
        quantity: String(quantity),
        originalPrice: draftOriginalPrice,
        salePrice: draftSalePrice,
        batchNumber: draftBatch.trim(),
        expiryDate: draftExpiry,
      },
    ]);
    setFieldErrors((current) => ({ ...current, items: undefined }));
    setFormError(null);
    setMedicineOpen(false);
  }

  function removeItem(key: string) {
    setItems((current) => current.filter((row) => row.key !== key));
  }

  async function saveVoucher() {
    const errors: PurchaseErrors = {};
    if (!supplierId) {
      errors.supplier = copy.supplierError;
    }
    if (!DATE_PATTERN.test(purchaseDate)) {
      errors.date = copy.dateError;
    }

    if (items.length === 0) {
      errors.items = copy.itemsError;
    } else if (items.some((row) => !lineIsComplete(row))) {
      errors.items = copy.rowError;
    }

    const paid = paymentStatus === 'Paid' ? total : Number(paymentAmount);
    if (paymentStatus === 'Partial' && (!Number.isFinite(paid) || paid <= 0 || paid > total)) {
      errors.payment = copy.paymentError;
    }

    setFieldErrors(errors);
    setFormError(null);
    if (!supplierId || Object.keys(errors).length > 0) {
      return;
    }

    setSaving(true);
    try {
      const payload = {
        supplierId,
        purchaseDate,
        paymentAmount: paymentStatus === 'Pending' ? 0 : paid,
        paymentStatus,
        items: items.map((row) => ({
          medicineId: row.medicineId,
          packType: row.packType,
          quantity: Number(row.quantity),
          originalPrice: Number(row.originalPrice),
          salePrice: Number(row.salePrice),
          batchNumber: row.batchNumber.trim(),
          expiryDate: row.expiryDate,
        })),
      };
      if (recordId) {
        await updateMedicinePurchase(recordId, payload);
      } else {
        await createMedicinePurchase(payload);
      }
      router.back();
    } catch (error) {
      setFormError(error instanceof Error ? error.message : isEditing ? copy.updateError : copy.saveError);
    } finally {
      setSaving(false);
    }
  }

  return (
    <ScreenScroll withTabBar={false}>
      <ScreenNavHeader title={isEditing ? copy.edit : copy.title} onBack={() => router.back()} />
      {loading ? (
        <LoadingMark />
      ) : (
        <>
          <SelectField
            label={common.supplier}
            required
            placeholder={suppliers.length === 0 ? copy.addSupplierFirst : copy.chooseSupplier}
            value={supplierId}
            options={suppliers.map((supplier) => ({ value: supplier.id, label: supplier.name }))}
            error={fieldErrors.supplier}
            disabled={saving || suppliers.length === 0}
            onChange={(value) => {
              setSupplierId(value);
              setFieldErrors((current) => ({ ...current, supplier: undefined }));
            }}
          />
          <DatePickerField
            label={copy.purchaseDate}
            required
            placeholder={common.chooseDate}
            value={purchaseDate}
            error={fieldErrors.date}
            disabled={saving}
            onChange={setPurchaseDate}
          />

          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>{copy.medicines}</Text>
            <Pressable accessibilityRole="button" disabled={saving} onPress={openMedicineDialog}>
              <Text style={styles.addLine}>{copy.addMedicine}</Text>
            </Pressable>
          </View>
          {items.length === 0 ? (
            <Text style={[styles.emptyList, { color: theme.textSecondary }]}>{copy.noneYet}</Text>
          ) : (
            <View>
              {items.map((row) => {
                const medicine = medicines.find((item) => item.id === row.medicineId);
                return (
                  <View key={row.key} style={[styles.item, { borderBottomColor: theme.border }]}>
                    <View style={styles.itemBody}>
                      <Text style={[styles.itemTitle, { color: theme.text }]}>
                        {medicine?.name ?? copy.medicine}
                      </Text>
                      <Text style={[styles.itemMeta, { color: theme.textSecondary }]}>
                        {row.batchNumber} · {row.expiryDate}
                      </Text>
                      <Text style={[styles.itemMeta, { color: theme.textSecondary }]}>
                        {row.quantity} {row.packType === 'box' ? copy.box : medicine?.box_unit_name || copy.unit} ×{' '}
                        {formatMoney(Number(row.originalPrice))}
                      </Text>
                      <Text style={[styles.itemMeta, { color: theme.textSecondary }]}>
                        {copy.stockAdded}{' '}
                        {baseQuantity(Number(row.quantity), row.packType, medicine?.units_per_box ?? 1)}{' '}
                        {medicine?.box_unit_name || copy.unit}
                      </Text>
                    </View>
                    <Text style={[styles.lineTotal, { color: theme.text }]}>{formatMoney(lineSubtotal(row))}</Text>
                    <IconButton
                      name="trash-outline"
                      variant="delete"
                      accessibilityLabel={common.delete}
                      disabled={saving}
                      onPress={() => removeItem(row.key)}
                    />
                  </View>
                );
              })}
            </View>
          )}
          {fieldErrors.items ? <Text style={styles.fieldError}>{fieldErrors.items}</Text> : null}

          <View style={[styles.totalRow, { borderTopColor: theme.border }]}>
            <Text style={[styles.totalLabel, { color: theme.text }]}>{common.total}</Text>
            <Text style={styles.totalValue}>{formatMoney(total)}</Text>
          </View>

          <SelectField
            label={copy.paymentStatus}
            required
            placeholder={copy.chooseStatus}
            value={paymentStatus}
            options={[
              { value: 'Paid', label: common.paid },
              { value: 'Pending', label: common.pending },
              { value: 'Partial', label: common.partial },
            ]}
            disabled={saving}
            onChange={(value) => setPaymentStatus(value as PurchasePaymentStatus)}
          />
          {paymentStatus === 'Partial' ? (
            <AmountField
              label={copy.paymentAmount}
              required
              value={paymentAmount}
              error={fieldErrors.payment}
              editable={!saving}
              onChangeText={(value) => {
                setPaymentAmount(value);
                setFieldErrors((current) => ({ ...current, payment: undefined }));
              }}
            />
          ) : (
            <Text style={[styles.paymentNote, { color: theme.textSecondary }]}>
              {paymentStatus === 'Paid'
                ? `${copy.paidNote} ${formatMoney(total)}`
                : copy.pendingNote}
            </Text>
          )}
          {fieldErrors.payment && paymentStatus !== 'Partial' ? (
            <Text style={styles.fieldError}>{fieldErrors.payment}</Text>
          ) : null}
          {formError ? <ErrorBanner message={formError} /> : null}
          <PrimaryButton
            label={copy.save}
            loading={saving}
            disabled={suppliers.length === 0 || medicines.length === 0}
            onPress={() => {
              void saveVoucher();
            }}
          />
          <Modal transparent animationType="fade" visible={medicineOpen} onRequestClose={closeMedicineDialog}>
            <View style={styles.overlay}>
              <Pressable style={StyleSheet.absoluteFill} onPress={closeMedicineDialog} />
              <View style={[styles.dialog, { backgroundColor: theme.backgroundElement }]}>
                <ScrollView
                  keyboardShouldPersistTaps="handled"
                  contentContainerStyle={styles.dialogContent}
                  style={styles.dialogScroll}>
                <Text style={[styles.dialogTitle, { color: theme.text }]}>{copy.addMedicine}</Text>
                <FieldLabel label={copy.medicine} required />
                <ScrollView style={styles.medicineList} keyboardShouldPersistTaps="handled">
                  {medicines.length === 0 ? (
                    <Text style={[styles.emptyList, { color: theme.textSecondary }]}>{copy.noMedicines}</Text>
                  ) : (
                    medicines.map((medicine) => {
                      const selected = medicine.id === draftMedicineId;
                      return (
                        <Pressable
                          key={medicine.id}
                          accessibilityRole="button"
                          onPress={() => {
                            setDraftMedicineId(medicine.id);
                            setDraftSalePrice(moneyInput(medicine.price));
                            setDraftError(null);
                          }}
                          style={[
                            styles.medicineOption,
                            {
                              backgroundColor: selected ? Palette.accent : theme.background,
                              borderColor: selected ? Palette.primary : theme.border,
                            },
                          ]}>
                          <Text style={{ color: selected ? Palette.primary : theme.text, fontWeight: '600' }}>
                            {medicine.name}
                          </Text>
                        </Pressable>
                      );
                    })
                  )}
                </ScrollView>
                <FieldLabel label={copy.buyAs} required />
                <View style={styles.packRow}>
                  {(['box', 'unit'] as const).map((pack) => {
                    const selected = draftPackType === pack;
                    const label = pack === 'box' ? copy.box : draftUnitName;
                    return (
                      <Pressable
                        key={pack}
                        accessibilityRole="button"
                        onPress={() => {
                          setDraftPackType(pack);
                          setDraftError(null);
                        }}
                        style={[
                          styles.packOption,
                          {
                            backgroundColor: selected ? Palette.accent : theme.background,
                            borderColor: selected ? Palette.primary : theme.border,
                          },
                        ]}>
                        <Text style={{ color: selected ? Palette.primary : theme.text, fontWeight: '700' }}>
                          {label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
                {draftMedicine ? (
                  <Text style={[styles.conversion, { color: theme.textSecondary }]}>
                    1 {copy.box} = {draftMedicine.units_per_box} {draftUnitName}
                  </Text>
                ) : null}
                <Field
                  label={copy.quantity}
                  required
                  value={draftQuantity}
                  editable={!saving}
                  keyboardType="number-pad"
                  placeholder="1"
                  onChangeText={(value) => {
                    setDraftQuantity(value.replace(/[^\d]/g, ''));
                    setDraftError(null);
                  }}
                />
                <AmountField
                  label={copy.originalPrice}
                  required
                  value={draftOriginalPrice}
                  editable={!saving}
                  onChangeText={(value) => {
                    setDraftOriginalPrice(value);
                    setDraftError(null);
                  }}
                />
                <AmountField
                  label={copy.salePrice}
                  required
                  value={draftSalePrice}
                  editable={!saving}
                  onChangeText={(value) => {
                    setDraftSalePrice(value);
                    setDraftError(null);
                  }}
                />
                <Text style={[styles.conversion, { color: theme.text }]}>
                  {copy.stockAdded} {draftBase} {draftUnitName}
                </Text>
                <Text style={[styles.conversion, { color: theme.text }]}>
                  {common.total} {formatMoney(draftSubtotal)}
                </Text>
                <Field
                  label={copy.batchNumber}
                  required
                  value={draftBatch}
                  editable={!saving}
                  autoCapitalize="characters"
                  placeholder={copy.batchPlaceholder}
                  onChangeText={(value) => {
                    setDraftBatch(value);
                    setDraftError(null);
                  }}
                />
                <DatePickerField
                  label={copy.expiryDate}
                  required
                  placeholder={common.chooseDate}
                  value={draftExpiry}
                  disabled={saving}
                  onChange={(value) => {
                    setDraftExpiry(value);
                    setDraftError(null);
                  }}
                />
                {draftError ? <Text style={styles.fieldError}>{draftError}</Text> : null}
                <View style={styles.dialogActions}>
                  <Pressable
                    accessibilityRole="button"
                    onPress={closeMedicineDialog}
                    style={[styles.dialogButton, { borderColor: theme.border }]}>
                    <Text style={[styles.dialogButtonLabel, { color: theme.text }]}>{copy.cancel}</Text>
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    onPress={confirmMedicine}
                    style={[styles.dialogButton, styles.dialogButtonPrimary]}>
                    <Text style={[styles.dialogButtonLabel, { color: Palette.white }]}>{copy.add}</Text>
                  </Pressable>
                </View>
                </ScrollView>
              </View>
            </View>
          </Modal>
        </>
      )}
    </ScreenScroll>
  );
}

const styles = StyleSheet.create({
  sectionHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  addLine: {
    color: Palette.primary,
    fontSize: 15,
    fontWeight: '700',
  },
  emptyList: {
    fontSize: 14,
  },
  item: {
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: Spacing.two,
    paddingVertical: 12,
  },
  itemBody: {
    flex: 1,
  },
  itemTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  itemMeta: {
    fontSize: 13,
    marginTop: 2,
  },
  lineTotal: {
    fontSize: 15,
    fontWeight: '700',
  },
  overlay: {
    alignItems: 'center',
    backgroundColor: 'rgba(17, 24, 39, 0.45)',
    flex: 1,
    justifyContent: 'center',
    padding: Spacing.four,
  },
  dialog: {
    borderRadius: 16,
    maxHeight: '85%',
    overflow: 'hidden',
    padding: Spacing.four,
    width: '100%',
    maxWidth: 420,
  },
  dialogScroll: {
    flexGrow: 0,
    maxHeight: 480,
  },
  dialogContent: {
    gap: Spacing.two,
  },
  dialogTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: Spacing.two,
  },
  medicineList: {
    maxHeight: 120,
  },
  medicineOption: {
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: 12,
  },
  packRow: {
    flexDirection: 'row',
    gap: Spacing.two,
    marginBottom: Spacing.two,
  },
  packOption: {
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    flex: 1,
    paddingVertical: 12,
  },
  conversion: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: Spacing.two,
  },
  dialogActions: {
    flexDirection: 'row',
    gap: Spacing.two,
    marginTop: Spacing.two,
  },
  dialogButton: {
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    flex: 1,
    paddingVertical: 12,
  },
  dialogButtonPrimary: {
    backgroundColor: Palette.primary,
    borderColor: Palette.primary,
  },
  dialogButtonLabel: {
    fontSize: 15,
    fontWeight: '700',
  },
  fieldError: {
    color: Palette.error,
    fontSize: 13,
  },
  totalRow: {
    alignItems: 'center',
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: Spacing.three,
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: '700',
  },
  totalValue: {
    color: Palette.primary,
    fontSize: 20,
    fontWeight: '700',
  },
  paymentNote: {
    fontSize: 14,
    lineHeight: 20,
  },
});
