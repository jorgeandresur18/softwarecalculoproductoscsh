'use client';

type Props = {
  selectedSymptomNames: string[];
  subtotal: number;
  discount: number;
  onDiscountChange: (v: number) => void;
  isAdmin: boolean;
  onSave: () => void;
  isSaving: boolean;
  saveError: string | null;
  hasProducts: boolean;
  hasPriceIssues: boolean;
  observations: string;
  onObservationsChange: (v: string) => void;
};

export default function CalculationSummary({
  selectedSymptomNames,
  subtotal,
  discount,
  onDiscountChange,
  isAdmin,
  onSave,
  isSaving,
  saveError,
  hasProducts,
  hasPriceIssues,
  observations,
  onObservationsChange,
}: Props) {
  const finalPrice = Math.max(0, subtotal - discount);
  const canSave = hasProducts && !hasPriceIssues && !isSaving;

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 space-y-4">
      <h3 className="text-sm font-semibold text-gray-700">Resumen del cálculo</h3>

      {/* Síntomas seleccionados */}
      {selectedSymptomNames.length > 0 && (
        <div>
          <p className="text-xs font-medium text-gray-500 mb-1.5">Síntomas seleccionados</p>
          <div className="flex flex-wrap gap-1.5">
            {selectedSymptomNames.map((name, i) => (
              <span
                key={i}
                className="rounded-full bg-blue-50 border border-blue-200 px-2.5 py-0.5 text-xs text-blue-700"
              >
                {name}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Observaciones */}
      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1">
          Observaciones (opcional)
        </label>
        <textarea
          value={observations}
          onChange={e => onObservationsChange(e.target.value)}
          rows={2}
          placeholder="Notas adicionales sobre el cálculo..."
          className="w-full resize-none rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm focus:border-blue-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-100"
        />
      </div>

      {/* Totales */}
      <div className="rounded-lg bg-gray-50 border border-gray-100 p-4 space-y-2.5">
        <div className="flex justify-between text-sm">
          <span className="text-gray-600">Subtotal de productos</span>
          <span className="font-medium text-gray-800">${subtotal.toFixed(2)}</span>
        </div>

        <div className="flex items-center justify-between gap-3 text-sm">
          <span className="text-gray-600">Descuento</span>
          {isAdmin ? (
            <div className="flex items-center gap-1">
              <span className="text-gray-400 text-xs">$</span>
              <input
                type="number"
                min={0}
                step={0.01}
                value={discount}
                onChange={e => {
                  const v = parseFloat(e.target.value);
                  if (!isNaN(v) && v >= 0) {
                    onDiscountChange(Math.min(v, subtotal));
                  } else if (e.target.value === '') {
                    onDiscountChange(0);
                  }
                }}
                className="w-24 rounded border border-gray-200 py-0.5 px-2 text-right text-sm focus:border-blue-400 focus:outline-none"
              />
            </div>
          ) : (
            <span className="text-xs text-gray-400 italic">Solo administrador</span>
          )}
        </div>

        <div className="border-t border-gray-200 pt-2.5 flex justify-between text-base">
          <span className="font-semibold text-gray-800">Total final</span>
          <span className="text-lg font-bold text-blue-700">${finalPrice.toFixed(2)}</span>
        </div>
      </div>

      {/* Validaciones */}
      {!hasProducts && (
        <div className="rounded-lg bg-yellow-50 border border-yellow-200 px-3 py-2.5">
          <p className="text-xs font-medium text-yellow-700">
            Agrega al menos un producto para poder guardar el cálculo.
          </p>
        </div>
      )}

      {hasPriceIssues && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2.5">
          <p className="text-xs font-medium text-red-700">
            Hay productos sin precio configurado. Retíralos del cálculo antes de guardar.
          </p>
        </div>
      )}

      {saveError && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2.5">
          <p className="text-xs font-medium text-red-700">{saveError}</p>
        </div>
      )}

      {/* Aviso profesional */}
      <div className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-3">
        <p className="text-xs text-amber-700 leading-relaxed">
          <span className="font-semibold">Aviso importante:</span> Recomendación de apoyo interno.
          La selección final debe ser validada por el profesional correspondiente.
        </p>
      </div>

      {/* Botón guardar */}
      <button
        onClick={onSave}
        disabled={!canSave}
        className="w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isSaving ? 'Guardando...' : 'Guardar cálculo'}
      </button>
    </div>
  );
}
