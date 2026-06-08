import { redirect } from 'next/navigation';
import { getCurrentUser, getUserProfile, isProfileValid } from '@/lib/auth';
import Sidebar from './Sidebar';
import SignOutButton from './SignOutButton';

export default async function InternalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // ── Validar sesión y perfil ────────────────────────────────────────
  // El middleware ya redirige si no hay sesión, pero este check
  // adicional valida que el perfil exista y esté activo.
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  const profile = await getUserProfile(user.id);

  if (!isProfileValid(profile)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="max-w-sm w-full space-y-4 text-center">
          <div className="rounded-xl border border-red-200 bg-red-50 p-6">
            <p className="text-sm font-semibold text-red-800">Acceso denegado</p>
            <p className="mt-2 text-sm text-red-600">
              Usuario sin permisos activos. Contacte al administrador.
            </p>
            <p className="mt-2 font-mono text-xs text-red-400">{user.email}</p>
          </div>
          <SignOutButton />
        </div>
      </div>
    );
  }

  const displayName = profile!.full_name || user.email || 'Usuario';

  // ── Shell de la aplicación ─────────────────────────────────────────
  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      {/* Sidebar fijo */}
      <Sidebar />

      {/* Área principal */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Header */}
        <header className="flex flex-shrink-0 items-center justify-between border-b border-gray-200 bg-white px-6 py-3">
          <div>
            <h1 className="text-sm font-semibold text-gray-900">
              Sistema Interno de Cálculo de Sueros
            </h1>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right hidden sm:block">
              <p className="text-xs font-medium text-gray-700">{displayName}</p>
              <p className="text-xs text-gray-400">{user.email}</p>
            </div>
            <SignOutButton />
          </div>
        </header>

        {/* Contenido de la página */}
        <main className="flex-1 overflow-y-auto p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
