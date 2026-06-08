'use client';

import { useState, useMemo, useEffect, Fragment } from 'react';

// ── Types ─────────────────────────────────────────────────────────────────────

interface StockCandidate {
  name: string;
  source_label: string;
  source_type: string;
  priority: 'A' | 'B' | 'C' | null;
  quantity: string | null;
  presentation: string | null;
  brand: string | null;
  dosage: string | null;
  synergy: string | null;
  incompatibilities_detected: string | null;
  indications_detected: string | null;
  price: number | null;
  indications: string[];
  incompatibilities: string[];
  matched_product_name: string | null;
  matched_product_type: string | null;
  matched_product_id: string | null;
  match_score: number | null;
  match_type: string | null;
  status: 'exacta' | 'posible' | 'nueva' | 'revisar';
  isLikelyNoise: boolean;
  noiseReason: string | null;
}

interface StockData {
  generated_at: string;
  products_in_db: number;
  total_candidates: number;
  useful_count: number;
  noise_count: number;
  candidates: StockCandidate[];
}

type Decision    = 'aprobado' | 'ignorado';
type NoiseFilter = 'useful' | 'noise' | 'all';

// ── Constants ─────────────────────────────────────────────────────────────────

const SOURCE_LABELS: Record<string, string> = {
  ampolla_iv:       'Ampollas IV',
  ampolla_quimica:  'Ampollas Químicas',
  gotero_homeop:    'Goteros Homeopáticos',
  capsula_frasco:   'Cápsulas y Frascos',
  gotero_pharmahom: 'Goteros Pharmahom',
  por_enfermedad:   'Por Enfermedad',
};

