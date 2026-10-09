import Ionicons from '@expo/vector-icons/Ionicons';
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import {
  Card,
  ComboField,
  ErrorBanner,
  Field,
  IconButton,
  PrimaryButton,
  ScreenHeader,
  ScreenScroll,
  SectionTitle,
  SelectField,
  SuccessBanner,
} from '@/components/clinic-ui';
import { Palette, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { createMedicalRecord } from '@/services/medical-records';
import { listMedicines, type Medicine } from '@/services/medicines';
import { listPatients, type Patient } from '@/services/patients';
import { createTransaction } from '@/services/transactions';

const BLOOD_PRESSURE_PATTERN = /^\d{2,3}\/\d{2,3}$/;
const TIMES_OF_DAY = ['Morning', 'Afternoon', 'Evening', 'Night'] as const;
const MEAL_TIMES = ['Before meals', 'After meals', 'With meals'] as const;

type TimeOfDay = (typeof TIMES_OF_DAY)[number];
type MealTime = (typeof MEAL_TIMES)[number];

type Prescription = {
  id: string;
  name: string;
  dosage: string;
  times: TimeOfDay[];
  meal: MealTime | null;
  duration: string;
};

type VisitErrors = {
  patient?: string;
  symptoms?: string;
  bloodPressure?: string;
  temperature?: string;
  diagnosis?: string;
  prescriptions?: string;
  consultationFee?: string;
  medicineFee?: string;
};

function emptyPrescription(id: string): Prescription {
  return {
    id,
    name: '',
    dosage: '',
    times: [],
    meal: null,
    duration: '',
  };
}

function todayIsoDate() {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}

function formatMoney(value: number) {
  return value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatMoneyInput(value: number) {
  if (!Number.isFinite(value) || value <= 0) {
    return '';
  }
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}

function parseFee(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return 0;
  }

  const amount = Number(trimmed);
  if (!Number.isFinite(amount) || amount < 0) {
    return null;
  }

  return amount;
}

function suggestedMedicineTotal(prescriptions: Prescription[], medicines: Medicine[]) {
  return prescriptions.reduce((total, row) => {
    const name = row.name.trim().toLowerCase();
    if (!name) {
      return total;
    }

    const match = medicines.find(
      (medicine) => medicine.name.trim().toLowerCase() === name || medicine.id === row.name,
    );
    return total + (match ? match.price : 0);
  }, 0);
}

function validateVisit(values: {
  patientId: string | null;
  symptoms: string;
  bloodPressure: string;
  temperature: string;
  diagnosis: string;
  prescriptions: Prescription[];
  consultationFee: string;
  medicineFee: string;
}): VisitErrors {
  const errors: VisitErrors = {};
  const temperature = Number(values.temperature);

  if (!values.patientId) {
    errors.patient = 'Select a patient.';
  }

  if (!values.symptoms.trim()) {
    errors.symptoms = 'Enter the symptoms.';
  }

  if (!values.bloodPressure.trim()) {
    errors.bloodPressure = 'Enter the blood pressure.';
  } else if (!BLOOD_PRESSURE_PATTERN.test(values.bloodPressure.trim())) {
    errors.bloodPressure = 'Use a reading such as 120/80.';
  }

  if (!values.temperature.trim()) {
    errors.temperature = 'Enter the temperature.';
  } else if (!Number.isFinite(temperature) || temperature < 30 || temperature > 115) {
    errors.temperature = 'Enter a temperature such as 36.8 or 98.6.';
  }

  if (!values.diagnosis.trim()) {
    errors.diagnosis = 'Enter the diagnosis.';
  }

  const incomplete = values.prescriptions.some(
    (row) =>
      !row.name.trim() || !row.dosage.trim() || row.times.length === 0 || !row.duration.trim(),
  );
  if (incomplete) {
    errors.prescriptions =
      'For each medicine, enter the name, dosage, at least one time of day, and duration.';
  }

  if (parseFee(values.consultationFee) == null) {
    errors.consultationFee = 'Enter a consultation fee of 0 or more.';
  }

  if (parseFee(values.medicineFee) == null) {
    errors.medicineFee = 'Enter a medicine total of 0 or more.';
  }

  return errors;
}

function formatVitals(bloodPressure: string, temperature: string, otherVitals: string) {
  const lines = [
    `Blood pressure: ${bloodPressure.trim()}`,
    `Temperature: ${temperature.trim()}`,
  ];
  const extra = otherVitals.trim();

  if (extra) {
    lines.push(extra);
  }

  return lines.join('\n');
}

function formatPrescriptions(rows: Prescription[]) {
  return rows
    .map((row) => {
      const times = row.times.join(', ');
      const meal = row.meal ? ` · ${row.meal}` : '';
      return `- ${row.name.trim()} · ${row.dosage.trim()} · ${times}${meal} · ${row.duration.trim()}`;
    })
    .join('\n');
}

function combineNotes(
  notes: string,
  prescriptions: Prescription[],
  consultationFee: number,
  medicineFee: number,
  totalAmount: number,
) {
  const parts: string[] = [];
  const body = notes.trim();
  if (body) {
    parts.push(body);
  }

  if (prescriptions.length > 0) {
    parts.push(`Prescriptions:\n${formatPrescriptions(prescriptions)}`);
  }

  parts.push(
    `Billing:\nConsultation fee: ${formatMoney(consultationFee)}\nMedicine total fee: ${formatMoney(medicineFee)}\nTotal amount: ${formatMoney(totalAmount)}`,
  );

  return parts.join('\n\n');
}

function Chip({
  label,
  selected,
  disabled,
  onPress,
}: {
  label: string;
  selected: boolean;
  disabled?: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected, disabled }}
      disabled={disabled}
      onPress={onPress}
      style={[
        styles.chip,
        {
          backgroundColor: selected ? Palette.accent : theme.background,
          borderColor: selected ? Palette.primary : theme.border,
          opacity: disabled ? 0.55 : 1,
        },
      ]}>
      <Text style={[styles.chipLabel, { color: selected ? Palette.primary : theme.text }]}>
        {label}
      </Text>
    </Pressable>
  );
}

