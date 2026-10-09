import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';

import {
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

type MedicineErrors = {
  name?: string;
  stock?: string;
  price?: string;
  supplier?: string;
};

function validateMedicine(values: {
  name: string;
  stock: string;
  price: string;
  supplierId: string | null;
}): MedicineErrors {
  const errors: MedicineErrors = {};
  const stock = Number(values.stock);
  const price = Number(values.price);

  if (!values.name.trim()) {
    errors.name = 'Enter the medicine name.';
  }

  if (!values.stock.trim()) {
    errors.stock = 'Enter the stock quantity.';
  } else if (!Number.isInteger(stock) || stock < 0) {
    errors.stock = 'Enter a whole number of 0 or more.';
  }

  if (!values.price.trim()) {
    errors.price = 'Enter the price.';
  } else if (!Number.isFinite(price) || price < 0) {
    errors.price = 'Enter a price of 0 or more.';
  }

  if (!values.supplierId) {
    errors.supplier = 'Select a supplier.';
  }

  return errors;
}

export function MedicineAddScreen() {
  const { id } = useLocalSearchParams<{ id?: string | string[] }>();
  const recordId = firstSearchParam(id);
  const isEditing = Boolean(recordId);
  const [name, setName] = useState('');
  const [stock, setStock] = useState('');
  const [price, setPrice] = useState('');
  const [selectedSupplierId, setSelectedSupplierId] = useState<string | null>(null);
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
            ? 'Could not load the medicine.'
            : 'Could not load suppliers.',
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
    const nextErrors = validateMedicine({
      name,
      stock,
      price,
      supplierId: selectedSupplierId,
    });
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
            ? 'Could not update the medicine.'
            : 'Could not add the medicine.',
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <ScreenScroll withTabBar={false}>
      <ScreenNavHeader title={isEditing ? 'Edit medicine' : 'Add medicine'} onBack={() => router.back()} />
      {loading ? (
        <LoadingMark />
      ) : (
        <>
          <Field
            label="Name"
            value={name}
            error={fieldErrors.name}
            editable={!saving}
            placeholder="Medicine or supplement"
            onChangeText={(value) => {
              setName(value);
              clearFieldError('name');
            }}
          />
          <Field
            label="Stock"
            value={stock}
            error={fieldErrors.stock}
            editable={!saving}
            keyboardType="number-pad"
            placeholder="Quantity on hand"
            onChangeText={(value) => {
              setStock(value.replace(/[^\d]/g, ''));
              clearFieldError('stock');
            }}
          />
          <Field
            label="Price"
            value={price}
            error={fieldErrors.price}
            editable={!saving}
            keyboardType="decimal-pad"
            placeholder="0.00"
            onChangeText={(value) => {
              setPrice(value.replace(/[^\d.]/g, ''));
              clearFieldError('price');
            }}
          />
          <SelectField
            label="Supplier"
            placeholder={
              suppliers.length === 0 ? 'Add a supplier first' : 'Choose supplier'
            }
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
          {formError ? <ErrorBanner message={formError} /> : null}
          <PrimaryButton
            label={isEditing ? 'Save medicine' : 'Add medicine'}
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
