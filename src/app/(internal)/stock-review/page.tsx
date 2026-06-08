import { existsSync, readFileSync } from 'fs';
import path from 'path';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import StockReviewClient from './StockReviewClient';

export const metadata = { title: 'Revisión de Stock — SoftwareAmpollas' };

export default async function StockReviewPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  const jsonPath = path.join(process.cwd(), 'data', 'processed', 'stock-candidates.json');

  if (!existsSync(jsonPath)) {
    return (
      <div className="space-y-4">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Revisión de Stock</h2>
          <p className="mt-0.5 text-sm text-gray-500">
            Análisis de candidatos detectados en documentos de stock
          </p>
        </div>
        <div className="rounded-xl border border-dashed border-amber-200 bg-amber-50 p-10 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-amber-100">
            <svg className="h-6 w-6 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z"
              />
            </svg>
          </div>
          <h3 className="text-base font-semibold text-amber-800 mb-2">
            Archivo de candidatos no encontrado
          </h3>
          <p className="text-sm text-amber-700 mb-4">
            Ejecuta el script de análisis para generar{' '}
            <code className="rounded bg-amber-100 px-1.5 py-0.5 font-mono text-xs">
              data/processed/stock-candidates.json
            </code>
          </p>
          <div className="inline-block rounded-lg bg-gray-900 px-5 py-3 text-left">
            <code className="font-mono text-sm text-green-400">
              node scripts/analyze-stock-documents.mjs
            </code>
          </div>
          <p className="mt-4 text-xs text-amber-600">
            El script leerá los PDFs en{' '}
            <code className="rounded bg-amber-100 px-1 font-mono">data/stock/</code>{' '}
            y generará el JSON de candidatos junto con el reporte Markdown.
          </p>
        </div>
      </div>
    );
  }

  let data;
  try {
    const raw = readFileSync(jsonPath, 'utf-8');
    data = JSON.parse(raw);
  } catch (err) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-6">
        <p className="font-semibold text-red-800">Error al leer el archivo de candidatos</p>
        <p className="mt-1 font-mono text-sm text-red-600">{String(err)}</p>
        <p className="mt-2 text-sm text-red-700">
          Asegúrate de que el archivo es JSON válido regenerándolo con{' '}
          <code className="rounded bg-red-100 px-1 font-mono text-xs">
            node scripts/analyze-stock-documents.mjs
          </code>
        </p>
      </div>
    );
  }

  return <StockReviewClient data={data} />;
}
