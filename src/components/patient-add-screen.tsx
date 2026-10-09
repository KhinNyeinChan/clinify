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
import { createPatient, getPatient, updatePatient } from '@/services/patients';

type PatientErrors = {
  name?: string;
  age?: string;
  phone?: string;
  address?: string;
};

function validatePatient(values: {
  name: string;
  age: string;
  phone: string;
  address: string;
}): PatientErrors {
  const errors: PatientErrors = {};
  const phone = values.phone.trim();
  const age = Number(values.age);
  const digitCount = phone.replace(/\D/g, '').length;

  if (!values.name.trim()) {
    errors.name = 'Enter the patient name.';
  }

  if (!values.age.trim()) {
    errors.age = 'Enter the patient age.';
  } else if (!Number.isInteger(age) || age < 0 || age > 120) {
    errors.age = 'Enter an age from 0 to 120.';
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

export function PatientAddScreen() {
  const { id } = useLocalSearchParams<{ id?: string | string[] }>();
  const recordId = firstSearchParam(id);
  const isEditing = Boolean(recordId);
  const [name, setName] = useState('');
  const [age, setAge] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
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
        setFormError(null);
      })
      .catch((error) => {
        if (active) {
          setFormError(error instanceof Error ? error.message : 'Could not load the patient.');
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
    const nextErrors = validatePatient({ name, age, phone, address });
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
            ? 'Could not update the patient.'
            : 'Could not register the patient.',
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <ScreenScroll withTabBar={false}>
      <ScreenNavHeader title={isEditing ? 'Edit patient' : 'Add patient'} onBack={() => router.back()} />
      {loadingRecord ? (
        <LoadingMark />
      ) : (
        <>
          <Field
            label="Name"
            value={name}
            error={fieldErrors.name}
            editable={!saving}
            placeholder="Patient name"
            onChangeText={(value) => {
              setName(value);
              clearFieldError('name');
            }}
          />
          <Field
            label="Age"
            value={age}
            error={fieldErrors.age}
            editable={!saving}
            keyboardType="number-pad"
            placeholder="Age"
            onChangeText={(value) => {
              setAge(value.replace(/[^\d]/g, ''));
              clearFieldError('age');
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
            label={isEditing ? 'Save patient' : 'Register patient'}
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
