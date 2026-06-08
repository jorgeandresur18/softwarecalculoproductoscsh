'use client';

import { useState, useMemo } from 'react';
import type { Symptom } from '@/types/database';

type Props = {
  symptoms: Symptom[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  onGenerate: () => void;
  isLoading: boolean;
};

export default function SymptomSelector({
  symptoms,
  selectedIds,
  onChange,
  onGenerate,
  isLoading,
}: Props) {
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return symptoms;
    return symptoms.filter(s => {
      const hay = [s.name, s.category, s.description].filter(Boolean).join(' ').toLowerCase();
      return hay.includes(q);
    });
  }, [symptoms, search]);

  const toggle = (id: string) => {
    if (selectedIds.includes(id)) {
      onChange(selectedIds.filter(x => x !== id));
    } else {
      onChange([...selectedIds, id]);
    }
  };

  const clearAll = () => onChange([]);

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-gray-700">Síntomas del paciente</h3>
        <div className="flex items-center gap-2">
          {selectedIds.length > 0 && (
            <>
              <span className="text-xs font-medium text-blue-600">
                {selectedIds.length} seleccionado{selectedIds.length > 1 ? 's' : ''}
              </span>
              <button
                onClick={clearAll}
                className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
              >
                Limpiar
              </button>
            </>
          )}
        </div>
      </div>

      <input
        type="text"
        value={search}
        onChange={e => setSearch(e.target.value)}
        placeholder="Buscar síntoma..."
        className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm focus:border-blue-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-100"
      />

      <div className="max-h-56 overflow-y-auto divide-y divide-gray-50 rounded-lg border border-gray-100">
        {filtered.length === 0 ? (
          <p className="px-3 py-4 text-center text-sm text-gray-400">Sin resultados</p>
        ) : (
          filtered.map(s => {
            const checked = selectedIds.includes(s.id);
            return (
              <label
                key={s.id}
                className={`flex cursor-pointer items-start gap-3 px-3 py-2.5 transition-colors hover:bg-gray-50 ${
                  checked ? 'bg-blue-50' : ''
                }`}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggle(s.id)}
                  className="mt-0.5 h-4 w-4 flex-shrink-0 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-800">{s.name}</p>
                  {s.category && (
                    <p className="text-xs text-gray-400">{s.category}</p>
                  )}
                </div>
              </label>
            );
          })
        )}
      </div>

      <button
        onClick={onGenerate}
        disabled={selectedIds.length === 0 || isLoading}
        className="w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isLoading ? 'Generando...' : 'Generar recomendación'}
      </button>
    </div>
  );
}
