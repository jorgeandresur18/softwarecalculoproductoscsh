'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import type { Product, UserRole } from '@/types/database';
import { updateProduct } from './actions';
import { TYPE_BADGE, TYPE_LABEL } from './ProductsTable';

// ── Tipos ─────────────────────────────────────────────────────────────

type EditData = {
  name: string;
  brand: string;
  provider: string;
  compound: string;
  pvp: string;
  ml: string;
  measure: string;
  observations: string;
  active: boolean;
};

type Props = {
  product: Product;
  userRole: UserRole;
  onClose: () => void;
  onUpdated: (updated: Product) => void;
};

// ── Modal principal ───────────────────────────────────────────────────

export default function ProductDetailModal({ product, userRole, onClose, onUpdated }: Props) {
  const [isEditing, setIsEditing] = useState(false);
  const [saving,    setSaving]    = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [editData,  setEditData]  = useState<EditData>(toEditData(product));
  const router = useRouter();

  // Sincronizar form cuando cambia el producto seleccionado
  useEffect(() => {
    setEditData(toEditData(product));
    setIsEditing(false);
    setSaveError(null);
  }, [product.id]);

  // Cerrar con Escape
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); },
    [onClose],
  );
  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  function set(partial: Partial<EditData>) {
    setEditData(prev => ({ ...prev, ...partial }));
  }

  async function handleSave() {
    setSaving(true);
    setSaveError(null);

    const result = await updateProduct(product.id, {
      name:         editData.name.trim(),
      brand:        editData.brand.trim()        || null,
      provider:     editData.provider.trim()     || null,
      compound:     editData.compound.trim()     || null,
      pvp:          parseFloat(editData.pvp)     || 0,
      ml:           editData.ml ? parseFloat(editData.ml) : null,
      measure:      editData.measure.trim()      || null,
      observations: editData.observations.trim() || null,
      active:       editData.active,
    });

    setSaving(false);

    if (result.error) {
      setSaveError(result.error);
      return;
    }

    // Actualizar dato local para ver el cambio inmediatamente
    onUpdated({
      ...product,
      name:         editData.name.trim(),
      brand:        editData.brand.trim()        || null,
      provider:     editData.provider.trim()     || null,
      compound:     editData.compound.trim()     || null,
      pvp:          parseFloat(editData.pvp)     || 0,
      ml:           editData.ml ? parseFloat(editData.ml) : null,
      measure:      editData.measure.trim()      || null,
      observations: editData.observations.trim() || null,
      active:       editData.active,
    });

    setIsEditing(false);
    router.refresh(); // Re-fetch en el servidor
  }

  const conditions = product.conditions_text
    ? product.conditions_text.split(',').map(s => s.trim()).filter(Boolean)
    : [];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="relative flex w-full max-w-lg flex-col rounded-2xl bg-white shadow-2xl"
        style={{ maxHeight: '90vh' }}
        onClick={e => e.stopPropagation()}
      >
        {/* ── Header ────────────────────────────────────────────────── */}
        <div className="flex flex-shrink-0 items-start gap-3 border-b border-gray-100 px-6 py-4">
          <div className="min-w-0 flex-1">
            <div className="mb-1 flex flex-wrap items-center gap-2">
              <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${TYPE_BADGE[product.product_type] ?? TYPE_BADGE.otro}`}>
                {TYPE_LABEL[product.product_type] ?? product.product_type}
              </span>
              <span className={`flex items-center gap-1 text-xs font-medium ${product.active ? 'text-green-600' : 'text-gray-400'}`}>
                <span className={`h-1.5 w-1.5 rounded-full ${product.active ? 'bg-green-500' : 'bg-gray-300'}`} />
                {product.active ? 'Activo' : 'Inactivo'}
              </span>
            </div>
            <h2 className="break-words text-base font-bold text-gray-900">
              {isEditing ? 'Editar producto' : product.name}
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

        {/* ── Contenido scrollable ───────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {isEditing ? (
            <ProductEditForm
              data={editData}
              onChange={set}
              saving={saving}
              error={saveError}
              onSave={handleSave}
              onCancel={() => { setIsEditing(false); setSaveError(null); }}
            />
          ) : (
            <DetailView product={product} conditions={conditions} />
          )}
        </div>

        {/* ── Footer (solo en vista detalle) ─────────────────────────── */}
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
                Editar
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Vista de detalle ──────────────────────────────────────────────────

function DetailView({ product, conditions }: { product: Product; conditions: string[] }) {
  return (
    <div className="space-y-5">
      <dl className="divide-y divide-gray-100 text-sm">
        <Row label="PVP"        value={product.pvp > 0  ? `$${product.pvp.toFixed(2)}`  : '—'} mono />
        <Row label="PVM"        value={product.pvm > 0  ? `$${product.pvm.toFixed(2)}`  : '—'} mono />
        <Row label="Margen"     value={product.margin_percentage > 0 ? `${product.margin_percentage}%` : '—'} />
        <Row label="Volumen"    value={product.ml != null ? `${product.ml} ml` : '—'} />
        <Row label="Medida"     value={product.measure   || '—'} />
        <Row label="Marca"      value={product.brand     || '—'} />
        <Row label="Proveedor"  value={product.provider  || '—'} />
        <Row label="Compuesto"  value={product.compound  || '—'} />
        {product.description   && <Row label="Descripción"   value={product.description} />}
        {product.indications   && <Row label="Indicaciones"  value={product.indications} />}
        {product.observations  && <Row label="Observaciones" value={product.observations} />}
      </dl>

      {conditions.length > 0 && (
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
            Padecimientos / Indicaciones ({conditions.length})
          </p>
          <div className="flex flex-wrap gap-1.5">
            {conditions.map((c, i) => (
              <span
                key={i}
                className="rounded-full border border-purple-100 bg-purple-50 px-2.5 py-0.5 text-xs text-purple-700"
              >
                {c}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Row({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2">
      <dt className="flex-shrink-0 text-gray-500">{label}</dt>
      <dd className={`max-w-xs break-words text-right text-gray-900 ${mono ? 'font-mono' : ''}`}>
        {value}
      </dd>
    </div>
  );
}

// ── Formulario de edición ─────────────────────────────────────────────

const INPUT =
  'w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 ' +
  'placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500';

export function ProductEditForm({
  data,
  onChange,
  saving,
  error,
  onSave,
  onCancel,
}: {
  data: EditData;
  onChange: (partial: Partial<EditData>) => void;
  saving: boolean;
  error: string | null;
  onSave: () => void;
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
          placeholder="Nombre del producto"
        />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Marca">
          <input
            type="text"
            value={data.brand}
            onChange={e => onChange({ brand: e.target.value })}
            className={INPUT}
            placeholder="Ej: HEIL PRO"
          />
        </Field>
        <Field label="Proveedor">
          <input
            type="text"
            value={data.provider}
            onChange={e => onChange({ provider: e.target.value })}
            className={INPUT}
            placeholder="Ej: nathurfarma"
          />
        </Field>
      </div>

      <Field label="Compuesto">
        <input
          type="text"
          value={data.compound}
          onChange={e => onChange({ compound: e.target.value })}
          className={INPUT}
          placeholder="Nombre del compuesto"
        />
      </Field>

      <div className="grid grid-cols-3 gap-3">
        <Field label="PVP ($)">
          <input
            type="number"
            min="0"
            step="0.01"
            value={data.pvp}
            onChange={e => onChange({ pvp: e.target.value })}
            className={INPUT}
          />
        </Field>
        <Field label="ML">
          <input
            type="number"
            min="0"
            step="0.5"
            value={data.ml}
            onChange={e => onChange({ ml: e.target.value })}
            className={INPUT}
            placeholder="—"
          />
        </Field>
        <Field label="Medida">
          <input
            type="text"
            value={data.measure}
            onChange={e => onChange({ measure: e.target.value })}
            className={INPUT}
            placeholder="Ej: 10ml"
          />
        </Field>
      </div>

      <Field label="Observaciones">
        <textarea
          value={data.observations}
          onChange={e => onChange({ observations: e.target.value })}
          rows={3}
          className={INPUT + ' resize-none'}
          placeholder="Notas adicionales…"
        />
      </Field>

      <label className="flex cursor-pointer items-center gap-2.5">
        <input
          type="checkbox"
          checked={data.active}
          onChange={e => onChange({ active: e.target.checked })}
          className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
        />
        <span className="text-sm font-medium text-gray-700">Producto activo</span>
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
          className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50"
        >
          Cancelar
        </button>
        <button
          type="button"
          onClick={onSave}
          disabled={saving || !data.name.trim()}
          className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
        >
          {saving ? 'Guardando…' : 'Guardar cambios'}
        </button>
      </div>
    </div>
  );
}

// ── Helper ────────────────────────────────────────────────────────────

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-semibold text-gray-600">{label}</label>
      {children}
    </div>
  );
}

function toEditData(p: Product): EditData {
  return {
    name:         p.name,
    brand:        p.brand        ?? '',
    provider:     p.provider     ?? '',
    compound:     p.compound     ?? '',
    pvp:          String(p.pvp),
    ml:           p.ml != null   ? String(p.ml) : '',
    measure:      p.measure      ?? '',
    observations: p.observations ?? '',
    active:       p.active,
  };
}
