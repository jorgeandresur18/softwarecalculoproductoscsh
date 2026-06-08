import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { getCalculations } from './actions';
import HistoryClient from './HistoryClient';

export const metadata = { title: 'Historial — SoftwareAmpollas' };

export default async function HistoryPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  const { data: calculations, error } = await getCalculations();

  if (error) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-6">
        <p className="font-semibold text-red-800">Error al cargar el historial</p>
        <p className="mt-1 font-mono text-sm text-red-600">{error}</p>
      </div>
    );
  }

  return <HistoryClient calculations={calculations ?? []} />;
}