const STATUS_CONFIG: Record<string, { label: string; cls: string }> = {
  exacta:   { label: 'Exacta',   cls: 'bg-green-50 text-green-700 border-green-200' },
  posible:  { label: 'Posible',  cls: 'bg-blue-50 text-blue-700 border-blue-200' },
  revisar:  { label: 'Revisar',  cls: 'bg-orange-50 text-orange-700 border-orange-200' },
  nueva:    { label: 'Nueva',    cls: 'bg-amber-50 text-amber-700 border-amber-200' },
  aprobado: { label: 'Aprobado', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  ignorado: { label: 'Ignorado', cls: 'bg-gray-100 text-gray-500 border-gray-200' },
};

const STAT_CARDS = [
  { key: 'exacta',   label: 'Exactas',   cls: 'text-green-700 bg-green-50 border-green-200',      ring: 'ring-green-400' },
  { key: 'posible',  label: 'Posibles',  cls: 'text-blue-700 bg-blue-50 border-blue-200',          ring: 'ring-blue-400' },
  { key: 'revisar',  label: 'Revisar',   cls: 'text-orange-700 bg-orange-50 border-orange-200',    ring: 'ring-orange-400' },
  { key: 'nueva',    label: 'Nuevas',    cls: 'text-amber-700 bg-amber-50 border-amber-200',        ring: 'ring-amber-400' },
  { key: 'aprobado', label: 'Aprobados', cls: 'text-emerald-700 bg-emerald-50 border-emerald-200', ring: 'ring-emerald-400' },
  { key: 'ignorado', label: 'Ignorados', cls: 'text-gray-600 bg-gray-50 border-gray-200',          ring: 'ring-gray-400' },
] as const;

const PRIORITY_CLS: Record<string, string> = {
  A: 'bg-red-100 text-red-700',
  B: 'bg-yellow-100 text-yellow-700',
  C: 'bg-blue-100 text-blue-700',
};

const SELECT_CLS =
  'rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 ' +
  'focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500';

const PAGE_SIZE = 30;

// ── Component ─────────────────────────────────────────────────────────────────

export default function StockReviewClient({ data }: { data: StockData }) {
  const [noiseFilter,    setNoiseFilter]    = useState<NoiseFilter>('useful');
  const [search,         setSearch]         = useState('');
  const [statusFilter,   setStatusFilter]   = useState('all');
  const [sourceFilter,   setSourceFilter]   = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [page,           setPage]           = useState(1);
  const [decisions,      setDecisions]      = useState<Record<number, Decision>>({});
  const [expanded,       setExpanded]       = useState<number | null>(null);

  // Persist decisions in localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem('stock-review-v1');
      if (saved) setDecisions(JSON.parse(saved));
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem('stock-review-v1', JSON.stringify(decisions));
    } catch { /* ignore */ }
  }, [decisions]);

  function effStatus(idx: number, base: string): string {
    return decisions[idx] ?? base;
  }

  function decide(idx: number, d: Decision) {
    setDecisions(prev => {
      const next = { ...prev };
      if (next[idx] === d) { delete next[idx]; } else { next[idx] = d; }
      return next;
    });
  }

  // Reset page on any filter change
  useEffect(() => { setPage(1); }, [noiseFilter, search, statusFilter, sourceFilter, priorityFilter]);

  // ── Filter pipeline ───────────────────────────────────────────────────────
  // Step 1: apply noise filter
  const noiseFiltered = useMemo(() => {
    return data.candidates.map((c, i) => ({ c, i })).filter(({ c }) => {
      if (noiseFilter === 'useful' && c.isLikelyNoise)  return false;
      if (noiseFilter === 'noise'  && !c.isLikelyNoise) return false;
      return true;
    });
  }, [data.candidates, noiseFilter]);

  // Step 2: status-card stats from noise-filtered set
  const stats = useMemo(() => {
    const cnt = { exacta: 0, posible: 0, revisar: 0, nueva: 0, aprobado: 0, ignorado: 0 };
    noiseFiltered.forEach(({ c, i }) => {
      const s = effStatus(i, c.status) as keyof typeof cnt;
      if (s in cnt) cnt[s]++;
    });
    return cnt;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [noiseFiltered, decisions]);

  // Step 3: apply remaining filters (search, status, source, priority)
  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return noiseFiltered.filter(({ c, i }) => {
      const eff = effStatus(i, c.status);
      if (statusFilter !== 'all' && eff !== statusFilter) return false;
      if (sourceFilter !== 'all' && c.source_type !== sourceFilter) return false;
      if (priorityFilter === 'none' && c.priority !== null) return false;
      if (priorityFilter !== 'all' && priorityFilter !== 'none' && c.priority !== priorityFilter) return false;
      if (q && !c.name.toLowerCase().includes(q)) return false;
      return true;
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [noiseFiltered, decisions, search, statusFilter, sourceFilter, priorityFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated  = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const approvedCount = Object.values(decisions).filter(d => d === 'aprobado').length;
  const ignoredCount  = Object.values(decisions).filter(d => d === 'ignorado').length;

  const isDirty = search !== '' || statusFilter !== 'all' || sourceFilter !== 'all' || priorityFilter !== 'all';

  // Global noise / useful totals (independent of other filters)
  const usefulTotal = data.useful_count ?? data.candidates.filter(c => !c.isLikelyNoise).length;
  const noiseTotal  = data.noise_count  ?? data.candidates.filter(c => c.isLikelyNoise).length;

  const generatedDate = new Date(data.generated_at).toLocaleDateString('es-EC', {
    day: 'numeric', month: 'short', year: 'numeric',
  });

  return (
    <div className="space-y-5">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Revisión de Stock</h2>
          <p className="mt-0.5 text-sm text-gray-500">
            {data.total_candidates} candidatos totales · {data.products_in_db} productos en BD · {generatedDate}
          </p>
        </div>
        <div className="flex flex-shrink-0 items-center gap-2">
          {(approvedCount > 0 || ignoredCount > 0) && (
            <span className="text-xs text-gray-500">
              {approvedCount > 0 && `${approvedCount} aprobados`}
              {approvedCount > 0 && ignoredCount > 0 && ' · '}
              {ignoredCount > 0 && `${ignoredCount} ignorados`}
            </span>
          )}
          <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700">
            Solo lectura — sin guardar en BD
          </span>
        </div>
      </div>

      {/* ── Noise filter tab bar ───────────────────────────────────────────── */}
      <div className="flex items-center gap-3 flex-wrap">
        {noiseTotal > 0 ? (
          <div className="flex rounded-lg border border-gray-200 bg-gray-50 p-1">
            {([
              { key: 'useful', label: 'Solo útiles',   count: usefulTotal },
              { key: 'noise',  label: 'Posible ruido', count: noiseTotal },
              { key: 'all',    label: 'Todos',          count: data.total_candidates },
            ] as { key: NoiseFilter; label: string; count: number }[]).map(opt => (
              <button
                key={opt.key}
                onClick={() => setNoiseFilter(opt.key)}
                className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                  noiseFilter === opt.key
                    ? 'bg-white shadow-sm text-gray-900'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {opt.label}{' '}
                <span className={`text-xs font-normal ${noiseFilter === opt.key ? 'text-gray-500' : 'text-gray-400'}`}>
                  ({opt.count})
                </span>
              </button>
            ))}
          </div>
        ) : (
          <div className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-3 py-1.5">
            <svg className="h-3.5 w-3.5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="text-xs font-medium text-green-700">
              {data.total_candidates} candidatos — ruido filtrado en el parser
            </span>
          </div>
        )}
        {noiseFilter === 'noise' && (
          <p className="text-xs text-orange-600">
            Entradas detectadas como fragmentos, presentaciones sueltas, instrucciones clínicas o palabras genéricas.
          </p>
        )}
      </div>

      {/* ── Stats cards (clic para filtrar por estado) ─────────────────────── */}
      <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
        {STAT_CARDS.map(s => {
          const active = statusFilter === s.key;
          return (
            <button
              key={s.key}
              onClick={() => setStatusFilter(active ? 'all' : s.key)}
              className={`rounded-xl border p-3 text-center transition-all ${s.cls} ${
                active ? `ring-2 ring-offset-1 ${s.ring}` : 'opacity-75 hover:opacity-100'
              }`}
            >
              <div className="text-2xl font-bold">{stats[s.key]}</div>
              <div className="mt-0.5 text-xs font-medium">{s.label}</div>
            </button>
          );
        })}
      </div>

      {/* ── Filters ────────────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <div className="pointer-events-none absolute inset-y-0 left-3 flex items-center">
            <svg className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <input
            type="text"
            placeholder="Buscar por nombre detectado…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full rounded-lg border border-gray-300 bg-white py-2 pl-9 pr-3 text-sm
                       text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none
                       focus:ring-1 focus:ring-blue-500"
          />
        </div>
        <select value={sourceFilter} onChange={e => setSourceFilter(e.target.value)} className={SELECT_CLS}>
          <option value="all">Todos los documentos</option>
          {Object.entries(SOURCE_LABELS).map(([v, l]) => (
            <option key={v} value={v}>{l}</option>
          ))}
        </select>
        <select value={priorityFilter} onChange={e => setPriorityFilter(e.target.value)} className={SELECT_CLS}>
          <option value="all">Todas las prioridades</option>
          <option value="A">Prioridad A</option>
          <option value="B">Prioridad B</option>
          <option value="C">Prioridad C</option>
          <option value="none">Sin prioridad</option>
        </select>
        {isDirty && (
          <button
            onClick={() => {
              setSearch(''); setStatusFilter('all');
              setSourceFilter('all'); setPriorityFilter('all');
            }}
            className="rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-500
                       hover:bg-gray-50 hover:text-gray-700 whitespace-nowrap transition-colors"
          >
            Limpiar
          </button>
        )}
      </div>

      {/* Counter */}
      <p className="text-xs text-gray-400">
        {filtered.length === noiseFiltered.length
          ? `${noiseFiltered.length} candidatos`
          : `${filtered.length} de ${noiseFiltered.length} candidatos`}
        {totalPages > 1 && ` — página ${page} de ${totalPages}`}
      </p>

      {/* ── Table ──────────────────────────────────────────────────────────── */}
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-100 text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Nombre detectado
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Fuente
                </th>
                <th className="px-3 py-3 text-center text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Prior.
                </th>
                <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Cantidad
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Coincidencia en BD
                </th>
                <th className="px-3 py-3 text-center text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Score
                </th>
                <th className="px-3 py-3 text-center text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Estado
                </th>
                <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {paginated.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-sm text-gray-400">
                    No hay candidatos con los filtros actuales.
                  </td>
                </tr>
              )}

              {paginated.map(({ c, i }) => {
                const eff        = effStatus(i, c.status);
                const cfg        = STATUS_CONFIG[eff] ?? STATUS_CONFIG.nueva;
                const isIgnored  = decisions[i] === 'ignorado';
                const isApproved = decisions[i] === 'aprobado';
                const isExpanded = expanded === i;

                return (
                  <Fragment key={i}>
                    <tr
                      className={`cursor-pointer transition-colors
                        ${isIgnored  ? 'opacity-40'        : ''}
                        ${isApproved ? 'bg-emerald-50/40'  : 'hover:bg-gray-50'}
                        ${c.isLikelyNoise && noiseFilter === 'all' ? 'bg-orange-50/30' : ''}
                      `}
                      onClick={() => setExpanded(isExpanded ? null : i)}
                    >
                      {/* Name */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          {isExpanded && (
                            <svg className="h-3 w-3 flex-shrink-0 text-blue-400" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                            </svg>
                          )}
                          <span className={`font-medium text-gray-900 ${isIgnored ? 'line-through' : ''}`}>
                            {c.name.length > 55 ? c.name.slice(0, 55) + '…' : c.name}
                          </span>
                        </div>
                      </td>

                      {/* Source */}
                      <td className="px-4 py-3">
                        <span className="text-xs text-gray-500">
                          {SOURCE_LABELS[c.source_type] ?? c.source_type}
                        </span>
                      </td>

                      {/* Priority */}
                      <td className="px-3 py-3 text-center">
                        {c.priority ? (
                          <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-bold ${PRIORITY_CLS[c.priority]}`}>
                            {c.priority}
                          </span>
                        ) : (
                          <span className="text-xs text-gray-300">—</span>
                        )}
                      </td>

                      {/* Quantity */}
                      <td className="px-3 py-3">
                        <span className="text-xs text-gray-600">{c.quantity ?? '—'}</span>
                      </td>

                      {/* DB match */}
                      <td className="px-4 py-3">
                        {c.matched_product_name ? (
                          <span className="text-xs text-gray-700">
                            {c.matched_product_name.length > 38
                              ? c.matched_product_name.slice(0, 38) + '…'
                              : c.matched_product_name}
                          </span>
                        ) : (
                          <span className="text-xs text-gray-300">—</span>
                        )}
                      </td>

                      {/* Score */}
                      <td className="px-3 py-3 text-center">
                        {c.match_score !== null ? (
                          <span className={`text-xs font-semibold ${
                            c.match_score >= 90 ? 'text-green-600' :
                            c.match_score >= 65 ? 'text-blue-600' :
                            'text-orange-500'
                          }`}>
                            {c.match_score}%
                          </span>
                        ) : (
                          <span className="text-xs text-gray-300">—</span>
                        )}
                      </td>

                      {/* Status badge */}
                      <td className="px-3 py-3 text-center">
                        <span className={`inline-block rounded-full border px-2.5 py-0.5 text-xs font-medium ${cfg.cls}`}>
                          {cfg.label}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => decide(i, 'aprobado')}
                            title="Marcar como producto válido"
                            className={`rounded px-2 py-1 text-xs font-medium transition-colors ${
                              isApproved
                                ? 'bg-emerald-600 text-white'
                                : 'border border-gray-200 text-gray-500 hover:border-emerald-400 hover:text-emerald-600'
                            }`}
                          >
                            Aprobar
                          </button>
                          <button
                            onClick={() => decide(i, 'ignorado')}
                            title="No es un producto — ignorar"
                            className={`rounded px-2 py-1 text-xs font-medium transition-colors ${
                              isIgnored
                                ? 'bg-gray-400 text-white'
                                : 'border border-gray-200 text-gray-500 hover:border-gray-400 hover:text-gray-700'
                            }`}
                          >
                            Ignorar
                          </button>
                          <button
                            disabled
                            title="Disponible cuando se creen las tablas en Supabase"
                            className="cursor-not-allowed rounded border border-dashed border-gray-200 px-2 py-1 text-xs text-gray-300"
                          >
                            Vincular
                          </button>
                        </div>
                      </td>
                    </tr>

                    {/* Expanded detail row */}
                    {isExpanded && (
                      <tr>
                        <td colSpan={8} className="bg-blue-50/40 px-6 py-4">
                          <div className="grid grid-cols-1 gap-3 text-xs text-gray-600 sm:grid-cols-2 lg:grid-cols-3">
                            {c.isLikelyNoise && c.noiseReason && (
                              <div className="sm:col-span-2 lg:col-span-3 rounded-lg border border-orange-200 bg-orange-50 px-3 py-2 text-orange-700">
                                <span className="font-semibold">Razón de ruido:</span> {c.noiseReason}
                              </div>
                            )}

                            {/* ── Metadata from PDF columns ─────────────────── */}
                            {c.brand && (
                              <div>
                                <span className="font-semibold text-gray-700">Marca / Lab:</span>{' '}
                                {c.brand}
                              </div>
                            )}
                            {c.presentation && (
                              <div>
                                <span className="font-semibold text-gray-700">Presentación:</span>{' '}
                                {c.presentation.length > 80
                                  ? c.presentation.slice(0, 80) + '…'
                                  : c.presentation}
                              </div>
                            )}
                            {c.dosage && (
                              <div className="sm:col-span-2 lg:col-span-3">
                                <span className="font-semibold text-gray-700">Dosificación:</span>{' '}
                                <span className="text-gray-500">
                                  {c.dosage.length > 120 ? c.dosage.slice(0, 120) + '…' : c.dosage}
                                </span>
                              </div>
                            )}
                            {c.synergy && (
                              <div className="sm:col-span-2 lg:col-span-3">
                                <span className="font-semibold text-gray-700">Sinergia / otros:</span>{' '}
                                <span className="text-gray-500">
                                  {c.synergy.length > 120 ? c.synergy.slice(0, 120) + '…' : c.synergy}
                                </span>
                              </div>
                            )}
                            {c.incompatibilities_detected && (
                              <div className="sm:col-span-2 lg:col-span-3 text-red-700">
                                <span className="font-semibold">Incompatibilidades (PDF):</span>{' '}
                                {c.incompatibilities_detected.length > 120
                                  ? c.incompatibilities_detected.slice(0, 120) + '…'
                                  : c.incompatibilities_detected}
                              </div>
                            )}
                            {c.indications_detected && (
                              <div className="sm:col-span-2 lg:col-span-3">
                                <span className="font-semibold text-gray-700">Indicaciones (PDF):</span>{' '}
                                <span className="text-gray-500">
                                  {c.indications_detected.length > 120
                                    ? c.indications_detected.slice(0, 120) + '…'
                                    : c.indications_detected}
                                </span>
                              </div>
                            )}

                            {/* ── DB match info ────────────────────────────── */}
                            {c.price !== null && (
                              <div>
                                <span className="font-semibold text-gray-700">Precio detectado:</span>{' '}
                                ${c.price.toFixed(2)}
                              </div>
                            )}
                            {c.matched_product_type && (
                              <div>
                                <span className="font-semibold text-gray-700">Tipo en BD:</span>{' '}
                                {c.matched_product_type}
                              </div>
                            )}
                            {c.match_type && (
                              <div>
                                <span className="font-semibold text-gray-700">Tipo coincidencia:</span>{' '}
                                {c.match_type}
                              </div>
                            )}
                            {c.matched_product_id && (
                              <div className="font-mono text-[10px] text-gray-400 lg:col-span-1">
                                ID BD: {c.matched_product_id}
                              </div>
                            )}

                            {/* ── Legacy arrays from non-table parsing ─────── */}
                            {c.indications.length > 0 && !c.indications_detected && (
                              <div className="sm:col-span-2 lg:col-span-3">
                                <span className="font-semibold text-gray-700">Indicaciones:</span>{' '}
                                {c.indications.slice(0, 3).join('; ')}
                              </div>
                            )}
                            {c.incompatibilities.length > 0 && !c.incompatibilities_detected && (
                              <div className="sm:col-span-2 lg:col-span-3 text-red-600">
                                <span className="font-semibold">Advertencias:</span>{' '}
                                {c.incompatibilities.slice(0, 2).join('; ')}
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Pagination ─────────────────────────────────────────────────────── */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
            className="rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-600
                       hover:bg-gray-50 disabled:opacity-40 transition-colors"
          >
            Anterior
          </button>
          <div className="flex gap-1">
            {Array.from({ length: Math.min(7, totalPages) }, (_, idx) => {
              const pageNum =
                page <= 4             ? idx + 1 :
                page >= totalPages - 3 ? totalPages - 6 + idx :
                                        page - 3 + idx;
              if (pageNum < 1 || pageNum > totalPages) return null;
              return (
                <button
                  key={pageNum}
                  onClick={() => setPage(pageNum)}
                  className={`h-9 w-9 rounded-lg text-sm transition-colors ${
                    pageNum === page
                      ? 'bg-blue-600 text-white font-semibold'
                      : 'border border-gray-200 text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  {pageNum}
                </button>
              );
            })}
          </div>
          <button
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-600
                       hover:bg-gray-50 disabled:opacity-40 transition-colors"
          >
            Siguiente
          </button>
        </div>
      )}

      {/* ── Footer note ────────────────────────────────────────────────────── */}
      <div className="space-y-1.5 rounded-xl border border-dashed border-amber-200 bg-amber-50 p-4 text-xs text-amber-700">
        <p className="font-semibold">Acerca de esta vista</p>
        <p>
          Las decisiones (Aprobar / Ignorar) se guardan en este navegador vía{' '}
          <code className="rounded bg-amber-100 px-1">localStorage</code> — no se persisten en Supabase.
          Haz clic en cualquier fila para ver marca, presentación, dosificación, sinergia e incompatibilidades detectadas en el PDF.
        </p>
        <p>
          El parser detecta la columna <strong>NOMBRE</strong> de las tablas PDF y almacena las demás columnas
          (MARCA, PRESENTACIÓN, DOSIFICACIÓN, SINERGIA, INHIBIDOR, INDICACIONES) como metadatos del candidato.
          Las presentaciones sueltas, instrucciones clínicas y fragmentos se filtran antes de crear candidatos.
        </p>
        <p>
          El botón <strong>Vincular</strong> estará disponible después de ejecutar{' '}
          <code className="rounded bg-amber-100 px-1">supabase/stock-schema.sql</code>.
          Para regenerar:{' '}
          <code className="rounded bg-amber-100 px-1">node scripts/analyze-stock-documents.mjs</code>
        </p>
      </div>
    </div>
  );
}
