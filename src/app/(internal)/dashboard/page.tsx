import Link from 'next/link';
import { getCurrentUser, getUserProfile } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

const ROLE_LABEL: Record<string, string> = {
  admin: 'Administrador',
  staff: 'Staff',
};

const ROLE_BADGE: Record<string, string> = {
  admin: 'bg-purple-100 text-purple-800 border border-purple-200',
  staff: 'bg-blue-100 text-blue-800 border border-blue-200',
};

export default async function DashboardPage() {
  // El layout ya garantizó que user y profile son válidos.
  // Re-fetch ligero para mostrar datos del usuario.
  const user    = await getCurrentUser();
  const profile = user ? await getUserProfile(user.id) : null;

  // Conteos rápidos de la BD
  const [{ count: productsCount }, { count: symptomsCount }, { count: relationsCount }] =
    await Promise.all([
      supabaseAdmin.from('products').select('*', { count: 'exact', head: true }),
      supabaseAdmin.from('symptoms').select('*', { count: 'exact', head: true }),
      supabaseAdmin.from('product_symptoms').select('*', { count: 'exact', head: true }),
    ]);

  const displayName = profile?.full_name || user?.email || 'Usuario';

  return (
    <div className="space-y-6 max-w-4xl">

      {/* Bienvenida */}
      <div className="rounded-xl border border-gray-200 bg-white px-6 py-5">
        <p className="text-xs font-medium uppercase tracking-wide text-gray-400">
          Bienvenido de vuelta
        </p>
        <p className="mt-1 text-2xl font-bold text-gray-900">{displayName}</p>
        {profile && (
          <span className={`mt-2 inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold
            ${ROLE_BADGE[profile.role] ?? 'bg-gray-100 text-gray-700'}`}>
            {ROLE_LABEL[profile.role] ?? profile.role}
          </span>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          label="Productos en catálogo"
          value={productsCount ?? 0}
          sublabel="ampollas y accesorios"
          color="blue"
        />
        <StatCard
          label="Síntomas registrados"
          value={symptomsCount ?? 0}
          sublabel="padecimientos únicos"
          color="purple"
        />
        <StatCard
          label="Relaciones producto-síntoma"
          value={relationsCount ?? 0}
          sublabel="para recomendación"
          color="green"
        />
      </div>

      {/* Acceso rápido a módulos */}
      <div className="rounded-xl border border-gray-200 bg-white px-6 py-5">
        <h2 className="mb-4 text-sm font-semibold text-gray-700">
          Módulos del sistema
        </h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <QuickLink
            href="/products"
            label="Productos y Ampollas"
            description="Catálogo completo importado desde Excel"
            ready
          />
          <QuickLink
            href="/symptoms"
            label="Síntomas"
            description="Padecimientos para recomendación de sueros"
            ready
          />
          <QuickLink
            href="/calculations"
            label="Calcular Suero"
            description="Calcular precio de suero terapéutico"
            ready
          />
          <QuickLink
            href="/history"
            label="Historial"
            description="Cálculos realizados anteriormente"
            ready
          />
        </div>
      </div>

    </div>
  );
}

// ── Componentes auxiliares ────────────────────────────────────────────

function StatCard({
  label,
  value,
  sublabel,
  color,
}: {
  label: string;
  value: number;
  sublabel: string;
  color: 'blue' | 'purple' | 'green';
}) {
  const colors = {
    blue:   'text-blue-600 bg-blue-50',
    purple: 'text-purple-600 bg-purple-50',
    green:  'text-green-600 bg-green-50',
  };

  return (
    <div className="rounded-xl border border-gray-200 bg-white px-5 py-4">
      <p className="text-xs text-gray-500">{label}</p>
      <p className={`mt-1 text-3xl font-bold ${colors[color].split(' ')[0]}`}>
        {value.toLocaleString()}
      </p>
      <p className="mt-0.5 text-xs text-gray-400">{sublabel}</p>
    </div>
  );
}

function QuickLink({
  href,
  label,
  description,
  ready = false,
}: {
  href: string;
  label: string;
  description: string;
  ready?: boolean;
}) {
  return (
    <Link
      href={href}
      className="group flex items-start gap-3 rounded-lg border border-gray-200 px-4 py-3
                 transition-colors hover:border-blue-200 hover:bg-blue-50"
    >
      <span className="mt-0.5 h-2 w-2 flex-shrink-0 rounded-full bg-green-400 group-hover:bg-blue-500 transition-colors" />
      <div>
        <p className="text-sm font-medium text-gray-800 group-hover:text-blue-700">{label}</p>
        <p className="mt-0.5 text-xs text-gray-500">{description}</p>
      </div>
    </Link>
  );
}
