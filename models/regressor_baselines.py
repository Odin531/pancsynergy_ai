"""
Regularized Regression Models: Ridge, Lasso, and ElasticNet.
"""

from sklearn.linear_model import Ridge, Lasso, ElasticNet
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler

def get_linear_models():
    models = {
        "Ridge Regression": Pipeline([
            ("scaler", StandardScaler()),
            ("regressor", Ridge(alpha=10.0, random_state=42))
        ]),
        "Lasso Regression": Pipeline([
            ("scaler", StandardScaler()),
            ("regressor", Lasso(alpha=0.01, max_iter=2000, random_state=42))
        ]),
        "ElasticNet": Pipeline([
            ("scaler", StandardScaler()),
            ("regressor", ElasticNet(alpha=0.01, l1_ratio=0.5, max_iter=2000, random_state=42))
        ])
    }
    return models
