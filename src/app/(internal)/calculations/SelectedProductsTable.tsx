'use client';

import type { SelectedProduct } from './CalculationClient';

type Props = {
  products: SelectedProduct[];
  onQuantityChange: (productId: string, quantity: number) => void;
  onRemove: (productId: string) => void;
};

export default function SelectedProductsTable({
  products,
  onQuantityChange,
  onRemove,
}: Props) {
  if (!products.length) {
    return (
      <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 p-6 text-center">
        <p className="text-sm text-gray-400">No hay productos en el cálculo todavía.</p>
        <p className="mt-1 text-xs text-gray-400">
          Agrega productos desde las recomendaciones o la búsqueda manual.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
      <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-700">
          Productos en el cálculo ({products.length})
        </h3>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-100 text-sm">
          <thead>
            <tr className="bg-gray-50 text-xs text-gray-500">
              <th className="py-2 pl-5 pr-3 text-left font-medium">Producto</th>
              <th className="py-2 pr-3 text-left font-medium hidden sm:table-cell">Tipo</th>
              <th className="py-2 pr-3 text-right font-medium">PVP</th>
              <th className="py-2 pr-3 text-center font-medium">Cantidad</th>
              <th className="py-2 pr-3 text-right font-medium">Subtotal</th>
              <th className="py-2 pr-5" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {products.map(p => {
              const subtotal = p.pvp * p.quantity;
              return (
                <tr key={p.product_id} className="hover:bg-gray-50 transition-colors">
                  <td className="py-3 pl-5 pr-3">
                    <p className="font-medium text-gray-900">{p.name}</p>
                    {p.brand && (
                      <p className="text-xs text-gray-400">{p.brand}</p>
                    )}
                  </td>
                  <td className="py-3 pr-3 text-xs text-gray-500 capitalize hidden sm:table-cell whitespace-nowrap">
                    {p.product_type}
                  </td>
                  <td className="py-3 pr-3 text-right font-medium text-gray-800 whitespace-nowrap">
                    ${p.pvp.toFixed(2)}
                  </td>
                  <td className="py-3 pr-3">
                    <div className="flex items-center justify-center gap-1">
                      <button
                        onClick={() => p.quantity > 1 && onQuantityChange(p.product_id, p.quantity - 1)}
                        disabled={p.quantity <= 1}
                        className="flex h-6 w-6 items-center justify-center rounded border border-gray-200 text-sm text-gray-500 hover:bg-gray-100 disabled:opacity-30 transition-colors"
                      >
                        −
                      </button>
                      <input
                        type="number"
                        min={1}
                        value={p.quantity}
                        onChange={e => {
                          const v = parseInt(e.target.value, 10);
                          if (!isNaN(v) && v >= 1) onQuantityChange(p.product_id, v);
                        }}
                        className="w-12 rounded border border-gray-200 py-0.5 text-center text-sm focus:border-blue-400 focus:outline-none"
                      />
                      <button
                        onClick={() => onQuantityChange(p.product_id, p.quantity + 1)}
                        className="flex h-6 w-6 items-center justify-center rounded border border-gray-200 text-sm text-gray-500 hover:bg-gray-100 transition-colors"
                      >
                        +
                      </button>
                    </div>
                  </td>
                  <td className="py-3 pr-3 text-right font-semibold text-gray-800 whitespace-nowrap">
                    ${subtotal.toFixed(2)}
                  </td>
                  <td className="py-3 pr-5 text-right">
                    <button
                      onClick={() => onRemove(p.product_id)}
                      className="text-xs font-medium text-red-500 hover:text-red-700 transition-colors"
                    >
                      Quitar
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
