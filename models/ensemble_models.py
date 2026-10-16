"""
Ensemble Tree Models: Random Forest, Extra Trees, and Gradient Boosting.
"""

from sklearn.ensemble import (
    RandomForestRegressor, 
    ExtraTreesRegressor, 
    GradientBoostingRegressor,
    HistGradientBoostingRegressor
)
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler

def get_ensemble_models():
    models = {
        "Random Forest Regressor": Pipeline([
            ("scaler", StandardScaler()),
            ("regressor", RandomForestRegressor(
                n_estimators=150, 
                max_depth=14, 
                min_samples_split=4, 
                min_samples_leaf=2, 
                random_state=42, 
                n_jobs=-1
            ))
        ]),
        "Extra Trees Regressor": Pipeline([
            ("scaler", StandardScaler()),
            ("regressor", ExtraTreesRegressor(
                n_estimators=150, 
                max_depth=16, 
                min_samples_split=3, 
                random_state=42, 
                n_jobs=-1
            ))
        ]),
        "Gradient Boosting Regressor": Pipeline([
            ("scaler", StandardScaler()),
            ("regressor", GradientBoostingRegressor(
                n_estimators=120, 
                learning_rate=0.08, 
                max_depth=5, 
                subsample=0.85, 
                random_state=42
            ))
        ]),
        "Hist Gradient Boosting": Pipeline([
            ("scaler", StandardScaler()),
            ("regressor", HistGradientBoostingRegressor(
                max_iter=120, 
                learning_rate=0.08, 
                max_leaf_nodes=31, 
                random_state=42
            ))
        ])
    }
    return models
