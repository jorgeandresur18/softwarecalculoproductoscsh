'use client';

import { useState } from 'react';
import type { Product, Symptom, UserRole } from '@/types/database';
import type { RecommendationResult } from './actions';
import { getRecommendations, saveCalculation } from './actions';
import SymptomSelector from './SymptomSelector';
import RecommendationsTable from './RecommendationsTable';
import ManualProductSearch from './ManualProductSearch';
import SelectedProductsTable from './SelectedProductsTable';
import CalculationSummary from './CalculationSummary';

export type SelectedProduct = {
  product_id:   string;
  name:         string;
  product_type: string;
  brand:        string | null;
  pvp:          number;
  quantity:     number;
};

type Props = {
  symptoms:  Symptom[];
  products:  Product[];
  userRole:  UserRole;
};

export default function CalculationClient({ symptoms, products, userRole }: Props) {
  const [patientRef,          setPatientRef]          = useState('');
  const [patientCity,         setPatientCity]         = useState('');
  const [selectedSymptomIds,  setSelectedSymptomIds]  = useState<string[]>([]);
  const [recommendations,     setRecommendations]     = useState<RecommendationResult[]>([]);
  const [selectedProducts,    setSelectedProducts]    = useState<SelectedProduct[]>([]);
  const [discount,            setDiscount]            = useState(0);
  const [observations,        setObservations]        = useState('');
  const [isLoadingRec,        setIsLoadingRec]        = useState(false);
  const [recError,            setRecError]            = useState<string | null>(null);
  const [isSaving,            setIsSaving]            = useState(false);
  const [saveError,           setSaveError]           = useState<string | null>(null);
  const [savedId,             setSavedId]             = useState<string | null>(null);
  const [savedTotal,          setSavedTotal]          = useState(0);

  const subtotal      = selectedProducts.reduce((acc, p) => acc + p.pvp * p.quantity, 0);
  const finalPrice    = Math.max(0, subtotal - discount);
  const hasPriceIssues = selectedProducts.some(p => !p.pvp || p.pvp <= 0);

  const selectedSymptomNames = selectedSymptomIds
    .map(id => symptoms.find(s => s.id === id)?.name ?? '')
    .filter(Boolean);

  const addedProductIds = selectedProducts.map(p => p.product_id);

  // ── Handlers ─────────────────────────────────────────────────────────────────

  const handleGenerateRecommendations = async () => {
    setIsLoadingRec(true);
    setRecError(null);
    const result = await getRecommendations(selectedSymptomIds);
    setIsLoadingRec(false);
    if (result.error) {
      setRecError(result.error);
    } else {
      setRecommendations(result.data ?? []);
    }
  };

  const handleAddProduct = (product: SelectedProduct) => {
    if (selectedProducts.some(p => p.product_id === product.product_id)) return;
    setSelectedProducts(prev => [...prev, { ...product, quantity: 1 }]);
  };

  const handleQuantityChange = (productId: string, quantity: number) => {
    setSelectedProducts(prev =>
      prev.map(p =>
        p.product_id === productId ? { ...p, quantity: Math.max(1, quantity) } : p,
      ),
    );
  };

  const handleRemove = (productId: string) => {
    setSelectedProducts(prev => prev.filter(p => p.product_id !== productId));
  };

  const handleSave = async () => {
    setSaveError(null);

    if (!selectedProducts.length) {
      setSaveError('Debe agregar al menos un producto al cálculo.');
      return;
    }
    if (hasPriceIssues) {
      setSaveError('Hay productos sin precio configurado. Retíralos antes de guardar.');
      return;
    }

    setIsSaving(true);
    const result = await saveCalculation({
      patient_reference: patientRef.trim() || null,
      patient_city:      patientCity.trim() || null,
      symptom_ids:       selectedSymptomIds,
      symptoms_text:     selectedSymptomNames.join(', '),
      items: selectedProducts.map(p => ({
        product_id:            p.product_id,
        product_name_snapshot: p.name,
        quantity:              p.quantity,
        unit_price:            p.pvp,
        total_price:           p.pvp * p.quantity,
      })),
      subtotal_products: subtotal,
      discount_amount:   discount,
      final_price:       finalPrice,
      observations:      observations.trim() || null,
    });
    setIsSaving(false);

    if (result.error) {
      setSaveError(result.error);
    } else {
      setSavedTotal(finalPrice);
      setSavedId(result.calculationId ?? '');
    }
  };

  const handleNewCalculation = () => {
    setPatientRef('');
    setPatientCity('');
    setSelectedSymptomIds([]);
    setRecommendations([]);
    setSelectedProducts([]);
    setDiscount(0);
    setObservations('');
    setSavedId(null);
    setSaveError(null);
    setSavedTotal(0);
  };

  // ── Vista guardado exitoso ────────────────────────────────────────────────────

  if (savedId !== null) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[40vh]">
        <div className="rounded-xl border border-green-200 bg-green-50 px-8 py-8 max-w-md w-full text-center space-y-3">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
            <svg
              className="h-6 w-6 text-green-600"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <p className="text-lg font-bold text-green-800">Cálculo guardado</p>
          <p className="text-sm text-green-600">
            Total final:{' '}
            <span className="font-bold">${savedTotal.toFixed(2)}</span>
          </p>
          {savedId && (
            <p className="text-xs text-green-500 font-mono break-all">ID: {savedId}</p>
          )}
          <button
            onClick={handleNewCalculation}
            className="mt-2 rounded-lg bg-green-600 px-5 py-2 text-sm font-semibold text-white hover:bg-green-700 transition-colors"
          >
            Nuevo cálculo
          </button>
        </div>
      </div>
    );
  }

  // ── Vista principal ───────────────────────────────────────────────────────────

  return (
    <div className="space-y-5 max-w-5xl">
      {/* Encabezado */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Nuevo cálculo de suero</h2>
          <p className="mt-0.5 text-sm text-gray-500">
            Selecciona síntomas, genera recomendaciones y calcula el precio del suero.
          </p>
        </div>
        {userRole === 'admin' && (
          <span className="flex-shrink-0 rounded-full border border-purple-200 bg-purple-50 px-2.5 py-1 text-xs font-semibold text-purple-700">
            Modo administrador
          </span>
        )}
      </div>

      {/* Datos del paciente */}
      <div className="rounded-xl border border-gray-200 bg-white p-5 space-y-4">
        <h3 className="text-sm font-semibold text-gray-700">Datos del paciente (opcional)</h3>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">
              Referencia del paciente
            </label>
            <input
              type="text"
              value={patientRef}
              onChange={e => setPatientRef(e.target.value)}
              placeholder="Nombre, código o referencia..."
              className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm focus:border-blue-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-100"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Ciudad</label>
            <input
              type="text"
              value={patientCity}
              onChange={e => setPatientCity(e.target.value)}
              placeholder="Ciudad del paciente..."
              className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm focus:border-blue-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-100"
            />
          </div>
        </div>
      </div>

      {/* Layout principal: síntomas | contenido */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        {/* Columna izquierda: selector de síntomas */}
        <div className="lg:col-span-1 space-y-3">
          <SymptomSelector
            symptoms={symptoms}
            selectedIds={selectedSymptomIds}
            onChange={setSelectedSymptomIds}
            onGenerate={handleGenerateRecommendations}
            isLoading={isLoadingRec}
          />
          {recError && (
            <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2.5">
              <p className="text-xs text-red-700">{recError}</p>
            </div>
          )}
        </div>

        {/* Columna derecha: recomendaciones + búsqueda + tabla + resumen */}
        <div className="lg:col-span-2 space-y-5">
          {/* Recomendaciones generadas */}
          {recommendations.length > 0 && (
            <RecommendationsTable
              recommendations={recommendations}
              onAdd={handleAddProduct}
              addedIds={addedProductIds}
            />
          )}
          {recommendations.length === 0 && selectedSymptomIds.length > 0 && !isLoadingRec && (
            <div className="rounded-xl border border-gray-200 bg-gray-50 p-5 text-center">
              <p className="text-sm text-gray-400">
                No se encontraron recomendaciones para los síntomas seleccionados.
              </p>
              <p className="mt-1 text-xs text-gray-400">
                Puedes agregar productos manualmente desde la búsqueda.
              </p>
            </div>
          )}

          {/* Búsqueda manual */}
          <ManualProductSearch
            products={products}
            onAdd={handleAddProduct}
            addedIds={addedProductIds}
          />

          {/* Tabla de productos seleccionados */}
          <SelectedProductsTable
            products={selectedProducts}
            onQuantityChange={handleQuantityChange}
            onRemove={handleRemove}
          />

          {/* Resumen y guardado */}
          <CalculationSummary
            selectedSymptomNames={selectedSymptomNames}
            subtotal={subtotal}
            discount={discount}
            onDiscountChange={setDiscount}
            isAdmin={userRole === 'admin'}
            onSave={handleSave}
            isSaving={isSaving}
            saveError={saveError}
            hasProducts={selectedProducts.length > 0}
            hasPriceIssues={hasPriceIssues}
            observations={observations}
            onObservationsChange={setObservations}
          />
        </div>
      </div>
    </div>
  );
}
