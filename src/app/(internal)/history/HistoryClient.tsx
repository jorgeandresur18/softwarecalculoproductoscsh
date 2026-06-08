'use client';

import { useState, useMemo } from 'react';
import type { CalculationRow } from './actions';
import HistoryFilters, { type FilterState, type DateRange } from './HistoryFilters';
import HistoryTable from './HistoryTable';
import CalculationDetailModal from './CalculationDetailModal';

type Props = {
  calculations: CalculationRow[];
};

const DEFAULT_FILTERS: FilterState = {
  search:    '',
  dateRange: 'all',
};

function isInRange(isoDate: string, range: DateRange): boolean {
  if (range === 'all') return true;
  const date  = new Date(isoDate).getTime();
  const now   = Date.now();
  const day   = 86_400_000;
  if (range === 'today') {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    return date >= start.getTime();
  }
  if (range === '7d')  return date >= now - 7  * day;
  if (range === '30d') return date >= now - 30 * day;
  return true;
}

export default function HistoryClient({ calculations }: Props) {
  const [filters,  setFilters]  = useState<FilterState>(DEFAULT_FILTERS);
  const [selected, setSelected] = useState<CalculationRow | null>(null);

  const filtered = useMemo(() => {
    const q = filters.search.toLowerCase().trim();
    return calculations.filter(c => {
      if (!isInRange(c.created_at, filters.dateRange)) return false;
      if (q) {
        const hay = [c.patient_reference, c.patient_city, c.symptoms_text]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [calculations, filters]);

  return (
    <div className="space-y-4">
      {/* Encabezado */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Historial de cálculos</h2>
          <p className="mt-0.5 text-sm text-gray-500">
            Registro de todos los sueros calculados, ordenados por fecha.
          </p>
        </div>
        <span className="flex-shrink-0 rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700">
          {calculations.length} total
        </span>
      </div>

      {/* Filtros */}
      <HistoryFilters
        filters={filters}
        onChange={setFilters}
        total={calculations.length}
        filtered={filtered.length}
      />

      {/* Tabla */}
      <HistoryTable calculations={filtered} onSelect={setSelected} />

      {/* Modal de detalle */}
      {selected && (
        <CalculationDetailModal
          calculation={selected}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
}