export function VisitScreen() {
  const theme = useTheme();
  const prescriptionId = useRef(0);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [loadingPatients, setLoadingPatients] = useState(true);
  const [patientsError, setPatientsError] = useState<string | null>(null);
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);

  const [symptoms, setSymptoms] = useState('');
  const [bloodPressure, setBloodPressure] = useState('');
  const [temperature, setTemperature] = useState('');
  const [otherVitals, setOtherVitals] = useState('');
  const [diagnosis, setDiagnosis] = useState('');
  const [notes, setNotes] = useState('');
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
  const [consultationFee, setConsultationFee] = useState('');
  const [medicineFee, setMedicineFee] = useState('');
  const medicineFeeTouched = useRef(false);

  const [fieldErrors, setFieldErrors] = useState<VisitErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const loadFormData = useCallback(async () => {
    setLoadingPatients(true);
    try {
      const [patientResult, medicineResult] = await Promise.allSettled([
        listPatients(),
        listMedicines(),
      ]);

      if (patientResult.status === 'fulfilled') {
        setPatients(patientResult.value);
        setPatientsError(null);
        setSelectedPatientId((current) =>
          current && patientResult.value.some((patient) => patient.id === current)
            ? current
            : null,
        );
      } else {
        setPatientsError(
          patientResult.reason instanceof Error
            ? patientResult.reason.message
            : 'Could not load patients.',
        );
      }

      if (medicineResult.status === 'fulfilled') {
        setMedicines(medicineResult.value);
      }
    } catch (error) {
      setPatientsError(error instanceof Error ? error.message : 'Could not load visit data.');
    } finally {
      setLoadingPatients(false);
    }
  }, []);

  const suggestedMedicineFee = useMemo(
    () => suggestedMedicineTotal(prescriptions, medicines),
    [medicines, prescriptions],
  );

  useFocusEffect(
    useCallback(() => {
      void loadFormData();
    }, [loadFormData]),
  );

  useEffect(() => {
    if (!medicineFeeTouched.current) {
      setMedicineFee(formatMoneyInput(suggestedMedicineFee));
    }
  }, [suggestedMedicineFee]);

  const consultationAmount = parseFee(consultationFee) ?? 0;
  const medicineAmount = parseFee(medicineFee) ?? 0;
  const totalAmount = consultationAmount + medicineAmount;

  function clearFieldError(field: keyof VisitErrors) {
    setFieldErrors((current) => ({ ...current, [field]: undefined }));
    setFormError(null);
  }

  function addPrescription() {
    prescriptionId.current += 1;
    setPrescriptions((current) => [...current, emptyPrescription(String(prescriptionId.current))]);
    clearFieldError('prescriptions');
  }

  function removePrescription(id: string) {
    setPrescriptions((current) => current.filter((row) => row.id !== id));
    clearFieldError('prescriptions');
  }

  function updatePrescription(id: string, patch: Partial<Prescription>) {
    setPrescriptions((current) =>
      current.map((row) => (row.id === id ? { ...row, ...patch } : row)),
    );
    clearFieldError('prescriptions');
  }

  function toggleTime(id: string, time: TimeOfDay) {
    setPrescriptions((current) =>
      current.map((row) => {
        if (row.id !== id) {
          return row;
        }
        const times = row.times.includes(time)
          ? row.times.filter((item) => item !== time)
          : [...row.times, time];
        return { ...row, times };
      }),
    );
    clearFieldError('prescriptions');
  }

  async function saveVisit() {
    const nextErrors = validateVisit({
      patientId: selectedPatientId,
      symptoms,
      bloodPressure,
      temperature,
      diagnosis,
      prescriptions,
      consultationFee,
      medicineFee,
    });
    setFieldErrors(nextErrors);
    setFormError(null);
    setMessage(null);

    if (!selectedPatientId || Object.keys(nextErrors).length > 0) {
      return;
    }

    const billedConsultation = parseFee(consultationFee) ?? 0;
    const billedMedicine = parseFee(medicineFee) ?? 0;
    const billedTotal = billedConsultation + billedMedicine;
    const patient = patients.find((item) => item.id === selectedPatientId);
    setSaving(true);
    try {
      await createMedicalRecord({
        patient_id: selectedPatientId,
        symptoms: symptoms.trim(),
        vitals: formatVitals(bloodPressure, temperature, otherVitals),
        diagnosis: diagnosis.trim(),
        notes: combineNotes(notes, prescriptions, billedConsultation, billedMedicine, billedTotal),
      });

      let billingError: string | null = null;
      if (billedTotal > 0) {
        try {
          await createTransaction({
            type: 'income',
            amount: billedTotal,
            description: 'Clinic Visit & Medicine Fee',
            occurred_on: todayIsoDate(),
          });
        } catch (error) {
          billingError = error instanceof Error ? error.message : 'Could not record the payment.';
        }
      }

      setSymptoms('');
      setBloodPressure('');
      setTemperature('');
      setOtherVitals('');
      setDiagnosis('');
      setNotes('');
      setPrescriptions([]);
      setConsultationFee('');
      setMedicineFee('');
      medicineFeeTouched.current = false;
      setMessage(`Visit recorded for ${patient?.name ?? 'the patient'}.`);
      if (billingError) {
        setFormError(`Visit saved, but the payment could not be recorded. ${billingError}`);
      }
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Could not save the visit.');
    } finally {
      setSaving(false);
    }
  }

  const inventoryOptions = medicines.map((medicine) => ({
    value: medicine.id,
    label: medicine.name,
  }));

  return (
    <ScreenScroll>
      <ScreenHeader
        title="Medical visit"
        subtitle="Select a patient and record symptoms, vitals, diagnosis, and prescriptions."
      />

      <Card>
        {patientsError ? <ErrorBanner message={patientsError} /> : null}
        <SelectField
          label="Patient"
          placeholder={
            loadingPatients
              ? 'Loading patients…'
              : patients.length === 0
                ? 'Register a patient first'
                : 'Choose patient'
          }
          value={selectedPatientId}
          options={patients.map((patient) => ({
            value: patient.id,
            label: `${patient.name} · ${patient.phone}`,
          }))}
          error={fieldErrors.patient}
          disabled={saving || loadingPatients || patients.length === 0}
          onChange={(value) => {
            setSelectedPatientId(value);
            clearFieldError('patient');
          }}
        />

        <Field
          label="Symptoms"
          value={symptoms}
          error={fieldErrors.symptoms}
          editable={!saving}
          multiline
          placeholder="Fever, cough, headache"
          onChangeText={(value) => {
            setSymptoms(value);
            clearFieldError('symptoms');
          }}
        />
        <Field
          label="Blood pressure"
          value={bloodPressure}
          error={fieldErrors.bloodPressure}
          editable={!saving}
          autoCapitalize="none"
          placeholder="120/80"
          onChangeText={(value) => {
            setBloodPressure(value);
            clearFieldError('bloodPressure');
          }}
        />
        <Field
          label="Temperature"
          value={temperature}
          error={fieldErrors.temperature}
          editable={!saving}
          keyboardType="decimal-pad"
          placeholder="36.8"
          onChangeText={(value) => {
            setTemperature(value.replace(/[^\d.]/g, ''));
            clearFieldError('temperature');
          }}
        />
        <Field
          label="Other vitals"
          value={otherVitals}
          editable={!saving}
          multiline
          placeholder="Pulse, weight, oxygen saturation"
          onChangeText={setOtherVitals}
        />
        <Field
          label="Diagnosis"
          value={diagnosis}
          error={fieldErrors.diagnosis}
          editable={!saving}
          multiline
          placeholder="Diagnosis"
          onChangeText={(value) => {
            setDiagnosis(value);
            clearFieldError('diagnosis');
          }}
        />
        <Field
          label="Notes"
          value={notes}
          editable={!saving}
          multiline
          placeholder="Optional notes"
          onChangeText={setNotes}
        />

        <View style={styles.section}>
          <SectionTitle>Prescriptions</SectionTitle>
          {prescriptions.length === 0 ? (
            <Text style={[styles.hint, { color: theme.textSecondary }]}>
              Add medicines, dosage, timing, and duration.
            </Text>
          ) : null}

          {prescriptions.map((row, index) => (
            <View
              key={row.id}
              style={[
                styles.rxCard,
                { backgroundColor: theme.background, borderColor: theme.border },
              ]}>
              <View style={styles.rxHeader}>
                <Text style={[styles.rxTitle, { color: theme.text }]}>Medicine {index + 1}</Text>
                <IconButton
                  name="trash-outline"
                  accessibilityLabel={`Remove medicine ${index + 1}`}
                  onPress={() => removePrescription(row.id)}
                />
              </View>

              <ComboField
                label="Medicine name"
                placeholder="Select or type a medicine"
                value={row.name}
                options={inventoryOptions}
                disabled={saving}
                onChange={(value) => updatePrescription(row.id, { name: value })}
              />
              <Field
                label="Dosage"
                value={row.dosage}
                editable={!saving}
                placeholder="1 tablet, 5ml"
                onChangeText={(value) => updatePrescription(row.id, { dosage: value })}
              />

              <Text style={[styles.label, { color: theme.text }]}>Timing</Text>
              <View style={styles.chips}>
                {TIMES_OF_DAY.map((time) => (
                  <Chip
                    key={time}
                    label={time}
                    selected={row.times.includes(time)}
                    disabled={saving}
                    onPress={() => toggleTime(row.id, time)}
                  />
                ))}
              </View>
              <View style={styles.chips}>
                {MEAL_TIMES.map((meal) => (
                  <Chip
                    key={meal}
                    label={meal}
                    selected={row.meal === meal}
                    disabled={saving}
                    onPress={() =>
                      updatePrescription(row.id, { meal: row.meal === meal ? null : meal })
                    }
                  />
                ))}
              </View>

              <Field
                label="Duration"
                value={row.duration}
                editable={!saving}
                placeholder="5 days, 7 days"
                onChangeText={(value) => updatePrescription(row.id, { duration: value })}
              />
            </View>
          ))}

          {fieldErrors.prescriptions ? <ErrorBanner message={fieldErrors.prescriptions} /> : null}

          <Pressable
            accessibilityRole="button"
            disabled={saving}
            onPress={addPrescription}
            style={({ pressed }) => [
              styles.addMedicine,
              { borderColor: Palette.primary, opacity: saving ? 0.55 : pressed ? 0.8 : 1 },
            ]}>
            <Ionicons name="add" size={20} color={Palette.primary} />
            <Text style={styles.addMedicineLabel}>Add Medicine</Text>
          </Pressable>
        </View>

        <View style={styles.section}>
          <SectionTitle>Billing / Fee collection</SectionTitle>
          <View
            style={[
              styles.billingCard,
              { backgroundColor: theme.background, borderColor: theme.border },
            ]}>
            <Field
              label="Consultation fee"
              value={consultationFee}
              error={fieldErrors.consultationFee}
              editable={!saving}
              keyboardType="decimal-pad"
              placeholder="0.00"
              onChangeText={(value) => {
                setConsultationFee(value.replace(/[^\d.]/g, ''));
                clearFieldError('consultationFee');
              }}
            />
            <Field
              label="Medicine total fee"
              value={medicineFee}
              error={fieldErrors.medicineFee}
              editable={!saving}
              keyboardType="decimal-pad"
              placeholder="0.00"
              onChangeText={(value) => {
                medicineFeeTouched.current = true;
                setMedicineFee(value.replace(/[^\d.]/g, ''));
                clearFieldError('medicineFee');
              }}
            />
            <View style={[styles.totalRow, { borderTopColor: theme.border }]}>
              <Text style={[styles.totalLabel, { color: theme.text }]}>Total amount</Text>
              <Text style={styles.totalValue}>{formatMoney(totalAmount)}</Text>
            </View>
          </View>
        </View>

        {formError ? <ErrorBanner message={formError} /> : null}
        {message ? <SuccessBanner message={message} /> : null}
        <PrimaryButton
          label="Save visit"
          loading={saving}
          disabled={patients.length === 0}
          onPress={() => {
            void saveVisit();
          }}
        />
      </Card>
    </ScreenScroll>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: Spacing.three,
  },
  hint: {
    fontSize: 14,
    lineHeight: 20,
  },
  rxCard: {
    borderRadius: Radius.md,
    borderWidth: 1,
    gap: Spacing.three,
    padding: Spacing.three,
  },
  rxHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  rxTitle: {
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 22,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  chip: {
    borderRadius: Radius.pill,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  chipLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
  addMedicine: {
    alignItems: 'center',
    borderRadius: Radius.sm,
    borderWidth: 1.5,
    flexDirection: 'row',
    gap: Spacing.two,
    justifyContent: 'center',
    minHeight: 48,
  },
  addMedicineLabel: {
    color: Palette.primary,
    fontSize: 16,
    fontWeight: '700',
  },
  billingCard: {
    borderRadius: Radius.md,
    borderWidth: 1,
    gap: Spacing.three,
    overflow: 'hidden',
    padding: Spacing.three,
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
    lineHeight: 22,
  },
  totalValue: {
    color: Palette.primary,
    fontSize: 22,
    fontWeight: '700',
    lineHeight: 28,
  },
});
