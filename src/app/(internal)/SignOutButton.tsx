'use client';

import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/browser';

export default function SignOutButton() {
  const router = useRouter();

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.replace('/login');
  }

  return (
    <button
      onClick={handleSignOut}
      className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600
                 hover:border-red-300 hover:bg-red-50 hover:text-red-600 transition-colors"
    >
      Cerrar sesión
    </button>
  );
}
