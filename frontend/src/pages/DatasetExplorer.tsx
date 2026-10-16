import { useState, useMemo } from 'react';
import { useValidatedCombos } from '@/hooks/useValidatedCombos';
import type { ValidatedCombo } from '@/types';
import { Panel, KpiCard, ErrorState, EmptyState, Spinner, DataSourceTag, ExplanationBox } from '@/components/ui';
import {
  computeGammaStats,
  buildHistogram,
  computeMoaFrequency,
  countUniqueCompounds,
  downloadCsv,
  getGammaColor,
  getGammaBadgeClass,
  fmt4,
  fmt2,
  fmtInt,
} from '@/lib/chart-utils';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  ScatterChart,
  Scatter,
  ReferenceLine,
  ZAxis,
} from 'recharts';
import {
  Download,
  Search,
  ChevronUp,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  X,
  Filter,
  Layers,
  FlaskConical,
  Info,
  Database,
} from 'lucide-react';

type SortField = 'Gamma' | 'Sample Name 1' | 'Sample Name 2' | 'MOA 1' | 'MOA 2';
type SortDirection = 'asc' | 'desc';

const TOOLTIP_STYLE = {
  backgroundColor: '#FFFFFF',
  border: '1px solid #CBD5E1',
  borderRadius: '8px',
  color: '#0F172A',
  fontSize: '12px',
  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
};

