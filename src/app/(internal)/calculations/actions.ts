'use server';

import { revalidatePath } from 'next/cache';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { getCurrentUser, getUserProfile } from '@/lib/auth';
import type { RecommendationLevel } from '@/types/database';

// ── Tipos exportados ──────────────────────────────────────────────────────────

export type RecommendationResult = {
  product_id: string;
  product_name: string;
  product_type: string;
  brand: string | null;
  pvp: number;
  recommendation_level: RecommendationLevel;
  reason: string | null;
  symptom_names: string[];
};

export type SaveCalculationInput = {
  patient_reference: string | null;
  patient_city: string | null;
  symptom_ids: string[];
  symptoms_text: string;
  items: {
    product_id: string;
    product_name_snapshot: string;
    quantity: number;
    unit_price: number;
    total_price: number;
  }[];
  subtotal_products: number;
  discount_amount: number;
  final_price: number;
  observations: string | null;
};

// ── Queries ───────────────────────────────────────────────────────────────────

export async function getRecommendations(
  symptomIds: string[],
): Promise<{ data?: RecommendationResult[]; error?: string }> {
  const user = await getCurrentUser();
  if (!user) return { error: 'No autenticado' };

  if (!symptomIds.length) return { data: [] };

  const { data, error } = await supabaseAdmin
    .from('product_symptoms')
    .select(`
      recommendation_level,
      reason,
      product_id,
      symptom_id,
      products (
        id, name, product_type, brand, pvp
      ),
      symptoms (
        name
      )
    `)
    .in('symptom_id', symptomIds)
    .eq('active', true);

  if (error) return { error: error.message };

  const levelOrder: Record<RecommendationLevel, number> = { alto: 3, medio: 2, bajo: 1 };

  const map = new Map<string, RecommendationResult>();

  for (const row of (data ?? []) as any[]) {
    if (!row.products) continue;
    const pid = row.product_id as string;
    const symptomName: string = row.symptoms?.name ?? '';

    if (map.has(pid)) {
      const existing = map.get(pid)!;
      if (symptomName && !existing.symptom_names.includes(symptomName)) {
        existing.symptom_names.push(symptomName);
      }
      if (levelOrder[row.recommendation_level as RecommendationLevel] > levelOrder[existing.recommendation_level]) {
        existing.recommendation_level = row.recommendation_level;
        existing.reason = row.reason;
      }
    } else {
      map.set(pid, {
        product_id: pid,
        product_name: row.products.name,
        product_type: row.products.product_type,
        brand: row.products.brand,
        pvp: row.products.pvp,
        recommendation_level: row.recommendation_level,
        reason: row.reason,
        symptom_names: symptomName ? [symptomName] : [],
      });
    }
  }

  const sorted = Array.from(map.values()).sort(
    (a, b) => levelOrder[b.recommendation_level] - levelOrder[a.recommendation_level],
  );

  return { data: sorted };
}

// ── Mutaciones ────────────────────────────────────────────────────────────────

export async function saveCalculation(
  input: SaveCalculationInput,
): Promise<{ success?: boolean; calculationId?: string; error?: string }> {
  const user = await getCurrentUser();
  if (!user) return { error: 'No autenticado. Vuelve a iniciar sesión.' };

  const profile = await getUserProfile(user.id);
  if (!profile) return { error: 'Perfil de usuario no encontrado.' };

  if (profile.role !== 'admin' && input.discount_amount > 0) {
    return { error: 'Solo los administradores pueden aplicar descuentos.' };
  }

  if (!input.items.length) {
    return { error: 'Debe agregar al menos un producto al cálculo.' };
  }

  const invalidItems = input.items.filter(i => !i.unit_price || i.unit_price <= 0);
  if (invalidItems.length) {
    return { error: 'Hay productos sin precio configurado. No se puede guardar el cálculo.' };
  }

  const { data: calc, error: calcError } = await supabaseAdmin
    .from('calculations')
    .insert({
      patient_reference:  input.patient_reference,
      patient_city:       input.patient_city,
      symptoms_text:      input.symptoms_text,
      subtotal_products:  input.subtotal_products,
      additional_costs:   0,
      margin_amount:      0,
      discount_amount:    input.discount_amount,
      final_price:        input.final_price,
      observations:       input.observations,
      created_by:         user.id,
    })
    .select('id')
    .single();

  if (calcError || !calc) return { error: calcError?.message ?? 'Error al crear el cálculo.' };

  const itemRows = input.items.map(item => ({
    calculation_id:        calc.id,
    product_id:            item.product_id,
    product_name_snapshot: item.product_name_snapshot,
    quantity:              item.quantity,
    unit_price:            item.unit_price,
    total_price:           item.total_price,
  }));

  const { error: itemsError } = await supabaseAdmin
    .from('calculation_items')
    .insert(itemRows);

  if (itemsError) return { error: itemsError.message };

  revalidatePath('/calculations');
  revalidatePath('/history');

  return { success: true, calculationId: calc.id };
}
