import { redirect } from 'next/navigation';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { getCurrentUser, getUserProfile } from '@/lib/auth';
import type { Product, Symptom } from '@/types/database';
import CalculationClient from './CalculationClient';

export const metadata = { title: 'Calcular Suero — SoftwareAmpollas' };

export default async function CalculationsPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  const profile  = await getUserProfile(user.id);
  const userRole = profile?.role ?? 'staff';

  const [{ data: symptoms, error: symptomsError }, { data: products, error: productsError }] =
    await Promise.all([
      supabaseAdmin
        .from('symptoms')
        .select('*')
        .eq('active', true)
        .order('name', { ascending: true }),
      supabaseAdmin
        .from('products')
        .select('*')
        .eq('active', true)
        .order('product_type', { ascending: true })
        .order('name',         { ascending: true }),
    ]);

  if (symptomsError || productsError) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-6">
        <p className="font-semibold text-red-800">Error al cargar datos</p>
        <p className="mt-1 font-mono text-sm text-red-600">
          {symptomsError?.message ?? productsError?.message}
        </p>
      </div>
    );
  }

  return (
    <CalculationClient
      symptoms={(symptoms ?? []) as Symptom[]}
      products={(products ?? []) as Product[]}
      userRole={userRole}
    />
  );
}
