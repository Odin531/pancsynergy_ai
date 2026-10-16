import type { ValidatedCombo } from '@/types';

// ─── Number formatting ────────────────────────────────────────────────────────

export function fmt4(n: number | undefined | null): string {
  if (n === undefined || n === null || isNaN(n)) return '—';
  return n.toFixed(4);
}

export function fmt2(n: number | undefined | null): string {
  if (n === undefined || n === null || isNaN(n)) return '—';
  return n.toFixed(2);
}

export function fmtInt(n: number | undefined | null): string {
  if (n === undefined || n === null || isNaN(n)) return '—';
  return n.toLocaleString();
}

export function fmtGamma(n: number): string {
  return n.toFixed(4);
}

// ─── Gamma classification helpers (mirrors backend service.py logic) ─────────
// Clean, accessible colors designed for high contrast on light backgrounds.

export function getGammaBadgeClass(gamma: number): string {
  if (gamma < 0.5) return 'badge-synergistic';
  if (gamma < 1.0) return 'badge-moderate';
  if (gamma < 1.5) return 'badge-additive';
  return 'badge-antagonistic';
}

export function getGammaColor(gamma: number): string {
  if (gamma < 0.5) return '#059669';  // emerald-600 (High Synergy)
  if (gamma < 1.0) return '#0284C7';  // sky-600 (Moderate Synergy)
  if (gamma < 1.5) return '#64748B';  // slate-500 (Additive / Weak)
  return '#E11D48';                   // rose-600 (Antagonistic)
}

// ─── Summary statistics ───────────────────────────────────────────────────────

export interface GammaStats {
  count: number;
  min: number;
  max: number;
  mean: number;
  median: number;
  std: number;
  q1: number;
  q3: number;
}

export function computeGammaStats(gammas: number[]): GammaStats {
  if (gammas.length === 0) {
    return { count: 0, min: 0, max: 0, mean: 0, median: 0, std: 0, q1: 0, q3: 0 };
  }
  const sorted = [...gammas].sort((a, b) => a - b);
  const n = sorted.length;
  const mean = sorted.reduce((s, v) => s + v, 0) / n;
  const variance = sorted.reduce((s, v) => s + (v - mean) ** 2, 0) / n;

  const percentile = (p: number): number => {
    const idx = (p / 100) * (n - 1);
    const lo = Math.floor(idx);
    const hi = Math.ceil(idx);
    if (lo === hi) return sorted[lo];
    return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
  };

  return {
    count: n,
    min: sorted[0],
    max: sorted[n - 1],
    mean,
    median: percentile(50),
    std: Math.sqrt(variance),
    q1: percentile(25),
    q3: percentile(75),
  };
}

// ─── Histogram binning ────────────────────────────────────────────────────────

export interface HistogramBin {
  binLabel: string;
  count: number;
  binStart: number;
  binEnd: number;
}

export function buildHistogram(values: number[], numBins = 10): HistogramBin[] {
  if (values.length === 0) return [];
  const min = Math.min(...values);
  const max = Math.max(...values);
  const binWidth = (max - min) / numBins || 0.1;

  const bins: HistogramBin[] = Array.from({ length: numBins }, (_, i) => ({
    binStart: min + i * binWidth,
    binEnd: min + (i + 1) * binWidth,
    binLabel: `${(min + i * binWidth).toFixed(2)}–${(min + (i + 1) * binWidth).toFixed(2)}`,
    count: 0,
  }));

  for (const v of values) {
    let idx = Math.floor((v - min) / binWidth);
    if (idx >= numBins) idx = numBins - 1;
    bins[idx].count++;
  }

  return bins;
}

// ─── MOA frequency ───────────────────────────────────────────────────────────

export interface MoaFreq {
  moa: string;
  count: number;
}

export function computeMoaFrequency(combos: ValidatedCombo[]): MoaFreq[] {
  const freq = new Map<string, number>();
  for (const c of combos) {
    const m1 = c['MOA 1'];
    const m2 = c['MOA 2'];
    if (m1) freq.set(m1, (freq.get(m1) ?? 0) + 1);
    if (m2) freq.set(m2, (freq.get(m2) ?? 0) + 1);
  }
  return Array.from(freq.entries())
    .map(([moa, count]) => ({ moa, count }))
    .sort((a, b) => b.count - a.count);
}

// ─── Unique compound extraction ────────────────────────────────────────────────

export function countUniqueCompounds(combos: ValidatedCombo[]): number {
  const names = new Set<string>();
  for (const c of combos) {
    if (c['Sample Name 1']) names.add(c['Sample Name 1']);
    if (c['Sample Name 2']) names.add(c['Sample Name 2']);
  }
  return names.size;
}

// ─── CSV export ───────────────────────────────────────────────────────────────

export function downloadCsv(rows: Record<string, unknown>[], filename: string): void {
  if (rows.length === 0) return;
  const headers = Object.keys(rows[0]);
  const lines = [
    headers.join(','),
    ...rows.map(row =>
      headers
        .map(h => {
          const val = row[h];
          const str = val === null || val === undefined ? '' : String(val);
          return str.includes(',') || str.includes('"') || str.includes('\n')
            ? `"${str.replace(/"/g, '""')}"`
            : str;
        })
        .join(','),
    ),
  ];
  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
