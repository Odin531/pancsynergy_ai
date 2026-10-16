import { useState } from 'react';
import type { DrugPairInput, SynergyPredictionOutput } from '@/types';
import type { BackendState } from '@/hooks/useBackend';
import { api, ApiError } from '@/lib/api';
import { ErrorState, Spinner, DataSourceTag, InfoTooltip } from '@/components/ui';
import { fmt4, getGammaColor, getGammaBadgeClass } from '@/lib/chart-utils';
import {
  FlaskConical,
  Copy,
  RotateCcw,
  Check,
  CheckCircle2,
  Sparkles,
  Info,
  ArrowRight,
  Beaker,
} from 'lucide-react';

interface Props {
  backend: BackendState;
}

interface ExampleDrug {
  label: string;
  drug_name: string;
  smiles: string;
  ac50: number;
  classType: string;
}

const VERIFIED_EXAMPLES: ExampleDrug[] = [
  {
    label: 'Pralatrexate',
    drug_name: 'Pralatrexate',
    smiles: 'NC1=NC(N)=C2N=C(CC(CC#C)C3=CC=C(C=C3)C(=O)N[C@@H](CCC(O)=O)C(O)=O)C=NC2=N1',
    ac50: -7.27,
    classType: 'Antifolate / DHFR Inhibitor',
  },
  {
    label: 'Daporinad (FK866)',
    drug_name: 'Daporinad',
    smiles: 'O=C(NCCCCC1CCN(CC1)C(=O)C2=CC=CC=C2)\\C=C\\C3=CN=CC=C3',
    ac50: -7.53,
    classType: 'NAMPT Inhibitor',
  },
  {
    label: 'Panobinostat (LBH589)',
    drug_name: 'Panobinostat',
    smiles: 'CC1=C(C=C(C=C1)NC(=O)C2=CC=C(C=C2)CNCC3=CNC4=CC=CC=C43)C(=O)NO',
    ac50: -7.80,
    classType: 'Pan-HDAC Inhibitor',
  },
  {
    label: 'Carfilzomib (PR-171)',
    drug_name: 'Carfilzomib',
    smiles: 'CC(C)CC(C(=O)NC(CC1=CC=CC=C1)C(=O)NC(CC(C)C)C(=O)C2(C)CO2)NC(=O)C(CC3=CC=CC=C3)NC(=O)CN4CCOCC4',
    ac50: -8.10,
    classType: 'Proteasome Inhibitor',
  },
];

const DEFAULT_AC50 = -6.0;

