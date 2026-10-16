import { useState, useRef, useMemo } from 'react';
import Papa from 'papaparse';
import type { BatchRow, BatchResultRow } from '@/types';
import { api, ApiError } from '@/lib/api';
import { Panel, KpiCard, Spinner } from '@/components/ui';
import {
  downloadCsv,
  buildHistogram,
  getGammaColor,
  getGammaBadgeClass,
  computeGammaStats,
  fmt4,
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
} from 'recharts';
import {
  Upload,
  FileText,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Download,
  Play,
  Trash2,
  HelpCircle,
  ChevronLeft,
  ChevronRight,
  ShieldAlert,
  Layers,
} from 'lucide-react';

const TOOLTIP_STYLE = {
  backgroundColor: '#FFFFFF',
  border: '1px solid #CBD5E1',
  borderRadius: '8px',
  color: '#0F172A',
  fontSize: '12px',
  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
};

const SAMPLE_CSV_ROWS = [
  {
    smiles_1: 'NC1=NC(N)=C2N=C(CC(CC#C)C3=CC=C(C=C3)C(=O)N[C@@H](CCC(O)=O)C(O)=O)C=NC2=N1',
    smiles_2: 'O=C(NCCCCC1CCN(CC1)C(=O)C2=CC=CC=C2)\\C=C\\C3=CN=CC=C3',
    drug_name_1: 'Pralatrexate',
    drug_name_2: 'Daporinad',
    log_ac50_1: -7.27,
    log_ac50_2: -7.53,
  },
  {
    smiles_1: 'CC1=C(C=C(C=C1)NC(=O)C2=CC=C(C=C2)CNCC3=CNC4=CC=CC=C43)C(=O)NO',
    smiles_2: 'CC(C)CC(C(=O)NC(CC1=CC=CC=C1)C(=O)NC(CC(C)C)C(=O)C2(C)CO2)NC(=O)C(CC3=CC=CC=C3)NC(=O)CN4CCOCC4',
    drug_name_1: 'Panobinostat',
    drug_name_2: 'Carfilzomib',
    log_ac50_1: -7.80,
    log_ac50_2: -8.10,
  },
  {
    smiles_1: 'CC(C)N1C(=O)C2=C(C=CC(=C2)C3=CC=NC=C3)N4C1=CC(=N4)C5=CC=C(C=C5)F',
    smiles_2: 'CN1C=C(C2=CC=CC=C21)C3=C(C(=O)NC3=O)C4=CN(C5=CC=CC=C54)C',
    drug_name_1: 'Alpelisib',
    drug_name_2: 'Enzastaurin',
    log_ac50_1: -6.45,
    log_ac50_2: -6.12,
  },
  {
    smiles_1: 'CS(=O)(=O)CCNCc1ccc(-c2ccc3ncnc(Nc4ccc(OCc5cccc(F)c5)c(Cl)c4)c3c2)o1',
    smiles_2: 'CN1CCN(CC1)c1ccc(Nc2ncc(Cl)c(Nc3cccc(NC(=O)C=C)c3)n2)cc1OC',
    drug_name_1: 'Lapatinib',
    drug_name_2: 'WZ4002',
    log_ac50_1: -6.20,
    log_ac50_2: -6.80,
  },
];

