# PANC-1 Drug Combination Synergy Prediction & RESTful API Backend

An end-to-end Machine Learning pipeline and production-ready RESTful API backend for predicting drug combination synergy scores (**Gamma**) on the **PANC-1 pancreatic cancer cell line**, developed using the **NCATS PANC1 dataset** (https://github.com/ncats/PANC1/tree/main/datasets).

---

## 🔬 Scientific Context & Dataset

- **Target Variable:** Gamma (Γ), the synergy parameter derived from in-vitro combination viability assays.
  - **Γ < 0.5:** Strong synergy.
  - **0.5 ≤ Γ < 1.0:** Moderate synergy.
  - **1.0 ≤ Γ < 1.5:** Additive or weak interaction.
  - **Γ ≥ 1.5:** Antagonistic interaction.
- **Input Features**:
  - Molecular chemical structures (SMILES) converted to **Extended-Connectivity Fingerprints (Morgan/ECFP, 256 bits)** and **2D physicochemical properties** (Molecular Weight, LogP, TPSA, HBD, HBA, Rotatable Bonds, Rings, etc.).
  - Single-agent pharmacological potencies (`Log AC50 (M)`).
- **Symmetric Order-Invariance**: Synergy is physically symmetric ($Synergy(A, B) \equiv Synergy(B, A)$). Combinations are constructed using symmetric vector operations:
  $$\mathbf{x}_{	ext{pair}} = [\mathbf{v}_A + \mathbf{v}_B, |\mathbf{v}_A - \mathbf{v}_B|, \mathbf{v}_A \odot \mathbf{v}_B, \min(	ext{AC50}), \max(	ext{AC50}), |\Delta 	ext{AC50}|]$$

---

## 🧠 Modeling Techniques Explored

1. **Regularized Linear Baselines**:
   - Ridge Regression (L2 regularization)
   - Lasso Regression (L1 feature selection)
   - ElasticNet Regression (L1 + L2)
2. **Ensemble Methods**:
   - Random Forest Regressor (150 trees)
   - Extra Trees Regressor (150 trees)
   - Gradient Boosting Regressor
   - Histogram-based Gradient Boosting (LightGBM style)
3. **Deep Learning**:
   - Multi-Layer Perceptron (Deep MLP with architecture [256, 128, 64], ReLU activations, early stopping, and adaptive learning rate)

All models are evaluated via **5-Fold Cross-Validation** and a **20% Hold-Out Test Set** across:
- **RMSE** (Root Mean Squared Error)
- **MAE** (Mean Absolute Error)
- **$R^2$** (Coefficient of Determination)
- **Pearson correlation ($r$)**
- **Spearman rank correlation ($
ho$)**

---

## 🚀 Quick Start

### 1. Run Everything (One-Click)
```cmd
py -u run_all.py
```
Or double-click `start.bat`.

The master script will automatically:
1. Verify datasets (`Training_set.csv`, `307_synergisitc_combos.csv`, `panc1_proliferate_single_agents.csv`).
2. Extract molecular descriptors.
3. Train and benchmark all models.
4. Serialize the champion model into `saved_models/best_synergy_model.pkl`.
5. Launch the FastAPI server at `http://127.0.0.1:8000`.

---

## 🌐 RESTful API Endpoints

Once the server is running, navigate to **http://127.0.0.1:8000/docs** for the interactive Swagger UI.

### Endpoints Overview

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/health` | Health check & model status |
| `GET` | `/api/v1/info` | Champion model metadata, feature dimension, and evaluation metrics |
| `POST` | `/api/v1/predict` | Single drug pair synergy prediction |
| `POST` | `/api/v1/predict/batch` | High-throughput batch synergy screening |
| `GET` | `/api/v1/combos/validated` | Top NCATS experimentally validated synergistic combinations |

### Sample Prediction Request (`POST /api/v1/predict`)
```json
{
  "drug_name_1": "Pralatrexate",
  "smiles_1": "NC1=NC(N)=C2N=C(CC(CC#C)C3=CC=C(C=C3)C(=O)N[C@@H](CCC(O)=O)C(O)=O)C=NC2=N1",
  "log_ac50_1": -7.27,
  "drug_name_2": "Daporinad",
  "smiles_2": "O=C(NCCCCC1CCN(CC1)C(=O)C2=CC=CC=C2)\\C=C\\C3=CN=CC=C3",
  "log_ac50_2": -7.53
}
```

### Sample Response
```json
{
  "drug_name_1": "Pralatrexate",
  "drug_name_2": "Daporinad",
  "predicted_gamma": 0.8421,
  "synergy_classification": "Synergistic",
  "is_synergistic": true,
  "synergy_strength": "Moderate Synergy"
}
```
