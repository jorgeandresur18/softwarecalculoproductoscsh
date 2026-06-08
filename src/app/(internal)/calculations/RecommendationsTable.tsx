'use client';

import type { RecommendationResult } from './actions';
import type { SelectedProduct } from './CalculationClient';

const LEVEL_BADGE: Record<string, string> = {
  alto:  'bg-green-100 text-green-800 border border-green-200',
  medio: 'bg-yellow-100 text-yellow-800 border border-yellow-200',
  bajo:  'bg-gray-100 text-gray-600 border border-gray-200',
};

const LEVEL_LABEL: Record<string, string> = {
  alto:  'Alto',
  medio: 'Medio',
  bajo:  'Bajo',
};

type Props = {
  recommendations: RecommendationResult[];
  onAdd: (product: SelectedProduct) => void;
  addedIds: string[];
};

export default function RecommendationsTable({ recommendations, onAdd, addedIds }: Props) {
  if (!recommendations.length) return null;

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 space-y-3">
      <h3 className="text-sm font-semibold text-gray-700">
        Recomendaciones generadas ({recommendations.length})
      </h3>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-100 text-sm">
          <thead>
            <tr className="text-xs text-gray-500 bg-gray-50">
              <th className="py-2 pl-3 pr-3 text-left font-medium">Producto</th>
              <th className="py-2 pr-3 text-left font-medium">Tipo</th>
              <th className="py-2 pr-3 text-left font-medium">Nivel</th>
              <th className="py-2 pr-3 text-right font-medium">PVP</th>
              <th className="py-2 pr-3 text-left font-medium hidden sm:table-cell">Síntomas</th>
              <th className="py-2 pr-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {recommendations.map(r => {
              const noPvp = !r.pvp || r.pvp <= 0;
              const alreadyAdded = addedIds.includes(r.product_id);
              return (
                <tr key={r.product_id} className="hover:bg-gray-50 transition-colors">
                  <td className="py-2.5 pl-3 pr-3">
                    <p className="font-medium text-gray-900">{r.product_name}</p>
                    {r.brand && (
                      <p className="text-xs text-gray-400">{r.brand}</p>
                    )}
                    {r.reason && (
                      <p className="text-xs text-gray-500 italic mt-0.5">{r.reason}</p>
                    )}
                    {noPvp && (
                      <p className="mt-0.5 text-xs font-semibold text-red-500">
                        ⚠ Producto sin precio configurado
                      </p>
                    )}
                  </td>
                  <td className="py-2.5 pr-3 text-xs text-gray-500 capitalize whitespace-nowrap">
                    {r.product_type}
                  </td>
                  <td className="py-2.5 pr-3 whitespace-nowrap">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        LEVEL_BADGE[r.recommendation_level] ?? LEVEL_BADGE.bajo
                      }`}
                    >
                      {LEVEL_LABEL[r.recommendation_level] ?? r.recommendation_level}
                    </span>
                  </td>
                  <td className="py-2.5 pr-3 text-right whitespace-nowrap">
                    {noPvp ? (
                      <span className="text-red-400 text-xs">—</span>
                    ) : (
                      <span className="font-medium text-gray-800">${r.pvp.toFixed(2)}</span>
                    )}
                  </td>
                  <td className="py-2.5 pr-3 max-w-[160px] hidden sm:table-cell">
                    <p className="text-xs text-gray-400 truncate">
                      {r.symptom_names.join(', ')}
                    </p>
                  </td>
                  <td className="py-2.5 pr-3 text-right">
                    <button
                      onClick={() => {
                        if (!noPvp && !alreadyAdded) {
                          onAdd({
                            product_id:   r.product_id,
                            name:         r.product_name,
                            product_type: r.product_type,
                            brand:        r.brand,
                            pvp:          r.pvp,
                            quantity:     1,
                          });
                        }
                      }}
                      disabled={noPvp || alreadyAdded}
                      title={noPvp ? 'Producto sin precio configurado' : undefined}
                      className="rounded-md bg-blue-50 border border-blue-200 px-2.5 py-1 text-xs font-medium text-blue-700 hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-40 transition-colors whitespace-nowrap"
                    >
                      {alreadyAdded ? 'Agregado' : 'Agregar'}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
