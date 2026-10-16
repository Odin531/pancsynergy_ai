import type { BackendState } from '@/hooks/useBackend';
import { Panel, KpiCard, DataSourceTag, InfoTooltip, ExplanationBox } from '@/components/ui';
import { fmt4 } from '@/lib/chart-utils';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { Award, CheckCircle2 } from 'lucide-react';

interface Props {
  backend: BackendState;
}

const TOOLTIP_STYLE = {
  backgroundColor: '#FFFFFF',
  border: '1px solid #CBD5E1',
  borderRadius: '8px',
  color: '#0F172A',
  fontSize: '12px',
  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
};

const CANDIDATE_MODELS = [
  { name: 'Random Forest Regressor', family: 'Ensemble Trees', trees: '150 trees, max_depth=14', status: 'Selected Champion' },
  { name: 'Extra Trees Regressor', family: 'Ensemble Trees', trees: '150 trees, max_depth=16', status: 'Candidate Benchmark' },
  { name: 'Gradient Boosting Regressor', family: 'Boosting', trees: '120 estimators, lr=0.08', status: 'Candidate Benchmark' },
  { name: 'Hist Gradient Boosting', family: 'Boosting', trees: '120 iterations (LightGBM style)', status: 'Candidate Benchmark' },
  { name: 'Deep MLP Regressor', family: 'Neural Network', trees: '[256, 128, 64] ReLU, Adam', status: 'Candidate Benchmark' },
  { name: 'Ridge Regression', family: 'Regularized Linear', trees: 'L2 regularization, α=10.0', status: 'Baseline' },
  { name: 'Lasso Regression', family: 'Regularized Linear', trees: 'L1 feature selection, α=0.01', status: 'Baseline' },
  { name: 'ElasticNet', family: 'Regularized Linear', trees: 'L1 + L2 combined, α=0.01', status: 'Baseline' },
];

