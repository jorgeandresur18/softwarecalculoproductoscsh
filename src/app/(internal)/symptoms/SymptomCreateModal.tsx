'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { createSymptom } from './actions';

const INPUT =
  'w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 ' +
  'placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500';

const INPUT_ERROR =
  'w-full rounded-lg border border-red-300 px-3 py-2 text-sm text-gray-900 ' +
  'placeholder-gray-400 focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-400';

type FormData = {
  name:        string;
  category:    string;
  description: string;
  active:      boolean;
};

type Props = {
  onClose:   () => void;
  onCreated: () => void;
};

export default function SymptomCreateModal({ onClose, onCreated }: Props) {
  const [form,      setForm]      = useState<FormData>({ name: '', category: '', description: '', active: true });
  const [nameError, setNameError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving,    setSaving]    = useState(false);
  const router = useRouter();

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
    if ('name' in partial && nameError) setNameError(null);
  }

  async function handleSave() {
    if (!form.name.trim()) {
      setNameError('El nombre es obligatorio.');
      return;
    }
    setSaving(true);
    setSaveError(null);

    const result = await createSymptom({
      name:        form.name.trim(),
      category:    form.category.trim()    || null,
      description: form.description.trim() || null,
      active:      form.active,
    });

    setSaving(false);

    if (result.error) {
      if (result.error.toLowerCase().includes('nombre')) {
        setNameError(result.error);
      } else {
        setSaveError(result.error);
      }
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
        className="relative flex w-full max-w-md flex-col rounded-2xl bg-white shadow-2xl"
        style={{ maxHeight: '90vh' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex flex-shrink-0 items-center justify-between border-b border-gray-100 px-6 py-4">
          <div>
            <h2 className="text-base font-bold text-gray-900">Nuevo síntoma</h2>
            <p className="mt-0.5 text-xs text-gray-400">El nombre es obligatorio</p>
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
          <Field label="Nombre *" error={nameError ?? undefined}>
            <input
              type="text"
              value={form.name}
              onChange={e => set({ name: e.target.value })}
              className={nameError ? INPUT_ERROR : INPUT}
              placeholder="Nombre del síntoma"
              autoFocus
            />
          </Field>

          <Field label="Categoría">
            <input
              type="text"
              value={form.category}
              onChange={e => set({ category: e.target.value })}
              className={INPUT}
              placeholder="Ej: Piel, Sistema nervioso, Metabólico…"
            />
          </Field>

          <Field label="Descripción">
            <textarea
              value={form.description}
              onChange={e => set({ description: e.target.value })}
              rows={3}
              className={INPUT + ' resize-none'}
              placeholder="Descripción del síntoma o padecimiento…"
            />
          </Field>

          <label className="flex cursor-pointer items-center gap-2.5">
            <input
              type="checkbox"
              checked={form.active}
              onChange={e => set({ active: e.target.checked })}
              className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-sm font-medium text-gray-700">Síntoma activo</span>
          </label>

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
            {saving ? 'Guardando…' : 'Crear síntoma'}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({
  label, error, children,
}: {
  label: string; error?: string; children: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-1 block text-xs font-semibold text-gray-600">{label}</label>
      {children}
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}
