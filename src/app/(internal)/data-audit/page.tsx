import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { getCurrentUser } from '@/lib/auth';
import type { Product, Symptom } from '@/types/database';
import DataAuditPrintButton from './DataAuditPrintButton';

export const metadata = { title: 'Auditoría de datos — SoftwareAmpollas' };

const LONG_NAME_THRESHOLD = 50;

type AuditProduct = Pick<
  Product,
  'id' | 'product_type' | 'provider' | 'brand' | 'name' |
  'compound' | 'conditions_text' | 'ml' | 'pvp' | 'active'
>;
type AuditSymptom = Pick<Symptom, 'id' | 'name' | 'category' | 'active'>;

// ── UI helpers ────────────────────────────────────────────────────────

function CountBadge({ count }: { count: number }) {
  if (count === 0) {
    return (
      <span className="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-semibold text-green-800">
        ✓ Sin problemas
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-semibold text-red-700">
      {count} {count === 1 ? 'registro' : 'registros'}
    </span>
  );
}

function Section({
  title,
  description,
  count,
  children,
}: {
  title: string;
  description?: string;
  count: number;
  children: ReactNode;
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
      <div className="flex items-start justify-between gap-4 border-b border-gray-100 px-6 py-4">
        <div>
          <h2 className="text-sm font-semibold text-gray-900">{title}</h2>
          {description && (
            <p className="mt-0.5 text-xs text-gray-500">{description}</p>
          )}
        </div>
        <CountBadge count={count} />
      </div>
      {count > 0 && <div className="overflow-x-auto">{children}</div>}
    </div>
  );
}

const TYPE_LABEL: Record<string, string> = {
  ampolla:   'Ampolla',
  accesorio: 'Accesorio',
  solucion:  'Solución',
  insumo:    'Insumo',
  otro:      'Otro',
};

function TypeChip({ type }: { type: string }) {
  return (
    <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700">
      {TYPE_LABEL[type] ?? type}
    </span>
  );
}

function Empty() {
  return <span className="text-gray-400">—</span>;
}

function ColHeader({ children }: { children: ReactNode }) {
  return (
    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500 whitespace-nowrap">
      {children}
    </th>
  );
}

function Cell({ children }: { children: ReactNode }) {
  return <td className="px-4 py-3 text-sm text-gray-700">{children}</td>;
}

// ── Page ─────────────────────────────────────────────────────────────

export default async function DataAuditPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  const [{ data: products, error: prodError }, { data: symptoms, error: sympError }] =
    await Promise.all([
      supabaseAdmin
        .from('products')
        .select('id, product_type, provider, brand, name, compound, conditions_text, ml, pvp, active')
        .order('name', { ascending: true }),
      supabaseAdmin
        .from('symptoms')
        .select('id, name, category, active')
        .order('name', { ascending: true }),
    ]);

  if (prodError || sympError) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-6">
        <p className="font-semibold text-red-800">Error al cargar datos</p>
        <p className="mt-1 font-mono text-sm text-red-600">
          {prodError?.message ?? sympError?.message}
        </p>
      </div>
    );
  }

  const prods = (products ?? []) as AuditProduct[];
  const symps = (symptoms ?? []) as AuditSymptom[];

  // ── Checks ───────────────────────────────────────────────────────────
  const sinPvp = prods.filter(p => !p.pvp || p.pvp === 0);

  const sinMl = prods.filter(p => p.ml === null || p.ml === undefined);

  const sinProveedor = prods.filter(
    p => !p.provider || p.provider.trim() === '',
  );

  const sinMarca = prods.filter(
    p => !p.brand || p.brand.trim() === '',
  );

  const nombreLargo = prods.filter(p => p.name.length > LONG_NAME_THRESHOLD);

  const pareceCompuesto = prods.filter(
    p =>
      p.name.startsWith('(') ||
      (p.name.length > LONG_NAME_THRESHOLD && p.name.includes('(') && !p.compound),
  );

  const accesorioSinPrecio = prods.filter(
    p => p.product_type === 'accesorio' && (!p.pvp || p.pvp === 0),
  );

  const ampollaSinConditions = prods.filter(
    p =>
      p.product_type === 'ampolla' &&
      (!p.conditions_text || p.conditions_text.trim() === ''),
  );

  const sintomasSospechosos = symps.filter(
    s =>
      s.name.toLowerCase().replace(/\s+/g, '') === 'envejecimientoprematuro' ||
      s.name.toLowerCase().startsWith('ampollas pascoe'),
  );

  const totalIssues =
    sinPvp.length +
    sinMl.length +
    sinProveedor.length +
    sinMarca.length +
    nombreLargo.length +
    pareceCompuesto.length +
    accesorioSinPrecio.length +
    ampollaSinConditions.length +
    sintomasSospechosos.length;

  const generatedAt = new Date().toLocaleString('es-EC', {
    year:   'numeric',
    month:  '2-digit',
    day:    '2-digit',
    hour:   '2-digit',
    minute: '2-digit',
    hour12: false,
  });

  return (
    <div className="space-y-6 p-6">

      {/* Header -------------------------------------------------------- */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Auditoría de datos</h1>
          <p className="mt-1 text-sm text-gray-500">
            {prods.length} productos · {symps.length} síntomas · {totalIssues} problemas detectados
          </p>
          <p className="mt-0.5 text-xs text-gray-400">
            Generado el {generatedAt}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {totalIssues > 0 ? (
            <span className="inline-flex items-center rounded-full bg-amber-100 px-3 py-1 text-sm font-semibold text-amber-800">
              {totalIssues} problemas detectados
            </span>
          ) : (
            <span className="inline-flex items-center rounded-full bg-green-100 px-3 py-1 text-sm font-semibold text-green-800">
              ✓ Datos sin problemas
            </span>
          )}
          <DataAuditPrintButton />
        </div>
      </div>

      {/* 1. Sin PVP ---------------------------------------------------- */}
      <Section
        title="1. Productos sin PVP o con PVP = 0"
        description="Todos los tipos de producto con precio de venta faltante"
        count={sinPvp.length}
      >
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <ColHeader>Tipo</ColHeader>
              <ColHeader>Nombre</ColHeader>
              <ColHeader>Marca</ColHeader>
              <ColHeader>PVP</ColHeader>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {sinPvp.map(p => (
              <tr key={p.id} className="hover:bg-gray-50">
                <Cell><TypeChip type={p.product_type} /></Cell>
                <Cell><span className="font-medium text-gray-900">{p.name}</span></Cell>
                <Cell>{p.brand || <Empty />}</Cell>
                <Cell><span className="font-mono text-red-600">{p.pvp ?? 'null'}</span></Cell>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>

      {/* 2. Sin ML ----------------------------------------------------- */}
      <Section
        title="2. Productos sin ML"
        description="Campo ml vacío — puede ser esperado en accesorios e insumos"
        count={sinMl.length}
      >
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <ColHeader>Tipo</ColHeader>
              <ColHeader>Nombre</ColHeader>
              <ColHeader>Marca</ColHeader>
              <ColHeader>ML</ColHeader>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {sinMl.map(p => (
              <tr key={p.id} className="hover:bg-gray-50">
                <Cell><TypeChip type={p.product_type} /></Cell>
                <Cell><span className="font-medium text-gray-900">{p.name}</span></Cell>
                <Cell>{p.brand || <Empty />}</Cell>
                <Cell><span className="font-mono text-red-600">{String(p.ml ?? 'null')}</span></Cell>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>

      {/* 3. Sin proveedor ---------------------------------------------- */}
      <Section
        title="3. Productos sin proveedor"
        description="Campo provider vacío o nulo"
        count={sinProveedor.length}
      >
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <ColHeader>Tipo</ColHeader>
              <ColHeader>Nombre</ColHeader>
              <ColHeader>Marca</ColHeader>
              <ColHeader>Proveedor</ColHeader>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {sinProveedor.map(p => (
              <tr key={p.id} className="hover:bg-gray-50">
                <Cell><TypeChip type={p.product_type} /></Cell>
                <Cell><span className="font-medium text-gray-900">{p.name}</span></Cell>
                <Cell>{p.brand || <Empty />}</Cell>
                <Cell><span className="text-red-400 italic">vacío</span></Cell>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>

      {/* 4. Sin marca -------------------------------------------------- */}
      <Section
        title="4. Productos sin marca"
        description="Campo brand vacío o nulo"
        count={sinMarca.length}
      >
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <ColHeader>Tipo</ColHeader>
              <ColHeader>Nombre</ColHeader>
              <ColHeader>Proveedor</ColHeader>
              <ColHeader>Marca</ColHeader>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {sinMarca.map(p => (
              <tr key={p.id} className="hover:bg-gray-50">
                <Cell><TypeChip type={p.product_type} /></Cell>
                <Cell><span className="font-medium text-gray-900">{p.name}</span></Cell>
                <Cell>{p.provider || <Empty />}</Cell>
                <Cell><span className="text-red-400 italic">vacío</span></Cell>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>

      {/* 5. Nombre muy largo ------------------------------------------- */}
      <Section
        title={`5. Productos con nombre muy largo (> ${LONG_NAME_THRESHOLD} caracteres)`}
        description="Nombres extensos que podrían ser compuestos o descripciones mezcladas"
        count={nombreLargo.length}
      >
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <ColHeader>Tipo</ColHeader>
              <ColHeader>Nombre</ColHeader>
              <ColHeader>Chars</ColHeader>
              <ColHeader>Compuesto separado</ColHeader>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {nombreLargo.map(p => (
              <tr key={p.id} className="hover:bg-gray-50">
                <Cell><TypeChip type={p.product_type} /></Cell>
                <Cell>
                  <span className="font-medium text-gray-900 break-all">{p.name}</span>
                </Cell>
                <Cell>
                  <span className="font-mono text-amber-600">{p.name.length}</span>
                </Cell>
                <Cell>
                  {p.compound
                    ? <span className="text-green-700 text-xs">{p.compound}</span>
                    : <Empty />}
                </Cell>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>

      {/* 6. Nombre parece compuesto ------------------------------------ */}
      <Section
        title="6. Nombres que parecen compuestos"
        description="Nombres que inician con '(' o contienen paréntesis sin campo compound separado"
        count={pareceCompuesto.length}
      >
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <ColHeader>Tipo</ColHeader>
              <ColHeader>Nombre</ColHeader>
              <ColHeader>Compuesto separado</ColHeader>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {pareceCompuesto.map(p => (
              <tr key={p.id} className="hover:bg-gray-50">
                <Cell><TypeChip type={p.product_type} /></Cell>
                <Cell>
                  <span className="font-medium text-red-700 break-all">{p.name}</span>
                </Cell>
                <Cell>
                  {p.compound
                    ? <span className="text-green-700 text-xs">{p.compound}</span>
                    : <Empty />}
                </Cell>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>

      {/* 7. Accesorios sin precio -------------------------------------- */}
      <Section
        title="7. Accesorios sin precio"
        description="Productos de tipo 'accesorio' con PVP nulo o igual a 0"
        count={accesorioSinPrecio.length}
      >
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <ColHeader>Nombre</ColHeader>
              <ColHeader>Marca</ColHeader>
              <ColHeader>Proveedor</ColHeader>
              <ColHeader>PVP</ColHeader>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {accesorioSinPrecio.map(p => (
              <tr key={p.id} className="hover:bg-gray-50">
                <Cell><span className="font-medium text-gray-900">{p.name}</span></Cell>
                <Cell>{p.brand    || <Empty />}</Cell>
                <Cell>{p.provider || <Empty />}</Cell>
                <Cell><span className="font-mono text-red-600">{p.pvp ?? 'null'}</span></Cell>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>

      {/* 8. Ampollas sin conditions_text ------------------------------- */}
      <Section
        title="8. Ampollas sin conditions_text"
        description="Ampollas sin texto de condiciones — necesario para la búsqueda por síntoma"
        count={ampollaSinConditions.length}
      >
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <ColHeader>Nombre</ColHeader>
              <ColHeader>Marca</ColHeader>
              <ColHeader>Compuesto</ColHeader>
              <ColHeader>conditions_text</ColHeader>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {ampollaSinConditions.map(p => (
              <tr key={p.id} className="hover:bg-gray-50">
                <Cell><span className="font-medium text-gray-900">{p.name}</span></Cell>
                <Cell>{p.brand    || <Empty />}</Cell>
                <Cell>{p.compound || <Empty />}</Cell>
                <Cell><span className="text-red-400 italic">vacío</span></Cell>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>

      {/* 9. Síntomas sospechosos --------------------------------------- */}
      <Section
        title="9. Síntomas sospechosos"
        description="Síntomas con formato incorrecto o que parecen errores de importación"
        count={sintomasSospechosos.length}
      >
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <ColHeader>Nombre</ColHeader>
              <ColHeader>Categoría</ColHeader>
              <ColHeader>Activo</ColHeader>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {sintomasSospechosos.map(s => (
              <tr key={s.id} className="hover:bg-gray-50">
                <Cell>
                  <span className="font-medium text-red-700">{s.name}</span>
                </Cell>
                <Cell>{s.category || <Empty />}</Cell>
                <Cell>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      s.active
                        ? 'bg-green-100 text-green-700'
                        : 'bg-gray-100 text-gray-600'
                    }`}
                  >
                    {s.active ? 'Activo' : 'Inactivo'}
                  </span>
                </Cell>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>

    </div>
  );
}
