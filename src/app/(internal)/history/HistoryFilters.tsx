'use client';

export type DateRange = 'all' | 'today' | '7d' | '30d';

export type FilterState = {
  search:    string;
  dateRange: DateRange;
};

type Props = {
  filters:  FilterState;
  onChange: (f: FilterState) => void;
  total:    number;
  filtered: number;
};

const DATE_OPTIONS: { value: DateRange; label: string }[] = [
  { value: 'all',   label: 'Todos'          },
  { value: 'today', label: 'Hoy'            },
  { value: '7d',    label: 'Últimos 7 días' },
  { value: '30d',   label: 'Últimos 30 días'},
];

export default function HistoryFilters({ filters, onChange, total, filtered }: Props) {
  const set = (partial: Partial<FilterState>) =>
    onChange({ ...filters, ...partial });

  return (
    <div className="rounded-xl border border-gray-200 bg-white px-4 py-3 space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        {/* Búsqueda */}
        <div className="relative flex-1 min-w-[200px]">
          <svg
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
          </svg>
          <input
            type="text"
            value={filters.search}
            onChange={e => set({ search: e.target.value })}
            placeholder="Buscar por paciente, ciudad o síntomas..."
            className="w-full rounded-lg border border-gray-200 bg-gray-50 py-2 pl-9 pr-3 text-sm focus:border-blue-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-100"
          />
        </div>

        {/* Filtro de fecha */}
        <div className="flex items-center gap-1 rounded-lg border border-gray-200 bg-gray-50 p-1">
          {DATE_OPTIONS.map(opt => (
            <button
              key={opt.value}
              onClick={() => set({ dateRange: opt.value })}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                filters.dateRange === opt.value
                  ? 'bg-white text-blue-700 shadow-sm border border-gray-200'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Contador */}
      <p className="text-xs text-gray-400">
        Mostrando{' '}
        <span className="font-semibold text-gray-600">{filtered}</span>
        {' '}de{' '}
        <span className="font-semibold text-gray-600">{total}</span>
        {' '}cálculo{total !== 1 ? 's' : ''}
      </p>
    </div>
  );
}
