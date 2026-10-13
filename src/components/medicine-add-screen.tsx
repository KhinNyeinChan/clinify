import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';

import {
  AmountField,
  ErrorBanner,
  Field,
  firstSearchParam,
  LoadingMark,
  PrimaryButton,
  ScreenNavHeader,
  ScreenScroll,
  SelectField,
} from '@/components/clinic-ui';
import { createMedicine, getMedicine, updateMedicine } from '@/services/medicines';
import { listSuppliers, type Supplier } from '@/services/suppliers';
import { useI18n } from '@/constants/i18n';

type MedicineErrors = {
  name?: string;
  stock?: string;
  price?: string;
  supplier?: string;
  boxUnit?: string;
  unitsPerBox?: string;
};

function validateMedicine(
  values: {
    name: string;
    stock: string;
    price: string;
    supplierId: string | null;
    boxUnitName: string;
    unitsPerBox: string;
  },
  copy: ReturnType<typeof useI18n>['medicineForm'],
): MedicineErrors {
  const errors: MedicineErrors = {};
  const stock = Number(values.stock);
  const price = Number(values.price);
  const unitsPerBox = Number(values.unitsPerBox);

  if (!values.name.trim()) {
    errors.name = copy.nameError;
  }

  if (!values.stock.trim()) {
    errors.stock = copy.stockError;
  } else if (!Number.isInteger(stock) || stock < 0) {
    errors.stock = copy.stockInvalid;
  }

  if (!values.price.trim()) {
    errors.price = copy.priceError;
  } else if (!Number.isFinite(price) || price < 0) {
    errors.price = copy.priceInvalid;
  }

  if (!values.supplierId) {
    errors.supplier = copy.supplierError;
  }

  if (!values.boxUnitName.trim()) {
    errors.boxUnit = copy.boxUnitError;
  }

  if (!values.unitsPerBox.trim()) {
    errors.unitsPerBox = copy.unitsPerBoxError;
  } else if (!Number.isInteger(unitsPerBox) || unitsPerBox < 1) {
    errors.unitsPerBox = copy.unitsPerBoxInvalid;
  }

  return errors;
}

export function MedicineAddScreen() {
  const copy = useI18n().medicineForm;
  const common = useI18n().common;
  const { id } = useLocalSearchParams<{ id?: string | string[] }>();
  const recordId = firstSearchParam(id);
  const isEditing = Boolean(recordId);
  const [name, setName] = useState('');
  const [stock, setStock] = useState('');
  const [price, setPrice] = useState('');
  const [selectedSupplierId, setSelectedSupplierId] = useState<string | null>(null);
  const [boxUnitName, setBoxUnitName] = useState('');
  const [unitsPerBox, setUnitsPerBox] = useState('1');
  const [fieldErrors, setFieldErrors] = useState<MedicineErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [supplierRows, medicine] = await Promise.all([
        listSuppliers(),
        recordId ? getMedicine(recordId) : Promise.resolve(null),
      ]);
      setSuppliers(supplierRows);
      if (medicine) {
        setName(medicine.name);
        setStock(String(medicine.stock));
        setPrice(Number.isInteger(medicine.price) ? String(medicine.price) : medicine.price.toFixed(2));
        setBoxUnitName(medicine.box_unit_name);
        setUnitsPerBox(String(medicine.units_per_box));
        setSelectedSupplierId(
          supplierRows.some((supplier) => supplier.id === medicine.supplier_id)
            ? medicine.supplier_id
            : null,
        );
      } else {
        setSelectedSupplierId((current) =>
          current && supplierRows.some((supplier) => supplier.id === current) ? current : null,
        );
      }
      setFormError(null);
    } catch (error) {
      setFormError(
        error instanceof Error
          ? error.message
          : isEditing
            ? copy.loadError
            : copy.suppliersError,
      );
    } finally {
      setLoading(false);
    }
  }, [isEditing, recordId]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  function clearFieldError(field: keyof MedicineErrors) {
    setFieldErrors((current) => ({ ...current, [field]: undefined }));
    setFormError(null);
  }

  async function saveMedicine() {
    const nextErrors = validateMedicine(
      {
        name,
        stock,
        price,
        supplierId: selectedSupplierId,
        boxUnitName,
        unitsPerBox,
      },
      copy,
    );
    setFieldErrors(nextErrors);
    setFormError(null);

    if (!selectedSupplierId || Object.keys(nextErrors).length > 0) {
      return;
    }

    const payload = {
      name: name.trim(),
      stock: Number(stock),
      price: Number(price),
      supplier_id: selectedSupplierId,
      box_unit_name: boxUnitName.trim(),
      units_per_box: Number(unitsPerBox),
    };

    setSaving(true);
    try {
      if (recordId) {
        await updateMedicine(recordId, payload);
      } else {
        await createMedicine(payload);
      }
      router.back();
    } catch (error) {
      setFormError(
        error instanceof Error
          ? error.message
          : isEditing
            ? copy.updateError
            : copy.createError,
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <ScreenScroll withTabBar={false}>
      <ScreenNavHeader title={isEditing ? copy.edit : copy.add} onBack={() => router.back()} />
      {loading ? (
        <LoadingMark />
      ) : (
        <>
          <Field
            label={common.name}
            required
            value={name}
            error={fieldErrors.name}
            editable={!saving}
            placeholder={copy.namePlaceholder}
            onChangeText={(value) => {
              setName(value);
              clearFieldError('name');
            }}
          />
          <Field
            label={common.stock}
            required
            value={stock}
            error={fieldErrors.stock}
            editable={!saving}
            keyboardType="number-pad"
            placeholder={copy.stockPlaceholder}
            onChangeText={(value) => {
              setStock(value.replace(/[^\d]/g, ''));
              clearFieldError('stock');
            }}
          />
          <AmountField
            label={common.price}
            required
            value={price}
            error={fieldErrors.price}
            editable={!saving}
            onChangeText={(value) => {
              setPrice(value);
              clearFieldError('price');
            }}
          />
          <SelectField
            label={common.supplier}
            required
            placeholder={suppliers.length === 0 ? copy.addSupplierFirst : copy.chooseSupplier}
            value={selectedSupplierId}
            options={suppliers.map((supplier) => ({
              value: supplier.id,
              label: supplier.name,
            }))}
            error={fieldErrors.supplier}
            disabled={saving || suppliers.length === 0}
            onChange={(value) => {
              setSelectedSupplierId(value);
              clearFieldError('supplier');
            }}
          />
          <Field
            label={copy.boxUnitName}
            required
            value={boxUnitName}
            error={fieldErrors.boxUnit}
            editable={!saving}
            placeholder={copy.boxUnitPlaceholder}
            onChangeText={(value) => {
              setBoxUnitName(value);
              clearFieldError('boxUnit');
            }}
          />
          <Field
            label={copy.unitsPerBox}
            required
            value={unitsPerBox}
            error={fieldErrors.unitsPerBox}
            editable={!saving}
            keyboardType="number-pad"
            placeholder={copy.unitsPerBoxPlaceholder}
            onChangeText={(value) => {
              setUnitsPerBox(value.replace(/[^\d]/g, ''));
              clearFieldError('unitsPerBox');
            }}
          />
          {formError ? <ErrorBanner message={formError} /> : null}
          <PrimaryButton
            label={isEditing ? copy.save : copy.add}
            loading={saving}
            disabled={suppliers.length === 0}
            onPress={() => {
              void saveMedicine();
            }}
          />
        </>
      )}
    </ScreenScroll>
  );
}
