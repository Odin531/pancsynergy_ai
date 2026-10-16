"""
Deep Learning Multi-Layer Perceptron (MLP) Regressor for Synergy Prediction.
"""

from sklearn.neural_network import MLPRegressor
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler

def get_deep_learning_models():
    models = {
        "Deep MLP Regressor": Pipeline([
            ("scaler", StandardScaler()),
            ("regressor", MLPRegressor(
                hidden_layer_sizes=(256, 128, 64),
                activation="relu",
                solver="adam",
                alpha=0.001,
                batch_size=32,
                learning_rate="adaptive",
                learning_rate_init=0.001,
                max_iter=400,
                early_stopping=True,
                n_iter_no_change=25,
                validation_fraction=0.15,
                random_state=42
            ))
        ])
    }
    return models
