import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';

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
import {
  createExpenseCategory,
  deleteExpenseCategory,
  listExpenseCategories,
  updateExpenseCategory,
  type ExpenseCategory,
} from '@/services/expense-categories';
import {
  createTransaction,
  getTransaction,
  updateTransaction,
  type TransactionKind,
} from '@/services/transactions';

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const FORM_ACCENT = '#ED1B2E';
const FORM_ACCENT_FILL = '#fde7e9';

type TransactionErrors = {
  description?: string;
  amount?: string;
  date?: string;
  type?: string;
  category?: string;
};

function todayIsoDate() {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}

function isRealDate(value: string) {
  if (!DATE_PATTERN.test(value)) {
    return false;
  }

  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
}

function asKind(value: string | undefined): TransactionKind {
  return value === 'expense' ? 'expense' : 'income';
}

function validateTransaction(values: {
  description: string;
  amount: string;
  date: string;
  type: TransactionKind | null;
  categoryId: string | null;
}): TransactionErrors {
  const errors: TransactionErrors = {};
  const amount = Number(values.amount);

  if (values.type === 'income' && !values.description.trim()) {
    errors.description = 'Enter a description.';
  }

  if (values.type === 'expense' && !values.categoryId) {
    errors.category = 'Select an expense category.';
  }

  if (!values.amount.trim()) {
    errors.amount = 'Enter an amount.';
  } else if (!Number.isFinite(amount) || amount <= 0) {
    errors.amount = 'Enter an amount greater than 0.';
  }

  if (!values.date.trim()) {
    errors.date = 'Enter a date.';
  } else if (!isRealDate(values.date)) {
    errors.date = 'Use a real date in YYYY-MM-DD format.';
  }

  if (!values.type) {
    errors.type = 'Select income or expense.';
  }

  return errors;
}

