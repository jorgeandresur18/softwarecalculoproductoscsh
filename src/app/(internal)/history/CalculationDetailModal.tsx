'use client';

import { useState, useEffect, useCallback } from 'react';
import type { CalculationRow, CalculationItemRow } from './actions';
import { getCalculationItems } from './actions';

type Props = {
  calculation: CalculationRow;
  onClose:     () => void;
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('es-EC', {
    day:    '2-digit',
    month:  'long',
    year:   'numeric',
    hour:   '2-digit',
    minute: '2-digit',
  });
}

// ── Genera el HTML completo auto-contenido para la ventana de impresión ────────

function buildPrintHTML(
  calculation: CalculationRow,
  items: CalculationItemRow[],
): string {
  const symptoms = calculation.symptoms_text
    ? calculation.symptoms_text.split(',').map(s => s.trim()).filter(Boolean)
    : [];

  const itemRows = items
    .map(
      item => `
      <tr>
        <td style="padding:5pt 8pt;border:1px solid #e5e7eb;font-size:9pt;color:#111827;">${item.product_name_snapshot}</td>
        <td style="padding:5pt 8pt;border:1px solid #e5e7eb;font-size:9pt;color:#374151;text-align:right;">\$${item.unit_price.toFixed(2)}</td>
        <td style="padding:5pt 8pt;border:1px solid #e5e7eb;font-size:9pt;color:#374151;text-align:center;">${item.quantity}</td>
        <td style="padding:5pt 8pt;border:1px solid #e5e7eb;font-size:9pt;font-weight:600;color:#111827;text-align:right;">\$${item.total_price.toFixed(2)}</td>
      </tr>`,
    )
    .join('');

  const symptomTags = symptoms
    .map(
      s =>
        `<span style="display:inline-block;border:1px solid #bfdbfe;background:#eff6ff;color:#1d4ed8;padding:2pt 8pt;border-radius:20pt;font-size:8.5pt;font-weight:500;margin:2pt;">${s}</span>`,
    )
    .join('');

  const discountRow =
    calculation.discount_amount > 0
      ? `<div style="display:flex;justify-content:space-between;padding:5pt 10pt;font-size:9.5pt;border-bottom:1px solid #f3f4f6;">
           <span style="color:#6b7280;">Descuento aplicado</span>
           <span style="font-weight:600;color:#15803d;">−\$${calculation.discount_amount.toFixed(2)}</span>
         </div>`
      : '';

  const observationsBlock = calculation.observations
    ? `<div style="margin-bottom:14pt;">
         <p style="font-size:7.5pt;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:#6b7280;border-bottom:1px solid #e5e7eb;padding-bottom:3pt;margin-bottom:8pt;">Observaciones</p>
         <p style="font-size:9pt;color:#374151;line-height:1.6;background:#f9fafb;border:1px solid #e5e7eb;padding:7pt 10pt;border-radius:4pt;">${calculation.observations}</p>
       </div>`
    : '';

  const symptomsBlock =
    symptoms.length > 0
      ? `<div style="margin-bottom:14pt;">
           <p style="font-size:7.5pt;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:#6b7280;border-bottom:1px solid #e5e7eb;padding-bottom:3pt;margin-bottom:8pt;">Síntomas seleccionados</p>
           <div style="display:flex;flex-wrap:wrap;gap:4pt;">${symptomTags}</div>
         </div>`
      : '';

  const productsBlock =
    items.length > 0
      ? `<div style="margin-bottom:14pt;break-inside:avoid;page-break-inside:avoid;">
           <p style="font-size:7.5pt;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:#6b7280;border-bottom:1px solid #e5e7eb;padding-bottom:3pt;margin-bottom:8pt;">Productos utilizados</p>
           <table style="width:100%;border-collapse:collapse;font-size:9pt;">
             <thead>
               <tr style="background:#f3f4f6;">
                 <th style="padding:5pt 8pt;border:1px solid #d1d5db;font-size:7.5pt;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:#6b7280;text-align:left;width:50%;">Producto</th>
                 <th style="padding:5pt 8pt;border:1px solid #d1d5db;font-size:7.5pt;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:#6b7280;text-align:right;">P. Unitario</th>
                 <th style="padding:5pt 8pt;border:1px solid #d1d5db;font-size:7.5pt;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:#6b7280;text-align:center;">Cant.</th>
                 <th style="padding:5pt 8pt;border:1px solid #d1d5db;font-size:7.5pt;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:#6b7280;text-align:right;">Subtotal</th>
               </tr>
             </thead>
             <tbody>${itemRows}</tbody>
           </table>
         </div>`
      : '';

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Resumen de cálculo — ${calculation.patient_reference ?? 'Suero'}</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    html, body {
      font-family: Arial, Helvetica, sans-serif;
      font-size: 10pt;
      color: #111827;
      background: white;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    body { padding: 18mm 20mm; }
    @media print {
      body { padding: 15mm 18mm; }
      * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
    }
  </style>
</head>
<body>
  <!-- Cabecera -->
  <div style="display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #1d4ed8;padding-bottom:10pt;margin-bottom:16pt;">
    <div>
      <h1 style="font-size:16pt;font-weight:700;color:#1d4ed8;margin-bottom:3pt;">Resumen de cálculo de suero</h1>
      <p style="font-size:8.5pt;color:#6b7280;">Documento de apoyo interno</p>
    </div>
    <div style="text-align:right;font-size:8.5pt;color:#6b7280;">
      <p>Fecha del cálculo:</p>
      <p style="font-weight:600;color:#374151;margin-top:2pt;">${formatDate(calculation.created_at)}</p>
    </div>
  </div>

  <!-- Datos generales -->
  <div style="margin-bottom:14pt;break-inside:avoid;page-break-inside:avoid;">
    <p style="font-size:7.5pt;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:#6b7280;border-bottom:1px solid #e5e7eb;padding-bottom:3pt;margin-bottom:8pt;">Datos generales</p>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:6pt 24pt;">
      <div>
        <p style="font-size:7.5pt;color:#9ca3af;margin-bottom:1pt;">Paciente / Referencia</p>
        <p style="font-size:9.5pt;font-weight:600;color:#111827;">${calculation.patient_reference ?? '—'}</p>
      </div>
      <div>
        <p style="font-size:7.5pt;color:#9ca3af;margin-bottom:1pt;">Ciudad</p>
        <p style="font-size:9.5pt;font-weight:600;color:#111827;">${calculation.patient_city ?? '—'}</p>
      </div>
      <div>
        <p style="font-size:7.5pt;color:#9ca3af;margin-bottom:1pt;">ID del cálculo</p>
        <p style="font-size:8pt;font-weight:500;color:#6b7280;font-family:monospace;">${calculation.id.slice(0, 8)}…</p>
      </div>
    </div>
  </div>

  ${symptomsBlock}
  ${productsBlock}

  <!-- Resumen de precios -->
  <div style="margin-bottom:14pt;break-inside:avoid;page-break-inside:avoid;">
    <p style="font-size:7.5pt;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:#6b7280;border-bottom:1px solid #e5e7eb;padding-bottom:3pt;margin-bottom:8pt;">Resumen de precios</p>
    <div style="border:1px solid #e5e7eb;border-radius:4pt;overflow:hidden;">
      <div style="display:flex;justify-content:space-between;padding:5pt 10pt;font-size:9.5pt;border-bottom:1px solid #f3f4f6;">
        <span style="color:#6b7280;">Subtotal de productos</span>
        <span style="font-weight:600;color:#111827;">\$${calculation.subtotal_products.toFixed(2)}</span>
      </div>
      ${discountRow}
      <div style="display:flex;justify-content:space-between;align-items:center;padding:8pt 10pt;background:#eff6ff;border-top:2px solid #bfdbfe;">
        <span style="font-size:10.5pt;font-weight:700;color:#1e3a8a;">Total final</span>
        <span style="font-size:13pt;font-weight:800;color:#1d4ed8;">\$${calculation.final_price.toFixed(2)}</span>
      </div>
    </div>
  </div>

  ${observationsBlock}

  <!-- Aviso -->
  <div style="margin-top:16pt;padding:7pt 10pt;border:1px solid #fde68a;background:#fffbeb;border-radius:4pt;font-size:8pt;color:#92400e;line-height:1.6;">
    <strong style="font-weight:700;color:#78350f;">Aviso importante:</strong>
    Documento de apoyo interno. La selección final debe ser validada por el profesional correspondiente.
  </div>
</body>
</html>`;
}

// ── Componente principal ───────────────────────────────────────────────────────

export default function CalculationDetailModal({ calculation, onClose }: Props) {
  const [items,     setItems]     = useState<CalculationItemRow[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Cerrar con Escape
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); },
    [onClose],
  );
  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  // Cargar ítems
  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setLoadError(null);
    setItems(null);

    getCalculationItems(calculation.id).then(result => {
      if (cancelled) return;
      if (result.error) setLoadError(result.error);
      else setItems(result.data ?? []);
      setIsLoading(false);
    });

    return () => { cancelled = true; };
  }, [calculation.id]);

  const symptoms = calculation.symptoms_text
    ? calculation.symptoms_text.split(',').map(s => s.trim()).filter(Boolean)
    : [];

  const canPrint = !isLoading && !loadError && items !== null;

  // ── Impresión en ventana nueva (sin interferencia con la página principal) ──
  const handlePrint = () => {
    if (!items) return;

    const html = buildPrintHTML(calculation, items);
    const printWindow = window.open('', '_blank', 'width=820,height=1000,toolbar=0,menubar=0');
    if (!printWindow) {
      alert('El navegador bloqueó la ventana emergente. Permite las ventanas emergentes para este sitio e intenta de nuevo.');
      return;
    }

    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();

    // Esperar a que el documento cargue antes de imprimir
    printWindow.onload = () => {
      printWindow.focus();
      printWindow.print();
      // Cerrar la ventana después de que el usuario decida (imprimir o cancelar)
      printWindow.addEventListener('afterprint', () => printWindow.close());
    };
  };

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
        {/* Header */}
        <div className="flex flex-shrink-0 items-start gap-3 border-b border-gray-100 px-6 py-4">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium uppercase tracking-wide text-gray-400">
              Cálculo de suero
            </p>
            <h2 className="mt-0.5 text-base font-bold text-gray-900">
              {calculation.patient_reference ?? 'Sin referencia de paciente'}
            </h2>
            <p className="mt-0.5 text-xs text-gray-400">{formatDate(calculation.created_at)}</p>
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

        {/* Contenido scrollable */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">

          {/* Datos generales */}
          <section className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">
              Datos generales
            </h3>
            <dl className="grid grid-cols-1 gap-y-2 sm:grid-cols-2 text-sm">
              <InfoRow label="Paciente" value={calculation.patient_reference ?? '—'} />
              <InfoRow label="Ciudad"   value={calculation.patient_city      ?? '—'} />
              <InfoRow label="Fecha"    value={formatDate(calculation.created_at)} />
              <InfoRow label="ID"       value={calculation.id.slice(0, 8) + '…'} mono />
            </dl>
          </section>

          {/* Síntomas */}
          {symptoms.length > 0 && (
            <section className="space-y-2">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                Síntomas seleccionados
              </h3>
              <div className="flex flex-wrap gap-1.5">
                {symptoms.map((s, i) => (
                  <span
                    key={i}
                    className="rounded-full bg-blue-50 border border-blue-200 px-2.5 py-0.5 text-xs text-blue-700"
                  >
                    {s}
                  </span>
                ))}
              </div>
            </section>
          )}

          {/* Productos */}
          <section className="space-y-2">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">
              Productos utilizados
            </h3>
            {isLoading && (
              <div className="space-y-2">
                {[1, 2, 3].map(i => (
                  <div key={i} className="h-10 animate-pulse rounded-lg bg-gray-100" />
                ))}
              </div>
            )}
            {loadError && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                Error al cargar productos: {loadError}
              </div>
            )}
            {!isLoading && !loadError && items !== null && (
              items.length === 0 ? (
                <p className="text-sm italic text-gray-400">Sin ítems registrados.</p>
              ) : (
                <div className="overflow-hidden rounded-xl border border-gray-200">
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-100 text-sm">
                      <thead>
                        <tr className="bg-gray-50 text-xs text-gray-500">
                          <th className="py-2 pl-4 pr-3 text-left font-medium">Producto</th>
                          <th className="py-2 pr-3 text-right font-medium">P. Unit.</th>
                          <th className="py-2 pr-3 text-center font-medium">Cant.</th>
                          <th className="py-2 pr-4 text-right font-medium">Subtotal</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {items.map(item => (
                          <tr key={item.id} className="hover:bg-gray-50">
                            <td className="py-2.5 pl-4 pr-3 font-medium text-gray-800">
                              {item.product_name_snapshot}
                            </td>
                            <td className="py-2.5 pr-3 text-right text-gray-600 whitespace-nowrap">
                              ${item.unit_price.toFixed(2)}
                            </td>
                            <td className="py-2.5 pr-3 text-center text-gray-700">
                              {item.quantity}
                            </td>
                            <td className="py-2.5 pr-4 text-right font-semibold text-gray-800 whitespace-nowrap">
                              ${item.total_price.toFixed(2)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )
            )}
          </section>

          {/* Resumen de precios */}
          <section className="rounded-xl border border-gray-100 bg-gray-50 p-4 space-y-2.5">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-3">
              Resumen de precios
            </h3>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Subtotal de productos</span>
              <span className="font-medium text-gray-800">
                ${calculation.subtotal_products.toFixed(2)}
              </span>
            </div>
            {calculation.discount_amount > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Descuento aplicado</span>
                <span className="font-medium text-green-600">
                  −${calculation.discount_amount.toFixed(2)}
                </span>
              </div>
            )}
            <div className="flex justify-between border-t border-gray-200 pt-2.5 text-base">
              <span className="font-semibold text-gray-800">Total final</span>
              <span className="text-lg font-bold text-blue-700">
                ${calculation.final_price.toFixed(2)}
              </span>
            </div>
          </section>

          {/* Observaciones */}
          {calculation.observations && (
            <section className="space-y-1.5">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                Observaciones
              </h3>
              <p className="text-sm text-gray-600 leading-relaxed">{calculation.observations}</p>
            </section>
          )}
        </div>

        {/* Footer */}
        <div className="flex flex-shrink-0 items-center justify-between border-t border-gray-100 px-6 py-4">
          <button
            onClick={onClose}
            className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
          >
            Cerrar
          </button>
          <button
            onClick={handlePrint}
            disabled={!canPrint}
            title={!canPrint ? 'Cargando productos…' : 'Abrir vista previa de impresión'}
            className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
            </svg>
            Imprimir resumen
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Sub-componentes ───────────────────────────────────────────────────────────

function InfoRow({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-xs text-gray-400">{label}</dt>
      <dd className={`text-sm font-medium text-gray-800 ${mono ? 'font-mono text-xs' : ''}`}>
        {value}
      </dd>
    </div>
  );
}
