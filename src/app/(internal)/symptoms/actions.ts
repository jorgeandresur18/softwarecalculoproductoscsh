'use server';

import { revalidatePath } from 'next/cache';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { getCurrentUser, getUserProfile } from '@/lib/auth';
import type { RecommendationLevel } from '@/types/database';

// ── Tipos exportados ──────────────────────────────────────────────────────────

export type ProductSymptomRow = {
  id: string;
  symptom_id: string;
  recommendation_level: RecommendationLevel;
  reason: string | null;
  active: boolean;
  products: {
    id: string;
    name: string;
    product_type: string;
    brand: string | null;
    pvp: number;
  } | null;
};

// ── Queries ───────────────────────────────────────────────────────────────────

/** Carga los productos relacionados a un síntoma (para el modal). */
export async function getSymptomProducts(
  symptomId: string,
): Promise<{ data?: ProductSymptomRow[]; error?: string }> {
  const user = await getCurrentUser();
  if (!user) return { error: 'No autenticado' };

  const { data, error } = await supabaseAdmin
    .from('product_symptoms')
    .select(`
      id,
      symptom_id,
      recommendation_level,
      reason,
      active,
      products (
        id, name, product_type, brand, pvp
      )
    `)
    .eq('symptom_id', symptomId)
    .order('recommendation_level');

  if (error) return { error: error.message };
  return { data: data as unknown as ProductSymptomRow[] };
}

// ── Mutaciones ────────────────────────────────────────────────────────────────

export async function updateSymptom(
  id: string,
  data: {
    name?: string;
    category?: string | null;
    description?: string | null;
    active?: boolean;
  },
): Promise<{ success?: boolean; error?: string }> {
  const user = await getCurrentUser();
  if (!user) return { error: 'No autenticado. Vuelve a iniciar sesión.' };

  const profile = await getUserProfile(user.id);
  if (!profile || profile.role !== 'admin') {
    return { error: 'Solo los administradores pueden editar síntomas.' };
  }

  const { error } = await supabaseAdmin
    .from('symptoms')
    .update(data)
    .eq('id', id);

  if (error) return { error: error.message };

  revalidatePath('/symptoms');
  return { success: true };
}

export async function updateProductSymptom(
  id: string,
  data: {
    recommendation_level?: RecommendationLevel;
    reason?: string | null;
    active?: boolean;
  },
): Promise<{ success?: boolean; error?: string }> {
  const user = await getCurrentUser();
  if (!user) return { error: 'No autenticado. Vuelve a iniciar sesión.' };

  const profile = await getUserProfile(user.id);
  if (!profile || profile.role !== 'admin') {
    return { error: 'Solo los administradores pueden editar relaciones.' };
  }

  const { error } = await supabaseAdmin
    .from('product_symptoms')
    .update(data)
    .eq('id', id);

  if (error) return { error: error.message };

  revalidatePath('/symptoms');
  return { success: true };
}

// ── Crear síntoma ─────────────────────────────────────────────────────────────

export async function createSymptom(data: {
  name:        string;
  category:    string | null;
  description: string | null;
  active:      boolean;
}): Promise<{ success?: boolean; symptomId?: string; error?: string }> {
  const user = await getCurrentUser();
  if (!user) return { error: 'No autenticado. Vuelve a iniciar sesión.' };

  const profile = await getUserProfile(user.id);
  if (!profile || profile.role !== 'admin') {
    return { error: 'Solo los administradores pueden crear síntomas.' };
  }

  const name = data.name.trim();
  if (!name) return { error: 'El nombre es obligatorio.' };

  const { data: existing, error: searchError } = await supabaseAdmin
    .from('symptoms')
    .select('id')
    .ilike('name', name)
    .maybeSingle();

  if (searchError) return { error: searchError.message };
  if (existing) return { error: 'Ya existe un síntoma con ese nombre.' };

  const { data: created, error: insertError } = await supabaseAdmin
    .from('symptoms')
    .insert({
      name,
      category:    data.category    || null,
      description: data.description || null,
      active:      data.active,
    })
    .select('id')
    .single();

  if (insertError) return { error: insertError.message };

  revalidatePath('/symptoms');
  return { success: true, symptomId: created.id };
}

// ── Crear relación producto-síntoma ───────────────────────────────────────────

export async function createProductSymptom(data: {
  symptom_id:           string;
  product_id:           string;
  recommendation_level: RecommendationLevel;
  reason:               string | null;
  active:               boolean;
}): Promise<{ success?: boolean; id?: string; error?: string }> {
  const user = await getCurrentUser();
  if (!user) return { error: 'No autenticado. Vuelve a iniciar sesión.' };

  const profile = await getUserProfile(user.id);
  if (!profile || profile.role !== 'admin') {
    return { error: 'Solo los administradores pueden agregar relaciones.' };
  }

  const { data: existing, error: searchError } = await supabaseAdmin
    .from('product_symptoms')
    .select('id')
    .eq('symptom_id', data.symptom_id)
    .eq('product_id', data.product_id)
    .maybeSingle();

  if (searchError) return { error: searchError.message };
  if (existing) return { error: 'Este producto ya está relacionado con este síntoma.' };

  const { data: created, error: insertError } = await supabaseAdmin
    .from('product_symptoms')
    .insert({
      symptom_id:           data.symptom_id,
      product_id:           data.product_id,
      recommendation_level: data.recommendation_level,
      reason:               data.reason || null,
      active:               data.active,
    })
    .select('id')
    .single();

  if (insertError) return { error: insertError.message };

  revalidatePath('/symptoms');
  return { success: true, id: created.id };
}

// ── Productos activos para el selector ────────────────────────────────────────

export async function getActiveProducts(): Promise<{
  data?: { id: string; name: string; product_type: string; brand: string | null; pvp: number }[];
  error?: string;
}> {
  const user = await getCurrentUser();
  if (!user) return { error: 'No autenticado' };

  const { data, error } = await supabaseAdmin
    .from('products')
    .select('id, name, product_type, brand, pvp')
    .eq('active', true)
    .order('product_type', { ascending: true })
    .order('name', { ascending: true });

  if (error) return { error: error.message };
  return {
    data: data as { id: string; name: string; product_type: string; brand: string | null; pvp: number }[],
  };
}
