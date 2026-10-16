"""
Master Execution Script for PANC1 Drug Synergy Prediction & RESTful API Backend.
Runs end-to-end:
1. Environment & data verification
2. Molecular descriptor feature extraction
3. Multi-model exploration, 5-fold CV & hold-out benchmarking
4. Model serialization
5. Launches FastAPI backend server and performs live test requests
"""

import os
import sys
import time
import subprocess
import os
import sys
import time
import argparse

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)

def run_api_self_test():
    print("\n -> Executing API Endpoint Tests...")
    from fastapi.testclient import TestClient
    from backend.app import app
    client = TestClient(app)
    
    # 1. Health
    res_h = client.get("/health")
    print(f"    [GET /health] Status: {res_h.status_code}, Body: {res_h.json()}")
    assert res_h.status_code == 200
    
    # 2. Info
    res_i = client.get("/api/v1/info")
    print(f"    [GET /api/v1/info] Status: {res_i.status_code}, Model: {res_i.json().get('model_name')}, Features: {res_i.json().get('feature_dimension')}")
    assert res_i.status_code == 200
    
    # 3. Single Prediction
    payload_single = {
        "drug_name_1": "Pralatrexate",
        "smiles_1": "NC1=NC(N)=C2N=C(CC(CC#C)C3=CC=C(C=C3)C(=O)N[C@@H](CCC(O)=O)C(O)=O)C=NC2=N1",
        "log_ac50_1": -7.27,
        "drug_name_2": "Daporinad",
        "smiles_2": "O=C(NCCCCC1CCN(CC1)C(=O)C2=CC=CC=C2)\\C=C\\C3=CN=CC=C3",
        "log_ac50_2": -7.53
    }
    res_p = client.post("/api/v1/predict", json=payload_single)
    data_p = res_p.json()
    print(f"    [POST /api/v1/predict] Status: {res_p.status_code}")
    print(f"      Result: {data_p['drug_name_1']} + {data_p['drug_name_2']}")
    print(f"      Predicted Gamma: {data_p['predicted_gamma']} ({data_p['synergy_classification']}, {data_p['synergy_strength']})")
    assert res_p.status_code == 200
    
    # 4. Batch Prediction
    payload_batch = {
        "pairs": [
            payload_single,
            {
                "drug_name_1": "Panobinostat",
                "smiles_1": "CC1=C(C=C(C=C1)NC(=O)C2=CC=C(C=C2)CNCC3=CNC4=CC=CC=C43)C(=O)NO",
                "log_ac50_1": -7.8,
                "drug_name_2": "Carfilzomib",
                "smiles_2": "CC(C)CC(C(=O)NC(CC1=CC=CC=C1)C(=O)NC(CC(C)C)C(=O)C2(C)CO2)NC(=O)C(CC3=CC=CC=C3)NC(=O)CN4CCOCC4",
                "log_ac50_2": -8.1
            }
        ]
    }
    res_b = client.post("/api/v1/predict/batch", json=payload_batch)
    data_b = res_b.json()
    print(f"    [POST /api/v1/predict/batch] Status: {res_b.status_code}, Screened: {data_b['total_screened']}, Synergistic: {data_b['synergistic_count']}")
    assert res_b.status_code == 200
    
    # 5. Validated Combos
    res_v = client.get("/api/v1/combos/validated?limit=3")
    data_v = res_v.json()
    print(f"    [GET /api/v1/combos/validated] Status: {res_v.status_code}, Top Combos: {len(data_v.get('combinations', []))}")
    assert res_v.status_code == 200
    print(" -> All API Endpoint Tests Succeeded!")

def main():
    parser = argparse.ArgumentParser(description="PANC1 Drug Synergy ML & RESTful API Pipeline")
    parser.add_argument("--skip-training", action="store_true", help="Skip training if saved champion model exists")
    parser.add_argument("--test-only", action="store_true", help="Run tests and exit without starting persistent server")
    parser.add_argument("--port", type=int, default=8000, help="Port to bind FastAPI server")
    parser.add_argument("--host", type=str, default="127.0.0.1", help="Host address for FastAPI server")
    args = parser.parse_args()

    print("=" * 75)
    print(" NCATS PANC-1 DRUG COMBINATION SYNERGY PREDICTION & RESTFUL API")
    print("=" * 75)
    
    # Step 1: Ensure datasets are downloaded and validated
    print("\n[Step 1/4] Ensuring Datasets & Ingestion...")
    from data.data_loader import ensure_raw_datasets, load_training_dataset, load_validated_combos
    ensure_raw_datasets()
    df_train = load_training_dataset()
    df_val = load_validated_combos()
    print(f" -> Training combinations ready: {len(df_train)} pairs")
    print(f" -> Validated NCATS synergistic combos: {len(df_val)} pairs")
    
    # Step 2: Feature Extraction and Model Training
    model_path = os.path.join(BASE_DIR, "saved_models", "best_synergy_model.pkl")
    if args.skip_training and os.path.exists(model_path):
        print("\n[Step 2/4] Skipping Training (--skip-training specified, using existing champion model)")
    else:
        print("\n[Step 2/4] Training & Benchmarking Models across 3 Families...")
        print(" - Baseline Regularized Regression (Ridge, Lasso, ElasticNet)")
        print(" - Ensemble Tree Models (Random Forest, Extra Trees, Gradient Boosting)")
        print(" - Deep Learning Multi-Layer Perceptron (Deep MLP)")
        
        from models.trainer import run_model_exploration_and_training
        artifact = run_model_exploration_and_training(n_splits=5)
        
        champion_name = artifact["model_name"]
        metrics = artifact["metrics"]
        print(f"\n -> Champion Model Selected: {champion_name}")
        print(f" -> Hold-Out Test Pearson r: {metrics['Test_Pearson_r']:.4f}")
        print(f" -> Hold-Out Test RMSE:      {metrics['Test_RMSE']:.4f}")
        print(f" -> Hold-Out Test R2:        {metrics['Test_R2']:.4f}")
    
    # Step 3: Run Unit & API Verification Tests
    print("\n[Step 3/4] Running Service & API Tests...")
    from backend.service import inference_service
    inference_service.load_model()
    run_api_self_test()
    
    if args.test_only:
        print("\nPipeline and tests completed successfully (--test-only specified). Exiting.")
        return
        
    # Step 4: Launching Server Demonstration
    import socket
    def find_available_port(host, preferred_port):
        for p in range(preferred_port, preferred_port + 50):
            with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
                try:
                    s.bind((host, p))
                    return p
                except OSError:
                    continue
        return preferred_port

    target_port = find_available_port(args.host, args.port)
    if target_port != args.port:
        print(f"\n[Notice] Port {args.port} is currently in use. Automatically switched to available port {target_port}.")

    print(f"\n[Step 4/4] Starting FastAPI RESTful API Backend on http://{args.host}:{target_port}...")
    print(f" -> Interactive Swagger UI: http://{args.host}:{target_port}/docs")
    print(f" -> ReDoc Documentation:   http://{args.host}:{target_port}/redoc")
    print(f" -> Health Endpoint:        http://{args.host}:{target_port}/health")
    print(f" -> Predict Endpoint:       http://{args.host}:{target_port}/api/v1/predict")
    
    import uvicorn
    from backend.app import app
    uvicorn.run(app, host=args.host, port=target_port)


if __name__ == "__main__":
    main()

