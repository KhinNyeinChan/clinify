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
import { useI18n } from '@/constants/i18n';

type SupplierErrors = {
  name?: string;
  phone?: string;
  address?: string;
};

function validateSupplier(
  values: { name: string; phone: string; address: string },
  copy: ReturnType<typeof useI18n>['supplierForm'],
): SupplierErrors {
  const errors: SupplierErrors = {};
  const phone = values.phone.trim();
  const digitCount = phone.replace(/\D/g, '').length;

  if (!values.name.trim()) {
    errors.name = copy.nameError;
  }

  if (!phone) {
    errors.phone = copy.phoneError;
  } else if (digitCount < 7 || digitCount > 15) {
    errors.phone = copy.phoneInvalid;
  }

  if (!values.address.trim()) {
    errors.address = copy.addressError;
  }

  return errors;
}

export function SupplierAddScreen() {
  const copy = useI18n().supplierForm;
  const common = useI18n().common;
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
          setFormError(error instanceof Error ? error.message : copy.loadError);
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
    const nextErrors = validateSupplier({ name, phone, address }, copy);
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
      {loadingRecord ? (
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
            label={common.phone}
            required
            value={phone}
            error={fieldErrors.phone}
            editable={!saving}
            keyboardType="phone-pad"
            placeholder={copy.phonePlaceholder}
            onChangeText={(value) => {
              setPhone(value);
              clearFieldError('phone');
            }}
          />
          <Field
            label={common.address}
            required
            value={address}
            error={fieldErrors.address}
            editable={!saving}
            multiline
            placeholder={copy.addressPlaceholder}
            onChangeText={(value) => {
              setAddress(value);
              clearFieldError('address');
            }}
          />
          {formError ? <ErrorBanner message={formError} /> : null}
          <PrimaryButton
            label={isEditing ? common.save : copy.add}
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
