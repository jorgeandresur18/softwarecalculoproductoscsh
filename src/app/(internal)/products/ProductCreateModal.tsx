'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import type { ProductType } from '@/types/database';
import { createProduct } from './actions';

// ── Constantes ────────────────────────────────────────────────────────────────

const TYPE_OPTIONS: { value: ProductType; label: string }[] = [
  { value: 'ampolla',   label: 'Ampolla'   },
  { value: 'accesorio', label: 'Accesorio' },
  { value: 'solucion',  label: 'Solución'  },
  { value: 'insumo',    label: 'Insumo'    },
  { value: 'otro',      label: 'Otro'      },
];

const INPUT =
  'w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 ' +
  'placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500';

const INPUT_ERROR =
  'w-full rounded-lg border border-red-300 px-3 py-2 text-sm text-gray-900 ' +
  'placeholder-gray-400 focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-400';

// ── Tipos ─────────────────────────────────────────────────────────────────────

type FormData = {
  product_type:      ProductType;
  name:              string;
  brand:             string;
  provider:          string;
  compound:          string;
  ml:                string;
  measure:           string;
  pvm:               string;
  margin_percentage: string;
  pvp:               string;
  quantity:          string;
  total:             string;
  conditions_text:   string;
  indications:       string;
  observations:      string;
  active:            boolean;
};

type FieldErrors = Partial<Record<keyof FormData, string>>;

const INITIAL: FormData = {
  product_type:      'ampolla',
  name:              '',
  brand:             '',
  provider:          '',
  compound:          '',
  ml:                '',
  measure:           '',
  pvm:               '',
  margin_percentage: '',
  pvp:               '',
  quantity:          '',
  total:             '',
  conditions_text:   '',
  indications:       '',
  observations:      '',
  active:            true,
};

// ── Componente principal ──────────────────────────────────────────────────────

type Props = {
  onClose:   () => void;
  onCreated: () => void;
};

