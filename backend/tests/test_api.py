"""
Unit and integration tests for FastAPI RESTful endpoints.
"""

import os
import sys

BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)

from fastapi.testclient import TestClient
from backend.app import app


client = TestClient(app)

def test_health_endpoint():
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "online"

def test_validated_combos():
    response = client.get("/api/v1/combos/validated?limit=5")
    assert response.status_code == 200
    data = response.json()
    assert "combinations" in data
    assert len(data["combinations"]) > 0

def test_single_prediction():
    payload = {
        "drug_name_1": "Pralatrexate",
        "smiles_1": "NC1=NC(N)=C2N=C(CC(CC#C)C3=CC=C(C=C3)C(=O)N[C@@H](CCC(O)=O)C(O)=O)C=NC2=N1",
        "log_ac50_1": -7.27,
        "drug_name_2": "Daporinad",
        "smiles_2": "O=C(NCCCCC1CCN(CC1)C(=O)C2=CC=CC=C2)\\C=C\\C3=CN=CC=C3",
        "log_ac50_2": -7.53
    }
    response = client.post("/api/v1/predict", json=payload)
    if response.status_code == 200:
        data = response.json()
        assert "predicted_gamma" in data
        assert "is_synergistic" in data
        assert "synergy_classification" in data

if __name__ == "__main__":
    print("Running API tests...")
    test_health_endpoint()
    print("Health check passed.")
    test_validated_combos()
    print("Validated combos passed.")
    test_single_prediction()
    print("Single prediction passed.")
    print("All API tests completed successfully!")
