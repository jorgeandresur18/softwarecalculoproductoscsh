import { redirect } from 'next/navigation';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { getCurrentUser, getUserProfile } from '@/lib/auth';
import type { Symptom } from '@/types/database';
import SymptomsClient from './SymptomsClient';

export const metadata = { title: 'Síntomas — SoftwareAmpollas' };

export type SymptomWithCount = Omit<Symptom, never> & {
  product_count: number;
};

export default async function SymptomsPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  const profile  = await getUserProfile(user.id);
  const userRole = profile?.role ?? 'staff';

  const [
    { data: rawSymptoms, error: sympError },
    { data: psRows,      error: psError  },
  ] = await Promise.all([
    supabaseAdmin
      .from('symptoms')
      .select('id, name, category, description, active, created_at')
      .order('name', { ascending: true }),
    supabaseAdmin
      .from('product_symptoms')
      .select('symptom_id')
      .eq('active', true),
  ]);

  if (sympError || psError) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-6">
        <p className="font-semibold text-red-800">Error al cargar síntomas</p>
        <p className="mt-1 font-mono text-sm text-red-600">
          {sympError?.message ?? psError?.message}
        </p>
      </div>
    );
  }

  // Conteo de productos por síntoma en JavaScript (evita ambigüedades de PostgREST)
  const countMap = new Map<string, number>();
  for (const ps of psRows ?? []) {
    countMap.set(ps.symptom_id, (countMap.get(ps.symptom_id) ?? 0) + 1);
  }

  const symptoms: SymptomWithCount[] = (rawSymptoms ?? []).map(s => ({
    ...(s as Symptom),
    product_count: countMap.get(s.id) ?? 0,
  }));

  return (
    <SymptomsClient
      symptoms={symptoms}
      userRole={userRole}
    />
  );
}
