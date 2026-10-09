import { supabase } from '@/services/supabase';

export type TransactionKind = 'income' | 'expense';

export type NewTransaction = {
  type: TransactionKind;
  amount: number;
  description: string;
  occurred_on: string;
  category_id?: string | null;
};

export type ClinicTransaction = NewTransaction & {
  id: string;
  category_name?: string | null;
};

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const FULL_SELECT =
  'id, amount, type, description, occurred_on, category_id, expense_categories(name)';
const DETAIL_SELECT = 'id, amount, type, description, occurred_on, category_id';
const BASIC_SELECT = 'id, amount';

function isMissingColumn(message: string) {
  return /type|description|occurred_on|category_id|expense_categories|schema cache|could not find|column|relationship/i.test(
    message,
  );
}

function asNumber(value: unknown) {
  const amount = Number(value ?? 0);
  return Number.isFinite(amount) ? amount : 0;
}

function todayIsoDate() {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}

function inferType(row: { type?: string | null; amount?: unknown }): TransactionKind {
  if (row.type === 'expense' || row.type === 'income') {
    return row.type;
  }
  return asNumber(row.amount) < 0 ? 'expense' : 'income';
}

function relatedCategoryName(value: unknown): string | null {
  if (Array.isArray(value)) {
    const name = (value[0] as { name?: string } | undefined)?.name;
    return name?.trim() || null;
  }

  if (value && typeof value === 'object' && 'name' in value) {
    const name = (value as { name?: string }).name;
    return name?.trim() || null;
  }

  return null;
}

function asTransaction(row: {
  id: string;
  amount?: unknown;
  type?: string | null;
  description?: string | null;
  occurred_on?: string | null;
  created_at?: string | null;
  category_id?: string | null;
  category?: string | null;
  expense_categories?: unknown;
}): ClinicTransaction {
  const type = inferType(row);
  const occurred = String(row.occurred_on || row.created_at || '').slice(0, 10);

  return {
    id: row.id,
    type,
    amount: Math.abs(asNumber(row.amount)),
    description: (row.description ?? '').trim() || (type === 'income' ? 'Income' : 'Expense'),
    occurred_on: DATE_PATTERN.test(occurred) ? occurred : todayIsoDate(),
    category_id: row.category_id ?? null,
    category_name: relatedCategoryName(row.expense_categories) ?? row.category?.trim() ?? null,
  };
}

function fullPayload(transaction: NewTransaction) {
  return {
    type: transaction.type,
    amount: Math.abs(transaction.amount),
    description: transaction.description,
    occurred_on: transaction.occurred_on,
    category_id: transaction.type === 'expense' ? transaction.category_id || null : null,
  };
}

function detailPayload(transaction: NewTransaction) {
  return {
    type: transaction.type,
    amount: Math.abs(transaction.amount),
    description: transaction.description,
    occurred_on: transaction.occurred_on,
  };
}

function basicPayload(transaction: NewTransaction) {
  return {
    amount: transaction.type === 'expense' ? -Math.abs(transaction.amount) : Math.abs(transaction.amount),
  };
}

async function mapRows(rows: unknown[] | null) {
  return (rows ?? []).map((row) => parseTransaction(row));
}

function parseTransaction(row: unknown, extra?: { category_id?: string | null }) {
  const data = (row ?? {}) as Record<string, unknown>;
  return asTransaction({
    id: String(data.id ?? ''),
    amount: data.amount,
    type: data.type as string | null | undefined,
    description: data.description as string | null | undefined,
    occurred_on: data.occurred_on as string | null | undefined,
    created_at: data.created_at as string | null | undefined,
    category_id: extra?.category_id ?? (data.category_id as string | null | undefined) ?? null,
    category: data.category as string | null | undefined,
    expense_categories: data.expense_categories,
  });
}

export async function listTransactions(): Promise<ClinicTransaction[]> {
  const attempts = [
    FULL_SELECT,
    DETAIL_SELECT,
    'id, amount, type, description, occurred_on',
    BASIC_SELECT,
  ];

  for (const columns of attempts) {
    const result = await supabase
      .from('transactions')
      .select(columns)
      .order('occurred_on', { ascending: false });

    if (!result.error) {
      return mapRows(result.data as unknown[]);
    }

    if (!isMissingColumn(result.error.message)) {
      throw new Error(result.error.message);
    }
  }

  throw new Error('Could not load transactions.');
}

export async function getTransaction(id: string): Promise<ClinicTransaction> {
  const attempts = [
    FULL_SELECT,
    DETAIL_SELECT,
    'id, amount, type, description, occurred_on',
    BASIC_SELECT,
  ];

  for (const columns of attempts) {
    const result = await supabase.from('transactions').select(columns).eq('id', id).single();

    if (!result.error) {
      return parseTransaction(result.data);
    }

    if (!isMissingColumn(result.error.message)) {
      throw new Error(result.error.message);
    }
  }

  throw new Error('Could not load the transaction.');
}

export async function createTransaction(transaction: NewTransaction): Promise<ClinicTransaction> {
  const attempts = [
    { payload: fullPayload(transaction), select: FULL_SELECT },
    { payload: detailPayload(transaction), select: DETAIL_SELECT },
    { payload: basicPayload(transaction), select: BASIC_SELECT },
  ];

  for (const attempt of attempts) {
    const result = await supabase
      .from('transactions')
      .insert(attempt.payload)
      .select(attempt.select)
      .single();

    if (!result.error) {
      return parseTransaction(result.data, { category_id: transaction.category_id });
    }

    if (!isMissingColumn(result.error.message)) {
      throw new Error(result.error.message);
    }
  }

  throw new Error('Could not save the transaction.');
}

export async function updateTransaction(
  id: string,
  transaction: NewTransaction,
): Promise<ClinicTransaction> {
  const attempts = [
    { payload: fullPayload(transaction), select: FULL_SELECT },
    { payload: detailPayload(transaction), select: DETAIL_SELECT },
    { payload: basicPayload(transaction), select: BASIC_SELECT },
  ];

  for (const attempt of attempts) {
    const result = await supabase
      .from('transactions')
      .update(attempt.payload)
      .eq('id', id)
      .select(attempt.select)
      .single();

    if (!result.error) {
      return parseTransaction(result.data, { category_id: transaction.category_id });
    }

    if (!isMissingColumn(result.error.message)) {
      throw new Error(result.error.message);
    }
  }

  throw new Error('Could not update the transaction.');
}

export async function deleteTransaction(id: string): Promise<void> {
  const { error } = await supabase.from('transactions').delete().eq('id', id);

  if (error) {
    throw new Error(error.message);
  }
}

export function summarizeTransactions(rows: ClinicTransaction[]) {
  const income = rows
    .filter((row) => row.type === 'income')
    .reduce((total, row) => total + row.amount, 0);
  const expense = rows
    .filter((row) => row.type === 'expense')
    .reduce((total, row) => total + row.amount, 0);

  return {
    income,
    expense,
    profit: income - expense,
  };
}

export async function sumRevenue(): Promise<number> {
  try {
    const rows = await listTransactions();
    return summarizeTransactions(rows).income;
  } catch {
    return 0;
  }
}
