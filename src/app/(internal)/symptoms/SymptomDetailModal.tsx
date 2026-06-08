'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import type { UserRole, RecommendationLevel } from '@/types/database';
import type { SymptomWithCount } from './page';
import {
  getSymptomProducts,
  updateSymptom,
  updateProductSymptom,
  type ProductSymptomRow,
} from './actions';
import ProductRelationModal from './ProductRelationModal';

// ── Constantes visuales ───────────────────────────────────────────────────────

const LEVEL_BADGE: Record<RecommendationLevel, string> = {
  alto:  'bg-red-100 text-red-800 border-red-200',
  medio: 'bg-amber-100 text-amber-800 border-amber-200',
  bajo:  'bg-green-100 text-green-800 border-green-200',
};
const LEVEL_LABEL: Record<RecommendationLevel, string> = {
  alto: 'Alto', medio: 'Medio', bajo: 'Bajo',
};
const TYPE_LABEL: Record<string, string> = {
  ampolla: 'Ampolla', accesorio: 'Accesorio', solucion: 'Solución',
  insumo: 'Insumo', otro: 'Otro',
};

const INPUT =
  'w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 ' +
  'placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500';

// ── Tipos internos ────────────────────────────────────────────────────────────

type SymptomEditData = {
  name:        string;
  category:    string;
  description: string;
  active:      boolean;
};

type RelEditData = {
  recommendation_level: RecommendationLevel;
  reason:               string;
  active:               boolean;
};

type Props = {
  symptom:   SymptomWithCount;
  userRole:  UserRole;
  onClose:   () => void;
  onUpdated: (updated: SymptomWithCount) => void;
};

// ── Modal principal ───────────────────────────────────────────────────────────

