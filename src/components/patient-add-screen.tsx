import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';

import {
  ErrorBanner,
  Field,
  firstSearchParam,
  LoadingMark,
  PrimaryButton,
  ScreenNavHeader,
  ScreenScroll,
} from '@/components/clinic-ui';
import { Palette } from '@/constants/theme';
import { useI18n } from '@/constants/i18n';
import { createPatient, getPatient, updatePatient } from '@/services/patients';

type PatientErrors = {
  name?: string;
  age?: string;
  phone?: string;
  address?: string;
};

function validatePatient(
  values: {
    name: string;
    age: string;
    phone: string;
    address: string;
  },
  copy: ReturnType<typeof useI18n>['patient'],
): PatientErrors {
  const errors: PatientErrors = {};
  const phone = values.phone.trim();
  const age = Number(values.age);
  const digitCount = phone.replace(/\D/g, '').length;

  if (!values.name.trim()) {
    errors.name = copy.nameError;
  }

  if (!values.age.trim()) {
    errors.age = copy.ageError;
  } else if (!Number.isInteger(age) || age < 0 || age > 120) {
    errors.age = copy.ageRange;
  }

  if (phone && (digitCount < 7 || digitCount > 15)) {
    errors.phone = copy.phoneInvalid;
  }

  if (!values.address.trim()) {
    errors.address = copy.addressError;
  }

  return errors;
}

export function PatientAddScreen() {
  const { id } = useLocalSearchParams<{ id?: string | string[] }>();
  const recordId = firstSearchParam(id);
  const isEditing = Boolean(recordId);
  const copy = useI18n().patient;
  const common = useI18n().common;
  const [name, setName] = useState('');
  const [age, setAge] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [note, setNote] = useState('');
  const [fieldErrors, setFieldErrors] = useState<PatientErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [loadingRecord, setLoadingRecord] = useState(isEditing);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!recordId) {
      return;
    }

    let active = true;
    setLoadingRecord(true);
    getPatient(recordId)
      .then((patient) => {
        if (!active) {
          return;
        }
        setName(patient.name);
        setAge(String(patient.age));
        setPhone(patient.phone);
        setAddress(patient.address);
        setNote(patient.note);
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

  function clearFieldError(field: keyof PatientErrors) {
    setFieldErrors((current) => ({ ...current, [field]: undefined }));
    setFormError(null);
  }

  async function savePatient() {
    const nextErrors = validatePatient({ name, age, phone, address }, copy);
    setFieldErrors(nextErrors);
    setFormError(null);

    if (Object.keys(nextErrors).length > 0) {
      return;
    }

    const payload = {
      name: name.trim(),
      age: Number(age),
      phone: phone.trim(),
      address: address.trim(),
      note: note.trim(),
    };

    setSaving(true);
    try {
      if (recordId) {
        await updatePatient(recordId, payload);
      } else {
        await createPatient(payload);
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
      <ScreenNavHeader
        title={isEditing ? copy.edit : copy.add}
        onBack={() => router.back()}
        right={
          isEditing && recordId ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={copy.visitRecords}
              disabled={saving}
              onPress={() => {
                router.push({ pathname: '/patient/visits', params: { id: recordId } });
              }}
              style={({ pressed }) => [styles.visitsLink, { opacity: pressed || saving ? 0.6 : 1 }]}>
              <Text style={styles.visitsLabel}>{copy.visitRecords}</Text>
            </Pressable>
          ) : undefined
        }
      />
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
            label={copy.age}
            required
            value={age}
            error={fieldErrors.age}
            editable={!saving}
            keyboardType="number-pad"
            placeholder={copy.agePlaceholder}
            onChangeText={(value) => {
              setAge(value.replace(/[^\d]/g, ''));
              clearFieldError('age');
            }}
          />
          <Field
            label={common.phone}
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
          <Field
            label={common.note}
            value={note}
            editable={!saving}
            multiline
            placeholder={copy.notePlaceholder}
            onChangeText={setNote}
          />
          {formError ? <ErrorBanner message={formError} /> : null}
          <PrimaryButton
            label={isEditing ? copy.save : copy.register}
            loading={saving}
            onPress={() => {
              void savePatient();
            }}
          />
        </>
      )}
    </ScreenScroll>
  );
}

const styles = StyleSheet.create({
  visitsLink: {
    paddingVertical: 8,
  },
  visitsLabel: {
    color: Palette.primary,
    fontSize: 14,
    fontWeight: '700',
  },
});
