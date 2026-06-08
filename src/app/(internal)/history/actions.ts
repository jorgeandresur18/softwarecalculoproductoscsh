'use server';

import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { getCurrentUser } from '@/lib/auth';

// ── Tipos exportados ──────────────────────────────────────────────────────────

export type CalculationRow = {
  id:                string;
  patient_reference: string | null;
  patient_city:      string | null;
  symptoms_text:     string | null;
  subtotal_products: number;
  discount_amount:   number;
  final_price:       number;
  observations:      string | null;
  created_by:        string | null;
  created_at:        string;
};

export type CalculationItemRow = {
  id:                    string;
  calculation_id:        string;
  product_id:            string | null;
  product_name_snapshot: string;
  quantity:              number;
  unit_price:            number;
  total_price:           number;
};

// ── Queries ───────────────────────────────────────────────────────────────────

export async function getCalculations(): Promise<{
  data?: CalculationRow[];
  error?: string;
}> {
  const user = await getCurrentUser();
  if (!user) return { error: 'No autenticado' };

  const { data, error } = await supabaseAdmin
    .from('calculations')
    .select(
      'id, patient_reference, patient_city, symptoms_text, subtotal_products, discount_amount, final_price, observations, created_by, created_at',
    )
    .order('created_at', { ascending: false });

  if (error) return { error: error.message };
  return { data: (data ?? []) as CalculationRow[] };
}

export async function getCalculationItems(calculationId: string): Promise<{
  data?: CalculationItemRow[];
  error?: string;
}> {
  const user = await getCurrentUser();
  if (!user) return { error: 'No autenticado' };

  const { data, error } = await supabaseAdmin
    .from('calculation_items')
    .select('id, calculation_id, product_id, product_name_snapshot, quantity, unit_price, total_price')
    .eq('calculation_id', calculationId)
    .order('product_name_snapshot', { ascending: true });

  if (error) return { error: error.message };
  return { data: (data ?? []) as CalculationItemRow[] };
}
