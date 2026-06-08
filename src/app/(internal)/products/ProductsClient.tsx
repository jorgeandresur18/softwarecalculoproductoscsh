'use client';

import { useState, useMemo, useEffect } from 'react';
import type { Product, UserRole } from '@/types/database';
import ProductFilters, { type FilterState } from './ProductFilters';
import ProductsTable from './ProductsTable';
import ProductDetailModal from './ProductDetailModal';
import ProductCreateModal from './ProductCreateModal';

type Props = {
  products: Product[];
  userRole: UserRole;
};

const DEFAULT_FILTERS: FilterState = {
  search: '',
  type:   'all',
  status: 'active',
};

export default function ProductsClient({ products, userRole }: Props) {
  const [filters,       setFilters]       = useState<FilterState>(DEFAULT_FILTERS);
  const [selected,      setSelected]      = useState<Product | null>(null);
  const [showCreate,    setShowCreate]    = useState(false);
  const [successMsg,    setSuccessMsg]    = useState<string | null>(null);

  // Auto-ocultar mensaje de éxito
  useEffect(() => {
    if (!successMsg) return;
    const t = setTimeout(() => setSuccessMsg(null), 4000);
    return () => clearTimeout(t);
  }, [successMsg]);

  const filtered = useMemo(() => {
    const q = filters.search.toLowerCase().trim();
    return products.filter(p => {
      if (q) {
        const haystack = [p.name, p.brand, p.compound, p.provider]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      if (filters.type !== 'all' && p.product_type !== filters.type) return false;
      if (filters.status === 'active'   && !p.active) return false;
      if (filters.status === 'inactive' &&  p.active) return false;
      return true;
    });
  }, [products, filters]);

  return (
    <div className="space-y-4">
      {/* Encabezado */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Productos y Ampollas</h2>
          <p className="mt-0.5 text-sm text-gray-500">
            Catálogo de ampollas, accesorios e insumos
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
              Nuevo producto
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
      <ProductFilters
        filters={filters}
        onChange={setFilters}
        total={products.length}
        filtered={filtered.length}
      />

      {/* Tabla */}
      <ProductsTable products={filtered} onSelect={setSelected} />

      {/* Modal de detalle / edición */}
      {selected && (
        <ProductDetailModal
          product={selected}
          userRole={userRole}
          onClose={() => setSelected(null)}
          onUpdated={updated => setSelected(updated)}
        />
      )}

      {/* Modal de creación */}
      {showCreate && (
        <ProductCreateModal
          onClose={() => setShowCreate(false)}
          onCreated={() => {
            setShowCreate(false);
            setSuccessMsg('Producto creado correctamente. Ya aparece en el catálogo.');
          }}
        />
      )}
    </div>
  );
}
