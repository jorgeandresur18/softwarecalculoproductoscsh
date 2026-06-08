'use client';

import { useState, useMemo, useEffect } from 'react';
import type { UserRole } from '@/types/database';
import type { SymptomWithCount } from './page';
import SymptomFilters, { type FilterState } from './SymptomFilters';
import SymptomsTable from './SymptomsTable';
import SymptomDetailModal from './SymptomDetailModal';
import SymptomCreateModal from './SymptomCreateModal';

type Props = {
  symptoms: SymptomWithCount[];
  userRole: UserRole;
};

const DEFAULT_FILTERS: FilterState = {
  search: '',
  status: 'active',
};

export default function SymptomsClient({ symptoms, userRole }: Props) {
  const [filters,    setFilters]    = useState<FilterState>(DEFAULT_FILTERS);
  const [selected,   setSelected]   = useState<SymptomWithCount | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!successMsg) return;
    const t = setTimeout(() => setSuccessMsg(null), 4000);
    return () => clearTimeout(t);
  }, [successMsg]);

  const filtered = useMemo(() => {
    const q = filters.search.toLowerCase().trim();
    return symptoms.filter(s => {
      if (q) {
        const haystack = [s.name, s.category, s.description]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      if (filters.status === 'active'   && !s.active) return false;
      if (filters.status === 'inactive' &&  s.active) return false;
      return true;
    });
  }, [symptoms, filters]);

  function handleUpdated(updated: SymptomWithCount) {
    setSelected(updated);
  }

  return (
    <div className="space-y-4">
      {/* Encabezado */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Síntomas</h2>
          <p className="mt-0.5 text-sm text-gray-500">
            Catálogo de padecimientos para la recomendación de sueros
          </p>
        </div>
        {userRole === 'admin' && (
          <div className="flex flex-shrink-0 items-center gap-2">
            <span className="rounded-full border border-purple-200 bg-purple-50 px-2.5 py-1 text-xs font-semibold text-purple-700">
              Modo administrador
            </span>
            <button
              onClick={() => setShowCreate(true)}
              className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-blue-700"
            >
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              Nuevo síntoma
            </button>
          </div>
        )}
      </div>

      {/* Mensaje de éxito */}
      {successMsg && (
        <div className="flex items-center gap-2 rounded-xl border border-green-200 bg-green-50 px-4 py-3">
          <svg className="h-4 w-4 flex-shrink-0 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
          <p className="text-sm font-medium text-green-700">{successMsg}</p>
        </div>
      )}

      {/* Filtros */}
      <SymptomFilters
        filters={filters}
        onChange={setFilters}
        total={symptoms.length}
        filtered={filtered.length}
      />

      {/* Tabla */}
      <SymptomsTable symptoms={filtered} onSelect={setSelected} />

      {/* Modal de detalle */}
      {selected && (
        <SymptomDetailModal
          symptom={selected}
          userRole={userRole}
          onClose={() => setSelected(null)}
          onUpdated={handleUpdated}
        />
      )}

      {/* Modal de creación */}
      {showCreate && (
        <SymptomCreateModal
          onClose={() => setShowCreate(false)}
          onCreated={() => {
            setShowCreate(false);
            setSuccessMsg('Síntoma creado correctamente. Ya aparece en el catálogo.');
          }}
        />
      )}
    </div>
  );
}
