"""
Evaluation metrics calculation module for synergy score regression.
Computes RMSE, MAE, R-squared, Pearson correlation, and Spearman rank correlation.
"""

import numpy as np
from scipy import stats
from sklearn.metrics import mean_squared_error, mean_absolute_error, r2_score

def compute_metrics(y_true, y_pred):
    y_true = np.asarray(y_true, dtype=np.float64).ravel()
    y_pred = np.asarray(y_pred, dtype=np.float64).ravel()
    
    # Check for NaN / Inf
    mask = np.isfinite(y_true) & np.isfinite(y_pred)
    y_true = y_true[mask]
    y_pred = y_pred[mask]
    
    if len(y_true) < 2:
        return {
            "rmse": float("nan"), "mae": float("nan"), "r2": float("nan"),
            "pearson_r": float("nan"), "spearman_rho": float("nan")
        }
        
    mse = mean_squared_error(y_true, y_pred)
    rmse = float(np.sqrt(mse))
    mae = float(mean_absolute_error(y_true, y_pred))
    r2 = float(r2_score(y_true, y_pred))
    
    # Pearson correlation
    if np.std(y_pred) > 1e-9 and np.std(y_true) > 1e-9:
        pearson_r, _ = stats.pearsonr(y_true, y_pred)
        spearman_rho, _ = stats.spearmanr(y_true, y_pred)
    else:
        pearson_r = 0.0
        spearman_rho = 0.0
        
    return {
        "rmse": round(rmse, 4),
        "mae": round(mae, 4),
        "r2": round(r2, 4),
        "pearson_r": round(float(pearson_r), 4),
        "spearman_rho": round(float(spearman_rho), 4)
    }