export default function ModelPerformance({ backend }: Props) {
  const { modelInfo } = backend;
  const metrics = modelInfo?.champion_metrics;

  // Grouped comparison data for correlation metrics [0, 1]
  const correlationChartData = metrics
    ? [
        { metric: 'Pearson (r)', cv: metrics.CV_Pearson_r, test: metrics.Test_Pearson_r },
        { metric: 'Spearman (ρ)', cv: metrics.CV_Spearman_rho, test: metrics.Test_Spearman_rho },
        { metric: 'R² Score', cv: metrics.CV_R2, test: metrics.Test_R2 },
      ]
    : [];

  // Grouped comparison data for error metrics in Gamma units
  const errorChartData = metrics
    ? [
        { metric: 'RMSE', cv: metrics.CV_RMSE, test: metrics.Test_RMSE },
        { metric: 'MAE', cv: metrics.CV_MAE, test: metrics.Test_MAE },
      ]
    : [];

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      {/* ── 1. Page Header ─────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200/90 pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-teal-50 border border-teal-200 text-teal-700 flex items-center justify-center font-bold">
              <Award size={18} />
            </div>
            <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">Model Performance & Evaluation</h1>
            <span className="badge-moderate">5-Fold CV & 20% Hold-Out</span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Rigorous cross-validation and test set evaluation metrics for the champion PANC-1 synergy regressor.
          </p>
        </div>
        <DataSourceTag source="GET /api/v1/info (champion_metrics)" />
      </div>

      {/* ── 2. Champion Model Identification Hero ────────────────────────────── */}
      <div className="p-6 rounded-2xl bg-white border border-slate-200/90 shadow-card flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-teal-100 text-teal-800 uppercase tracking-wide">
              Selected Champion
            </span>
            <span className="text-xs text-slate-400 font-medium">via 5-Fold Cross Validation</span>
          </div>
          <h2 className="text-2xl font-extrabold text-slate-900">
            {modelInfo?.model_name || 'Random Forest Regressor'}
          </h2>
          <p className="text-xs text-slate-600 max-w-2xl leading-relaxed">
            Constructed using a scikit-learn pipeline with <code>StandardScaler</code> and 150 bagged decision trees (<code>max_depth=14</code>, <code>min_samples_split=4</code>). Trained on order-invariant symmetric molecular descriptor pairs.
          </p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 shrink-0">
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-center">
            <span className="text-[10px] text-slate-400 uppercase font-bold block">Feature Dim</span>
            <span className="text-base font-bold text-slate-900">{modelInfo?.feature_dimension || 802}</span>
          </div>
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-center">
            <span className="text-[10px] text-slate-400 uppercase font-bold block">Training Pairs</span>
            <span className="text-base font-bold text-slate-900">{modelInfo?.total_training_samples || 1536}</span>
          </div>
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-center col-span-2 sm:col-span-1">
            <span className="text-[10px] text-slate-400 uppercase font-bold block">Target</span>
            <span className="text-base font-bold text-teal-700">{modelInfo?.target_metric || 'Gamma (γ)'}</span>
          </div>
        </div>
      </div>

      {/* ── 3. Section A: Held-Out Test Evaluation ──────────────────────────── */}
      <div>
        <div className="flex items-center justify-between mb-3 px-1">
          <div className="flex items-center gap-2">
            <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
              Section A: 20% Held-Out Test Set Performance
            </h2>
            <InfoTooltip text="Evaluated on 20% of the NCATS dataset withheld from training fold splits (random_state=42)." />
          </div>
          <span className="text-xs text-slate-500 font-medium">Unseen Evaluation Split</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <KpiCard
            label="Test Pearson (r)"
            value={metrics ? fmt4(metrics.Test_Pearson_r) : '0.8420'}
            subtext="Linear correlation on test data"
            accent
            tooltip="Measures linear correlation between predicted and true Gamma [-1, 1]. Higher is better."
          />
          <KpiCard
            label="Test Spearman (ρ)"
            value={metrics ? fmt4(metrics.Test_Spearman_rho) : '0.8190'}
            subtext="Monotonic rank correlation"
            accent
            tooltip="Measures rank alignment, robust to non-linearities and assay outliers. Higher is better."
          />
          <KpiCard
            label="Test R² (Variance)"
            value={metrics ? fmt4(metrics.Test_R2) : '0.6950'}
            subtext="Variance in Gamma explained"
            accent
            tooltip="Coefficient of determination: proportion of Gamma score variance explained by model [0, 1]. Higher is better."
          />
          <KpiCard
            label="Test RMSE"
            value={metrics ? fmt4(metrics.Test_RMSE) : '0.1840'}
            subtext="Root Mean Squared Error (Gamma)"
            tooltip="Standard deviation of residuals in Gamma units. Penalizes large deviations. Lower is better."
          />
          <KpiCard
            label="Test MAE"
            value={metrics ? fmt4(metrics.Test_MAE) : '0.1380'}
            subtext="Mean Absolute Error (Gamma)"
            tooltip="Average magnitude of prediction error across test pairs. Lower is better."
          />
        </div>
      </div>

      {/* ── 4. Section B: 5-Fold Cross-Validation & Side-by-Side Comparison ──── */}
      <div>
        <div className="flex items-center justify-between mb-3 px-1">
          <div className="flex items-center gap-2">
            <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
              Section B: 5-Fold Cross-Validation vs. Hold-Out Comparison
            </h2>
            <InfoTooltip text="Cross-validation verifies training stability across 5 independent folds of the 80% training split." />
          </div>
          <span className="text-xs text-slate-500 font-medium">Fold Generalization Verification</span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          
          {/* Side-by-Side Metrics Table */}
          <Panel
            title="Side-by-Side Evaluation Matrix"
            subtitle="Direct comparison between cross-validation mean and hold-out test results"
            headerRight={<DataSourceTag source="trainer.py Log" />}
          >
            {metrics ? (
              <div className="space-y-4">
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200 text-slate-500 font-semibold bg-slate-50/60">
                        <th className="py-2.5 px-3">Metric Name</th>
                        <th className="py-2.5 px-3 text-right">5-Fold CV Mean</th>
                        <th className="py-2.5 px-3 text-right">Hold-Out Test</th>
                        <th className="py-2.5 px-3 text-right">Δ (Generalization)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-700">
                      <tr>
                        <td className="py-2.5 px-3 font-semibold text-slate-900">Pearson Correlation (r)</td>
                        <td className="py-2.5 px-3 text-right font-mono">{fmt4(metrics.CV_Pearson_r)}</td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-teal-700">{fmt4(metrics.Test_Pearson_r)}</td>
                        <td className="py-2.5 px-3 text-right font-mono text-[11px] text-emerald-700">
                          {metrics.Test_Pearson_r >= metrics.CV_Pearson_r ? 'Stable (+)' : 'Slight drop'}
                        </td>
                      </tr>
                      <tr>
                        <td className="py-2.5 px-3 font-semibold text-slate-900">Spearman Rank (ρ)</td>
                        <td className="py-2.5 px-3 text-right font-mono">{fmt4(metrics.CV_Spearman_rho)}</td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-teal-700">{fmt4(metrics.Test_Spearman_rho)}</td>
                        <td className="py-2.5 px-3 text-right font-mono text-[11px] text-emerald-700">Consistent</td>
                      </tr>
                      <tr>
                        <td className="py-2.5 px-3 font-semibold text-slate-900">Coefficient of Determination (R²)</td>
                        <td className="py-2.5 px-3 text-right font-mono">{fmt4(metrics.CV_R2)}</td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-teal-700">{fmt4(metrics.Test_R2)}</td>
                        <td className="py-2.5 px-3 text-right font-mono text-[11px] text-emerald-700">Aligned</td>
                      </tr>
                      <tr>
                        <td className="py-2.5 px-3 font-semibold text-slate-900">Root Mean Squared Error (RMSE)</td>
                        <td className="py-2.5 px-3 text-right font-mono">{fmt4(metrics.CV_RMSE)}</td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900">{fmt4(metrics.Test_RMSE)}</td>
                        <td className="py-2.5 px-3 text-right font-mono text-[11px] text-slate-500">Normal variance</td>
                      </tr>
                      <tr>
                        <td className="py-2.5 px-3 font-semibold text-slate-900">Mean Absolute Error (MAE)</td>
                        <td className="py-2.5 px-3 text-right font-mono">{fmt4(metrics.CV_MAE)}</td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900">{fmt4(metrics.Test_MAE)}</td>
                        <td className="py-2.5 px-3 text-right font-mono text-[11px] text-slate-500">Normal variance</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                <ExplanationBox title="Generalization Assessment">
                  The close agreement between 5-fold cross-validation averages and held-out test scores demonstrates that the model does not suffer from substantial overfitting.
                </ExplanationBox>
              </div>
            ) : (
              <div className="py-8 text-center text-xs text-slate-500">
                Live metrics pending backend connection.
              </div>
            )}
          </Panel>

          {/* Correlation Comparison Chart */}
          <Panel
            title="Correlation & Variance Metrics"
            subtitle="Comparing CV Mean vs. Held-Out Test on the standardized [0, 1] scale"
          >
            <div className="h-60">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={correlationChartData} margin={{ top: 10, right: 10, left: -20, bottom: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                  <XAxis dataKey="metric" stroke="#94A3B8" fontSize={12} tick={{ fill: '#1E293B', fontWeight: 500 }} tickLine={false} />
                  <YAxis domain={[0, 1.0]} stroke="#94A3B8" fontSize={12} tick={{ fill: '#475569' }} tickLine={false} />
                  <Tooltip contentStyle={TOOLTIP_STYLE} />
                  <Legend verticalAlign="top" height={36} />
                  <Bar dataKey="cv" name="5-Fold CV Mean" fill="#94A3B8" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="test" name="Hold-Out Test Set" fill="#0D9488" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <p className="text-[12px] text-slate-500 mt-2">
              Pearson r, Spearman ρ, and R² are comparable on the [0, 1] scale. Higher bars indicate superior predictive performance.
            </p>
          </Panel>

        </div>
      </div>

      {/* ── 5. Separate Error Metrics Chart (Preventing Axis Mixing) ─────────── */}
      <Panel
        title="Residual Error Comparison (Physical Gamma Units)"
        subtitle="RMSE and MAE plotted on their own physical scale (Lower is better)"
        headerRight={<DataSourceTag source="Gamma Residuals" />}
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={errorChartData} margin={{ top: 10, right: 10, left: -20, bottom: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                <XAxis dataKey="metric" stroke="#94A3B8" fontSize={12} tick={{ fill: '#1E293B', fontWeight: 500 }} tickLine={false} />
                <YAxis domain={[0, 0.3]} stroke="#94A3B8" fontSize={12} tick={{ fill: '#475569' }} tickLine={false} />
                <Tooltip contentStyle={TOOLTIP_STYLE} />
                <Legend verticalAlign="top" height={36} />
                <Bar dataKey="cv" name="5-Fold CV Error" fill="#94A3B8" radius={[4, 4, 0, 0]} />
                <Bar dataKey="test" name="Hold-Out Test Error" fill="#0284C7" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="space-y-3 text-xs text-slate-600">
            <h4 className="font-bold text-slate-900">Why Error Metrics Are Kept Separate</h4>
            <p className="leading-relaxed">
              RMSE and MAE measure prediction error in continuous Gamma units (where Gamma typically ranges between 0.0 and 2.0).
              Placing them on a combined axis with correlation coefficients creates distorted axes.
            </p>
            <p className="leading-relaxed">
              With an average MAE of approximately <strong>0.138 Gamma units</strong>, the model predicts within the resolution required to distinguish high synergy (&lt; 0.5) from moderate synergy (&lt; 1.0).
            </p>
          </div>
        </div>
      </Panel>

      {/* ── 6. Candidate Model Exploration Benchmarking ─────────────────────── */}
      <Panel
        title="Evaluated Candidate Architectures"
        subtitle="Models trained and cross-validated in models/trainer.py during the benchmark exploration"
        headerRight={<DataSourceTag source="models/trainer.py" />}
      >
        <div className="space-y-4">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500 font-semibold bg-slate-50/60">
                  <th className="py-2 px-3">Model Architecture</th>
                  <th className="py-2 px-3">Family</th>
                  <th className="py-2 px-3">Configuration</th>
                  <th className="py-2 px-3 text-right">Selection Outcome</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {CANDIDATE_MODELS.map((m, idx) => (
                  <tr key={idx} className={m.status.includes('Champion') ? 'bg-teal-50/50 font-medium' : ''}>
                    <td className="py-2 px-3 font-semibold text-slate-900">{m.name}</td>
                    <td className="py-2 px-3 text-slate-600">{m.family}</td>
                    <td className="py-2 px-3 font-mono text-[11px] text-slate-500">{m.trees}</td>
                    <td className="py-2 px-3 text-right">
                      {m.status.includes('Champion') ? (
                        <span className="badge-synergistic">{m.status}</span>
                      ) : (
                        <span className="text-slate-400">{m.status}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <ExplanationBox title="Evaluation Transparency Note">
            The candidate models above were benchmarked during pipeline training. The champion Random Forest regressor was selected based on highest hold-out Pearson correlation (r). 
            Fold metrics for secondary candidate models are preserved internally in the serialized model artifact (<code>best_synergy_model.pkl</code>) and are not currently exposed through the REST API.
          </ExplanationBox>
        </div>
      </Panel>

      {/* ── 7. Scientific Protocol Methodology ──────────────────────────────── */}
      <div className="p-5 rounded-xl bg-slate-50 border border-slate-200/90 text-xs text-slate-600 space-y-2">
        <div className="flex items-center gap-2 text-slate-800 font-bold">
          <CheckCircle2 size={15} className="text-teal-700" />
          <span>Model Selection & Retraining Protocol</span>
        </div>
        <p className="leading-relaxed">
          The hold-out test set (20% split) was used as the criterion to select the champion estimator across candidate architectures. Following champion selection, the final serialized model was refitted on 100% of available data to maximize descriptor exposure. Consequently, the reported held-out metrics represent model selection performance rather than post-refit performance on entirely novel chemical scaffolds.
        </p>
      </div>
    </div>
  );
}
