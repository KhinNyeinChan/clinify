import { supabase } from '@/services/supabase';

export type PurchasePaymentStatus = 'Paid' | 'Pending' | 'Partial';

export type PurchasePackType = 'box' | 'unit';

export type PurchaseItemInput = {
  medicineId: string;
  packType: PurchasePackType;
  quantity: number;
  originalPrice: number;
  salePrice: number;
  batchNumber: string;
  expiryDate: string;
};

export type NewMedicinePurchase = {
  supplierId: string;
  purchaseDate: string;
  paymentAmount: number;
  paymentStatus: PurchasePaymentStatus;
  items: PurchaseItemInput[];
};

function purchasePayload(purchase: NewMedicinePurchase) {
  return {
    p_supplier_id: purchase.supplierId,
    p_purchase_date: purchase.purchaseDate,
    p_payment_amount: purchase.paymentAmount,
    p_payment_status: purchase.paymentStatus,
    p_items: purchase.items.map((item) => ({
      medicine_id: item.medicineId,
      pack_type: item.packType,
      quantity: item.quantity,
      original_price: item.originalPrice,
      sale_price: item.salePrice,
      batch_number: item.batchNumber,
      expiry_date: item.expiryDate,
    })),
  };
}

export async function createMedicinePurchase(purchase: NewMedicinePurchase): Promise<string> {
  const { data, error } = await supabase.rpc('create_medicine_purchase', purchasePayload(purchase));

  if (error) {
    throw new Error(error.message);
  }

  return String(data ?? '');
}

export async function updateMedicinePurchase(id: string, purchase: NewMedicinePurchase): Promise<string> {
  const { data, error } = await supabase.rpc('update_medicine_purchase', {
    p_purchase_id: id,
    ...purchasePayload(purchase),
  });

  if (error) {
    throw new Error(error.message);
  }

  return String(data ?? '');
}

export async function deleteMedicinePurchase(id: string): Promise<void> {
  const { error } = await supabase.rpc('delete_medicine_purchase', { p_purchase_id: id });

  if (error) {
    throw new Error(error.message);
  }
}

export type MedicinePurchase = {
  id: string;
  supplier_id: string;
  purchase_date: string;
  total_amount: number;
  payment_amount: number;
  payment_status: PurchasePaymentStatus;
};

export async function listMedicinePurchases(): Promise<MedicinePurchase[]> {
  const { data, error } = await supabase
    .from('medicine_purchases')
    .select('id, supplier_id, purchase_date, total_amount, payment_amount, payment_status')
    .order('purchase_date', { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []).map((row) => {
    const purchase = row as MedicinePurchase;
    const status = purchase.payment_status;
    return {
      ...purchase,
      id: String(purchase.id),
      supplier_id: String(purchase.supplier_id),
      purchase_date: String(purchase.purchase_date).slice(0, 10),
      total_amount: Number(purchase.total_amount),
      payment_amount: Number(purchase.payment_amount),
      payment_status: status === 'Paid' || status === 'Partial' ? status : 'Pending',
    };
  });
}

type PurchaseItemRow = {
  medicine_id: string;
  quantity: number;
  unit_price: number;
  pack_type?: string | null;
  base_quantity?: number | null;
};

type PurchaseBatchRow = {
  medicine_id: string;
  batch_number: string;
  expiry_date: string;
  quantity: number;
  sale_price?: number | null;
};

function isMissingColumn(message: string) {
  return /does not exist|schema cache|could not find/i.test(message);
}

export async function getMedicinePurchase(id: string): Promise<MedicinePurchase & { items: PurchaseItemInput[] }> {
  const { data, error } = await supabase
    .from('medicine_purchases')
    .select('id, supplier_id, purchase_date, total_amount, payment_amount, payment_status')
    .eq('id', id)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    throw new Error('This purchase voucher could not be found.');
  }

  const purchase = data as MedicinePurchase;
  const fullItems = await supabase
    .from('medicine_purchase_items')
    .select('medicine_id, quantity, unit_price, pack_type, base_quantity')
    .eq('purchase_id', id);
  const itemResult =
    fullItems.error && isMissingColumn(fullItems.error.message)
      ? await supabase.from('medicine_purchase_items').select('medicine_id, quantity, unit_price').eq('purchase_id', id)
      : fullItems;

  if (itemResult.error) {
    throw new Error(itemResult.error.message);
  }

  const fullBatches = await supabase
    .from('medicine_batches')
    .select('medicine_id, batch_number, expiry_date, quantity, sale_price')
    .eq('purchase_id', id);
  const batchResult =
    fullBatches.error && isMissingColumn(fullBatches.error.message)
      ? await supabase
          .from('medicine_batches')
          .select('medicine_id, batch_number, expiry_date, quantity')
          .eq('purchase_id', id)
      : fullBatches;

  if (batchResult.error) {
    throw new Error(batchResult.error.message);
  }

  const batches = ((batchResult.data ?? []) as unknown as PurchaseBatchRow[]).map((batch) => ({ ...batch }));
  const items = ((itemResult.data ?? []) as unknown as PurchaseItemRow[]).map((item) => {
    const baseQuantity = Number(item.base_quantity ?? item.quantity);
    const matchIndex = batches.findIndex(
      (batch) => String(batch.medicine_id) === String(item.medicine_id) && Number(batch.quantity) === baseQuantity,
    );
    const batch = matchIndex >= 0 ? batches.splice(matchIndex, 1)[0] : undefined;
    const packType = item.pack_type === 'box' ? 'box' : 'unit';
    return {
      medicineId: String(item.medicine_id),
      packType,
      quantity: Number(item.quantity),
      originalPrice: Number(item.unit_price),
      salePrice: Number(batch?.sale_price ?? 0),
      batchNumber: batch?.batch_number ?? '',
      expiryDate: batch?.expiry_date ? String(batch.expiry_date).slice(0, 10) : '',
    } satisfies PurchaseItemInput;
  });

  const status = purchase.payment_status;
  return {
    ...purchase,
    id: String(purchase.id),
    supplier_id: String(purchase.supplier_id),
    purchase_date: String(purchase.purchase_date).slice(0, 10),
    total_amount: Number(purchase.total_amount),
    payment_amount: Number(purchase.payment_amount),
    payment_status: status === 'Paid' || status === 'Partial' ? status : 'Pending',
    items,
  };
}
