import { Panel, DataSourceTag } from '@/components/ui';
import { BookOpen, ShieldAlert } from 'lucide-react';

export default function Methodology() {
  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      {/* ── 1. Page Header ─────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200/90 pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-teal-50 border border-teal-200 text-teal-700 flex items-center justify-center font-bold">
              <BookOpen size={18} />
            </div>
            <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">Scientific Methodology & Architecture</h1>
            <span className="badge-moderate">Pipeline Documentation</span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Complete mathematical formulation, feature extraction pipeline, validation protocols, and limitations.
          </p>
        </div>
        <DataSourceTag source="NCATS PANC-1 · Codebase Architecture" />
      </div>

      {/* ── 2. End-to-End Pipeline Workflow Diagram ─────────────────────────── */}
      <Panel
        title="End-to-End In-Silico Synergy Prediction Pipeline"
        subtitle="Step-by-step transformation from 2D molecular structures to continuous Gamma prediction"
      >
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3 relative">
          
          {/* Step 1 */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
            <div className="w-7 h-7 rounded-lg bg-teal-100 text-teal-800 font-bold text-xs flex items-center justify-center">
              1
            </div>
            <h4 className="font-bold text-xs text-slate-900">Compound Inputs</h4>
            <p className="text-[11px] text-slate-600 leading-relaxed">
              SMILES strings for Compound A & B, plus single-agent potencies (<code className="text-slate-800 font-mono text-[10px]">Log AC50</code>).
            </p>
          </div>

          {/* Step 2 */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
            <div className="w-7 h-7 rounded-lg bg-teal-100 text-teal-800 font-bold text-xs flex items-center justify-center">
              2
            </div>
            <h4 className="font-bold text-xs text-slate-900">Feature Extraction</h4>
            <p className="text-[11px] text-slate-600 leading-relaxed">
              RDKit 256-bit Morgan Fingerprints (<code className="text-slate-800 font-mono text-[10px]">radius=2</code>) + 10 physicochemical 2D descriptors per drug.
            </p>
          </div>

          {/* Step 3 */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
            <div className="w-7 h-7 rounded-lg bg-teal-100 text-teal-800 font-bold text-xs flex items-center justify-center">
              3
            </div>
            <h4 className="font-bold text-xs text-slate-900">Symmetric Vector</h4>
            <p className="text-[11px] text-slate-600 leading-relaxed">
              Order-invariant combinations: <code className="text-slate-800 font-mono text-[10px]">[v1+v2, |v1-v2|, v1⊙v2, potencies]</code> = 802 total dimensions.
            </p>
          </div>

          {/* Step 4 */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
            <div className="w-7 h-7 rounded-lg bg-teal-100 text-teal-800 font-bold text-xs flex items-center justify-center">
              4
            </div>
            <h4 className="font-bold text-xs text-slate-900">Champion Estimator</h4>
            <p className="text-[11px] text-slate-600 leading-relaxed">
              Random Forest Regressor (150 trees, max depth 14) with <code>StandardScaler</code> preprocessing pipeline.
            </p>
          </div>

          {/* Step 5 */}
          <div className="p-4 rounded-xl bg-teal-50/70 border border-teal-200 space-y-2">
            <div className="w-7 h-7 rounded-lg bg-teal-600 text-white font-bold text-xs flex items-center justify-center">
              5
            </div>
            <h4 className="font-bold text-xs text-teal-950">Gamma Prediction</h4>
            <p className="text-[11px] text-teal-900 leading-relaxed">
              Continuous Gamma (γ) prediction bounded to [0.0, ∞) and mapped to High, Moderate, or Additive synergy tiers.
            </p>
          </div>

        </div>
      </Panel>

      {/* ── 3. Biological & Target Variable Context ─────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        
        {/* Cell line biology */}
        <Panel
          title="PANC-1 Cellular In-Vitro Model"
          subtitle="Human pancreatic ductal adenocarcinoma cell line"
          headerRight={<DataSourceTag source="NCATS NIH Dataset" />}
        >
          <div className="space-y-3 text-xs text-slate-700 leading-relaxed">
            <p>
              <strong>PANC-1</strong> is a human pancreatic adenocarcinoma cell line derived from a 56-year-old Caucasian male with ductal adenocarcinoma. Pancreatic ductal adenocarcinoma (PDAC) is notorious for poor 5-year survival rates (&lt;11%) and pronounced chemoresistance to single-agent regimens.
            </p>
            <p>
              Dual-drug combination therapy is designed to overcome single-agent resistance by simultaneously inhibiting complementary survival pathways or epigenetically sensitizing resistant tumor cells.
            </p>
            <p>
              This platform was trained on matrix cell viability experiments conducted by the National Center for Advancing Translational Sciences (NCATS) specifically on PANC-1 cells.
            </p>
          </div>
        </Panel>

        {/* Target variable: Gamma */}
        <Panel
          title="Synergy Parameter: Gamma (γ)"
          subtitle="Physical definition and numerical interpretation"
          headerRight={<DataSourceTag source="backend/service.py" />}
        >
          <div className="space-y-3 text-xs text-slate-700 leading-relaxed">
            <p>
              <strong>Gamma (γ)</strong> is derived from dose-response matrix combination viability screens. It models the fractional inhibition observed when combining Drug A and Drug B relative to independent additive predictions.
            </p>
            <ul className="space-y-2 border-l-2 border-teal-500 pl-3">
              <li>
                <strong className="text-emerald-700">Gamma &lt; 0.5:</strong> High Synergy — Marked supra-additive reduction in cell viability.
              </li>
              <li>
                <strong className="text-teal-700">0.5 ≤ Gamma &lt; 1.0:</strong> Moderate Synergy — Synergistic combination benefit exceeding independent additive models.
              </li>
              <li>
                <strong className="text-slate-700">1.0 ≤ Gamma &lt; 1.5:</strong> Additive / Weak — Combination efficacy mirrors single-agent summation.
              </li>
              <li>
                <strong className="text-rose-700">Gamma ≥ 1.5:</strong> Antagonistic — Combination is less effective than independent administration.
              </li>
            </ul>
          </div>
        </Panel>

      </div>

      {/* ── 4. Mathematical Feature Formulation ─────────────────────────────── */}
      <Panel
        title="Order-Invariant Feature Engineering"
        subtitle="Mathematical construction of symmetric combination descriptor vectors"
        headerRight={<DataSourceTag source="data/feature_extractor.py" />}
      >
        <div className="space-y-4 text-xs text-slate-700">
          <p className="leading-relaxed">
            Synergy is physically order-invariant: testing Drug A with Drug B produces identical biological killing to testing Drug B with Drug A:
            <span className="font-mono text-teal-800 font-bold ml-2">Synergy(A, B) ≡ Synergy(B, A)</span>.
            If descriptors are simply concatenated as <code className="bg-slate-100 px-1 py-0.5 rounded font-mono text-[11px]">[v_A, v_B]</code>, machine-learning models produce inconsistent outputs depending on arbitrary input ordering.
          </p>

          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 font-mono text-xs text-slate-800 space-y-2">
            <p className="font-bold text-slate-900 font-sans">Symmetric Vector Composition Formula:</p>
            <p className="text-teal-900 font-semibold">
              x_pair = [ v_A + v_B, |v_A - v_B|, v_A ⊙ v_B, min(AC50), max(AC50), |AC50_A - AC50_B|, AC50_A + AC50_B ]
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
            <div className="p-3 bg-white border border-slate-200 rounded-lg">
              <span className="font-bold text-slate-900 block mb-0.5">1. Per-Drug Vector (266 Dims)</span>
              <span className="text-slate-500 text-[11px]">256-bit Morgan Fingerprint + 10 physicochemical descriptors (MolWt, LogP, TPSA, HBD, HBA, RotBonds, etc.).</span>
            </div>
            <div className="p-3 bg-white border border-slate-200 rounded-lg">
              <span className="font-bold text-slate-900 block mb-0.5">2. Symmetric Operators (798 Dims)</span>
              <span className="text-slate-500 text-[11px]">Vector sum (266) + Absolute difference (266) + Hadamard element-wise product (266).</span>
            </div>
            <div className="p-3 bg-white border border-slate-200 rounded-lg">
              <span className="font-bold text-slate-900 block mb-0.5">3. Potency Scalars (4 Dims)</span>
              <span className="text-slate-500 text-[11px]">Min potency + Max potency + Potency gap |ΔAC50| + Combined potency sum. Total = 802 features.</span>
            </div>
          </div>
        </div>
      </Panel>

      {/* ── 5. Rigorous Limitations & Scientific Boundaries ──────────────────── */}
      <Panel
        title="Scientific Limitations & Known Methodological Boundaries"
        subtitle="Critical context for judging and research interpretation"
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5">
            <h4 className="font-bold text-slate-900 flex items-center gap-1.5">
              <ShieldAlert size={14} className="text-amber-600" />
              <span>In-Vitro Cell Line Specificity</span>
            </h4>
            <p className="text-slate-600 leading-relaxed">
              All training combinations were measured in in-vitro monolayer cultures of PANC-1. In-vitro synergy does not directly translate to in-vivo pharmacokinetic bioavailability, dense tumor stroma penetration, or patient clinical tolerance.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5">
            <h4 className="font-bold text-slate-900 flex items-center gap-1.5">
              <ShieldAlert size={14} className="text-amber-600" />
              <span>Point-Estimate Predictions</span>
            </h4>
            <p className="text-slate-600 leading-relaxed">
              The Random Forest pipeline yields point estimates for Gamma (γ). It does not provide calibrated Bayesian credible intervals or conformal prediction bands. Predictions near boundary thresholds (e.g., 0.98 vs 1.02) should be interpreted with awareness of the ~0.138 MAE.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5">
            <h4 className="font-bold text-slate-900 flex items-center gap-1.5">
              <ShieldAlert size={14} className="text-amber-600" />
              <span>Chemical Applicability Domain</span>
            </h4>
            <p className="text-slate-600 leading-relaxed">
              Predictions are most reliable for compounds chemically related to the oncology scaffolds present in the NCATS training set (kinase inhibitors, epigenetics, proteasome inhibitors). Structurally novel chemotypes may fall outside the applicability domain.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5">
            <h4 className="font-bold text-slate-900 flex items-center gap-1.5">
              <ShieldAlert size={14} className="text-amber-600" />
              <span>SMILES Dependency</span>
            </h4>
            <p className="text-slate-600 leading-relaxed">
              Feature extraction relies on standardized SMILES strings. Chirality and specific salt formulations are abstracted into 2D RDKit representations.
            </p>
          </div>

        </div>
      </Panel>

      {/* ── 6. Prominent Non-Clinical Disclaimer Box ─────────────────────────── */}
      <div className="p-6 rounded-2xl bg-rose-50 border border-rose-200/90 text-rose-900 space-y-2 shadow-sm">
        <div className="flex items-center gap-2">
          <ShieldAlert size={20} className="text-rose-600" />
          <h3 className="text-sm font-bold uppercase tracking-wide text-rose-900">
            Important Research & Non-Clinical Disclaimer
          </h3>
        </div>
        <p className="text-xs text-rose-800 leading-relaxed">
          <strong>PancSynergy AI</strong> is a computational drug discovery proof-of-concept developed for hackathon research demonstrations. Predictions are generated by machine-learning models trained on publicly available NCATS PANC-1 in-vitro data. These predictions do <strong>NOT</strong> constitute clinical treatment recommendations, do <strong>NOT</strong> establish safety or in-vivo efficacy, and must <strong>NEVER</strong> be used to direct patient care. All computational leads must be validated through independent biological and pharmacological assays.
        </p>
      </div>
    </div>
  );
}
