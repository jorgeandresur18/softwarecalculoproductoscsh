import { supabaseAdmin } from '@/lib/supabaseAdmin';
import type { Product, Symptom } from '@/types/database';

// Colores para los badges de tipo de producto
const TYPE_COLORS: Record<string, string> = {
  ampolla:   'bg-blue-100 text-blue-800',
  accesorio: 'bg-green-100 text-green-800',
  solucion:  'bg-cyan-100 text-cyan-800',
  insumo:    'bg-yellow-100 text-yellow-800',
  otro:      'bg-gray-100 text-gray-700',
};

// ─── Bloque de error ─────────────────────────────────────────────────

function ErrorCard({ title, message, hint }: { title: string; message: string; hint?: string }) {
  return (
    <div className="rounded-lg border border-red-200 bg-red-50 p-4">
      <p className="font-semibold text-red-700">{title}</p>
      <p className="mt-1 font-mono text-sm text-red-600">{message}</p>
      {hint && <p className="mt-2 text-sm text-red-500">{hint}</p>}
    </div>
  );
}

// ─── Página (Server Component — corre en el servidor) ────────────────

export default async function TestSupabasePage() {
  // ── Variables de entorno ──────────────────────────────────────────
  const envUrl  = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const envAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const envSrk  = process.env.SUPABASE_SERVICE_ROLE_KEY;

  const envErrors: string[] = [];
  if (!envUrl)  envErrors.push('NEXT_PUBLIC_SUPABASE_URL');
  if (!envAnon) envErrors.push('NEXT_PUBLIC_SUPABASE_ANON_KEY');
  if (!envSrk)  envErrors.push('SUPABASE_SERVICE_ROLE_KEY');

  // ── Consultas a Supabase ──────────────────────────────────────────
  type QueryResult<T> =
    | { ok: true; data: T; count: number | null }
    | { ok: false; error: string };

  async function fetchCount(table: string): Promise<number | null> {
    const { count } = await supabaseAdmin
      .from(table)
      .select('*', { count: 'exact', head: true });
    return count;
  }

  async function fetchProducts(): Promise<QueryResult<Product[]>> {
    const { data, error, count } = await supabaseAdmin
      .from('products')
      .select('*', { count: 'exact' })
      .order('product_type')
      .order('name')
      .limit(10);
    if (error) return { ok: false, error: error.message };
    return { ok: true, data: (data ?? []) as Product[], count };
  }

  async function fetchSymptoms(): Promise<QueryResult<Symptom[]>> {
    const { data, error, count } = await supabaseAdmin
      .from('symptoms')
      .select('*', { count: 'exact' })
      .order('name')
      .limit(10);
    if (error) return { ok: false, error: error.message };
    return { ok: true, data: (data ?? []) as Symptom[], count };
  }

  async function fetchRelationsCount(): Promise<number | null> {
    return fetchCount('product_symptoms');
  }

  // Ejecutar en paralelo
  const [productsResult, symptomsResult, relationsCount] = await Promise.all([
    fetchProducts(),
    fetchSymptoms(),
    fetchRelationsCount(),
  ]);

  return (
    <div className="min-h-screen bg-gray-50 p-6 font-sans">
      <div className="mx-auto max-w-4xl space-y-6">

        {/* Encabezado */}
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h1 className="text-2xl font-bold text-gray-900">
            Diagnóstico de conexión Supabase
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Esta página es temporal — solo para verificar que la BD está conectada.
          </p>
        </div>

        {/* Variables de entorno */}
        <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="mb-3 font-semibold text-gray-700">Variables de entorno</h2>
          <ul className="space-y-2 text-sm">
            {[
              { key: 'NEXT_PUBLIC_SUPABASE_URL',   val: envUrl  },
              { key: 'NEXT_PUBLIC_SUPABASE_ANON_KEY', val: envAnon },
              { key: 'SUPABASE_SERVICE_ROLE_KEY',  val: envSrk  },
            ].map(({ key, val }) => (
              <li key={key} className="flex items-center gap-2">
                <span className={`inline-block h-2 w-2 rounded-full ${val ? 'bg-green-500' : 'bg-red-500'}`} />
                <span className="font-mono text-gray-800">{key}</span>
                <span className={val ? 'text-green-700' : 'text-red-600'}>
                  {val
                    ? `${val.substring(0, 30)}…`
                    : '— FALTA —'}
                </span>
              </li>
            ))}
          </ul>
          {envErrors.length > 0 && (
            <div className="mt-3">
              <ErrorCard
                title="Variables faltantes"
                message={envErrors.join(', ')}
                hint="Agrega estas variables en .env.local y reinicia el servidor con npm run dev"
              />
            </div>
          )}
        </section>

        {/* Productos */}
        <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="mb-3 font-semibold text-gray-700">
            Tabla: <span className="font-mono text-blue-700">products</span>
          </h2>

          {!productsResult.ok ? (
            <ErrorCard
              title="Error al consultar products"
              message={productsResult.error}
              hint={
                productsResult.error.includes('relation')
                  ? 'La tabla no existe. Ejecuta supabase/schema.sql en Supabase.'
                  : productsResult.error.includes('denied') || productsResult.error.includes('policy')
                  ? 'RLS está bloqueando la consulta. Verifica SUPABASE_SERVICE_ROLE_KEY.'
                  : 'Verifica tu conexión y las variables de entorno.'
              }
            />
          ) : (
            <>
              <p className="mb-3 text-sm text-gray-600">
                Total en BD:{' '}
                <span className="font-bold text-gray-900">{productsResult.count ?? '—'}</span>
                {' · '}Mostrando los primeros {productsResult.data.length}
              </p>
              <div className="overflow-x-auto rounded-lg border border-gray-100">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                    <tr>
                      <th className="px-3 py-2">Tipo</th>
                      <th className="px-3 py-2">Nombre</th>
                      <th className="px-3 py-2">Marca</th>
                      <th className="px-3 py-2 text-right">PVP</th>
                      <th className="px-3 py-2 text-right">ML</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {productsResult.data.map((p) => (
                      <tr key={p.id} className="hover:bg-gray-50">
                        <td className="px-3 py-2">
                          <span className={`rounded px-2 py-0.5 text-xs font-medium ${TYPE_COLORS[p.product_type] ?? TYPE_COLORS.otro}`}>
                            {p.product_type}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-gray-900">{p.name}</td>
                        <td className="px-3 py-2 text-gray-500">{p.brand ?? '—'}</td>
                        <td className="px-3 py-2 text-right font-mono text-gray-700">
                          ${p.pvp.toFixed(2)}
                        </td>
                        <td className="px-3 py-2 text-right text-gray-500">
                          {p.ml ?? '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </section>

        {/* Síntomas */}
        <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="mb-3 font-semibold text-gray-700">
            Tabla: <span className="font-mono text-purple-700">symptoms</span>
          </h2>

          {!symptomsResult.ok ? (
            <ErrorCard
              title="Error al consultar symptoms"
              message={symptomsResult.error}
              hint="Verifica que ejecutaste supabase/schema.sql correctamente."
            />
          ) : (
            <>
              <p className="mb-3 text-sm text-gray-600">
                Total en BD:{' '}
                <span className="font-bold text-gray-900">{symptomsResult.count ?? '—'}</span>
                {' · '}Mostrando los primeros {symptomsResult.data.length}
              </p>
              <ul className="grid grid-cols-1 gap-1 sm:grid-cols-2">
                {symptomsResult.data.map((s) => (
                  <li key={s.id} className="flex items-center gap-2 rounded-md bg-purple-50 px-3 py-1.5 text-sm text-purple-900">
                    <span className="h-1.5 w-1.5 rounded-full bg-purple-400" />
                    {s.name}
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>

        {/* Relaciones */}
        <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="mb-2 font-semibold text-gray-700">
            Tabla: <span className="font-mono text-orange-700">product_symptoms</span>
          </h2>
          <p className="text-sm text-gray-600">
            Relaciones producto ↔ síntoma:{' '}
            <span className="text-xl font-bold text-gray-900">
              {relationsCount !== null ? relationsCount : '—'}
            </span>
          </p>
        </section>

        {/* Estado general */}
        <section className={`rounded-xl border p-6 shadow-sm ${
          productsResult.ok && symptomsResult.ok
            ? 'border-green-200 bg-green-50'
            : 'border-red-200 bg-red-50'
        }`}>
          {productsResult.ok && symptomsResult.ok ? (
            <p className="font-semibold text-green-800">
              Conexión correcta. La base de datos responde con datos.
            </p>
          ) : (
            <p className="font-semibold text-red-800">
              Hay errores en la conexión. Revisa los mensajes de error arriba.
            </p>
          )}
          <p className="mt-1 text-xs text-gray-500">
            Esta página usa el cliente admin (service_role) que corre en el servidor.
            Los datos nunca pasan por el navegador directamente.
          </p>
        </section>

      </div>
    </div>
  );
}
