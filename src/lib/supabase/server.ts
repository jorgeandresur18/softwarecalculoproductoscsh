import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

// Fábrica de cliente Supabase para Server Components y Route Handlers.
// Lee y escribe la sesión desde/hacia cookies de Next.js.
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // En Server Components el set es ignorado (sin efecto secundario)
          }
        },
      },
    }
  );
}
