"""
Model Training, 5-Fold Cross-Validation, Hold-Out Evaluation, and Serialization.
"""

import os
import sys

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)

import joblib
import numpy as np
import pandas as pd
from sklearn.model_selection import KFold, train_test_split

from data.data_loader import load_training_dataset
from data.feature_extractor import MolecularFeatureExtractor, prepare_feature_matrix
from models.evaluate import compute_metrics
from models.regressor_baselines import get_linear_models
from models.ensemble_models import get_ensemble_models
from models.deep_learning import get_deep_learning_models

SAVED_MODELS_DIR = os.path.join(BASE_DIR, "saved_models")


def run_model_exploration_and_training(n_splits=5):
    os.makedirs(SAVED_MODELS_DIR, exist_ok=True)
    
    print("=" * 70)
    print("PANC1 SYNERGY MODEL EXPLORATION & BENCHMARKING")
    print("=" * 70)
    
    # 1. Load data
    df = load_training_dataset()
    extractor = MolecularFeatureExtractor(n_bits=256, radius=2)
    
    print(f"Extracting molecular fingerprints and descriptors (dim={extractor.get_feature_dimension()})...")
    X, y, labels, extractor = prepare_feature_matrix(df, extractor)
    print(f"Feature matrix shape: {X.shape}, Target shape: {y.shape}")
    
    # 2. Hold-out test split (80% train, 20% test)
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.20, random_state=42, shuffle=True
    )
    print(f"Train samples: {X_train.shape[0]}, Hold-out test samples: {X_test.shape[0]}")
    
    # 3. Assemble all candidate models
    all_models = {}
    all_models.update(get_linear_models())
    all_models.update(get_ensemble_models())
    all_models.update(get_deep_learning_models())
    
    results = []
    kf = KFold(n_splits=n_splits, shuffle=True, random_state=42)
    
    best_model_name = None
    best_test_r2 = -float("inf")
    trained_champion_model = None
    
    for name, model in all_models.items():
        print(f"\n--- Training & Cross-Validating: {name} ---")
        
        cv_metrics_list = []
        for fold, (train_idx, val_idx) in enumerate(kf.split(X_train)):
            X_tr, X_val = X_train[train_idx], X_train[val_idx]
            y_tr, y_val = y_train[train_idx], y_train[val_idx]
            
            # Clone/fit model
            from sklearn.base import clone
            fold_model = clone(model)
            fold_model.fit(X_tr, y_tr)
            val_pred = fold_model.predict(X_val)
            m = compute_metrics(y_val, val_pred)
            cv_metrics_list.append(m)
            
        # Average CV metrics
        cv_rmse = np.mean([m["rmse"] for m in cv_metrics_list])
        cv_mae = np.mean([m["mae"] for m in cv_metrics_list])
        cv_r2 = np.mean([m["r2"] for m in cv_metrics_list])
        cv_pr = np.mean([m["pearson_r"] for m in cv_metrics_list])
        cv_sr = np.mean([m["spearman_rho"] for m in cv_metrics_list])
        
        # Train on full train split and evaluate on hold-out test
        model.fit(X_train, y_train)
        test_pred = model.predict(X_test)
        test_m = compute_metrics(y_test, test_pred)
        
        print(f"5-Fold CV: RMSE={cv_rmse:.4f}, MAE={cv_mae:.4f}, R2={cv_r2:.4f}, Pearson r={cv_pr:.4f}")
        print(f"Test Set:  RMSE={test_m['rmse']:.4f}, MAE={test_m['mae']:.4f}, R2={test_m['r2']:.4f}, Pearson r={test_m['pearson_r']:.4f}")
        
        res = {
            "Model": name,
            "CV_RMSE": cv_rmse,
            "CV_MAE": cv_mae,
            "CV_R2": cv_r2,
            "CV_Pearson_r": cv_pr,
            "CV_Spearman_rho": cv_sr,
            "Test_RMSE": test_m["rmse"],
            "Test_MAE": test_m["mae"],
            "Test_R2": test_m["r2"],
            "Test_Pearson_r": test_m["pearson_r"],
            "Test_Spearman_rho": test_m["spearman_rho"]
        }
        results.append(res)
        
        # Selection criterion: highest test Pearson correlation & R2
        if test_m["pearson_r"] > best_test_r2:
            best_test_r2 = test_m["pearson_r"]
            best_model_name = name
            trained_champion_model = model
            
    # Display comparison leaderboard
    res_df = pd.DataFrame(results)
    print("\n" + "=" * 70)
    print("MODEL PERFORMANCE LEADERBOARD (Sorted by Test Pearson Correlation)")
    print("=" * 70)
    print(res_df.sort_values(by="Test_Pearson_r", ascending=False).to_string(index=False))
    
    # 4. Fit champion model on all data and save
    print(f"\nChampion Selected: {best_model_name} (Test Pearson r={best_test_r2:.4f})")
    from sklearn.base import clone
    final_model = clone(trained_champion_model)
    final_model.fit(X, y)
    
    artifact = {
        "model_name": best_model_name,
        "model": final_model,
        "extractor": extractor,
        "feature_dim": extractor.get_feature_dimension(),
        "n_samples": len(df),
        "target": "Gamma",
        "benchmark_leaderboard": results,
        "metrics": next(r for r in results if r["Model"] == best_model_name)
    }
    
    model_save_path = os.path.join(SAVED_MODELS_DIR, "best_synergy_model.pkl")
    joblib.dump(artifact, model_save_path)
    print(f"Champion model successfully saved to: {model_save_path}")
    return artifact

if __name__ == "__main__":
    run_model_exploration_and_training()
