'use client';

import type { CalculationRow } from './actions';

type Props = {
  calculations: CalculationRow[];
  onSelect:     (calc: CalculationRow) => void;
};

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('es-EC', {
    day:   '2-digit',
    month: 'short',
    year:  'numeric',
    hour:  '2-digit',
    minute:'2-digit',
  });
}

export default function HistoryTable({ calculations, onSelect }: Props) {
  if (!calculations.length) {
    return (
      <div className="rounded-xl border border-dashed border-gray-200 bg-white px-6 py-12 text-center">
        <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-gray-100">
          <svg
            className="h-5 w-5 text-gray-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.5}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
        </div>
        <p className="text-sm font-medium text-gray-500">No hay cálculos guardados todavía.</p>
        <p className="mt-1 text-xs text-gray-400">
          Los cálculos creados desde el módulo "Calcular Suero" aparecerán aquí.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-100 text-sm">
          <thead>
            <tr className="bg-gray-50 text-xs text-gray-500">
              <th className="py-3 pl-5 pr-3 text-left font-medium">Fecha</th>
              <th className="py-3 pr-3 text-left font-medium">Paciente</th>
              <th className="py-3 pr-3 text-left font-medium hidden sm:table-cell">Ciudad</th>
              <th className="py-3 pr-3 text-left font-medium hidden md:table-cell">Síntomas</th>
              <th className="py-3 pr-3 text-right font-medium">Subtotal</th>
              <th className="py-3 pr-3 text-right font-medium hidden sm:table-cell">Descuento</th>
              <th className="py-3 pr-3 text-right font-medium">Total</th>
              <th className="py-3 pr-5" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {calculations.map(calc => (
              <tr
                key={calc.id}
                className="hover:bg-gray-50 transition-colors cursor-pointer"
                onClick={() => onSelect(calc)}
              >
                <td className="py-3 pl-5 pr-3 whitespace-nowrap">
                  <p className="text-xs text-gray-500">{formatDate(calc.created_at)}</p>
                </td>
                <td className="py-3 pr-3">
                  {calc.patient_reference ? (
                    <p className="font-medium text-gray-800 truncate max-w-[120px]">
                      {calc.patient_reference}
                    </p>
                  ) : (
                    <span className="text-xs text-gray-400 italic">Sin referencia</span>
                  )}
                </td>
                <td className="py-3 pr-3 hidden sm:table-cell">
                  {calc.patient_city ? (
                    <p className="text-sm text-gray-600 truncate max-w-[100px]">{calc.patient_city}</p>
                  ) : (
                    <span className="text-xs text-gray-400">—</span>
                  )}
                </td>
                <td className="py-3 pr-3 hidden md:table-cell max-w-[180px]">
                  {calc.symptoms_text ? (
                    <p className="text-xs text-gray-500 truncate">{calc.symptoms_text}</p>
                  ) : (
                    <span className="text-xs text-gray-400">—</span>
                  )}
                </td>
                <td className="py-3 pr-3 text-right whitespace-nowrap">
                  <span className="text-sm text-gray-700">${calc.subtotal_products.toFixed(2)}</span>
                </td>
                <td className="py-3 pr-3 text-right hidden sm:table-cell whitespace-nowrap">
                  {calc.discount_amount > 0 ? (
                    <span className="text-sm text-green-600">−${calc.discount_amount.toFixed(2)}</span>
                  ) : (
                    <span className="text-xs text-gray-400">—</span>
                  )}
                </td>
                <td className="py-3 pr-3 text-right whitespace-nowrap">
                  <span className="font-semibold text-gray-900">${calc.final_price.toFixed(2)}</span>
                </td>
                <td className="py-3 pr-5 text-right">
                  <button
                    onClick={e => { e.stopPropagation(); onSelect(calc); }}
                    className="rounded-md bg-blue-50 border border-blue-200 px-2.5 py-1 text-xs font-medium text-blue-700 hover:bg-blue-100 transition-colors whitespace-nowrap"
                  >
                    Ver detalle
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
