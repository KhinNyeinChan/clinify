/**
 * Tables already created in Supabase.
 * Replace this file with generated types once the column shapes are stable:
 * npx supabase gen types typescript --project-id <project-ref> --schema public > src/types/database.ts
 */
export const clinicTables = {
  patients: 'patients',
  appointments: 'appointments',
  medicalRecords: 'medical_records',
  suppliers: 'suppliers',
  medicines: 'medicines',
  transactions: 'transactions',
  expenseCategories: 'expense_categories',
} as const;

export type ClinicTableName = (typeof clinicTables)[keyof typeof clinicTables];
