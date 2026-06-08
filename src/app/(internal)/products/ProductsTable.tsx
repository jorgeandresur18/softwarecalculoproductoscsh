'use client';

import type { Product } from '@/types/database';

export const TYPE_BADGE: Record<string, string> = {
  ampolla:   'bg-blue-100 text-blue-800',
  accesorio: 'bg-green-100 text-green-800',
  solucion:  'bg-cyan-100 text-cyan-800',
  insumo:    'bg-yellow-100 text-yellow-800',
  otro:      'bg-gray-100 text-gray-700',
};

export const TYPE_LABEL: Record<string, string> = {
  ampolla:   'Ampolla',
  accesorio: 'Accesorio',
  solucion:  'Solución',
  insumo:    'Insumo',
  otro:      'Otro',
};

type Props = {
  products: Product[];
  onSelect: (p: Product) => void;
};

export default function ProductsTable({ products, onSelect }: Props) {
  if (products.length === 0) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white px-6 py-14 text-center">
        <svg className="mx-auto mb-3 h-8 w-8 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
        </svg>
        <p className="text-sm font-medium text-gray-500">Sin resultados</p>
        <p className="mt-1 text-xs text-gray-400">Ajusta los filtros o la búsqueda</p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b border-gray-200 bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
            <tr>
              <th className="px-4 py-3 w-28">Tipo</th>
              <th className="px-4 py-3">Nombre / Compuesto</th>
              <th className="px-4 py-3 hidden md:table-cell">Marca</th>
              <th className="px-4 py-3 hidden lg:table-cell">Proveedor</th>
              <th className="px-4 py-3 text-right w-24">PVP</th>
              <th className="px-4 py-3 text-right w-20 hidden sm:table-cell">ML</th>
              <th className="px-4 py-3 text-center w-16">Estado</th>
              <th className="px-4 py-3 w-12" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {products.map(p => (
              <tr
                key={p.id}
                className="cursor-pointer transition-colors hover:bg-blue-50/60"
                onClick={() => onSelect(p)}
              >
                {/* Tipo */}
                <td className="px-4 py-3">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${TYPE_BADGE[p.product_type] ?? TYPE_BADGE.otro}`}>
                    {TYPE_LABEL[p.product_type] ?? p.product_type}
                  </span>
                </td>

                {/* Nombre */}
                <td className="px-4 py-3 max-w-[220px]">
                  <p className="font-medium text-gray-900 truncate">{p.name}</p>
                  {p.compound && p.compound !== p.name && (
                    <p className="text-xs text-gray-400 truncate">{p.compound}</p>
                  )}
                </td>

                {/* Marca */}
                <td className="px-4 py-3 hidden md:table-cell text-gray-600 text-xs">
                  {p.brand ?? '—'}
                </td>

                {/* Proveedor */}
                <td className="px-4 py-3 hidden lg:table-cell text-gray-500 text-xs">
                  {p.provider ?? '—'}
                </td>

                {/* PVP */}
                <td className="px-4 py-3 text-right font-mono text-gray-800">
                  {p.pvp > 0 ? `$${p.pvp.toFixed(2)}` : '—'}
                </td>

                {/* ML */}
                <td className="px-4 py-3 text-right text-gray-500 hidden sm:table-cell">
                  {p.ml != null ? `${p.ml}ml` : '—'}
                </td>

                {/* Estado */}
                <td className="px-4 py-3 text-center">
                  <span
                    title={p.active ? 'Activo' : 'Inactivo'}
                    className={`inline-block h-2 w-2 rounded-full ${p.active ? 'bg-green-500' : 'bg-gray-300'}`}
                  />
                </td>

                {/* Ver */}
                <td className="px-4 py-3">
                  <button
                    onClick={e => { e.stopPropagation(); onSelect(p); }}
                    className="text-xs font-medium text-blue-600 hover:underline"
                  >
                    Ver
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="border-t border-gray-100 px-4 py-2.5 text-xs text-gray-400">
        {products.length} producto{products.length !== 1 ? 's' : ''}
      </div>
    </div>
  );
}
