"""
Synergy Prediction Inference Service.
Loads the serialized champion model and handles on-the-fly descriptor generation & scoring.
"""

import os
import joblib
import numpy as np

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MODEL_PATH = os.path.join(BASE_DIR, "saved_models", "best_synergy_model.pkl")

class SynergyInferenceService:
    def __init__(self):
        self.artifact = None
        self.model = None
        self.extractor = None
        self.load_model()

    def load_model(self):
        if os.path.exists(MODEL_PATH):
            self.artifact = joblib.load(MODEL_PATH)
            self.model = self.artifact["model"]
            self.extractor = self.artifact["extractor"]
            print(f"Loaded trained champion model: {self.artifact['model_name']}")
        else:
            print("Model artifact not found. Please train models first using run_all.py or models/trainer.py")

    def is_ready(self) -> bool:
        return self.model is not None and self.extractor is not None

    def predict_pair(self, smiles_1: str, smiles_2: str, log_ac50_1: float = -6.0, log_ac50_2: float = -6.0) -> dict:
        if not self.is_ready():
            raise RuntimeError("Model is not loaded. Train the model before serving predictions.")
        
        # Build symmetric feature vector
        feat = self.extractor.build_pair_features(smiles_1, smiles_2, log_ac50_1, log_ac50_2)
        X = feat.reshape(1, -1)
        
        # Predict continuous Gamma
        gamma_pred = float(self.model.predict(X)[0])
        # Clip to sensible physical bounds
        gamma_pred = round(max(0.0, gamma_pred), 4)
        
        is_syn = bool(gamma_pred < 1.0)
        if gamma_pred < 0.5:
            classification = "Synergistic"
            strength = "High Synergy"
        elif gamma_pred < 1.0:
            classification = "Synergistic"
            strength = "Moderate Synergy"
        elif gamma_pred < 1.5:
            classification = "Additive / Weak"
            strength = "Low / Additive"
        else:
            classification = "Antagonistic"
            strength = "Antagonistic"
            
        return {
            "predicted_gamma": gamma_pred,
            "is_synergistic": is_syn,
            "synergy_classification": classification,
            "synergy_strength": strength
        }

inference_service = SynergyInferenceService()
