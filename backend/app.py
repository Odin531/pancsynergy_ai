"""
FastAPI RESTful Application for PANC-1 Drug Combination Synergy Prediction.
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from backend.schemas import (
    DrugPairInput, 
    BatchDrugPairInput, 
    SynergyPredictionOutput, 
    BatchSynergyPredictionOutput,
    ModelInfoResponse
)
from backend.service import inference_service
from data.data_loader import load_validated_combos

app = FastAPI(
    title="PANC-1 Drug Combination Synergy Prediction API",
    description="Machine Learning RESTful API for screening and predicting synergy scores (Gamma) of drug combinations in PANC-1 pancreatic cancer cell lines using molecular descriptors.",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc"
)

# Enable CORS for frontend integration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/health", tags=["Health"])
def health_check():
    """Verify API service status and model availability."""
    ready = inference_service.is_ready()
    return {
        "status": "online",
        "model_loaded": ready,
        "model_name": inference_service.artifact.get("model_name") if ready else None
    }

@app.get("/api/v1/info", response_model=ModelInfoResponse, tags=["Model Info"])
def get_model_info():
    """Get metadata on the trained champion model, features, and performance metrics."""
    if not inference_service.is_ready():
        raise HTTPException(status_code=503, detail="Model is not yet loaded. Please run model training.")
    
    art = inference_service.artifact
    return ModelInfoResponse(
        status="active",
        model_name=art["model_name"],
        target_metric=art["target"],
        total_training_samples=art["n_samples"],
        feature_dimension=art["feature_dim"],
        champion_metrics=art["metrics"]
    )

@app.post("/api/v1/predict", response_model=SynergyPredictionOutput, tags=["Synergy Prediction"])
def predict_synergy(pair: DrugPairInput):
    """
    Predict synergy score (Gamma) for a single combination pair of compounds.
    Accepts SMILES strings and optional potency (Log AC50).
    """
    if not inference_service.is_ready():
        raise HTTPException(status_code=503, detail="Model is not yet loaded.")
    
    try:
        res = inference_service.predict_pair(
            smiles_1=pair.smiles_1,
            smiles_2=pair.smiles_2,
            log_ac50_1=pair.log_ac50_1 or -6.0,
            log_ac50_2=pair.log_ac50_2 or -6.0
        )
        return SynergyPredictionOutput(
            drug_name_1=pair.drug_name_1,
            drug_name_2=pair.drug_name_2,
            predicted_gamma=res["predicted_gamma"],
            synergy_classification=res["synergy_classification"],
            is_synergistic=res["is_synergistic"],
            synergy_strength=res["synergy_strength"]
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Prediction error: {str(e)}")

@app.post("/api/v1/predict/batch", response_model=BatchSynergyPredictionOutput, tags=["Synergy Prediction"])
def predict_batch_synergy(batch: BatchDrugPairInput):
    """
    High-throughput virtual screening: predict synergy scores for a batch of drug combinations.
    """
    if not inference_service.is_ready():
        raise HTTPException(status_code=503, detail="Model is not yet loaded.")
    
    results = []
    syn_count = 0
    for pair in batch.pairs:
        res = inference_service.predict_pair(
            smiles_1=pair.smiles_1,
            smiles_2=pair.smiles_2,
            log_ac50_1=pair.log_ac50_1 or -6.0,
            log_ac50_2=pair.log_ac50_2 or -6.0
        )
        if res["is_synergistic"]:
            syn_count += 1
            
        results.append(SynergyPredictionOutput(
            drug_name_1=pair.drug_name_1,
            drug_name_2=pair.drug_name_2,
            predicted_gamma=res["predicted_gamma"],
            synergy_classification=res["synergy_classification"],
            is_synergistic=res["is_synergistic"],
            synergy_strength=res["synergy_strength"]
        ))
        
    return BatchSynergyPredictionOutput(
        total_screened=len(batch.pairs),
        synergistic_count=syn_count,
        predictions=results
    )

@app.get("/api/v1/combos/validated", tags=["Dataset Exploration"])
def get_validated_combos(limit: int = 50):
    """
    Retrieve top experimentally validated synergistic drug combinations in PANC-1 from NCATS dataset.
    """
    try:
        df = load_validated_combos()
        # Sort by lowest Gamma (highest synergy)
        df = df.sort_values(by="Gamma", ascending=True).head(limit)
        return {
            "total_validated": len(df),
            "combinations": df.to_dict(orient="records")
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
