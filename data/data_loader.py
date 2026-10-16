"""
PANC1 Data Ingestion Module
Loads and cleans training data, single-agent profiles, and validated synergy combinations.
"""

import os
import urllib.request
import pandas as pd
import numpy as np

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RAW_DIR = os.path.join(BASE_DIR, "data", "raw")
PROCESSED_DIR = os.path.join(BASE_DIR, "data", "processed")

DATA_URLS = {
    "Training_set.csv": "https://raw.githubusercontent.com/ncats/PANC1/main/datasets/Training_set.csv",
    "307_synergisitc_combos.csv": "https://raw.githubusercontent.com/ncats/PANC1/main/datasets/307_synergisitc_combos.csv",
    "panc1_proliferate_single_agents.csv": "https://raw.githubusercontent.com/ncats/PANC1/main/datasets/panc1_proliferate_single_agents.csv",
}

def ensure_raw_datasets():
    os.makedirs(RAW_DIR, exist_ok=True)
    os.makedirs(PROCESSED_DIR, exist_ok=True)
    for fname, url in DATA_URLS.items():
        dest = os.path.join(RAW_DIR, fname)
        if not os.path.exists(dest) or os.path.getsize(dest) == 0:
            print(f"Downloading {fname} from {url}...")
            req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
            with urllib.request.urlopen(req, timeout=60) as resp, open(dest, "wb") as f:
                f.write(resp.read())
            print(f"Saved {dest} ({os.path.getsize(dest)} bytes)")

def load_training_dataset():
    ensure_raw_datasets()
    csv_path = os.path.join(RAW_DIR, "Training_set.csv")
    df = pd.read_csv(csv_path)
    
    # Strip whitespace from column names and string fields
    df.columns = [c.strip() for c in df.columns]
    for col in df.select_dtypes(include=["object"]).columns:
        df[col] = df[col].astype(str).str.strip()
        
    # Clean numerical columns
    df["Gamma"] = pd.to_numeric(df["Gamma"], errors="coerce")
    df["Label"] = pd.to_numeric(df["Label"], errors="coerce")
    df["Log AC50 (M) 1"] = pd.to_numeric(df["Log AC50 (M) 1"], errors="coerce")
    df["Log AC50 (M) 2"] = pd.to_numeric(df["Log AC50 (M) 2"], errors="coerce")
    
    # Drop rows without target Gamma or structures
    initial_len = len(df)
    df = df.dropna(subset=["Gamma", "Structure 1", "Structure 2"])
    df = df[(df["Structure 1"] != "") & (df["Structure 2"] != "") & (df["Structure 1"] != "nan") & (df["Structure 2"] != "nan")]
    
    # Impute missing AC50 with median if any
    ac50_1_med = df["Log AC50 (M) 1"].median()
    ac50_2_med = df["Log AC50 (M) 2"].median()
    df["Log AC50 (M) 1"] = df["Log AC50 (M) 1"].fillna(ac50_1_med if pd.notna(ac50_1_med) else -6.0)
    df["Log AC50 (M) 2"] = df["Log AC50 (M) 2"].fillna(ac50_2_med if pd.notna(ac50_2_med) else -6.0)
    
    print(f"Loaded Training_set.csv: {len(df)} valid combination pairs (from {initial_len} raw entries)")
    return df

def load_validated_combos():
    ensure_raw_datasets()
    csv_path = os.path.join(RAW_DIR, "307_synergisitc_combos.csv")
    df = pd.read_csv(csv_path)
    df.columns = [c.strip() for c in df.columns]
    df["Gamma"] = pd.to_numeric(df["Gamma"], errors="coerce")
    return df

def load_single_agents():
    ensure_raw_datasets()
    csv_path = os.path.join(RAW_DIR, "panc1_proliferate_single_agents.csv")
    df = pd.read_csv(csv_path, low_memory=False)
    df.columns = [c.strip() for c in df.columns]
    return df

if __name__ == "__main__":
    df = load_training_dataset()
    print("Gamma distribution:")
    print(df["Gamma"].describe())