export default function ProductCreateModal({ onClose, onCreated }: Props) {
  const [form,      setForm]      = useState<FormData>(INITIAL);
  const [errors,    setErrors]    = useState<FieldErrors>({});
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving,    setSaving]    = useState(false);
  const router = useRouter();

  // Cerrar con Escape
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); },
    [onClose],
  );
  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  function set(partial: Partial<FormData>) {
    setForm(prev => ({ ...prev, ...partial }));
    // Limpiar error del campo al escribir
    const key = Object.keys(partial)[0] as keyof FormData;
    if (errors[key]) setErrors(prev => ({ ...prev, [key]: undefined }));
  }

  function validate(): boolean {
    const next: FieldErrors = {};
    if (!form.name.trim())          next.name         = 'El nombre es obligatorio.';
    if (!form.pvp.trim())           next.pvp          = 'El PVP es obligatorio.';
    else if (parseFloat(form.pvp) <= 0) next.pvp      = 'El PVP debe ser mayor que 0.';

    const numFields: (keyof FormData)[] = ['ml', 'pvm', 'margin_percentage', 'quantity', 'total'];
    for (const f of numFields) {
      const v = (form[f] as string).trim();
      if (v && isNaN(parseFloat(v))) {
        next[f] = 'Debe ser un número válido.';
      }
    }

    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function handleSave() {
    if (!validate()) return;
    setSaving(true);
    setSaveError(null);

    const result = await createProduct({
      product_type:      form.product_type,
      name:              form.name.trim(),
      brand:             form.brand.trim()             || null,
      provider:          form.provider.trim()          || null,
      compound:          form.compound.trim()          || null,
      ml:                form.ml.trim()                ? parseFloat(form.ml)                : null,
      measure:           form.measure.trim()           || null,
      pvm:               form.pvm.trim()               ? parseFloat(form.pvm)               : 0,
      margin_percentage: form.margin_percentage.trim() ? parseFloat(form.margin_percentage) : 0,
      pvp:               parseFloat(form.pvp),
      quantity:          form.quantity.trim()          ? parseFloat(form.quantity)          : 0,
      total:             form.total.trim()             ? parseFloat(form.total)             : 0,
      conditions_text:   form.conditions_text.trim()  || null,
      indications:       form.indications.trim()      || null,
      observations:      form.observations.trim()     || null,
      active:            form.active,
    });

    setSaving(false);

    if (result.error) {
      setSaveError(result.error);
      return;
    }

    router.refresh();
    onCreated();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="relative flex w-full max-w-xl flex-col rounded-2xl bg-white shadow-2xl"
        style={{ maxHeight: '92vh' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex flex-shrink-0 items-center justify-between border-b border-gray-100 px-6 py-4">
          <div>
            <h2 className="text-base font-bold text-gray-900">Nuevo producto</h2>
            <p className="mt-0.5 text-xs text-gray-400">Los campos marcados con * son obligatorios</p>
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

        {/* Formulario scrollable */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">

          {/* Tipo y nombre */}
          <div className="grid grid-cols-3 gap-3">
            <Field label="Tipo *">
              <select
                value={form.product_type}
                onChange={e => set({ product_type: e.target.value as ProductType })}
                className={INPUT}
              >
                {TYPE_OPTIONS.map(o => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </Field>
            <div className="col-span-2">
              <Field label="Nombre *" error={errors.name}>
                <input
                  type="text"
                  value={form.name}
                  onChange={e => set({ name: e.target.value })}
                  className={errors.name ? INPUT_ERROR : INPUT}
                  placeholder="Nombre del producto"
                  autoFocus
                />
              </Field>
            </div>
          </div>

          {/* Marca / Proveedor */}
          <div className="grid grid-cols-2 gap-3">
            <Field label="Marca">
              <input
                type="text"
                value={form.brand}
                onChange={e => set({ brand: e.target.value })}
                className={INPUT}
                placeholder="Ej: HEIL PRO"
              />
            </Field>
            <Field label="Proveedor">
              <input
                type="text"
                value={form.provider}
                onChange={e => set({ provider: e.target.value })}
                className={INPUT}
                placeholder="Ej: nathurfarma"
              />
            </Field>
          </div>

          {/* Compuesto */}
          <Field label="Compuesto / Principio activo">
            <input
              type="text"
              value={form.compound}
              onChange={e => set({ compound: e.target.value })}
              className={INPUT}
              placeholder="Nombre del compuesto"
            />
          </Field>

          {/* Precios */}
          <div className="rounded-lg border border-gray-100 bg-gray-50 p-3 space-y-3">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Precios</p>
            <div className="grid grid-cols-3 gap-3">
              <Field label="PVM ($)">
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.pvm}
                  onChange={e => set({ pvm: e.target.value })}
                  className={errors.pvm ? INPUT_ERROR : INPUT}
                  placeholder="0.00"
                />
              </Field>
              <Field label="Margen (%)">
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.margin_percentage}
                  onChange={e => set({ margin_percentage: e.target.value })}
                  className={errors.margin_percentage ? INPUT_ERROR : INPUT}
                  placeholder="0"
                />
              </Field>
              <Field label="PVP ($) *" error={errors.pvp}>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.pvp}
                  onChange={e => set({ pvp: e.target.value })}
                  className={errors.pvp ? INPUT_ERROR : INPUT}
                  placeholder="0.00"
                />
              </Field>
            </div>
          </div>

          {/* Presentación */}
          <div className="grid grid-cols-3 gap-3">
            <Field label="ML" error={errors.ml}>
              <input
                type="number"
                min="0"
                step="0.5"
                value={form.ml}
                onChange={e => set({ ml: e.target.value })}
                className={errors.ml ? INPUT_ERROR : INPUT}
                placeholder="—"
              />
            </Field>
            <Field label="Medida">
              <input
                type="text"
                value={form.measure}
                onChange={e => set({ measure: e.target.value })}
                className={INPUT}
                placeholder="Ej: 10ml"
              />
            </Field>
            <Field label="Cantidad" error={errors.quantity}>
              <input
                type="number"
                min="0"
                step="1"
                value={form.quantity}
                onChange={e => set({ quantity: e.target.value })}
                className={errors.quantity ? INPUT_ERROR : INPUT}
                placeholder="0"
              />
            </Field>
          </div>

          {/* Indicaciones / Condiciones */}
          <Field label="Indicaciones">
            <textarea
              value={form.indications}
              onChange={e => set({ indications: e.target.value })}
              rows={2}
              className={INPUT + ' resize-none'}
              placeholder="Indicaciones o usos del producto…"
            />
          </Field>

          <Field label="Padecimientos / Condiciones">
            <input
              type="text"
              value={form.conditions_text}
              onChange={e => set({ conditions_text: e.target.value })}
              className={INPUT}
              placeholder="Ej: Déficit vitamínico, Fatiga crónica (separados por coma)"
            />
          </Field>

          <Field label="Observaciones">
            <textarea
              value={form.observations}
              onChange={e => set({ observations: e.target.value })}
              rows={2}
              className={INPUT + ' resize-none'}
              placeholder="Notas adicionales…"
            />
          </Field>

          {/* Estado activo */}
          <label className="flex cursor-pointer items-center gap-2.5">
            <input
              type="checkbox"
              checked={form.active}
              onChange={e => set({ active: e.target.checked })}
              className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-sm font-medium text-gray-700">Producto activo</span>
          </label>

          {/* Error general */}
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
            disabled={saving}
            className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? 'Guardando…' : 'Crear producto'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Sub-componentes ───────────────────────────────────────────────────────────

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-1 block text-xs font-semibold text-gray-600">{label}</label>
      {children}
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}
