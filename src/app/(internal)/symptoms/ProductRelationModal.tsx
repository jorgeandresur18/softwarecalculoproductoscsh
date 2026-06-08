'use client';

import { useState, useEffect, useCallback } from 'react';
import type { RecommendationLevel } from '@/types/database';
import { getActiveProducts, createProductSymptom } from './actions';

type ProductOption = {
  id:           string;
  name:         string;
  product_type: string;
  brand:        string | null;
  pvp:          number;
};

const TYPE_LABEL: Record<string, string> = {
  ampolla: 'Ampolla', accesorio: 'Accesorio', solucion: 'Solución',
  insumo: 'Insumo', otro: 'Otro',
};

const INPUT =
  'w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 ' +
  'placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500';

const INPUT_ERROR =
  'w-full rounded-lg border border-red-300 px-3 py-2 text-sm text-gray-900 ' +
  'placeholder-gray-400 focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-400';

type Props = {
  symptomId:          string;
  existingProductIds: string[];
  onClose:            () => void;
  onCreated:          () => void;
};

export default function ProductRelationModal({
  symptomId, existingProductIds, onClose, onCreated,
}: Props) {
  const [products,   setProducts]   = useState<ProductOption[] | null>(null);
  const [loadError,  setLoadError]  = useState<string | null>(null);
  const [search,     setSearch]     = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [level,      setLevel]      = useState<RecommendationLevel>('medio');
  const [reason,     setReason]     = useState('');
  const [active,     setActive]     = useState(true);
  const [productErr, setProductErr] = useState<string | null>(null);
  const [saveError,  setSaveError]  = useState<string | null>(null);
  const [saving,     setSaving]     = useState(false);

  useEffect(() => {
    getActiveProducts().then(result => {
      if (result.error) setLoadError(result.error);
      else setProducts(result.data ?? []);
    });
  }, []);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); },
    [onClose],
  );
  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  const filtered = (products ?? []).filter(p => {
    const q = search.toLowerCase().trim();
    if (!q) return true;
    return [p.name, p.brand, p.product_type]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()
      .includes(q);
  });

  async function handleSave() {
    if (!selectedId) {
      setProductErr('Selecciona un producto de la lista.');
      return;
    }
    setSaving(true);
    setSaveError(null);

    const result = await createProductSymptom({
      symptom_id:           symptomId,
      product_id:           selectedId,
      recommendation_level: level,
      reason:               reason.trim() || null,
      active,
    });

    setSaving(false);

    if (result.error) {
      setSaveError(result.error);
      return;
    }

    onCreated();
  }

  return (
    <div
      className="fixed inset-0 flex items-center justify-center bg-black/50 p-4"
      style={{ zIndex: 60 }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="relative flex w-full max-w-lg flex-col rounded-2xl bg-white shadow-2xl"
        style={{ maxHeight: '88vh' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex flex-shrink-0 items-center justify-between border-b border-gray-100 px-6 py-4">
          <div>
            <h2 className="text-base font-bold text-gray-900">Agregar producto relacionado</h2>
            <p className="mt-0.5 text-xs text-gray-400">Selecciona un producto y define el nivel de recomendación</p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Contenido scrollable */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">

          {/* Búsqueda */}
          <div>
            <label className="mb-1 block text-xs font-semibold text-gray-600">
              Buscar producto *
            </label>
            <input
              type="text"
              value={search}
              onChange={e => { setSearch(e.target.value); setProductErr(null); }}
              placeholder="Nombre o marca…"
              className={productErr ? INPUT_ERROR : INPUT}
              autoFocus
            />
            {productErr && <p className="mt-1 text-xs text-red-600">{productErr}</p>}
          </div>

          {/* Lista de productos */}
          {loadError ? (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              Error al cargar productos: {loadError}
            </div>
          ) : products === null ? (
            <div className="space-y-2">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-10 animate-pulse rounded-lg bg-gray-100" />
              ))}
            </div>
          ) : (
            <div
              className="overflow-y-auto rounded-xl border border-gray-200"
              style={{ maxHeight: '220px' }}
            >
              {filtered.length === 0 ? (
                <p className="px-4 py-3 text-sm text-gray-400 italic">
                  {search ? 'Sin resultados para esa búsqueda.' : 'No hay productos activos.'}
                </p>
              ) : (
                <ul className="divide-y divide-gray-100">
                  {filtered.map(p => {
                    const alreadyLinked = existingProductIds.includes(p.id);
                    const isSelected    = selectedId === p.id;
                    return (
                      <li key={p.id}>
                        <button
                          type="button"
                          disabled={alreadyLinked}
                          onClick={() => { setSelectedId(p.id); setProductErr(null); }}
                          className={[
                            'w-full px-3 py-2.5 text-left transition-colors',
                            isSelected
                              ? 'bg-blue-50 ring-1 ring-inset ring-blue-300'
                              : 'hover:bg-gray-50',
                            alreadyLinked ? 'cursor-not-allowed opacity-50' : '',
                          ].join(' ')}
                        >
                          <div className="flex items-center justify-between gap-3">
                            <div className="min-w-0">
                              <p className="truncate text-sm font-medium text-gray-900">
                                {p.name}
                              </p>
                              <p className="text-xs text-gray-400">
                                {TYPE_LABEL[p.product_type] ?? p.product_type}
                                {p.brand ? ` · ${p.brand}` : ''}
                                {alreadyLinked ? ' · Ya relacionado' : ''}
                              </p>
                            </div>
                            <span className="flex-shrink-0 font-mono text-sm text-gray-600">
                              {p.pvp > 0
                                ? `$${p.pvp.toFixed(2)}`
                                : <span className="text-amber-500 font-sans text-xs">Sin precio</span>
                              }
                            </span>
                          </div>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          )}

          {/* Nivel y activo */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-semibold text-gray-600">
                Nivel de recomendación *
              </label>
              <select
                value={level}
                onChange={e => setLevel(e.target.value as RecommendationLevel)}
                className={INPUT}
              >
                <option value="alto">Alto</option>
                <option value="medio">Medio</option>
                <option value="bajo">Bajo</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-gray-600">Estado</label>
              <label className="flex h-[38px] cursor-pointer items-center gap-2">
                <input
                  type="checkbox"
                  checked={active}
                  onChange={e => setActive(e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm text-gray-700">Relación activa</span>
              </label>
            </div>
          </div>

          {/* Motivo */}
          <div>
            <label className="mb-1 block text-xs font-semibold text-gray-600">
              Motivo de la recomendación
            </label>
            <input
              type="text"
              value={reason}
              onChange={e => setReason(e.target.value)}
              placeholder="¿Por qué se recomienda este producto para este síntoma?"
              className={INPUT}
            />
          </div>

          {saveError && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm font-medium text-red-700">
              {saveError}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex flex-shrink-0 items-center justify-between border-t border-gray-100 px-6 py-4">
          <button
            onClick={onClose}
            disabled={saving}
            className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={saving || products === null}
            className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? 'Guardando…' : 'Agregar relación'}
          </button>
        </div>
      </div>
    </div>
  );
}
