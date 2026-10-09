import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';

import {
  ErrorBanner,
  Field,
  firstSearchParam,
  LoadingMark,
  PrimaryButton,
  ScreenNavHeader,
  ScreenScroll,
} from '@/components/clinic-ui';
import { createSupplier, getSupplier, updateSupplier } from '@/services/suppliers';

type SupplierErrors = {
  name?: string;
  phone?: string;
  address?: string;
};

function validateSupplier(values: { name: string; phone: string; address: string }): SupplierErrors {
  const errors: SupplierErrors = {};
  const phone = values.phone.trim();
  const digitCount = phone.replace(/\D/g, '').length;

  if (!values.name.trim()) {
    errors.name = 'Enter the supplier name.';
  }

  if (!phone) {
    errors.phone = 'Enter a phone number.';
  } else if (digitCount < 7 || digitCount > 15) {
    errors.phone = 'Enter a valid phone number.';
  }

  if (!values.address.trim()) {
    errors.address = 'Enter an address.';
  }

  return errors;
}

export function SupplierAddScreen() {
  const { id } = useLocalSearchParams<{ id?: string | string[] }>();
  const recordId = firstSearchParam(id);
  const isEditing = Boolean(recordId);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [fieldErrors, setFieldErrors] = useState<SupplierErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [loadingRecord, setLoadingRecord] = useState(isEditing);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!recordId) {
      return;
    }

    let active = true;
    setLoadingRecord(true);
    getSupplier(recordId)
      .then((supplier) => {
        if (!active) {
          return;
        }
        setName(supplier.name);
        setPhone(supplier.phone);
        setAddress(supplier.address);
        setFormError(null);
      })
      .catch((error) => {
        if (active) {
          setFormError(error instanceof Error ? error.message : 'Could not load the supplier.');
        }
      })
      .finally(() => {
        if (active) {
          setLoadingRecord(false);
        }
      });

    return () => {
      active = false;
    };
  }, [recordId]);

  function clearFieldError(field: keyof SupplierErrors) {
    setFieldErrors((current) => ({ ...current, [field]: undefined }));
    setFormError(null);
  }

  async function saveSupplier() {
    const nextErrors = validateSupplier({ name, phone, address });
    setFieldErrors(nextErrors);
    setFormError(null);

    if (Object.keys(nextErrors).length > 0) {
      return;
    }

    const payload = {
      name: name.trim(),
      phone: phone.trim(),
      address: address.trim(),
    };

    setSaving(true);
    try {
      if (recordId) {
        await updateSupplier(recordId, payload);
      } else {
        await createSupplier(payload);
      }
      router.back();
    } catch (error) {
      setFormError(
        error instanceof Error
          ? error.message
          : isEditing
            ? 'Could not update the supplier.'
            : 'Could not add the supplier.',
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <ScreenScroll withTabBar={false}>
      <ScreenNavHeader title={isEditing ? 'Edit supplier' : 'Add supplier'} onBack={() => router.back()} />
      {loadingRecord ? (
        <LoadingMark />
      ) : (
        <>
          <Field
            label="Name"
            value={name}
            error={fieldErrors.name}
            editable={!saving}
            placeholder="Supplier name"
            onChangeText={(value) => {
              setName(value);
              clearFieldError('name');
            }}
          />
          <Field
            label="Phone"
            value={phone}
            error={fieldErrors.phone}
            editable={!saving}
            keyboardType="phone-pad"
            placeholder="Phone number"
            onChangeText={(value) => {
              setPhone(value);
              clearFieldError('phone');
            }}
          />
          <Field
            label="Address"
            value={address}
            error={fieldErrors.address}
            editable={!saving}
            multiline
            placeholder="Address"
            onChangeText={(value) => {
              setAddress(value);
              clearFieldError('address');
            }}
          />
          {formError ? <ErrorBanner message={formError} /> : null}
          <PrimaryButton
            label={isEditing ? 'Save supplier' : 'Add supplier'}
            loading={saving}
            onPress={() => {
              void saveSupplier();
            }}
          />
        </>
      )}
    </ScreenScroll>
  );
}