export default function DatasetExplorer() {
  const { combos, loading, error, refresh } = useValidatedCombos(307);

  // Table state
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMoa, setSelectedMoa] = useState<string>('ALL');
  const [synergyFilter, setSynergyFilter] = useState<'ALL' | 'HIGH' | 'MODERATE' | 'OTHER'>('ALL');
  const [sortField, setSortField] = useState<SortField>('Gamma');
  const [sortDir, setSortDir] = useState<SortDirection>('asc');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 15;

  // Selected item for modal
  const [selectedPair, setSelectedPair] = useState<ValidatedCombo | null>(null);

  // Statistics from actual combos
  const gammas = useMemo(() => combos.map((c) => c.Gamma).filter((g) => typeof g === 'number' && !isNaN(g)), [combos]);
  const stats = useMemo(() => computeGammaStats(gammas), [gammas]);
  const uniqueCompoundsCount = useMemo(() => countUniqueCompounds(combos), [combos]);
  const moaList = useMemo(() => computeMoaFrequency(combos), [combos]);

  const distinctMoasCount = useMemo(() => {
    const moas = new Set<string>();
    combos.forEach((c) => {
      if (c['MOA 1']) moas.add(String(c['MOA 1']).trim());
      if (c['MOA 2']) moas.add(String(c['MOA 2']).trim());
    });
    return moas.size;
  }, [combos]);

  // Histogram data
  const histogramData = useMemo(() => buildHistogram(gammas, 10), [gammas]);

  // Top 10 lowest Gamma combos (highest synergy) - with clean labels for horizontal display
  const top10Lowest = useMemo(() => {
    return [...combos]
      .sort((a, b) => a.Gamma - b.Gamma)
      .slice(0, 10)
      .map((c) => ({
        fullName: `${c['Sample Name 1']} + ${c['Sample Name 2']}`,
        displayLabel: `${c['Sample Name 1']} + ${c['Sample Name 2']}`.length > 28
          ? `${c['Sample Name 1']} + ${c['Sample Name 2']}`.slice(0, 28) + '…'
          : `${c['Sample Name 1']} + ${c['Sample Name 2']}`,
        gamma: c.Gamma,
        moa1: c['MOA 1'],
        moa2: c['MOA 2'],
      }));
  }, [combos]);

  // Scatter chart data: Rank vs Gamma
  const rankScatterData = useMemo(() => {
    const sorted = [...combos].sort((a, b) => a.Gamma - b.Gamma);
    return sorted.map((c, index) => ({
      rank: index + 1,
      gamma: c.Gamma,
      name: `${c['Sample Name 1']} + ${c['Sample Name 2']}`,
      moa: `${c['MOA 1']} / ${c['MOA 2']}`,
    }));
  }, [combos]);

  // Filtered & sorted table data
  const filteredCombos = useMemo(() => {
    return combos.filter((item) => {
      const q = searchQuery.toLowerCase().trim();
      const matchSearch =
        !q ||
        String(item['Sample Name 1']).toLowerCase().includes(q) ||
        String(item['Sample Name 2']).toLowerCase().includes(q) ||
        String(item['MOA 1']).toLowerCase().includes(q) ||
        String(item['MOA 2']).toLowerCase().includes(q) ||
        String(item.Gamma).includes(q);

      const matchMoa =
        selectedMoa === 'ALL' ||
        String(item['MOA 1']) === selectedMoa ||
        String(item['MOA 2']) === selectedMoa;

      let matchSynergy = true;
      if (synergyFilter === 'HIGH') matchSynergy = item.Gamma < 0.5;
      else if (synergyFilter === 'MODERATE') matchSynergy = item.Gamma >= 0.5 && item.Gamma < 1.0;
      else if (synergyFilter === 'OTHER') matchSynergy = item.Gamma >= 1.0;

      return matchSearch && matchMoa && matchSynergy;
    });
  }, [combos, searchQuery, selectedMoa, synergyFilter]);

  const sortedCombos = useMemo(() => {
    return [...filteredCombos].sort((a, b) => {
      let valA = a[sortField];
      let valB = b[sortField];

      if (typeof valA === 'string') valA = valA.toLowerCase();
      if (typeof valB === 'string') valB = valB.toLowerCase();

      if (valA < valB) return sortDir === 'asc' ? -1 : 1;
      if (valA > valB) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
  }, [filteredCombos, sortField, sortDir]);

  // Pagination
  const totalPages = Math.max(1, Math.ceil(sortedCombos.length / pageSize));
  const paginatedCombos = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return sortedCombos.slice(start, start + pageSize);
  }, [sortedCombos, currentPage, pageSize]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir('asc');
    }
    setCurrentPage(1);
  };

  const handleExportCsv = () => {
    const exportRows = sortedCombos.map((c) => ({
      Gamma: c.Gamma,
      'Sample Name 1': c['Sample Name 1'],
      'Sample Name 2': c['Sample Name 2'],
      'MOA 1': c['MOA 1'],
      'MOA 2': c['MOA 2'],
    }));
    downloadCsv(exportRows, `panc1_validated_combos_${exportRows.length}_records.csv`);
  };

  if (loading && combos.length === 0) {
    return (
      <div className="p-8 flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <Spinner size="lg" />
        <p className="text-sm font-medium text-slate-600">Retrieving NCATS PANC-1 validated combinations from backend...</p>
        <DataSourceTag source="GET /api/v1/combos/validated?limit=307" />
      </div>
    );
  }

  if (error && combos.length === 0) {
    return (
      <div className="p-8">
        <ErrorState
          message={`Failed to retrieve validated combinations: ${error}`}
          onRetry={refresh}
        />
      </div>
    );
  }

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      {/* ── 1. Page Header ─────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200/90 pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-teal-50 border border-teal-200 text-teal-700 flex items-center justify-center font-bold">
              <Database size={18} />
            </div>
            <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">Dataset Explorer</h1>
            <span className="badge-moderate">307 NCATS Validated Pairs</span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Experimentally measured synergistic drug combinations from NCATS PANC-1 in-vitro viability matrix assays.
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <button
            onClick={handleExportCsv}
            className="btn-secondary text-xs flex items-center gap-1.5"
            title="Export filtered records as CSV"
          >
            <Download size={13} />
            <span>Export CSV ({sortedCombos.length})</span>
          </button>
          <button
            onClick={refresh}
            className="btn-ghost text-xs p-2 border border-slate-200"
            title="Refresh from API"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin text-teal-600' : ''} />
          </button>
        </div>
      </div>

      {/* ── 2. Compact Headline Summary Cards ──────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        <KpiCard
          label="Retrieved Pairs"
          value={fmtInt(combos.length)}
          subtext="NCATS experimental set"
          accent
        />
        <KpiCard
          label="Unique Drugs"
          value={fmtInt(uniqueCompoundsCount)}
          subtext="Distinct agents in pairs"
        />
        <KpiCard
          label="Distinct MOAs"
          value={fmtInt(distinctMoasCount)}
          subtext="Target mechanisms"
        />
        <KpiCard
          label="Min Gamma (Top)"
          value={fmt4(stats.min)}
          subtext="Highest synergy lead"
          accent
        />
        <KpiCard
          label="Median Gamma"
          value={fmt4(stats.median)}
          subtext="50th percentile score"
        />
        <KpiCard
          label="Max Gamma"
          value={fmt4(stats.max)}
          subtext="All pairs γ < 1.0 (Synergy)"
        />
      </div>

      {/* ── 3. Distribution Summary Panel (Quartiles & Statistical Range) ──── */}
      <Panel
        title="Experimental Gamma Quartiles & Statistical Range"
        subtitle={`Summary distribution statistics calculated across all ${combos.length} retrieved validated pairs`}
        headerRight={<DataSourceTag source="Sample N = 307" />}
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3 text-center">
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
              <span className="text-[10px] text-slate-500 uppercase font-bold block">Min (Top Synergy)</span>
              <span className="text-sm font-bold text-emerald-700 font-mono mt-0.5 block">{fmt4(stats.min)}</span>
            </div>
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
              <span className="text-[10px] text-slate-500 uppercase font-bold block">Q1 (25th %)</span>
              <span className="text-sm font-bold text-teal-700 font-mono mt-0.5 block">{fmt4(stats.q1)}</span>
            </div>
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
              <span className="text-[10px] text-slate-500 uppercase font-bold block">Median (50th %)</span>
              <span className="text-sm font-bold text-slate-900 font-mono mt-0.5 block">{fmt4(stats.median)}</span>
            </div>
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
              <span className="text-[10px] text-slate-500 uppercase font-bold block">Mean (Average)</span>
              <span className="text-sm font-bold text-slate-900 font-mono mt-0.5 block">{fmt4(stats.mean)}</span>
            </div>
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
              <span className="text-[10px] text-slate-500 uppercase font-bold block">Q3 (75th %)</span>
              <span className="text-sm font-bold text-slate-700 font-mono mt-0.5 block">{fmt4(stats.q3)}</span>
            </div>
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
              <span className="text-[10px] text-slate-500 uppercase font-bold block">Max Score</span>
              <span className="text-sm font-bold text-slate-700 font-mono mt-0.5 block">{fmt4(stats.max)}</span>
            </div>
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
              <span className="text-[10px] text-slate-500 uppercase font-bold block">Std Deviation</span>
              <span className="text-sm font-bold text-slate-500 font-mono mt-0.5 block">±{fmt4(stats.std)}</span>
            </div>
          </div>

          {/* Visual scale bar */}
          <div className="pt-2">
            <div className="h-3 w-full rounded-full bg-slate-200 overflow-hidden flex shadow-inner">
              <div className="h-full bg-emerald-500/80" style={{ width: '40%' }} title="High Synergy (Gamma < 0.5)" />
              <div className="h-full bg-teal-500/70" style={{ width: '50%' }} title="Moderate Synergy (0.5 <= Gamma < 1.0)" />
              <div className="h-full bg-slate-400/50" style={{ width: '10%' }} title="Near Additive Boundary" />
            </div>
            <div className="flex justify-between text-[11px] text-slate-500 mt-1.5 px-0.5">
              <span>0.0 (High Synergy)</span>
              <span>0.5 (Moderate Threshold)</span>
              <span>1.0 (Synergy Boundary)</span>
              <span>Max Observed: {fmt2(stats.max)}</span>
            </div>
          </div>
        </div>
      </Panel>

      {/* ── 4. Charts Grid (Clean, Horizontal Bars for Long Labels) ──────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* Gamma Distribution Histogram */}
        <Panel
          title="Gamma Score Distribution"
          subtitle={`Histogram of ${gammas.length} experimentally measured synergy values`}
        >
          <div className="h-60">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={histogramData} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                <XAxis
                  dataKey="binLabel"
                  stroke="#94A3B8"
                  fontSize={12}
                  tick={{ fill: '#475569' }}
                  tickLine={false}
                />
                <YAxis stroke="#94A3B8" fontSize={12} tick={{ fill: '#475569' }} tickLine={false} />
                <Tooltip
                  contentStyle={TOOLTIP_STYLE}
                  formatter={(val: number) => [`${val} pairs`, 'Frequency']}
                  labelFormatter={(lbl: string) => `Gamma bin: ${lbl}`}
                />
                <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                  {histogramData.map((bin, index) => (
                    <Cell key={`cell-${index}`} fill={getGammaColor(bin.binStart)} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <ExplanationBox title="Distribution Takeaway">
            Values are concentrated between 0.30 and 0.85, reflecting the pre-filtered nature of the NCATS 307 dataset, which focuses primarily on combinations with synergistic in-vitro activity.
          </ExplanationBox>
        </Panel>

        {/* Top 10 Lowest Gamma Combinations (Horizontal Bars) */}
        <Panel
          title="Top 10 Most Synergistic Validated Pairs"
          subtitle="Drug combinations exhibiting the lowest Gamma scores in PANC-1 assays"
        >
          <div className="h-60">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={top10Lowest}
                layout="vertical"
                margin={{ top: 5, right: 30, left: 10, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" horizontal={false} />
                <XAxis
                  type="number"
                  domain={[0, 0.4]}
                  stroke="#94A3B8"
                  fontSize={12}
                  tick={{ fill: '#475569' }}
                  tickLine={false}
                />
                <YAxis
                  dataKey="displayLabel"
                  type="category"
                  stroke="#94A3B8"
                  fontSize={12}
                  tick={{ fill: '#1E293B', fontWeight: 500 }}
                  tickLine={false}
                  width={160}
                />
                <Tooltip
                  contentStyle={TOOLTIP_STYLE}
                  formatter={(val: number) => [fmt4(val), 'Gamma Score']}
                  labelFormatter={(_: string, payload: any[]) => {
                    const row = payload?.[0]?.payload;
                    return row ? `${row.fullName} (${row.moa1} + ${row.moa2})` : '';
                  }}
                />
                <Bar dataKey="gamma" radius={[0, 4, 4, 0]}>
                  {top10Lowest.map((entry, index) => (
                    <Cell key={`cell-top10-${index}`} fill={getGammaColor(entry.gamma)} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <ExplanationBox title="Lead Discovery">
            Combinations containing Panobinostat, Carfilzomib, and Trichostatin A form the top tier of synergistic interaction in the PANC-1 line.
          </ExplanationBox>
        </Panel>

        {/* Mechanism of Action Frequency (Horizontal Bars) */}
        <Panel
          title="Targeted Mechanism Frequency"
          subtitle="Most common therapeutic drug classes across both combination positions"
        >
          <div className="h-60">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={moaList.slice(0, 8)}
                layout="vertical"
                margin={{ top: 5, right: 20, left: 10, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" horizontal={false} />
                <XAxis type="number" stroke="#94A3B8" fontSize={12} tick={{ fill: '#475569' }} tickLine={false} />
                <YAxis
                  dataKey="moa"
                  type="category"
                  stroke="#94A3B8"
                  fontSize={12}
                  tick={{ fill: '#1E293B', fontWeight: 500 }}
                  tickLine={false}
                  width={150}
                  tickFormatter={(val: string) => (val.length > 22 ? val.slice(0, 22) + '…' : val)}
                />
                <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(count: number) => [`${count} occurrences`, 'Count']} />
                <Bar dataKey="count" fill="#0D9488" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <ExplanationBox title="Pathway Enrichment">
            HDAC inhibitors and Proteasome inhibitors appear with the highest frequency, indicating that chromatin remodeling paired with proteostatic stress is an effective combinatorial strategy.
          </ExplanationBox>
        </Panel>

        {/* Combination Synergy Spectrum Plot */}
        <Panel
          title="Rank vs. Synergy Spectrum"
          subtitle="All 307 validated combinations ranked from lowest to highest Gamma"
        >
          <div className="h-60">
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart margin={{ top: 10, right: 15, left: -20, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                <XAxis
                  type="number"
                  dataKey="rank"
                  name="Rank"
                  stroke="#94A3B8"
                  fontSize={12}
                  tick={{ fill: '#475569' }}
                  tickLine={false}
                  label={{ value: 'Synergy Rank (1 = Strongest)', position: 'insideBottom', offset: -10, fill: '#475569', fontSize: 11 }}
                />
                <YAxis
                  type="number"
                  dataKey="gamma"
                  name="Gamma"
                  stroke="#94A3B8"
                  fontSize={12}
                  tick={{ fill: '#475569' }}
                  tickLine={false}
                  domain={[0, 1.1]}
                />
                <ZAxis range={[25, 25]} />
                <ReferenceLine y={0.5} stroke="#059669" strokeDasharray="3 3" label={{ value: 'High Synergy (0.5)', fill: '#059669', fontSize: 11 }} />
                <ReferenceLine y={1.0} stroke="#E11D48" strokeDasharray="3 3" label={{ value: 'Additive (1.0)', fill: '#E11D48', fontSize: 11 }} />
                <Tooltip
                  contentStyle={TOOLTIP_STYLE}
                  formatter={(val: number, name: string) => (name === 'Gamma' ? [fmt4(val), 'Gamma'] : [val, name])}
                />
                <Scatter name="Combinations" data={rankScatterData} fill="#0284C7" />
              </ScatterChart>
            </ResponsiveContainer>
          </div>
          <ExplanationBox title="Synergy Thresholds">
            Pairs plotted under the dashed green line (γ &lt; 0.5) belong to the high-synergy cohort.
          </ExplanationBox>
        </Panel>
      </div>

      {/* ── 5. Searchable & Filterable Research Data Table ─────────────────── */}
      <Panel
        title="NCATS Experimental Combinations Registry"
        subtitle={`Showing ${sortedCombos.length} of ${combos.length} total validated pairs`}
        headerRight={
          <span className="text-xs text-slate-500 font-medium">
            Page {currentPage} of {totalPages}
          </span>
        }
      >
        {/* Table Filter Controls Bar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 mb-4 pb-3 border-b border-slate-100">
          
          {/* Global search */}
          <div className="relative flex-1">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search by drug name, mechanism of action, or score..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              className="input-field pl-9 pr-8 text-xs py-2"
            />
            {searchQuery && (
              <button
                onClick={() => {
                  setSearchQuery('');
                  setCurrentPage(1);
                }}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X size={13} />
              </button>
            )}
          </div>

          {/* MOA filter dropdown */}
          <div className="flex items-center gap-1.5 shrink-0">
            <Filter size={13} className="text-slate-400" />
            <select
              value={selectedMoa}
              onChange={(e) => {
                setSelectedMoa(e.target.value);
                setCurrentPage(1);
              }}
              className="input-field text-xs py-2 w-48"
            >
              <option value="ALL">All Mechanisms ({distinctMoasCount})</option>
              {moaList.map((m) => (
                <option key={m.moa} value={m.moa}>
                  {m.moa} ({m.count})
                </option>
              ))}
            </select>
          </div>

          {/* Synergy level filter */}
          <div className="flex items-center gap-1.5 shrink-0">
            <Layers size={13} className="text-slate-400" />
            <select
              value={synergyFilter}
              onChange={(e) => {
                setSynergyFilter(e.target.value as 'ALL' | 'HIGH' | 'MODERATE' | 'OTHER');
                setCurrentPage(1);
              }}
              className="input-field text-xs py-2 w-40"
            >
              <option value="ALL">All Synergy Tiers</option>
              <option value="HIGH">High (γ &lt; 0.5)</option>
              <option value="MODERATE">Moderate (0.5–1.0)</option>
              <option value="OTHER">Additive (γ ≥ 1.0)</option>
            </select>
          </div>
        </div>

        {/* Table Content */}
        {sortedCombos.length === 0 ? (
          <EmptyState
            message="No combination pairs match your search or filter criteria."
            icon="🔍"
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/70 text-slate-600 font-semibold">
                  <th
                    onClick={() => handleSort('Sample Name 1')}
                    className="py-3 px-3.5 cursor-pointer hover:text-slate-900 select-none"
                  >
                    <div className="flex items-center gap-1">
                      <span>Drug 1</span>
                      {sortField === 'Sample Name 1' &&
                        (sortDir === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />)}
                    </div>
                  </th>
                  <th
                    onClick={() => handleSort('Sample Name 2')}
                    className="py-3 px-3.5 cursor-pointer hover:text-slate-900 select-none"
                  >
                    <div className="flex items-center gap-1">
                      <span>Drug 2</span>
                      {sortField === 'Sample Name 2' &&
                        (sortDir === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />)}
                    </div>
                  </th>
                  <th
                    onClick={() => handleSort('Gamma')}
                    className="py-3 px-3.5 cursor-pointer hover:text-slate-900 select-none"
                  >
                    <div className="flex items-center gap-1">
                      <span>Measured Gamma (γ)</span>
                      {sortField === 'Gamma' &&
                        (sortDir === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />)}
                    </div>
                  </th>
                  <th
                    onClick={() => handleSort('MOA 1')}
                    className="py-3 px-3.5 cursor-pointer hover:text-slate-900 select-none hidden sm:table-cell"
                  >
                    <div className="flex items-center gap-1">
                      <span>MOA 1</span>
                      {sortField === 'MOA 1' &&
                        (sortDir === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />)}
                    </div>
                  </th>
                  <th
                    onClick={() => handleSort('MOA 2')}
                    className="py-3 px-3.5 cursor-pointer hover:text-slate-900 select-none hidden md:table-cell"
                  >
                    <div className="flex items-center gap-1">
                      <span>MOA 2</span>
                      {sortField === 'MOA 2' &&
                        (sortDir === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />)}
                    </div>
                  </th>
                  <th className="py-3 px-3.5 text-right font-semibold">Inspect</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {paginatedCombos.map((row, idx) => (
                  <tr
                    key={`${row['Sample Name 1']}-${row['Sample Name 2']}-${idx}`}
                    className="hover:bg-slate-50/80 transition-colors group cursor-pointer"
                    onClick={() => setSelectedPair(row)}
                  >
                    <td className="py-2.5 px-3.5 font-semibold text-slate-900">
                      {row['Sample Name 1']}
                    </td>
                    <td className="py-2.5 px-3.5 font-semibold text-slate-900">
                      {row['Sample Name 2']}
                    </td>
                    <td className="py-2.5 px-3.5 font-mono">
                      <span className={getGammaBadgeClass(row.Gamma)}>
                        {fmt4(row.Gamma)}
                      </span>
                    </td>
                    <td className="py-2.5 px-3.5 text-slate-600 hidden sm:table-cell">
                      {row['MOA 1'] || '—'}
                    </td>
                    <td className="py-2.5 px-3.5 text-slate-600 hidden md:table-cell">
                      {row['MOA 2'] || '—'}
                    </td>
                    <td className="py-2.5 px-3.5 text-right">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedPair(row);
                        }}
                        className="text-[11px] text-teal-700 hover:text-teal-900 font-semibold underline"
                      >
                        Inspect
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Controls */}
        {sortedCombos.length > 0 && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 mt-4 pt-3 border-t border-slate-100 text-xs text-slate-500">
            <span>
              Showing {(currentPage - 1) * pageSize + 1}–
              {Math.min(currentPage * pageSize, sortedCombos.length)} of {sortedCombos.length} entries
            </span>
            <div className="flex items-center gap-1.5">
              <button
                disabled={currentPage <= 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                className="btn-secondary py-1 px-3 text-xs disabled:opacity-40"
              >
                <ChevronLeft size={13} />
                <span>Prev</span>
              </button>
              <span className="px-2 text-slate-700 font-semibold">
                {currentPage} / {totalPages}
              </span>
              <button
                disabled={currentPage >= totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                className="btn-secondary py-1 px-3 text-xs disabled:opacity-40"
              >
                <span>Next</span>
                <ChevronRight size={13} />
              </button>
            </div>
          </div>
        )}
      </Panel>

      {/* ── 6. Pair Detail Inspection Modal ──────────────────────────────────── */}
      {selectedPair && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in">
          <div className="panel max-w-lg w-full bg-white border border-slate-200 shadow-2xl p-6 relative animate-in zoom-in-95">
            <button
              onClick={() => setSelectedPair(null)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-700"
            >
              <X size={18} />
            </button>

            <div className="flex items-center gap-2 mb-4">
              <FlaskConical size={18} className="text-teal-700" />
              <h3 className="text-base font-bold text-slate-900">Experimental Pair Details</h3>
            </div>

            <div className="space-y-4 text-xs">
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex justify-between items-center">
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-bold block">Combination Pair</span>
                  <p className="text-sm font-bold text-slate-900">
                    {selectedPair['Sample Name 1']} + {selectedPair['Sample Name 2']}
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-slate-400 uppercase font-bold block">Measured Gamma</span>
                  <span className="text-lg font-extrabold text-teal-700 font-mono">
                    {fmt4(selectedPair.Gamma)}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
                  <span className="text-[10px] text-slate-500 uppercase font-semibold block">Drug 1 Mechanism</span>
                  <span className="text-xs text-slate-800 font-medium mt-1 block">{selectedPair['MOA 1'] || 'Not specified'}</span>
                </div>
                <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
                  <span className="text-[10px] text-slate-500 uppercase font-semibold block">Drug 2 Mechanism</span>
                  <span className="text-xs text-slate-800 font-medium mt-1 block">{selectedPair['MOA 2'] || 'Not specified'}</span>
                </div>
              </div>

              <div className="p-3.5 rounded-lg bg-teal-50/70 border border-teal-200/80">
                <span className="text-[10px] text-teal-800 uppercase font-bold block mb-1">Synergy Classification</span>
                <p className="text-slate-700 leading-relaxed">
                  {selectedPair.Gamma < 0.5
                    ? 'High Synergy (Gamma < 0.5): Significant cancer cell viability inhibition observed in PANC-1 laboratory screening.'
                    : selectedPair.Gamma < 1.0
                    ? 'Moderate Synergy (0.5 <= Gamma < 1.0): Experimentally validated synergistic response in NCATS PANC-1 viability assays exceeding single-agent additive models.'
                    : 'Near Additive (Gamma >= 1.0): Interaction does not exceed additive baseline.'}
                </p>
              </div>

              <div className="flex items-center justify-between pt-2 text-[11px] text-slate-500">
                <span>Dataset Origin: NCATS PANC-1 Cell Line</span>
                <DataSourceTag source="Experimental Assay Ground Truth" />
              </div>
            </div>

            <div className="mt-5 text-right">
              <button onClick={() => setSelectedPair(null)} className="btn-secondary text-xs py-1.5 px-4">
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── 7. Scientific Disclaimer ────────────────────────────────────────── */}
      <div className="p-4 rounded-xl border border-slate-200 bg-white flex items-start gap-3 shadow-card">
        <Info size={16} className="text-slate-500 shrink-0 mt-0.5" />
        <p className="text-[11px] text-slate-500 leading-relaxed">
          <strong className="text-slate-700">Dataset Provenance:</strong> The combination records displayed above were experimentally measured in PANC-1 human pancreatic ductal adenocarcinoma cell assays by the National Center for Advancing Translational Sciences (NCATS). These are fetched live from the backend API (<code>GET /api/v1/combos/validated</code>) and represent laboratory ground-truth data, distinct from computational predictions.
        </p>
      </div>
    </div>
  );
}