function isValidSmiles(s: string): boolean {
  return s.trim().length >= 3 && /[CcNOSFBrIlP=#()]/.test(s);
}

function getInterpretation(gamma: number): string {
  if (gamma < 0.5) {
    return 'Strong Synergy (Gamma < 0.5): Significant synergistic enhancement in cell killing predicted over independent single-agent expectations. Candidate combination for experimental follow-up.';
  }
  if (gamma < 1.0) {
    return 'Moderate Synergy (0.5 ≤ Gamma < 1.0): Predicted synergistic interaction exceeding independent additive expectations.';
  }
  if (gamma < 1.5) {
    return 'Additive or Weak Interaction (1.0 ≤ Gamma < 1.5): The combination effect is predicted to match the sum of independent single-agent potencies without true synergy.';
  }
  return 'Antagonistic Interaction (Gamma ≥ 1.5): The combination yields diminished cancer cell cytotoxicity compared to individual agents.';
}

export default function PredictionLab({ backend }: Props) {
  // Form input state
  const [drug1Name, setDrug1Name] = useState('Pralatrexate');
  const [smiles1, setSmiles1] = useState(VERIFIED_EXAMPLES[0].smiles);
  const [ac50_1, setAc50_1] = useState<number | string>(VERIFIED_EXAMPLES[0].ac50);

  const [drug2Name, setDrug2Name] = useState('Daporinad');
  const [smiles2, setSmiles2] = useState(VERIFIED_EXAMPLES[1].smiles);
  const [ac50_2, setAc50_2] = useState<number | string>(VERIFIED_EXAMPLES[1].ac50);

  // Execution state
  const [loading, setLoading] = useState(false);
  const [prediction, setPrediction] = useState<SynergyPredictionOutput | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Validation
  const [fieldErrors, setFieldErrors] = useState<{ smiles1?: string; smiles2?: string }>({});

  const validate = (): boolean => {
    const errors: { smiles1?: string; smiles2?: string } = {};
    if (!smiles1.trim()) {
      errors.smiles1 = 'SMILES string is required for molecular fingerprint generation.';
    } else if (!isValidSmiles(smiles1)) {
      errors.smiles1 = 'Invalid SMILES format. Please verify chemical structure string.';
    }

    if (!smiles2.trim()) {
      errors.smiles2 = 'SMILES string is required for molecular fingerprint generation.';
    } else if (!isValidSmiles(smiles2)) {
      errors.smiles2 = 'Invalid SMILES format. Please verify chemical structure string.';
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handlePredict = async () => {
    if (!validate()) return;

    setLoading(true);
    setError(null);
    setPrediction(null);

    const payload: DrugPairInput = {
      drug_name_1: drug1Name.trim() || 'Compound A',
      smiles_1: smiles1.trim(),
      log_ac50_1: typeof ac50_1 === 'number' ? ac50_1 : parseFloat(String(ac50_1)) || DEFAULT_AC50,
      drug_name_2: drug2Name.trim() || 'Compound B',
      smiles_2: smiles2.trim(),
      log_ac50_2: typeof ac50_2 === 'number' ? ac50_2 : parseFloat(String(ac50_2)) || DEFAULT_AC50,
    };

    try {
      const res = await api.predict(payload);
      setPrediction(res);
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 503) {
          setError('Champion ML model is not loaded in the backend. Ensure best_synergy_model.pkl exists and run the backend.');
        } else {
          setError(err.message || 'Prediction request rejected by backend.');
        }
      } else {
        setError('Network error: Unable to reach the backend service at http://127.0.0.1:8000.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setDrug1Name('');
    setSmiles1('');
    setAc50_1(DEFAULT_AC50);
    setDrug2Name('');
    setSmiles2('');
    setAc50_2(DEFAULT_AC50);
    setPrediction(null);
    setError(null);
    setFieldErrors({});
  };

  const loadExamplePair = (ex1: ExampleDrug, ex2: ExampleDrug) => {
    setDrug1Name(ex1.drug_name);
    setSmiles1(ex1.smiles);
    setAc50_1(ex1.ac50);

    setDrug2Name(ex2.drug_name);
    setSmiles2(ex2.smiles);
    setAc50_2(ex2.ac50);

    setFieldErrors({});
    setError(null);
  };

  const copyResultSummary = () => {
    if (!prediction) return;
    const text = `PancSynergy AI Prediction Summary:
Pair: ${prediction.drug_name_1} + ${prediction.drug_name_2}
Predicted Gamma: ${prediction.predicted_gamma}
Synergy Classification: ${prediction.synergy_classification} (${prediction.synergy_strength})
Is Synergistic: ${prediction.is_synergistic ? 'Yes' : 'No'}
Cell Line Context: PANC-1 Pancreatic Ductal Adenocarcinoma
Model: Random Forest Regressor (802 symmetric molecular descriptors)`;

    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      {/* Offline Alert */}
      {backend.apiStatus === 'offline' && (
        <div className="p-4 rounded-xl border border-rose-200 bg-rose-50 text-rose-800 text-xs font-medium">
          Backend service is offline (http://127.0.0.1:8000). Ensure the FastAPI backend is running to generate live ML synergy predictions.
        </div>
      )}

      {/* ── 1. Page Header with Workflow Indicator ──────────────────────────── */}
      <div>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200/90 pb-5">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-teal-50 border border-teal-200 text-teal-700 flex items-center justify-center font-bold">
                <Beaker size={18} />
              </div>
              <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">Prediction Lab</h1>
              <span className="badge-moderate">Single-Pair ML Inference</span>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Screen candidate drug combinations for synergistic cancer cell killing using structural SMILES fingerprints and single-agent potencies.
            </p>
          </div>
          <DataSourceTag source="POST /api/v1/predict" />
        </div>

        {/* 5-Step Workflow Breadcrumb */}
        <div className="mt-4 p-3 bg-white border border-slate-200/90 rounded-xl shadow-card flex flex-wrap items-center justify-between text-xs text-slate-600 gap-2">
          <span className="flex items-center gap-1.5 font-semibold text-teal-800">
            <span className="w-5 h-5 rounded-full bg-teal-100 text-teal-800 flex items-center justify-center text-[10px] font-bold">1</span>
            <span>Specify Drug A</span>
          </span>
          <ArrowRight size={13} className="text-slate-300 hidden sm:block" />
          <span className="flex items-center gap-1.5 font-semibold text-teal-800">
            <span className="w-5 h-5 rounded-full bg-teal-100 text-teal-800 flex items-center justify-center text-[10px] font-bold">2</span>
            <span>Specify Drug B</span>
          </span>
          <ArrowRight size={13} className="text-slate-300 hidden sm:block" />
          <span className="flex items-center gap-1.5 font-semibold text-slate-700">
            <span className="w-5 h-5 rounded-full bg-slate-100 text-slate-700 flex items-center justify-center text-[10px] font-bold">3</span>
            <span>Verify SMILES & Potency</span>
          </span>
          <ArrowRight size={13} className="text-slate-300 hidden sm:block" />
          <span className="flex items-center gap-1.5 font-semibold text-slate-700">
            <span className="w-5 h-5 rounded-full bg-slate-100 text-slate-700 flex items-center justify-center text-[10px] font-bold">4</span>
            <span>Predict Synergy Score</span>
          </span>
          <ArrowRight size={13} className="text-slate-300 hidden sm:block" />
          <span className="flex items-center gap-1.5 font-semibold text-slate-700">
            <span className="w-5 h-5 rounded-full bg-slate-100 text-slate-700 flex items-center justify-center text-[10px] font-bold">5</span>
            <span>Inspect Gamma Result</span>
          </span>
        </div>
      </div>

      {/* ── 2. Quick-Load Verified Example Pairs Toolbar ─────────────────────── */}
      <div className="p-4 bg-teal-50/70 border border-teal-200/80 rounded-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2 text-teal-900 font-semibold">
          <Sparkles size={16} className="text-teal-700 shrink-0" />
          <span>Quick-Load Verified Test Combos:</span>
          <span className="text-[11px] font-normal text-teal-700 hidden sm:inline">Pre-populate compound cards with real benchmarks from NCATS test set</span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => loadExamplePair(VERIFIED_EXAMPLES[0], VERIFIED_EXAMPLES[1])}
            className="px-3 py-1.5 bg-white hover:bg-teal-100/60 text-teal-900 font-medium rounded-lg border border-teal-300 shadow-sm transition-all"
          >
            Pralatrexate + Daporinad
          </button>
          <button
            type="button"
            onClick={() => loadExamplePair(VERIFIED_EXAMPLES[2], VERIFIED_EXAMPLES[3])}
            className="px-3 py-1.5 bg-white hover:bg-teal-100/60 text-teal-900 font-medium rounded-lg border border-teal-300 shadow-sm transition-all"
          >
            Panobinostat + Carfilzomib
          </button>
        </div>
      </div>

      {/* ── 3. Compound Cards (Drug A and Drug B Side-by-Side) ────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Drug A Card */}
        <div className="panel p-6 border-slate-200/90 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-teal-600 inline-block" />
              <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">Compound A</h2>
            </div>
            {/* Quick preset selector for Drug A */}
            <select
              onChange={(e) => {
                const ex = VERIFIED_EXAMPLES.find(v => v.label === e.target.value);
                if (ex) {
                  setDrug1Name(ex.drug_name);
                  setSmiles1(ex.smiles);
                  setAc50_1(ex.ac50);
                }
              }}
              className="text-xs bg-slate-50 border border-slate-200 rounded px-2 py-1 text-slate-700"
              defaultValue=""
            >
              <option value="" disabled>Load compound preset...</option>
              {VERIFIED_EXAMPLES.map(ex => (
                <option key={ex.label} value={ex.label}>{ex.label} ({ex.classType})</option>
              ))}
            </select>
          </div>

          <div className="space-y-3.5">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Drug Name</label>
              <input
                type="text"
                placeholder="e.g. Pralatrexate"
                value={drug1Name}
                onChange={(e) => setDrug1Name(e.target.value)}
                className="input-field"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold text-slate-700 flex items-center gap-1">
                  <span>SMILES Chemical Structure</span>
                  <span className="text-rose-500 font-bold">*</span>
                  <InfoTooltip text="Simplified Molecular Input Line Entry System (SMILES). Encodes the exact 2D chemical structure converted into 256-bit Morgan fingerprints." />
                </label>
                <span className="text-[10px] text-slate-400 font-mono">Morgan radius=2, 256 bits</span>
              </div>
              <textarea
                rows={3}
                placeholder="e.g. NC1=NC(N)=C2N=C(CC(CC#C)C3=CC=C(C=C3)C(=O)N[C@@H](CCC(O)=O)C(O)=O)C=NC2=N1"
                value={smiles1}
                onChange={(e) => setSmiles1(e.target.value)}
                className={`input-field font-mono text-xs ${fieldErrors.smiles1 ? 'border-rose-400 focus:border-rose-500 ring-rose-200' : ''}`}
              />
              {fieldErrors.smiles1 && (
                <p className="text-[11px] text-rose-600 mt-1 font-medium">{fieldErrors.smiles1}</p>
              )}
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold text-slate-700 flex items-center gap-1">
                  <span>Log AC50 (M) Potency</span>
                  <InfoTooltip text="Log10 single-agent concentration achieving 50% activity in PANC-1. More negative means higher potency. Default: −6.0 M if unknown." />
                </label>
                <span className="text-[10px] text-slate-500">Default: −6.0 M</span>
              </div>
              <input
                type="number"
                step="0.01"
                min="-12"
                max="0"
                placeholder="-6.0"
                value={ac50_1}
                onChange={(e) => setAc50_1(e.target.value)}
                className="input-field"
              />
            </div>
          </div>
        </div>

        {/* Drug B Card */}
        <div className="panel p-6 border-slate-200/90 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-cyan-600 inline-block" />
              <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">Compound B</h2>
            </div>
            {/* Quick preset selector for Drug B */}
            <select
              onChange={(e) => {
                const ex = VERIFIED_EXAMPLES.find(v => v.label === e.target.value);
                if (ex) {
                  setDrug2Name(ex.drug_name);
                  setSmiles2(ex.smiles);
                  setAc50_2(ex.ac50);
                }
              }}
              className="text-xs bg-slate-50 border border-slate-200 rounded px-2 py-1 text-slate-700"
              defaultValue=""
            >
              <option value="" disabled>Load compound preset...</option>
              {VERIFIED_EXAMPLES.map(ex => (
                <option key={ex.label} value={ex.label}>{ex.label} ({ex.classType})</option>
              ))}
            </select>
          </div>

          <div className="space-y-3.5">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Drug Name</label>
              <input
                type="text"
                placeholder="e.g. Daporinad"
                value={drug2Name}
                onChange={(e) => setDrug2Name(e.target.value)}
                className="input-field"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold text-slate-700 flex items-center gap-1">
                  <span>SMILES Chemical Structure</span>
                  <span className="text-rose-500 font-bold">*</span>
                  <InfoTooltip text="Simplified Molecular Input Line Entry System (SMILES). Encodes the exact 2D chemical structure converted into 256-bit Morgan fingerprints." />
                </label>
                <span className="text-[10px] text-slate-400 font-mono">Morgan radius=2, 256 bits</span>
              </div>
              <textarea
                rows={3}
                placeholder="e.g. O=C(NCCCCC1CCN(CC1)C(=O)C2=CC=CC=C2)\C=C\C3=CN=CC=C3"
                value={smiles2}
                onChange={(e) => setSmiles2(e.target.value)}
                className={`input-field font-mono text-xs ${fieldErrors.smiles2 ? 'border-rose-400 focus:border-rose-500 ring-rose-200' : ''}`}
              />
              {fieldErrors.smiles2 && (
                <p className="text-[11px] text-rose-600 mt-1 font-medium">{fieldErrors.smiles2}</p>
              )}
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold text-slate-700 flex items-center gap-1">
                  <span>Log AC50 (M) Potency</span>
                  <InfoTooltip text="Log10 single-agent concentration achieving 50% activity in PANC-1. More negative means higher potency. Default: −6.0 M if unknown." />
                </label>
                <span className="text-[10px] text-slate-500">Default: −6.0 M</span>
              </div>
              <input
                type="number"
                step="0.01"
                min="-12"
                max="0"
                placeholder="-6.0"
                value={ac50_2}
                onChange={(e) => setAc50_2(e.target.value)}
                className="input-field"
              />
            </div>
          </div>
        </div>
      </div>

      {/* ── 4. Action Bar (Predict Button + Reset) ───────────────────────────── */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-5 bg-white border border-slate-200/90 rounded-xl shadow-card">
        <div className="text-xs text-slate-500">
          <p className="font-semibold text-slate-700">Order-Invariant Prediction Engine</p>
          <p>Synergy prediction is physically symmetric: Synergy(A, B) ≡ Synergy(B, A).</p>
        </div>
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <button
            type="button"
            onClick={handleReset}
            className="btn-secondary text-xs flex-1 sm:flex-initial"
            disabled={loading}
          >
            <RotateCcw size={13} />
            <span>Reset Fields</span>
          </button>
          <button
            type="button"
            onClick={handlePredict}
            disabled={loading}
            className="btn-primary text-xs flex-1 sm:flex-initial py-2.5 px-6"
          >
            {loading ? (
              <>
                <Spinner size="sm" />
                <span>Computing Descriptors & Scoring...</span>
              </>
            ) : (
              <>
                <FlaskConical size={15} />
                <span>Predict Combination Synergy</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* ── 5. Error Notice if Call Fails ──────────────────────────────────── */}
      {error && (
        <ErrorState
          message={error}
          onRetry={handlePredict}
        />
      )}

      {/* ── 6. Prediction Results Hero Section (Post-Inference) ──────────────── */}
      {prediction && (
        <div className="panel p-7 border-teal-500/60 shadow-lg space-y-6 bg-white animate-in fade-in slide-in-from-bottom-2 duration-200">
          
          {/* Header of Results */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center">
                <CheckCircle2 size={18} />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Synergy Prediction: {prediction.drug_name_1} + {prediction.drug_name_2}
                </h3>
                <p className="text-xs text-slate-500">
                  Continuous synergy score evaluated by champion Random Forest regressor on PANC-1 line
                </p>
              </div>
            </div>

            <button
              onClick={copyResultSummary}
              className="btn-secondary text-xs flex items-center gap-1.5 py-1.5 px-3 self-start sm:self-auto"
            >
              {copied ? (
                <>
                  <Check size={13} className="text-emerald-600" />
                  <span className="text-emerald-700 font-semibold">Copied Report!</span>
                </>
              ) : (
                <>
                  <Copy size={13} />
                  <span>Copy Research Summary</span>
                </>
              )}
            </button>
          </div>

          {/* Focal Point: The Score & Classification */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
            
            {/* Big Score Hero Box */}
            <div className="p-6 rounded-2xl bg-slate-50 border border-slate-200 text-center flex flex-col items-center justify-center gap-2">
              <span className="text-xs uppercase font-bold text-slate-500 tracking-wider">
                Predicted Gamma (γ)
              </span>
              <div
                className="text-4xl sm:text-5xl font-extrabold tracking-tight tabular-nums"
                style={{ color: getGammaColor(prediction.predicted_gamma) }}
              >
                {fmt4(prediction.predicted_gamma)}
              </div>
              <div className="flex flex-wrap items-center justify-center gap-1.5 mt-1">
                <span className={getGammaBadgeClass(prediction.predicted_gamma)}>
                  {prediction.synergy_classification}
                </span>
                <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-slate-200/80 text-slate-700">
                  {prediction.synergy_strength}
                </span>
              </div>
              <span className="text-[11px] text-slate-400 mt-1 font-mono">
                Threshold: γ &lt; 1.0 (Synergistic)
              </span>
            </div>

            {/* Scientific Interpretation & Scale Bar */}
            <div className="md:col-span-2 space-y-4">
              <div>
                <span className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-1">
                  Phenotypic Synergy Interpretation
                </span>
                <p className="text-xs sm:text-sm text-slate-700 leading-relaxed bg-teal-50/60 p-4 rounded-xl border border-teal-200/70">
                  {getInterpretation(prediction.predicted_gamma)}
                </p>
              </div>

              {/* Verified Gamma Numerical Scale Indicator */}
              <div className="space-y-1.5 pt-1">
                <div className="flex items-center justify-between text-xs font-semibold text-slate-600">
                  <span>Continuous Physical Scale</span>
                  <span className="font-mono text-teal-800">Your Prediction: γ = {fmt4(prediction.predicted_gamma)}</span>
                </div>
                
                {/* Scale Visual */}
                <div className="relative h-4 rounded-full bg-slate-200 overflow-hidden flex">
                  <div className="h-full bg-emerald-500/80" style={{ width: '25%' }} title="High Synergy (Gamma < 0.5)" />
                  <div className="h-full bg-teal-500/70" style={{ width: '25%' }} title="Moderate Synergy (0.5 <= Gamma < 1.0)" />
                  <div className="h-full bg-slate-400/60" style={{ width: '25%' }} title="Additive (1.0 <= Gamma < 1.5)" />
                  <div className="h-full bg-rose-500/70" style={{ width: '25%' }} title="Antagonistic (Gamma >= 1.5)" />
                </div>

                <div className="flex justify-between text-[10px] text-slate-500 pt-0.5">
                  <span className="text-emerald-700 font-semibold">0.0 (High Synergy)</span>
                  <span className="text-teal-700 font-semibold">0.5 (Moderate)</span>
                  <span className="text-slate-700 font-bold">1.0 (Synergy Boundary)</span>
                  <span className="text-slate-500">1.5</span>
                  <span className="text-rose-600 font-semibold">2.0+ (Antagonism)</span>
                </div>
              </div>
            </div>
          </div>

          {/* Input Summary Card */}
          <div className="p-4 bg-slate-50/80 rounded-xl border border-slate-200/80 text-xs">
            <span className="font-bold text-slate-700 uppercase tracking-wider block mb-2">
              Evaluated Pair Input Parameters
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <span className="font-semibold text-slate-800">{prediction.drug_name_1}:</span>
                <span className="text-slate-500 ml-2">Potency Log AC50 = {typeof ac50_1 === 'number' ? ac50_1 : ac50_1} M</span>
                <p className="font-mono text-[11px] text-slate-500 truncate mt-0.5" title={smiles1}>{smiles1}</p>
              </div>
              <div>
                <span className="font-semibold text-slate-800">{prediction.drug_name_2}:</span>
                <span className="text-slate-500 ml-2">Potency Log AC50 = {typeof ac50_2 === 'number' ? ac50_2 : ac50_2} M</span>
                <p className="font-mono text-[11px] text-slate-500 truncate mt-0.5" title={smiles2}>{smiles2}</p>
              </div>
            </div>
          </div>

        </div>
      )}

      {/* ── 7. Scientific Non-Clinical Disclaimer ────────────────────────────── */}
      <div className="p-4 rounded-xl border border-slate-200 bg-white flex items-start gap-3 shadow-card">
        <Info size={16} className="text-slate-500 shrink-0 mt-0.5" />
        <p className="text-[11px] text-slate-500 leading-relaxed">
          <strong className="text-slate-700">Computational Research Model Notice:</strong> Predictions are generated by a machine-learning Random Forest regressor trained on in-vitro PANC-1 cell-line combinations. These represent estimated in-silico combination parameters and do not establish clinical efficacy, tolerability, or safety. For experimental drug-discovery research purposes only.
        </p>
      </div>
    </div>
  );
}
