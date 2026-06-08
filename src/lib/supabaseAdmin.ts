import { createClient } from '@supabase/supabase-js';

// Cliente de solo servidor. Nunca importar desde componentes del cliente ('use client').
// Tiene service_role: omite RLS — usar exclusivamente en Server Components y API Routes.

const supabaseUrl     = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey  = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error(
    'Faltan variables de entorno de servidor: NEXT_PUBLIC_SUPABASE_URL y/o SUPABASE_SERVICE_ROLE_KEY'
  );
}

export const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession:   false,
  },
});