export default function SymptomDetailModal({
  symptom, userRole, onClose, onUpdated,
}: Props) {
  const [isEditing,  setIsEditing]  = useState(false);
  const [saving,     setSaving]     = useState(false);
  const [saveError,  setSaveError]  = useState<string | null>(null);
  const [editData,   setEditData]   = useState<SymptomEditData>(toEditData(symptom));

  const [products,    setProducts]    = useState<ProductSymptomRow[] | null>(null);
  const [loadingProd, setLoadingProd] = useState(true);
  const [loadError,   setLoadError]   = useState<string | null>(null);

  const [editRelId,      setEditRelId]      = useState<string | null>(null);
  const [showAddRelation, setShowAddRelation] = useState(false);

  const router = useRouter();

  // Sincronizar form cuando cambia el síntoma seleccionado
  useEffect(() => {
    setEditData(toEditData(symptom));
    setIsEditing(false);
    setSaveError(null);
    setEditRelId(null);
    setProducts(null);
    setLoadingProd(true);
    setLoadError(null);
  }, [symptom.id]);

  // Cargar productos relacionados
  useEffect(() => {
    let cancelled = false;
    setLoadingProd(true);
    setLoadError(null);

    getSymptomProducts(symptom.id).then(result => {
      if (cancelled) return;
      if (result.error) {
        setLoadError(result.error);
      } else {
        setProducts(result.data ?? []);
      }
      setLoadingProd(false);
    });

    return () => { cancelled = true; };
  }, [symptom.id]);

  // Cerrar con Escape
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); },
    [onClose],
  );
  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  function set(partial: Partial<SymptomEditData>) {
    setEditData(prev => ({ ...prev, ...partial }));
  }

  async function handleSave() {
    setSaving(true);
    setSaveError(null);

    const result = await updateSymptom(symptom.id, {
      name:        editData.name.trim(),
      category:    editData.category.trim()    || null,
      description: editData.description.trim() || null,
      active:      editData.active,
    });

    setSaving(false);

    if (result.error) { setSaveError(result.error); return; }

    onUpdated({
      ...symptom,
      name:        editData.name.trim(),
      category:    editData.category.trim()    || null,
      description: editData.description.trim() || null,
      active:      editData.active,
    });

    setIsEditing(false);
    router.refresh();
  }

  function handleRelUpdated(updatedRel: ProductSymptomRow) {
    setProducts(prev =>
      prev ? prev.map(p => p.id === updatedRel.id ? updatedRel : p) : prev,
    );
    setEditRelId(null);
  }

  async function reloadProducts() {
    setShowAddRelation(false);
    const result = await getSymptomProducts(symptom.id);
    if (!result.error) {
      setProducts(result.data ?? []);
    }
    router.refresh();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="relative flex w-full max-w-2xl flex-col rounded-2xl bg-white shadow-2xl"
        style={{ maxHeight: '90vh' }}
        onClick={e => e.stopPropagation()}
      >
        {/* ── Header ─────────────────────────────────────────────────── */}
        <div className="flex flex-shrink-0 items-start gap-3 border-b border-gray-100 px-6 py-4">
          <div className="min-w-0 flex-1">
            <div className="mb-1 flex flex-wrap items-center gap-2">
              {symptom.category && (
                <span className="rounded-full border border-indigo-100 bg-indigo-50 px-2 py-0.5 text-xs font-semibold text-indigo-700">
                  {symptom.category}
                </span>
              )}
              <span className={`flex items-center gap-1 text-xs font-medium ${symptom.active ? 'text-green-600' : 'text-gray-400'}`}>
                <span className={`h-1.5 w-1.5 rounded-full ${symptom.active ? 'bg-green-500' : 'bg-gray-300'}`} />
                {symptom.active ? 'Activo' : 'Inactivo'}
              </span>
            </div>
            <h2 className="break-words text-base font-bold text-gray-900">
              {isEditing ? 'Editar síntoma' : symptom.name}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="flex-shrink-0 rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* ── Contenido scrollable ─────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
          {isEditing ? (
            <SymptomEditForm
              data={editData}
              onChange={set}
              saving={saving}
              error={saveError}
              onSave={handleSave}
              onCancel={() => { setIsEditing(false); setSaveError(null); }}
            />
          ) : (
            <>
              {/* Detalle del síntoma */}
              <dl className="divide-y divide-gray-100 text-sm">
                <Row label="Nombre"      value={symptom.name} />
                <Row label="Categoría"   value={symptom.category   || '—'} />
                <Row label="Descripción" value={symptom.description || '—'} />
              </dl>

              {/* Productos relacionados */}
              <div>
                <div className="mb-3 flex items-center justify-between gap-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Productos relacionados
                    {products !== null && (
                      <span className="ml-2 rounded-full bg-blue-100 px-1.5 py-0.5 text-blue-700 normal-case font-semibold">
                        {products.length}
                      </span>
                    )}
                  </p>
                  {userRole === 'admin' && !loadingProd && !loadError && (
                    <button
                      onClick={() => setShowAddRelation(true)}
                      className="flex items-center gap-1 rounded-lg bg-blue-600 px-2.5 py-1 text-xs font-semibold text-white transition-colors hover:bg-blue-700"
                    >
                      <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                      </svg>
                      Agregar producto
                    </button>
                  )}
                </div>

                {loadingProd && <ProductsLoading />}
                {loadError   && <LoadError message={loadError} />}

                {!loadingProd && !loadError && products !== null && (
                  products.length === 0 ? (
                    <p className="text-sm text-gray-400 italic">
                      Este síntoma no tiene productos relacionados.
                    </p>
                  ) : (
                    <div className="overflow-hidden rounded-xl border border-gray-200">
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead className="border-b border-gray-200 bg-gray-50 text-xs font-semibold uppercase tracking-wide text-gray-500">
                            <tr>
                              <th className="px-3 py-2.5 text-left">Producto</th>
                              <th className="px-3 py-2.5 text-left hidden sm:table-cell w-24">Tipo</th>
                              <th className="px-3 py-2.5 text-right w-20">PVP</th>
                              <th className="px-3 py-2.5 text-center w-20">Nivel</th>
                              <th className="px-3 py-2.5 text-left hidden md:table-cell">Motivo</th>
                              {userRole === 'admin' && <th className="px-3 py-2.5 w-16" />}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100">
                            {products.map(ps => (
                              editRelId === ps.id ? (
                                <RelationEditRow
                                  key={ps.id}
                                  ps={ps}
                                  onSaved={handleRelUpdated}
                                  onCancel={() => setEditRelId(null)}
                                  colSpan={userRole === 'admin' ? 6 : 5}
                                />
                              ) : (
                                <RelationViewRow
                                  key={ps.id}
                                  ps={ps}
                                  userRole={userRole}
                                  onEdit={() => setEditRelId(ps.id)}
                                />
                              )
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )
                )}
              </div>
            </>
          )}
        </div>

        {/* ── Footer ──────────────────────────────────────────────────── */}
        {!isEditing && (
          <div className="flex flex-shrink-0 items-center justify-between border-t border-gray-100 px-6 py-4">
            <button
              onClick={onClose}
              className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50"
            >
              Cerrar
            </button>
            {userRole === 'admin' && (
              <button
                onClick={() => setIsEditing(true)}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-700"
              >
                Editar síntoma
              </button>
            )}
          </div>
        )}
      </div>

      {/* Modal para agregar producto relacionado (z-60 sobre este z-50) */}
      {showAddRelation && (
        <ProductRelationModal
          symptomId={symptom.id}
          existingProductIds={(products ?? [])
            .filter(p => p.products)
            .map(p => p.products!.id)}
          onClose={() => setShowAddRelation(false)}
          onCreated={reloadProducts}
        />
      )}
    </div>
  );
}

// ── Fila de vista ─────────────────────────────────────────────────────────────

function RelationViewRow({
  ps, userRole, onEdit,
}: {
  ps: ProductSymptomRow;
  userRole: UserRole;
  onEdit: () => void;
}) {
  const noPvp = !ps.products?.pvp || ps.products.pvp === 0;

  return (
    <tr className={`transition-colors hover:bg-gray-50 ${!ps.active ? 'opacity-50' : ''}`}>
      <td className="px-3 py-2.5">
        <div>
          <p className="font-medium text-gray-900 text-sm truncate max-w-[180px]">
            {ps.products?.name ?? '—'}
          </p>
          {noPvp && (
            <p className="mt-0.5 text-xs font-medium text-amber-600">
              ⚠ Producto sin precio configurado
            </p>
          )}
          {!ps.active && (
            <p className="mt-0.5 text-xs text-gray-400">Relación inactiva</p>
          )}
        </div>
      </td>
      <td className="px-3 py-2.5 hidden sm:table-cell">
        <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
          {TYPE_LABEL[ps.products?.product_type ?? ''] ?? ps.products?.product_type ?? '—'}
        </span>
      </td>
      <td className="px-3 py-2.5 text-right font-mono text-sm">
        {noPvp ? (
          <span className="text-amber-500">—</span>
        ) : (
          <span className="text-gray-800">${ps.products!.pvp.toFixed(2)}</span>
        )}
      </td>
      <td className="px-3 py-2.5 text-center">
        <span className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${LEVEL_BADGE[ps.recommendation_level]}`}>
          {LEVEL_LABEL[ps.recommendation_level]}
        </span>
      </td>
      <td className="px-3 py-2.5 hidden md:table-cell text-xs text-gray-500 max-w-[140px]">
        <p className="truncate">{ps.reason || '—'}</p>
      </td>
      {userRole === 'admin' && (
        <td className="px-3 py-2.5 text-right">
          <button
            onClick={onEdit}
            className="text-xs font-medium text-blue-600 hover:underline"
          >
            Editar
          </button>
        </td>
      )}
    </tr>
  );
}

// ── Fila de edición inline ────────────────────────────────────────────────────

function RelationEditRow({
  ps, onSaved, onCancel, colSpan,
}: {
  ps:       ProductSymptomRow;
  onSaved:  (updated: ProductSymptomRow) => void;
  onCancel: () => void;
  colSpan:  number;
}) {
  const [data,    setData]    = useState<RelEditData>(toRelEditData(ps));
  const [saving,  setSaving]  = useState(false);
  const [error,   setError]   = useState<string | null>(null);

  function set(partial: Partial<RelEditData>) {
    setData(prev => ({ ...prev, ...partial }));
  }

  async function handleSave() {
    setSaving(true);
    setError(null);

    const result = await updateProductSymptom(ps.id, {
      recommendation_level: data.recommendation_level,
      reason:               data.reason.trim() || null,
      active:               data.active,
    });

    setSaving(false);

    if (result.error) { setError(result.error); return; }

    onSaved({
      ...ps,
      recommendation_level: data.recommendation_level,
      reason:               data.reason.trim() || null,
      active:               data.active,
    });
  }

  return (
    <tr className="bg-blue-50/40">
      <td colSpan={colSpan} className="px-3 py-3">
        <p className="mb-2 text-xs font-semibold text-gray-700 truncate">
          Editando relación: {ps.products?.name}
        </p>
        <div className="flex flex-wrap items-end gap-2">
          {/* Nivel */}
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">Nivel</label>
            <select
              value={data.recommendation_level}
              onChange={e => set({ recommendation_level: e.target.value as RecommendationLevel })}
              className="rounded-lg border border-gray-300 bg-white px-2.5 py-1.5 text-sm text-gray-800
                         focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="alto">Alto</option>
              <option value="medio">Medio</option>
              <option value="bajo">Bajo</option>
            </select>
          </div>

          {/* Motivo */}
          <div className="flex-1 min-w-[140px]">
            <label className="mb-1 block text-xs font-medium text-gray-600">Motivo</label>
            <input
              type="text"
              value={data.reason}
              onChange={e => set({ reason: e.target.value })}
              placeholder="Motivo de la recomendación…"
              className="w-full rounded-lg border border-gray-300 px-2.5 py-1.5 text-sm text-gray-900
                         placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          {/* Activo */}
          <label className="flex items-center gap-1.5 cursor-pointer pb-1.5">
            <input
              type="checkbox"
              checked={data.active}
              onChange={e => set({ active: e.target.checked })}
              className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-xs font-medium text-gray-700">Activa</span>
          </label>

          {/* Acciones */}
          <div className="flex gap-2 pb-0.5">
            <button
              onClick={onCancel}
              disabled={saving}
              className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600
                         hover:bg-gray-50 disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white
                         hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? 'Guardando…' : 'Guardar'}
            </button>
          </div>
        </div>

        {error && (
          <p className="mt-2 text-xs text-red-600">{error}</p>
        )}
      </td>
    </tr>
  );
}

// ── Formulario de edición del síntoma ────────────────────────────────────────

function SymptomEditForm({
  data, onChange, saving, error, onSave, onCancel,
}: {
  data:     SymptomEditData;
  onChange: (partial: Partial<SymptomEditData>) => void;
  saving:   boolean;
  error:    string | null;
  onSave:   () => void;
  onCancel: () => void;
}) {
  return (
    <div className="space-y-4">
      <Field label="Nombre *">
        <input
          type="text"
          value={data.name}
          onChange={e => onChange({ name: e.target.value })}
          className={INPUT}
          placeholder="Nombre del síntoma"
        />
      </Field>

      <Field label="Categoría">
        <input
          type="text"
          value={data.category}
          onChange={e => onChange({ category: e.target.value })}
          className={INPUT}
          placeholder="Ej: Piel, Sistema nervioso, Metabólico…"
        />
      </Field>

      <Field label="Descripción">
        <textarea
          value={data.description}
          onChange={e => onChange({ description: e.target.value })}
          rows={3}
          className={INPUT + ' resize-none'}
          placeholder="Descripción del síntoma o padecimiento…"
        />
      </Field>

      <label className="flex cursor-pointer items-center gap-2.5">
        <input
          type="checkbox"
          checked={data.active}
          onChange={e => onChange({ active: e.target.checked })}
          className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
        />
        <span className="text-sm font-medium text-gray-700">Síntoma activo</span>
      </label>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="flex items-center justify-between border-t border-gray-100 pt-4">
        <button
          type="button"
          onClick={onCancel}
          disabled={saving}
          className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600
                     hover:bg-gray-50 disabled:opacity-50"
        >
          Cancelar
        </button>
        <button
          type="button"
          onClick={onSave}
          disabled={saving || !data.name.trim()}
          className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-semibold text-white
                     transition-colors hover:bg-blue-700 disabled:opacity-50"
        >
          {saving ? 'Guardando…' : 'Guardar cambios'}
        </button>
      </div>
    </div>
  );
}

// ── Sub-componentes de UI ─────────────────────────────────────────────────────

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2">
      <dt className="flex-shrink-0 text-sm text-gray-500">{label}</dt>
      <dd className="max-w-xs break-words text-right text-sm text-gray-900">{value}</dd>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-semibold text-gray-600">{label}</label>
      {children}
    </div>
  );
}

function ProductsLoading() {
  return (
    <div className="space-y-2">
      {[1, 2, 3].map(i => (
        <div key={i} className="h-10 animate-pulse rounded-lg bg-gray-100" />
      ))}
    </div>
  );
}

function LoadError({ message }: { message: string }) {
  return (
    <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
      Error al cargar productos: {message}
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function toEditData(s: SymptomWithCount): SymptomEditData {
  return {
    name:        s.name,
    category:    s.category    ?? '',
    description: s.description ?? '',
    active:      s.active,
  };
}

function toRelEditData(ps: ProductSymptomRow): RelEditData {
  return {
    recommendation_level: ps.recommendation_level,
    reason:               ps.reason ?? '',
    active:               ps.active,
  };
}
