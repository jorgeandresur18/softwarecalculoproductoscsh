'use client';

import type { SymptomWithCount } from './page';

type Props = {
  symptoms: SymptomWithCount[];
  onSelect: (s: SymptomWithCount) => void;
};

export default function SymptomsTable({ symptoms, onSelect }: Props) {
  if (symptoms.length === 0) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white px-6 py-14 text-center">
        <svg className="mx-auto mb-3 h-8 w-8 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round"
            d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
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
              <th className="px-4 py-3">Nombre</th>
              <th className="px-4 py-3 hidden sm:table-cell w-36">Categoría</th>
              <th className="px-4 py-3 hidden lg:table-cell">Descripción</th>
              <th className="px-4 py-3 text-center w-24">Productos</th>
              <th className="px-4 py-3 text-center w-16">Estado</th>
              <th className="px-4 py-3 w-12" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {symptoms.map(s => (
              <tr
                key={s.id}
                className="cursor-pointer transition-colors hover:bg-blue-50/60"
                onClick={() => onSelect(s)}
              >
                {/* Nombre */}
                <td className="px-4 py-3">
                  <p className="font-medium text-gray-900 truncate max-w-[220px]">{s.name}</p>
                </td>

                {/* Categoría */}
                <td className="px-4 py-3 hidden sm:table-cell">
                  {s.category ? (
                    <span className="rounded-full bg-indigo-50 border border-indigo-100 px-2 py-0.5 text-xs font-medium text-indigo-700">
                      {s.category}
                    </span>
                  ) : (
                    <span className="text-gray-400 text-xs">—</span>
                  )}
                </td>

                {/* Descripción */}
                <td className="px-4 py-3 hidden lg:table-cell text-xs text-gray-500 max-w-xs">
                  <p className="truncate">{s.description || '—'}</p>
                </td>

                {/* Productos */}
                <td className="px-4 py-3 text-center">
                  {s.product_count > 0 ? (
                    <span className="inline-flex items-center rounded-full bg-blue-100 px-2 py-0.5 text-xs font-semibold text-blue-700">
                      {s.product_count}
                    </span>
                  ) : (
                    <span className="text-xs text-gray-300">0</span>
                  )}
                </td>

                {/* Estado */}
                <td className="px-4 py-3 text-center">
                  <span
                    title={s.active ? 'Activo' : 'Inactivo'}
                    className={`inline-block h-2 w-2 rounded-full ${s.active ? 'bg-green-500' : 'bg-gray-300'}`}
                  />
                </td>

                {/* Ver */}
                <td className="px-4 py-3">
                  <button
                    onClick={e => { e.stopPropagation(); onSelect(s); }}
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
        {symptoms.length} síntoma{symptoms.length !== 1 ? 's' : ''}
      </div>
    </div>
  );
}
