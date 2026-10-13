import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';

import {
  DatePickerField,
  ErrorBanner,
  AmountField,
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
import { listSuppliers, type Supplier } from '@/services/suppliers';
import {
  createTransaction,
  getTransaction,
  updateTransaction,
  type TransactionKind,
} from '@/services/transactions';
import { useI18n } from '@/constants/i18n';

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const FORM_ACCENT = '#ED1B2E';
const FORM_ACCENT_FILL = '#fde7e9';
const NO_SUPPLIER = '__none__';

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

function validateTransaction(
  values: {
    description: string;
    amount: string;
    date: string;
    type: TransactionKind | null;
    categoryId: string | null;
  },
  copy: ReturnType<typeof useI18n>['transaction'],
): TransactionErrors {
  const errors: TransactionErrors = {};
  const amount = Number(values.amount);

  if (values.type === 'income' && !values.description.trim()) {
    errors.description = copy.descriptionError;
  }

  if (values.type === 'expense' && !values.categoryId) {
    errors.category = copy.categoryError;
  }

  if (!values.amount.trim()) {
    errors.amount = copy.amountError;
  } else if (!Number.isFinite(amount) || amount <= 0) {
    errors.amount = copy.amountInvalid;
  }

  if (!values.date.trim()) {
    errors.date = copy.dateError;
  } else if (!isRealDate(values.date)) {
    errors.date = copy.dateInvalid;
  }

  if (!values.type) {
    errors.type = copy.typeError;
  }

  return errors;
}

export function TransactionAddScreen() {
  const copy = useI18n().transaction;
  const common = useI18n().common;
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
  const [supplierId, setSupplierId] = useState<string | null>(null);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [fieldErrors, setFieldErrors] = useState<TransactionErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [loadingRecord, setLoadingRecord] = useState(isEditing);
  const [loadingCategories, setLoadingCategories] = useState(true);
  const [saving, setSaving] = useState(false);

  const loadCategories = useCallback(async () => {
    setLoadingCategories(true);
    try {
      const [categoryRows, supplierRows] = await Promise.all([
        listExpenseCategories(),
        listSuppliers().catch(() => [] as Supplier[]),
      ]);
      setCategories(categoryRows);
      setSuppliers(supplierRows);
    } catch (error) {
      setFormError(
        error instanceof Error
          ? error.message
          : copy.categoriesError,
      );
    } finally {
      setLoadingCategories(false);
    }
  }, [copy.categoriesError]);

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
        setSupplierId(transaction.supplier_id ?? null);
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
  }, [recordId, requestedType]);

  function clearFieldError(field: keyof TransactionErrors) {
    setFieldErrors((current) => ({ ...current, [field]: undefined }));
    setFormError(null);
  }

  async function saveTransaction() {
    const nextErrors = validateTransaction(
      {
        description,
        amount,
        date: occurredOn,
        type: kind,
        categoryId,
      },
      copy,
    );
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
        (kind === 'expense' ? copy.expense : copy.income),
      occurred_on: occurredOn,
      category_id: kind === 'expense' ? categoryId : null,
      supplier_id: kind === 'expense' ? supplierId : null,
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
            ? copy.updateError
            : copy.saveError,
      );
    } finally {
      setSaving(false);
    }
  }

  const title = isEditing
    ? kind === 'expense'
      ? copy.editExpense
      : copy.editIncome
    : kind === 'expense'
      ? copy.addExpense
      : copy.addIncome;

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
            label={copy.type}
            required
            placeholder={copy.chooseType}
            value={kind}
            options={[
              { value: 'income', label: copy.income },
              { value: 'expense', label: copy.expense },
            ]}
            error={fieldErrors.type}
            disabled={saving}
            {...selectAccent}
            onChange={(value) => {
              const nextKind = asKind(value);
              setKind(nextKind);
              if (nextKind === 'income') {
                setCategoryId(null);
                setSupplierId(null);
              }
              clearFieldError('type');
              clearFieldError('category');
            }}
          />
          {kind === 'expense' ? (
            <SelectField
              label={common.category}
              required
              placeholder={
                loadingCategories
                  ? copy.loadingCategories
                  : categories.length === 0
                    ? copy.addCategory
                    : copy.chooseCategory
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
          {kind === 'expense' ? (
            <SelectField
              label={copy.supplierOptional}
              placeholder={
                loadingCategories
                  ? copy.loadingSuppliers
                  : suppliers.length === 0
                    ? copy.noSuppliers
                    : copy.chooseSupplier
              }
              value={supplierId}
              options={[
                { value: NO_SUPPLIER, label: copy.noSupplier },
                ...suppliers.map((supplier) => ({
                  value: supplier.id,
                  label: supplier.name,
                })),
              ]}
              disabled={saving || loadingCategories}
              {...selectAccent}
              onChange={(value) => setSupplierId(value === NO_SUPPLIER ? null : value)}
            />
          ) : null}
          <Field
            label={common.description}
            required={kind === 'income'}
            value={description}
            error={fieldErrors.description}
            editable={!saving}
            placeholder={kind === 'expense' ? copy.expenseNote : copy.incomeNote}
            onChangeText={(value) => {
              setDescription(value);
              clearFieldError('description');
            }}
          />
          <AmountField
            label={common.amount}
            required
            value={amount}
            error={fieldErrors.amount}
            editable={!saving}
            onChangeText={(value) => {
              setAmount(value);
              clearFieldError('amount');
            }}
          />
          <DatePickerField
            label={common.date}
            required
            placeholder={common.chooseDate}
            value={occurredOn}
            error={fieldErrors.date}
            disabled={saving}
            onChange={(value) => {
              setOccurredOn(value);
              clearFieldError('date');
            }}
          />
          {formError ? <ErrorBanner message={formError} /> : null}
          <PrimaryButton
            label={isEditing ? common.save : kind === 'expense' ? copy.addExpense : copy.addIncome}
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
