'use client';

import type { ProductType } from '@/types/database';

export type FilterState = {
  search: string;
  type: ProductType | 'all';
  status: 'all' | 'active' | 'inactive';
};

const TYPE_OPTIONS: { value: FilterState['type']; label: string }[] = [
  { value: 'all',       label: 'Todos los tipos' },
  { value: 'ampolla',   label: 'Ampollas' },
  { value: 'accesorio', label: 'Accesorios' },
  { value: 'solucion',  label: 'Soluciones' },
  { value: 'insumo',    label: 'Insumos' },
  { value: 'otro',      label: 'Otros' },
];

const STATUS_OPTIONS: { value: FilterState['status']; label: string }[] = [
  { value: 'active',   label: 'Activos' },
  { value: 'inactive', label: 'Inactivos' },
  { value: 'all',      label: 'Todos' },
];

const SELECT_CLS =
  'rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 ' +
  'focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500';

type Props = {
  filters: FilterState;
  onChange: (f: FilterState) => void;
  total: number;
  filtered: number;
};

export default function ProductFilters({ filters, onChange, total, filtered }: Props) {
  function set(partial: Partial<FilterState>) {
    onChange({ ...filters, ...partial });
  }

  function clear() {
    onChange({ search: '', type: 'all', status: 'active' });
  }

  const isDirty =
    filters.search !== '' || filters.type !== 'all' || filters.status !== 'active';

  return (
    <div className="space-y-2">
      <div className="flex flex-col gap-2 sm:flex-row">
        {/* Búsqueda */}
        <div className="relative flex-1">
          <div className="pointer-events-none absolute inset-y-0 left-3 flex items-center">
            <svg className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <input
            type="text"
            placeholder="Buscar por nombre, marca, compuesto, proveedor…"
            value={filters.search}
            onChange={e => set({ search: e.target.value })}
            className="w-full rounded-lg border border-gray-300 bg-white py-2 pl-9 pr-3 text-sm
                       text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none
                       focus:ring-1 focus:ring-blue-500"
          />
        </div>

        {/* Tipo */}
        <select
          value={filters.type}
          onChange={e => set({ type: e.target.value as FilterState['type'] })}
          className={SELECT_CLS}
        >
          {TYPE_OPTIONS.map(o => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>

        {/* Estado */}
        <select
          value={filters.status}
          onChange={e => set({ status: e.target.value as FilterState['status'] })}
          className={SELECT_CLS}
        >
          {STATUS_OPTIONS.map(o => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>

        {/* Limpiar */}
        {isDirty && (
          <button
            onClick={clear}
            className="rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-500 hover:bg-gray-50 hover:text-gray-700 transition-colors whitespace-nowrap"
          >
            Limpiar
          </button>
        )}
      </div>

      {/* Contador */}
      {isDirty && (
        <p className="text-xs text-gray-400">
          {filtered === total
            ? `${total} productos`
            : `${filtered} de ${total} productos`}
        </p>
      )}
    </div>
  );
}
