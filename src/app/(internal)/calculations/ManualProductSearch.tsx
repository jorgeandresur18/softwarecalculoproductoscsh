'use client';

import { useState, useMemo } from 'react';
import type { Product, ProductType } from '@/types/database';
import type { SelectedProduct } from './CalculationClient';

const TYPE_OPTIONS: { value: 'all' | ProductType; label: string }[] = [
  { value: 'all',       label: 'Todos'     },
  { value: 'ampolla',   label: 'Ampolla'   },
  { value: 'accesorio', label: 'Accesorio' },
  { value: 'solucion',  label: 'Solución'  },
  { value: 'insumo',    label: 'Insumo'    },
  { value: 'otro',      label: 'Otro'      },
];

type Props = {
  products: Product[];
  onAdd: (product: SelectedProduct) => void;
  addedIds: string[];
};

export default function ManualProductSearch({ products, onAdd, addedIds }: Props) {
  const [search, setSearch] = useState('');
  const [type, setType] = useState<'all' | ProductType>('all');
  const [open, setOpen] = useState(false);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return products.filter(p => {
      if (!p.active) return false;
      if (type !== 'all' && p.product_type !== type) return false;
      if (q) {
        const hay = [p.name, p.brand, p.compound, p.provider]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [products, search, type]);

  const visible = filtered.slice(0, 50);

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 space-y-3">
      <button
        onClick={() => setOpen(v => !v)}
        className="flex w-full items-center justify-between text-sm font-semibold text-gray-700 focus:outline-none"
      >
        <span>Agregar producto manualmente</span>
        <svg
          className={`h-4 w-4 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="space-y-3 pt-1">
          <div className="flex flex-wrap gap-2">
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar por nombre, marca, compuesto..."
              className="flex-1 min-w-[180px] rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm focus:border-blue-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-100"
            />
            <select
              value={type}
              onChange={e => setType(e.target.value as 'all' | ProductType)}
              className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm focus:border-blue-400 focus:bg-white focus:outline-none"
            >
              {TYPE_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>

          <div className="max-h-60 overflow-y-auto rounded-lg border border-gray-100 divide-y divide-gray-50">
            {visible.length === 0 ? (
              <p className="px-3 py-4 text-center text-sm text-gray-400">Sin resultados</p>
            ) : (
              visible.map(p => {
                const noPvp = !p.pvp || p.pvp <= 0;
                const alreadyAdded = addedIds.includes(p.id);
                return (
                  <div
                    key={p.id}
                    className="flex items-center gap-3 px-3 py-2.5 hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-800 truncate">{p.name}</p>
                      <p className="text-xs text-gray-400 truncate">
                        {[p.brand, p.product_type].filter(Boolean).join(' · ')}
                      </p>
                      {noPvp && (
                        <p className="text-xs font-semibold text-red-500">⚠ Sin precio configurado</p>
                      )}
                    </div>
                    <span className="flex-shrink-0 text-sm font-medium text-gray-700 whitespace-nowrap">
                      {noPvp ? '—' : `$${p.pvp.toFixed(2)}`}
                    </span>
                    <button
                      onClick={() => {
                        if (!noPvp && !alreadyAdded) {
                          onAdd({
                            product_id:   p.id,
                            name:         p.name,
                            product_type: p.product_type,
                            brand:        p.brand ?? null,
                            pvp:          p.pvp,
                            quantity:     1,
                          });
                        }
                      }}
                      disabled={noPvp || alreadyAdded}
                      title={noPvp ? 'Producto sin precio configurado' : undefined}
                      className="flex-shrink-0 rounded-md bg-gray-100 border border-gray-200 px-2.5 py-1 text-xs font-medium text-gray-700 hover:bg-gray-200 disabled:cursor-not-allowed disabled:opacity-40 transition-colors whitespace-nowrap"
                    >
                      {alreadyAdded ? 'Agregado' : 'Agregar'}
                    </button>
                  </div>
                );
              })
            )}
          </div>

          {filtered.length > 50 && (
            <p className="text-center text-xs text-gray-400">
              Mostrando 50 de {filtered.length} resultados. Refina la búsqueda.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
