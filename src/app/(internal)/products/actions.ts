'use server';

import { revalidatePath } from 'next/cache';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { getCurrentUser, getUserProfile } from '@/lib/auth';
import type { ProductType } from '@/types/database';

// ── Tipos ─────────────────────────────────────────────────────────────────────

type UpdateProductData = {
  name?:              string;
  brand?:             string | null;
  provider?:          string | null;
  compound?:          string | null;
  pvp?:               number;
  ml?:                number | null;
  measure?:           string | null;
  observations?:      string | null;
  active?:            boolean;
};

export type CreateProductData = {
  product_type:       ProductType;
  name:               string;
  brand:              string | null;
  provider:           string | null;
  compound:           string | null;
  ml:                 number | null;
  measure:            string | null;
  pvm:                number;
  margin_percentage:  number;
  pvp:                number;
  quantity:           number;
  total:              number;
  conditions_text:    string | null;
  indications:        string | null;
  observations:       string | null;
  active:             boolean;
};

// ── Editar producto ───────────────────────────────────────────────────────────

export async function updateProduct(
  id: string,
  data: UpdateProductData,
): Promise<{ success?: boolean; error?: string }> {
  const user = await getCurrentUser();
  if (!user) return { error: 'No autenticado. Vuelve a iniciar sesión.' };

  const profile = await getUserProfile(user.id);
  if (!profile || profile.role !== 'admin') {
    return { error: 'Solo los administradores pueden editar productos.' };
  }

  const { error } = await supabaseAdmin
    .from('products')
    .update({ ...data, updated_at: new Date().toISOString() })
    .eq('id', id);

  if (error) return { error: error.message };

  revalidatePath('/products');
  return { success: true };
}

// ── Crear producto ────────────────────────────────────────────────────────────

export async function createProduct(
  data: CreateProductData,
): Promise<{ success?: boolean; productId?: string; error?: string }> {
  const user = await getCurrentUser();
  if (!user) return { error: 'No autenticado. Vuelve a iniciar sesión.' };

  const profile = await getUserProfile(user.id);
  if (!profile || profile.role !== 'admin') {
    return { error: 'Solo los administradores pueden crear productos.' };
  }

  // Validaciones básicas
  const name = data.name.trim();
  if (!name) return { error: 'El nombre es obligatorio.' };
  if (!data.pvp || data.pvp <= 0) return { error: 'El PVP debe ser mayor que 0.' };

  // Verificar duplicado: mismo nombre (case-insensitive) + mismo tipo
  const { data: existing, error: searchError } = await supabaseAdmin
    .from('products')
    .select('id')
    .ilike('name', name)
    .eq('product_type', data.product_type)
    .maybeSingle();

  if (searchError) return { error: searchError.message };
  if (existing) return { error: 'Ya existe un producto con ese nombre y tipo.' };

  const now = new Date().toISOString();

  const { data: created, error: insertError } = await supabaseAdmin
    .from('products')
    .insert({
      product_type:      data.product_type,
      name,
      brand:             data.brand             || null,
      provider:          data.provider          || null,
      compound:          data.compound          || null,
      ml:                data.ml,
      measure:           data.measure           || null,
      pvm:               data.pvm               ?? 0,
      margin_percentage: data.margin_percentage ?? 0,
      pvp:               data.pvp,
      quantity:          data.quantity          ?? 0,
      total:             data.total             ?? 0,
      conditions_text:   data.conditions_text   || null,
      indications:       data.indications       || null,
      observations:      data.observations      || null,
      active:            data.active,
      created_at:        now,
      updated_at:        now,
    })
    .select('id')
    .single();

  if (insertError) return { error: insertError.message };

  revalidatePath('/products');
  return { success: true, productId: created.id };
}
