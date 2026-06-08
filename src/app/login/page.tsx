'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/browser';

const ERROR_MAP: Record<string, string> = {
  'Invalid login credentials':
    'Email o contraseña incorrectos. Verifica tus datos.',
  'Email not confirmed':
    'Debes confirmar tu email antes de iniciar sesión.',
  'Too many requests':
    'Demasiados intentos. Espera unos minutos e intenta de nuevo.',
};

function mapError(raw: string): string {
  return ERROR_MAP[raw] ?? raw;
}

export default function LoginPage() {
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [error,    setError]    = useState<string | null>(null);
  const [loading,  setLoading]  = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const supabase = createClient();
    const { error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authError) {
      setError(mapError(authError.message));
      setLoading(false);
      return;
    }

    // Reemplazar historial para que "atrás" no vuelva al login
    router.replace('/dashboard');
  }

  return (
    <div
      className="relative min-h-screen flex items-center justify-center px-4"
      style={{
        backgroundImage:    'url(/fondo.jpeg)',
        backgroundSize:     'cover',
        backgroundPosition: 'center',
        backgroundRepeat:   'no-repeat',
      }}
    >
      {/* Capa blanca semitransparente sobre el fondo */}
      <div className="absolute inset-0 bg-white/60" aria-hidden="true" />
      <div className="relative z-10 w-full max-w-sm space-y-6">

        {/* Encabezado */}
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-white shadow-md mb-4 overflow-hidden">
            <img
              src="/logo.png"
              alt="SoftwareAmpollas"
              width={64}
              height={64}
              className="h-16 w-16 object-contain"
            />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 drop-shadow-sm">SoftwareAmpollas</h1>
          <p className="mt-1 text-sm font-medium text-gray-700">Sistema interno — acceso restringido</p>
        </div>

        {/* Formulario */}
        <form
          onSubmit={handleSubmit}
          className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-4"
        >
          <div>
            <label
              htmlFor="email"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Email
            </label>
            <input
              id="email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              disabled={loading}
              placeholder="usuario@ejemplo.com"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900
                         placeholder-gray-400 focus:border-blue-500 focus:outline-none
                         focus:ring-1 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-400"
            />
          </div>

          <div>
            <label
              htmlFor="password"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Contraseña
            </label>
            <input
              id="password"
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              disabled={loading}
              placeholder="••••••••"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900
                         placeholder-gray-400 focus:border-blue-500 focus:outline-none
                         focus:ring-1 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-400"
            />
          </div>

          {/* Error */}
          {error && (
            <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !email || !password}
            className="w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white
                       hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500
                       focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed
                       transition-colors"
          >
            {loading ? 'Iniciando sesión…' : 'Iniciar sesión'}
          </button>
        </form>

        <p className="text-center text-xs text-gray-400">
          Solo usuarios registrados por el administrador pueden acceder.
        </p>
      </div>
    </div>
  );
}