export default function BatchScreening() {
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Uploaded and parsed rows
  const [rows, setRows] = useState<BatchRow[]>([]);
  const [fileName, setFileName] = useState<string>('');
  const [parseError, setParseError] = useState<string | null>(null);

  // Execution state
  const [isScreening, setIsScreening] = useState(false);
  const [screeningProgress, setScreeningProgress] = useState<{ current: number; total: number } | null>(null);
  const [batchResults, setBatchResults] = useState<BatchResultRow[] | null>(null);
  const [executionError, setExecutionError] = useState<string | null>(null);

  // Pagination for preview and results
  const [previewPage, setPreviewPage] = useState(1);
  const [resultsPage, setResultsPage] = useState(1);
  const pageSize = 15;

  // Sorting for results table
  const [resultSortDir, setResultSortDir] = useState<'asc' | 'desc'>('asc');

  // Compute validation counts
  const validRows = useMemo(() => rows.filter((r) => r.isValid), [rows]);
  const invalidRows = useMemo(() => rows.filter((r) => !r.isValid), [rows]);

  // Handle parsing CSV file
  const handleFileUpload = (file: File) => {
    setParseError(null);
    setExecutionError(null);
    setBatchResults(null);
    setFileName(file.name);

    Papa.parse<Record<string, unknown>>(file, {
      header: true,
      skipEmptyLines: 'greedy',
      complete: (results) => {
        if (!results.data || results.data.length === 0) {
          setParseError('The uploaded CSV file is empty or contains only blank rows.');
          return;
        }

        const headers = results.meta.fields || [];
        const smiles1Key = headers.find((h) => h.trim().toLowerCase() === 'smiles_1' || h.trim().toLowerCase() === 'smiles1');
        const smiles2Key = headers.find((h) => h.trim().toLowerCase() === 'smiles_2' || h.trim().toLowerCase() === 'smiles2');

        if (!smiles1Key || !smiles2Key) {
          setParseError(
            `Missing mandatory columns: Found [${headers.join(', ')}]. Expected at minimum "smiles_1" and "smiles_2".`
          );
          return;
        }

        const parsedRows: BatchRow[] = results.data.map((row, idx) => {
          const s1 = String(row[smiles1Key] || '').trim();
          const s2 = String(row[smiles2Key] || '').trim();

          const name1 = String(row['drug_name_1'] || row['drug1'] || row['name_1'] || `Drug A-${idx + 1}`).trim();
          const name2 = String(row['drug_name_2'] || row['drug2'] || row['name_2'] || `Drug B-${idx + 1}`).trim();

          const parsedAc50_1 = parseFloat(String(row['log_ac50_1'] ?? row['ac50_1'] ?? -6.0));
          const parsedAc50_2 = parseFloat(String(row['log_ac50_2'] ?? row['ac50_2'] ?? -6.0));

          const ac50_1 = isNaN(parsedAc50_1) ? -6.0 : parsedAc50_1;
          const ac50_2 = isNaN(parsedAc50_2) ? -6.0 : parsedAc50_2;

          let isValid = true;
          let validationError: string | undefined;

          if (!s1) {
            isValid = false;
            validationError = 'smiles_1 is empty';
          } else if (!s2) {
            isValid = false;
            validationError = 'smiles_2 is empty';
          } else if (s1.length < 3 || s2.length < 3) {
            isValid = false;
            validationError = 'SMILES string too short';
          }

          return {
            id: idx + 1,
            smiles_1: s1,
            smiles_2: s2,
            drug_name_1: name1,
            drug_name_2: name2,
            log_ac50_1: ac50_1,
            log_ac50_2: ac50_2,
            isValid,
            validationError,
          };
        });

        setRows(parsedRows);
        setPreviewPage(1);
      },
      error: (err) => {
        setParseError(`CSV Parsing error: ${err.message}`);
      },
    });
  };

  const handleDownloadSample = () => {
    downloadCsv(SAMPLE_CSV_ROWS, 'pancsynergy_sample_screening_pairs.csv');
  };

  // Run the batch screening
  const runScreening = async () => {
    if (validRows.length === 0) return;

    if (validRows.length > 30) {
      const confirmRun = window.confirm(
        `You are about to screen ${validRows.length} combination pairs. Depending on server capacity, this may take a moment. Proceed?`
      );
      if (!confirmRun) return;
    }

    setIsScreening(true);
    setExecutionError(null);
    setScreeningProgress({ current: 0, total: validRows.length });

    // Step 1: Try batch endpoint first
    try {
      const payload = {
        pairs: validRows.map((r) => ({
          drug_name_1: r.drug_name_1,
          drug_name_2: r.drug_name_2,
          smiles_1: r.smiles_1,
          smiles_2: r.smiles_2,
          log_ac50_1: r.log_ac50_1,
          log_ac50_2: r.log_ac50_2,
        })),
      };

      const res = await api.predictBatch(payload);

      // Match predictions back to valid rows
      const combinedResults: BatchResultRow[] = validRows.map((row, idx) => ({
        ...row,
        result: res.predictions[idx],
        status: res.predictions[idx] ? 'success' : 'error',
      }));

      // Append invalid rows as errors
      const fullResults: BatchResultRow[] = [
        ...combinedResults,
        ...invalidRows.map((r) => ({
          ...r,
          status: 'error' as const,
          error: r.validationError || 'Excluded prior to screening',
        })),
      ];

      setBatchResults(fullResults);
      setResultsPage(1);
    } catch (batchErr) {
      console.warn('Batch endpoint failed, falling back to sequential pair screening:', batchErr);

      // Fallback: Screen pairs individually so valid SMILES succeed even if one fails
      const fallbackResults: BatchResultRow[] = [];
      let successCount = 0;

      for (let i = 0; i < validRows.length; i++) {
        const row = validRows[i];
        setScreeningProgress({ current: i + 1, total: validRows.length });

        try {
          const res = await api.predict({
            drug_name_1: row.drug_name_1,
            drug_name_2: row.drug_name_2,
            smiles_1: row.smiles_1,
            smiles_2: row.smiles_2,
            log_ac50_1: row.log_ac50_1,
            log_ac50_2: row.log_ac50_2,
          });

          fallbackResults.push({
            ...row,
            result: res,
            status: 'success',
          });
          successCount++;
        } catch (pairErr) {
          const errMsg = pairErr instanceof ApiError ? pairErr.message : String(pairErr);
          fallbackResults.push({
            ...row,
            status: 'error',
            error: errMsg,
          });
        }
      }

      // Add invalid rows
      invalidRows.forEach((r) => {
        fallbackResults.push({
          ...r,
          status: 'error',
          error: r.validationError || 'Excluded prior to screening',
        });
      });

      if (successCount === 0 && validRows.length > 0) {
        setExecutionError(
          'All screened pairs failed. Ensure the FastAPI backend is running and the champion model is loaded.'
        );
      }

      setBatchResults(fallbackResults);
      setResultsPage(1);
    } finally {
      setIsScreening(false);
      setScreeningProgress(null);
    }
  };

  const removeRow = (id: number) => {
    setRows((prev) => prev.filter((r) => r.id !== id));
  };

  // Results analytics
  const successfulResults = useMemo(() => {
    return batchResults?.filter((r) => r.status === 'success' && r.result) || [];
  }, [batchResults]);

  const failedResults = useMemo(() => {
    return batchResults?.filter((r) => r.status === 'error') || [];
  }, [batchResults]);

  const resultGammas = useMemo(() => {
    return successfulResults.map((r) => r.result!.predicted_gamma);
  }, [successfulResults]);

  const resultStats = useMemo(() => {
    return computeGammaStats(resultGammas);
  }, [resultGammas]);

  // Classification distribution
  const classificationCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    successfulResults.forEach((r) => {
      const cls = r.result!.synergy_classification;
      counts[cls] = (counts[cls] || 0) + 1;
    });
    return Object.entries(counts).map(([name, count]) => ({ name, count }));
  }, [successfulResults]);

  // Top 10 predicted lowest Gamma
  const top10Predicted = useMemo(() => {
    return [...successfulResults]
      .sort((a, b) => a.result!.predicted_gamma - b.result!.predicted_gamma)
      .slice(0, 8)
      .map((r) => ({
        fullName: `${r.drug_name_1} + ${r.drug_name_2}`,
        displayLabel: `${r.drug_name_1} + ${r.drug_name_2}`.length > 26
          ? `${r.drug_name_1} + ${r.drug_name_2}`.slice(0, 26) + '…'
          : `${r.drug_name_1} + ${r.drug_name_2}`,
        gamma: r.result!.predicted_gamma,
        classification: r.result!.synergy_classification,
      }));
  }, [successfulResults]);

  // Histogram of predictions
  const predictionHistogram = useMemo(() => {
    return buildHistogram(resultGammas, 8);
  }, [resultGammas]);

  // Sorted results for table
  const sortedResultRows = useMemo(() => {
    if (!batchResults) return [];
    return [...batchResults].sort((a, b) => {
      const ga = a.result ? a.result.predicted_gamma : 999;
      const gb = b.result ? b.result.predicted_gamma : 999;
      return resultSortDir === 'asc' ? ga - gb : gb - ga;
    });
  }, [batchResults, resultSortDir]);

  const paginatedResultRows = useMemo(() => {
    const start = (resultsPage - 1) * pageSize;
    return sortedResultRows.slice(start, start + pageSize);
  }, [sortedResultRows, resultsPage]);

  // Export results to CSV
  const handleExportResults = () => {
    if (!batchResults) return;
    const exportData = batchResults.map((r) => ({
      Drug_1: r.drug_name_1,
      Drug_2: r.drug_name_2,
      Predicted_Gamma: r.result ? r.result.predicted_gamma : 'N/A',
      Classification: r.result ? r.result.synergy_classification : 'Failed',
      Synergy_Strength: r.result ? r.result.synergy_strength : 'N/A',
      Is_Synergistic: r.result ? r.result.is_synergistic : false,
      Log_AC50_1: r.log_ac50_1,
      Log_AC50_2: r.log_ac50_2,
      SMILES_1: r.smiles_1,
      SMILES_2: r.smiles_2,
      Screening_Status: r.status,
      Error_Reason: r.error || '',
    }));
    downloadCsv(exportData, `pancsynergy_batch_predictions_${exportData.length}_pairs.csv`);
  };

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      {/* ── 1. Page Header ─────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200/90 pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-teal-50 border border-teal-200 text-teal-700 flex items-center justify-center font-bold">
              <Layers size={18} />
            </div>
            <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">Batch Screening</h1>
            <span className="badge-moderate">High-Throughput Virtual Pipeline</span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Screen large libraries of compound combinations simultaneously via browser-side CSV parsing.
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <button
            onClick={handleDownloadSample}
            className="btn-secondary text-xs flex items-center gap-1.5"
            title="Download CSV format template"
          >
            <Download size={13} />
            <span>Download Template CSV</span>
          </button>
        </div>
      </div>

      {/* ── 2. Specifications & CSV Guide ──────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
        <div className="p-4 rounded-xl bg-white border border-slate-200/90 shadow-card space-y-2">
          <h4 className="font-bold text-slate-900 flex items-center gap-1.5">
            <CheckCircle2 size={14} className="text-teal-700" />
            <span>Required CSV Columns</span>
          </h4>
          <ul className="space-y-1.5 text-slate-600 list-disc list-inside">
            <li>
              <code className="bg-slate-100 px-1 py-0.5 rounded font-mono text-[11px] text-slate-800">smiles_1</code>: SMILES string of Drug 1
            </li>
            <li>
              <code className="bg-slate-100 px-1 py-0.5 rounded font-mono text-[11px] text-slate-800">smiles_2</code>: SMILES string of Drug 2
            </li>
          </ul>
          <p className="text-[11px] text-slate-500 pt-1">
            Structures are converted into 256-bit Morgan fingerprints and 10 physicochemical descriptors.
          </p>
        </div>

        <div className="p-4 rounded-xl bg-white border border-slate-200/90 shadow-card space-y-2">
          <h4 className="font-bold text-slate-900 flex items-center gap-1.5">
            <HelpCircle size={14} className="text-slate-400" />
            <span>Optional Columns (Automatic Defaults)</span>
          </h4>
          <ul className="space-y-1.5 text-slate-600 list-disc list-inside">
            <li>
              <code className="bg-slate-100 px-1 py-0.5 rounded font-mono text-[11px] text-slate-800">drug_name_1</code> / <code className="bg-slate-100 px-1 py-0.5 rounded font-mono text-[11px] text-slate-800">drug_name_2</code> (Default: Drug A / Drug B)
            </li>
            <li>
              <code className="bg-slate-100 px-1 py-0.5 rounded font-mono text-[11px] text-slate-800">log_ac50_1</code> / <code className="bg-slate-100 px-1 py-0.5 rounded font-mono text-[11px] text-slate-800">log_ac50_2</code> (Default: −6.0 M potency)
            </li>
          </ul>
        </div>
      </div>

      {/* ── 3. File Upload Dropzone ────────────────────────────────────────── */}
      <div className="panel p-8 border-dashed border-2 border-slate-300 hover:border-teal-500 bg-white transition-all text-center">
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleFileUpload(f);
          }}
          className="hidden"
        />

        <div className="flex flex-col items-center justify-center gap-3">
          <div className="w-12 h-12 rounded-full bg-teal-50 border border-teal-200 flex items-center justify-center text-teal-700">
            <Upload size={22} />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900">
              {fileName ? `Loaded: ${fileName}` : 'Upload screening candidate CSV'}
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              Select or drag and drop your candidate combination file (.csv)
            </p>
          </div>
          <div className="flex items-center gap-3 mt-1">
            <button
              onClick={() => fileInputRef.current?.click()}
              className="btn-primary text-xs"
              disabled={isScreening}
            >
              <FileText size={13} />
              <span>{rows.length > 0 ? 'Choose Different File' : 'Browse Local CSV'}</span>
            </button>
            {rows.length > 0 && (
              <button
                onClick={() => {
                  setRows([]);
                  setFileName('');
                  setBatchResults(null);
                  setParseError(null);
                }}
                className="btn-ghost text-xs text-slate-500 hover:text-rose-600"
              >
                Clear
              </button>
            )}
          </div>
        </div>

        {parseError && (
          <div className="mt-4 p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center justify-center gap-2">
            <AlertTriangle size={14} className="shrink-0 text-rose-600" />
            <span>{parseError}</span>
          </div>
        )}
      </div>

      {/* ── 4. CSV Preview & Validation Table ──────────────────────────────── */}
      {rows.length > 0 && !batchResults && (
        <Panel
          title="Data Verification & Screening Candidates"
          subtitle={`Total: ${rows.length} rows | Valid: ${validRows.length} | Needs correction: ${invalidRows.length}`}
          headerRight={
            <div className="flex items-center gap-2">
              <button
                onClick={runScreening}
                disabled={isScreening || validRows.length === 0}
                className="btn-primary text-xs flex items-center gap-1.5 py-2 px-5"
              >
                {isScreening ? (
                  <>
                    <Spinner size="sm" />
                    <span>
                      Screening ({screeningProgress?.current || 0}/{screeningProgress?.total || validRows.length})...
                    </span>
                  </>
                ) : (
                  <>
                    <Play size={13} fill="currentColor" />
                    <span>Run Screening ({validRows.length} valid pairs)</span>
                  </>
                )}
              </button>
            </div>
          }
        >
          {invalidRows.length > 0 && (
            <div className="mb-4 p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-start gap-2">
              <AlertTriangle size={15} className="shrink-0 mt-0.5 text-amber-600" />
              <div>
                <p className="font-semibold">Notice: {invalidRows.length} invalid rows detected</p>
                <p className="text-[11px] text-amber-800 mt-0.5">
                  Pairs with missing or malformed SMILES strings will be bypassed during screening to ensure pipeline stability.
                </p>
              </div>
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/70 text-slate-600 font-semibold">
                  <th className="py-2.5 px-3 w-12">#</th>
                  <th className="py-2.5 px-3">Drug 1</th>
                  <th className="py-2.5 px-3">Drug 2</th>
                  <th className="py-2.5 px-3">SMILES 1</th>
                  <th className="py-2.5 px-3">SMILES 2</th>
                  <th className="py-2.5 px-3">AC50 1</th>
                  <th className="py-2.5 px-3">AC50 2</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows
                  .slice((previewPage - 1) * pageSize, previewPage * pageSize)
                  .map((row) => (
                    <tr
                      key={row.id}
                      className={`hover:bg-slate-50/80 transition-colors ${
                        !row.isValid ? 'bg-rose-50/40' : ''
                      }`}
                    >
                      <td className="py-2 px-3 text-slate-400 font-mono">{row.id}</td>
                      <td className="py-2 px-3 font-semibold text-slate-900">{row.drug_name_1}</td>
                      <td className="py-2 px-3 font-semibold text-slate-900">{row.drug_name_2}</td>
                      <td className="py-2 px-3 font-mono text-[11px] text-slate-500 max-w-[130px] truncate" title={row.smiles_1}>
                        {row.smiles_1}
                      </td>
                      <td className="py-2 px-3 font-mono text-[11px] text-slate-500 max-w-[130px] truncate" title={row.smiles_2}>
                        {row.smiles_2}
                      </td>
                      <td className="py-2 px-3 tabular-nums text-slate-600">{row.log_ac50_1}</td>
                      <td className="py-2 px-3 tabular-nums text-slate-600">{row.log_ac50_2}</td>
                      <td className="py-2 px-3">
                        {row.isValid ? (
                          <span className="inline-flex items-center gap-1 text-[11px] text-emerald-700 font-semibold">
                            <CheckCircle2 size={12} /> Valid
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] text-rose-700 font-semibold" title={row.validationError}>
                            <XCircle size={12} /> Invalid
                          </span>
                        )}
                      </td>
                      <td className="py-2 px-3 text-right">
                        <button
                          onClick={() => removeRow(row.id)}
                          className="text-slate-400 hover:text-rose-600 transition-colors"
                          title="Remove row"
                        >
                          <Trash2 size={13} />
                        </button>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {rows.length > pageSize && (
            <div className="flex items-center justify-between gap-3 mt-4 pt-3 border-t border-slate-100 text-xs text-slate-500">
              <span>
                Showing {(previewPage - 1) * pageSize + 1}–
                {Math.min(previewPage * pageSize, rows.length)} of {rows.length} rows
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  disabled={previewPage <= 1}
                  onClick={() => setPreviewPage((p) => p - 1)}
                  className="btn-secondary py-1 px-3 text-xs disabled:opacity-40"
                >
                  <ChevronLeft size={13} />
                  <span>Prev</span>
                </button>
                <span className="px-2 text-slate-700 font-semibold">
                  {previewPage} / {Math.ceil(rows.length / pageSize)}
                </span>
                <button
                  disabled={previewPage >= Math.ceil(rows.length / pageSize)}
                  onClick={() => setPreviewPage((p) => p + 1)}
                  className="btn-secondary py-1 px-3 text-xs disabled:opacity-40"
                >
                  <span>Next</span>
                  <ChevronRight size={13} />
                </button>
              </div>
            </div>
          )}
        </Panel>
      )}

      {/* ── 5. Batch Results & Graphical Analytics ─────────────────────────── */}
      {batchResults && (
        <div className="space-y-6">
          {/* Header Action Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 bg-white border border-teal-500/50 rounded-xl shadow-card">
            <div>
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <CheckCircle2 size={18} className="text-emerald-600" />
                Virtual Screening Completed
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Evaluated {batchResults.length} pairs: {successfulResults.length} scored successfully, {failedResults.length} rejected/failed.
              </p>
            </div>
            <div className="flex items-center gap-2.5">
              <button
                onClick={handleExportResults}
                className="btn-primary text-xs flex items-center gap-1.5"
              >
                <Download size={13} />
                <span>Export Results CSV</span>
              </button>
              <button
                onClick={() => {
                  setBatchResults(null);
                  setRows([]);
                  setFileName('');
                }}
                className="btn-secondary text-xs"
              >
                New Screening
              </button>
            </div>
          </div>

          {executionError && (
            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
              <ShieldAlert size={16} className="shrink-0 text-rose-600" />
              <span>{executionError}</span>
            </div>
          )}

          {/* Results KPI Summary */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
            <KpiCard
              label="Screened Pairs"
              value={fmtInt(batchResults.length)}
              subtext="Total batch volume"
            />
            <KpiCard
              label="Successful"
              value={fmtInt(successfulResults.length)}
              subtext="Scored by model"
              accent
            />
            <KpiCard
              label="Synergistic Leads"
              value={fmtInt(successfulResults.filter((r) => r.result?.is_synergistic).length)}
              subtext="Predicted γ < 1.0"
              accent
            />
            <KpiCard
              label="Top Lead (Min γ)"
              value={fmt4(resultStats.min)}
              subtext="Strongest predicted synergy"
              accent
            />
            <KpiCard
              label="Median Gamma"
              value={fmt4(resultStats.median)}
              subtext="Batch median score"
            />
            <KpiCard
              label="Failed Rows"
              value={fmtInt(failedResults.length)}
              subtext="Malformed SMILES / errors"
            />
          </div>

          {/* Visualizations Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            
            {/* Classification breakdown */}
            <Panel
              title="Synergy Classification Distribution"
              subtitle={`Counts by model-assigned synergy tier across ${successfulResults.length} scored pairs`}
            >
              <div className="h-60">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={classificationCounts} margin={{ top: 10, right: 10, left: -20, bottom: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                    <XAxis dataKey="name" stroke="#94A3B8" fontSize={12} tick={{ fill: '#1E293B', fontWeight: 500 }} tickLine={false} />
                    <YAxis stroke="#94A3B8" fontSize={12} tick={{ fill: '#475569' }} tickLine={false} allowDecimals={false} />
                    <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(val: number) => [`${val} pairs`, 'Count']} />
                    <Bar dataKey="count" fill="#0D9488" radius={[4, 4, 0, 0]}>
                      {classificationCounts.map((entry, idx) => (
                        <Cell
                          key={`cell-cls-${idx}`}
                          fill={
                            entry.name.toLowerCase().includes('synerg')
                              ? '#059669'
                              : entry.name.toLowerCase().includes('additive')
                              ? '#94A3B8'
                              : '#E11D48'
                          }
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <p className="text-[12px] text-slate-500 mt-2">
                Assignments returned directly by backend inference service based on physical Gamma thresholds.
              </p>
            </Panel>

            {/* Predicted Gamma Histogram */}
            <Panel
              title="Predicted Gamma Distribution"
              subtitle="Frequency histogram of predicted continuous synergy scores"
            >
              <div className="h-60">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={predictionHistogram} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                    <XAxis
                      dataKey="binLabel"
                      stroke="#94A3B8"
                      fontSize={12}
                      tick={{ fill: '#475569' }}
                      tickLine={false}
                    />
                    <YAxis stroke="#94A3B8" fontSize={12} tick={{ fill: '#475569' }} tickLine={false} allowDecimals={false} />
                    <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(val: number) => [`${val} pairs`, 'Frequency']} />
                    <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                      {predictionHistogram.map((bin, idx) => (
                        <Cell key={`cell-hist-${idx}`} fill={getGammaColor(bin.binStart)} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <p className="text-[12px] text-slate-500 mt-2">
                Pairs falling to the left (&lt; 1.0) represent combinations predicted to deliver synergistic inhibition in PANC-1.
              </p>
            </Panel>

            {/* Top predicted synergistic leads (horizontal) */}
            <Panel
              title="Top Predicted Synergistic Leads"
              subtitle="Lowest predicted Gamma scores in batch (highest predicted synergy)"
            >
              <div className="h-60">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={top10Predicted}
                    layout="vertical"
                    margin={{ top: 5, right: 25, left: 10, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" horizontal={false} />
                    <XAxis type="number" stroke="#94A3B8" fontSize={12} tick={{ fill: '#475569' }} tickLine={false} />
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
                      formatter={(val: number) => [fmt4(val), 'Predicted Gamma']}
                      labelFormatter={(_: string, payload: any[]) => payload?.[0]?.payload?.fullName || ''}
                    />
                    <Bar dataKey="gamma" radius={[0, 4, 4, 0]}>
                      {top10Predicted.map((entry, idx) => (
                        <Cell key={`cell-top10pred-${idx}`} fill={getGammaColor(entry.gamma)} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <p className="text-[12px] text-slate-500 mt-2">
                Computational lead ranking. Top candidate pairs warrant subsequent in-vitro biological assays.
              </p>
            </Panel>

            {/* Scatter ranking */}
            <Panel
              title="Screening Rank vs. Predicted Score"
              subtitle="Pair ranking curve with synergy classification threshold"
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
                      label={{ value: 'Rank (1 = Top Lead)', position: 'insideBottom', offset: -10, fill: '#475569', fontSize: 11 }}
                    />
                    <YAxis
                      type="number"
                      dataKey="gamma"
                      name="Gamma"
                      stroke="#94A3B8"
                      fontSize={12}
                      tick={{ fill: '#475569' }}
                      tickLine={false}
                      domain={[0, 1.5]}
                    />
                    <ReferenceLine y={1.0} stroke="#E11D48" strokeDasharray="3 3" label={{ value: 'Synergy Threshold 1.0', fill: '#E11D48', fontSize: 11 }} />
                    <Tooltip
                      contentStyle={TOOLTIP_STYLE}
                      formatter={(val: number, name: string) => (name === 'Gamma' ? [fmt4(val), 'Gamma'] : [val, name])}
                    />
                    <Scatter
                      name="Pairs"
                      data={successfulResults
                        .sort((a, b) => a.result!.predicted_gamma - b.result!.predicted_gamma)
                        .map((r, idx) => ({
                          rank: idx + 1,
                          gamma: r.result!.predicted_gamma,
                          name: `${r.drug_name_1} + ${r.drug_name_2}`,
                        }))}
                      fill="#0284C7"
                    />
                  </ScatterChart>
                </ResponsiveContainer>
              </div>
              <p className="text-[11px] text-slate-500 mt-2">
                Combinations below the red line (γ &lt; 1.0) exhibit predicted synergy.
              </p>
            </Panel>
          </div>

          {/* Detailed Results Table */}
          <Panel
            title="Screening Predictions Registry"
            subtitle={`Listing all ${batchResults.length} screened pairs`}
            headerRight={
              <button
                onClick={() => setResultSortDir(resultSortDir === 'asc' ? 'desc' : 'asc')}
                className="btn-secondary text-xs py-1 px-3 flex items-center gap-1"
              >
                <span>Sort Gamma: {resultSortDir.toUpperCase()}</span>
              </button>
            }
          >
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/70 text-slate-600 font-semibold">
                    <th className="py-2.5 px-3">Drug 1</th>
                    <th className="py-2.5 px-3">Drug 2</th>
                    <th className="py-2.5 px-3">Predicted Gamma</th>
                    <th className="py-2.5 px-3">Classification</th>
                    <th className="py-2.5 px-3">Synergy Strength</th>
                    <th className="py-2.5 px-3">Synergistic?</th>
                    <th className="py-2.5 px-3">Execution Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {paginatedResultRows.map((row, idx) => (
                    <tr key={`${row.id}-${idx}`} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-2.5 px-3 font-semibold text-slate-900">{row.drug_name_1}</td>
                      <td className="py-2.5 px-3 font-semibold text-slate-900">{row.drug_name_2}</td>
                      <td className="py-2.5 px-3 font-mono">
                        {row.result ? (
                          <span className={getGammaBadgeClass(row.result.predicted_gamma)}>
                            {fmt4(row.result.predicted_gamma)}
                          </span>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-slate-700">
                        {row.result?.synergy_classification || '—'}
                      </td>
                      <td className="py-2.5 px-3 text-slate-600">
                        {row.result?.synergy_strength || '—'}
                      </td>
                      <td className="py-2.5 px-3 font-semibold">
                        {row.result ? (
                          row.result.is_synergistic ? (
                            <span className="text-emerald-700">Yes (Synergy)</span>
                          ) : (
                            <span className="text-slate-500">No (Additive)</span>
                          )
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="py-2.5 px-3">
                        {row.status === 'success' ? (
                          <span className="inline-flex items-center gap-1 text-[11px] text-emerald-700 font-semibold">
                            <CheckCircle2 size={12} /> Success
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] text-rose-700 font-semibold" title={row.error}>
                            <XCircle size={12} /> Failed
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination for results */}
            {sortedResultRows.length > pageSize && (
              <div className="flex items-center justify-between gap-3 mt-4 pt-3 border-t border-slate-100 text-xs text-slate-500">
                <span>
                  Showing {(resultsPage - 1) * pageSize + 1}–
                  {Math.min(resultsPage * pageSize, sortedResultRows.length)} of {sortedResultRows.length} rows
                </span>
                <div className="flex items-center gap-1.5">
                  <button
                    disabled={resultsPage <= 1}
                    onClick={() => setResultsPage((p) => p - 1)}
                    className="btn-secondary py-1 px-3 text-xs disabled:opacity-40"
                  >
                    <ChevronLeft size={13} />
                    <span>Prev</span>
                  </button>
                  <span className="px-2 text-slate-700 font-semibold">
                    {resultsPage} / {Math.ceil(sortedResultRows.length / pageSize)}
                  </span>
                  <button
                    disabled={resultsPage >= Math.ceil(sortedResultRows.length / pageSize)}
                    onClick={() => setResultsPage((p) => p + 1)}
                    className="btn-secondary py-1 px-3 text-xs disabled:opacity-40"
                  >
                    <span>Next</span>
                    <ChevronRight size={13} />
                  </button>
                </div>
              </div>
            )}
          </Panel>
        </div>
      )}

      {/* ── 6. Bottom Scientific Guidance ──────────────────────────────────── */}
      <div className="p-4 rounded-xl border border-slate-200 bg-white flex items-start gap-3 shadow-card">
        <HelpCircle size={16} className="text-slate-500 shrink-0 mt-0.5" />
        <p className="text-[11px] text-slate-500 leading-relaxed">
          <strong className="text-slate-700">Virtual Screening Interpretation:</strong> All scores generated in this workflow are computational predictions evaluated by the Random Forest model. These scores estimate the continuous in-vitro cell viability parameter Gamma (γ) and do not substitute for biological confirmatory assays.
        </p>
      </div>
    </div>
  );
}
