// Utilidades de autenticación para uso exclusivo en Server Components.
// No importar desde componentes 'use client'.

import { createClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import type { UserProfile } from '@/types/database';

/** Devuelve el usuario autenticado o null si no hay sesión. */
export async function getCurrentUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user ?? null;
}

/** Devuelve el perfil de users_profiles para el userId dado, o null. */
export async function getUserProfile(userId: string): Promise<UserProfile | null> {
  const { data, error } = await supabaseAdmin
    .from('users_profiles')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (error || !data) return null;
  return data as UserProfile;
}

/** True si el perfil existe y está activo con un rol válido. */
export function isProfileValid(profile: UserProfile | null): boolean {
  if (!profile) return false;
  return profile.active && (profile.role === 'admin' || profile.role === 'staff');
}
