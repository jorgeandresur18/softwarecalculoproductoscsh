import { redirect } from 'next/navigation';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { getCurrentUser, getUserProfile } from '@/lib/auth';
import type { Product } from '@/types/database';
import ProductsClient from './ProductsClient';

export const metadata = { title: 'Productos y Ampollas — SoftwareAmpollas' };

export default async function ProductsPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  const profile  = await getUserProfile(user.id);
  const userRole = profile?.role ?? 'staff';

  const { data: products, error } = await supabaseAdmin
    .from('products')
    .select('*')
    .order('product_type', { ascending: true })
    .order('name',         { ascending: true });

  if (error) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-6">
        <p className="font-semibold text-red-800">Error al cargar productos</p>
        <p className="mt-1 font-mono text-sm text-red-600">{error.message}</p>
      </div>
    );
  }

  return (
    <ProductsClient
      products={(products ?? []) as Product[]}
      userRole={userRole}
    />
  );
}