export function TransactionAddScreen() {
  const params = useLocalSearchParams<{ id?: string | string[]; type?: string | string[] }>();
  const recordId = firstSearchParam(params.id);
  const requestedType = asKind(firstSearchParam(params.type));
  const isEditing = Boolean(recordId);
  const [kind, setKind] = useState<TransactionKind>(requestedType);
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [occurredOn, setOccurredOn] = useState(todayIsoDate);
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const [fieldErrors, setFieldErrors] = useState<TransactionErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [loadingRecord, setLoadingRecord] = useState(isEditing);
  const [loadingCategories, setLoadingCategories] = useState(true);
  const [saving, setSaving] = useState(false);

  const loadCategories = useCallback(async () => {
    setLoadingCategories(true);
    try {
      const rows = await listExpenseCategories();
      setCategories(rows);
    } catch (error) {
      setFormError(
        error instanceof Error
          ? error.message
          : 'Could not load expense categories. Run the SQL setup script in Supabase.',
      );
    } finally {
      setLoadingCategories(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadCategories();
    }, [loadCategories]),
  );

  useEffect(() => {
    if (!recordId) {
      setKind(requestedType);
      return;
    }

    let active = true;
    setLoadingRecord(true);
    getTransaction(recordId)
      .then((transaction) => {
        if (!active) {
          return;
        }
        setKind(transaction.type);
        setDescription(transaction.description);
        setAmount(
          Number.isInteger(transaction.amount)
            ? String(transaction.amount)
            : transaction.amount.toFixed(2),
        );
        setOccurredOn(transaction.occurred_on);
        setCategoryId(transaction.category_id ?? null);
        setFormError(null);
      })
      .catch((error) => {
        if (active) {
          setFormError(error instanceof Error ? error.message : 'Could not load the record.');
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
  }, [recordId, requestedType]);

  function clearFieldError(field: keyof TransactionErrors) {
    setFieldErrors((current) => ({ ...current, [field]: undefined }));
    setFormError(null);
  }

  async function saveTransaction() {
    const nextErrors = validateTransaction({
      description,
      amount,
      date: occurredOn,
      type: kind,
      categoryId,
    });
    setFieldErrors(nextErrors);
    setFormError(null);

    if (Object.keys(nextErrors).length > 0) {
      return;
    }

    const selectedCategory = categories.find((category) => category.id === categoryId);
    const payload = {
      type: kind,
      amount: Number(amount),
      description:
        description.trim() ||
        selectedCategory?.name ||
        (kind === 'expense' ? 'Expense' : 'Income'),
      occurred_on: occurredOn,
      category_id: kind === 'expense' ? categoryId : null,
    };

    setSaving(true);
    try {
      if (recordId) {
        await updateTransaction(recordId, payload);
      } else {
        await createTransaction(payload);
      }
      router.back();
    } catch (error) {
      setFormError(
        error instanceof Error
          ? error.message
          : isEditing
            ? 'Could not update the record.'
            : 'Could not save the record.',
      );
    } finally {
      setSaving(false);
    }
  }

  const title = isEditing
    ? kind === 'expense'
      ? 'Edit expense'
      : 'Edit income'
    : kind === 'expense'
      ? 'Add expense'
      : 'Add income';

  const selectAccent = {
    highlightColor: FORM_ACCENT,
    highlightBackground: FORM_ACCENT_FILL,
  };

  return (
    <ScreenScroll withTabBar={false}>
      <ScreenNavHeader title={title} onBack={() => router.back()} />
      {loadingRecord ? (
        <LoadingMark />
      ) : (
        <>
          <SelectField
            label="Type"
            placeholder="Choose type"
            value={kind}
            options={[
              { value: 'income', label: 'Income' },
              { value: 'expense', label: 'Expense' },
            ]}
            error={fieldErrors.type}
            disabled={saving}
            {...selectAccent}
            onChange={(value) => {
              const nextKind = asKind(value);
              setKind(nextKind);
              if (nextKind === 'income') {
                setCategoryId(null);
              }
              clearFieldError('type');
              clearFieldError('category');
            }}
          />
          {kind === 'expense' ? (
            <SelectField
              label="Category"
              placeholder={
                loadingCategories
                  ? 'Loading categories…'
                  : categories.length === 0
                    ? 'Add a category'
                    : 'Choose category'
              }
              value={categoryId}
              options={categories.map((category) => ({
                value: category.id,
                label: category.name,
              }))}
              error={fieldErrors.category}
              disabled={saving || loadingCategories}
              {...selectAccent}
              onChange={(value) => {
                setCategoryId(value);
                clearFieldError('category');
              }}
              onCreate={async (name) => {
                const created = await createExpenseCategory(name);
                setCategories((current) => {
                  if (current.some((category) => category.id === created.id)) {
                    return current;
                  }
                  return [...current, created].sort((a, b) => a.name.localeCompare(b.name));
                });
                return { value: created.id, label: created.name };
              }}
              onUpdate={async (id, name) => {
                const updated = await updateExpenseCategory(id, name);
                setCategories((current) =>
                  current
                    .map((category) => (category.id === updated.id ? updated : category))
                    .sort((a, b) => a.name.localeCompare(b.name)),
                );
                return { value: updated.id, label: updated.name };
              }}
              onRemove={async (id) => {
                await deleteExpenseCategory(id);
                setCategories((current) => current.filter((category) => category.id !== id));
                setCategoryId((current) => (current === id ? null : current));
              }}
            />
          ) : null}
          <Field
            label="Description"
            value={description}
            error={fieldErrors.description}
            editable={!saving}
            placeholder={
              kind === 'expense' ? 'Optional note' : 'Visit fee, medicine sale'
            }
            onChangeText={(value) => {
              setDescription(value);
              clearFieldError('description');
            }}
          />
          <Field
            label="Amount"
            value={amount}
            error={fieldErrors.amount}
            editable={!saving}
            keyboardType="decimal-pad"
            placeholder="0.00"
            onChangeText={(value) => {
              setAmount(value.replace(/[^\d.]/g, ''));
              clearFieldError('amount');
            }}
          />
          <Field
            label="Date"
            value={occurredOn}
            error={fieldErrors.date}
            editable={!saving}
            autoCapitalize="none"
            placeholder="YYYY-MM-DD"
            onChangeText={(value) => {
              setOccurredOn(value);
              clearFieldError('date');
            }}
          />
          {formError ? <ErrorBanner message={formError} /> : null}
          <PrimaryButton
            label={isEditing ? 'Save' : kind === 'expense' ? 'Add expense' : 'Add income'}
            loading={saving}
            onPress={() => {
              void saveTransaction();
            }}
          />
        </>
      )}
    </ScreenScroll>
  );
}
