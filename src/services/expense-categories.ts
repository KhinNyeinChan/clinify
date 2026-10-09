import { supabase } from '@/services/supabase';

export type ExpenseCategory = {
  id: string;
  name: string;
};

export async function listExpenseCategories(): Promise<ExpenseCategory[]> {
  const active = await supabase
    .from('expense_categories')
    .select('id, name')
    .eq('is_active', true)
    .order('name', { ascending: true });

  if (!active.error) {
    return (active.data ?? []) as ExpenseCategory[];
  }

  if (!/is_active|schema cache|could not find|column/i.test(active.error.message)) {
    throw new Error(active.error.message);
  }

  const { data, error } = await supabase
    .from('expense_categories')
    .select('id, name')
    .order('name', { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as ExpenseCategory[];
}

export async function createExpenseCategory(name: string): Promise<ExpenseCategory> {
  const trimmed = name.trim();
  if (!trimmed) {
    throw new Error('Enter a category name.');
  }

  const created = await supabase
    .from('expense_categories')
    .insert({ name: trimmed })
    .select('id, name')
    .single();

  if (!created.error) {
    return created.data as ExpenseCategory;
  }

  if (!/duplicate|unique/i.test(created.error.message)) {
    throw new Error(created.error.message);
  }

  const existing = await listExpenseCategories();
  const match = existing.find((category) => category.name.toLowerCase() === trimmed.toLowerCase());
  if (match) {
    return match;
  }

  throw new Error(created.error.message);
}

export async function deleteExpenseCategory(id: string): Promise<void> {
  const { error } = await supabase.from('expense_categories').delete().eq('id', id);

  if (error) {
    throw new Error(error.message);
  }
}

export async function updateExpenseCategory(id: string, name: string): Promise<ExpenseCategory> {
  const trimmed = name.trim();
  if (!trimmed) {
    throw new Error('Enter a category name.');
  }

  const updated = await supabase
    .from('expense_categories')
    .update({ name: trimmed })
    .eq('id', id)
    .select('id, name')
    .single();

  if (!updated.error) {
    return updated.data as ExpenseCategory;
  }

  if (!/duplicate|unique/i.test(updated.error.message)) {
    throw new Error(updated.error.message);
  }

  throw new Error('A category with this name already exists.');
}
